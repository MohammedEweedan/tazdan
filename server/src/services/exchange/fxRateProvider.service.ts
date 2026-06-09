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
interface ProviderMid { mid: number; source: string; derived?: boolean }

// Cache structure: `${base}/${quote}` → { value, expires }
// Short TTL so quotes track the live market closely while still shielding the
// upstream APIs from per-request load. Override via FX_CACHE_TTL_MS.
const memoryCache = new Map<string, { value: RatePair; expires: number }>();
const CACHE_TTL_MS = Number(process.env.FX_CACHE_TTL_MS ?? 60_000);

// Sanity bounds — if a remote API returns a USD/LYD rate outside this
// window we treat the data as poisoned and refuse to use it. Update
// these as the macro picture shifts.
const SANITY_BOUNDS: Record<string, [number, number]> = {
  'USD/LYD': [3.5, 9.5],   // CBL official ~4.5, parallel ~7.0 as of 2026
};

// Approximate mid-market rates expressed as USD per 1 unit of the base
// currency. Used ONLY as a last resort when no admin override and no live
// provider is available — so a third-party FX outage can never hard-fail a
// crypto buy/sell. Admins should still set live/exact rates; these just keep
// settlement working. Update periodically.
const FALLBACK_USD_PER_UNIT: Record<string, number> = {
  USD: 1,     EUR: 1.08,  GBP: 1.27,
  AED: 0.272, SAR: 0.266, EGP: 0.019,
  // LYD reflects the parallel-market level (~7.2 LYD/USD), not the official
  // CBL peg, since that's the rate we transact at. Last-resort only.
  LYD: 0.139, CAD: 0.73,  AUD: 0.66,
  CHF: 1.12,  JPY: 0.0067, CNY: 0.14,
};

function fallbackRate(base: string, quote: string): number | null {
  const b = FALLBACK_USD_PER_UNIT[base.toUpperCase()];
  const q = FALLBACK_USD_PER_UNIT[quote.toUpperCase()];
  if (b == null || q == null) return null;
  // USD-per-base ÷ USD-per-quote = quote-per-base mid.
  return b / q;
}

interface Provider {
  name: string;
  supports(base: string, quote: string): boolean;
  fetch(base: string, quote: string): Promise<{ mid: number } | null>;
}

