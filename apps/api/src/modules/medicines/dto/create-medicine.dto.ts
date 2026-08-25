import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import {
  BEFORE_AFTER_FOOD_OPTIONS,
  MEDICINE_FORMS,
  type BeforeAfterFood,
  type MedicineCustomFieldValues,
  type MedicineForm,
} from '@clinic-care/shared-types';

// brandName/form are @IsOptional() here — which fields are actually mandatory is
// decided at runtime by Settings → Medicine Fields (see
// MedicinesService.resolveRequiredFields), not by this DTO.
export class CreateMedicineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  brandName?: string;

  @IsOptional()
  @IsString()
  genericName?: string;

  @IsOptional()
  @IsString()
  strength?: string;

  @IsOptional()
  @IsIn(MEDICINE_FORMS)
  form?: MedicineForm;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  defaultDose?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  defaultMorning?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  defaultAfternoon?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  defaultEvening?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  defaultNight?: number;

  @IsOptional()
  @IsIn(BEFORE_AFTER_FOOD_OPTIONS)
  defaultBeforeAfterFood?: BeforeAfterFood;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  defaultDurationDays?: number;

  @IsOptional()
  @IsString()
  defaultInstruction?: string;

  @IsOptional()
  @IsObject()
  customFields?: MedicineCustomFieldValues;
}
