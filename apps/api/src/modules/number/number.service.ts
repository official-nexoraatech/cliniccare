import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

    if (dto.currentValue !== undefined && dto.currentValue < counter.currentValue) {
      throw new BadRequestException(
        `Last number issued can't be lowered below ${counter.currentValue} — doing so would let the next generated number collide with one already issued.`,
      );
    }

    if (dto.prefix !== undefined) {
      const others = await this.prisma.counter.findMany({ where: { key: { not: key } } });
      const clash = others.find((other) => other.prefix.toLowerCase() === dto.prefix!.toLowerCase());
      if (clash) {
        throw new ConflictException(`Prefix "${dto.prefix}" is already used by ${clash.key}`);
      }
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
   * e.g. PATIENT -> "P-2526-1". Prisma's `increment` maps to a Mongo `$inc` on
   * a single document, which is itself atomic, so concurrent callers can never
   * be handed the same number without needing an extra transaction wrapper.
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
