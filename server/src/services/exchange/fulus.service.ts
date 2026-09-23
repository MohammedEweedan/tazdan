/**
 * Fulus API integration — real-time Libyan parallel-market rates.
 *
 * Fulus (https://fulus.ly/api/v1) is a paid, authenticated feed of the LYD
 * parallel-market rate for USD/EUR/GBP/TRY/EGP/TND/SAR/AED plus 13 bank
 * certificate rates. It replaces the fragile blackmarketlive.org HTML scrape
 * as the PRIMARY source for any FIAT/LYD pair, while the scraper stays in
 * fxRateProvider as a no-key fallback.
 *
 * Two feed paths, by design (FULUS_FEED = webhook + poll fallback):
 *  1. Webhook (instant, ~0 API calls): Fulus POSTs `rate.created` to
 *     /api/exchange/webhook/fulus whenever a new rate is published. The
 *     handler verifies the X-Webhook-Signature HMAC and calls
 *     `noteFulusRate()` here, refreshing the in-memory cache immediately.
 *  2. Poll fallback (self-healing): when the cache is empty/stale for a pair,
 *     the provider calls GET /rates/current once and caches it. This covers a
 *     dropped webhook or a cold start without burning the 10k/day quota on a
 *     tight polling loop.
 *
 * Rate direction: Fulus `rate` is LYD per 1 unit of the currency (e.g.
 * USD 6.85 = 6.85 LYD per 1 USD), matching our `<CODE>/LYD` mid convention.
 *
 * HTTP note: Fulus's responses are slightly non-compliant (a header terminated
 * with LF instead of CRLF), which Node's strict undici `fetch` parser REJECTS
 * with "Missing expected CR after header value" — so a plain fetch silently
 * fails and the rate never updates. We therefore call Fulus via axios with
 * `insecureHTTPParser: true`, which tolerates the malformed header (curl does
 * too, which is why manual curl tests passed while the app saw nothing).
 *
 * Env:
 *   FULUS_API_TOKEN          Bearer token from the Fulus dashboard (required to enable).
 *   FULUS_WEBHOOK_SECRET     Secret for X-Webhook-Signature HMAC-SHA256 verification.
 *   FULUS_BASE_URL           Override base URL (default https://fulus.ly/api/v1).
 *   FULUS_CACHE_TTL_MS       Fresh-cache window per pair, ms (default 600000 = 10 min).
 */
import crypto from 'crypto';
import axios from 'axios';

/**
 * GET a Fulus endpoint, tolerating its LF-terminated headers. Returns the
 * parsed JSON body or null on any failure (timeout, non-2xx, network). Never
 * throws — callers fall back to cache/scraper.
 */
// ── 429 circuit breaker ──────────────────────────────────────────────
// The Fulus plan has a hard daily request budget. Once we see a 429,
// hammering only digs the hole deeper and floods the logs (hundreds of
// identical warnings). Open the breaker for a cooldown: every fulusGet
// during it short-circuits to null and the callers' existing cache/
// scraper fallbacks take over silently.
const FULUS_429_COOLDOWN_MS = Number(process.env.FULUS_429_COOLDOWN_MS ?? 10 * 60_000);
let breakerOpenUntil = 0;

/** True while the post-429 cooldown is active (also used to abort backfill). */
export function fulusBreakerOpen(): boolean {
  return Date.now() < breakerOpenUntil;
}

async function fulusGet<T = any>(path: string, timeoutMs = 5000): Promise<T | null> {
  const token = process.env.FULUS_API_TOKEN;
  if (!token) return null;
  if (fulusBreakerOpen()) return null;
  try {
    const res = await axios.get<T>(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
      timeout: timeoutMs,
      // Tolerate Fulus's non-CRLF headers (see file header note).
      ...({ insecureHTTPParser: true } as Record<string, unknown>),
    });
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 429) {
      // Several requests can be in flight when the quota runs out; log once,
      // when the breaker actually opens, not once per rejected request.
      const wasOpen = fulusBreakerOpen();
      breakerOpenUntil = Date.now() + FULUS_429_COOLDOWN_MS;
      if (!wasOpen) {
        // eslint-disable-next-line no-console
        console.warn(`[fulus] 429 — pausing ALL Fulus calls for ${Math.round(FULUS_429_COOLDOWN_MS / 60_000)}min (cache/scraper take over)`);
      }
    }
    return null;
  }
}

