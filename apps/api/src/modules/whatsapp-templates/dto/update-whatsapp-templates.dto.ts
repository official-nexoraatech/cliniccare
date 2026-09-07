import { IsObject, IsOptional, IsString } from 'class-validator';
import type { WhatsAppTemplateValues } from '@clinic-care/shared-types';

export class UpdateWhatsAppTemplatesDto {
  @IsOptional()
  @IsObject()
  templates?: Partial<WhatsAppTemplateValues>;

  @IsOptional()
  @IsString()
  appointmentReminder?: string;

  @IsOptional()
  @IsString()
  queueConfirmation?: string;

  @IsOptional()
  @IsString()
  followUpReminder?: string;
}
