import type { BeforeAfterFood, MedicineForm } from './medicines';

export interface PrescriptionItemInput {
  medicineId: string;
  medicineName: string;
  strength?: string;
  form: MedicineForm;
  dose?: string;
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
  beforeAfterFood: BeforeAfterFood;
  durationDays: number;
  instruction?: string;
  sortOrder: number;
}

export interface PrescriptionItemDetail extends PrescriptionItemInput {
  id: string;
  totalQuantity: number;
}

export interface PrescriptionDetail {
  id: string;
  visitId: string;
  patientId: string;
  date: string;
  generalInstruction: string | null;
  printedAt: string | null;
  printCount: number;
  items: PrescriptionItemDetail[];
}

export interface SavePrescriptionRequest {
  generalInstruction?: string;
  items: PrescriptionItemInput[];
}
