// ── Design System ── Re-exports ──
export * from './tokens';
export * from './content';
export * from './sounds';

import { API_BASE_URL } from './environment';
import type { Currency, CurrencyMeta } from '@/types';

export const APP = {
  name: 'tazdan',
  tagline: 'Arab roots. Crypto. Connected.',
  supportEmail: 'support@tazdan.com',
  apiBaseUrl: API_BASE_URL,
};

/**
 * Stripe configuration. Publishable key is safe to ship to the client
 * (it can only create tokens, not charge cards). Set this via
 * `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` at build time and the merchant ID
 * via `EXPO_PUBLIC_APPLE_MERCHANT_ID` (must match the entry in app.json
 * `ios.entitlements`).
 *
 * If the publishable key is missing, the Apple/Google Pay buttons will
 * fall back to a regular "Pay with card" flow (no Express button).
 */
export const STRIPE = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  merchantIdentifier: process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID ?? 'merchant.com.tazdan.app',
  // Display name shown in the Apple Pay / Google Pay sheet
  merchantDisplayName: 'tazdan',
  // Two-letter country for Apple Pay / Google Pay merchant locale
  merchantCountryCode: process.env.EXPO_PUBLIC_PAY_COUNTRY ?? 'US',
};

export const STORAGE_KEYS = {
  accessToken:  'tazdan.accessToken',
  refreshToken: 'tazdan.refreshToken',
  onboarded:    'tazdan.onboarded',
  lastUser:     'tazdan.lastUser',
} as const;

export const QUERY_KEYS = {
  me:           ['me'] as const,
  wallets:      ['wallets'] as const,
  transactions: (page = 1) => ['transactions', page] as const,
  activities:   (page = 1, type: string = 'ALL') => ['activities', type, page] as const,
  markets:      ['markets'] as const,
  ticker:       (symbol: string) => ['ticker', symbol] as const,
  ohlcv:        (symbol: string, range: string) => ['ohlcv', symbol, range] as const,
  p2pOffers:    (filter: string) => ['p2p-offers', filter] as const,
  p2pMyListings: ['p2p-my-listings'] as const,
  p2pMyTrades:   ['p2p-my-trades'] as const,
  cards:        ['cards'] as const,
  publicProfile: (handle: string) => ['public-profile', handle] as const,
  conversations:  ['conversations']                              as const,
  thread:         (userId: string) => ['thread', userId]         as const,
  blocks:         ['message-blocks']                             as const,
  notifications:  ['notifications']                              as const,
  unreadCount:    ['unread-count']                               as const,
};

export const CURRENCY_META: Record<Currency, CurrencyMeta> = {
  // crypto
  BTC:   { code: 'BTC',   kind: 'crypto', name: 'Bitcoin',    symbol: '₿',    decimals: 8, flagOrIcon: '₿' },
  ETH:   { code: 'ETH',   kind: 'crypto', name: 'Ethereum',   symbol: 'Ξ',    decimals: 8, flagOrIcon: 'Ξ' },
  USDT:  { code: 'USDT',  kind: 'crypto', name: 'Tether',     symbol: '₮',    decimals: 2, flagOrIcon: '₮' },
  SOL:   { code: 'SOL',   kind: 'crypto', name: 'Solana',     symbol: 'SOL',  decimals: 4, flagOrIcon: '◎' },
  BNB:   { code: 'BNB',   kind: 'crypto', name: 'BNB',        symbol: 'BNB',  decimals: 4, flagOrIcon: '⬡' },
  XRP:   { code: 'XRP',   kind: 'crypto', name: 'XRP',        symbol: 'XRP',  decimals: 4, flagOrIcon: '✕' },
  ADA:   { code: 'ADA',   kind: 'crypto', name: 'Cardano',    symbol: 'ADA',  decimals: 4, flagOrIcon: '₳' },
  DOGE:  { code: 'DOGE',  kind: 'crypto', name: 'Dogecoin',   symbol: 'Ð',    decimals: 4, flagOrIcon: 'Ð' },
  MATIC: { code: 'MATIC', kind: 'crypto', name: 'Polygon',    symbol: 'MATIC',decimals: 4, flagOrIcon: '◆' },
  DOT:   { code: 'DOT',   kind: 'crypto', name: 'Polkadot',   symbol: 'DOT',  decimals: 4, flagOrIcon: '●' },
  AVAX:  { code: 'AVAX',  kind: 'crypto', name: 'Avalanche',  symbol: 'AVAX', decimals: 4, flagOrIcon: '▲' },
  // fiat — flagOrIcon / symbol below are the ENGLISH defaults. For the
  // locale-aware, font-safe glyph (Arabic variants, the new Saudi Riyal mark,
  // LD for the Libyan Dinar, …) use `fiatSymbol(code, locale)` instead of
  // reading these fields directly. They remain here so static callers and the
  // crypto entries keep working unchanged.
  USD:   { code: 'USD',   kind: 'fiat',   name: 'US Dollar',         symbol: '$',   decimals: 2, flagOrIcon: '$' },
  EUR:   { code: 'EUR',   kind: 'fiat',   name: 'Euro',              symbol: '€',   decimals: 2, flagOrIcon: '€' },
  GBP:   { code: 'GBP',   kind: 'fiat',   name: 'British Pound',     symbol: '£',   decimals: 2, flagOrIcon: '£' },
  AED:   { code: 'AED',   kind: 'fiat',   name: 'UAE Dirham',        symbol: 'AED', decimals: 2, flagOrIcon: 'AED' },
  SAR:   { code: 'SAR',   kind: 'fiat',   name: 'Saudi Riyal',       symbol: 'SAR', decimals: 2, flagOrIcon: 'SAR' },
  EGP:   { code: 'EGP',   kind: 'fiat',   name: 'Egyptian Pound',    symbol: 'E£',  decimals: 2, flagOrIcon: 'E£' },
  // Libyan Dinar — 3 decimals (millimes). "LD" in Latin contexts, "د.ل" in Arabic.
  LYD:   { code: 'LYD',   kind: 'fiat',   name: 'Libyan Dinar',      symbol: 'LD',  decimals: 3, flagOrIcon: 'LD' },
};

