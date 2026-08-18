import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateFeeTypeRequest, FeeType, UpdateFeeTypeRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const FEE_TYPES_KEY = ['fee-types'] as const;

export function useFeeTypesQuery() {
  return useQuery({
    queryKey: FEE_TYPES_KEY,
    queryFn: async () => {
      const { data } = await api.get<FeeType[]>('/fee-types');
      return data;
    },
  });
}

export function useFeeTypeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: FEE_TYPES_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreateFeeTypeRequest) => {
      const { data } = await api.post<FeeType>('/fee-types', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateFeeTypeRequest }) => {
      const { data } = await api.patch<FeeType>(`/fee-types/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<FeeType>(`/fee-types/${id}/deactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<FeeType>(`/fee-types/${id}/reactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, deactivate, reactivate };
}
