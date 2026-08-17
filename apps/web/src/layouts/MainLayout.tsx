import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth-store';
import { GlobalPatientSearch } from '@/components/GlobalPatientSearch';

export function MainLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <div className="no-print">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="no-print flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-navy)]">ClinicCare Demo Clinic</p>
            <p className="text-xs text-gray-400">{today}</p>
          </div>

          <GlobalPatientSearch />

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">{user?.name}</p>
              <p className="text-xs uppercase tracking-wide text-gray-400">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
