import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

// Guarantee exactly one trailing `/api` — server routes are all under `/api`.
// (Kept in sync with constants/index.ts, which is the module actually imported.)
function withApiSuffix(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
}

function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE;
  if (fromEnv) {
    if (!__DEV__ && !fromEnv.startsWith('https://')) {
      throw new Error(
        `[security] Refusing cleartext API base "${fromEnv}" in a release build. ` +
        `Set EXPO_PUBLIC_API_BASE to an https:// URL at build time.`,
      );
    }
    return withApiSuffix(fromEnv);
  }

  if (!__DEV__) return withApiSuffix(PRODUCTION_API_BASE);

  const hostUri = (Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost) as string | undefined;
  const lanHost = hostUri?.split(':')[0];

  if (Platform.OS === 'web')                 return `http://localhost:${API_PORT}/api`;
  if (Platform.OS === 'android' && !lanHost) return `http://10.0.2.2:${API_PORT}/api`;
  if (lanHost && lanHost !== 'localhost')    return `http://${lanHost}:${API_PORT}/api`;
  return `http://localhost:${API_PORT}/api`;
}

export const APP = {
  name: 'Tazdan',
  tagline: 'Money. Crypto. One app.',
  supportEmail: 'support@tazdan.com',
  apiBaseUrl: resolveApiBase(),
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
