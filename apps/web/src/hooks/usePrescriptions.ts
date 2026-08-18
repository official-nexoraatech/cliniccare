import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PrescriptionDetail, PrescriptionItemInput, SavePrescriptionRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const PRESCRIPTIONS_KEY = ['prescriptions'] as const;

export function usePrescriptionByVisitQuery(visitId: string | undefined) {
  return useQuery({
    queryKey: [...PRESCRIPTIONS_KEY, 'visit', visitId],
    queryFn: async () => {
      const { data } = await api.get<PrescriptionDetail | null>(`/prescriptions/visit/${visitId}`);
      return data;
    },
    enabled: Boolean(visitId),
  });
}

export function useLastPrescriptionQuery(patientId: string | undefined, excludeVisitId: string | undefined) {
  return useQuery({
    queryKey: [...PRESCRIPTIONS_KEY, 'last', patientId, excludeVisitId],
    queryFn: async () => {
      const { data } = await api.get<PrescriptionItemInput[]>(`/prescriptions/last/${patientId}`, {
        params: { excludeVisitId },
      });
      return data;
    },
    enabled: false,
  });
}

export function usePrescriptionMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: PRESCRIPTIONS_KEY });

  const save = useMutation({
    mutationFn: async ({ visitId, payload }: { visitId: string; payload: SavePrescriptionRequest }) => {
      const { data } = await api.post<PrescriptionDetail>(`/prescriptions/visit/${visitId}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const markPrinted = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<PrescriptionDetail>(`/prescriptions/${id}/print`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { save, markPrinted };
}
