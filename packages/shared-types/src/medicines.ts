// UNSPECIFIED is a storage sentinel, not a real choice — used when admin has
// switched off collecting form via Settings → Medicine Fields. Filter it out of
// any UI that lets someone actually pick a form.
import type { MedicineCustomFieldValues } from './medicine-fields';

export const MEDICINE_FORMS = [
  'TABLET',
  'CAPSULE',
  'SYRUP',
  'INJECTION',
  'OINTMENT',
  'DROPS',
  'POWDER',
  'OTHER',
  'UNSPECIFIED',
] as const;
export type MedicineForm = (typeof MEDICINE_FORMS)[number];

export const BEFORE_AFTER_FOOD_OPTIONS = [
  'BEFORE_FOOD',
  'AFTER_FOOD',
  'WITH_FOOD',
  'EMPTY_STOMACH',
  'ANYTIME',
] as const;
export type BeforeAfterFood = (typeof BEFORE_AFTER_FOOD_OPTIONS)[number];

export interface MedicineSummary {
  id: string;
  brandName: string;
  genericName: string | null;
  strength: string | null;
  form: MedicineForm;
  company: string | null;
  defaultDose: string | null;
  isFavourite: boolean;
  isActive: boolean;
}

export interface MedicineDetail extends MedicineSummary {
  category: string | null;
  defaultMorning: number;
  defaultAfternoon: number;
  defaultEvening: number;
  defaultNight: number;
  defaultBeforeAfterFood: BeforeAfterFood;
  defaultDurationDays: number | null;
  defaultInstruction: string | null;
  usageCount: number;
  customFields: MedicineCustomFieldValues;
}

export interface MedicineSearchResult {
  id: string;
  brandName: string;
  genericName: string | null;
  strength: string | null;
  form: MedicineForm;
  defaultMorning: number;
  defaultAfternoon: number;
  defaultEvening: number;
  defaultNight: number;
  defaultBeforeAfterFood: BeforeAfterFood;
  defaultDurationDays: number | null;
  defaultDose: string | null;
}

// brandName/form are optional at the type level — which fields are actually
// mandatory is decided at runtime by Settings → Medicine Fields, not by this interface.
export interface CreateMedicineRequest {
  brandName?: string;
  genericName?: string;
  strength?: string;
  form?: MedicineForm;
  company?: string;
  category?: string;
  defaultDose?: string;
  defaultMorning?: number;
  defaultAfternoon?: number;
  defaultEvening?: number;
  defaultNight?: number;
  defaultBeforeAfterFood?: BeforeAfterFood;
  defaultDurationDays?: number;
  defaultInstruction?: string;
  customFields?: MedicineCustomFieldValues;
}

export type UpdateMedicineRequest = Partial<CreateMedicineRequest>;

export interface MedicineListQuery {
  page?: number;
  pageSize?: number;
  form?: MedicineForm;
  category?: string;
  favouriteOnly?: boolean;
  isActive?: boolean;
}

export interface MedicineListResponse {
  items: MedicineSummary[];
  total: number;
  page: number;
  pageSize: number;
}
