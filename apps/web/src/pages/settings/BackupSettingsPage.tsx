import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Database,
  DownloadCloud,
  Info,
  KeyRound,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { getErrorMessage } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageSkeleton } from '@/components/Skeleton';
import { useBackupMutations, useBackupStatusQuery, useRestorePreviewQuery } from '@/hooks/useBackup';

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-IN') : 'Never';
}

function stageLabel(stage: 'LOCAL_DUMP' | 'ATLAS_SYNC' | 'RESTORE'): string {
  if (stage === 'LOCAL_DUMP') return 'Local snapshot';
  if (stage === 'ATLAS_SYNC') return 'Atlas sync';
  return 'Restore from Atlas';
}

function InfoButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/15"
        aria-label={label}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-8 z-30 w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-medium leading-relaxed text-slate-600 opacity-0 shadow-xl shadow-slate-900/10 transition group-hover:opacity-100 group-focus-within:opacity-100">
        {children}
      </span>
    </span>
  );
}

function StatusTile({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-50 text-slate-600';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>{icon}</div>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function attemptBadgeClass(status: string) {
  if (status === 'SUCCESS') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'FAILED') return 'bg-red-50 text-red-700 ring-red-100';
  if (status === 'SKIPPED') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-amber-100';
}

const LOG_PAGE_SIZE_OPTIONS = [5, 10, 20];

