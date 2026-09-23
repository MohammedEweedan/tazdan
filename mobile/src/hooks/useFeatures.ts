/**
 * Server feature switches (GET /api/features). Surfaces that are switched off
 * server-side show a "paused" notice instead of controls that would fail.
 *
 * Until the flags load (or if the request fails) everything reads as on — the
 * server still refuses switched-off actions, so this only affects what the UI
 * offers.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface FeatureFlags {
  p2p: boolean;
  cards: boolean;
  altTrading: boolean;
}

const ALL_ON: FeatureFlags = { p2p: true, cards: true, altTrading: true };

export function useFeatures(): FeatureFlags {
  const { data } = useQuery({
    queryKey: ['features'],
    queryFn: async () => (await api.get('/features')).data.features as Partial<FeatureFlags>,
    staleTime: 5 * 60_000,
  });
  return { ...ALL_ON, ...(data ?? {}) };
}
