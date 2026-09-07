import { Injectable, NotFoundException } from '@nestjs/common';
import type { PrescriptionDetail, PrescriptionItemDetail, PrescriptionItemInput } from '@clinic-care/shared-types';
import { Prescription, PrescriptionItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MedicinesService } from '../medicines/medicines.service';
import { DoseService } from './dose.service';
import { SavePrescriptionDto } from './dto/save-prescription.dto';

type PrescriptionWithItems = Prescription & { items: PrescriptionItem[] };

const ITEMS_ORDER = { items: { orderBy: { sortOrder: 'asc' as const } } };

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly medicinesService: MedicinesService,
    private readonly doseService: DoseService,
  ) {}

  async getByVisit(visitId: string): Promise<PrescriptionDetail | null> {
    const prescription = await this.prisma.prescription.findUnique({
      where: { visitId },
      include: ITEMS_ORDER,
    });
    return prescription ? this.toDetail(prescription) : null;
  }

  async getById(id: string): Promise<PrescriptionDetail> {
    const prescription = await this.prisma.prescription.findUnique({ where: { id }, include: ITEMS_ORDER });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }
    return this.toDetail(prescription);
  }

  /** Most recent other prescription for this patient, as fresh (unsaved) item inputs — "repeat last prescription". */
  async getLast(patientId: string, excludeVisitId: string): Promise<PrescriptionItemInput[]> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { patientId, visitId: { not: excludeVisitId } },
      include: ITEMS_ORDER,
      orderBy: { date: 'desc' },
    });
    if (!prescription) return [];
    return prescription.items.map((item) => this.toItemInput(item));
  }

  async save(visitId: string, dto: SavePrescriptionDto, createdBy: string): Promise<PrescriptionDetail> {
    // These two lookups don't depend on each other's result — run them together instead
    // of paying two sequential round trips on every prescription save.
    const [visit, existing] = await Promise.all([
      this.prisma.visit.findUnique({ where: { id: visitId }, select: { patientId: true } }),
      this.prisma.prescription.findUnique({ where: { visitId }, select: { id: true } }),
    ]);
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    const itemsData = dto.items.map((item, index) => ({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      strength: item.strength,
      form: item.form,
      dose: item.dose,
      morning: item.morning,
      afternoon: item.afternoon,
      evening: item.evening,
      night: item.night,
      beforeAfterFood: item.beforeAfterFood,
      durationDays: item.durationDays,
      totalQuantity: this.doseService.computeTotalQuantity(item),
      instruction: item.instruction,
      sortOrder: item.sortOrder ?? index,
    }));

    const prescription = existing
      ? await this.prisma.$transaction(async (tx) => {
          await tx.prescriptionItem.deleteMany({ where: { prescriptionId: existing.id } });
          return tx.prescription.update({
            where: { id: existing.id },
            data: { generalInstruction: dto.generalInstruction, items: { create: itemsData } },
            include: ITEMS_ORDER,
          });
        })
      : await this.prisma.prescription.create({
          data: {
            visitId,
            patientId: visit.patientId,
            generalInstruction: dto.generalInstruction,
            createdBy,
            items: { create: itemsData },
          },
          include: ITEMS_ORDER,
        });

    await Promise.all(dto.items.map((item) => this.medicinesService.incrementUsage(item.medicineId)));

    return this.toDetail(prescription);
  }

  async markPrinted(id: string): Promise<PrescriptionDetail> {
    const exists = await this.prisma.prescription.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('Prescription not found');
    }
    const prescription = await this.prisma.prescription.update({
      where: { id },
      data: { printCount: { increment: 1 }, printedAt: new Date() },
      include: ITEMS_ORDER,
    });
    return this.toDetail(prescription);
  }

  private toItemInput(item: PrescriptionItem): PrescriptionItemInput {
    return {
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      strength: item.strength ?? undefined,
      form: item.form as PrescriptionItemInput['form'],
      dose: item.dose ?? undefined,
      morning: item.morning,
      afternoon: item.afternoon,
      evening: item.evening,
      night: item.night,
      beforeAfterFood: item.beforeAfterFood as PrescriptionItemInput['beforeAfterFood'],
      durationDays: item.durationDays,
      instruction: item.instruction ?? undefined,
      sortOrder: item.sortOrder,
    };
  }

  private toDetail(prescription: PrescriptionWithItems): PrescriptionDetail {
    return {
      id: prescription.id,
      visitId: prescription.visitId,
      patientId: prescription.patientId,
      date: prescription.date.toISOString(),
      generalInstruction: prescription.generalInstruction,
      printedAt: prescription.printedAt ? prescription.printedAt.toISOString() : null,
      printCount: prescription.printCount,
      items: prescription.items.map((item) => ({
        id: item.id,
        totalQuantity: item.totalQuantity,
        ...this.toItemInput(item),
      })) satisfies PrescriptionItemDetail[],
    };
  }
}
