import { Injectable } from '@nestjs/common';
import type { AccountsSummary, DaybookEntry, OutstandingDueItem, PaymentMode } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';

/** Reads straight off Bill+Payment — no separate ledger table, same zero-touch
 * cross-module read style as Dashboard/Compliance/Reports use over other modules. */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(from: string, to: string): Promise<AccountsSummary> {
    const dateRange = { gte: new Date(from), lte: new Date(`${to}T23:59:59.999`) };

    const bills = await this.prisma.bill.findMany({
      where: { date: dateRange, status: { not: 'CANCELLED' } },
      select: { totalAmount: true, dueAmount: true },
    });
    const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalDue = bills.reduce((sum, b) => sum + b.dueAmount, 0);

    const payments = await this.prisma.payment.findMany({
      where: { paidOn: dateRange, bill: { status: { not: 'CANCELLED' } } },
      select: { amount: true, mode: true },
    });
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    const breakdownMap = new Map<PaymentMode, number>();
    for (const payment of payments) {
      const mode = payment.mode as PaymentMode;
      breakdownMap.set(mode, (breakdownMap.get(mode) ?? 0) + payment.amount);
    }

    return {
      from,
      to,
      totalBilled,
      totalCollected,
      totalDue,
      billCount: bills.length,
      paymentModeBreakdown: [...breakdownMap.entries()].map(([mode, amount]) => ({ mode, amount })),
    };
  }

  async getOutstandingDues(): Promise<OutstandingDueItem[]> {
    const bills = await this.prisma.bill.findMany({
      where: { dueAmount: { gt: 0 }, status: { not: 'CANCELLED' } },
      include: { patient: true },
      orderBy: { date: 'asc' },
    });
    return bills.map((bill) => ({
      id: bill.id,
      billNo: bill.billNo,
      patientId: bill.patientId,
      patientName: bill.patient.name,
      patientMobile: bill.patient.mobile,
      date: bill.date.toISOString(),
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      dueAmount: bill.dueAmount,
      status: bill.status as OutstandingDueItem['status'],
    }));
  }

  async getDaybook(date: string): Promise<DaybookEntry[]> {
    const dateRange = { gte: new Date(date), lte: new Date(`${date}T23:59:59.999`) };
    const payments = await this.prisma.payment.findMany({
      where: { paidOn: dateRange, bill: { status: { not: 'CANCELLED' } } },
      include: { bill: { include: { patient: true } } },
      orderBy: { paidOn: 'asc' },
    });
    return payments.map((payment) => ({
      billId: payment.billId,
      billNo: payment.bill.billNo,
      patientName: payment.bill.patient.name,
      paymentId: payment.id,
      amount: payment.amount,
      mode: payment.mode as PaymentMode,
      paidOn: payment.paidOn.toISOString(),
    }));
  }
}
