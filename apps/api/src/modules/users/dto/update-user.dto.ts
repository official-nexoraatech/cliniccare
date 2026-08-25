import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import type { RoleName } from '@clinic-care/shared-types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z ]+$/, { message: 'Name can only contain letters and spaces' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Mobile number must be exactly 10 digits' })
  mobile?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  role?: RoleName;
}
