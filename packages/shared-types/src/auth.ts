import type { RoleName } from './roles';
import type { PermissionKey } from './permissions';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PinLoginRequest {
  userId: string;
  pin: string;
}

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: RoleName;
  isActive: boolean;
  permissions: PermissionKey[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
