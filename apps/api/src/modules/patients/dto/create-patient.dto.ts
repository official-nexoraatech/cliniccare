import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  BLOOD_GROUPS,
  GENDERS,
  MARITAL_STATUSES,
  type BloodGroup,
  type Gender,
  type MaritalStatus,
  type PatientCustomFieldValues,
} from '@clinic-care/shared-types';

const MOBILE_REGEX = /^\d{10}$/;

// Every field is @IsOptional() here — which ones are actually mandatory is decided
// at runtime by Settings → Patient Fields (see PatientsService.resolveRequiredFields),
// not by this DTO. Format validators (regex, enum membership, etc.) still apply
// whenever a value is actually submitted.
export class CreatePatientDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;

  @IsOptional()
  @IsISO8601()
  dob?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @IsOptional()
  @Matches(MOBILE_REGEX, { message: 'Mobile number must be exactly 10 digits' })
  mobile?: string;

  @IsOptional()
  @Matches(MOBILE_REGEX, { message: 'Alternate mobile number must be exactly 10 digits' })
  altMobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsIn(BLOOD_GROUPS)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  chronicDiseases?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  stage?: string;

  @IsOptional()
  @IsString()
  referredBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  customFields?: PatientCustomFieldValues;
}
