import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/lib/permissions';
import { useAuthStore } from '@/store/auth-store';
import { PageSkeleton } from '@/components/Skeleton';
import { UsersPage } from './UsersPage';
import { ClinicProfilePage } from './ClinicProfilePage';
import { RolesPermissionsPage } from './RolesPermissionsPage';
import { FeeMasterPage } from './FeeMasterPage';
import { NumberingSettingsPage } from './NumberingSettingsPage';
import { FieldsSettingsPage } from './FieldsSettingsPage';
import { BackupSettingsPage } from './BackupSettingsPage';
import { WhatsAppMessagesPage } from './WhatsAppMessagesPage';

const TABS = [
  { key: 'users', label: 'Users', permission: 'administration:view' as const },
  { key: 'roles', label: 'Roles & Permissions', permission: 'administration:view' as const },
  { key: 'clinic', label: 'Clinic Profile', permission: null },
  { key: 'fees', label: 'Fee Master', permission: null },
  { key: 'fields', label: 'Fields Settings', permission: null },
  { key: 'whatsapp', label: 'WhatsApp Messages', permission: null },
  { key: 'numbering', label: 'Numbering', permission: null },
  // Host-only (see the isHost check below) — a Client machine has no local Mongo of its
  // own to back up, so the tab would just be a dead control pointed at the Host's DB.
  { key: 'backup', label: 'Backup & Sync', permission: 'administration:view' as const },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// Which tab is active lives in the URL (/settings/:tab), not component state — so a browser
// refresh (or a bookmarked/shared link) lands back on the same tab instead of resetting to
// the first one.
export function SettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  // null = not resolved yet. Kept distinct from `false` so a refresh landing directly on
  // /settings/backup doesn't get bounced away before the (async, Electron-only) role check
  // has had a chance to come back true.
  const [isHost, setIsHost] = useState<boolean | null>(null);

  useEffect(() => {
    window.clinicCare
      ?.getRole()
      .then((role) => setIsHost(role === 'HOST'))
      .catch(() => setIsHost(false));
    if (!window.clinicCare) setIsHost(false);
  }, []);

  const visibleTabs = TABS.filter((t) => {
    if (t.key === 'backup' && !isHost) return false;
    return !t.permission || hasPermission(currentUser, t.permission);
  });

  const isValidTab = (value: string | undefined): value is TabKey => visibleTabs.some((t) => t.key === value);

  if (tab === 'backup' && isHost === null) {
    return <PageSkeleton />;
  }

  if (tab === 'patientFields' || tab === 'medicineFields') {
    return <Navigate to="/settings/fields" replace />;
  }

  if (!isValidTab(tab)) {
    const fallback = visibleTabs[0]?.key ?? 'clinic';
    return <Navigate to={`/settings/${fallback}`} replace />;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-8">
      <div className="overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(`/settings/${t.key}`, { replace: true })}
            className={cn(
              'border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/15',
              tab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800',
            )}
          >
            {t.label}
          </button>
        ))}
        </div>
      </div>

      {tab === 'users' && <UsersPage />}
      {tab === 'roles' && <RolesPermissionsPage />}
      {tab === 'clinic' && <ClinicProfilePage />}
      {tab === 'fees' && <FeeMasterPage />}
      {tab === 'fields' && <FieldsSettingsPage />}
      {tab === 'whatsapp' && <WhatsAppMessagesPage />}
      {tab === 'numbering' && <NumberingSettingsPage />}
      {tab === 'backup' && <BackupSettingsPage />}
    </div>
  );
}
