import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
}
