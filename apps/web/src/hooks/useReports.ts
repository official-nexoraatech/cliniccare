import { useQuery } from '@tanstack/react-query';
import type {
  AppointmentFunnelResponse,
  PatientFootfallResponse,
  RevenueTrendResponse,
  TopMedicineItem,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const REPORTS_KEY = ['reports'] as const;

export function useRevenueTrendQuery(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: [...REPORTS_KEY, 'revenue-trend', from, to],
    queryFn: async () => {
      const { data } = await api.get<RevenueTrendResponse>('/reports/revenue-trend', { params: { from, to } });
      return data;
    },
    enabled,
  });
}

export function usePatientFootfallQuery(from: string, to: string) {
  return useQuery({
    queryKey: [...REPORTS_KEY, 'patient-footfall', from, to],
    queryFn: async () => {
      const { data } = await api.get<PatientFootfallResponse>('/reports/patient-footfall', { params: { from, to } });
      return data;
    },
  });
}

export function useAppointmentFunnelQuery(from: string, to: string) {
  return useQuery({
    queryKey: [...REPORTS_KEY, 'appointment-funnel', from, to],
    queryFn: async () => {
      const { data } = await api.get<AppointmentFunnelResponse>('/reports/appointment-funnel', { params: { from, to } });
      return data;
    },
  });
}

export function useTopMedicinesQuery(limit = 10) {
  return useQuery({
    queryKey: [...REPORTS_KEY, 'top-medicines', limit],
    queryFn: async () => {
      const { data } = await api.get<TopMedicineItem[]>('/reports/top-medicines', { params: { limit } });
      return data;
    },
  });
}
