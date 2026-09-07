import { IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { VISIT_STATUSES, type VisitStatus } from '@clinic-care/shared-types';

export class UpdateVisitDto {
  @IsOptional()
  @IsString()
  complaint?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  complaintDurationDays?: number;

  @IsOptional()
  @IsString()
  examination?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  advice?: string;

  @IsOptional()
  @IsString()
  testsAdvised?: string;

  @IsOptional()
  @IsISO8601()
  nextFollowUpDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  followUpAfterDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  consultationFee?: number;

  @IsOptional()
  @IsIn(VISIT_STATUSES)
  status?: VisitStatus;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, string>;
}
