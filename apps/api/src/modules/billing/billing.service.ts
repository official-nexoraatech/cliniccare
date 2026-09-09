import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BillDetail, BillItemInput, BillListItem, ChargeDepartment } from '@clinic-care/shared-types';
import { Bill, BillItem, Patient, Payment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NumberService } from '../number/number.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CancelBillDto } from './dto/cancel-bill.dto';
import { AccountsService } from '../accounts/accounts.service';

type BillWithRelations = Bill & { patient: Patient; items: BillItem[]; payments: Payment[] };

/** Whoever is adding/removing a charge — id for the audit trail, role as a cheap
 * attribution snapshot (already on the caller's JWT, no extra query). */
export interface BillingActor {
  id: string;
  role: string;
}

const BILL_INCLUDE = {
  patient: true,
  items: { orderBy: { sortOrder: 'asc' as const } },
  payments: { orderBy: { paidOn: 'asc' as const } },
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberService: NumberService,
    private readonly accountsService: AccountsService,
  ) {}

  async list(filters: { status?: string; from?: string; to?: string }): Promise<BillListItem[]> {
    const bills = await this.prisma.bill.findMany({
      where: {
        status: filters.status ? (filters.status as Bill['status']) : undefined,
        date: {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(`${filters.to}T23:59:59.999`) : undefined,
        },
      },
      include: { patient: true },
      orderBy: { date: 'desc' },
    });
    return bills.map((bill) => this.toListItem(bill));
  }

  async listByPatient(patientId: string): Promise<BillListItem[]> {
    const bills = await this.prisma.bill.findMany({
      where: { patientId },
      include: { patient: true },
      orderBy: { date: 'desc' },
    });
    return bills.map((bill) => this.toListItem(bill));
  }

  async getById(id: string): Promise<BillDetail> {
    const bill = await this.prisma.bill.findUnique({ where: { id }, include: BILL_INCLUDE });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }
    return this.toDetail(bill);
  }

  async getByVisit(visitId: string): Promise<BillDetail | null> {
    // visitId is enforced unique (when set) by a partial index maintained outside Prisma's
    // schema — see the comment on Bill.visitId in schema.prisma — so findFirst is safe here.
    const bill = await this.prisma.bill.findFirst({ where: { visitId }, include: BILL_INCLUDE });
    return bill ? this.toDetail(bill) : null;
  }

  async ensureVisitBill(
    visitId: string,
    patientId: string,
    createdBy: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
    actor?: BillingActor,
  ): Promise<BillDetail> {
    const existing = await tx.bill.findFirst({ where: { visitId }, include: BILL_INCLUDE });
    if (existing) {
      return this.toDetail(existing);
    }

    const consultationFee = await this.resolveConsultationFee(tx);
    const itemsData = this.buildItemsData(
      [
        {
          feeTypeId: consultationFee.feeTypeId,
          name: consultationFee.name,
          quantity: 1,
          unitAmount: consultationFee.amount,
          sortOrder: 0,
          department: 'CONSULTATION',
        },
      ],
      actor,
    );
    const { subtotal, taxAmount, totalAmount } = this.computeTotals(itemsData, 0, null);

    const billNo = await this.numberService.getNext('BILL', tx);
    const bill = await tx.bill.create({
      data: {
        billNo,
        patientId,
        visitId,
        subtotal,
        taxAmount,
        totalAmount,
        dueAmount: totalAmount,
        status: totalAmount === 0 ? 'PAID' : 'UNPAID',
        remark: consultationFee.amount === 0 ? 'Automatic visit bill created without a configured consultation fee.' : undefined,
        createdBy,
        items: { create: itemsData },
      },
      include: BILL_INCLUDE,
    });
    return this.toDetail(bill);
  }

  async create(dto: CreateBillDto, createdBy: string, actor?: BillingActor): Promise<BillDetail> {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (dto.visitId) {
      const existing = await this.prisma.bill.findFirst({ where: { visitId: dto.visitId }, select: { id: true } });
      if (existing) {
        throw new ConflictException('This visit is already billed');
      }
    }

    const itemsData = this.buildItemsData(dto.items, actor);
    const { subtotal, taxAmount, totalAmount } = this.computeTotals(itemsData, dto.discount ?? 0, dto.taxPercent ?? null);

    const billNo = await this.numberService.getNext('BILL');
    const bill = await this.prisma.bill.create({
      data: {
        billNo,
        patientId: dto.patientId,
        visitId: dto.visitId,
        subtotal,
        discount: dto.discount ?? 0,
        taxPercent: dto.taxPercent ?? null,
        taxAmount,
        totalAmount,
        dueAmount: totalAmount,
        remark: dto.remark,
        createdBy,
        items: { create: itemsData },
      },
      include: BILL_INCLUDE,
    });
    return this.toDetail(bill);
  }

  /** Only while the bill has no payments recorded yet — once money has moved, the
   * bill is a financial record, not a draft, same reasoning as why a saved invoice
   * elsewhere never gets silently rewritten. */
  async update(id: string, dto: UpdateBillDto): Promise<BillDetail> {
    const existing = await this.prisma.bill.findUnique({ where: { id }, include: { payments: true } });
    if (!existing) {
      throw new NotFoundException('Bill not found');
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot edit a cancelled bill');
    }
    if (existing.payments.length > 0) {
      throw new BadRequestException('Cannot edit a bill that already has payments recorded');
    }

    const itemsData = this.buildItemsData(dto.items);
    const { subtotal, taxAmount, totalAmount } = this.computeTotals(itemsData, dto.discount ?? 0, dto.taxPercent ?? null);

    const bill = await this.prisma.$transaction(async (tx) => {
      await tx.billItem.deleteMany({ where: { billId: id } });
      return tx.bill.update({
        where: { id },
        data: {
          subtotal,
          discount: dto.discount ?? 0,
          taxPercent: dto.taxPercent ?? null,
          taxAmount,
          totalAmount,
          dueAmount: totalAmount,
          remark: dto.remark,
          items: { create: itemsData },
        },
        include: BILL_INCLUDE,
      });
    });
    return this.toDetail(bill);
  }

  /** The real-world gap update() can't cover: a charge (injection, dressing, ...) that only
   * becomes known partway through a visit, after the consultation fee is already paid.
   * Appends one item and recomputes totals off the existing discount/tax — existing items
   * and payments are untouched, so nothing already paid for is ever rewritten. */
  async addItem(id: string, item: BillItemInput, actor?: BillingActor): Promise<BillDetail> {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot add items to a cancelled bill');
    }

    // Only a still-PENDING item counts as "already there" — one that was cancelled or
    // waived by mistake can legitimately be re-added. Checked as "not cancelled/waived"
    // rather than "=== PENDING" so a bill item saved before `status` existed (undefined
    // in Mongo, not backfilled retroactively) still counts as pending instead of vanishing.
    const pendingItems = existing.items.filter((i) => i.status !== 'CANCELLED' && i.status !== 'WAIVED');
    const alreadyAdded = pendingItems.some((i) => this.isSameCharge(i, item));
    if (alreadyAdded) {
      return this.toDetail(existing);
    }

    const [newItemData] = this.buildItemsData([item], actor);
    const allAmounts = [...pendingItems.map((i) => ({ amount: i.amount })), newItemData];
    const { subtotal, taxAmount, totalAmount } = this.computeTotals(allAmounts, existing.discount, existing.taxPercent);
    const dueAmount = totalAmount - existing.paidAmount;

    const bill = await this.prisma.bill.update({
      where: { id },
      data: {
        subtotal,
        taxAmount,
        totalAmount,
        dueAmount,
        status: dueAmount === 0 ? 'PAID' : existing.paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
        items: { create: newItemData },
      },
      include: BILL_INCLUDE,
    });
    return this.toDetail(bill);
  }

  async addItemToVisitBill(
    visitId: string,
    patientId: string,
    item: BillItemInput,
    createdBy: string,
    actor?: BillingActor,
  ): Promise<BillDetail> {
    const bill = await this.ensureVisitBill(visitId, patientId, createdBy, this.prisma, actor);
    const alreadyAdded = bill.items.some((existing) => existing.status === 'PENDING' && this.isSameCharge(existing, item));

    if (alreadyAdded) {
      return bill;
    }

    return this.addItem(bill.id, item, actor);
  }

  async addItemsToVisitBill(
    visitId: string,
    patientId: string,
    items: BillItemInput[],
    createdBy: string,
    actor?: BillingActor,
  ): Promise<BillDetail> {
    const bill = await this.ensureVisitBill(visitId, patientId, createdBy, this.prisma, actor);
    const pendingItems = bill.items.filter((i) => i.status === 'PENDING');

    const uniqueItems = items.filter(
      (item, index, list) => list.findIndex((candidate) => this.isSameCharge(candidate, item)) === index,
    );
    const newItems = uniqueItems.filter((item) => !pendingItems.some((existing) => this.isSameCharge(existing, item)));

    if (newItems.length === 0) {
      return bill;
    }

    // One update carrying every new line item, instead of one findOrThrow+update round
    // trip per item — adding several lab/procedure charges at once used to serialize
    // that many separate writes.
    const newItemsData = this.buildItemsData(newItems, actor);
    const allAmounts = [...pendingItems.map((i) => ({ amount: i.amount })), ...newItemsData];
    const { subtotal, taxAmount, totalAmount } = this.computeTotals(allAmounts, bill.discount, bill.taxPercent);
    const dueAmount = totalAmount - bill.paidAmount;

    const updated = await this.prisma.bill.update({
      where: { id: bill.id },
      data: {
        subtotal,
        taxAmount,
        totalAmount,
        dueAmount,
        status: dueAmount === 0 ? 'PAID' : bill.paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
        items: { create: newItemsData },
      },
      include: BILL_INCLUDE,
    });
    return this.toDetail(updated);
  }

  async recordPayment(id: string, dto: RecordPaymentDto, createdBy: string): Promise<BillDetail> {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot record a payment on a cancelled bill');
    }
    const paidAmount = existing.paidAmount + dto.amount;
    if (paidAmount > existing.totalAmount) {
      throw new BadRequestException(`Payment of ${dto.amount} exceeds the due amount of ${existing.dueAmount}`);
    }
    const account = await this.accountsService.resolvePaymentAccount(dto.mode, dto.accountId);
    const dueAmount = existing.totalAmount - paidAmount;

    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          billId: id,
          amount: dto.amount,
          mode: dto.mode,
          reference: dto.reference,
          accountId: account?.id,
          accountName: account?.name,
          createdBy,
        },
      }),
      this.prisma.bill.update({
        where: { id },
        data: { paidAmount, dueAmount, status: dueAmount === 0 ? 'PAID' : 'PARTIAL' },
      }),
    ]);
    return this.getById(id);
  }

  async markPrinted(id: string): Promise<BillDetail> {
    await this.findOrThrow(id);
    const bill = await this.prisma.bill.update({
      where: { id },
      data: { printCount: { increment: 1 }, printedAt: new Date() },
      include: BILL_INCLUDE,
    });
    return this.toDetail(bill);
  }

  async cancel(id: string, dto: CancelBillDto, actor: BillingActor): Promise<BillDetail> {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Bill is already cancelled');
    }
    if (existing.dueAmount > 0) {
      throw new BadRequestException('Cannot cancel a bill with an outstanding due amount');
    }
    const bill = await this.prisma.bill.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.reason,
        cancelledBy: actor.id,
        cancelledByRole: actor.role,
        cancelledAt: new Date(),
      },
      include: BILL_INCLUDE,
    });
    return this.toDetail(bill);
  }

  /** Called when the visit that auto-created this bill gets cancelled (e.g. an ARRIVED
   * appointment marked CANCELLED). Only voids it if nothing has been paid yet — a bill
   * with money against it needs the real refund flow, not a silent cancel. Conditional
   * updateMany rather than fetch-then-update, matching the equivalent guard on Visit.cancel. */
  async cancelVisitBillIfUnpaid(
    visitId: string,
    reason: string | undefined,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await tx.bill.updateMany({
      where: { visitId, status: { not: 'CANCELLED' }, paidAmount: 0 },
      data: { status: 'CANCELLED', cancelReason: reason ?? 'Linked appointment was cancelled' },
    });
  }

  /** Removes one specific charge without touching the rest of the bill — the audited
   * alternative to update()'s "replace every item" for a bill nobody wants to fully redo.
   * CANCELLED means "shouldn't have been added"; WAIVED means "added correctly, but the
   * clinic chose not to charge for it" — both exclude the item from the bill's totals,
   * the difference is purely for the audit trail. */
  async cancelItem(billId: string, itemId: string, reason: string, actor: BillingActor): Promise<BillDetail> {
    return this.removeItem(billId, itemId, reason, actor, 'CANCELLED');
  }

  async waiveItem(billId: string, itemId: string, reason: string, actor: BillingActor): Promise<BillDetail> {
    return this.removeItem(billId, itemId, reason, actor, 'WAIVED');
  }

  private async removeItem(
    billId: string,
    itemId: string,
    reason: string,
    actor: BillingActor,
    status: 'CANCELLED' | 'WAIVED',
  ): Promise<BillDetail> {
    const existing = await this.findOrThrow(billId);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot modify a cancelled bill');
    }
    const item = existing.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException('Charge not found on this bill');
    }
    if (item.status === 'CANCELLED' || item.status === 'WAIVED') {
      throw new BadRequestException('This charge has already been cancelled or waived');
    }

    const remainingAmounts = existing.items
      .filter((i) => i.id !== itemId && i.status !== 'CANCELLED' && i.status !== 'WAIVED')
      .map((i) => ({ amount: i.amount }));
    const { subtotal, taxAmount, totalAmount } = this.computeTotals(remainingAmounts, existing.discount, existing.taxPercent);

    // A charge can be removed as long as what's already been paid still fits inside the
    // bill total once it's gone — e.g. an item added by mistake after a partial payment,
    // where the payment never actually covered it. Only block when removing it would leave
    // the bill owing less than what's already in hand — that's a refund, not an edit.
    if (existing.paidAmount > totalAmount) {
      throw new BadRequestException(
        `Cannot remove this charge — ${existing.paidAmount} is already paid, which would exceed the ${totalAmount} bill total left after removing it. Process a refund first.`,
      );
    }
    const dueAmount = totalAmount - existing.paidAmount;

    await this.prisma.$transaction([
      this.prisma.billItem.update({
        where: { id: itemId },
        data: { status, removedBy: actor.id, removedByRole: actor.role, removedAt: new Date(), removeReason: reason },
      }),
      this.prisma.bill.update({
        where: { id: billId },
        data: {
          subtotal,
          taxAmount,
          totalAmount,
          dueAmount,
          status: dueAmount === 0 ? 'PAID' : existing.paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
        },
      }),
    ]);
    return this.getById(billId);
  }

  private isSameCharge(
    a: { feeTypeId?: string | null; name: string; quantity: number; unitAmount: number },
    b: { feeTypeId?: string | null; name: string; quantity: number; unitAmount: number },
  ): boolean {
    return (
      (a.feeTypeId ?? null) === (b.feeTypeId ?? null) &&
      a.name === b.name &&
      a.quantity === b.quantity &&
      a.unitAmount === b.unitAmount
    );
  }

  /** Falls back to a default department from the adding user's role when the caller
   * doesn't specify one — based on the seeded DOCTOR/ASSISTANT role names, so a clinic
   * that renames those roles should have its frontend pass `department` explicitly. */
  private resolveDepartment(explicit: ChargeDepartment | undefined, role: string | undefined): ChargeDepartment {
    if (explicit) return explicit;
    if (role === 'DOCTOR') return 'DOCTOR_PROCEDURE';
    if (role === 'ASSISTANT') return 'NURSING';
    return 'OTHER';
  }

  private buildItemsData(items: BillItemInput[], actor?: BillingActor) {
    return items.map((item, index) => ({
      feeTypeId: item.feeTypeId,
      name: item.name,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      amount: item.quantity * item.unitAmount,
      sortOrder: item.sortOrder ?? index,
      department: this.resolveDepartment(item.department, actor?.role),
      status: 'PENDING' as const,
      createdBy: actor?.id ?? null,
      createdByRole: actor?.role ?? null,
    }));
  }

  private computeTotals(items: { amount: number }[], discount: number, taxPercent: number | null) {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxableAmount = Math.max(subtotal - discount, 0);
    const taxAmount = taxPercent ? Math.round((taxableAmount * taxPercent) / 100) : 0;
    return { subtotal, taxAmount, totalAmount: taxableAmount + taxAmount };
  }

  private async resolveConsultationFee(
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ feeTypeId?: string; name: string; amount: number }> {
    const feeType =
      (await tx.feeType.findFirst({ where: { isActive: true, isDefault: true } })) ??
      (await tx.feeType.findFirst({
        where: { isActive: true, name: { contains: 'consult', mode: 'insensitive' } },
      }));

    return feeType
      ? { feeTypeId: feeType.id, name: feeType.name, amount: feeType.amount }
      : { name: 'Consultation Fee', amount: 0 };
  }

  private async findOrThrow(id: string): Promise<BillWithRelations> {
    const bill = await this.prisma.bill.findUnique({ where: { id }, include: BILL_INCLUDE });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }
    return bill;
  }

  private toListItem(bill: Bill & { patient: Patient }): BillListItem {
    return {
      id: bill.id,
      billNo: bill.billNo,
      patientId: bill.patientId,
      patientName: bill.patient.name,
      patientMobile: bill.patient.mobile,
      visitId: bill.visitId,
      date: bill.date.toISOString(),
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      dueAmount: bill.dueAmount,
      status: bill.status as BillListItem['status'],
    };
  }

  private toDetail(bill: BillWithRelations): BillDetail {
    return {
      id: bill.id,
      billNo: bill.billNo,
      patientId: bill.patientId,
      patientName: bill.patient.name,
      patientMobile: bill.patient.mobile,
      visitId: bill.visitId,
      date: bill.date.toISOString(),
      // Falls back defensively on every new field: a BillItem saved before this migration
      // has none of them in Mongo at all (no retroactive backfill on @default for existing
      // documents), so reading an old bill must not assume they're present.
      items: bill.items.map((item) => ({
        id: item.id,
        feeTypeId: item.feeTypeId ?? undefined,
        name: item.name,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        amount: item.amount,
        sortOrder: item.sortOrder,
        department: (item.department ?? 'OTHER') as BillDetail['items'][number]['department'],
        status: (item.status ?? 'PENDING') as BillDetail['items'][number]['status'],
        createdBy: item.createdBy ?? null,
        createdByRole: item.createdByRole ?? null,
        createdAt: (item.createdAt ?? bill.createdAt).toISOString(),
        removedBy: item.removedBy ?? null,
        removedByRole: item.removedByRole ?? null,
        removedAt: item.removedAt?.toISOString() ?? null,
        removeReason: item.removeReason ?? null,
      })),
      payments: bill.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        mode: payment.mode as BillDetail['payments'][number]['mode'],
        reference: payment.reference ?? undefined,
        accountId: payment.accountId ?? null,
        accountName: payment.accountName ?? null,
        paidOn: payment.paidOn.toISOString(),
        createdBy: payment.createdBy,
      })),
      subtotal: bill.subtotal,
      discount: bill.discount,
      taxPercent: bill.taxPercent,
      taxAmount: bill.taxAmount,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      dueAmount: bill.dueAmount,
      status: bill.status as BillDetail['status'],
      remark: bill.remark,
      cancelReason: bill.cancelReason,
      cancelledBy: bill.cancelledBy ?? null,
      cancelledByRole: bill.cancelledByRole ?? null,
      cancelledAt: bill.cancelledAt?.toISOString() ?? null,
      printedAt: bill.printedAt?.toISOString() ?? null,
      printCount: bill.printCount,
      createdBy: bill.createdBy,
    };
  }
}
