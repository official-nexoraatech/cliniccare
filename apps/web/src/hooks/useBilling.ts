import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BillDetail,
  BillItemInput,
  BillListItem,
  CancelBillRequest,
  CreateBillRequest,
  RecordPaymentRequest,
  RemoveBillItemRequest,
  UpdateBillRequest,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const BILLING_KEY = ['billing'] as const;

export function useBillsQuery(filters: { status?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: [...BILLING_KEY, 'list', filters],
    queryFn: async () => {
      const { data } = await api.get<BillListItem[]>('/billing', { params: filters });
      return data;
    },
  });
}

export function useBillsByPatientQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: [...BILLING_KEY, 'patient', patientId],
    queryFn: async () => {
      const { data } = await api.get<BillListItem[]>(`/billing/patient/${patientId}`);
      return data;
    },
    enabled: Boolean(patientId),
  });
}

export function useBillQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...BILLING_KEY, 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<BillDetail>(`/billing/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useBillByVisitQuery(visitId: string | undefined) {
  return useQuery({
    queryKey: [...BILLING_KEY, 'visit', visitId],
    queryFn: async () => {
      const { data } = await api.get<BillDetail | null>(`/billing/visit/${visitId}`);
      return data;
    },
    enabled: Boolean(visitId),
  });
}

export function useBillMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: BILLING_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreateBillRequest) => {
      const { data } = await api.post<BillDetail>('/billing', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateBillRequest }) => {
      const { data } = await api.patch<BillDetail>(`/billing/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const addItem = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: BillItemInput }) => {
      const { data } = await api.post<BillDetail>(`/billing/${id}/items`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const recordPayment = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RecordPaymentRequest }) => {
      const { data } = await api.post<BillDetail>(`/billing/${id}/payments`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const markPrinted = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<BillDetail>(`/billing/${id}/print`);
      return data;
    },
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CancelBillRequest }) => {
      const { data } = await api.patch<BillDetail>(`/billing/${id}/cancel`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const cancelItem = useMutation({
    mutationFn: async ({ id, itemId, payload }: { id: string; itemId: string; payload: RemoveBillItemRequest }) => {
      const { data } = await api.patch<BillDetail>(`/billing/${id}/items/${itemId}/cancel`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const waiveItem = useMutation({
    mutationFn: async ({ id, itemId, payload }: { id: string; itemId: string; payload: RemoveBillItemRequest }) => {
      const { data } = await api.patch<BillDetail>(`/billing/${id}/items/${itemId}/waive`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, addItem, recordPayment, markPrinted, cancel, cancelItem, waiveItem };
}
