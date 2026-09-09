import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccountsSummary,
  CreatePaymentAccountRequest,
  DaybookEntry,
  OutstandingDueItem,
  PaymentAccount,
  PaymentAccountStatus,
  UpdatePaymentAccountRequest,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const ACCOUNTS_KEY = ['accounts'] as const;

export function useAccountsSummaryQuery(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'summary', from, to],
    queryFn: async () => {
      const { data } = await api.get<AccountsSummary>('/accounts/summary', { params: { from, to } });
      return data;
    },
    enabled,
  });
}

export function useOutstandingDuesQuery(enabled = true) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'dues'],
    queryFn: async () => {
      const { data } = await api.get<OutstandingDueItem[]>('/accounts/dues');
      return data;
    },
    enabled,
  });
}

export function useDaybookQuery(date: string, enabled = true) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'daybook', date],
    queryFn: async () => {
      const { data } = await api.get<DaybookEntry[]>('/accounts/daybook', { params: { date } });
      return data;
    },
    enabled,
  });
}

export function usePaymentAccountsQuery(enabled = true) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'payment-accounts'],
    queryFn: async () => {
      const { data } = await api.get<PaymentAccount[]>('/accounts/payment-accounts');
      return data;
    },
    enabled,
  });
}

export function usePaymentAccountMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...ACCOUNTS_KEY, 'payment-accounts'] });
    queryClient.invalidateQueries({ queryKey: [...ACCOUNTS_KEY, 'summary'] });
    queryClient.invalidateQueries({ queryKey: [...ACCOUNTS_KEY, 'daybook'] });
  };

  const create = useMutation({
    mutationFn: async (payload: CreatePaymentAccountRequest) => {
      const { data } = await api.post<PaymentAccount>('/accounts/payment-accounts', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePaymentAccountRequest }) => {
      const { data } = await api.patch<PaymentAccount>(`/accounts/payment-accounts/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PaymentAccountStatus }) => {
      const { data } = await api.patch<PaymentAccount>(`/accounts/payment-accounts/${id}`, { status });
      return data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<PaymentAccount>(`/accounts/payment-accounts/${id}`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, updateStatus, remove };
}
