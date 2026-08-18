import { Injectable } from '@nestjs/common';

interface DoseInput {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
  durationDays: number;
}

@Injectable()
export class DoseService {
  // ponytail: totalQuantity is a flat dose count (dosesPerDay * days) for every form,
  // including syrups — rounding syrup quantity up to a bottle size needs a bottle-size
  // field on Medicine that doesn't exist yet. Add it there if that becomes needed.
  computeTotalQuantity(input: DoseInput): number {
    const dosesPerDay = input.morning + input.afternoon + input.evening + input.night;
    return dosesPerDay * input.durationDays;
  }
}