/**
 * Locale- and font-safe fiat currency symbols.
 *
 * Each entry has a Latin/default form and an Arabic form. We deliberately use
 * representations that render correctly on shipping device fonts:
 *  - The brand-new Saudi Riyal mark (U+20C0, approved Feb 2025) has almost no
 *    font coverage yet, so we render the well-supported "SAR" / "ر.س" instead
 *    of a tofu box. Swap `SAR.default` to '⃀' once OS fonts ship it.
 *  - The Libyan Dinar shows "LD" in Latin and "د.ل" in Arabic, per request.
 *
 * Symbols are plain text, so colour is inherited from the surrounding <Text>
 * — i.e. automatically theme-aware. Pass the active locale for locale-awareness.
 */
const FIAT_SYMBOL_LOCALE: Record<string, { default: string; ar: string }> = {
  USD: { default: '$',   ar: '$' },
  EUR: { default: '€',   ar: '€' },
  GBP: { default: '£',   ar: '£' },
  AED: { default: 'AED', ar: 'د.إ' },
  SAR: { default: 'SAR', ar: 'ر.س' },   // see note above re: U+20C0
  EGP: { default: 'E£',  ar: 'ج.م' },
  LYD: { default: 'LD',  ar: 'د.ل' },
  CHF: { default: 'Fr',  ar: 'فرنك' },
  JPY: { default: '¥',   ar: '¥' },
  CAD: { default: 'CA$', ar: 'دولار كندي' },
  AUD: { default: 'A$',  ar: 'دولار أسترالي' },
  SDG: { default: 'SDG', ar: 'ج.س' },
  NGN: { default: '₦',   ar: '₦' },
  TRY: { default: '₺',   ar: '₺' },
  LBP: { default: 'LBP', ar: 'ل.ل' },
};

/** Best, font-safe symbol for a fiat code in the given locale. */
export function fiatSymbol(code: string, locale?: string): string {
  const entry = FIAT_SYMBOL_LOCALE[code];
  if (!entry) return code;
  return locale === 'ar' ? entry.ar : entry.default;
}

export function normalizeCurrencyCode(currency: string): Currency | null {
  if (currency in CURRENCY_META) return currency as Currency;
  if (currency.startsWith('USDT_')) return 'USDT';
  return null;
}

export function getCurrencyMeta(currency: string): CurrencyMeta | null {
  const normalized = normalizeCurrencyCode(currency);
  if (normalized) return CURRENCY_META[normalized];
  // Fallback for any altcoin not in the static map (e.g. PEPE, SHIB, WIF …)
  return {
    code: currency as Currency,
    kind: 'crypto',
    name: currency,
    symbol: currency.slice(0, 4),
    decimals: 8,
    flagOrIcon: currency.slice(0, 2),
  };
}
