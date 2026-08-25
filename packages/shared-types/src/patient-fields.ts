export const PATIENT_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN'] as const;
export type PatientFieldType = (typeof PATIENT_FIELD_TYPES)[number];

export interface PatientFieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: PatientFieldType;
  options: string[] | null;
  required: boolean;
  isActive: boolean;
  /** True for the 18 built-in Patient columns (name, mobile, ...), seeded on startup. Their key/fieldType can't be edited — only label, required and isActive. */
  isCore: boolean;
  order: number;
}

export interface CreatePatientFieldRequest {
  key: string;
  label: string;
  fieldType: PatientFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
}

export interface UpdatePatientFieldRequest {
  label?: string;
  fieldType?: PatientFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
}

/** Every custom value travels as a string — admin-defined fields are supplementary, not computed on. */
export type PatientCustomFieldValues = Record<string, string>;
