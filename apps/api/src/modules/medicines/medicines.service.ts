import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MedicineCustomFieldValues,
  MedicineDetail,
  MedicineListResponse,
  MedicineSearchResult,
  MedicineSummary,
} from '@clinic-care/shared-types';
import { Medicine } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { ListMedicinesQueryDto } from './dto/list-medicines-query.dto';

@Injectable()
export class MedicinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMedicinesQueryDto): Promise<MedicineListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      isActive: query.isActive === undefined ? true : query.isActive === 'true',
      ...(query.form ? { form: query.form } : {}),
      ...(query.category ? { category: { contains: query.category, mode: 'insensitive' as const } } : {}),
      ...(query.favouriteOnly === 'true' ? { isFavourite: true } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.medicine.findMany({
        where,
        orderBy: [{ isFavourite: 'desc' }, { brandName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.medicine.count({ where }),
    ]);

    return { items: rows.map((row) => this.toSummary(row)), total, page, pageSize };
  }

  /** Type-ahead: favourites and frequently-used medicines surface first, so the doctor rarely has to scroll. */
  async search(q: string): Promise<MedicineSearchResult[]> {
    const query = q.trim();
    if (!query) return [];

    const rows = await this.prisma.medicine.findMany({
      where: {
        isActive: true,
        OR: [
          { brandName: { contains: query, mode: 'insensitive' } },
          { genericName: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ isFavourite: 'desc' }, { usageCount: 'desc' }, { brandName: 'asc' }],
      take: 10,
    });

    return rows.map((row) => ({
      id: row.id,
      brandName: row.brandName,
      genericName: row.genericName,
      strength: row.strength,
      form: row.form as MedicineSearchResult['form'],
      defaultMorning: row.defaultMorning,
      defaultAfternoon: row.defaultAfternoon,
      defaultEvening: row.defaultEvening,
      defaultNight: row.defaultNight,
      defaultBeforeAfterFood: row.defaultBeforeAfterFood as MedicineSearchResult['defaultBeforeAfterFood'],
      defaultDurationDays: row.defaultDurationDays,
      defaultDose: row.defaultDose,
    }));
  }

  async getById(id: string): Promise<MedicineDetail> {
    const medicine = await this.prisma.medicine.findUnique({ where: { id } });
    if (!medicine) {
      throw new NotFoundException('Medicine not found');
    }
    return this.toDetail(medicine);
  }

  async create(dto: CreateMedicineDto): Promise<MedicineDetail> {
    const { customFields, ...rest } = dto;
    const defs = await this.prisma.medicineFieldDefinition.findMany({ where: { isActive: true } });

    const validKeys = new Set(defs.map((d) => d.key));
    const mergedCustomFields = this.mergeCustomFields(customFields, null, validKeys);
    this.assertRequiredFieldsSatisfied(defs, { ...rest, ...mergedCustomFields });

    const medicine = await this.prisma.medicine.create({
      data: {
        ...rest,
        // brandName/form are NOT NULL columns — fall back to a sentinel ("", UNSPECIFIED)
        // when admin has made the field optional/hidden and it was left blank, so every
        // existing display site keeps a real value to read.
        brandName: dto.brandName || '',
        form: dto.form ?? 'UNSPECIFIED',
        customFields: JSON.stringify(mergedCustomFields),
      },
    });
    return this.toDetail(medicine);
  }

  async update(id: string, dto: UpdateMedicineDto): Promise<MedicineDetail> {
    const { customFields, ...rest } = dto;
    const existing = await this.prisma.medicine.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Medicine not found');
    }

    const defs = await this.prisma.medicineFieldDefinition.findMany({ where: { isActive: true } });
    const validKeys = new Set(defs.map((d) => d.key));
    const mergedCustomFields = this.mergeCustomFields(customFields, existing.customFields, validKeys);
    this.assertRequiredFieldsSatisfied(defs, { ...this.mergeCoreFieldValues(dto, existing), ...mergedCustomFields });

    const medicine = await this.prisma.medicine.update({
      where: { id },
      data: { ...rest, customFields: JSON.stringify(mergedCustomFields) },
    });
    return this.toDetail(medicine);
  }

  async deactivate(id: string): Promise<MedicineDetail> {
    await this.assertExists(id);
    const medicine = await this.prisma.medicine.update({ where: { id }, data: { isActive: false } });
    return this.toDetail(medicine);
  }

  async reactivate(id: string): Promise<MedicineDetail> {
    await this.assertExists(id);
    const medicine = await this.prisma.medicine.update({ where: { id }, data: { isActive: true } });
    return this.toDetail(medicine);
  }

  async toggleFavourite(id: string): Promise<MedicineDetail> {
    const existing = await this.prisma.medicine.findUnique({ where: { id }, select: { isFavourite: true } });
    if (!existing) {
      throw new NotFoundException('Medicine not found');
    }
    const medicine = await this.prisma.medicine.update({
      where: { id },
      data: { isFavourite: !existing.isFavourite },
    });
    return this.toDetail(medicine);
  }

  /** Called when a medicine is actually used in a prescription (Day 6), to rank it higher in search. */
  async incrementUsage(id: string): Promise<void> {
    await this.prisma.medicine.update({ where: { id }, data: { usageCount: { increment: 1 } } });
  }

  /**
   * Merges submitted custom values into whatever's already stored (so a field that
   * got deactivated after being set isn't silently dropped on the next edit) and
   * drops keys that don't match an active field definition.
   */
  private mergeCustomFields(
    input: MedicineCustomFieldValues | undefined,
    existingJson: string | null,
    validKeys: Set<string>,
  ): MedicineCustomFieldValues {
    const merged: MedicineCustomFieldValues = existingJson ? JSON.parse(existingJson) : {};
    for (const [key, value] of Object.entries(input ?? {})) {
      if (validKeys.has(key)) merged[key] = value;
    }
    return merged;
  }

  /** Raw core field values for an update — a field the dto didn't touch falls back to what's already stored. */
  private mergeCoreFieldValues(dto: UpdateMedicineDto, existing: Medicine): Record<string, unknown> {
    return {
      brandName: dto.brandName ?? existing.brandName,
      genericName: dto.genericName ?? existing.genericName,
      strength: dto.strength ?? existing.strength,
      form: dto.form ?? existing.form,
      company: dto.company ?? existing.company,
      category: dto.category ?? existing.category,
      defaultDose: dto.defaultDose ?? existing.defaultDose,
      defaultMorning: dto.defaultMorning ?? existing.defaultMorning,
      defaultAfternoon: dto.defaultAfternoon ?? existing.defaultAfternoon,
      defaultEvening: dto.defaultEvening ?? existing.defaultEvening,
      defaultNight: dto.defaultNight ?? existing.defaultNight,
      defaultBeforeAfterFood: dto.defaultBeforeAfterFood ?? existing.defaultBeforeAfterFood,
      defaultDurationDays: dto.defaultDurationDays ?? existing.defaultDurationDays,
      defaultInstruction: dto.defaultInstruction ?? existing.defaultInstruction,
    };
  }

  /**
   * Enforces admin-marked required fields (core or custom alike) against the final
   * merged state — not just what was submitted this call — so a required field can't
   * be bypassed by simply omitting it from the request.
   */
  private assertRequiredFieldsSatisfied(
    defs: { key: string; label: string; required: boolean }[],
    values: Record<string, unknown>,
  ): void {
    const missingLabels = defs.filter((d) => d.required && !String(values[d.key] ?? '').trim()).map((d) => d.label);
    if (missingLabels.length) {
      throw new BadRequestException(`Missing required field(s): ${missingLabels.join(', ')}`);
    }
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.medicine.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('Medicine not found');
    }
  }

  private toSummary(medicine: Medicine): MedicineSummary {
    return {
      id: medicine.id,
      brandName: medicine.brandName,
      genericName: medicine.genericName,
      strength: medicine.strength,
      form: medicine.form as MedicineSummary['form'],
      company: medicine.company,
      defaultDose: medicine.defaultDose,
      isFavourite: medicine.isFavourite,
      isActive: medicine.isActive,
    };
  }

  private toDetail(medicine: Medicine): MedicineDetail {
    return {
      ...this.toSummary(medicine),
      category: medicine.category,
      defaultMorning: medicine.defaultMorning,
      defaultAfternoon: medicine.defaultAfternoon,
      defaultEvening: medicine.defaultEvening,
      defaultNight: medicine.defaultNight,
      defaultBeforeAfterFood: medicine.defaultBeforeAfterFood as MedicineDetail['defaultBeforeAfterFood'],
      defaultDurationDays: medicine.defaultDurationDays,
      defaultInstruction: medicine.defaultInstruction,
      usageCount: medicine.usageCount,
      customFields: medicine.customFields ? JSON.parse(medicine.customFields) : {},
    };
  }
}
