import type { TillTotals } from '@/services/business';

/** "120.5 LYD · 40 USD" — a till's totals per currency. */
export function totalsLine(t: TillTotals): string {
  const parts = Object.entries(t).map(([c, v]) => `${Number(v.total).toLocaleString('en-US', { maximumFractionDigits: 3 })} ${c}`);
  return parts.length ? parts.join(' · ') : '—';
}

/** Number of payments across currencies. */
export const countOf = (t: TillTotals) => Object.values(t).reduce((n, v) => n + v.count, 0);
