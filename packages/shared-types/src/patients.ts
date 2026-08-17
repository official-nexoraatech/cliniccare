export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
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
  photoPath: string | null;
  allergies: string | null;
  chronicDiseases: string | null;
  referredBy: string | null;
  notes: string | null;
  registeredOn: string;
}

export interface PatientSearchResult {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: Gender;
  mobile: string;
}

export interface CreatePatientRequest {
  name: string;
  age: number;
  dob?: string;
  gender: Gender;
  mobile: string;
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
  referredBy?: string;
  notes?: string;
}

export type UpdatePatientRequest = Partial<CreatePatientRequest>;

export interface PatientListQuery {
  page?: number;
  pageSize?: number;
  gender?: Gender;
  city?: string;
  isActive?: boolean;
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
