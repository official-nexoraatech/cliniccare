import { IsIn } from 'class-validator';
import { REMINDER_RESPONSES, type ReminderResponse } from '@clinic-care/shared-types';

export class RespondToReminderDto {
  @IsIn(REMINDER_RESPONSES)
  response!: ReminderResponse;
}
