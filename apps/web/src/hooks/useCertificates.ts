import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CancelCertificateRequest, CertificateDetail, IssueCertificateRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const CERTIFICATES_KEY = ['certificates'] as const;

export function useCertificatesQuery() {
  return useQuery({
    queryKey: [...CERTIFICATES_KEY, 'list'],
    queryFn: async () => {
      const { data } = await api.get<CertificateDetail[]>('/certificates');
      return data;
    },
  });
}

export function useCertificateMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: CERTIFICATES_KEY });

  const issue = useMutation({
    mutationFn: async (payload: IssueCertificateRequest) => {
      const { data } = await api.post<CertificateDetail>('/certificates', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const markPrinted = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<CertificateDetail>(`/certificates/${id}/print`);
      return data;
    },
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CancelCertificateRequest }) => {
      const { data } = await api.patch<CertificateDetail>(`/certificates/${id}/cancel`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  return { issue, markPrinted, cancel };
}