export function BackupSettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'administration:edit');
  const { data: status, isLoading } = useBackupStatusQuery();
  const { updateSettings, runNow, restoreFromAtlas } = useBackupMutations();

  // The stored connection string is never returned to the browser, only whether one exists.
  const [connectionString, setConnectionString] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [logPage, setLogPage] = useState(0);
  const [logPageSize, setLogPageSize] = useState(5);
  const { data: restorePreview, isLoading: previewLoading } = useRestorePreviewQuery(restoreDialogOpen);

  const attemptsCount = status?.recentAttempts.length ?? 0;
  const logPageCount = Math.max(1, Math.ceil(attemptsCount / logPageSize));
  const pagedAttempts = useMemo(
    () => status?.recentAttempts.slice(logPage * logPageSize, logPage * logPageSize + logPageSize) ?? [],
    [logPage, logPageSize, status?.recentAttempts],
  );
  const pageStart = attemptsCount === 0 ? 0 : logPage * logPageSize + 1;
  const pageEnd = Math.min((logPage + 1) * logPageSize, attemptsCount);

  useEffect(() => {
    setLogPage((page) => Math.min(page, logPageCount - 1));
  }, [logPageCount]);

  const onToggle = async (enabled: boolean) => {
    try {
      await updateSettings.mutateAsync({ enabled });
      toast.success(enabled ? 'Cloud backup enabled' : 'Cloud backup disabled - using local Mongo only');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update backup settings.'));
    }
  };

  const onSaveConnectionString = async () => {
    try {
      await updateSettings.mutateAsync({ enabled: true, atlasConnectionString: connectionString });
      setConnectionString('');
      toast.success('Connected - Atlas connection string saved');
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
        toast.success('Local snapshot saved - Atlas sync skipped');
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
        toast.success(`Restored from Atlas - local now has ${result.localCountAfter} records (was ${result.localCountBefore}).`);
      } else {
        toast.error(result.message ?? 'Restore did not complete');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Restore failed.'));
    }
  };

  if (isLoading || !status) {
    return <PageSkeleton />;
  }

  const restoreDescription = previewLoading
    ? 'Checking Atlas...'
    : restorePreview?.error
      ? `Could not read Atlas: ${restorePreview.error}`
      : restorePreview
        ? `Atlas has ${restorePreview.atlasCount ?? '?'} records. Local currently has ${restorePreview.localCount} records. ` +
          "This will replace all local data with what's in Atlas. A safety copy of the current local data is taken first."
        : '';

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Administration</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--color-navy)]">Backup & Sync</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Local Mongo stays primary. Atlas is used as an optional off-machine backup.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={onBackupNow}
              disabled={runNow.isPending || !status.enabled}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20 focus-visible:ring-offset-2 active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runNow.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              Backup now
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusTile
          icon={status.enabled ? <CheckCircle2 className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
          label="Cloud backup"
          value={status.enabled ? 'Enabled' : 'Disabled'}
          tone={status.enabled ? 'success' : 'warning'}
        />
        <StatusTile icon={<Database className="h-4 w-4" />} label="Last local snapshot" value={formatDateTime(status.lastLocalDumpAt)} />
        <StatusTile icon={<CloudUpload className="h-4 w-4" />} label="Last Atlas sync" value={formatDateTime(status.lastAtlasSyncAt)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[var(--color-navy)]">Cloud backup</h2>
                <InfoButton label="Cloud backup info">
                  When enabled, this machine still uses local Mongo first. Atlas receives backup copies so data can be recovered if the local database is lost.
                </InfoButton>
              </div>
              <p className="mt-1 text-sm text-slate-500">Configure Atlas and run manual backups from this machine.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
              <input
                type="checkbox"
                checked={status.enabled}
                disabled={!canEdit || updateSettings.isPending}
                onChange={(e) => onToggle(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              Enable
            </label>
          </div>

          {!status.enabled ? (
            <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Cloud backup is off. Local Mongo will continue working, but nothing is copied to Atlas.
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <label className="block text-sm font-semibold text-slate-700">Atlas connection string</label>
                  <InfoButton label="Atlas connection string info">
                    Paste the full MongoDB Atlas URI. The app tests the connection before saving. If it fails, check Atlas Network Access for this machine's IP address.
                  </InfoButton>
                </div>
                <div className="flex flex-col gap-2 lg:flex-row">
                  <input
                    type="password"
                    value={connectionString}
                    onChange={(e) => setConnectionString(e.target.value)}
                    disabled={!canEdit}
                    placeholder={status.atlasConfigured ? 'Already configured - enter a new one to replace it' : 'mongodb+srv://...'}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm shadow-slate-200/40 transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10 disabled:bg-slate-50"
                  />
                  {canEdit && (
                    <button
                      onClick={onSaveConnectionString}
                      disabled={!connectionString || updateSettings.isPending}
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20 focus-visible:ring-offset-2 active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updateSettings.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      {updateSettings.isPending ? 'Testing' : 'Save string'}
                    </button>
                  )}
                </div>
                <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">
                  Stored locally on this machine. Use a dedicated Atlas database user and avoid reusing an important password.
                </p>
              </div>
            </div>
          )}
        </section>

        {status.atlasConfigured && canEdit && (
          <aside className="rounded-xl border border-red-100 bg-red-50 p-5 shadow-sm shadow-red-100/80">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-red-900">Restore from Atlas</h2>
                  <InfoButton label="Restore info">
                    This replaces local data with Atlas data. Use it only for recovery after local data loss or corruption.
                  </InfoButton>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-red-700">
                  High-risk action. A safety copy is created first, but this should not be used for routine syncing.
                </p>
              </div>
            </div>
            <button
              onClick={() => setRestoreDialogOpen(true)}
              disabled={restoreFromAtlas.isPending}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {restoreFromAtlas.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
              Restore from Atlas
            </button>
          </aside>
        )}
      </div>

      {status.recentAttempts.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--color-navy)]">Recent attempts</h2>
              <InfoButton label="Recent attempts info">
                Shows the latest backup, sync and restore jobs started from this machine, with their final status and message.
              </InfoButton>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Showing {pageStart}-{pageEnd} of {status.recentAttempts.length}
            </span>
          </div>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
            {pagedAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="grid gap-3 bg-white px-4 py-3 text-sm transition hover:bg-slate-50 lg:grid-cols-[8rem_11rem_12rem_minmax(0,1fr)] lg:items-center"
              >
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${attemptBadgeClass(attempt.status)}`}>
                  {attempt.status}
                </span>
                <span className="font-medium text-slate-700">{stageLabel(attempt.stage)}</span>
                <span className="text-xs font-medium text-slate-400">{formatDateTime(attempt.startedAt)}</span>
                <span className="truncate text-xs text-slate-500">{attempt.message || 'No message recorded'}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={logPageSize}
                onChange={(event) => {
                  setLogPageSize(Number(event.target.value));
                  setLogPage(0);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
              >
                {LOG_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">
                Page {logPage + 1} of {logPageCount}
              </span>
              <button
                type="button"
                onClick={() => setLogPage((page) => Math.max(0, page - 1))}
                disabled={logPage === 0}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                type="button"
                onClick={() => setLogPage((page) => Math.min(logPageCount - 1, page + 1))}
                disabled={logPage >= logPageCount - 1}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {status.recentAttempts.length === 0 && (
        <section className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No backup attempts yet</p>
          <p className="mt-1 text-sm text-slate-400">Run a backup to see activity here.</p>
        </section>
      )}

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
