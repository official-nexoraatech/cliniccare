import { useState } from 'react';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/lib/permissions';
import { useAuthStore } from '@/store/auth-store';
import { UsersPage } from './UsersPage';
import { ClinicProfilePage } from './ClinicProfilePage';
import { RolesPermissionsPage } from './RolesPermissionsPage';
import { FeeMasterPage } from './FeeMasterPage';
import { NumberingSettingsPage } from './NumberingSettingsPage';
import { PatientFieldsPage } from './PatientFieldsPage';
import { MedicineFieldsPage } from './MedicineFieldsPage';

const TABS = [
  { key: 'users', label: 'Users', permission: 'administration:view' as const },
  { key: 'roles', label: 'Roles & Permissions', permission: 'administration:view' as const },
  { key: 'clinic', label: 'Clinic Profile', permission: null },
  { key: 'fees', label: 'Fee Master', permission: null },
  { key: 'patientFields', label: 'Patient Fields', permission: null },
  { key: 'medicineFields', label: 'Medicine Fields', permission: null },
  { key: 'numbering', label: 'Numbering', permission: null },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function SettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const visibleTabs = TABS.filter((t) => !t.permission || hasPermission(currentUser, t.permission));
  const [tab, setTab] = useState<TabKey>(visibleTabs[0]?.key ?? 'clinic');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-gray-200">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-medium',
              tab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersPage />}
      {tab === 'roles' && <RolesPermissionsPage />}
      {tab === 'clinic' && <ClinicProfilePage />}
      {tab === 'fees' && <FeeMasterPage />}
      {tab === 'patientFields' && <PatientFieldsPage />}
      {tab === 'medicineFields' && <MedicineFieldsPage />}
      {tab === 'numbering' && <NumberingSettingsPage />}
    </div>
  );
}
