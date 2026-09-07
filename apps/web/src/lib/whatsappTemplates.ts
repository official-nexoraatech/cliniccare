import type { WhatsAppTemplateKey, WhatsAppTemplateValues } from '@clinic-care/shared-types';

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplateValues = {
  appointmentReminder:
    'Dear {{patientName}}, this is a reminder from {{clinicName}} that you have an appointment on {{appointmentDate}} at {{timeSlot}}.',
  queueConfirmation:
    'Dear {{patientName}}, your appointment is confirmed at {{timeSlot}} at {{clinicName}}.',
  followUpReminder:
    'Dear {{patientName}}, your follow-up visit is due. Please visit us. Call to book an appointment.',
};

export function renderWhatsAppTemplate(
  template: string | undefined,
  fallbackKey: WhatsAppTemplateKey,
  variables: Record<string, string | number | null | undefined>,
) {
  const source = template?.trim() || DEFAULT_WHATSAPP_TEMPLATES[fallbackKey];
  return source.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(variables[key] ?? ''));
}
