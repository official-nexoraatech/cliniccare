export interface RevenueTrendPoint {
  date: string;
  billed: number;
  collected: number;
}

export interface RevenueTrendResponse {
  from: string;
  to: string;
  points: RevenueTrendPoint[];
}

export interface PatientFootfallPoint {
  date: string;
  new: number;
  followUp: number;
  emergency: number;
  total: number;
}

export interface PatientFootfallResponse {
  from: string;
  to: string;
  points: PatientFootfallPoint[];
}

export interface AppointmentFunnelResponse {
  from: string;
  to: string;
  booked: number;
  confirmed: number;
  arrived: number;
  inConsultation: number;
  done: number;
  cancelled: number;
  noShow: number;
  total: number;
}

export interface TopMedicineItem {
  id: string;
  brandName: string;
  genericName: string | null;
  usageCount: number;
}
