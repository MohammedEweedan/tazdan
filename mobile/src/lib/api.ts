/**
 * Axios instance with interceptors for auth + auto refresh.
 *
 * On 401 it tries to silently rotate the refresh token (once). If that fails,
 * tokens are wiped from SecureStore — the auth store will then redirect to
 * the (auth) route group.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { APP, STORAGE_KEYS } from '@/constants';
import { secureStore } from './secureStore';

export const api = axios.create({
  baseURL: APP.apiBaseUrl,
  timeout: 8_000,
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

// Stable per-install device id — generated once, persisted in SecureStore, and
// sent as `x-device-id` so the server can recognize trusted devices and skip
// the step-up prompt on a device the user has already verified.
const DEVICE_ID_KEY = 'tazdan.deviceId';
let _deviceId: string | null = null;
async function getDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId;
  let id = await secureStore.get(DEVICE_ID_KEY).catch(() => null);
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
    await secureStore.set(DEVICE_ID_KEY, id).catch(() => {});
  }
  _deviceId = id;
  return id;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await secureStore.get(STORAGE_KEYS.accessToken);
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  if (config.headers) config.headers['x-device-id'] = await getDeviceId();
  return config;
});

let refreshing: Promise<{ token: string | null; hardFail: boolean }> | null = null;

/**
 * Tries to rotate the refresh token. Returns:
 *  - { token: 'new-at', hardFail: false } on success
 *  - { token: null,     hardFail: true }  when the server explicitly
 *      says the refresh token is invalid (401/403/404) — sign out.
 *  - { token: null,     hardFail: false } on network / timeout / 5xx —
 *      keep the user signed in. We'll retry on the next request.
 *
 * The distinction matters: a flaky network must NOT log a user out the
 * way an actually-expired session does.
 */
async function tryRefresh(): Promise<{ token: string | null; hardFail: boolean }> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const refreshToken = await secureStore.get(STORAGE_KEYS.refreshToken);
      if (!refreshToken) return { token: null, hardFail: true };
      const { data } = await axios.post(
        `${APP.apiBaseUrl}/auth/refresh`,
        { refreshToken },
        { timeout: 8_000 },
      );
      const next  = (data?.accessToken  ?? data?.token) as string | undefined;
      const newRt = (data?.refreshToken ?? data?.refresh_token) as string | undefined;
      if (next)  await secureStore.set(STORAGE_KEYS.accessToken, next);
      if (newRt) await secureStore.set(STORAGE_KEYS.refreshToken, newRt);
      return { token: next ?? null, hardFail: false };
    } catch (e: any) {
      // Hard sign-out only when the server explicitly rejected the token.
      // Network / timeout / 5xx are transient — keep the session.
      const status = e?.response?.status;
      const hardFail = status === 401 || status === 403 || status === 404;
      return { token: null, hardFail };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Strip every credential-bearing field from an AxiosError object
 *  before it propagates upward.  Axios attaches `config.headers` and
 *  `config.data` to the error it throws, so any future `console.error`,
 *  Sentry breadcrumb, or unhandled-rejection log would otherwise
 *  exfiltrate bearer tokens, passwords, 2FA codes, refresh tokens, etc.
 *  We mutate the error in-place because rethrowing a different object
 *  loses the prototype chain that callers rely on (`err.isAxiosError`,
 *  `err.response.status`, etc.). */
const SENSITIVE_BODY_KEYS = ['password', 'twoFactorCode', 'pin', 'refreshToken', 'token', 'code'];
function scrubAxiosError(error: AxiosError): AxiosError {
  try {
    if (error.config?.headers) {
      // Bearer token in the request header.
      delete (error.config.headers as any).Authorization;
      delete (error.config.headers as any).authorization;
    }
    if (error.config?.data) {
      // Body fields tend to be JSON-stringified by the time the error
      // is observed; try to parse, redact, restringify.  If anything
      // throws, drop the body entirely — better blank than leaky.
      try {
        const parsed = typeof error.config.data === 'string'
          ? JSON.parse(error.config.data)
          : error.config.data;
        if (parsed && typeof parsed === 'object') {
          for (const k of SENSITIVE_BODY_KEYS) if (k in parsed) parsed[k] = '[redacted]';
          error.config.data = typeof error.config.data === 'string'
            ? JSON.stringify(parsed)
            : parsed;
        }
      } catch {
        error.config.data = '[redacted]';
      }
    }
    // Response config (axios duplicates here).
    if (error.response?.config?.headers) {
      delete (error.response.config.headers as any).Authorization;
      delete (error.response.config.headers as any).authorization;
    }
  } catch {
    // never let the scrubber itself throw — it'd convert a refusable
    // error into an unhandled rejection.
  }
  return error;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const { token, hardFail } = await tryRefresh();
      if (token && original.headers) {
        original.headers.Authorization = `Bearer ${token}`;
        return api.request(original);
      }
      // Only wipe tokens + notify on a definitive sign-out signal.
      // Transient failures (network drop, server hiccup) leave the
      // tokens in place so the next foreground refresh can recover.
      if (hardFail) {
        await Promise.all([
          secureStore.remove(STORAGE_KEYS.accessToken),
          secureStore.remove(STORAGE_KEYS.refreshToken),
        ]);
        onUnauthorized?.();
      }
    }
    return Promise.reject(scrubAxiosError(error));
  },
);

// Profile API
export const profileAPI = {
  getMyProfile: () => api.get('/profile/me'),
  updateProfile: (data: { username?: string; bio?: string; avatarUrl?: string; baseCurrency?: string; profilePublic?: boolean; acceptedCurrencies?: string[] }) =>
    api.patch('/profile/me', data),
  getPublicProfile: (username: string) => api.get(`/profile/public/${username}`),
  searchProfiles: (q: string) => api.get(`/profile/search?q=${encodeURIComponent(q)}`),
};
