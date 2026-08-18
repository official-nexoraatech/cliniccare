import { IsIn, IsISO8601, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { APPOINTMENT_SOURCES, type AppointmentSource } from '@clinic-care/shared-types';

const MOBILE_REGEX = /^\d{10}$/;

export class CreateAppointmentDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsString()
  @MinLength(1)
  patientName!: string;

  @Matches(MOBILE_REGEX, { message: 'Mobile number must be exactly 10 digits' })
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
