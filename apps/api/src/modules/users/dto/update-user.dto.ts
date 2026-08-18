import { IsOptional, IsString, MinLength } from 'class-validator';
import type { RoleName } from '@clinic-care/shared-types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  role?: RoleName;
}
