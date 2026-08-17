export const ROLES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT'] as const;

export type RoleName = (typeof ROLES)[number];
