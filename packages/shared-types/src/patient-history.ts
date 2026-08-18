import type { VisitDetail } from './visits';
import type { DocumentDetail } from './documents';

export interface PatientHistoryVisit extends VisitDetail {
  prescription: { id: string; itemCount: number; generalInstruction: string | null } | null;
}

export interface PatientSummaryStats {
  totalVisits: number;
  firstVisitDate: string | null;
  lastVisitDate: string | null;
  mostPrescribedMedicines: { medicineName: string; count: number }[];
}

export interface PatientHistoryResponse {
  summary: PatientSummaryStats;
  visits: PatientHistoryVisit[];
  documents: DocumentDetail[];
}
