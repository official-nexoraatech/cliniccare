import { ArrayUnique, IsArray, IsIn, IsString, MinLength } from 'class-validator';
import { ALL_PERMISSION_KEYS, type PermissionKey } from '@clinic-care/shared-types';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSION_KEYS, { each: true })
  permissions!: PermissionKey[];
}
