import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  Pill,
  PhoneCall,
  Award,
  FileBadge,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { PermissionKey } from '@clinic-care/shared-types';
import { cn } from '@/lib/utils';
import { resolveServerUrl } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { useAuthStore } from '@/store/auth-store';
import { useClinicQuery } from '@/hooks/useClinic';

const navItems: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; permission?: PermissionKey }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: Users, permission: 'patients:view' },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, permission: 'visits:view' },
  { to: '/visits', label: 'Visits', icon: Stethoscope, permission: 'visits:view' },
  { to: '/medicines', label: 'Medicines', icon: Pill, permission: 'medicines:view' },
  { to: '/follow-up', label: 'Follow-up', icon: PhoneCall, permission: 'patients:view' },
  { to: '/compliance', label: 'Compliance', icon: Award, permission: 'patients:view' },
  { to: '/certificates', label: 'Certificates', icon: FileBadge, permission: 'prescriptions:view' },
  { to: '/billing', label: 'Billing', icon: Receipt, permission: 'billing:view' },
  { to: '/accounts', label: 'Accounts', icon: Wallet, permission: 'billing:view' },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const currentUser = useAuthStore((state) => state.user);
  const { data: clinic } = useClinicQuery();
  const visibleItems = navItems.filter((item) => !item.permission || hasPermission(currentUser, item.permission));

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        {clinic?.logoPath ? (
          <img
            src={resolveServerUrl(clinic.logoPath)}
            alt={clinic.name}
            className="h-9 w-9 flex-shrink-0 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
            CC
          </div>
        )}
        <span className="truncate text-lg font-bold text-[var(--color-navy)]">{clinic?.name ?? 'ClinicCare'}</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {visibleItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              )
            }
          >
            <Icon className="h-4.5 w-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {clinic?.doctorName && (
        <div className="border-t border-gray-200 px-5 py-4">
          <p className="truncate text-sm font-semibold text-[var(--color-navy)]">Dr. {clinic.doctorName}</p>
          {clinic.degree && <p className="truncate text-xs text-gray-500">{clinic.degree}</p>}
          {clinic.regnNumber && <p className="truncate text-xs text-gray-400">Regn. {clinic.regnNumber}</p>}
        </div>
      )}
    </aside>
  );
}
