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
function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE;
  if (fromEnv) return fromEnv;

  // hostUri looks like "192.168.1.42:8081" when launched from `expo start`
  const hostUri = (Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost) as string | undefined;
  const lanHost = hostUri?.split(':')[0];

  if (Platform.OS === 'web')                 return `http://localhost:${API_PORT}/api`;
  if (Platform.OS === 'android' && !lanHost) return `http://10.0.2.2:${API_PORT}/api`;
  if (lanHost && lanHost !== 'localhost')    return `http://${lanHost}:${API_PORT}/api`;
  return `http://localhost:${API_PORT}/api`;
}

export const APP = {
  name: 'Promrkts',
  tagline: 'Money. Crypto. One app.',
  supportEmail: 'support@promrkts.app',
  apiBaseUrl: resolveApiBase(),
};

export const STORAGE_KEYS = {
  accessToken:  'promrkts.accessToken',
  refreshToken: 'promrkts.refreshToken',
  onboarded:    'promrkts.onboarded',
} as const;

export const QUERY_KEYS = {
  me:           ['me'] as const,
  wallets:      ['wallets'] as const,
  transactions: (page = 1) => ['transactions', page] as const,
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
  // fiat
  USD:   { code: 'USD',   kind: 'fiat',   name: 'US Dollar',         symbol: '$',  decimals: 2, flagOrIcon: '🇺🇸' },
  EUR:   { code: 'EUR',   kind: 'fiat',   name: 'Euro',              symbol: '€',  decimals: 2, flagOrIcon: '🇪🇺' },
  GBP:   { code: 'GBP',   kind: 'fiat',   name: 'British Pound',     symbol: '£',  decimals: 2, flagOrIcon: '🇬🇧' },
  AED:   { code: 'AED',   kind: 'fiat',   name: 'UAE Dirham',        symbol: 'د.إ',decimals: 2, flagOrIcon: '🇦🇪' },
  SAR:   { code: 'SAR',   kind: 'fiat',   name: 'Saudi Riyal',       symbol: '﷼',  decimals: 2, flagOrIcon: '🇸🇦' },
  EGP:   { code: 'EGP',   kind: 'fiat',   name: 'Egyptian Pound',    symbol: '£',  decimals: 2, flagOrIcon: '🇪🇬' },
};
