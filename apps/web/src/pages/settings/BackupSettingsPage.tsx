import { useState } from 'react';
import { toast } from 'sonner';
import { CloudUpload, DownloadCloud, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { getErrorMessage } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useBackupMutations, useBackupStatusQuery, useRestorePreviewQuery } from '@/hooks/useBackup';

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN') : 'Never';
}

function stageLabel(stage: 'LOCAL_DUMP' | 'ATLAS_SYNC' | 'RESTORE'): string {
  if (stage === 'LOCAL_DUMP') return 'Local snapshot';
  if (stage === 'ATLAS_SYNC') return 'Atlas sync';
  return 'Restore from Atlas';
}

export function BackupSettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'administration:edit');
  const { data: status, isLoading } = useBackupStatusQuery();
  const { updateSettings, runNow, restoreFromAtlas } = useBackupMutations();

  // Never populated from the server — the stored connection string isn't returned to the
  // browser, only whether one is configured (status.atlasConfigured).
  const [connectionString, setConnectionString] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const { data: restorePreview, isLoading: previewLoading } = useRestorePreviewQuery(restoreDialogOpen);

  const onToggle = async (enabled: boolean) => {
    try {
      await updateSettings.mutateAsync({ enabled });
      toast.success(enabled ? 'Cloud backup enabled' : 'Cloud backup disabled — using local Mongo only');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update backup settings.'));
    }
  };

  const onSaveConnectionString = async () => {
    try {
      // The server actually opens a connection before accepting this — a bad host, wrong
      // credentials, or this machine's IP not being allow-listed in Atlas all get rejected
      // right here instead of surfacing as a mysterious failure on the next scheduled sync.
      await updateSettings.mutateAsync({ enabled: true, atlasConnectionString: connectionString });
      setConnectionString('');
      toast.success('Connected — Atlas connection string saved');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not connect using this connection string.'));
    }
  };

  const onBackupNow = async () => {
    try {
      const result = await runNow.mutateAsync();
      const latest = result.recentAttempts[0];
      if (latest?.status === 'SUCCESS' && latest.stage === 'ATLAS_SYNC') {
        toast.success('Backed up to Atlas');
      } else if (latest?.status === 'SKIPPED') {
        toast.success('Local snapshot saved — Atlas sync skipped (no connection string configured)');
      } else if (latest?.status === 'SUCCESS') {
        toast.success('Local snapshot saved');
      } else if (latest) {
        toast.error(latest.message ?? 'Backup did not complete');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Backup failed.'));
    }
  };

  const onConfirmRestore = async () => {
    setRestoreDialogOpen(false);
    try {
      const result = await restoreFromAtlas.mutateAsync();
      if (result.ok) {
        toast.success(`Restored from Atlas — local now has ${result.localCountAfter} records (was ${result.localCountBefore}).`);
      } else {
        toast.error(result.message ?? 'Restore did not complete');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Restore failed.'));
    }
  };

  if (isLoading || !status) {
    return <p className="text-sm text-gray-400">Loading...</p>;
  }

  const restoreDescription = previewLoading
    ? 'Checking Atlas...'
    : restorePreview?.error
      ? `Could not read Atlas: ${restorePreview.error}`
      : restorePreview
        ? `Atlas has ${restorePreview.atlasCount ?? '?'} records. Local currently has ${restorePreview.localCount} records. ` +
          'This will REPLACE all local data with what\'s in Atlas — a safety copy of the current local data is taken first, ' +
          'but this is otherwise not reversible from within the app.'
        : '';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">Backup & Sync</h1>
        <p className="text-sm text-gray-500">
          Local Mongo on this machine is always the source of truth — cloud backup is optional, on top of it.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={status.enabled}
            disabled={!canEdit || updateSettings.isPending}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          <span className="text-sm font-medium text-gray-700">Enable cloud backup</span>
        </label>

        {!status.enabled ? (
          <p className="mt-2 text-sm text-gray-400">
            Off — this machine is using local Mongo only, with no cloud sync. Nothing runs in the background.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Atlas connection string</label>
              <input
                type="password"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                disabled={!canEdit}
                placeholder={status.atlasConfigured ? '••••••••••••  (already configured — enter a new one to replace it)' : 'mongodb+srv://...'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] disabled:bg-gray-50"
              />
              {canEdit && (
                <button
                  onClick={onSaveConnectionString}
                  disabled={!connectionString || updateSettings.isPending}
                  className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {updateSettings.isPending ? 'Testing connection...' : 'Save connection string'}
                </button>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Stored as plain text on this machine, same as the rest of the local database — don't reuse a
                sensitive password elsewhere for this. Saving tests the connection first — if it fails, make sure
                this machine's IP is allowed under Atlas → Network Access.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-gray-500">
                Last local snapshot: <span className="font-medium text-gray-700">{formatDateTime(status.lastLocalDumpAt)}</span>
              </span>
              <span className="text-gray-500">
                Last Atlas sync: <span className="font-medium text-gray-700">{formatDateTime(status.lastAtlasSyncAt)}</span>
              </span>
              {canEdit && (
                <button
                  onClick={onBackupNow}
                  disabled={runNow.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {runNow.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                  Backup Now
                </button>
              )}
            </div>

            {status.atlasConfigured && canEdit && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-medium text-red-800">Restore from Atlas</p>
                <p className="mt-1 text-xs text-red-700">
                  Pulls data down from Atlas and replaces everything on this machine. Rare, high-stakes — use this
                  only to recover a lost/corrupted local database, not as routine syncing.
                </p>
                <button
                  onClick={() => setRestoreDialogOpen(true)}
                  disabled={restoreFromAtlas.isPending}
                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {restoreFromAtlas.isPending ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <DownloadCloud className="h-3.5 w-3.5" />
                  )}
                  Restore from Atlas...
                </button>
              </div>
            )}

            {status.recentAttempts.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">Recent attempts</p>
                <div className="flex flex-col gap-1">
                  {status.recentAttempts.map((attempt) => (
                    <div key={attempt.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs">
                      <span
                        className={
                          attempt.status === 'SUCCESS'
                            ? 'rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700'
                            : attempt.status === 'FAILED'
                              ? 'rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700'
                              : attempt.status === 'SKIPPED'
                                ? 'rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-600'
                                : 'rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700'
                        }
                      >
                        {attempt.status}
                      </span>
                      <span className="text-gray-500">{stageLabel(attempt.stage)}</span>
                      <span className="text-gray-400">{formatDateTime(attempt.startedAt)}</span>
                      {attempt.message && <span className="truncate text-gray-500">— {attempt.message}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={restoreDialogOpen}
        title="Restore from Atlas?"
        description={restoreDescription}
        confirmLabel="Restore from Atlas"
        destructive
        onConfirm={onConfirmRestore}
        onCancel={() => setRestoreDialogOpen(false)}
      />
    </div>
  );
}
