// hooks/useMarkets.ts
import { Currency } from "@/types";
import { useQuery } from "@tanstack/react-query";

const BASE = 'https://api.coingecko.com/api/v3';

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

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const res = await fetch(
        `${BASE}/coins/markets?vs_currency=usd&ids=${COIN_IDS.join(',')}&sparkline=true&price_change_percentage=1h,24h,7d,30d`,
      );
      return res.json() as Promise<CoinGeckoMarket[]>;
    },
    refetchInterval: 60_000, // re-poll every 60s (free tier rate limit)
    staleTime: 30_000,
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