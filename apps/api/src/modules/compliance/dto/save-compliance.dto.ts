import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { COMPLIANCE_REASONS, type ComplianceReason } from '@clinic-care/shared-types';

export class SaveComplianceDto {
  @IsString()
  @MinLength(1)
  visitId!: string;

  @IsInt()
  @Min(0)
  dosesTaken!: number;

  @IsOptional()
  @IsIn(COMPLIANCE_REASONS)
  reasonForMissing?: ComplianceReason;

  @IsOptional()
  @IsString()
  remark?: string;
}
