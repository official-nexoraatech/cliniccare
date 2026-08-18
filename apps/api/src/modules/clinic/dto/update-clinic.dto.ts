import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

// Lenient on purpose: unlike a patient's mobile number (always a bare 10-digit Indian
// number), a clinic phone printed on a letterhead is often "+91 90000 00000", a landline
// with an STD code, or has an extension — just bound length and reject obviously-wrong
// input like letters.
const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;

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
}
