/**
 * Auth store. Boots from SecureStore on app start, then keeps the user object
 * + tokens in memory. Screens read from this store for the gated route guard.
 */

import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';
import { authService } from '@/services';
import type { User } from '@/types';

const BIOMETRIC_KEY = 'promrkts.biometricEnabled';

type LastUser = Pick<User, 'email' | 'firstName' | 'lastName'> & {
  username?: string;
  avatarUrl?: string;
  passkeyEnabled?: boolean;
};

function toLastUser(user: User): LastUser {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    passkeyEnabled: Boolean((user as any).passkeyEnabled ?? (user as any).hasPasskey),
  };
}

async function cacheLastUser(user: User) {
  await secureStore.set(STORAGE_KEYS.lastUser, JSON.stringify(toLastUser(user))).catch(() => {});
}

function parseLastUser(raw: string | null): LastUser | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as LastUser; } catch { return null; }
}

interface AuthState {
  user: User | null;
  lastUser: LastUser | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  biometricEnabled: boolean;

  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  triggerBiometricLogin: () => Promise<boolean>;
  register: (p: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username: string;
    country: string;
    phoneCountryCode: string;
    phone: string;
    dateOfBirth: string; // YYYY-MM-DD
    avatarUrl?: string;
    referralCode?: string;
  }, opts?: { skipStateUpdate?: boolean }) => Promise<{ user: User; accessToken: string; refreshToken: string }>;
  setAuthenticated: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  lastUser: null,
  isAuthenticated: false,
  isHydrating: true,
  biometricEnabled: false,

  hydrate: async () => {
    try {
      const [at, bioEnabled, lastUserRaw] = await Promise.all([
        secureStore.get(STORAGE_KEYS.accessToken),
        secureStore.get(BIOMETRIC_KEY),
        secureStore.get(STORAGE_KEYS.lastUser),
      ]);
      const lastUser = parseLastUser(lastUserRaw);
      set({ biometricEnabled: bioEnabled === 'true', lastUser });
      if (!at) return set({ user: null, isAuthenticated: false, isHydrating: false, lastUser });
      const user = await authService.me().catch(() => null);
      if (user) await cacheLastUser(user);
      set({ user, lastUser: user ? toLastUser(user) : lastUser, isAuthenticated: !!user, isHydrating: false });
    } catch {
      set({ user: null, isAuthenticated: false, isHydrating: false });
    }
  },

  login: async (email, password) => {
    const { user, accessToken, refreshToken } = await authService.login(email, password);
    await secureStore.set(STORAGE_KEYS.accessToken, accessToken);
    await secureStore.set(STORAGE_KEYS.refreshToken, refreshToken);
    await cacheLastUser(user);
    set({ user, lastUser: toLastUser(user), isAuthenticated: true });
  },

  enableBiometric: async () => {
    await secureStore.set(BIOMETRIC_KEY, 'true');
    set({ biometricEnabled: true });
  },

  disableBiometric: async () => {
    await secureStore.remove(BIOMETRIC_KEY);
    set({ biometricEnabled: false });
  },

  triggerBiometricLogin: async () => {
    // Check RT first — no point prompting Face ID if the session is dead.
    const rt = await secureStore.get(STORAGE_KEYS.refreshToken);
    if (!rt) throw Object.assign(new Error('Session expired'), { code: 'SESSION_EXPIRED' });

    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHardware || !isEnrolled) return false;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Promrkts',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (!result.success) return false;
      const { accessToken, refreshToken } = await authService.refresh(rt);
      await secureStore.set(STORAGE_KEYS.accessToken, accessToken);
      await secureStore.set(STORAGE_KEYS.refreshToken, refreshToken);
      const user = await authService.me();
      await cacheLastUser(user);
      set({ user, lastUser: toLastUser(user), isAuthenticated: true });
      return true;
    } catch (e: any) {
      if (e?.code === 'SESSION_EXPIRED') throw e;
      return false;
    }
  },

  register: async (p, opts) => {
    const { user, accessToken, refreshToken } = await authService.register(p);
    await secureStore.set(STORAGE_KEYS.accessToken, accessToken);
    await secureStore.set(STORAGE_KEYS.refreshToken, refreshToken);
    await cacheLastUser(user);
    if (!opts?.skipStateUpdate) {
      set({ user, lastUser: toLastUser(user), isAuthenticated: true });
    }
    return { user, accessToken, refreshToken };
  },

  setAuthenticated: (user) => {
    cacheLastUser(user);
    set({ user, lastUser: toLastUser(user), isAuthenticated: true });
  },

  updateUser: (updates) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
      lastUser: state.user ? toLastUser({ ...state.user, ...updates }) : state.lastUser,
    }));
  },

  logout: async () => {
    await authService.logout();
    // Drop the websocket so the server doesn't keep emitting events
    // into a dead user room and a fresh JWT is picked up on next login.
    const { disconnectSocket } = await import('@/lib/socket');
    disconnectSocket();
    set({ user: null, isAuthenticated: false });
  },
}));
