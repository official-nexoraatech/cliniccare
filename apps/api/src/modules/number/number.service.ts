import { Injectable, NotFoundException } from '@nestjs/common';
import type { Counter } from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCounterDto } from './dto/update-counter.dto';

export type CounterKey = 'PATIENT' | 'VISIT' | 'BILL' | 'CERTIFICATE';

@Injectable()
export class NumberService {
  constructor(private readonly prisma: PrismaService) {}

  async listCounters(): Promise<Counter[]> {
    return this.prisma.counter.findMany({ orderBy: { key: 'asc' } });
  }

  async updateCounter(key: string, dto: UpdateCounterDto): Promise<Counter> {
    const counter = await this.prisma.counter.findUnique({ where: { key } });
    if (!counter) {
      throw new NotFoundException(`Counter "${key}" is not configured`);
    }
    return this.prisma.counter.update({
      where: { key },
      data: {
        ...(dto.prefix !== undefined ? { prefix: dto.prefix } : {}),
        ...(dto.currentValue !== undefined ? { currentValue: dto.currentValue } : {}),
      },
    });
  }

  /**
   * Atomically increments the named counter and returns the formatted number,
   * e.g. PATIENT -> "P-2526-1". A single `UPDATE ... SET value = value + 1`
   * is itself atomic in SQLite, so concurrent callers can never be handed the
   * same number without needing an extra transaction wrapper.
   */
  async getNext(key: CounterKey): Promise<string> {
    try {
      const counter = await this.prisma.counter.update({
        where: { key },
        data: { currentValue: { increment: 1 } },
      });
      return `${counter.prefix}-${counter.financialYear}-${counter.currentValue}`;
    } catch {
      throw new NotFoundException(`Counter "${key}" is not configured`);
    }
  }
}
