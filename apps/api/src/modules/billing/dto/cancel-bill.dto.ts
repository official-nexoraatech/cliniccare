import { IsString, MinLength } from 'class-validator';

export class CancelBillDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
