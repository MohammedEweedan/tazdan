import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBackendTickers } from './useBackendTickers';
import { api } from '@/lib/api';

export function useForexRates() {
  return useQuery({
    queryKey: ['forex-rates'],
    queryFn: async () => {
      const { data } = await api.get('/rates');
      return (data.rates ?? {}) as Record<string, number>;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: 5000,
  });
}

const USD_LIKE = new Set(['USD', 'USDT', 'USDC']);

/**
 * USD value of an amount. `/rates` is units of each currency PER US dollar
 * (LYD ≈ 7.4), so fiat divides by the rate; crypto uses its live USD price.
 * Returns null when no price is known (callers must not guess).
 */
export function usdValue(amount: number, currency: string, rates?: Record<string, number>, cryptoPriceUsd?: number): number | null {
  const cur = currency.toUpperCase().replace(/_(ERC20|TRC20)$/, '');
  if (USD_LIKE.has(cur)) return amount;
  const perUsd = rates?.[cur];
  if (perUsd && perUsd > 0) return amount / perUsd;
  if (cryptoPriceUsd && cryptoPriceUsd > 0) return amount * cryptoPriceUsd;
  return null;
}

/** `usdValue` bound to the live rates and crypto prices. */
export function useUsdValue() {
  const { data: rates } = useForexRates();
  const { data: tickers } = useBackendTickers();
  return useCallback((amount: number, currency: string) => {
    const base = currency.toUpperCase().replace(/_(ERC20|TRC20)$/, '');
    return usdValue(amount, currency, rates, tickers?.find((t) => t.base === base)?.price);
  }, [rates, tickers]);
}

export interface LiveFiat { usd: number; perUsd: number; change24hPct: number | null; points: number[]; source: string; asOf: string | null }

/**
 * Live fiat values (GET /rates/live): each currency's value in USD now, 24 h
 * change and hourly points. LYD uses the parallel-market feed. Refreshed every
 * 30 s while a screen shows it, so fiat rows move like crypto rows.
 */
export function useLiveFiatRates() {
  return useQuery({
    queryKey: ['rates-live'],
    queryFn: async () => (await api.get<{ currencies: Record<string, LiveFiat> }>('/rates/live')).data.currencies,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
