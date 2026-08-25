import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { PATIENT_FIELD_TYPES, type PatientFieldType } from '@clinic-care/shared-types';

const KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export class CreatePatientFieldDto {
  @IsString()
  @Matches(KEY_REGEX, { message: 'Key must start with a lowercase letter and contain only lowercase letters, numbers and underscores' })
  key!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsIn(PATIENT_FIELD_TYPES)
  fieldType!: PatientFieldType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
