import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';

export function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);
  // zustand's persist middleware rehydrates from localStorage asynchronously, so the very
  // first render after a hard refresh sees accessToken as null even for an already-logged-in
  // user — bouncing to /login before hydration has a chance to restore the real token. Wait
  // for hydration to finish before making the auth decision instead of trusting that first read.
  const [hasHydrated, setHasHydrated] = useState(useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (hasHydrated) return;
    return useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, [hasHydrated]);

  if (!hasHydrated) return null;

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
