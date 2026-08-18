import { IsIn, IsOptional, IsString } from 'class-validator';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '@clinic-care/shared-types';

export class UpdateAppointmentStatusDto {
  @IsIn(APPOINTMENT_STATUSES)
  status!: AppointmentStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
