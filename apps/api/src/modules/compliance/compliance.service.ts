import { Injectable, NotFoundException } from '@nestjs/common';
import type { Compliance } from '@prisma/client';
import type {
  ComplianceContext,
  ComplianceGrade,
  ComplianceRecord,
  ComplianceReportRow,
  PatientComplianceResponse,
} from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { SaveComplianceDto } from './dto/save-compliance.dto';

// Weights sum to 1 — medicine adherence counts more than follow-up attendance, per the
// guide's default (0.7/0.3). Not yet exposed as a Settings screen — see Info guide 2.5;
// add one if a clinic actually asks to change these instead of building it speculatively.
const MEDICINE_WEIGHT = 0.7;
const FOLLOW_UP_WEIGHT = 0.3;

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything the entry screen needs for its live preview, before anything is saved. */
  async getContext(patientId: string): Promise<ComplianceContext> {
    const [lastPrescription, followUpsGiven, followUpsAttended] = await Promise.all([
      this.prisma.prescription.findFirst({
        where: { patientId },
        include: { items: true },
        orderBy: { date: 'desc' },
      }),
      this.prisma.followUp.count({ where: { patientId } }),
      this.prisma.followUp.count({ where: { patientId, status: 'DONE' } }),
    ]);

    const dosesPrescribed = lastPrescription
      ? lastPrescription.items.reduce((sum, item) => sum + item.totalQuantity, 0)
      : null;

    return { dosesPrescribed, followUpsGiven, followUpsAttended };
  }

  async record(dto: SaveComplianceDto, recordedBy?: string): Promise<ComplianceRecord> {
    const visit = await this.prisma.visit.findUnique({ where: { id: dto.visitId }, select: { patientId: true } });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    const context = await this.getContext(visit.patientId);
    // No prescription yet = not applicable, never a misleading 0% — same divide-by-zero
    // guard the guide calls out explicitly (Info guide 2.5).
    const dosesPrescribed = context.dosesPrescribed ?? 0;
    const medicinePercent = dosesPrescribed > 0 ? this.round((dto.dosesTaken / dosesPrescribed) * 100) : 0;
    const followUpPercent =
      context.followUpsGiven > 0 ? this.round((context.followUpsAttended / context.followUpsGiven) * 100) : 0;
    const overallPercent = this.round(medicinePercent * MEDICINE_WEIGHT + followUpPercent * FOLLOW_UP_WEIGHT);
    const grade = this.toGrade(overallPercent);

    const compliance = await this.prisma.compliance.create({
      data: {
        patientId: visit.patientId,
        visitId: dto.visitId,
        dosesPrescribed,
        dosesTaken: dto.dosesTaken,
        medicinePercent,
        followUpsGiven: context.followUpsGiven,
        followUpsAttended: context.followUpsAttended,
        followUpPercent,
        overallPercent,
        grade,
        reasonForMissing: dto.reasonForMissing,
        remark: dto.remark,
        recordedBy,
      },
    });

    return this.toRecord(compliance);
  }

  async getForPatient(patientId: string): Promise<PatientComplianceResponse> {
    const records = await this.prisma.compliance.findMany({
      where: { patientId },
      orderBy: { recordedOn: 'desc' },
    });

    const lifetimeAverage =
      records.length > 0 ? this.round(records.reduce((sum, r) => sum + r.overallPercent, 0) / records.length) : null;

    return {
      records: records.map((r) => this.toRecord(r)),
      lifetimeAverage,
      trend: records.slice(0, 6).map((r) => this.toRecord(r)),
    };
  }

  async getReport(grade?: ComplianceGrade): Promise<ComplianceReportRow[]> {
    // One row per patient — their most recent compliance record only, matching the
    // guide's "all patients with their %" report shape.
    const latestPerPatient = await this.prisma.compliance.findMany({
      distinct: ['patientId'],
      orderBy: [{ patientId: 'asc' }, { recordedOn: 'desc' }],
      include: { visit: { include: { patient: true } } },
    });

    return latestPerPatient
      .filter((r) => !grade || r.grade === grade)
      .map((r) => ({
        patientId: r.patientId,
        patientName: r.visit.patient.name,
        patientMobile: r.visit.patient.mobile,
        latestPercent: r.overallPercent,
        latestGrade: r.grade as ComplianceGrade,
        recordedOn: r.recordedOn.toISOString(),
      }))
      .sort((a, b) => a.latestPercent - b.latestPercent);
  }

  private toGrade(percent: number): 'GOOD' | 'AVERAGE' | 'POOR' {
    if (percent >= 80) return 'GOOD';
    if (percent >= 50) return 'AVERAGE';
    return 'POOR';
  }

  private round(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private toRecord(compliance: Compliance): ComplianceRecord {
    return {
      id: compliance.id,
      patientId: compliance.patientId,
      visitId: compliance.visitId,
      recordedOn: compliance.recordedOn.toISOString(),
      dosesPrescribed: compliance.dosesPrescribed,
      dosesTaken: compliance.dosesTaken,
      medicinePercent: compliance.medicinePercent,
      followUpsGiven: compliance.followUpsGiven,
      followUpsAttended: compliance.followUpsAttended,
      followUpPercent: compliance.followUpPercent,
      overallPercent: compliance.overallPercent,
      grade: compliance.grade as ComplianceGrade,
      reasonForMissing: compliance.reasonForMissing as ComplianceRecord['reasonForMissing'],
      remark: compliance.remark,
    };
  }
}
