import { useCallback, useRef } from 'react';

/**
 * One idempotency key per intended money request. Pressing the button again
 * for the same request after a lost reply reuses the key, so the server
 * returns the first result instead of moving money twice. A different request
 * (amount, recipient, listing…) gets a new key, and so does the next request
 * once this one has `settled()`.
 */
export function useAttemptKey(prefix: string) {
  const ref = useRef<{ key: string; sig: string } | null>(null);
  const keyFor = useCallback((sig: string) => {
    if (ref.current?.sig === sig) return ref.current.key;
    const key = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    ref.current = { key, sig };
    return key;
  }, [prefix]);
  const settled = useCallback(() => { ref.current = null; }, []);
  return { keyFor, settled };
}
