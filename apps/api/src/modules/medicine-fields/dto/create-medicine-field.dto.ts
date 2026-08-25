import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { MEDICINE_FIELD_TYPES, type MedicineFieldType } from '@clinic-care/shared-types';

const KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export class CreateMedicineFieldDto {
  @IsString()
  @Matches(KEY_REGEX, { message: 'Key must start with a lowercase letter and contain only lowercase letters, numbers and underscores' })
  key!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsIn(MEDICINE_FIELD_TYPES)
  fieldType!: MedicineFieldType;

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
