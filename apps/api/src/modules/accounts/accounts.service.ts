import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AccountsSummary,
  CreatePaymentAccountRequest,
  DaybookEntry,
  OutstandingDueItem,
  PaymentAccount,
  PaymentAccountType,
  PaymentMode,
  UpdatePaymentAccountRequest,
} from '@clinic-care/shared-types';
import type { PaymentAccount as PrismaPaymentAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Reads straight off Bill+Payment — no separate ledger table, same zero-touch
 * cross-module read style as Dashboard/Compliance/Reports use over other modules. */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPaymentAccounts(): Promise<PaymentAccount[]> {
    await this.ensureDefaultPaymentAccounts();
    const accounts = await this.prisma.paymentAccount.findMany({
      orderBy: [{ status: 'asc' }, { type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
    return accounts.map((account) => this.toPaymentAccount(account));
  }

  async createPaymentAccount(dto: CreatePaymentAccountRequest): Promise<PaymentAccount> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Account name is required');
    }
    if (new Date(dto.openingBalanceDate).getTime() > Date.now()) {
      throw new BadRequestException('Opening balance date cannot be in the future');
    }
    const account = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.paymentAccount.updateMany({ where: { type: dto.type, isDefault: true }, data: { isDefault: false } });
      }
      return tx.paymentAccount.create({
        data: {
          name,
          type: dto.type,
          bankName: dto.type === 'BANK' ? dto.bankName?.trim() || null : null,
          accountNumberMasked: dto.type === 'BANK' ? dto.accountNumberMasked?.trim() || null : null,
          ifsc: dto.type === 'BANK' ? dto.ifsc?.trim().toUpperCase() || null : null,
          openingBalance: dto.openingBalance,
          openingBalanceDate: new Date(dto.openingBalanceDate),
          isDefault: Boolean(dto.isDefault),
        },
      });
    });
    return this.toPaymentAccount(account);
  }

  async updatePaymentAccount(id: string, dto: UpdatePaymentAccountRequest): Promise<PaymentAccount> {
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) {
      throw new BadRequestException('Account name is required');
    }
    const account = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentAccount.findUnique({ where: { id } });
      if (!existing) {
        throw new BadRequestException('Payment account not found');
      }
      if (dto.isDefault) {
        await tx.paymentAccount.updateMany({ where: { type: existing.type, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.paymentAccount.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(dto.bankName !== undefined ? { bankName: existing.type === 'BANK' ? dto.bankName.trim() || null : null } : {}),
          ...(dto.accountNumberMasked !== undefined
            ? { accountNumberMasked: existing.type === 'BANK' ? dto.accountNumberMasked.trim() || null : null }
            : {}),
          ...(dto.ifsc !== undefined ? { ifsc: existing.type === 'BANK' ? dto.ifsc.trim().toUpperCase() || null : null } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.status === 'INACTIVE' ? { isDefault: false } : {}),
        },
      });
    });
    return this.toPaymentAccount(account);
  }

  async deactivatePaymentAccount(id: string): Promise<PaymentAccount> {
    const account = await this.prisma.paymentAccount.update({
      where: { id },
      data: { status: 'INACTIVE', isDefault: false },
    });
    return this.toPaymentAccount(account);
  }

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
      select: { amount: true, mode: true, accountId: true, accountName: true },
    });
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    const breakdownMap = new Map<PaymentMode, number>();
    const accountBreakdownMap = new Map<string, { accountId: string | null; accountName: string; amount: number }>();
    for (const payment of payments) {
      const mode = payment.mode as PaymentMode;
      breakdownMap.set(mode, (breakdownMap.get(mode) ?? 0) + payment.amount);
      const accountName = payment.accountName ?? 'Unassigned';
      const accountKey = payment.accountId ?? `name:${accountName}`;
      const existing = accountBreakdownMap.get(accountKey);
      accountBreakdownMap.set(accountKey, {
        accountId: payment.accountId,
        accountName,
        amount: (existing?.amount ?? 0) + payment.amount,
      });
    }

    return {
      from,
      to,
      totalBilled,
      totalCollected,
      totalDue,
      billCount: bills.length,
      paymentModeBreakdown: [...breakdownMap.entries()].map(([mode, amount]) => ({ mode, amount })),
      paymentAccountBreakdown: [...accountBreakdownMap.values()].sort((a, b) => b.amount - a.amount),
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
      accountId: payment.accountId,
      accountName: payment.accountName,
      paidOn: payment.paidOn.toISOString(),
    }));
  }

  async resolvePaymentAccount(mode: PaymentMode, accountId?: string): Promise<PrismaPaymentAccount | null> {
    await this.ensureDefaultPaymentAccounts();
    const type: PaymentAccountType = mode === 'CASH' ? 'CASH' : 'BANK';
    if (accountId) {
      const account = await this.prisma.paymentAccount.findFirst({ where: { id: accountId, type, status: 'ACTIVE' } });
      if (!account) {
        throw new BadRequestException('Selected account is not active for this payment method');
      }
      return account;
    }
    return (
      (await this.prisma.paymentAccount.findFirst({ where: { type, status: 'ACTIVE', isDefault: true } })) ??
      (await this.prisma.paymentAccount.findFirst({ where: { type, status: 'ACTIVE' }, orderBy: { name: 'asc' } }))
    );
  }

  private async ensureDefaultPaymentAccounts(): Promise<void> {
    const defaults = [
      { name: 'Cash Counter', type: 'CASH' as const, isDefault: true },
      { name: 'Main Bank Account', type: 'BANK' as const, isDefault: true },
      { name: 'UPI Account', type: 'BANK' as const, isDefault: false },
    ];
    for (const account of defaults) {
      await this.prisma.paymentAccount.upsert({
        where: { name: account.name },
        update: { type: account.type },
        create: { ...account, status: 'ACTIVE', openingBalance: 0, openingBalanceDate: new Date() },
      });
    }
  }

  private toPaymentAccount(account: PrismaPaymentAccount): PaymentAccount {
    const legacyAccount = account as PrismaPaymentAccount & { isActive?: boolean };
    return {
      id: account.id,
      name: account.name,
      type: (account.type ?? 'CASH') as PaymentAccount['type'],
      bankName: account.bankName ?? null,
      accountNumberMasked: account.accountNumberMasked ?? null,
      ifsc: account.ifsc ?? null,
      openingBalance: account.openingBalance ?? 0,
      openingBalanceDate: (account.openingBalanceDate ?? account.createdAt).toISOString(),
      status: (account.status ?? (legacyAccount.isActive === false ? 'INACTIVE' : 'ACTIVE')) as PaymentAccount['status'],
      isDefault: account.isDefault,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
