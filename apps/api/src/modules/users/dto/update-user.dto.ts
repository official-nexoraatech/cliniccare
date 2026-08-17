import { IsIn, IsOptional, IsString } from 'class-validator';
import { ROLES, type RoleName } from '@clinic-care/shared-types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: RoleName;
}
