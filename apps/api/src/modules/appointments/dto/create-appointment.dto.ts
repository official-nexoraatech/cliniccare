import { IsIn, IsISO8601, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { APPOINTMENT_SOURCES, type AppointmentSource } from '@clinic-care/shared-types';

const MOBILE_REGEX = /^(?!(\d)\1{9}$)[6-9]\d{9}$/;

export class CreateAppointmentDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsString()
  @MinLength(1)
  patientName!: string;

  @Matches(MOBILE_REGEX, { message: 'Enter a valid 10-digit mobile number' })
  mobile!: string;

  @IsISO8601()
  appointmentDate!: string;

  @IsString()
  @MinLength(1)
  timeSlot!: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsIn(APPOINTMENT_SOURCES)
  source?: AppointmentSource;
}
