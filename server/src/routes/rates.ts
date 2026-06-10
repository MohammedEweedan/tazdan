import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { FULUS_CURRENCIES } from '../services/exchange/fulus.service';

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

/* ── Parallel-market rate history (public, cached) ─────────────────────
 *
 * GET /api/rates/history?symbol=USD&days=30
 *
 * Serves bucketed OHLC of the Fulus parallel-market rate vs LYD from the
 * FxRateTick table (webhook ticks + 5-min sampler + boot backfill).
 *   symbol=LYD or USD → pair USD/LYD   (the dinar chart)
 *   symbol=EUR        → pair EUR/LYD   etc.
 *
 * Bucket width scales with the window so the response stays ≤ ~100 points
 * — small enough for a phone, granular enough for candles.
 */
const HISTORY_CACHE = new Map<string, { at: number; body: unknown }>();
const HISTORY_TTL_MS = 60 * 1000;

function bucketSeconds(days: number): number {
  if (days <= 2)  return 30 * 60;        // 30 min
  if (days <= 7)  return 2 * 3600;       // 2 h
  if (days <= 31) return 8 * 3600;       // 8 h
  if (days <= 92) return 24 * 3600;      // 1 d
  return 7 * 24 * 3600;                  // 1 w
}

router.get('/history', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.query.symbol ?? 'USD').toUpperCase();
    const days = Math.min(365, Math.max(1, Number.parseInt(String(req.query.days ?? '30'), 10) || 30));

    // LYD's own page charts the dinar against the dollar; every other
    // Fulus currency charts itself against the dinar.
    const base = symbol === 'LYD' ? 'USD' : symbol;
    if (!(FULUS_CURRENCIES as readonly string[]).includes(base)) {
      return res.status(400).json({ error: `No parallel-market history for ${symbol}` });
    }
    const pair = `${base}/LYD`;

    const cacheKey = `${pair}:${days}`;
    const hit = HISTORY_CACHE.get(cacheKey);
    if (hit && Date.now() - hit.at < HISTORY_TTL_MS) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json(hit.body);
    }

    const since = new Date(Date.now() - days * 86_400_000);
    const bucketSec = bucketSeconds(days);
    const rows = await prisma.$queryRaw<Array<{
      bucket: number; open: string; high: string; low: string; close: string;
    }>>`
      SELECT
        floor(extract(epoch FROM "createdAt") / ${bucketSec}) * ${bucketSec} AS bucket,
        (array_agg(price ORDER BY "createdAt" ASC))[1]  AS open,
        MAX(price)                                       AS high,
        MIN(price)                                       AS low,
        (array_agg(price ORDER BY "createdAt" DESC))[1] AS close
      FROM "FxRateTick"
      WHERE pair = ${pair} AND "createdAt" >= ${since}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const points = rows.map((r) => ({
      t: Number(r.bucket) * 1000,
      o: Number(r.open),
      h: Number(r.high),
      l: Number(r.low),
      c: Number(r.close),
    })).filter((p) => Number.isFinite(p.c) && p.c > 0);

    const body = { pair, base, quote: 'LYD', source: 'parallel_market', days, points };
    HISTORY_CACHE.set(cacheKey, { at: Date.now(), body });
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json(body);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load rate history', detail: err?.message });
  }
});

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
