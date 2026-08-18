import { IsOptional, IsString, Length, MinLength } from 'class-validator';
import type { RoleName } from '@clinic-care/shared-types';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsString()
  username!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  pin?: string;

  @IsString()
  @MinLength(1)
  role!: RoleName;
}
