'use client';

/**
 * Control Cockpit API client.
 *
 * Calls the API origin directly (not through the site's /api rewrite) so the
 * server sees the staff member's own IP — the admin IP allowlist, rate limits
 * and the audit trail depend on it.
 *
 * Staff tokens live in sessionStorage under cockpit-specific keys: they are
 * gone when the tab closes and never mix with any customer session.
 */

// Development talks to the local API server (server/.env PORT=5001);
// production defaults to the public API. NEXT_PUBLIC_API_URL overrides both.
const DEV_API = 'http://localhost:5001/api';
const RAW = process.env.NEXT_PUBLIC_API_URL
  || (process.env.NODE_ENV === 'production' ? 'https://api.promrkts.com' : DEV_API);

function resolveBase(raw: string): string {
  try {
    const u = new URL(raw);
    // api.promrkts.com is proxied at the root (nginx adds /api upstream).
    if (u.hostname === 'api.promrkts.com') return u.origin;
    const path = u.pathname.replace(/\/$/, '');
    return `${u.origin}${path || '/api'}`;
  } catch {
    return 'https://api.promrkts.com';
  }
}

export const API_BASE = resolveBase(RAW);

const ACCESS = 'tz_cockpit_access';
const REFRESH = 'tz_cockpit_refresh';

const store = {
  get(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k: string) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

export function hasSession(): boolean {
  return Boolean(store.get(ACCESS));
}

export function saveSession(accessToken: string, refreshToken: string) {
  store.set(ACCESS, accessToken);
  store.set(REFRESH, refreshToken);
}

export function clearSession() {
  store.del(ACCESS);
  store.del(REFRESH);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = store.get(REFRESH);
    if (!rt) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      saveSession(data.accessToken, data.refreshToken ?? rt);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}, retried = false): Promise<T> {
  const qs = init.query
    ? '?' + new URLSearchParams(
      Object.entries(init.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    : '';
  const token = store.get(ACCESS);
  const res = await fetch(`${API_BASE}${path}${qs}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (res.status === 401 && !retried && (await refresh())) {
    return api<T>(path, init, true);
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
        window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
    }
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status, data?.code, data?.details ?? data?.issues);
  }
  return data as T;
}

/** Staff sign-in: password, then TOTP when the account has 2FA. */
export async function login(email: string, password: string, twoFactorCode?: string): Promise<{ requires2FA: boolean }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, ...(twoFactorCode ? { twoFactorCode } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error ?? 'Sign-in failed', res.status, data?.code);
  if (data.requires2FA) return { requires2FA: true };
  if (data.user?.role !== 'ADMIN') throw new ApiError('This account does not have staff access.', 403, 'AUTHORIZATION');
  saveSession(data.accessToken, data.refreshToken);
  return { requires2FA: false };
}

export async function logout(): Promise<void> {
  const rt = store.get(REFRESH);
  if (rt) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${store.get(ACCESS) ?? ''}` },
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => undefined);
  }
  clearSession();
}
