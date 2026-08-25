import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PATIENT_FIELD_TYPES, type PatientFieldType } from '@clinic-care/shared-types';

// key is intentionally not editable — it's the storage key inside every patient's
// existing customFields JSON, so renaming it would orphan already-saved values.
export class UpdatePatientFieldDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsIn(PATIENT_FIELD_TYPES)
  fieldType?: PatientFieldType;

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
