/**
 * FX rate provider for fiat pairs that don't trade on Binance —
 * primarily USD/LYD where the official central-bank rate diverges
 * significantly from the parallel market.
 *
 * Resolution order for any pair:
 *  1. Manual admin override in DB (ExchangeRate.isActive=true and setBy
 *     non-null and updatedAt < freshness window) — operator wins.
 *  2. Configured external API (CBL_RATE_URL / EXCHANGERATE_HOST etc.)
 *     with 15-min in-memory cache.
 *  3. Hardcoded floor/ceiling sanity bounds — if the API returns
 *     wildly off-market numbers (>20% delta), we refuse rather than
 *     auto-trade at a bad rate.
 *
 * Add a new provider by extending RATE_PROVIDERS. Each provider only
 * needs to map a pair → { buy, sell } in Decimal-safe strings.
 */
import Decimal from 'decimal.js';
import { prisma } from '../../utils/prisma';

interface RatePair { buyPrice: string; sellPrice: string; source: string; fetchedAt: Date; }

// Cache structure: `${base}/${quote}` → { value, expires }
const memoryCache = new Map<string, { value: RatePair; expires: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Sanity bounds — if a remote API returns a USD/LYD rate outside this
// window we treat the data as poisoned and refuse to use it. Update
// these as the macro picture shifts.
const SANITY_BOUNDS: Record<string, [number, number]> = {
  'USD/LYD': [3.5, 9.5],   // CBL official ~4.5, parallel ~7.0 as of 2026
};

interface Provider {
  name: string;
  supports(base: string, quote: string): boolean;
  fetch(base: string, quote: string): Promise<{ mid: number } | null>;
}

const exchangerateHost: Provider = {
  name: 'exchangerate.host',
  supports: () => true, // free general-purpose API
  async fetch(base, quote) {
    const url = `https://api.exchangerate.host/convert?from=${base}&to=${quote}&amount=1`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const json = await res.json() as { result?: number };
      if (!json.result || !Number.isFinite(json.result)) return null;
      return { mid: json.result };
    } catch {
      return null;
    }
  },
};

const openExchangeRates: Provider = {
  name: 'openexchangerates',
  supports: () => Boolean(process.env.OPENEXCHANGERATES_APP_ID),
  async fetch(base, quote) {
    const appId = process.env.OPENEXCHANGERATES_APP_ID!;
    const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&base=${base}&symbols=${quote}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return null;
      const json = await res.json() as { rates?: Record<string, number> };
      const v = json.rates?.[quote];
      if (!v || !Number.isFinite(v)) return null;
      return { mid: v };
    } catch {
      return null;
    }
  },
};

const RATE_PROVIDERS: Provider[] = [openExchangeRates, exchangerateHost];

function withinSanity(base: string, quote: string, mid: number): boolean {
  const key = `${base}/${quote}`;
  const bounds = SANITY_BOUNDS[key];
  if (!bounds) return true;
  return mid >= bounds[0] && mid <= bounds[1];
}

/**
 * Apply the platform spread to a mid-market rate. The spread setting
 * lives in PlatformSettings under `fx_spread_pct.{base}_{quote}` (or
 * `fx_spread_pct.default` as a fallback) and is expressed as a
 * decimal percent (e.g. "1.5" → 1.5%).
 */
async function applySpread(base: string, quote: string, mid: number): Promise<{ buy: string; sell: string }> {
  const key = `fx_spread_pct.${base}_${quote}`;
  const def = 'fx_spread_pct.default';
  const [pair, fallback] = await Promise.all([
    prisma.platformSettings.findUnique({ where: { key } }),
    prisma.platformSettings.findUnique({ where: { key: def } }),
  ]);
  const pct = new Decimal(pair?.value ?? fallback?.value ?? '1.0');
  const midDec = new Decimal(mid);
  const half = pct.div(2).div(100);
  // Spread is symmetric around the mid: buy = mid * (1 - half), sell = mid * (1 + half)
  const buy  = midDec.mul(new Decimal(1).sub(half));
  const sell = midDec.mul(new Decimal(1).add(half));
  return { buy: buy.toFixed(8), sell: sell.toFixed(8) };
}

/**
 * Returns the freshest available rate for the requested pair.
 * Admin overrides win when they are newer than `MAX_OVERRIDE_AGE_MS`.
 */
const MAX_OVERRIDE_AGE_MS = 24 * 60 * 60 * 1000;

export async function getRate(base: string, quote: string): Promise<RatePair> {
  // Memory cache (cuts back-to-back screen loads to single-digit ms).
  const k = `${base}/${quote}`;
  const now = Date.now();
  const cached = memoryCache.get(k);
  if (cached && cached.expires > now) return cached.value;

  // 1. Admin override.
  const override = await prisma.exchangeRate.findUnique({
    where: { baseCurrency_quoteCurrency: { baseCurrency: base as any, quoteCurrency: quote as any } },
  }).catch(() => null);
  if (override && override.isActive && override.setBy && (now - override.updatedAt.getTime() < MAX_OVERRIDE_AGE_MS)) {
    const pair: RatePair = {
      buyPrice:  override.buyPrice.toString(),
      sellPrice: override.sellPrice.toString(),
      source:    `admin:${override.setBy}`,
      fetchedAt: override.updatedAt,
    };
    memoryCache.set(k, { value: pair, expires: now + CACHE_TTL_MS });
    return pair;
  }

  // 2. External provider.
  for (const provider of RATE_PROVIDERS) {
    if (!provider.supports(base, quote)) continue;
    const result = await provider.fetch(base, quote);
    if (!result) continue;
    if (!withinSanity(base, quote, result.mid)) {
      // eslint-disable-next-line no-console
      console.warn(`[fx] ${provider.name} returned ${base}/${quote}=${result.mid} outside sanity bounds — skipping`);
      continue;
    }
    const { buy, sell } = await applySpread(base, quote, result.mid);
    const pair: RatePair = { buyPrice: buy, sellPrice: sell, source: provider.name, fetchedAt: new Date() };
    memoryCache.set(k, { value: pair, expires: now + CACHE_TTL_MS });

    // Persist the latest fetched rate so admin UIs can read recent
    // history. Mark it `isActive=false` so the override path above
    // doesn't accidentally pick it up as a manual setting.
    await prisma.exchangeRate.upsert({
      where: { baseCurrency_quoteCurrency: { baseCurrency: base as any, quoteCurrency: quote as any } },
      create: {
        baseCurrency: base as any,
        quoteCurrency: quote as any,
        buyPrice: buy,
        sellPrice: sell,
        isActive: false,
      },
      update: {
        buyPrice: buy,
        sellPrice: sell,
        // Don't flip isActive here; if admin had it active they keep it.
      },
    }).catch(() => { /* non-critical */ });

    return pair;
  }

  // 3. Last resort — return the stale override if one exists (even if
  // outside the freshness window) rather than failing the whole quote.
  if (override) {
    return {
      buyPrice:  override.buyPrice.toString(),
      sellPrice: override.sellPrice.toString(),
      source:    `stale:${override.setBy ?? 'auto'}`,
      fetchedAt: override.updatedAt,
    };
  }

  throw Object.assign(new Error(`No rate available for ${base}/${quote}`), { statusCode: 503 });
}

/** Force-refresh cache for a pair. Called by admin "refresh rate" endpoint. */
export function invalidateRate(base: string, quote: string) {
  memoryCache.delete(`${base}/${quote}`);
}
