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

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await secureStore.get(STORAGE_KEYS.accessToken);
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const refreshToken = await secureStore.get(STORAGE_KEYS.refreshToken);
      if (!refreshToken) return null;
      const { data } = await axios.post(`${APP.apiBaseUrl}/auth/refresh`, { refreshToken });
      const next = data?.accessToken as string | undefined;
      const newRt = data?.refreshToken as string | undefined;
      if (next) await secureStore.set(STORAGE_KEYS.accessToken, next);
      if (newRt) await secureStore.set(STORAGE_KEYS.refreshToken, newRt);
      return next ?? null;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const next = await tryRefresh();
      if (next && original.headers) {
        original.headers.Authorization = `Bearer ${next}`;
        return api.request(original);
      }
      // refresh failed — wipe and notify
      await Promise.all([
        secureStore.remove(STORAGE_KEYS.accessToken),
        secureStore.remove(STORAGE_KEYS.refreshToken),
      ]);
      onUnauthorized?.();
    }
    return Promise.reject(error);
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
