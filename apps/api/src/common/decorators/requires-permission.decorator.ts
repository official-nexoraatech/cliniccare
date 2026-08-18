import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@clinic-care/shared-types';

export const PERMISSIONS_KEY = 'permissions';
export const RequiresPermission = (...permissions: PermissionKey[]) => SetMetadata(PERMISSIONS_KEY, permissions);
