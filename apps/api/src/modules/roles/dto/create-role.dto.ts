import { ArrayUnique, IsArray, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ALL_PERMISSION_KEYS, type PermissionKey } from '@clinic-care/shared-types';

// Mirrors apps/web/src/pages/settings/RolesPermissionsPage.tsx's ROLE_NAME_REGEX.
const ROLE_NAME_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9 ]+$/;

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(ROLE_NAME_REGEX, { message: 'Role name must contain letters, and only letters, numbers or spaces' })
  name!: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSION_KEYS, { each: true })
  permissions!: PermissionKey[];
}
