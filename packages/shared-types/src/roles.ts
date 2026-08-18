// Seeded defaults only — roles are now admin-managed (create/rename/delete via
// the Permissions tab), so this list is no longer exhaustive. Kept for the seed
// script and as sensible starting options, not for validation.
export const ROLES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT'] as const;

export type RoleName = string;
