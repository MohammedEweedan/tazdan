/**
 * Money + number formatting. CURRENCY_META in src/constants is the
 * single source of truth — never hardcode a symbol or precision in a
 * screen file, call the helpers here.
 */
import { CURRENCY_META, getCurrencyMeta } from '@/constants';
import type { Currency } from '@/types';

/* Re-export so callers can do `import { CURRENCY_SYMBOLS } from '@/utils/format'`
 * without us duplicating a table. */
export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(CURRENCY_META).map(([code, meta]) => [code, meta.symbol]),
);

/** Currencies whose symbol prefixes the number ($100, not 100$). Right-to-left
 *  currencies (LYD, AED, SAR) trail the code instead. */
const PREFIX_SYMBOLS = new Set(['$', '€', '£', '₿', 'Ξ', '₮']);

export interface MoneyParts {
  sign: '' | '-' | '+';   // '+' only when `opts.signed`
  symbol: string;         // e.g. '$', 'ل.د', 'ETH'
  whole: string;          // grouped integer ('1,234')
  decimal: string;        // fractional including dot ('.50') or '' if zero
  code: Currency;
  /** Whether the symbol prefixes (true) or trails (false) the number. */
  prefix: boolean;
}

interface FormatOpts {
  /** Show the currency mark ($/€/code). Default: false → digits only. */
  showSymbol?: boolean;
  /** Prefix positive numbers with '+'. Negatives always get '-'. */
  signed?: boolean;
  /** Render "1.2K" / "3.4M" for large numbers. Default: false. */
  compact?: boolean;
  /** Force a specific min/max decimal pair, overriding CURRENCY_META. */
  minDecimals?: number;
  maxDecimals?: number;
  /** Locale for thousands grouping. Defaults to 'en-US' (universal, predictable). */
  locale?: string;
}

function toNumber(amount: string | number): number {
  if (typeof amount === 'number') return amount;
  // Strict parse — refuses "1.2.3" etc. by relying on Number()
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Break a money value into render-ready parts. Use this for tabular
 * displays where the decimal needs a smaller font, or for splitting
 * the symbol into a separate Text node.
 */
export function moneyParts(
  amount: string | number,
  currency: Currency,
  opts: FormatOpts = {},
): MoneyParts {
  const meta = CURRENCY_META[currency];
  const locale = opts.locale ?? 'en-US';
  const n = toNumber(amount);
  const sign: '' | '-' | '+' =
    n < 0 ? '-' : n > 0 && opts.signed ? '+' : '';

  const abs = Math.abs(n);
  const minDecimals = opts.minDecimals ?? (meta.kind === 'fiat' ? meta.decimals : Math.min(2, meta.decimals));
  const maxDecimals = opts.maxDecimals ?? meta.decimals;

  let formatted: string;
  if (opts.compact && abs >= 1000) {
    formatted = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(abs);
  } else {
    formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(abs);
  }

  // Split on the locale's decimal separator. We use 'en-US' by default
  // so this is reliably a '.'.
  const decSep = (1.1).toLocaleString(locale).replace(/\d/g, '');
  const dotIdx = formatted.indexOf(decSep);
  const whole = dotIdx === -1 ? formatted : formatted.slice(0, dotIdx);
  const decimal = dotIdx === -1 ? '' : formatted.slice(dotIdx);

  return {
    sign,
    symbol: meta.symbol,
    whole,
    decimal,
    code: currency,
    prefix: PREFIX_SYMBOLS.has(meta.symbol),
  };
}

/**
 * Format money as a single string — the most common case.
 *
 *   formatMoney(1234.5,  'USD')                 → '1,234.50'
 *   formatMoney(1234.5,  'USD', { showSymbol })  → '$1,234.50'
 *   formatMoney(0.0125,  'BTC', { showSymbol })  → '0.01250000 BTC'
 *   formatMoney(-50,     'USD', { showSymbol, signed }) → '-$50.00'
 *   formatMoney(2300,    'USD', { compact })     → '2.3K'
 */
export function formatMoney(
  amount: string | number,
  currency: Currency,
  opts: FormatOpts = {},
): string {
  const p = moneyParts(amount, currency, opts);
  const number = `${p.whole}${p.decimal}`;
  if (!opts.showSymbol) return `${p.sign}${number}`;
  if (p.prefix) return `${p.sign}${p.symbol}${number}`;
  return `${p.sign}${number} ${p.code}`;
}

/* ── Back-compat — old call sites import `formatAmount`. ─────────── */
export const formatAmount = formatMoney;

/**
 * Plain integer / decimal formatting with thousands separators.
 * For non-money numbers (counts, hash rates, etc.).
 */
export function formatThousands(
  n: number,
  opts: { decimals?: number; locale?: string } = {},
): string {
  return new Intl.NumberFormat(opts.locale ?? 'en-US', {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0,
  }).format(n);
}

export function formatPercent(p: number, opts: { signed?: boolean; decimals?: number } = {}): string {
  const sign = opts.signed && p > 0 ? '+' : '';
  return `${sign}${p.toFixed(opts.decimals ?? 2)}%`;
}

/**
 * Fast fiat helper — always 2 decimals, en-US grouping. Kept for
 * back-compat; new code should prefer `formatMoney(n, 'USD')`.
 */
export function formatFiat(n: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Resolve a currency code to the display string (symbol if known,
 * code otherwise). Cheap helper for currency chips/labels.
 */
export function currencyLabel(code: string): string {
  return getCurrencyMeta(code)?.symbol ?? code;
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
