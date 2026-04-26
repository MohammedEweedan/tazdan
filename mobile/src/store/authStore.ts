/**
 * Auth store. Boots from SecureStore on app start, then keeps the user object
 * + tokens in memory. Screens read from this store for the gated route guard.
 */

import { create } from 'zustand';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';
import { authService } from '@/services';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrating: boolean;        // true while we read SecureStore at boot

  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (p: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrating: true,

  hydrate: async () => {
    try {
      const at = await secureStore.get(STORAGE_KEYS.accessToken);
      if (!at) return set({ user: null, isAuthenticated: false, isHydrating: false });
      const user = await authService.me().catch(() => null);
      set({ user, isAuthenticated: !!user, isHydrating: false });
    } catch {
      set({ user: null, isAuthenticated: false, isHydrating: false });
    }
  },

  login: async (email, password) => {
    const { user, accessToken, refreshToken } = await authService.login(email, password);
    await secureStore.set(STORAGE_KEYS.accessToken, accessToken);
    await secureStore.set(STORAGE_KEYS.refreshToken, refreshToken);
    set({ user, isAuthenticated: true });
  },

  register: async (p) => {
    const { user, accessToken, refreshToken } = await authService.register(p);
    await secureStore.set(STORAGE_KEYS.accessToken, accessToken);
    await secureStore.set(STORAGE_KEYS.refreshToken, refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false });
  },
}));
