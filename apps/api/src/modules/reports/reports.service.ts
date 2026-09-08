import { Injectable } from '@nestjs/common';
import type {
  AppointmentFunnelResponse,
  AppointmentStatus,
  PatientFootfallResponse,
  RevenueTrendResponse,
  TopMedicineItem,
} from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateRange(from: string, to: string) {
  return { gte: new Date(from), lte: new Date(`${to}T23:59:59.999`) };
}

/** Same zero-touch cross-module read style as Accounts/Compliance — fetch the rows in
 * range and bucket in application code rather than a raw Mongo aggregation pipeline,
 * fine at single-clinic data volumes. */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueTrend(from: string, to: string): Promise<RevenueTrendResponse> {
    const range = dateRange(from, to);
    const [bills, payments] = await Promise.all([
      this.prisma.bill.findMany({
        where: { date: range, status: { not: 'CANCELLED' } },
        select: { date: true, totalAmount: true },
      }),
      this.prisma.payment.findMany({
        where: { paidOn: range, bill: { status: { not: 'CANCELLED' } } },
        select: { paidOn: true, amount: true },
      }),
    ]);

    const byDay = new Map<string, { billed: number; collected: number }>();
    for (const bill of bills) {
      const entry = byDay.get(dayKey(bill.date)) ?? { billed: 0, collected: 0 };
      entry.billed += bill.totalAmount;
      byDay.set(dayKey(bill.date), entry);
    }
    for (const payment of payments) {
      const entry = byDay.get(dayKey(payment.paidOn)) ?? { billed: 0, collected: 0 };
      entry.collected += payment.amount;
      byDay.set(dayKey(payment.paidOn), entry);
    }

    const points = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => ({ date, ...totals }));

    return { from, to, points };
  }

  async getPatientFootfall(from: string, to: string): Promise<PatientFootfallResponse> {
    const visits = await this.prisma.visit.findMany({
      where: { visitDate: dateRange(from, to), status: { not: 'CANCELLED' } },
      select: { visitDate: true, visitType: true },
    });

    const byDay = new Map<string, { new: number; followUp: number; emergency: number }>();
    for (const visit of visits) {
      const key = dayKey(visit.visitDate);
      const entry = byDay.get(key) ?? { new: 0, followUp: 0, emergency: 0 };
      if (visit.visitType === 'NEW') entry.new += 1;
      else if (visit.visitType === 'FOLLOW_UP') entry.followUp += 1;
      else entry.emergency += 1;
      byDay.set(key, entry);
    }

    const points = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts, total: counts.new + counts.followUp + counts.emergency }));

    return { from, to, points };
  }

  async getAppointmentFunnel(from: string, to: string): Promise<AppointmentFunnelResponse> {
    const appointments = await this.prisma.appointment.findMany({
      where: { appointmentDate: dateRange(from, to) },
      select: { status: true },
    });

    const counts: Partial<Record<AppointmentStatus, number>> = {};
    for (const appointment of appointments) {
      const status = appointment.status as AppointmentStatus;
      counts[status] = (counts[status] ?? 0) + 1;
    }

    return {
      from,
      to,
      booked: counts.BOOKED ?? 0,
      confirmed: counts.CONFIRMED ?? 0,
      arrived: counts.ARRIVED ?? 0,
      inConsultation: counts.IN_CONSULTATION ?? 0,
      done: counts.DONE ?? 0,
      cancelled: counts.CANCELLED ?? 0,
      noShow: counts.NO_SHOW ?? 0,
      total: appointments.length,
    };
  }

  async getTopMedicines(limit: number): Promise<TopMedicineItem[]> {
    return this.prisma.medicine.findMany({
      where: { usageCount: { gt: 0 } },
      orderBy: { usageCount: 'desc' },
      take: limit,
      select: { id: true, brandName: true, genericName: true, usageCount: true },
    });
  }
}
