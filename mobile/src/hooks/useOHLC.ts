import { useQuery } from "@tanstack/react-query";

const BASE = 'https://api.coingecko.com/api/v3';
type Range = '1H' | '24H' | '7D' | '30D';

function downsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

export interface ChartPoint { price: number; timestamp: number }

export function useOHLC(coinId: string | undefined, range: Range) {
  const DAYS: Record<Range, number> = { '1H': 1, '24H': 1, '7D': 7, '30D': 30 };
  const days = DAYS[range];
  return useQuery({
    queryKey: ['ohlc', coinId, range],
    enabled: !!coinId,
    queryFn: async () => {
      const res = await fetch(
        `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      );
      if (!res.ok) throw new Error(`market_chart ${res.status}`);
      const json = await res.json();
      const pts: ChartPoint[] = (json.prices ?? []).map(([t, p]: [number, number]) => ({ timestamp: t, price: p }));
      const sliced = range === '1H' ? pts.slice(-12) : pts;
      return downsample(sliced, 60);
    },
    staleTime: range === '1H' ? 30_000 : 5 * 60_000,
  });
}