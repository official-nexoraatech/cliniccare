import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PAYMENT_MODES, type PaymentMode } from '@clinic-care/shared-types';

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsIn(PAYMENT_MODES)
  mode!: PaymentMode;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}
