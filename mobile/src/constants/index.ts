import type { Currency, CurrencyMeta } from '@/types';

export const APP = {
  name: 'Promrkts',
  tagline: 'Money. Crypto. One app.',
  supportEmail: 'support@promrkts.app',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:5000/api',
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
  cards:        ['cards'] as const,
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
  LYD:   { code: 'LYD',   kind: 'fiat',   name: 'Libyan Dinar',      symbol: 'ل.د',decimals: 3, flagOrIcon: '🇱🇾' },
};
