import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRoleRequest, RoleSummary, UpdateRoleRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const ROLES_KEY = ['roles'] as const;
const USERS_KEY = ['users'] as const;

export function useRolesQuery() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      const { data } = await api.get<RoleSummary[]>('/roles');
      return data;
    },
  });
}

export function useRoleMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ROLES_KEY });
    queryClient.invalidateQueries({ queryKey: USERS_KEY });
  };

  const create = useMutation({
    mutationFn: async (payload: CreateRoleRequest) => {
      const { data } = await api.post<RoleSummary>('/roles', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateRoleRequest }) => {
      const { data } = await api.patch<RoleSummary>(`/roles/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/roles/${id}`);
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
