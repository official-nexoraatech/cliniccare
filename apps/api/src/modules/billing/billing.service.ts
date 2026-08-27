import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BillDetail, BillItemInput, BillListItem } from '@clinic-care/shared-types';
import { Bill, BillItem, Patient, Payment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NumberService } from '../number/number.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CancelBillDto } from './dto/cancel-bill.dto';

type BillWithRelations = Bill & { patient: Patient; items: BillItem[]; payments: Payment[] };

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

  async create(dto: CreateBillDto, createdBy: string): Promise<BillDetail> {
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

    const itemsData = this.buildItemsData(dto.items);
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

  async recordPayment(id: string, dto: RecordPaymentDto, createdBy: string): Promise<BillDetail> {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot record a payment on a cancelled bill');
    }
    const paidAmount = existing.paidAmount + dto.amount;
    if (paidAmount > existing.totalAmount) {
      throw new BadRequestException(`Payment of ${dto.amount} exceeds the due amount of ${existing.dueAmount}`);
    }
    const dueAmount = existing.totalAmount - paidAmount;

    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: { billId: id, amount: dto.amount, mode: dto.mode, reference: dto.reference, createdBy },
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

  async cancel(id: string, dto: CancelBillDto): Promise<BillDetail> {
    const existing = await this.findOrThrow(id);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Bill is already cancelled');
    }
    const bill = await this.prisma.bill.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: dto.reason },
      include: BILL_INCLUDE,
    });
    return this.toDetail(bill);
  }

  private buildItemsData(items: BillItemInput[]) {
    return items.map((item, index) => ({
      feeTypeId: item.feeTypeId,
      name: item.name,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      amount: item.quantity * item.unitAmount,
      sortOrder: item.sortOrder ?? index,
    }));
  }

  private computeTotals(items: { amount: number }[], discount: number, taxPercent: number | null) {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxableAmount = Math.max(subtotal - discount, 0);
    const taxAmount = taxPercent ? Math.round((taxableAmount * taxPercent) / 100) : 0;
    return { subtotal, taxAmount, totalAmount: taxableAmount + taxAmount };
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
      items: bill.items.map((item) => ({
        id: item.id,
        feeTypeId: item.feeTypeId ?? undefined,
        name: item.name,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        amount: item.amount,
        sortOrder: item.sortOrder,
      })),
      payments: bill.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        mode: payment.mode as BillDetail['payments'][number]['mode'],
        reference: payment.reference ?? undefined,
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
      printedAt: bill.printedAt?.toISOString() ?? null,
      printCount: bill.printCount,
      createdBy: bill.createdBy,
    };
  }
}
