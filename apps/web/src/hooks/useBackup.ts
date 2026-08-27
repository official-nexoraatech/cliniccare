import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BackupStatus, RestorePreview, RestoreResult, UpdateBackupSettingsRequest } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const BACKUP_STATUS_KEY = ['backup', 'status'] as const;
const RESTORE_PREVIEW_KEY = ['backup', 'restore-preview'] as const;

export function useBackupStatusQuery() {
  return useQuery({
    queryKey: BACKUP_STATUS_KEY,
    queryFn: async () => {
      const { data } = await api.get<BackupStatus>('/backup/status');
      return data;
    },
  });
}

// Only fetched when the caller asks (see enabled) — it opens a live connection to Atlas to
// count documents there, not something to run on every render.
export function useRestorePreviewQuery(enabled: boolean) {
  return useQuery({
    queryKey: RESTORE_PREVIEW_KEY,
    queryFn: async () => {
      const { data } = await api.get<RestorePreview>('/backup/restore-preview');
      return data;
    },
    enabled,
  });
}

export function useBackupMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: BACKUP_STATUS_KEY });

  const updateSettings = useMutation({
    mutationFn: async (payload: UpdateBackupSettingsRequest) => {
      const { data } = await api.patch<BackupStatus>('/backup/settings', payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<BackupStatus>('/backup/run');
      return data;
    },
    onSuccess: invalidate,
  });

  const restoreFromAtlas = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<RestoreResult>('/backup/restore');
      return data;
    },
    onSuccess: invalidate,
  });

  return { updateSettings, runNow, restoreFromAtlas };
}
