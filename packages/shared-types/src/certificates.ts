export const CERTIFICATE_TYPES = ['FITNESS', 'SICK_LEAVE', 'MEDICAL', 'REFERRAL', 'VACCINATION', 'CUSTOM'] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_STATUSES = ['ISSUED', 'CANCELLED'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export interface CertificateDetail {
  id: string;
  certificateNo: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  visitId: string | null;
  type: CertificateType;
  issueDate: string;
  fromDate: string | null;
  toDate: string | null;
  diagnosis: string | null;
  bodyText: string;
  status: CertificateStatus;
  cancelReason: string | null;
  issuedBy: string | null;
  printedAt: string | null;
  printCount: number;
}

export interface IssueCertificateRequest {
  patientId: string;
  visitId?: string;
  type: CertificateType;
  fromDate?: string;
  toDate?: string;
  diagnosis?: string;
  bodyText: string;
}

export interface CancelCertificateRequest {
  reason: string;
}
