import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { MedicineFieldDefinition, MedicineFieldType } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicineFieldDto } from './dto/create-medicine-field.dto';
import { UpdateMedicineFieldDto } from './dto/update-medicine-field.dto';

type MedicineFieldDefinitionRow = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  options: string | null;
  required: boolean;
  isActive: boolean;
  isCore: boolean;
  order: number;
};

@Injectable()
export class MedicineFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<MedicineFieldDefinition[]> {
    const rows = await this.prisma.medicineFieldDefinition.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] });
    return rows.map((row) => this.toDto(row));
  }

  async create(dto: CreateMedicineFieldDto): Promise<MedicineFieldDefinition> {
    const existing = await this.prisma.medicineFieldDefinition.findUnique({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException('A field with this key already exists');
    }
    this.assertSelectHasOptions(dto.fieldType, dto.options);

    const row = await this.prisma.medicineFieldDefinition.create({
      data: {
        key: dto.key,
        label: dto.label,
        fieldType: dto.fieldType,
        options: dto.options ? JSON.stringify(dto.options) : null,
        required: dto.required ?? false,
        order: dto.order ?? 0,
      },
    });
    return this.toDto(row);
  }

  async update(id: string, dto: UpdateMedicineFieldDto): Promise<MedicineFieldDefinition> {
    const existing = await this.findOrThrow(id);

    // Core rows are tied to a real Medicine column — its type can't change from
    // Settings, so fieldType/options edits are silently ignored for them. Only
    // label, required and order are ever writable for a core row.
    if (existing.isCore) {
      const row = await this.prisma.medicineFieldDefinition.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.required !== undefined ? { required: dto.required } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
        },
      });
      return this.toDto(row);
    }

    const fieldType = dto.fieldType ?? existing.fieldType;
    const options = dto.options ?? (existing.options ? JSON.parse(existing.options) : undefined);
    this.assertSelectHasOptions(fieldType as MedicineFieldType, options);

    const row = await this.prisma.medicineFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.fieldType !== undefined ? { fieldType: dto.fieldType } : {}),
        ...(dto.options !== undefined ? { options: JSON.stringify(dto.options) } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });
    return this.toDto(row);
  }

  async deactivate(id: string): Promise<MedicineFieldDefinition> {
    await this.findOrThrow(id);
    const row = await this.prisma.medicineFieldDefinition.update({ where: { id }, data: { isActive: false } });
    return this.toDto(row);
  }

  async reactivate(id: string): Promise<MedicineFieldDefinition> {
    await this.findOrThrow(id);
    const row = await this.prisma.medicineFieldDefinition.update({ where: { id }, data: { isActive: true } });
    return this.toDto(row);
  }

  private assertSelectHasOptions(fieldType: MedicineFieldType, options?: string[]): void {
    if (fieldType === 'SELECT' && (!options || options.length === 0)) {
      throw new BadRequestException('Select fields need at least one option');
    }
  }

  private async findOrThrow(id: string): Promise<MedicineFieldDefinitionRow> {
    const row = await this.prisma.medicineFieldDefinition.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Medicine field not found');
    }
    return row;
  }

  private toDto(row: MedicineFieldDefinitionRow): MedicineFieldDefinition {
    return {
      id: row.id,
      key: row.key,
      label: row.label,
      fieldType: row.fieldType as MedicineFieldType,
      options: row.options ? JSON.parse(row.options) : null,
      required: row.required,
      isActive: row.isActive,
      isCore: row.isCore,
      order: row.order,
    };
  }
}
