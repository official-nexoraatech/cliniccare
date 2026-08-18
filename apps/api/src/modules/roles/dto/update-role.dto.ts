import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ALL_PERMISSION_KEYS, type PermissionKey } from '@clinic-care/shared-types';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSION_KEYS, { each: true })
  permissions?: PermissionKey[];
}
