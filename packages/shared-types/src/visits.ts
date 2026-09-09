import type { Gender } from './patients';
import type { BillItemInput } from './billing';
import type { VisitCustomFieldValues } from './visit-fields';

export const VISIT_TYPES = ['NEW', 'FOLLOW_UP', 'EMERGENCY'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_STATUSES = ['WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const LAB_TEST_STATUSES = ['ADVISED', 'DONE', 'CANCELLED'] as const;
export type LabTestStatus = (typeof LAB_TEST_STATUSES)[number];

export const COMMON_TESTS = [
  'CBC',
  'Blood Sugar',
  'Lipid Profile',
  'X-Ray',
  'ECG',
  'Urine Routine',
  'Thyroid',
] as const;

export const QUICK_ADVICE_TEMPLATES = [
  'Take rest for 3 days',
  'Avoid oily food',
  'Drink 3 litres water daily',
  'Complete the full course of medicines',
  'Follow up if symptoms persist',
] as const;

export const FOLLOW_UP_QUICK_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '15 days', days: 15 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
] as const;

export interface VitalInput {
  bp?: string;
  pulse?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  spo2?: number;
  respiratoryRate?: number;
  sugarRandom?: number;
  notes?: string;
}

export interface VitalDetail extends VitalInput {
  id: string;
  bmi: number | null;
}

export interface LabTestDetail {
  id: string;
  testName: string;
  advisedOn: string;
  resultValue: string | null;
  resultUnit: string | null;
  normalRange: string | null;
  resultDate: string | null;
  remark: string | null;
  status: LabTestStatus;
}

export interface VisitPatientSummary {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: Gender;
  mobile: string;
  allergies: string | null;
  chronicDiseases: string | null;
}

export interface VisitSummary {
  id: string;
  visitNo: string;
  visitDate: string;
  visitType: VisitType;
  status: VisitStatus;
  complaint: string | null;
  diagnosis: string | null;
}

export interface VisitDetail extends VisitSummary {
  patientId: string;
  patient: VisitPatientSummary;
  complaintDurationDays: number | null;
  examination: string | null;
  advice: string | null;
  testsAdvised: string | null;
  nextFollowUpDate: string | null;
  followUpAfterDays: number | null;
  consultationFee: number | null;
  remark: string | null;
  customFields: VisitCustomFieldValues;
  vital: VitalDetail | null;
  labTests: LabTestDetail[];
}

export interface TodayVisitItem {
  id: string;
  visitNo: string;
  visitDate: string;
  visitType: VisitType;
  status: VisitStatus;
  consultationFee: number | null;
  patient: VisitPatientSummary;
}

export interface CreateVisitRequest {
  patientId: string;
  visitType?: VisitType;
}

export interface UpdateVisitRequest {
  complaint?: string;
  complaintDurationDays?: number;
  examination?: string;
  diagnosis?: string;
  advice?: string;
  testsAdvised?: string;
  nextFollowUpDate?: string;
  followUpAfterDays?: number;
  consultationFee?: number;
  status?: VisitStatus;
  remark?: string;
  customFields?: VisitCustomFieldValues;
}

export interface AdviseLabTestsRequest {
  testNames: string[];
}

export interface AddBillableChargesRequest {
  items: BillItemInput[];
}

export interface EnterLabResultRequest {
  resultValue?: string;
  resultUnit?: string;
  resultDate?: string;
  remark?: string;
}
