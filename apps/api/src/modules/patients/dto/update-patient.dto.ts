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
import { Transform } from 'class-transformer';
import {
  BLOOD_GROUPS,
  GENDERS,
  MARITAL_STATUSES,
  type BloodGroup,
  type Gender,
  type MaritalStatus,
  type PatientCustomFieldValues,
} from '@clinic-care/shared-types';

const MOBILE_REGEX = /^(?!(\d)\1{9}$)[6-9]\d{9}$/;
const NAME_REGEX = /^[A-Za-z ]+$/;
const PINCODE_REGEX = /^[1-9]\d{5}$/;

const optionalTrimmedString = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

export class UpdatePatientDto {
  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  @MinLength(1)
  @Matches(NAME_REGEX, { message: 'Name can only contain letters and spaces' })
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;

  @IsOptional()
  @optionalTrimmedString()
  @IsISO8601()
  dob?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @IsOptional()
  @optionalTrimmedString()
  @Matches(MOBILE_REGEX, { message: 'Enter a valid 10-digit mobile number' })
  mobile?: string;

  @IsOptional()
  @optionalTrimmedString()
  @Matches(MOBILE_REGEX, { message: 'Enter a valid 10-digit alternate mobile number' })
  altMobile?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsEmail()
  email?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  @MinLength(1)
  address?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  city?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  @Matches(PINCODE_REGEX, { message: 'Pincode must be a valid 6 digit Indian pincode' })
  pincode?: string;

  @IsOptional()
  @IsIn(BLOOD_GROUPS)
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  occupation?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  allergies?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  @MinLength(1)
  chronicDiseases?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  @MinLength(1)
  stage?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  referredBy?: string;

  @IsOptional()
  @optionalTrimmedString()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  customFields?: PatientCustomFieldValues;
}
