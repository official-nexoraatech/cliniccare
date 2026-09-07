export const VISIT_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN'] as const;
export type VisitFieldType = (typeof VISIT_FIELD_TYPES)[number];

export interface VisitFieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: VisitFieldType;
  options: string[] | null;
  required: boolean;
  isActive: boolean;
  isCore: boolean;
  order: number;
}

export interface CreateVisitFieldRequest {
  key: string;
  label: string;
  fieldType: VisitFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
}

export interface UpdateVisitFieldRequest {
  label?: string;
  fieldType?: VisitFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
}

export type VisitCustomFieldValues = Record<string, string>;
