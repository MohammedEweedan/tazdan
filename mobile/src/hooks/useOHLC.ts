import { useQuery } from "@tanstack/react-query";

const BASE = 'https://api.coingecko.com/api/v3';
export type Range = '1H' | '24H' | '7D' | '30D' | '1Y' | 'ALL';

// CoinGecko /ohlc + /market_chart accept days = 1|7|14|30|90|180|365|max.
// ALL → 'max' returns the asset's full listing history.
const DAYS: Record<Range, number | 'max'> = {
  '1H': 1, '24H': 1, '7D': 7, '30D': 30, '1Y': 365, 'ALL': 'max',
};

function downsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

// RN's runtime has no AbortSignal.timeout; build the controller manually so a
// slow/huge `days=max` response fails fast instead of hanging the chart.
function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

export interface ChartPoint { price: number; timestamp: number }
export interface Candle { timestamp: number; open: number; high: number; low: number; close: number }

// Long ranges get more sample points so multi-year history keeps resolution.
const SAMPLE_POINTS: Record<Range, number> = {
  '1H': 60, '24H': 60, '7D': 60, '30D': 60, '1Y': 120, 'ALL': 150,
};

export function useOHLCCandles(coinId: string | undefined, range: Range) {
  const days = DAYS[range];
  return useQuery({
    queryKey: ['ohlc-candles', coinId, range],
    enabled: !!coinId,
    queryFn: async () => {
      const res = await fetchWithTimeout(
        `${BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
        12_000,
      );
      if (!res.ok) throw new Error(`ohlc ${res.status}`);
      const json: [number, number, number, number, number][] = await res.json();
      const candles: Candle[] = (json ?? []).map(([t, o, h, l, c]) => ({
        timestamp: t, open: o, high: h, low: l, close: c,
      }));
      const sliced = range === '1H' ? candles.slice(-12) : candles;
      return downsample(sliced, SAMPLE_POINTS[range]);
    },
    staleTime: range === '1H' ? 30_000 : 5 * 60_000,
    retry: 1,
  });
}

export function useOHLC(coinId: string | undefined, range: Range) {
  const days = DAYS[range];
  return useQuery({
    queryKey: ['ohlc', coinId, range],
    enabled: !!coinId,
    queryFn: async () => {
      const res = await fetchWithTimeout(
        `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
        12_000,
      );
      if (!res.ok) throw new Error(`market_chart ${res.status}`);
      const json = await res.json();
      const pts: ChartPoint[] = (json.prices ?? []).map(([t, p]: [number, number]) => ({ timestamp: t, price: p }));
      const sliced = range === '1H' ? pts.slice(-12) : pts;
      return downsample(sliced, SAMPLE_POINTS[range]);
    },
    staleTime: range === '1H' ? 30_000 : 5 * 60_000,
    retry: 1,
  });
}