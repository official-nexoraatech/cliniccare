import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicProfile, UpdateClinicRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const CLINIC_KEY = ['clinic'];

export function useClinicQuery() {
  return useQuery({
    queryKey: CLINIC_KEY,
    queryFn: async () => {
      const { data } = await api.get<ClinicProfile>('/clinic');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useClinicMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: CLINIC_KEY });

  const update = useMutation({
    mutationFn: async (payload: UpdateClinicRequest) => {
      const { data } = await api.patch<ClinicProfile>('/clinic', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      const { data } = await api.post<ClinicProfile>('/clinic/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: invalidate,
  });

  const uploadLetterhead = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('letterhead', file);
      const { data } = await api.post<ClinicProfile>('/clinic/letterhead', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: invalidate,
  });

  return { update, uploadLogo, uploadLetterhead };
}