async function fetchJsonTimeout(url: string, ms = 4000): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Frankfurter — free, keyless, ECB-sourced. Good for majors (USD/EUR/GBP/CHF/
// JPY/CAD/AUD…). Does not carry LYD/AED/SAR/EGP, so it simply returns null for
// those and the next provider handles them.
const frankfurter: Provider = {
  name: 'frankfurter',
  supports: () => true,
  async fetch(base, quote) {
    const json = await fetchJsonTimeout(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`);
    const v = json?.rates?.[quote];
    return typeof v === 'number' && Number.isFinite(v) ? { mid: v } : null;
  },
};

// open.er-api.com (exchangerate-api free tier) — keyless, broad coverage
// including AED/SAR/EGP and the *official* LYD peg. One call returns every
// rate vs the base, so we read the quote out of the map.
const openErApi: Provider = {
  name: 'open.er-api',
  supports: () => true,
  async fetch(base, quote) {
    const json = await fetchJsonTimeout(`https://open.er-api.com/v6/latest/${base}`);
    if (json?.result !== 'success') return null;
    const v = json?.rates?.[quote];
    return typeof v === 'number' && Number.isFinite(v) ? { mid: v } : null;
  },
};

// ── Libyan dinar PARALLEL (black-market) rates ───────────────────────────────
// No standard FX API carries Libya's parallel rate, so we scrape it from
// blackmarketlive.org (clean per-currency table, updated daily). The page lays
// each currency out as:
//   ...alt="usd".../> US Dollar</td><td ...>8.32</td>
// i.e. an `alt="<code>"` image immediately followed by the LYD price in the
// first table cell. We extract every code→price so any FIAT/LYD pair resolves.
// Override the URL with LYD_PARALLEL_URL if the source ever moves.
const LYD_SCRAPE_URL = process.env.LYD_PARALLEL_URL || 'https://en.blackmarketlive.org/lyd/';
const LYD_SCRAPE_CODES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'CHF', 'TND', 'KWD', 'TRY'];
// LYD-per-1-unit sanity window per currency — rejects a poisoned/garbled scrape.
const LYD_SCRAPE_BOUNDS: Record<string, [number, number]> = {
  USD: [4, 12], EUR: [4, 14], GBP: [5, 16], AED: [1, 4], SAR: [1, 4],
  CAD: [3, 9], CHF: [5, 16], TND: [1, 5], KWD: [15, 40], TRY: [0.05, 1],
};

// Scrape cache — one fetch populates every LYD pair for the TTL window.
let lydScrapeCache: { rates: Record<string, number>; exp: number } | null = null;

async function scrapeLydRates(): Promise<Record<string, number>> {
  if (lydScrapeCache && lydScrapeCache.exp > Date.now()) return lydScrapeCache.rates;
  const rates: Record<string, number> = {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(LYD_SCRAPE_URL, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; tazdan-fx/1.0)', accept: 'text/html' } });
    clearTimeout(t);
    if (res.ok) {
      const html = await res.text();
      for (const code of LYD_SCRAPE_CODES) {
        // alt="usd" ... </td><td ...>8.32</td>  — first number after the label cell.
        const re = new RegExp(`alt="${code.toLowerCase()}"[\\s\\S]{0,400}?<\\/td>\\s*<td[^>]*>\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i');
        const m = html.match(re);
        const v = m?.[1] ? Number(m[1]) : NaN;
        const bounds = LYD_SCRAPE_BOUNDS[code];
        if (Number.isFinite(v) && v > 0 && (!bounds || (v >= bounds[0] && v <= bounds[1]))) {
          rates[code] = v;
        }
      }
    }
  } catch {
    /* network/parse failure → empty; caller falls back */
  }
  // Only refresh the cache when we actually parsed something, so a transient
  // failure doesn't wipe a good previous scrape.
  if (Object.keys(rates).length > 0) {
    lydScrapeCache = { rates, exp: Date.now() + CACHE_TTL_MS };
    return rates;
  }
  return lydScrapeCache?.rates ?? {};
}

/** Latest scraped LYD-per-unit map (for admin visibility / cross-check). */
export async function getScrapedLydRates(): Promise<Record<string, number>> {
  return scrapeLydRates();
}

// Provider: any FIAT/LYD pair (USD/LYD, EUR/LYD, …) sourced from the scrape.
const lydParallel: Provider = {
  name: 'lyd-parallel-scrape',
  supports: (base, quote) => quote === 'LYD' && LYD_SCRAPE_CODES.includes(base.toUpperCase()),
  async fetch(base) {
    const rates = await scrapeLydRates();
    const v = rates[base.toUpperCase()];
    return typeof v === 'number' && v > 0 ? { mid: v } : null;
  },
};

// Provider: FIAT/LYD from the Fulus API (real-time, webhook-fed). Primary
// source for LYD parallel-market rates — sits ABOVE the scraper so its live
// value wins, with the scraper as the no-key fallback. Returns null (deferring
// to the scraper) when no Fulus token is configured.
const fulusLyd: Provider = {
  name: 'fulus',
  supports: (base, quote) => quote === 'LYD',
  async fetch(base) {
    const { getFulusLydRate } = await import('./fulus.service');
    const v = await getFulusLydRate(base.toUpperCase());
    return typeof v === 'number' && v > 0 ? { mid: v } : null;
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

// Order matters — first provider that supports the pair AND returns a sane
// value wins. fulus is first so the real-time parallel rate beats the daily
// scrape; lydParallel (scrape) is the no-key fallback for LYD pairs; both
// beat the official peg that open.er-api would otherwise return for USD/LYD.
const RATE_PROVIDERS: Provider[] = [fulusLyd, lydParallel, openExchangeRates, frankfurter, openErApi];

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
 *
 * Markup floor: the effective spread is clamped UP to a configured minimum
 * (`fx_spread_floor_pct.{base}_{quote}` or `.default`). This guarantees the
 * platform keeps the same minimum margin in BOTH directions — on the way down
 * (LYD strengthening) exactly as on the way up — so a too-low spread setting
 * during volatile periods can never erode our markup below the floor.
 */
async function applySpread(base: string, quote: string, mid: number): Promise<{ buy: string; sell: string }> {
  const key       = `fx_spread_pct.${base}_${quote}`;
  const def       = 'fx_spread_pct.default';
  const floorKey  = `fx_spread_floor_pct.${base}_${quote}`;
  const floorDef  = 'fx_spread_floor_pct.default';
  const [pair, fallback, floorPair, floorFallback] = await Promise.all([
    prisma.platformSettings.findUnique({ where: { key } }),
    prisma.platformSettings.findUnique({ where: { key: def } }),
    prisma.platformSettings.findUnique({ where: { key: floorKey } }),
    prisma.platformSettings.findUnique({ where: { key: floorDef } }),
  ]);
  const configured = new Decimal(pair?.value ?? fallback?.value ?? '1.0');
  // Floor defaults to 0 (no-op) unless configured, so existing pairs are unaffected.
  const floor = new Decimal(floorPair?.value ?? floorFallback?.value ?? '0');
  // Effective spread is never below the floor — symmetric on rises and drops.
  const pct = Decimal.max(configured, floor);
  const midDec = new Decimal(mid);
  const half = pct.div(2).div(100);
  // Spread is symmetric around the mid:
  // - buyPrice is what the user pays in QUOTE to buy 1 BASE, so it is above mid.
  // - sellPrice is what the user receives in QUOTE to sell 1 BASE, so it is below mid.
  const buy  = midDec.mul(new Decimal(1).add(half));
  const sell = midDec.mul(new Decimal(1).sub(half));
  return { buy: buy.toFixed(8), sell: sell.toFixed(8) };
}

/**
 * Walk the provider list for a pair and return the first sane mid, or null.
 * Sanity bounds (when defined for the pair) reject poisoned API values.
 */
async function fetchProviderMid(base: string, quote: string): Promise<ProviderMid | null> {
  for (const provider of RATE_PROVIDERS) {
    if (!provider.supports(base, quote)) continue;
    const result = await provider.fetch(base, quote);
    if (!result) continue;
    if (!withinSanity(base, quote, result.mid)) {
      // eslint-disable-next-line no-console
      console.warn(`[fx] ${provider.name} returned ${base}/${quote}=${result.mid} outside sanity bounds — skipping`);
      continue;
    }
    return { mid: result.mid, source: provider.name };
  }
  return null;
}

/**
 * Returns the freshest available rate for the requested pair.
 * Admin overrides win when they are newer than `MAX_OVERRIDE_AGE_MS`.
 *
 * The window used to be 24h, which made a forgotten override an invisible trap:
 * a stale manual rate (e.g. USD/LYD stuck at 8.43) would beat the live Fulus
 * feed for a full day and the admin "Refresh" button — which also calls getRate
 * — would just re-return the same override. Default is now 2h so a deliberate
 * override still holds for a working session but yields back to live quickly.
 * Override with FX_OVERRIDE_MAX_AGE_MS.
 */
const MAX_OVERRIDE_AGE_MS = Number(process.env.FX_OVERRIDE_MAX_AGE_MS ?? 2 * 60 * 60 * 1000);

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

  // 2. External provider — try the pair directly, then derive from its
  //    inverse (e.g. LYD/USD from the parallel USD/LYD) so both directions
  //    stay consistent with the same source.
  let providerRate = await fetchProviderMid(base, quote);
  if (providerRate == null) {
    const inv = await fetchProviderMid(quote, base);
    if (inv != null && inv.mid > 0) providerRate = { mid: 1 / inv.mid, source: inv.source, derived: true };
  }
  if (providerRate != null) {
    let mid = providerRate.mid;
    // Adaptive USD/LYD: lift the scraped market FLOOR by the current demand
    // skew. Skew is >= 0, so the result never dips below the street rate even
    // when platform demand is low. Applied to both USD/LYD and the derived
    // LYD/USD (where the skew makes LYD/USD slightly *cheaper*, consistently).
    let skewSource = '';
    if (base === 'USD' && quote === 'LYD') {
      const { applyLydDemandSkew, currentLydSkewPct, noteLydPrice } = await import('./lydOrderBook.service');
      mid = (applyLydDemandSkew(mid)).toNumber();
      noteLydPrice(mid); // feed the history sampler the live effective price
      if (currentLydSkewPct() > 0) skewSource = '+skew';
    } else if (base === 'LYD' && quote === 'USD') {
      const { currentLydSkewPct } = await import('./lydOrderBook.service');
      const skew = currentLydSkewPct();
      if (skew > 0) { mid = mid / (1 + skew); skewSource = '+skew'; }
    }
    const { buy, sell } = await applySpread(base, quote, mid);
    const baseSource = `${providerRate.derived ? 'derived' : 'live'}:${providerRate.source}`;
    const pair: RatePair = { buyPrice: buy, sellPrice: sell, source: baseSource + skewSource, fetchedAt: new Date() };
    memoryCache.set(k, { value: pair, expires: now + CACHE_TTL_MS });

    // Persist the latest fetched rate so admin UIs can read recent history.
    // Mark it `isActive=false` so the override path above doesn't pick it up.
    await prisma.exchangeRate.upsert({
      where: { baseCurrency_quoteCurrency: { baseCurrency: base as any, quoteCurrency: quote as any } },
      create: { baseCurrency: base as any, quoteCurrency: quote as any, buyPrice: buy, sellPrice: sell, isActive: false },
      update: { buyPrice: buy, sellPrice: sell },
    }).catch(() => { /* non-critical */ });

    return pair;
  }

  // 3. Stale override (even if outside the freshness window) beats nothing.
  if (override) {
    return {
      buyPrice:  override.buyPrice.toString(),
      sellPrice: override.sellPrice.toString(),
      source:    `stale:${override.setBy ?? 'auto'}`,
      fetchedAt: override.updatedAt,
    };
  }

  // 4. Hardcoded fallback table — keeps crypto buy/sell working when every
  // live provider is down. Spread-adjusted for consistency with live rates.
  const fb = fallbackRate(base, quote);
  if (fb != null) {
    const { buy, sell } = await applySpread(base, quote, fb);
    return { buyPrice: buy, sellPrice: sell, source: 'fallback:static', fetchedAt: new Date() };
  }

  throw Object.assign(new Error(`No rate available for ${base}/${quote}`), { statusCode: 503 });
}

/** Force-refresh cache for a pair. Called by admin "refresh rate" endpoint. */
export function invalidateRate(base: string, quote: string) {
  memoryCache.delete(`${base}/${quote}`);
}

/**
 * Live provider rate for a pair, IGNORING any admin override. Used by admin
 * surfaces to show "what the market is right now" next to the stored value, so
 * a stale override is visible rather than silently winning. Returns null when
 * no provider can price the pair (the caller decides how to render that).
 */
export async function getLiveProviderRate(base: string, quote: string): Promise<RatePair | null> {
  let providerRate = await fetchProviderMid(base, quote);
  if (providerRate == null) {
    const inv = await fetchProviderMid(quote, base);
    if (inv != null && inv.mid > 0) providerRate = { mid: 1 / inv.mid, source: inv.source, derived: true };
  }
  if (providerRate == null) return null;
  let mid = providerRate.mid;

  // Mirror getRate's USD/LYD demand-skew so the "live" figure matches what a
  // user would actually transact at.
  let skewSource = '';
  if (base === 'USD' && quote === 'LYD') {
    const { applyLydDemandSkew, currentLydSkewPct } = await import('./lydOrderBook.service');
    mid = applyLydDemandSkew(mid).toNumber();
    if (currentLydSkewPct() > 0) skewSource = '+skew';
  } else if (base === 'LYD' && quote === 'USD') {
    const { currentLydSkewPct } = await import('./lydOrderBook.service');
    const skew = currentLydSkewPct();
    if (skew > 0) { mid = mid / (1 + skew); skewSource = '+skew'; }
  }
  const { buy, sell } = await applySpread(base, quote, mid);
  const baseSource = `${providerRate.derived ? 'derived' : 'live'}:${providerRate.source}`;
  return { buyPrice: buy, sellPrice: sell, source: baseSource + skewSource, fetchedAt: new Date() };
}

/**
 * One-shot boot cleanup: demote auto-persisted rows that were wrongly left
 * `isActive=true` with no human `setBy`. The live-rate persist path writes
 * `isActive:false` (see getRate), so this only catches legacy/bad rows that
 * would otherwise short-circuit getRate to a frozen value. Idempotent.
 * Gated by FX_CLEAR_STALE_OVERRIDES_ON_BOOT=1 in the caller.
 */
export async function clearStaleAutoOverrides(): Promise<number> {
  const res = await prisma.exchangeRate.updateMany({
    where: { isActive: true, setBy: null },
    data: { isActive: false },
  }).catch(() => ({ count: 0 }));
  if (res.count > 0) {
    // eslint-disable-next-line no-console
    console.log(`[fx] cleared ${res.count} stale auto-override row(s) (isActive=true, setBy=null)`);
  }
  return res.count;
}
