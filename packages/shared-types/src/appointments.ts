export const APPOINTMENT_STATUSES = [
  'BOOKED',
  'CONFIRMED',
  'ARRIVED',
  'IN_CONSULTATION',
  'DONE',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_SOURCES = ['WALK_IN', 'PHONE', 'ONLINE'] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export interface AppointmentDetail {
  id: string;
  patientId: string | null;
  patientName: string;
  mobile: string;
  appointmentDate: string;
  timeSlot: string;
  tokenNo: number;
  doctorId: string | null;
  doctorName: string | null;
  purpose: string | null;
  status: AppointmentStatus;
  source: AppointmentSource;
  remark: string | null;
  visitId: string | null;
  hasVitals: boolean;
  updatedAt: string;
}

export interface DoctorOption {
  id: string;
  name: string;
}

export interface CreateAppointmentRequest {
  patientId?: string;
  patientName: string;
  mobile: string;
  appointmentDate: string;
  timeSlot: string;
  doctorId?: string;
  purpose?: string;
  source?: AppointmentSource;
}

export interface UpdateAppointmentStatusRequest {
  status: AppointmentStatus;
  /** Required when status is CANCELLED or NO_SHOW — kept as the appointment's remark. */
  reason?: string;
}

export interface UpdateAppointmentRequest {
  patientName?: string;
  mobile?: string;
  doctorId?: string;
  purpose?: string;
  /** The appointment's `updatedAt` as last seen by the client — rejected if it's changed since (optimistic concurrency). */
  expectedUpdatedAt: string;
}

export interface LinkAppointmentPatientRequest {
  patientId: string;
}

export interface RescheduleAppointmentRequest {
  newDate: string;
  newTimeSlot?: string;
  expectedUpdatedAt: string;
}

export interface BookAppointmentResponse {
  duplicateSlotWarning: boolean;
  duplicatePatientWarning: boolean;
  appointment: AppointmentDetail;
}

export const REMINDER_RESPONSES = ['CONFIRM', 'RESCHEDULE_REQUEST'] as const;
export type ReminderResponse = (typeof REMINDER_RESPONSES)[number];

/** Written to Appointment.remark when a patient taps "No, need to reschedule" on the public
 * WhatsApp reminder link — shared so the Day view can recognize it and flag it to staff. */
export const RESCHEDULE_REQUESTED_REMARK = 'Patient requested a reschedule via WhatsApp reminder.';

/** Shown on the public, unauthenticated WhatsApp-reminder confirmation page — deliberately
 * only what's needed for that screen, not a full AppointmentDetail. */
export interface PublicAppointmentSummary {
  patientName: string;
  clinicName: string;
  appointmentDate: string;
  timeSlot: string;
  status: AppointmentStatus;
  rescheduleRequested: boolean;
}

export interface RespondToReminderRequest {
  response: ReminderResponse;
}
