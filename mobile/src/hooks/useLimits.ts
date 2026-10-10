/**
 * The customer's KYC limits (GET /users/me/limits): what they can do right
 * now per action, when each period resets (dd/mm/yyyy, Tripoli time) and what
 * the next verification level allows. Money screens read this so a customer
 * learns about a limit before confirming — never after a security code.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type LimitedAction = 'SEND' | 'WITHDRAW' | 'ONRAMP_BUY' | 'OFFRAMP_SELL';

export interface LimitStatus {
  action: LimitedAction;
  tier: string;
  blocked: boolean;
  perTxUsd: number;
  daily: { limitUsd: number; usedUsd: number; remainingUsd: number; resetsAt: string; resetsOn: string };
  monthly: { limitUsd: number; usedUsd: number; remainingUsd: number; resetsAt: string; resetsOn: string };
  maxNowUsd: number;
  availableAgainAt: string | null;
  availableAgainOn: string | null;
  nextTier: { tier: string; perTxUsd: number; dailyUsd: number; monthlyUsd: number } | null;
}

export const LIMITS_QUERY_KEY = ['me-limits'] as const;

export function useLimits() {
  return useQuery({
    queryKey: LIMITS_QUERY_KEY,
    queryFn: async () => (await api.get<{ kycStatus: string; tier: string; timezone: string; actions: Record<LimitedAction, LimitStatus> }>('/users/me/limits')).data,
    staleTime: 30_000,
  });
}

export type LimitState =
  | { kind: 'ok' }
  | { kind: 'verify' }
  | { kind: 'used'; period: 'daily' | 'monthly'; on: string; next: LimitStatus['nextTier'] }
  | { kind: 'over'; maxUsd: number; period: 'daily' | 'monthly' | 'perTx'; on: string | null; next: LimitStatus['nextTier'] };

/** Where an amount (USD, optional) stands against one action's limits. */
export function limitState(st: LimitStatus | undefined, amountUsd?: number | null): LimitState {
  if (!st) return { kind: 'ok' };
  if (st.blocked) return { kind: 'verify' };
  if (st.maxNowUsd < 0.01) {
    const monthly = st.monthly.remainingUsd < 0.01;
    return { kind: 'used', period: monthly ? 'monthly' : 'daily', on: st.availableAgainOn ?? (monthly ? st.monthly.resetsOn : st.daily.resetsOn), next: st.nextTier };
  }
  if (amountUsd != null && amountUsd > st.maxNowUsd + 0.005) {
    const binding = st.maxNowUsd >= st.perTxUsd ? 'perTx' : st.monthly.remainingUsd <= st.daily.remainingUsd ? 'monthly' : 'daily';
    return { kind: 'over', maxUsd: st.maxNowUsd, period: binding, on: binding === 'perTx' ? null : binding === 'monthly' ? st.monthly.resetsOn : st.daily.resetsOn, next: st.nextTier };
  }
  return { kind: 'ok' };
}

/** Is a limit stopping this amount right now? (Disables the confirm control.) */
export function useLimitBlock(action: LimitedAction, amountUsd?: number | null): { state: LimitState; blocked: boolean } {
  const { data } = useLimits();
  const state = limitState(data?.actions?.[action], amountUsd);
  return { state, blocked: state.kind !== 'ok' };
}
