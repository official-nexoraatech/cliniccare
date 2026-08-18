import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BEFORE_AFTER_FOOD_OPTIONS,
  MEDICINE_FORMS,
  type BeforeAfterFood,
  type MedicineForm,
} from '@clinic-care/shared-types';

export class PrescriptionItemDto {
  @IsString()
  medicineId!: string;

  @IsString()
  @MinLength(1)
  medicineName!: string;

  @IsOptional()
  @IsString()
  strength?: string;

  @IsIn(MEDICINE_FORMS)
  form!: MedicineForm;

  @IsOptional()
  @IsString()
  dose?: string;

  @IsInt()
  @Min(0)
  @Max(10)
  morning!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  afternoon!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  evening!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  night!: number;

  @IsIn(BEFORE_AFTER_FOOD_OPTIONS)
  beforeAfterFood!: BeforeAfterFood;

  @IsInt()
  @Min(1)
  @Max(365)
  durationDays!: number;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class SavePrescriptionDto {
  @IsOptional()
  @IsString()
  generalInstruction?: string;

  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  @ArrayMinSize(1)
  items!: PrescriptionItemDto[];
}
