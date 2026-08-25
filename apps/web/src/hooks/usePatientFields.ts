import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePatientFieldRequest, PatientFieldDefinition, UpdatePatientFieldRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const PATIENT_FIELDS_KEY = ['patient-fields'] as const;

export function usePatientFieldsQuery() {
  return useQuery({
    queryKey: PATIENT_FIELDS_KEY,
    queryFn: async () => {
      const { data } = await api.get<PatientFieldDefinition[]>('/patient-fields');
      return data;
    },
  });
}

export function usePatientFieldMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: PATIENT_FIELDS_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreatePatientFieldRequest) => {
      const { data } = await api.post<PatientFieldDefinition>('/patient-fields', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePatientFieldRequest }) => {
      const { data } = await api.patch<PatientFieldDefinition>(`/patient-fields/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<PatientFieldDefinition>(`/patient-fields/${id}/deactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<PatientFieldDefinition>(`/patient-fields/${id}/reactivate`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, deactivate, reactivate };
}
