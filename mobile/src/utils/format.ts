import { CURRENCY_META } from '@/constants';
import type { Currency } from '@/types';

/**
 * Format a Decimal-string amount for display.
 * Uses the per-currency precision from CURRENCY_META so BTC shows 8 decimals
 * but USD shows 2.
 */
export function formatAmount(
  amount: string | number,
  currency: Currency,
  opts: { showSymbol?: boolean; signed?: boolean; compact?: boolean } = {},
): string {
  const meta = CURRENCY_META[currency];
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const sign = opts.signed && n > 0 ? '+' : '';
  const abs = Math.abs(n);

  let formatted: string;
  if (opts.compact && abs >= 1000) {
    formatted = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  } else {
    formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: meta.kind === 'fiat' ? 2 : Math.min(2, meta.decimals),
      maximumFractionDigits: meta.decimals,
    }).format(n);
  }

  if (opts.showSymbol) {
    if (meta.kind === 'fiat' && ['$','€','£'].includes(meta.symbol)) {
      return `${n < 0 ? '-' : sign}${meta.symbol}${formatted.replace('-', '')}`;
    }
    return `${sign}${formatted} ${meta.code}`;
  }
  return `${sign}${formatted}`;
}

export function formatPercent(p: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && p > 0 ? '+' : '';
  return `${sign}${p.toFixed(2)}%`;
}

/**
 * Format a number as "xxx,xxx,xxx.xx" with exactly 2 decimal places.
 * Used for fiat balance display and currency approximation.
 */
export function formatFiat(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)        return `${seconds}s ago`;
  if (seconds < 3600)      return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400)    return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800)   return `${Math.floor(seconds / 86_400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function maskCardNumber(last4: string): string {
  return `•• •• •• ${last4}`;
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
