/**
 * useFxRate — read the platform's authoritative buy/sell quote for any
 * fiat pair. Wraps GET /api/exchange/fx/:base/:quote which resolves
 * server-side in this order:
 *
 *   1. Admin override   (tazdan dashboard manually set)
 *   2. External provider (exchangerate.host / openexchangerates)
 *   3. Stale fallback   (last good cached value)
 *
 * For USD/LYD this surfaces both the "official" rate (admin) and the
 * platform's actual quote in one call — single source of truth for
 * every place that needs a non-Binance FX rate (deposit modal,
 * statement headers, P2P listings, the rate ticker on Home).
 *
 *   const { data } = useFxRate('USD', 'LYD');
 *   // data?.buyPrice / data?.sellPrice / data?.source / data?.fetchedAt
 *
 * Cache is 60s — matches the server's TTL so we don't poll faster
 * than the server refreshes from its provider.
 */
import { useQuery } from '@tanstack/react-query';
import { exchangeService } from '@/services';

export interface FxRate {
  buyPrice: string;
  sellPrice: string;
  source: string;
  fetchedAt: string;
}

export function useFxRate(base: string, quote: string, enabled = true) {
  return useQuery<FxRate>({
    queryKey: ['fx-rate', base, quote],
    queryFn: () => exchangeService.fxRate(base, quote),
    enabled: enabled && Boolean(base) && Boolean(quote),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,  // refresh every 5 min when screen is mounted
    refetchOnWindowFocus: false,
  });
}

/**
 * USD/LYD shortcut — the most common pair in MENA flows. Returns
 * both directions and a useful `mid` for display.
 */
export function useLydRate(enabled = true) {
  const q = useFxRate('USD', 'LYD', enabled);
  const mid = q.data
    ? (Number(q.data.buyPrice) + Number(q.data.sellPrice)) / 2
    : null;
  return { ...q, mid };
}
