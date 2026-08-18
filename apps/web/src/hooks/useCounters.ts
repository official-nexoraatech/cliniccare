import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Counter, UpdateCounterRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const COUNTERS_KEY = ['counters'] as const;

export function useCountersQuery() {
  return useQuery({
    queryKey: COUNTERS_KEY,
    queryFn: async () => {
      const { data } = await api.get<Counter[]>('/counters');
      return data;
    },
  });
}

export function useCounterMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: COUNTERS_KEY });

  const update = useMutation({
    mutationFn: async ({ key, payload }: { key: string; payload: UpdateCounterRequest }) => {
      const { data } = await api.patch<Counter>(`/counters/${key}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  return { update };
}
