import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { GENDERS, type Gender } from '@clinic-care/shared-types';

export class ListPatientsQueryDto {
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
  @IsIn(GENDERS)
  gender?: Gender;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsISO8601()
  registeredFrom?: string;

  @IsOptional()
  @IsISO8601()
  registeredTo?: string;
}
