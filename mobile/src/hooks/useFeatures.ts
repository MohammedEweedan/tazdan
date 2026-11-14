/**
 * Server feature switches (GET /api/features). Surfaces that are switched off
 * server-side show a "paused" notice instead of controls that would fail.
 *
 * Until flags load, new activity is hidden. Read/history/recovery screens
 * stay accessible even when a feature is paused.
 *
 * The same response carries this account's availability: features,
 * currencies and pairs that staff have locked (shown with a lock, can't be
 * used) or hidden (not shown) — for everyone or for this account. The server
 * refuses the activity either way; the app only follows it.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export interface FeatureFlags {
  p2p: boolean;
  cards: boolean;
  altTrading: boolean;
  blockchain: boolean;
  cryptoTrading: boolean;
  remittance: boolean;
  /** LYDT dinar token — a sandbox until the Central Bank of Libya authorises it. */
  lydt: boolean;
}

export type AvailabilityState = 'AVAILABLE' | 'LOCKED' | 'HIDDEN';
export interface Availability { state: AvailabilityState; message: string | null }

/** Availability features the server knows (services/platform/availability.service.ts). */
export type AvailabilityFeature =
  | 'transfers' | 'pay' | 'chat_payments' | 'claim_links' | 'business_payouts'
  | 'deposits' | 'withdrawals' | 'remittance' | 'cards'
  | 'fx' | 'crypto_trading' | 'recurring_buys' | 'p2p'
  | 'budgets' | 'blockchain' | 'lydt' | 'referrals';

interface FeaturesResponse {
  features: Partial<FeatureFlags>;
  availability?: {
    features: Record<string, Availability>;
    currencies: Record<string, Availability>;
    pairs: Record<string, Availability>;
  };
}

const DEFAULT_FLAGS: FeatureFlags = { p2p: false, cards: false, altTrading: false, blockchain: false, cryptoTrading: false, remittance: false, lydt: false };
const OPEN: Availability = { state: 'AVAILABLE', message: null };

function useFeaturesQuery() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: ['features', userId],
    queryFn: async () => (await api.get('/features')).data as FeaturesResponse,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useFeatures(): FeatureFlags {
  const { data } = useFeaturesQuery();
  return { ...DEFAULT_FLAGS, ...(data?.features ?? {}) };
}

export function useAvailability() {
  const { data, isSuccess } = useFeaturesQuery();
  return useMemo(() => {
    const a = data?.availability;
    const feature = (key: AvailabilityFeature): Availability => a?.features[key] ?? OPEN;
    const currency = (code?: string | null): Availability => (code ? a?.currencies[code.toUpperCase()] ?? OPEN : OPEN);
    const pair = (x?: string | null, y?: string | null): Availability => {
      if (!x || !y) return OPEN;
      const [u, v] = [x.toUpperCase(), y.toUpperCase()];
      return a?.pairs[`${u}/${v}`] ?? a?.pairs[`${v}/${u}`] ?? OPEN;
    };
    /** True when the currency can be picked for new activity (optionally against `other`). */
    const canUse = (code?: string | null, other?: string | null) =>
      currency(code).state === 'AVAILABLE' && (!other || pair(code, other).state === 'AVAILABLE');
    /** State of the feature behind a menu entry (hide HIDDEN entries, mark LOCKED ones). */
    const forHref = (href: string): Availability => {
      const f = featureForMenu(href);
      return f ? feature(f) : OPEN;
    };
    return { loaded: isSuccess, feature, currency, pair, canUse, forHref };
  }, [data, isSuccess]);
}

/** Feature behind each menu destination, including screens that also hold history. */
const MENU_FEATURES: Array<[RegExp, AvailabilityFeature]> = [
  [/^\/send/, 'transfers'],
  [/^\/pay/, 'pay'],
  [/^\/topup/, 'deposits'],
  [/^\/withdraw/, 'withdrawals'],
  [/^\/(exchange|transfer)/, 'fx'],
  [/^\/(buy|sell)/, 'crypto_trading'],
  [/^\/remit/, 'remittance'],
  [/^\/recurring/, 'recurring_buys'],
  [/^\/p2p/, 'p2p'],
  [/^\/lydt/, 'lydt'],
  [/^\/budgets/, 'budgets'],
  [/^\/cards/, 'cards'],
  [/^\/referral/, 'referrals'],
  [/^\/business\/bulk-pay/, 'business_payouts'],
];

export function featureForMenu(href: string): AvailabilityFeature | null {
  for (const [re, f] of MENU_FEATURES) if (re.test(href)) return f;
  return null;
}

/**
 * Screens that only start new activity, and the feature behind each. The
 * root layout sends a locked or hidden one to /unavailable. Screens that also
 * hold history or open items (P2P, remittances, recurring buys, LYDT, cards)
 * are not listed — they show their own paused notice — so activity already
 * in motion can always finish.
 */
const ROUTE_FEATURES: Array<[RegExp, AvailabilityFeature]> = [
  [/^\/send$/, 'transfers'],
  [/^\/pay(\/.*)?$/, 'pay'],
  [/^\/topup$/, 'deposits'],
  [/^\/withdraw$/, 'withdrawals'],
  [/^\/(exchange|transfer)$/, 'fx'],
  [/^\/(buy|sell)$/, 'crypto_trading'],
  [/^\/remit\/new$/, 'remittance'],
  [/^\/budgets\/new$/, 'budgets'],
  [/^\/referral$/, 'referrals'],
  [/^\/business\/bulk-pay$/, 'business_payouts'],
];
export function featureForRoute(path: string): AvailabilityFeature | null {
  for (const [re, f] of ROUTE_FEATURES) if (re.test(path)) return f;
  return null;
}
