import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { FeeType } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeTypeDto } from './dto/create-fee-type.dto';
import { UpdateFeeTypeDto } from './dto/update-fee-type.dto';

@Injectable()
export class FeeTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<FeeType[]> {
    const feeTypes = await this.prisma.feeType.findMany({ orderBy: { name: 'asc' } });
    return feeTypes;
  }

  async create(dto: CreateFeeTypeDto): Promise<FeeType> {
    const existing = await this.prisma.feeType.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('A fee type with this name already exists');
    }

    if (dto.isDefault) {
      await this.clearOtherDefaults();
    }

    return this.prisma.feeType.create({
      data: { name: dto.name, amount: dto.amount, isDefault: dto.isDefault ?? false },
    });
  }

  async update(id: string, dto: UpdateFeeTypeDto): Promise<FeeType> {
    await this.findOrThrow(id);

    if (dto.name) {
      const existing = await this.prisma.feeType.findUnique({ where: { name: dto.name } });
      if (existing && existing.id !== id) {
        throw new ConflictException('A fee type with this name already exists');
      }
    }

    if (dto.isDefault) {
      await this.clearOtherDefaults(id);
    }

    return this.prisma.feeType.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
  }

  async deactivate(id: string): Promise<FeeType> {
    await this.findOrThrow(id);
    return this.prisma.feeType.update({ where: { id }, data: { isActive: false } });
  }

  async reactivate(id: string): Promise<FeeType> {
    await this.findOrThrow(id);
    return this.prisma.feeType.update({ where: { id }, data: { isActive: true } });
  }

  /** Only one fee type can be the default at a time, like a radio button. */
  private async clearOtherDefaults(exceptId?: string): Promise<void> {
    await this.prisma.feeType.updateMany({
      where: { isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isDefault: false },
    });
  }

  private async findOrThrow(id: string) {
    const feeType = await this.prisma.feeType.findUnique({ where: { id } });
    if (!feeType) {
      throw new NotFoundException('Fee type not found');
    }
    return feeType;
  }
}
