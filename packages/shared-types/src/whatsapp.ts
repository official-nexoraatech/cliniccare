export type WhatsAppTemplateKey = 'appointmentReminder' | 'queueConfirmation' | 'followUpReminder';

export interface WhatsAppTemplateDefinition {
  key: WhatsAppTemplateKey;
  label: string;
  description: string;
  variables: string[];
}

export type WhatsAppTemplateValues = Record<WhatsAppTemplateKey, string>;

export interface WhatsAppTemplatesResponse {
  definitions: WhatsAppTemplateDefinition[];
  templates: WhatsAppTemplateValues;
}

export interface UpdateWhatsAppTemplatesRequest {
  templates: Partial<WhatsAppTemplateValues>;
}
