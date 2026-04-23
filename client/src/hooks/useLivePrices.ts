// hooks/useLivePrices.ts
'use client';

import { useEffect, useState } from 'react';

export interface CoinPrice {
  id: string;
  symbol: string;
  label: string;
  price: number;
  change24h: number;
  prev: number; // for flash animation
}

const DEFAULT_COINS = [
  { id: 'bitcoin',   symbol: 'BTC', label: 'BTC/USDT' },
  { id: 'ethereum',  symbol: 'ETH', label: 'ETH/USDT' },
  { id: 'tether',    symbol: 'USDT',label: 'USDT/USD' },
  { id: 'solana',    symbol: 'SOL', label: 'SOL/USDT' },
];

export function useLivePrices(customIds?: string[]) {
  const [prices, setPrices] = useState<CoinPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const coinIds = customIds || DEFAULT_COINS.map(c => c.id);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true`;
        const res = await fetch(url);
        const data = await res.json();
        
        setPrices(prev =>
          coinIds.map(id => {
            const symbol = id.toUpperCase(); // Simplified
            return {
              id: id,
              symbol: symbol,
              label: `${symbol}/USDT`,
              price: data[id]?.usd ?? 0,
              change24h: data[id]?.usd_24h_change ?? 0,
              prev: prev.find(p => p.id === id)?.price ?? data[id]?.usd ?? 0,
            };
          })
        );
        setLoading(false);
      } catch {
        // silently keep stale data
      }
    };

    fetchPrices();
    const id = setInterval(fetchPrices, 30_000);
    return () => clearInterval(id);
  }, [JSON.stringify(coinIds)]);

  return { prices, loading };
}