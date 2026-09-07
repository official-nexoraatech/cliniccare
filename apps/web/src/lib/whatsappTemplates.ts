import type { WhatsAppTemplateKey, WhatsAppTemplateValues } from '@clinic-care/shared-types';

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplateValues = {
  appointmentReminder:
    'Appointment Reminder\n\nHi {{patientName}}, your appointment at {{clinicName}} is on {{appointmentDate}} at {{timeSlot}}.\n\nWill you attend?\nReply: YES or NO',
  queueConfirmation:
    'Appointment Confirmed\n\nHi {{patientName}}, your appointment at {{clinicName}} is confirmed for {{timeSlot}} today.\n\nPlease confirm.\nReply: YES or NO',
  followUpReminder:
    'Follow-up Reminder\n\nHi {{patientName}}, your follow-up visit at {{clinicName}} was due on {{dueDate}}.\n\nWould you like to book a visit?\nReply: YES or NO',
};

export const WHATSAPP_VARIABLE_LABELS: Record<string, string> = {
  patientName: 'Patient name',
  clinicName: 'Clinic name',
  appointmentDate: 'Appointment date',
  timeSlot: 'Time slot',
  doctorName: 'Doctor name',
  tokenNo: 'Token number',
  dueDate: 'Due date',
  daysOverdue: 'Days overdue',
  lastDiagnosis: 'Last diagnosis',
};

export const WHATSAPP_VARIABLE_SAMPLES: Record<string, string> = {
  patientName: 'Anita Sharma',
  clinicName: 'Sunrise Clinic',
  appointmentDate: '12 Sep',
  timeSlot: '4:30 PM',
  doctorName: 'Dr. Rao',
  tokenNo: '14',
  dueDate: '20 Sep',
  daysOverdue: '5',
  lastDiagnosis: 'Diabetes checkup',
};

export function renderWhatsAppTemplate(
  template: string | undefined,
  fallbackKey: WhatsAppTemplateKey,
  variables: Record<string, string | number | null | undefined>,
) {
  const source = template?.trim() || DEFAULT_WHATSAPP_TEMPLATES[fallbackKey];
  return source.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(variables[key] ?? ''));
}
