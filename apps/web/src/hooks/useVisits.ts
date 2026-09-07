import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdviseLabTestsRequest,
  AddBillableChargesRequest,
  BillDetail,
  BillItemInput,
  CreateVisitRequest,
  LabTestDetail,
  TodayVisitItem,
  UpdateVisitRequest,
  VisitDetail,
  VisitSummary,
  VitalDetail,
  VitalInput,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const VISITS_KEY = ['visits'] as const;

export function useTodaysVisitsQuery() {
  return useQuery({
    queryKey: [...VISITS_KEY, 'today'],
    queryFn: async () => {
      const { data } = await api.get<TodayVisitItem[]>('/visits/today');
      return data;
    },
  });
}

export function usePatientVisitsQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: [...VISITS_KEY, 'patient', patientId],
    queryFn: async () => {
      const { data } = await api.get<VisitSummary[]>(`/visits/patient/${patientId}`);
      return data;
    },
    enabled: Boolean(patientId),
  });
}

export function useVisitQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...VISITS_KEY, 'detail', id],
    queryFn: async () => {
      const { data } = await api.get<VisitDetail>(`/visits/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useComplaintSuggestions(q: string) {
  return useQuery({
    queryKey: [...VISITS_KEY, 'suggest-complaint', q],
    queryFn: async () => {
      const { data } = await api.get<string[]>('/visits/suggestions/complaint', { params: { q } });
      return data;
    },
    enabled: q.trim().length >= 2,
  });
}

export function useDiagnosisSuggestions(q: string) {
  return useQuery({
    queryKey: [...VISITS_KEY, 'suggest-diagnosis', q],
    queryFn: async () => {
      const { data } = await api.get<string[]>('/visits/suggestions/diagnosis', { params: { q } });
      return data;
    },
    enabled: q.trim().length >= 2,
  });
}

export function useVisitMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: VISITS_KEY });

  const create = useMutation({
    mutationFn: async (payload: CreateVisitRequest) => {
      const { data } = await api.post<VisitDetail>('/visits', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const start = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<VisitDetail>(`/visits/${id}/start`);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateVisitRequest }) => {
      const { data } = await api.patch<VisitDetail>(`/visits/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const saveVitals = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: VitalInput }) => {
      const { data } = await api.post<VitalDetail>(`/visits/${id}/vitals`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const adviseLabTests = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AdviseLabTestsRequest }) => {
      const { data } = await api.post<LabTestDetail[]>(`/visits/${id}/lab-tests`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const addBillableCharge = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: BillItemInput }) => {
      const { data } = await api.post<BillDetail>(`/visits/${id}/bill-items`, payload);
      return data;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  const addBillableCharges = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AddBillableChargesRequest }) => {
      const { data } = await api.post<BillDetail>(`/visits/${id}/bill-items/bulk`, payload);
      return data;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  return { create, start, update, saveVitals, adviseLabTests, addBillableCharge, addBillableCharges };
}
