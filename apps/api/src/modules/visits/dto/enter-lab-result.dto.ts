import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class EnterLabResultDto {
  @IsOptional()
  @IsString()
  resultValue?: string;

  @IsOptional()
  @IsString()
  resultUnit?: string;

  @IsOptional()
  @IsISO8601()
  resultDate?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
