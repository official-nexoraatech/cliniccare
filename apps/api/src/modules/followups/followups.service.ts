import { Injectable, NotFoundException } from '@nestjs/common';
import type { FollowUp, Patient, Prisma } from '@prisma/client';
import type { FollowUpCounts, FollowUpItem, PatientFollowUpSummary } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { istDayBounds, parseIstDate } from '../../common/utils/ist-date';
import { MarkContactedDto } from './dto/mark-contacted.dto';
import { RescheduleFollowUpDto } from './dto/reschedule-follow-up.dto';

const MISSED_THRESHOLD_DAYS = 7;
const AUTO_LINK_WINDOW_DAYS = 7;

const ITEM_INCLUDE = { patient: true, visit: { include: { prescription: { include: { items: true } } } } } as const;

type FollowUpRow = FollowUp & {
  patient: Patient;
  visit: { diagnosis: string | null; prescription: { items: { medicineName: string }[] } | null };
};

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDueToday(): Promise<FollowUpItem[]> {
    const { start, end } = istDayBounds();
    const rows = await this.prisma.followUp.findMany({
      where: { status: 'PENDING', dueDate: { gte: start, lte: end } },
      include: ITEM_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    return this.toItemsWithCompliance(rows);
  }

  async getOverdue(): Promise<FollowUpItem[]> {
    const { start } = istDayBounds();
    const rows = await this.prisma.followUp.findMany({
      where: { status: 'PENDING', dueDate: { lt: start } },
      include: ITEM_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    return this.toItemsWithCompliance(rows);
  }

  async getUpcoming(days: number): Promise<FollowUpItem[]> {
    const { end: todayEnd } = istDayBounds();
    const future = new Date(todayEnd);
    future.setDate(future.getDate() + days);
    const rows = await this.prisma.followUp.findMany({
      where: { status: 'PENDING', dueDate: { gt: todayEnd, lte: future } },
      include: ITEM_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    return this.toItemsWithCompliance(rows);
  }

  /** Overdue first (oldest first), then due today, prioritising chronic and poor-compliance patients. */
  async getCallList(): Promise<FollowUpItem[]> {
    const { end } = istDayBounds();
    const rows = await this.prisma.followUp.findMany({
      where: { status: 'PENDING', dueDate: { lte: end } },
      include: ITEM_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    const items = await this.toItemsWithCompliance(rows);

    return items.sort((a, b) => {
      if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
      const aPriority = this.priorityScore(a);
      const bPriority = this.priorityScore(b);
      return bPriority - aPriority;
    });
  }

  async getMissedThisMonth(): Promise<FollowUpItem[]> {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const missedCutoff = new Date();
    missedCutoff.setDate(missedCutoff.getDate() - MISSED_THRESHOLD_DAYS);

    const rows = await this.prisma.followUp.findMany({
      where: { status: 'PENDING', dueDate: { lt: missedCutoff, gte: monthAgo } },
      include: ITEM_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    return this.toItemsWithCompliance(rows);
  }

  async getCounts(): Promise<FollowUpCounts> {
    const { start, end } = istDayBounds();
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const missedCutoff = new Date();
    missedCutoff.setDate(missedCutoff.getDate() - MISSED_THRESHOLD_DAYS);
    const weekEnd = new Date(end);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [dueToday, overdue, upcomingThisWeek, missedThisMonth] = await Promise.all([
      this.prisma.followUp.count({ where: { status: 'PENDING', dueDate: { gte: start, lte: end } } }),
      this.prisma.followUp.count({ where: { status: 'PENDING', dueDate: { lt: start } } }),
      this.prisma.followUp.count({ where: { status: 'PENDING', dueDate: { gt: end, lte: weekEnd } } }),
      this.prisma.followUp.count({
        where: { status: 'PENDING', dueDate: { lt: missedCutoff, gte: monthAgo } },
      }),
    ]);

    return { dueToday, overdue, upcomingThisWeek, missedThisMonth };
  }

  async getForPatient(patientId: string): Promise<PatientFollowUpSummary> {
    const rows = await this.prisma.followUp.findMany({
      where: { patientId },
      include: ITEM_INCLUDE,
      orderBy: { dueDate: 'desc' },
    });
    const items = await this.toItemsWithCompliance(rows);
    const given = items.length;
    const attended = items.filter((i) => i.status === 'DONE').length;
    const missed = items.filter((i) => i.isMissed || i.status === 'MISSED').length;

    return { given, attended, missed, items };
  }

  async markContacted(id: string, dto: MarkContactedDto, contactedBy: string): Promise<FollowUpItem> {
    await this.findOrThrow(id);
    const updated = await this.prisma.followUp.update({
      where: { id },
      data: {
        contactedOn: new Date(),
        contactedBy,
        contactMode: dto.contactMode,
        contactResult: dto.contactResult,
        remark: dto.remark,
      },
      include: ITEM_INCLUDE,
    });
    const [item] = await this.toItemsWithCompliance([updated]);
    return item;
  }

  async reschedule(id: string, dto: RescheduleFollowUpDto): Promise<FollowUpItem> {
    const existing = await this.findOrThrow(id);
    const newDate = parseIstDate(dto.newDate);
    const updated = await this.prisma.followUp.update({
      where: { id },
      data: {
        dueDate: newDate,
        rescheduledTo: newDate,
        status: 'PENDING',
        remark: dto.reason ? [existing.remark, `Rescheduled: ${dto.reason}`].filter(Boolean).join(' | ') : existing.remark,
      },
      include: ITEM_INCLUDE,
    });
    const [item] = await this.toItemsWithCompliance([updated]);
    return item;
  }

  async cancel(id: string): Promise<FollowUpItem> {
    await this.findOrThrow(id);
    const updated = await this.prisma.followUp.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: ITEM_INCLUDE,
    });
    const [item] = await this.toItemsWithCompliance([updated]);
    return item;
  }

  /** Called by VisitsService right after a new visit is created — Day 9 rule 2. */
  async linkVisitIfFollowUpDue(
    patientId: string,
    visitId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - AUTO_LINK_WINDOW_DAYS);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + AUTO_LINK_WINDOW_DAYS);

    const pending = await tx.followUp.findFirst({
      where: { patientId, status: 'PENDING', dueDate: { gte: windowStart, lte: windowEnd } },
      orderBy: { dueDate: 'asc' },
    });
    if (!pending) return;

    await tx.followUp.update({
      where: { id: pending.id },
      data: { status: 'DONE', attendedOn: now, attendedVisitId: visitId },
    });
  }

  private priorityScore(item: FollowUpItem): number {
    let score = 0;
    if (item.patient.chronicDiseases) score += 2;
    if (item.latestCompliancePercent !== null && item.latestCompliancePercent < 50) score += 1;
    return score;
  }

  private async findOrThrow(id: string) {
    const followUp = await this.prisma.followUp.findUnique({ where: { id } });
    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }
    return followUp;
  }

  private async toItemsWithCompliance(rows: FollowUpRow[]): Promise<FollowUpItem[]> {
    if (rows.length === 0) return [];

    const patientIds = [...new Set(rows.map((r) => r.patientId))];
    const latestCompliances = await this.prisma.compliance.findMany({
      where: { patientId: { in: patientIds } },
      distinct: ['patientId'],
      orderBy: [{ patientId: 'asc' }, { recordedOn: 'desc' }],
    });
    const complianceByPatient = new Map(latestCompliances.map((c) => [c.patientId, c.overallPercent]));

    const now = new Date();
    return rows.map((row) => {
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - row.dueDate.getTime()) / 86_400_000));
      const isMissed = row.status === 'PENDING' && daysOverdue > MISSED_THRESHOLD_DAYS;
      const prescriptionItems = row.visit.prescription?.items ?? [];

      return {
        id: row.id,
        patientId: row.patientId,
        visitId: row.visitId,
        dueDate: row.dueDate.toISOString(),
        purpose: row.purpose,
        status: row.status as FollowUpItem['status'],
        isMissed,
        daysOverdue,
        contactedOn: row.contactedOn ? row.contactedOn.toISOString() : null,
        contactedBy: row.contactedBy,
        contactMode: row.contactMode as FollowUpItem['contactMode'],
        contactResult: row.contactResult as FollowUpItem['contactResult'],
        rescheduledTo: row.rescheduledTo ? row.rescheduledTo.toISOString() : null,
        attendedOn: row.attendedOn ? row.attendedOn.toISOString() : null,
        remark: row.remark,
        patient: {
          id: row.patient.id,
          patientId: row.patient.patientId,
          name: row.patient.name,
          age: row.patient.age,
          gender: row.patient.gender,
          mobile: row.patient.mobile,
          chronicDiseases: row.patient.chronicDiseases,
        },
        lastDiagnosis: row.visit.diagnosis,
        lastPrescriptionSummary: prescriptionItems.length > 0 ? prescriptionItems.map((i) => i.medicineName).join(', ') : null,
        latestCompliancePercent: complianceByPatient.get(row.patientId) ?? null,
      };
    });
  }
}
