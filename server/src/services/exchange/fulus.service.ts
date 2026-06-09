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
 * Env:
 *   FULUS_API_TOKEN          Bearer token from the Fulus dashboard (required to enable).
 *   FULUS_WEBHOOK_SECRET     Secret for X-Webhook-Signature HMAC-SHA256 verification.
 *   FULUS_BASE_URL           Override base URL (default https://fulus.ly/api/v1).
 *   FULUS_CACHE_TTL_MS       Fresh-cache window per pair, ms (default 600000 = 10 min).
 */
import crypto from 'crypto';

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
  USD: [4, 12], EUR: [4, 14], GBP: [5, 16],
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
  const token = process.env.FULUS_API_TOKEN;
  if (!token) return null;
  const url = `${BASE_URL}/rates/current?currency=${encodeURIComponent(currency)}&rate_type=cash`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    clearTimeout(t);
    if (!res.ok) {
      if (res.status === 429) console.warn('[fulus] rate limit hit (429) — relying on cache/scraper');
      return null;
    }
    const json = (await res.json()) as { data?: { rate?: number } };
    const v = json?.data?.rate;
    if (typeof v === 'number' && noteFulusRate(currency, v, 'poll')) return v;
    return null;
  } catch {
    return null;
  }
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
