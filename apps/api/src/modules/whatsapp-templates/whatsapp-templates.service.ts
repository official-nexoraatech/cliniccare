import { Injectable } from '@nestjs/common';
import type {
  UpdateWhatsAppTemplatesRequest,
  WhatsAppTemplateDefinition,
  WhatsAppTemplateKey,
  WhatsAppTemplatesResponse,
  WhatsAppTemplateValues,
} from '@clinic-care/shared-types';
import { PrismaService } from '../prisma/prisma.service';

const SETTING_KEY = 'whatsapp_message_templates';

export const WHATSAPP_TEMPLATE_DEFINITIONS: WhatsAppTemplateDefinition[] = [
  {
    key: 'appointmentReminder',
    label: 'Appointment reminder',
    description: 'Sent from Appointments > Day view before the visit.',
    variables: ['patientName', 'clinicName', 'appointmentDate', 'timeSlot', 'doctorName', 'tokenNo'],
  },
  {
    key: 'queueConfirmation',
    label: 'Queue confirmation',
    description: "Sent from Today's queue for booked or confirmed patients.",
    variables: ['patientName', 'clinicName', 'appointmentDate', 'timeSlot', 'doctorName', 'tokenNo'],
  },
  {
    key: 'followUpReminder',
    label: 'Follow-up reminder',
    description: 'Sent from Follow-up work queue.',
    variables: ['patientName', 'clinicName', 'dueDate', 'daysOverdue', 'lastDiagnosis'],
  },
];

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplateValues = {
  appointmentReminder:
    'Dear {{patientName}}, this is a reminder from {{clinicName}} that you have an appointment on {{appointmentDate}} at {{timeSlot}}.',
  queueConfirmation:
    'Dear {{patientName}}, your appointment is confirmed at {{timeSlot}} at {{clinicName}}.',
  followUpReminder:
    'Dear {{patientName}}, your follow-up visit is due. Please visit us. Call to book an appointment.',
};

const TEMPLATE_KEYS = WHATSAPP_TEMPLATE_DEFINITIONS.map((item) => item.key);

@Injectable()
export class WhatsAppTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplates(): Promise<WhatsAppTemplatesResponse> {
    return {
      definitions: WHATSAPP_TEMPLATE_DEFINITIONS,
      templates: await this.readTemplates(),
    };
  }

  async updateTemplates(dto: UpdateWhatsAppTemplatesRequest): Promise<WhatsAppTemplatesResponse> {
    const current = await this.readTemplates();
    const incoming = dto.templates ?? {};
    const next = { ...current };

    for (const key of TEMPLATE_KEYS) {
      const value = incoming[key];
      if (typeof value === 'string') {
        next[key] = value.trim() || DEFAULT_WHATSAPP_TEMPLATES[key];
      }
    }

    await this.prisma.setting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: JSON.stringify(next) },
      update: { value: JSON.stringify(next) },
    });

    return { definitions: WHATSAPP_TEMPLATE_DEFINITIONS, templates: next };
  }

  private async readTemplates(): Promise<WhatsAppTemplateValues> {
    const row = await this.prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    if (!row?.value) return DEFAULT_WHATSAPP_TEMPLATES;

    try {
      const saved = JSON.parse(row.value) as Partial<WhatsAppTemplateValues>;
      return TEMPLATE_KEYS.reduce(
        (acc, key) => ({
          ...acc,
          [key]: typeof saved[key] === 'string' && saved[key]?.trim() ? saved[key] : DEFAULT_WHATSAPP_TEMPLATES[key],
        }),
        {} as WhatsAppTemplateValues,
      );
    } catch {
      return DEFAULT_WHATSAPP_TEMPLATES;
    }
  }
}
