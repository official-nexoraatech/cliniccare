import { useQuery } from '@tanstack/react-query';
import type { AccountsSummary, DaybookEntry, OutstandingDueItem } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const ACCOUNTS_KEY = ['accounts'] as const;

export function useAccountsSummaryQuery(from: string, to: string) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'summary', from, to],
    queryFn: async () => {
      const { data } = await api.get<AccountsSummary>('/accounts/summary', { params: { from, to } });
      return data;
    },
  });
}

export function useOutstandingDuesQuery() {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'dues'],
    queryFn: async () => {
      const { data } = await api.get<OutstandingDueItem[]>('/accounts/dues');
      return data;
    },
  });
}

export function useDaybookQuery(date: string) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, 'daybook', date],
    queryFn: async () => {
      const { data } = await api.get<DaybookEntry[]>('/accounts/daybook', { params: { date } });
      return data;
    },
  });
}
