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

const BIOMETRIC_KEY  = 'tazdan.biometricEnabled';
const VIEW_MODE_KEY  = 'tazdan.viewMode';

export type ViewMode = 'admin' | 'user';

type LastUser = Pick<User, 'email' | 'firstName' | 'lastName' | 'id' | 'role'> & {
  username?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  passkeyEnabled?: boolean;
};

function toLastUser(user: User): LastUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username?.replace(/^@/, ''),
    avatarUrl: user.avatarUrl,
    avatarEmoji: user.avatarEmoji,
    role: user.role ?? 'USER',
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
  /** For admins: choose to use the app in 'admin' or 'user' mode. null = chooser not answered yet. */
  viewMode: ViewMode | null;
  needsViewSelection: boolean;

  hydrate: () => Promise<void>;
  // Returns `{ requires2FA: true }` if the server needs a TOTP code; the
  // caller should prompt for the code and call `login()` again with it.
  // Otherwise returns void and the store is now authenticated.
  login: (
    email: string,
    password: string,
    twoFactorCode?: string,
  ) => Promise<{ requires2FA: true } | void>;
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
  forgetLastUser: () => Promise<void>;
  logout: () => Promise<void>;
  setViewMode: (mode: ViewMode) => Promise<void>;
  clearViewSelection: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  lastUser: null,
  isAuthenticated: false,
  isHydrating: true,
  biometricEnabled: false,
  viewMode: null,
  needsViewSelection: false,

  hydrate: async () => {
    try {
      const [at, rt, bioEnabled, lastUserRaw, viewModeRaw] = await Promise.all([
        secureStore.get(STORAGE_KEYS.accessToken),
        secureStore.get(STORAGE_KEYS.refreshToken),
        secureStore.get(BIOMETRIC_KEY),
        secureStore.get(STORAGE_KEYS.lastUser),
        secureStore.get(VIEW_MODE_KEY),
      ]);
      const lastUser = parseLastUser(lastUserRaw);
      const viewMode = (viewModeRaw === 'admin' || viewModeRaw === 'user') ? viewModeRaw : null;
      set({ biometricEnabled: bioEnabled === 'true', lastUser, viewMode });

      // Refresh token + cached profile means "known user, locked".
      // Do not silently enter the app from a refresh token alone; the
      // welcome-back screen should unlock it with Face ID or password.
      if (!at && rt) {
        return set({ user: null, isAuthenticated: false, isHydrating: false, lastUser });
      }

      // No tokens at all → definitely signed out.
      if (!at && !rt) {
        return set({ user: null, isAuthenticated: false, isHydrating: false, lastUser });
      }

      // We have tokens — try to fetch /me, but DO NOT sign the user out
      // if it fails for transient reasons (network drop on cold-start,
      // server warming up, etc.). The api.ts interceptor handles real
      // sign-outs (401 → tryRefresh → hardFail → onUnauthorized).
      // When /me fails, fall back to the cached lastUser profile so the
      // app stays usable; the next foreground will retry.
      let user: any = null;
      try {
        user = await authService.me();
      } catch {
        user = null;
      }
      if (user) {
        // Defensive merge: if /me comes back without a username/avatar but the
        // cached profile had one (e.g. the user just set their @handle and the
        // server read replica hasn't caught up), keep the cached value so the
        // handle doesn't vanish on reload. Real fields from /me always win.
        if (lastUser) {
          if (!user.username && lastUser.username) user.username = lastUser.username;
          if (!user.avatarUrl && lastUser.avatarUrl) user.avatarUrl = lastUser.avatarUrl;
          if (!user.avatarEmoji && lastUser.avatarEmoji) user.avatarEmoji = lastUser.avatarEmoji;
        }
        await cacheLastUser(user);
      } else if (lastUser) {
        // Reconstruct a soft user object from the cached profile. This
        // is enough for AuthGate to keep us inside the (tabs) group;
        // the next /me call (on next foreground) will hydrate the real
        // profile fields.
        user = {
          id:        lastUser.id        ?? '',
          email:     lastUser.email     ?? '',
          firstName: lastUser.firstName ?? '',
          lastName:  lastUser.lastName  ?? '',
          username:  lastUser.username,
          avatarUrl: lastUser.avatarUrl,
          avatarEmoji: lastUser.avatarEmoji,
          role:      lastUser.role      ?? 'USER',
        };
      }

      // Authenticated as long as we have *some* user object AND a refresh
      // token still in secure store. The api interceptor will surface a
      // real expiry by clearing both tokens + calling onUnauthorized.
      const isAuthenticated = !!(user && rt);
      const needsViewSelection = isAuthenticated && user.role === 'ADMIN' && viewMode === null;

      set({
        user: isAuthenticated ? user : null,
        lastUser: user ? toLastUser(user) : lastUser,
        isAuthenticated,
        isHydrating: false,
        needsViewSelection,
        viewMode,
      });
    } catch {
      // Preserve session if tokens are still there — only mark hydrating
      // false so the app can render. Real sign-out comes from api.ts.
      set({ isHydrating: false });
    }
  },

  login: async (email, password, twoFactorCode) => {
    const result = await authService.login(email, password, twoFactorCode);
    if ('requires2FA' in result) return { requires2FA: true };

    let { user } = result;
    const { accessToken, refreshToken } = result;
    await secureStore.set(STORAGE_KEYS.accessToken, accessToken);
    await secureStore.set(STORAGE_KEYS.refreshToken, refreshToken);
    // Every account has a @handle. If the login payload came back lean
    // (no username), fetch /me so the handle is present instantly — no
    // "Set @handle" flash, no reload needed to reveal it.
    const loginIdentifier = email.trim().toLowerCase().replace(/^@/, '');
    if (!user.username) {
      try { user = await authService.me(); } catch { /* keep lean user */ }
    }
    if (!user.username && loginIdentifier && !loginIdentifier.includes('@')) {
      user = { ...user, username: loginIdentifier };
    }
    await cacheLastUser(user);
    // Fresh login always re-prompts admins for which view to enter.
    await secureStore.remove(VIEW_MODE_KEY).catch(() => {});
    set({
      user,
      lastUser: toLastUser(user),
      isAuthenticated: true,
      viewMode: null,
      needsViewSelection: user.role === 'ADMIN',
    });
  },

  setViewMode: async (mode) => {
    await secureStore.set(VIEW_MODE_KEY, mode);
    set({ viewMode: mode, needsViewSelection: false });
  },

  clearViewSelection: () => set({ needsViewSelection: true, viewMode: null }),

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
        promptMessage: 'Sign in to tazdan',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (!result.success) return false;
      const { accessToken, refreshToken } = await authService.refresh(rt);
      await secureStore.set(STORAGE_KEYS.accessToken, accessToken);
      await secureStore.set(STORAGE_KEYS.refreshToken, refreshToken);
      const user = await authService.me();
      await cacheLastUser(user);
      await secureStore.set(BIOMETRIC_KEY, 'true').catch(() => {});
      set({ user, lastUser: toLastUser(user), isAuthenticated: true, biometricEnabled: true });
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

  forgetLastUser: async () => {
    await Promise.all([
      secureStore.remove(STORAGE_KEYS.accessToken).catch(() => {}),
      secureStore.remove(STORAGE_KEYS.refreshToken).catch(() => {}),
      secureStore.remove(STORAGE_KEYS.lastUser).catch(() => {}),
      secureStore.remove(BIOMETRIC_KEY).catch(() => {}),
      secureStore.remove(VIEW_MODE_KEY).catch(() => {}),
    ]);
    set({
      user: null,
      lastUser: null,
      isAuthenticated: false,
      biometricEnabled: false,
      viewMode: null,
      needsViewSelection: false,
    });
  },

  logout: async () => {
    const remembered = get().user ? toLastUser(get().user as User) : get().lastUser;
    if (get().user) await cacheLastUser(get().user as User);
    // "Logout" in the consumer app is a lock-screen transition: keep the
    // cached identity and refresh token so Face ID can unlock the same
    // account. "Use a different account" calls forgetLastUser() and performs
    // the full credential wipe.
    const { disconnectSocket } = await import('@/lib/socket');
    disconnectSocket();
    await Promise.all([
      secureStore.remove(STORAGE_KEYS.accessToken).catch(() => {}),
      secureStore.remove(VIEW_MODE_KEY).catch(() => {}),
    ]);
    set({
      user: null,
      isAuthenticated: false,
      viewMode: null,
      needsViewSelection: false,
      lastUser: remembered,
    });
  },
}));
