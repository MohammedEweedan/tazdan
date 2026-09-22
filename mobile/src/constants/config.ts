import { API_BASE_URL } from './environment';

export const APP = {
  name: 'Tazdan',
  tagline: 'Arab roots. Crypto. Connected.',
  supportEmail: 'support@tazdan.com',
  apiBaseUrl: API_BASE_URL,
} as const;

export const STORAGE_KEYS = {
  accessToken:  'tazdan.accessToken',
  refreshToken: 'tazdan.refreshToken',
  onboarded:    'tazdan.onboarded',
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
  conversations:  ['conversations'] as const,
  thread:         (userId: string) => ['thread', userId] as const,
  blocks:         ['message-blocks'] as const,
  notifications:  ['notifications'] as const,
  unreadCount:    ['unread-count'] as const,
} as const;

export const FEATURES = {
  p2pEnabled: true,
  cardIssuance: true,
  biometricSend: true,
  expressPay: true,
  kycGate: true,
} as const;

export const DEEP_LINKS = {
  home:    'tazdan://home',
  wallet:  'tazdan://wallet',
  p2p:     'tazdan://p2p',
  send:    'tazdan://send',
  profile: (handle: string) => `tazdan://profile/${handle}`,
  asset:   (currency: string) => `tazdan://asset/${currency}`,
} as const;
