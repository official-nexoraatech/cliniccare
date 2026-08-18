import { useQuery } from '@tanstack/react-query';
import type { PatientHistoryResponse } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

export const PATIENT_HISTORY_KEY = ['patient-history'] as const;

export function usePatientHistoryQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: [...PATIENT_HISTORY_KEY, patientId],
    queryFn: async () => {
      const { data } = await api.get<PatientHistoryResponse>(`/patients/${patientId}/history`);
      return data;
    },
    enabled: Boolean(patientId),
  });
}
