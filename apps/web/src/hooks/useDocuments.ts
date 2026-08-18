import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentCategory, DocumentDetail } from '@clinic-care/shared-types';
import { api } from '@/lib/api';
import { PATIENT_HISTORY_KEY } from './usePatientHistory';

export function useDocumentMutations() {
  const queryClient = useQueryClient();
  const invalidate = (patientId: string) =>
    queryClient.invalidateQueries({ queryKey: [...PATIENT_HISTORY_KEY, patientId] });

  const upload = useMutation({
    mutationFn: async (payload: {
      patientId: string;
      visitId?: string;
      category?: DocumentCategory;
      description?: string;
      file: File;
    }) => {
      const formData = new FormData();
      // patientId must be appended before the file — multer's storage `filename`
      // callback reads req.body mid-stream and only sees fields that arrived earlier.
      formData.append('patientId', payload.patientId);
      if (payload.visitId) formData.append('visitId', payload.visitId);
      if (payload.category) formData.append('category', payload.category);
      if (payload.description) formData.append('description', payload.description);
      formData.append('file', payload.file);

      const { data } = await api.post<DocumentDetail>('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => invalidate(data.patientId),
  });

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; patientId: string }) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: (_data, variables) => invalidate(variables.patientId),
  });

  return { upload, remove };
}
