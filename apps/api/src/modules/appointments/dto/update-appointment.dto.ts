import { IsISO8601, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const MOBILE_REGEX = /^(?!(\d)\1{9}$)[6-9]\d{9}$/;

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  patientName?: string;

  @IsOptional()
  @Matches(MOBILE_REGEX, { message: 'Enter a valid 10-digit mobile number' })
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
