import { IsISO8601, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const MOBILE_REGEX = /^\d{10}$/;

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  patientName?: string;

  @IsOptional()
  @Matches(MOBILE_REGEX, { message: 'Mobile number must be exactly 10 digits' })
  mobile?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsISO8601()
  expectedUpdatedAt!: string;
}
