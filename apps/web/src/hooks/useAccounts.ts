import { useQuery } from '@tanstack/react-query';
import type { AccountsSummary, DaybookEntry, OutstandingDueItem } from '@clinic-care/shared-types';
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
