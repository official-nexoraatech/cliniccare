import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@clinic-care/shared-types';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (accessToken, user) => set({ accessToken, user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'clinic-care-auth',
      // Bump this whenever AuthUser's shape changes — a session cached under an
      // older shape (e.g. missing the `permissions` field added here) gets
      // dropped instead of crashing every screen that reads the new field.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<AuthState> | undefined;
        if (state?.user && !Array.isArray(state.user.permissions)) {
          return { accessToken: null, user: null };
        }
        return state as AuthState;
      },
    },
  ),
);
