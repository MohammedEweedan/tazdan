/**
 * Server feature switches (GET /api/features). Surfaces that are switched off
 * server-side show a "paused" notice instead of controls that would fail.
 *
 * Until flags load, new activity is hidden. Read/history/recovery screens
 * stay accessible even when a feature is paused.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface FeatureFlags {
  p2p: boolean;
  cards: boolean;
  altTrading: boolean;
  blockchain: boolean;
  cryptoTrading: boolean;
  remittance: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = { p2p: false, cards: false, altTrading: false, blockchain: false, cryptoTrading: false, remittance: false };

export function useFeatures(): FeatureFlags {
  const { data } = useQuery({
    queryKey: ['features'],
    queryFn: async () => (await api.get('/features')).data.features as Partial<FeatureFlags>,
    staleTime: 5 * 60_000,
  });
  return { ...DEFAULT_FLAGS, ...(data ?? {}) };
}
