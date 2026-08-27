import type { PermissionKey } from '@clinic-care/shared-types';

/** Role.permissions is stored as a JSON string, carried over from before the Mongo migration. */
export function parsePermissions(json: string): PermissionKey[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((p): p is PermissionKey => typeof p === 'string') : [];
  } catch {
    return [];
  }
}
