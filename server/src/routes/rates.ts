import { Router, Request, Response } from 'express';

const router = Router();

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RatesCache | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function invalidateRatesCache() {
  cache = null;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json({ rates: cache.rates, cachedAt: new Date(cache.fetchedAt).toISOString() });
    }

    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error(`Upstream error: ${response.status}`);
    const data = await response.json() as { rates: Record<string, number> };

    const rates = { ...(data.rates ?? {}) };

    // open.er-api returns Libya's official peg. For LYD we must publish the
    // platform's authoritative parallel-market rate instead (Fulus-first,
    // scraper fallback, spread/skew applied by the FX provider).
    try {
      const { getRate } = await import('../services/exchange/fxRateProvider.service');
      const usdLyd = await getRate('USD', 'LYD');
      const mid = (Number(usdLyd.buyPrice) + Number(usdLyd.sellPrice)) / 2;
      if (Number.isFinite(mid) && mid > 0) rates.LYD = mid;
    } catch {
      // Keep upstream map if the platform FX provider is unavailable.
    }

    cache = { rates, fetchedAt: now };
    return res.json({ rates: cache.rates, cachedAt: new Date(now).toISOString() });
  } catch (err: any) {
    // If we have stale cache, return it rather than failing
    if (cache) {
      return res.json({ rates: cache.rates, cachedAt: new Date(cache.fetchedAt).toISOString(), stale: true });
    }
    return res.status(502).json({ error: 'Failed to fetch exchange rates', detail: err?.message });
  }
});

export default router;
