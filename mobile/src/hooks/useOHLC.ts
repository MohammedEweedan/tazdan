import { useQuery } from "@tanstack/react-query";

const BASE = 'https://api.coingecko.com/api/v3';
type Range = '1H' | '24H' | '7D' | '30D';

function downsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

// hooks/useOHLC.ts
export function useOHLC(coinId: string, range: Range) {
  const DAYS: Record<Range, number> = { '1H': 1, '24H': 1, '7D': 7, '30D': 30 };
  const days = DAYS[range];
  return useQuery({
    queryKey: ['ohlc', coinId, range],
    queryFn: async () => {
      // /market_chart returns granular price arrays
      const res = await fetch(
        `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      );
      const json = await res.json();
      // json.prices = [[timestamp, price], ...]
      // Downsample to ~60 pts for performance
      return downsample(json.prices.map(([, p]: [number, number]) => p), 60);
    },
    staleTime: range === '1H' ? 30_000 : 5 * 60_000,
  });
}