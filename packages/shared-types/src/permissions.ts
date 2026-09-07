export const PERMISSION_MODULES = [
  'patients',
  'appointments',
  'visits',
  'vitals',
  'prescriptions',
  'medicines',
  'clinic',
  'billing',
  // Narrower than `billing` — lets a doctor/nurse add a charge to a visit's running
  // bill without granting payments/cancel/full-edit rights that `billing:edit` carries.
  'billing-charges',
  'administration',
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ['view', 'edit'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionKey = `${PermissionModule}:${PermissionAction}`;

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_MODULES.flatMap((mod) =>
  PERMISSION_ACTIONS.map((action) => `${mod}:${action}` as PermissionKey),
);

export interface RoleSummary {
  id: string;
  name: string;
  isLocked: boolean;
  userCount: number;
  permissions: PermissionKey[];
}

export interface CreateRoleRequest {
  name: string;
  permissions: PermissionKey[];
}

export interface UpdateRoleRequest {
  name?: string;
  permissions?: PermissionKey[];
}
