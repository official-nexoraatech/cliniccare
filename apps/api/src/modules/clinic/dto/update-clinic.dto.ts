import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MinLength } from 'class-validator';

// Lenient on purpose: unlike a patient's mobile number (always a bare 10-digit Indian
// number), a clinic phone printed on a letterhead is often "+91 90000 00000", a landline
// with an STD code, or has an extension — just bound length and reject obviously-wrong
// input like letters. Still requires at least 10 digits so short/typo'd numbers don't pass.
const PHONE_REGEX = /^(?=(?:\D*\d){10,})[+]?[\d\s()-]{7,20}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const NAME_WITH_LETTER_REGEX = /^(?=.*[A-Za-z])[A-Za-z .'-]+$/;

const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimToUndefinedIfEmpty = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class UpdateClinicDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @Matches(PHONE_REGEX, { message: 'Enter a valid phone number with at least 10 digits' })
  @Transform(trimString)
  phone!: string;

  @IsEmail({}, { message: 'Enter a valid email' })
  @Transform(trimString)
  email!: string;

  @IsOptional()
  @Transform(trimToUndefinedIfEmpty)
  @Matches(NAME_WITH_LETTER_REGEX, {
    message: 'Doctor name must contain letters, and only letters, spaces, periods, apostrophes or hyphens',
  })
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
  @Transform(trimString)
  taxLabel?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsBoolean()
  discountEnabled?: boolean;
}
