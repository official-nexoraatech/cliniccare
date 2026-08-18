import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateFeeTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
