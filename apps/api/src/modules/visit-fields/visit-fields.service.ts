import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { VisitFieldDefinition, VisitFieldType } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitFieldDto } from './dto/create-visit-field.dto';
import { UpdateVisitFieldDto } from './dto/update-visit-field.dto';

type VisitFieldDefinitionRow = {
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
export class VisitFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<VisitFieldDefinition[]> {
    const rows = await this.prisma.visitFieldDefinition.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] });
    return rows.map((row) => this.toDto(row));
  }

  async create(dto: CreateVisitFieldDto): Promise<VisitFieldDefinition> {
    const existing = await this.prisma.visitFieldDefinition.findUnique({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException('A field with this key already exists');
    }
    this.assertSelectHasOptions(dto.fieldType, dto.options);

    const row = await this.prisma.visitFieldDefinition.create({
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

  async update(id: string, dto: UpdateVisitFieldDto): Promise<VisitFieldDefinition> {
    const existing = await this.findOrThrow(id);

    if (existing.isCore) {
      const row = await this.prisma.visitFieldDefinition.update({
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
    this.assertSelectHasOptions(fieldType as VisitFieldType, options);

    const row = await this.prisma.visitFieldDefinition.update({
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

  async deactivate(id: string): Promise<VisitFieldDefinition> {
    await this.findOrThrow(id);
    const row = await this.prisma.visitFieldDefinition.update({ where: { id }, data: { isActive: false } });
    return this.toDto(row);
  }

  async reactivate(id: string): Promise<VisitFieldDefinition> {
    await this.findOrThrow(id);
    const row = await this.prisma.visitFieldDefinition.update({ where: { id }, data: { isActive: true } });
    return this.toDto(row);
  }

  private assertSelectHasOptions(fieldType: VisitFieldType, options?: string[]): void {
    if (fieldType === 'SELECT' && (!options || options.length === 0)) {
      throw new BadRequestException('Select fields need at least one option');
    }
  }

  private async findOrThrow(id: string): Promise<VisitFieldDefinitionRow> {
    const row = await this.prisma.visitFieldDefinition.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Visit field not found');
    }
    return row;
  }

  private toDto(row: VisitFieldDefinitionRow): VisitFieldDefinition {
    return {
      id: row.id,
      key: row.key,
      label: row.label,
      fieldType: row.fieldType as VisitFieldType,
      options: row.options ? JSON.parse(row.options) : null,
      required: row.required,
      isActive: row.isActive,
      isCore: row.isCore,
      order: row.order,
    };
  }
}
