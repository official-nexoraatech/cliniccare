import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MinLength } from 'class-validator';

// Lenient on purpose: unlike a patient's mobile number (always a bare 10-digit Indian
// number), a clinic phone printed on a letterhead is often "+91 90000 00000", a landline
// with an STD code, or has an extension — just bound length and reject obviously-wrong
// input like letters.
const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateClinicDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Matches(PHONE_REGEX, { message: 'Enter a valid phone number' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  doctorName?: string;

  @IsOptional()
  @IsString()
  degree?: string;

  @IsOptional()
  @IsString()
  regnNumber?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'Enter a valid 24h time (HH:mm)' })
  openTime?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'Enter a valid 24h time (HH:mm)' })
  closeTime?: string;

  @IsOptional()
  @IsInt()
  @IsIn([10, 15, 20, 30, 60])
  slotMinutes?: number;

  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  taxLabel?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsBoolean()
  discountEnabled?: boolean;
}