const BASE_URL = process.env.FULUS_BASE_URL || 'https://fulus.ly/api/v1';
// A webhook-fed rate stays fresh for this long before the poll fallback
// kicks in. Generous because the webhook keeps it current in practice; this
// only bounds how stale a cached value can get if webhooks stop arriving.
const CACHE_TTL_MS = Number(process.env.FULUS_CACHE_TTL_MS ?? 600_000);

// Currencies Fulus carries vs LYD (cash rates). Bank rates are USD-only and
// not wired into pricing yet.
export const FULUS_CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'EGP', 'TND', 'SAR', 'AED'] as const;
export type FulusCurrency = (typeof FULUS_CURRENCIES)[number];

interface CachedRate { rate: number; at: number; source: 'webhook' | 'poll' }

// `${CURRENCY}` (cash, vs LYD) → latest known rate. Populated by either the
// webhook or the poll fallback; both go through `noteFulusRate`.
const cache = new Map<string, CachedRate>();

/** Whether a Fulus token is configured. When false the provider is a no-op. */
export function fulusEnabled(): boolean {
  return Boolean(process.env.FULUS_API_TOKEN);
}

/** Sanity window per currency (LYD per 1 unit) — rejects a poisoned value. */
const BOUNDS: Record<string, [number, number]> = {
  USD: [4, 15], EUR: [4, 17], GBP: [5, 20],
  TRY: [0.05, 1], EGP: [0.05, 1], TND: [1, 5],
  SAR: [1, 4], AED: [1, 4],
};

function sane(currency: string, rate: number): boolean {
  if (!Number.isFinite(rate) || rate <= 0) return false;
  const b = BOUNDS[currency];
  return !b || (rate >= b[0] && rate <= b[1]);
}

/**
 * Record a freshly observed cash rate (LYD per 1 unit of `currency`).
 * Called by the webhook handler and the poll fallback. Bank rates are ignored
 * here — they don't feed FIAT/LYD pricing.
 */
export function noteFulusRate(currency: string, rate: number, source: 'webhook' | 'poll' = 'webhook'): boolean {
  const code = currency.toUpperCase();
  if (!FULUS_CURRENCIES.includes(code as FulusCurrency)) return false;
  if (!sane(code, rate)) {
    // eslint-disable-next-line no-console
    console.warn(`[fulus] ${code}=${rate} outside sanity bounds — ignoring`);
    return false;
  }
  cache.set(code, { rate, at: Date.now(), source });
  return true;
}

/** Latest cached map (LYD-per-unit) for admin visibility / cross-check. */
export function fulusCachedRates(): Record<string, { rate: number; ageMs: number; source: string }> {
  const out: Record<string, { rate: number; ageMs: number; source: string }> = {};
  const now = Date.now();
  for (const [code, v] of cache) out[code] = { rate: v.rate, ageMs: now - v.at, source: v.source };
  return out;
}

/**
 * Poll GET /rates/current for one cash currency vs LYD. Returns the rate
 * (LYD per 1 unit) or null. Caches a sane result. 4s timeout so a slow
 * upstream can't stall a quote — the caller falls through to the scraper.
 */
async function pollCurrent(currency: string): Promise<number | null> {
  const json = await fulusGet<{ data?: { rate?: number } }>(
    `/rates/current?currency=${encodeURIComponent(currency)}&rate_type=cash`,
    4000,
  );
  const v = json?.data?.rate;
  if (typeof v === 'number' && noteFulusRate(currency, v, 'poll')) return v;
  return null;
}

/**
 * Resolve a cash rate (LYD per 1 unit of `currency`) for the FX provider.
 * Prefers a fresh cached value (webhook-fed); on cache-miss/stale, polls once.
 * Returns null when Fulus isn't configured or doesn't carry the currency, so
 * fxRateProvider falls through to the scraper.
 */
export async function getFulusLydRate(currency: string): Promise<number | null> {
  const code = currency.toUpperCase();
  if (!fulusEnabled() || !FULUS_CURRENCIES.includes(code as FulusCurrency)) return null;

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rate;

  const polled = await pollCurrent(code);
  if (polled != null) return polled;

  // Stale cache beats nothing — a webhook-fed value just past its TTL is far
  // closer to market than the scraper. The scraper is the next fallback only
  // if we have nothing at all.
  return hit?.rate ?? null;
}

