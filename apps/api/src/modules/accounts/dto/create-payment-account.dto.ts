import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import type { PaymentAccountType } from '@clinic-care/shared-types';

export class CreatePaymentAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(['CASH', 'BANK'])
  type!: PaymentAccountType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'accountNumberMasked must be exactly the last 4 digits' })
  accountNumberMasked?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'ifsc must be a valid 11-character IFSC code' })
  ifsc?: string;

  @IsInt()
  @Min(0)
  openingBalance!: number;

  @IsDateString()
  openingBalanceDate!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
