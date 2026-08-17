import { useMutation } from '@tanstack/react-query';
import type { LoginRequest, LoginResponse } from '@clinic-care/shared-types';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  const { accessToken, user, setSession, logout } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginRequest) => {
      const { data } = await api.post<LoginResponse>('/auth/login', payload);
      return data;
    },
    onSuccess: (data) => setSession(data.accessToken, data.user),
  });

  return {
    isAuthenticated: Boolean(accessToken),
    user,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout,
  };
}
