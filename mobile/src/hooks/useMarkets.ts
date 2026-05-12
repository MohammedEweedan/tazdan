// hooks/useMarkets.ts
import { Currency } from "@/types";
import { useQuery } from "@tanstack/react-query";

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const BINANCE_BASE = 'https://api.binance.com/api/v3';

export interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency: number;
  price_change_percentage_7d_in_currency: number;
  price_change_percentage_30d_in_currency: number;
  total_volume: number;
  market_cap: number;
  sparkline_in_7d: { price: number[] };
  circulating_supply: number;
  ath: number;
}

// Fallback price data structure (simplified from CoinGecko)
interface FallbackMarket {
  id: string;
  current_price: number;
  price_change_percentage_24h: number;
  sparkline_in_7d: { price: number[] } | null;
}

// Fetch from CoinGecko (primary)
async function fetchFromCoinGecko(): Promise<CoinGeckoMarket[]> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${COIN_IDS.join(',')}&sparkline=true&price_change_percentage=1h,24h,7d,30d`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) throw new Error('CoinGecko fetch failed');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('CoinGecko returned invalid data');
    return data;
  } catch (e) {
    console.warn('CoinGecko fetch failed, trying fallback:', e);
    return [];
  }
}

// Fetch from Binance (fallback - simpler data, we enrich it)
async function fetchFromBinance(): Promise<FallbackMarket[]> {
  try {
    const symbols = COIN_IDS.map(id => {
      const sym = ID_TO_SYM[id];
      return sym ? `${sym.toLowerCase()}usdt` : null;
    }).filter(Boolean) as string[];

    const res = await fetch(
      `${BINANCE_BASE}/ticker/24hr?symbols=${symbols.join(',')}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error('Binance fetch failed');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Binance returned invalid data');

    return data.map((item: any) => {
      const sym = item.symbol.replace('USDT', '').toUpperCase();
      const id = Object.entries(ID_TO_SYM).find(([_, v]) => v === sym)?.[0];
      return {
        id: id || sym.toLowerCase(),
        current_price: Number(item.lastPrice),
        price_change_percentage_24h: Number(item.priceChangePercent),
        sparkline_in_7d: null,
      };
    });
  } catch (e) {
    console.warn('Binance fetch failed:', e);
    return [];
  }
}

function enrichWithSparkline(data: FallbackMarket[]): CoinGeckoMarket[] {
  return data.map(m => ({
    ...m,
    symbol: ID_TO_SYM[m.id]?.toLowerCase() || '',
    name: m.id.charAt(0).toUpperCase() + m.id.slice(1),
    price_change_percentage_1h_in_currency: 0,
    price_change_percentage_7d_in_currency: 0,
    price_change_percentage_30d_in_currency: 0,
    total_volume: 0,
    market_cap: 0,
    circulating_supply: 0,
    ath: 0,
    sparkline_in_7d: m.sparkline_in_7d || {
      price: Array(168).fill(0).map((_, i) => {
        const change = m.price_change_percentage_24h / 100;
        const base = m.current_price;
        const trend = (i / 168) * change;
        return base * (1 - change + trend);
      }),
    },
  }));
}

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      let data = await fetchFromCoinGecko();
      if (data && data.length > 0) return data;

      const fallback = await fetchFromBinance();
      if (fallback && fallback.length > 0) {
        return enrichWithSparkline(fallback);
      }

      console.error('All price sources failed');
      return [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });
}

export const COIN_IDS = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
  'cardano', 'dogecoin', 'matic-network', 'polkadot', 'avalanche-2',
  'tether',
];
export const ID_TO_SYM: Record<string, Currency> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  binancecoin: 'BNB',
  ripple: 'XRP',
  cardano: 'ADA',
  dogecoin: 'DOGE',
  'matic-network': 'MATIC',
  polkadot: 'DOT',
  'avalanche-2': 'AVAX',
  tether: 'USDT',
};
