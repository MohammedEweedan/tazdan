// ── Design System ── Re-exports ──
export * from './tokens';
export * from './content';
export * from './sounds';

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Currency, CurrencyMeta } from '@/types';

/**
 * Auto-resolve API base URL.
 *  1. Explicit override via `EXPO_PUBLIC_API_BASE` wins.
 *  2. On a physical device or LAN simulator, use Expo's Metro `hostUri`
 *     (your dev machine's LAN IP) — `localhost` would mean the device itself.
 *  3. On Android emulator, `10.0.2.2` reaches the host machine.
 *  4. Web + iOS Simulator can use `localhost` directly.
 */
const API_PORT = 5000;
const PRODUCTION_API_BASE = 'https://api.promrkts.com';
const HOSTED_API_HOSTS = new Set(['api.promrkts.com']);

/**
 * Local/dev servers expose Express routes under `/api/...`, so LAN and
 * localhost bases need a trailing `/api`. The hosted production domain is
 * already reverse-proxied so `https://api.promrkts.com/auth/login` reaches
 * Express `/api/auth/login`; adding another `/api` produces `/api/api/...`
 * upstream and every request 404s.
 */
function normalizeApiBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    if (HOSTED_API_HOSTS.has(url.hostname)) {
      return url.origin;
    }
  } catch {
    // Fall through for relative/custom bases.
  }
  return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
}

function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE;
  if (fromEnv) {
    // CRITICAL in release builds: refuse to talk cleartext.  Bearer
    // tokens, passwords, 2FA codes, withdrawal addresses must NEVER
    // travel over plaintext HTTP — passive Wi-Fi sniffing yields
    // total account takeover otherwise.  Dev/Expo Go can still hit
    // http://LAN_HOST:5001 because __DEV__ is true there.
    if (!__DEV__ && !fromEnv.startsWith('https://')) {
      throw new Error(
        `[security] Refusing cleartext API base "${fromEnv}" in a release build. ` +
        `Set EXPO_PUBLIC_API_BASE to an https:// URL at build time.`,
      );
    }
    return normalizeApiBase(fromEnv);
  }

  // Release/TestFlight-style builds should use the hosted API by default.
  // Dev keeps the LAN/localhost resolver below so Expo Go and simulators
  // do not accidentally hit production while you are iterating.
  if (!__DEV__) {
    return normalizeApiBase(PRODUCTION_API_BASE);
  }

  // hostUri looks like "192.168.1.42:8081" when launched from `expo start`
  const hostUri = (Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost) as string | undefined;
  const lanHost = hostUri?.split(':')[0];

  if (Platform.OS === 'web')                 return `http://localhost:${API_PORT}/api`;
  if (Platform.OS === 'android' && !lanHost) return `http://10.0.2.2:${API_PORT}/api`;
  if (lanHost && lanHost !== 'localhost')    return `http://${lanHost}:${API_PORT}/api`;
  return `http://localhost:${API_PORT}/api`;
}

export const APP = {
  name: 'tazdan',
  tagline: 'Money. Crypto. One app.',
  supportEmail: 'support@tazdan.com',
  apiBaseUrl: resolveApiBase(),
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
