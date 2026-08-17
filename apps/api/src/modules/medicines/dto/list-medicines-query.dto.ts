import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MEDICINE_FORMS, type MedicineForm } from '@clinic-care/shared-types';

export class ListMedicinesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsIn(MEDICINE_FORMS)
  form?: MedicineForm;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBooleanString()
  favouriteOnly?: string;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
