import type { PatientCustomFieldValues } from './patient-fields';

// UNSPECIFIED is a storage sentinel, not a real choice — used when admin has
// switched off collecting gender via Settings → Patient Fields. Filter it out of
// any UI that lets someone actually pick a gender.
export const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'] as const;
export type Gender = (typeof GENDERS)[number];

export const MARITAL_STATUSES = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export interface PatientSummary {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: Gender;
  mobile: string;
  city: string | null;
  isActive: boolean;
  visitCount: number;
  stage: string | null;
}

export interface PatientDetail extends PatientSummary {
  dob: string | null;
  altMobile: string | null;
  email: string | null;
  address: string | null;
  pincode: string | null;
  bloodGroup: string | null;
  maritalStatus: string | null;
  occupation: string | null;
  allergies: string | null;
  chronicDiseases: string | null;
  referredBy: string | null;
  notes: string | null;
  registeredOn: string;
  nextFollowUp: { dueDate: string; purpose: string | null } | null;
  customFields: PatientCustomFieldValues;
}

export interface PatientSearchResult {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: Gender;
  mobile: string;
}

// Every field here is optional at the type level — which of them are actually
// mandatory is decided at runtime by Settings → Patient Fields (see
// PatientsService.resolveRequiredFields), not by this interface.
export interface CreatePatientRequest {
  name?: string;
  age?: number;
  dob?: string;
  gender?: Gender;
  mobile?: string;
  altMobile?: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  bloodGroup?: BloodGroup;
  maritalStatus?: MaritalStatus;
  occupation?: string;
  allergies?: string;
  chronicDiseases?: string;
  stage?: string;
  referredBy?: string;
  notes?: string;
  customFields?: PatientCustomFieldValues;
}

export type UpdatePatientRequest = Partial<CreatePatientRequest>;

export interface PatientListQuery {
  page?: number;
  pageSize?: number;
  gender?: Gender;
  city?: string;
  isActive?: boolean;
  search?: string;
  registeredFrom?: string;
  registeredTo?: string;
}

export interface PatientListResponse {
  items: PatientSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePatientResponse {
  duplicateMobileWarning: boolean;
  patient: PatientDetail;
}
