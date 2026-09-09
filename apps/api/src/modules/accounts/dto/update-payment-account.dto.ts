import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { PaymentAccountStatus } from '@clinic-care/shared-types';

export class UpdatePaymentAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

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

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: PaymentAccountStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
