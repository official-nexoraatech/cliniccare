export type BackupStage = 'LOCAL_DUMP' | 'ATLAS_SYNC' | 'RESTORE';
export type BackupAttemptStatus = 'SUCCESS' | 'FAILED' | 'RETRYING' | 'SKIPPED';

export interface BackupAttempt {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  stage: BackupStage;
  status: BackupAttemptStatus;
  message: string | null;
  localCount: number | null;
  atlasCount: number | null;
}

export interface BackupStatus {
  enabled: boolean;
  atlasConfigured: boolean;
  lastLocalDumpAt: string | null;
  lastAtlasSyncAt: string | null;
  recentAttempts: BackupAttempt[];
}

export interface UpdateBackupSettingsRequest {
  enabled: boolean;
  /** Omit to leave the currently-stored connection string unchanged; pass '' to clear it. */
  atlasConnectionString?: string;
}

export interface RestorePreview {
  atlasConfigured: boolean;
  /** null when Atlas isn't configured, or the live count couldn't be fetched (see error). */
  atlasCount: number | null;
  localCount: number;
  error?: string;
}

export interface RestoreResult {
  ok: boolean;
  message?: string;
  localCountBefore: number;
  localCountAfter: number | null;
}
