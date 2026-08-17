import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
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
} from '@clinic-care/shared-types';

const MOBILE_REGEX = /^\d{10}$/;

export class CreatePatientDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(150)
  age!: number;

  @IsOptional()
  @IsISO8601()
  dob?: string;

  @IsIn(GENDERS)
  gender!: Gender;

  @Matches(MOBILE_REGEX, { message: 'Mobile number must be exactly 10 digits' })
  mobile!: string;

  @IsOptional()
  @Matches(MOBILE_REGEX, { message: 'Alternate mobile number must be exactly 10 digits' })
  altMobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
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
  chronicDiseases?: string;

  @IsOptional()
  @IsString()
  referredBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
