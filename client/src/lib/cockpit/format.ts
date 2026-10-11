/**
 * Display formatting for the cockpit. Money is shown with the currency code
 * (never a guessed symbol) and the currency's own minor units.
 */
const MINOR_UNITS: Record<string, number> = { LYD: 3, TND: 3, BTC: 8, ETH: 6, SOL: 4, USDT: 2 };

export function money(amount: unknown, currency?: string | null, locale = 'en'): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return '—';
  const digits = currency ? (MINOR_UNITS[currency] ?? 2) : 2;
  const s = n.toLocaleString(locale === 'ar' ? 'ar-LY' : 'en-GB', { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits });
  return currency ? `${s} ${currency}` : s;
}

export function usd(amount: unknown, compact = false): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (compact && a >= 10_000) {
    return `${sign}$${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(a)}`;
  }
  return `${sign}$${a.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(n: unknown): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString('en-GB') : '—';
}

export function pctText(p: number | null | undefined): string {
  if (p === null || p === undefined) return 'new';
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
}

export function dateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function ago(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function shortId(id: string | null | undefined, n = 8): string {
  return id ? id.slice(0, n) : '—';
}
