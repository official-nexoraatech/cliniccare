import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateMedicineRequest,
  MedicineDetail,
  MedicineListQuery,
  MedicineListResponse,
  MedicineSearchResult,
  UpdateMedicineRequest,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const MEDICINES_KEY = ['medicines'] as const;

export function useMedicinesQuery(query: MedicineListQuery) {
  return useQuery({
    queryKey: [...MEDICINES_KEY, 'list', query],
    queryFn: async () => {
      const { data } = await api.get<MedicineListResponse>('/medicines', { params: query });
      return data;
    },
  });
}

export function useMedicineSearchQuery(q: string) {
  return useQuery({
    queryKey: [...MEDICINES_KEY, 'search', q],
    queryFn: async () => {
      const { data } = await api.get<MedicineSearchResult[]>('/medicines/search', { params: { q } });
      return data;
    },
    enabled: q.trim().length > 0,
  });
}

export function useMedicineQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...MEDICINES_KEY, 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<MedicineDetail>(`/medicines/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useMedicineMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: MEDICINES_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreateMedicineRequest) => {
      const { data } = await api.post<MedicineDetail>('/medicines', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateMedicineRequest }) => {
      const { data } = await api.patch<MedicineDetail>(`/medicines/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<MedicineDetail>(`/medicines/${id}/deactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<MedicineDetail>(`/medicines/${id}/reactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const toggleFavourite = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<MedicineDetail>(`/medicines/${id}/favourite`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, deactivate, reactivate, toggleFavourite };
}
