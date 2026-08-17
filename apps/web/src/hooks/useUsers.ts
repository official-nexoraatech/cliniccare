import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateUserRequest,
  ResetPasswordRequest,
  UpdateUserRequest,
  UserSummary,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const USERS_KEY = ['users'] as const;

export function useUsersQuery() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const { data } = await api.get<UserSummary[]>('/users');
      return data;
    },
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: USERS_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreateUserRequest) => {
      const { data } = await api.post<UserSummary>('/users', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateUserRequest }) => {
      const { data } = await api.patch<UserSummary>(`/users/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<UserSummary>(`/users/${id}/deactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<UserSummary>(`/users/${id}/reactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const resetPassword = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ResetPasswordRequest }) => {
      await api.patch(`/users/${id}/reset-password`, payload);
    },
  });

  return { create, update, deactivate, reactivate, resetPassword };
}
