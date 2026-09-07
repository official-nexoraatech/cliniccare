import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';
import { BillItemDto } from '../../billing/dto/bill-item.dto';

export class AddBillableChargesDto {
  @ValidateNested({ each: true })
  @Type(() => BillItemDto)
  @ArrayMinSize(1)
  items!: BillItemDto[];
}
