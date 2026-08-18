import type { AuthUser, PermissionKey } from '@clinic-care/shared-types';

export function hasPermission(user: AuthUser | null, key: PermissionKey): boolean {
  return Boolean(user?.permissions?.includes(key));
}
