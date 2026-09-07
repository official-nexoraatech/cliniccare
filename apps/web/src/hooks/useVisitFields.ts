import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateVisitFieldRequest, UpdateVisitFieldRequest, VisitFieldDefinition } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const VISIT_FIELDS_KEY = ['visit-fields'] as const;

export function useVisitFieldsQuery() {
  return useQuery({
    queryKey: VISIT_FIELDS_KEY,
    queryFn: async () => {
      const { data } = await api.get<VisitFieldDefinition[]>('/visit-fields');
      return data;
    },
  });
}

export function useVisitFieldMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: VISIT_FIELDS_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreateVisitFieldRequest) => {
      const { data } = await api.post<VisitFieldDefinition>('/visit-fields', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateVisitFieldRequest }) => {
      const { data } = await api.patch<VisitFieldDefinition>(`/visit-fields/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<VisitFieldDefinition>(`/visit-fields/${id}/deactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<VisitFieldDefinition>(`/visit-fields/${id}/reactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, deactivate, reactivate };
}
