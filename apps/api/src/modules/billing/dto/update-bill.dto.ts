import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { BillItemDto } from './bill-item.dto';

export class UpdateBillDto {
  @ValidateNested({ each: true })
  @Type(() => BillItemDto)
  @ArrayMinSize(1)
  items!: BillItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
