import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { FULUS_CURRENCIES } from '../services/exchange/fulus.service';

const router = Router();

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RatesCache | null = null;
const CACHE_TTL_MS = 30_000; // Match the app refresh interval.

export function invalidateRatesCache() {
  cache = null;
  liveCache = null;
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
    return res.status(500).json({ error: 'Failed to load rate history' });
  }
});

/* ── Live fiat values (public, cached 30 s) ───────────────────────────
 *
 * GET /api/rates/live
 *
 * For each fiat currency: its value in US dollars now, the change over 24 h
 * and hourly points for a sparkline — so fiat rows show a live rate the way
 * crypto rows do.
 *   LYD     the parallel-market rate from the Fulus ticks (USD/LYD), i.e.
 *           what customers actually trade at.
 *   others  the international rate (same source as /rates, which the app
 *           uses for display), with change and points derived from the
 *           X/LYD and USD/LYD ticks only when that derivation agrees with the
 *           international rate within 3%. Mixed or stale feeds show the rate
 *           without a change rather than a wrong one.
 */
let liveCache: { at: number; body: unknown } | null = null;
router.get('/live', async (_req: Request, res: Response) => {
  try {
    if (liveCache && Date.now() - liveCache.at < 30_000) return res.json(liveCache.body);
    const since = new Date(Date.now() - 26 * 3600_000);
    const rows = await prisma.$queryRaw<Array<{ pair: string; hour: number; close: string }>>`
      SELECT pair, floor(extract(epoch FROM "createdAt") / 3600) * 3600 AS hour,
             (array_agg(price ORDER BY "createdAt" DESC))[1] AS close
      FROM "FxRateTick" WHERE "createdAt" >= ${since} AND pair LIKE '%/LYD'
      GROUP BY 1, 2 ORDER BY 2 ASC
    `;
    const latest = await prisma.$queryRaw<Array<{ pair: string; price: string; at: Date }>>`
      SELECT DISTINCT ON (pair) pair, price::text, "createdAt" AS at FROM "FxRateTick"
      WHERE pair LIKE '%/LYD' AND "createdAt" >= ${since} ORDER BY pair, "createdAt" DESC
    `;
    const hours = [...new Set(rows.map((r) => Number(r.hour)))].sort((a, b) => a - b);
    const series = new Map<string, number[]>();
    for (const pair of new Set(rows.map((r) => r.pair))) {
      const byHour = new Map(rows.filter((r) => r.pair === pair).map((r) => [Number(r.hour), Number(r.close)]));
      let last = NaN;
      series.set(pair, hours.map((h) => { const v = byHour.get(h); if (v && v > 0) last = v; return last; }));
    }
    const now = new Map(latest.map((l) => [l.pair, { price: Number(l.price), at: l.at }]));
    const usdLyd = series.get('USD/LYD') ?? [];
    const { getFulusLydRate, fulusCachedRates } = await import('../services/exchange/fulus.service');
    const currentFulus = await getFulusLydRate('USD');
    const fulusAge = fulusCachedRates().USD?.ageMs ?? 0;
    const usdLydNow = currentFulus != null ? { price: currentFulus, at: new Date(Date.now() - fulusAge) } : undefined;

    // International rates (units per USD), as served by GET /api/rates.
    let intl: Record<string, number> = cache?.rates ?? {};
    if (!Object.keys(intl).length) {
      try {
        const r = await fetch('https://open.er-api.com/v6/latest/USD');
        if (r.ok) intl = ((await r.json()) as { rates: Record<string, number> }).rates ?? {};
      } catch { /* rate-only rows below */ }
    }

    type Live = { usd: number; perUsd: number; change24hPct: number | null; points: number[]; source: string; asOf: string | null };
    const currencies: Record<string, Live> = {};
    const shape = (nowValue: number, pts: number[], source: string, asOf: Date | null): Live => {
      const clean = pts.filter((v) => Number.isFinite(v) && v > 0).slice(-25);
      const dayAgo = clean.length >= 2 ? clean[0] : NaN;
      return {
        usd: nowValue, perUsd: 1 / nowValue, source, asOf: asOf ? asOf.toISOString() : null,
        change24hPct: Number.isFinite(dayAgo) && dayAgo > 0 ? ((nowValue / dayAgo) - 1) * 100 : null,
        points: clean.length >= 2 ? [...clean.slice(0, -1), nowValue] : [],
      };
    };

    if (usdLydNow && usdLydNow.price > 0) {
      currencies.LYD = shape(1 / usdLydNow.price, usdLyd.map((v) => 1 / v), 'fulus', usdLydNow.at);
    }
    for (const code of ['EUR', 'GBP', 'TRY', 'EGP', 'TND', 'SAR', 'AED', 'CHF', 'CAD', 'JPY', 'AUD']) {
      const perUsd = intl[code];
      if (!perUsd || perUsd <= 0) continue;
      const usd = 1 / perUsd;
      const pair = `${code}/LYD`;
      const xNow = now.get(pair);
      const derived = xNow && usdLydNow ? xNow.price / usdLydNow.price : NaN;
      const consistent = Number.isFinite(derived) && Math.abs(derived / usd - 1) <= 0.03
        && xNow && usdLydNow && Math.abs(xNow.at.getTime() - usdLydNow.at.getTime()) < 10 * 60_000;
      const xs = series.get(pair) ?? [];
      currencies[code] = consistent
        ? shape(usd, xs.map((v, i) => v / usdLyd[i]), 'international', xNow!.at)
        : { usd, perUsd, change24hPct: null, points: [], source: 'international', asOf: null };
    }

    const body = { base: 'USD', asOf: new Date().toISOString(), currencies };
    liveCache = { at: Date.now(), body };
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.json(body);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load live rates' });
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
    delete rates.LYD; // Never substitute the official peg for the Fulus reference.

    // open.er-api returns Libya's official peg. For LYD we must publish the
    // platform's authoritative parallel-market rate instead (Fulus-first,
    // scraper fallback, spread/skew applied by the FX provider).
    try {
      const { getRate } = await import('../services/exchange/fxRateProvider.service');
      const usdLyd = await getRate('USD', 'LYD');
      const mid = (Number(usdLyd.buyPrice) + Number(usdLyd.sellPrice)) / 2;
      if (Number.isFinite(mid) && mid > 0) rates.LYD = mid;
    } catch {
      // Leave LYD unavailable when Fulus has no rate. Other currencies remain usable.
    }

    cache = { rates, fetchedAt: now };
    return res.json({ rates: cache.rates, cachedAt: new Date(now).toISOString() });
  } catch (err: any) {
    // If we have stale cache, return it rather than failing
    if (cache) {
      return res.json({ rates: cache.rates, cachedAt: new Date(cache.fetchedAt).toISOString(), stale: true });
    }
    return res.status(502).json({ error: 'Failed to fetch exchange rates' });
  }
});

export default router;
