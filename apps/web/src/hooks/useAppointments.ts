import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppointmentDetail,
  AppointmentStatus,
  BookAppointmentResponse,
  CreateAppointmentRequest,
  DoctorOption,
  RescheduleAppointmentRequest,
  UpdateAppointmentRequest,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const APPOINTMENTS_KEY = ['appointments'] as const;

export function useAppointmentsByDayQuery(date: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, 'day', date],
    queryFn: async () => {
      const { data } = await api.get<AppointmentDetail[]>(`/appointments/day/${date}`);
      return data;
    },
  });
}

export function useAppointmentQueueQuery() {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, 'queue'],
    queryFn: async () => {
      const { data } = await api.get<{
        items: AppointmentDetail[];
        nowServing: { tokenNo: number; doctorName: string | null }[];
        waiting: number;
      }>('/appointments/queue');
      return data;
    },
  });
}

export function useDoctorsQuery() {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, 'doctors'],
    queryFn: async () => {
      const { data } = await api.get<DoctorOption[]>('/appointments/doctors');
      return data;
    },
  });
}

export function useAppointmentSearchQuery(q: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, 'search', q],
    queryFn: async () => {
      const { data } = await api.get<AppointmentDetail[]>('/appointments/search', { params: { q } });
      return data;
    },
    enabled: q.trim().length > 0,
  });
}

export function usePatientAppointmentsQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, 'patient', patientId],
    queryFn: async () => {
      const { data } = await api.get<AppointmentDetail[]>(`/appointments/patient/${patientId}`);
      return data;
    },
    enabled: Boolean(patientId),
  });
}

export function useAppointmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });

  const book = useMutation({
    mutationFn: async (payload: CreateAppointmentRequest) => {
      const { data } = await api.post<BookAppointmentResponse>('/appointments', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateAppointmentRequest }) => {
      const { data } = await api.patch<BookAppointmentResponse>(`/appointments/${id}`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RescheduleAppointmentRequest }) => {
      const { data } = await api.patch<BookAppointmentResponse>(`/appointments/${id}/reschedule`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const linkPatient = useMutation({
    mutationFn: async ({ id, patientId }: { id: string; patientId: string }) => {
      const { data } = await api.patch<AppointmentDetail>(`/appointments/${id}/link-patient`, { patientId });
      return data;
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: AppointmentStatus; reason?: string }) => {
      const { data } = await api.patch<AppointmentDetail>(`/appointments/${id}/status`, { status, reason });
      return data;
    },
    onSuccess: invalidate,
  });

  const markArrived = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<AppointmentDetail>(`/appointments/${id}/arrived`);
      return data;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });

  return { book, update, reschedule, linkPatient, updateStatus, markArrived };
}
