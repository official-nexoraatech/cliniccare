import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePatientRequest,
  CreatePatientResponse,
  PatientDetail,
  PatientListQuery,
  PatientListResponse,
  PatientSearchResult,
  UpdatePatientRequest,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const PATIENTS_KEY = ['patients'] as const;

export function usePatientsQuery(query: PatientListQuery) {
  return useQuery({
    queryKey: [...PATIENTS_KEY, 'list', query],
    queryFn: async () => {
      const { data } = await api.get<PatientListResponse>('/patients', { params: query });
      return data;
    },
  });
}

export function usePatientSearchQuery(q: string) {
  return useQuery({
    queryKey: [...PATIENTS_KEY, 'search', q],
    queryFn: async () => {
      const { data } = await api.get<PatientSearchResult[]>('/patients/search', { params: { q } });
      return data;
    },
    enabled: q.trim().length > 0,
  });
}

export function usePatientQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...PATIENTS_KEY, 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<PatientDetail>(`/patients/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function usePatientMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: PATIENTS_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreatePatientRequest) => {
      const { data } = await api.post<CreatePatientResponse>('/patients', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePatientRequest }) => {
      const { data } = await api.patch<PatientDetail>(`/patients/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<PatientDetail>(`/patients/${id}/deactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<PatientDetail>(`/patients/${id}/reactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, deactivate, reactivate };
}
