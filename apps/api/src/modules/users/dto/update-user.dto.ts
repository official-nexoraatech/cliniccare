import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import type { RoleName } from '@clinic-care/shared-types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z ]+$/, { message: 'Name can only contain letters and spaces' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?!(\d)\1{9}$)[6-9]\d{9}$/, { message: 'Enter a valid 10-digit mobile number' })
  mobile?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  role?: RoleName;
}
