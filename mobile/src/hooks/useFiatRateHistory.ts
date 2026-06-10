/**
 * Parallel-market rate history for fiat asset pages.
 *
 * Backed by GET /api/rates/history — bucketed OHLC of the Fulus
 * parallel-market feed (plus the platform sampler) stored in FxRateTick.
 * The LYD page charts USD/LYD ("what is the dollar at?"); every other
 * Fulus currency charts itself against the dinar (EUR/LYD, …).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type FiatRange = '24H' | '7D' | '1M' | '3M' | '1Y';

export const FIAT_RANGE_DAYS: Record<FiatRange, number> = {
  '24H': 1,
  '7D': 7,
  '1M': 30,
  '3M': 92,
  '1Y': 365,
};

export interface FiatOhlcPoint { t: number; o: number; h: number; l: number; c: number }

export interface FiatRateHistory {
  pair: string;          // e.g. "USD/LYD"
  base: string;          // e.g. "USD"
  quote: string;         // "LYD"
  source: string;        // "parallel_market"
  days: number;
  points: FiatOhlcPoint[];
}

/** Currencies the Fulus feed covers — matches the server whitelist. */
export const FULUS_CHART_CURRENCIES = new Set([
  'LYD', 'USD', 'EUR', 'GBP', 'TRY', 'EGP', 'TND', 'SAR', 'AED',
]);

export function useFiatRateHistory(symbol: string, range: FiatRange, enabled = true) {
  return useQuery({
    queryKey: ['fiat-rate-history', symbol, range],
    queryFn: async () => {
      const { data } = await api.get<FiatRateHistory>('/rates/history', {
        params: { symbol, days: FIAT_RANGE_DAYS[range] },
      });
      return data;
    },
    enabled: enabled && FULUS_CHART_CURRENCIES.has(symbol),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
