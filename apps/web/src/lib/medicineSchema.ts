import { z } from 'zod';
import { BEFORE_AFTER_FOOD_OPTIONS, MEDICINE_FORMS } from '@clinic-care/shared-types';

// Mirrors apps/api/src/modules/medicines/dto/create-medicine.dto.ts field-for-field —
// see feedback_dual_validation: frontend and backend must independently reject the same bad input.
export const medicineSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
  genericName: z.string().optional(),
  strength: z.string().optional(),
  form: z.enum(MEDICINE_FORMS),
  company: z.string().optional(),
  category: z.string().optional(),
  defaultDose: z.string().optional(),
  defaultMorning: z.coerce.number().int().min(0).max(10).optional(),
  defaultAfternoon: z.coerce.number().int().min(0).max(10).optional(),
  defaultEvening: z.coerce.number().int().min(0).max(10).optional(),
  defaultNight: z.coerce.number().int().min(0).max(10).optional(),
  defaultBeforeAfterFood: z.enum(BEFORE_AFTER_FOOD_OPTIONS).optional(),
  defaultDurationDays: z.coerce.number().int().min(1).max(365).optional().or(z.literal('')),
  defaultInstruction: z.string().optional(),
});

export type MedicineFormValues = z.infer<typeof medicineSchema>;

export const MEDICINE_FORM_DEFAULTS: Partial<MedicineFormValues> = {
  form: 'TABLET',
  defaultBeforeAfterFood: 'ANYTIME',
  defaultMorning: 0,
  defaultAfternoon: 0,
  defaultEvening: 0,
  defaultNight: 0,
};
