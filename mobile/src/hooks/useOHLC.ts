import { useQuery } from "@tanstack/react-query";

const BASE = 'https://api.coingecko.com/api/v3';
type Range = '1H' | '24H' | '7D' | '30D';

function downsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

// hooks/useOHLC.ts
export function useOHLC(coinId: string | undefined, range: Range) {
  const DAYS: Record<Range, number> = { '1H': 1, '24H': 1, '7D': 7, '30D': 30 };
  const days = DAYS[range];
  return useQuery({
    queryKey: ['ohlc', coinId, range],
    // Don't fetch for fiat tickers (no CoinGecko id). Caller should
    // hide the chart instead of showing the wrong asset's prices.
    enabled: !!coinId,
    queryFn: async () => {
      const res = await fetch(
        `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      );
      if (!res.ok) throw new Error(`market_chart ${res.status}`);
      const json = await res.json();
      const prices: number[] = (json.prices ?? []).map(([, p]: [number, number]) => p);
      // 1H = last 60 minutes ≈ last 12 5-minute candles from a 1-day fetch.
      const sliced = range === '1H' ? prices.slice(-12) : prices;
      return downsample(sliced, 60);
    },
    staleTime: range === '1H' ? 30_000 : 5 * 60_000,
  });
}