/**
 * Backfill price history for one currency vs LYD into the FxRateTick table, so
 * the admin charts are populated immediately instead of waiting for the live
 * sampler to accumulate points. Pulls GET /rates/history for each of the last
 * `days` days (one call/day) and inserts a tick per returned data point.
 *
 * Idempotent-ish: we skip a row whose (pair, createdAt) already exists, so
 * re-running won't duplicate points. Returns the number of ticks inserted.
 * Best-effort — any failed day is skipped, never throws.
 */
export async function backfillHistory(currency: string, days = 7): Promise<number> {
  const token = process.env.FULUS_API_TOKEN;
  const code = currency.toUpperCase();
  if (!token || !FULUS_CURRENCIES.includes(code as FulusCurrency) || days <= 0) return 0;

  const { prisma } = await import('../../utils/prisma');
  const pair = `${code}/LYD`;
  let inserted = 0;

  for (let d = 0; d < days; d++) {
    // Budget protection: a 429 mid-backfill means the daily quota is gone —
    // every further day would burn requests for nulls. Resume next boot.
    if (fulusBreakerOpen()) {
      // eslint-disable-next-line no-console
      console.warn(`[fulus] backfill ${pair} aborted at day ${d}/${days} — 429 cooldown active`);
      break;
    }
    // Pace: ~4 req/s max keeps a deep backfill from monopolizing the quota.
    if (d > 0) await new Promise((r) => setTimeout(r, 250));
    const day = new Date(Date.now() - d * 86_400_000);
    const date = day.toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      const json = await fulusGet<{ data?: Array<{ rate?: number; timestamp?: string }> }>(
        `/rates/history?date=${date}&currency=${encodeURIComponent(code)}&rate_type=cash`,
        5000,
      );
      const points = Array.isArray(json?.data) ? json!.data! : [];
      for (const pt of points) {
        const rate = typeof pt.rate === 'number' ? pt.rate : NaN;
        if (!sane(code, rate) || !pt.timestamp) continue;
        const createdAt = new Date(pt.timestamp);
        if (Number.isNaN(createdAt.getTime())) continue;
        // Skip if a tick already exists at this exact instant for the pair.
        const exists = await prisma.fxRateTick.findFirst({
          where: { pair, createdAt }, select: { id: true },
        }).catch(() => null);
        if (exists) continue;
        await prisma.fxRateTick.create({
          data: { pair, price: rate.toFixed(8), volumeUsd: '0', skewPct: '0', createdAt },
        }).then(() => { inserted++; }).catch(() => undefined);
      }
    } catch {
      /* skip this day */
    }
  }
  if (inserted > 0) {
    // eslint-disable-next-line no-console
    console.log(`[fulus] backfilled ${inserted} ${pair} history tick(s) over ${days}d`);
  }
  return inserted;
}

/**
 * Backfill every Fulus currency once on boot, but only for pairs that are
 * sparse (few existing ticks) so we don't re-pull on every restart. Gated by
 * FULUS_BACKFILL_DAYS (default 7; 0 disables) in the caller.
 */
export async function backfillAllHistory(days: number): Promise<void> {
  if (!fulusEnabled() || days <= 0) return;
  const { countPairTicks } = await import('./lydOrderBook.service');
  for (const code of FULUS_CURRENCIES) {
    if (fulusBreakerOpen()) break; // quota gone — finish on a later boot
    const have = await countPairTicks(`${code}/LYD`, days * 24);
    // Only backfill a pair that's basically empty — avoids re-fetching daily.
    if (have < 5) await backfillHistory(code, days);
  }
}

/**
 * Verify the X-Webhook-Signature HMAC-SHA256 over the raw request body using
 * FULUS_WEBHOOK_SECRET. Accepts a bare hex digest or a `sha256=<hex>` form.
 */
export function verifyFulusSignature(signatureHeader: string | undefined, rawBody: string): boolean {
  const secret = process.env.FULUS_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const sig = signatureHeader.includes('=') ? signatureHeader.split('=').pop()! : signatureHeader;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Length check guards against timingSafeEqual throwing on mismatched lengths.
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
