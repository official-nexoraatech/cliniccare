import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMedicineFieldRequest, MedicineFieldDefinition, UpdateMedicineFieldRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const MEDICINE_FIELDS_KEY = ['medicine-fields'] as const;

export function useMedicineFieldsQuery() {
  return useQuery({
    queryKey: MEDICINE_FIELDS_KEY,
    queryFn: async () => {
      const { data } = await api.get<MedicineFieldDefinition[]>('/medicine-fields');
      return data;
    },
  });
}

export function useMedicineFieldMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: MEDICINE_FIELDS_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreateMedicineFieldRequest) => {
      const { data } = await api.post<MedicineFieldDefinition>('/medicine-fields', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateMedicineFieldRequest }) => {
      const { data } = await api.patch<MedicineFieldDefinition>(`/medicine-fields/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<MedicineFieldDefinition>(`/medicine-fields/${id}/deactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<MedicineFieldDefinition>(`/medicine-fields/${id}/reactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, deactivate, reactivate };
}
