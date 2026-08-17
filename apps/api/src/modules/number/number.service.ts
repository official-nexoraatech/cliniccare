import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CounterKey = 'PATIENT' | 'VISIT' | 'BILL' | 'CERTIFICATE';

@Injectable()
export class NumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically increments the named counter and returns the formatted number,
   * e.g. PATIENT -> "P-2526-00001". A single `UPDATE ... SET value = value + 1`
   * is itself atomic in SQLite, so concurrent callers can never be handed the
   * same number without needing an extra transaction wrapper.
   */
  async getNext(key: CounterKey): Promise<string> {
    try {
      const counter = await this.prisma.counter.update({
        where: { key },
        data: { currentValue: { increment: 1 } },
      });
      const padded = String(counter.currentValue).padStart(5, '0');
      return `${counter.prefix}-${counter.financialYear}-${padded}`;
    } catch {
      throw new NotFoundException(`Counter "${key}" is not configured`);
    }
  }
}
