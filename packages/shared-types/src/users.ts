import type { RoleName } from './roles';

export interface UserSummary {
  id: string;
  name: string;
  username: string;
  mobile: string | null;
  role: RoleName;
  isActive: boolean;
  hasPin: boolean;
}

export interface CreateUserRequest {
  name: string;
  username: string;
  mobile?: string;
  password: string;
  pin?: string;
  role: RoleName;
}

export interface UpdateUserRequest {
  name?: string;
  mobile?: string;
  role?: RoleName;
}

export interface ResetPasswordRequest {
  newPassword: string;
}
