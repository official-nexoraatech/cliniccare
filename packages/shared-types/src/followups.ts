export const FOLLOW_UP_STATUSES = ['PENDING', 'DONE', 'MISSED', 'RESCHEDULED', 'CANCELLED'] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const CONTACT_MODES = ['CALL', 'SMS', 'WHATSAPP', 'IN_PERSON'] as const;
export type ContactMode = (typeof CONTACT_MODES)[number];

export const CONTACT_RESULTS = [
  'WILL_COME',
  'COMING_LATER',
  'NOT_INTERESTED',
  'NO_ANSWER',
  'WRONG_NUMBER',
  'RECOVERED',
] as const;
export type ContactResult = (typeof CONTACT_RESULTS)[number];

export interface FollowUpPatientSummary {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: string;
  mobile: string;
  chronicDiseases: string | null;
}

export interface FollowUpItem {
  id: string;
  patientId: string;
  visitId: string;
  dueDate: string;
  purpose: string | null;
  status: FollowUpStatus;
  /** True when still PENDING and more than 7 days past dueDate — computed at read time. */
  isMissed: boolean;
  daysOverdue: number;
  contactedOn: string | null;
  contactedBy: string | null;
  contactMode: ContactMode | null;
  contactResult: ContactResult | null;
  rescheduledTo: string | null;
  attendedOn: string | null;
  remark: string | null;
  patient: FollowUpPatientSummary;
  lastDiagnosis: string | null;
  lastPrescriptionSummary: string | null;
  latestCompliancePercent: number | null;
}

export interface FollowUpCounts {
  dueToday: number;
  overdue: number;
  upcomingThisWeek: number;
  missedThisMonth: number;
}

export interface MarkContactedRequest {
  contactMode: ContactMode;
  contactResult: ContactResult;
  remark?: string;
}

export interface RescheduleFollowUpRequest {
  newDate: string;
  reason?: string;
}

export interface PatientFollowUpSummary {
  given: number;
  attended: number;
  missed: number;
  items: FollowUpItem[];
}
