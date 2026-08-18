import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ComplianceContext,
  ComplianceGrade,
  ComplianceReportRow,
  PatientComplianceResponse,
  SaveComplianceRequest,
} from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const COMPLIANCE_KEY = ['compliance'] as const;

export function useComplianceContextQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: [...COMPLIANCE_KEY, 'context', patientId],
    queryFn: async () => {
      const { data } = await api.get<ComplianceContext>(`/compliance/context/${patientId}`);
      return data;
    },
    enabled: Boolean(patientId),
  });
}

export function usePatientComplianceQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: [...COMPLIANCE_KEY, 'patient', patientId],
    queryFn: async () => {
      const { data } = await api.get<PatientComplianceResponse>(`/compliance/patient/${patientId}`);
      return data;
    },
    enabled: Boolean(patientId),
  });
}

export function useComplianceReportQuery(grade?: ComplianceGrade) {
  return useQuery({
    queryKey: [...COMPLIANCE_KEY, 'report', grade],
    queryFn: async () => {
      const { data } = await api.get<ComplianceReportRow[]>('/compliance/report', { params: { grade } });
      return data;
    },
  });
}

export function useComplianceMutations() {
  const queryClient = useQueryClient();

  const record = useMutation({
    mutationFn: async (payload: SaveComplianceRequest) => {
      const { data } = await api.post('/compliance', payload);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPLIANCE_KEY }),
  });

  return { record };
}
