import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { MEDICINE_FIELD_TYPES, type MedicineFieldType } from '@clinic-care/shared-types';

// key is intentionally not editable — it's the storage key inside every medicine's
// existing customFields JSON, so renaming it would orphan already-saved values.
export class UpdateMedicineFieldDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsIn(MEDICINE_FIELD_TYPES)
  fieldType?: MedicineFieldType;

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
