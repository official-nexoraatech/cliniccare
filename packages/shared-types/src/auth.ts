import type { RoleName } from './roles';

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
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
