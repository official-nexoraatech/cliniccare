export const MEDICINE_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN'] as const;
export type MedicineFieldType = (typeof MEDICINE_FIELD_TYPES)[number];

export interface MedicineFieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: MedicineFieldType;
  options: string[] | null;
  required: boolean;
  isActive: boolean;
  /** True for the 14 built-in Medicine columns (brandName, form, ...), seeded on startup. Their key/fieldType can't be edited — only label, required and isActive. */
  isCore: boolean;
  order: number;
}

export interface CreateMedicineFieldRequest {
  key: string;
  label: string;
  fieldType: MedicineFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
}

export interface UpdateMedicineFieldRequest {
  label?: string;
  fieldType?: MedicineFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
}

/** Every custom value travels as a string — admin-defined fields are supplementary, not computed on. */
export type MedicineCustomFieldValues = Record<string, string>;
