import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { CHARGE_DEPARTMENTS, type ChargeDepartment } from '@clinic-care/shared-types';

export class BillItemDto {
  @IsOptional()
  @IsString()
  feeTypeId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  unitAmount!: number;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  // Left unset by most callers — BillingService defaults it from the adding user's role.
  @IsOptional()
  @IsIn(CHARGE_DEPARTMENTS)
  department?: ChargeDepartment;
}
