export interface ClinicProfile {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  doctorName: string | null;
  degree: string | null;
  regnNumber: string | null;
  logoPath: string | null;
  letterheadPath: string | null;
  /** 24h "HH:mm" — drives the appointment slot grid on the booking screen. */
  openTime: string;
  closeTime: string;
  slotMinutes: number;
}

export interface UpdateClinicRequest {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  doctorName?: string;
  degree?: string;
  regnNumber?: string;
  openTime?: string;
  closeTime?: string;
  slotMinutes?: number;
}
