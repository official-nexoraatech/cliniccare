import type { RoleName } from './roles';

export interface UserSummary {
  id: string;
  name: string;
  username: string;
  role: RoleName;
  isActive: boolean;
  hasPin: boolean;
}

export interface CreateUserRequest {
  name: string;
  username: string;
  password: string;
  pin?: string;
  role: RoleName;
}

export interface UpdateUserRequest {
  name?: string;
  role?: RoleName;
}

export interface ResetPasswordRequest {
  newPassword: string;
}
