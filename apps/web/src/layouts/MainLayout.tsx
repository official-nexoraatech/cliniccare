import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth-store';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function MainLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
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
            <p className="text-sm font-bold text-[var(--color-navy)]">{today}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">{user?.name}</p>
              <p className="text-xs uppercase tracking-wide text-gray-400">{user?.role}</p>
            </div>
            <button
              onClick={() => setConfirmLogoutOpen(true)}
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

      <ConfirmDialog
        open={confirmLogoutOpen}
        title="Log out?"
        description="You'll need to sign in again to continue."
        confirmLabel="Log out"
        destructive
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
    </div>
  );
}
