import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FollowUpCounts,
  FollowUpItem,
  MarkContactedRequest,
  PatientFollowUpSummary,
  RescheduleFollowUpRequest,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const FOLLOW_UPS_KEY = ['follow-ups'] as const;

export function useFollowUpCountsQuery() {
  return useQuery({
    queryKey: [...FOLLOW_UPS_KEY, 'counts'],
    queryFn: async () => {
      const { data } = await api.get<FollowUpCounts>('/follow-ups/counts');
      return data;
    },
  });
}

export function useFollowUpListQuery(view: 'due' | 'overdue' | 'upcoming' | 'missed' | 'call-list') {
  const path = view === 'call-list' ? '/follow-ups/call-list' : `/follow-ups/${view}`;
  return useQuery({
    queryKey: [...FOLLOW_UPS_KEY, 'list', view],
    queryFn: async () => {
      const { data } = await api.get<FollowUpItem[]>(path);
      return data;
    },
  });
}

export function usePatientFollowUpsQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: [...FOLLOW_UPS_KEY, 'patient', patientId],
    queryFn: async () => {
      const { data } = await api.get<PatientFollowUpSummary>(`/follow-ups/patient/${patientId}`);
      return data;
    },
    enabled: Boolean(patientId),
  });
}

export function useFollowUpMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: FOLLOW_UPS_KEY });

  const markContacted = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: MarkContactedRequest }) => {
      const { data } = await api.patch<FollowUpItem>(`/follow-ups/${id}/contacted`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RescheduleFollowUpRequest }) => {
      const { data } = await api.patch<FollowUpItem>(`/follow-ups/${id}/reschedule`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<FollowUpItem>(`/follow-ups/${id}/cancel`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { markContacted, reschedule, cancel };
}
