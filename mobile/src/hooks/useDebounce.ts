/**
 * Debounce a fast-changing value (search input, slider) so consumers —
 * usually a react-query key — only see it settle. Prevents one API
 * request per keystroke.
 */
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
