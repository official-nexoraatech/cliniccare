export const COMPLIANCE_GRADES = ['GOOD', 'AVERAGE', 'POOR'] as const;
export type ComplianceGrade = (typeof COMPLIANCE_GRADES)[number];

export const COMPLIANCE_REASONS = [
  'FORGOT',
  'COST',
  'SIDE_EFFECT',
  'FELT_BETTER',
  'NOT_AVAILABLE',
  'OTHER',
] as const;
export type ComplianceReason = (typeof COMPLIANCE_REASONS)[number];

// Quick-entry buttons — the fraction of prescribed doses the patient says they took.
export const COMPLIANCE_QUICK_OPTIONS = [
  { label: 'All', fraction: 1 },
  { label: 'Most', fraction: 0.75 },
  { label: 'Half', fraction: 0.5 },
  { label: 'Few', fraction: 0.25 },
  { label: 'None', fraction: 0 },
] as const;

export interface ComplianceContext {
  /** Doses prescribed in the patient's most recent prescription — null if they have none yet. */
  dosesPrescribed: number | null;
  followUpsGiven: number;
  followUpsAttended: number;
}

export interface ComplianceRecord {
  id: string;
  patientId: string;
  visitId: string;
  recordedOn: string;
  dosesPrescribed: number;
  dosesTaken: number;
  medicinePercent: number;
  followUpsGiven: number;
  followUpsAttended: number;
  followUpPercent: number;
  overallPercent: number;
  grade: ComplianceGrade;
  reasonForMissing: ComplianceReason | null;
  remark: string | null;
}

export interface SaveComplianceRequest {
  visitId: string;
  dosesTaken: number;
  reasonForMissing?: ComplianceReason;
  remark?: string;
}

export interface PatientComplianceResponse {
  records: ComplianceRecord[];
  lifetimeAverage: number | null;
  trend: ComplianceRecord[];
}

export interface ComplianceReportRow {
  patientId: string;
  patientName: string;
  patientMobile: string;
  latestPercent: number;
  latestGrade: ComplianceGrade;
  recordedOn: string;
}
