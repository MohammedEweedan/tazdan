import { useQuery } from "@tanstack/react-query";

const BASE = 'https://api.coingecko.com/api/v3';
type Range = '1H' | '24H' | '7D' | '30D';

function downsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

export interface ChartPoint { price: number; timestamp: number }
export interface Candle { timestamp: number; open: number; high: number; low: number; close: number }

export function useOHLCCandles(coinId: string | undefined, range: Range) {
  // CoinGecko's /ohlc endpoint accepts days = 1 | 7 | 14 | 30 | … and picks
  // its own candle granularity; map our ranges onto the nearest supported value.
  const DAYS: Record<Range, number> = { '1H': 1, '24H': 1, '7D': 7, '30D': 30 };
  const days = DAYS[range];
  return useQuery({
    queryKey: ['ohlc-candles', coinId, range],
    enabled: !!coinId,
    queryFn: async () => {
      const res = await fetch(
        `${BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
      );
      if (!res.ok) throw new Error(`ohlc ${res.status}`);
      const json: [number, number, number, number, number][] = await res.json();
      const candles: Candle[] = (json ?? []).map(([t, o, h, l, c]) => ({
        timestamp: t, open: o, high: h, low: l, close: c,
      }));
      const sliced = range === '1H' ? candles.slice(-12) : candles;
      return downsample(sliced, 60);
    },
    staleTime: range === '1H' ? 30_000 : 5 * 60_000,
  });
}

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