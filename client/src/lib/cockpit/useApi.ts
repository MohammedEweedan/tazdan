'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

/**
 * Fetch a cockpit endpoint. Re-fetches when `path` or `query` change;
 * `reload()` forces a fresh read after an action.
 */
export function useApi<T = any>(path: string | null, query?: Record<string, unknown>, opts: { refreshMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const key = path ? `${path}?${JSON.stringify(query ?? {})}` : null;
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path, { query });
      if (mine === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (mine === seq.current) setError(e instanceof ApiError ? e : new ApiError(String(e), 0));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!opts.refreshMs) return;
    const t = setInterval(() => { void load(); }, opts.refreshMs);
    return () => clearInterval(t);
  }, [load, opts.refreshMs]);

  return { data, error, loading, reload: load };
}
