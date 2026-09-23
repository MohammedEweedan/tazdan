/**
 * Price + quote engine.
 *
 * Real-time mid-market prices come from Binance spot REST. The quote
 * builder layers on:
 *   - a per-asset spread (your profit),
 *   - a flat platform fee (0.5%),
 *   - an asset/network-specific "network fee" bucket (gas + slippage).
 *
 * Quotes are minted with a 30-second expiry and cached in Redis (with
 * in-memory fallback when Redis is unavailable). The execution path
 * looks them up by ID and rejects expired quotes.
 */
import axios from 'axios';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import { redisGet, redisSet, redisDel, redisGetDel, getRedisClient } from '../../utils/redis';
import { prisma } from '../../utils/prisma';
import { isLedgerCurrency } from '../ledger/ledger.service';
import { logger } from '../../utils/logger';

Decimal.set({ precision: 40 });

// Admin-configurable spread. Stored in PlatformSettings under this key as a
// decimal fraction string (e.g. "0.025" = 2.5 %). Editable from the admin
// panel; falls back to QUOTE_SPREAD_PCT env / the hardcoded default below.
export const SPREAD_SETTING_KEY = 'quote_spread_pct';

// ── Default spread ───────────────────────────────────────────────────
// Flat spread applied to every quote: BUY is marked up, SELL is marked
// down by this fraction. This is the exchange rate the user transacts at.
// Override per-asset via FEES.spread below; falls back to this default.
// Configurable via the QUOTE_SPREAD_PCT env var (e.g. "0.025" = 2.5 %).
const DEFAULT_SPREAD = new Decimal(process.env.QUOTE_SPREAD_PCT ?? '0.025'); // 2.5 %

// ── Fee schedule (dynamic for all assets) ────────────────────────────
// Default spread and network fees for any cryptocurrency
export const FEES = {
  spread: {
    // Major coins - lower spread due to liquidity
    BTC: 0.005, ETH: 0.006, SOL: 0.008, USDT: 0.004,
    BNB: 0.008, XRP: 0.010, ADA: 0.010, DOGE: 0.012,
    MATIC: 0.010, DOT: 0.010, AVAX: 0.010,
    // Mid-tier
    LINK: 0.012, UNI: 0.012, AAVE: 0.015, LTC: 0.010,
    ATOM: 0.012, ALGO: 0.015, NEAR: 0.012, FTM: 0.015,
    VET: 0.015, TRX: 0.012, ETC: 0.015, XLM: 0.015,
    XMR: 0.020, FIL: 0.015, EOS: 0.015, THETA: 0.015,
    // Default for unknown assets
    DEFAULT: 0.020,
  } as Record<string, number>,
  platform: 0.005,
  network: {
    // Major networks
    ETH_ERC20:  { gas: 0.020, slippage: 0.005 },
    BTC:        { gas: 0.010, slippage: 0.003 },
    SOL:        { gas: 0.003, slippage: 0.002 },
    BNB_BEP20:  { gas: 0.003, slippage: 0.002 },
    // Stablecoins
    USDT_TRC20: { gas: 0.005, slippage: 0.000 },
    USDT_ERC20: { gas: 0.020, slippage: 0.005 },
    USDC_ERC20: { gas: 0.020, slippage: 0.005 },
    // Others
    XRP_XRP:    { gas: 0.002, slippage: 0.001 },
    ADA_CARDANO:{ gas: 0.005, slippage: 0.002 },
    DOGE_DOGE:  { gas: 0.005, slippage: 0.002 },
    DOT_DOT:    { gas: 0.003, slippage: 0.002 },
    AVAX_CCHAIN:{ gas: 0.008, slippage: 0.003 },
    LINK_ERC20: { gas: 0.020, slippage: 0.005 },
    UNI_ERC20:  { gas: 0.020, slippage: 0.005 },
    AAVE_ERC20: { gas: 0.020, slippage: 0.005 },
    LTC_LTC:    { gas: 0.005, slippage: 0.002 },
    ATOM_COSMOS:{ gas: 0.003, slippage: 0.002 },
    ALGO_ALGO:  { gas: 0.002, slippage: 0.001 },
    NEAR_NEAR:  { gas: 0.003, slippage: 0.002 },
    FTM_FANTOM: { gas: 0.005, slippage: 0.002 },
    VET_VECHAIN:{ gas: 0.005, slippage: 0.002 },
    TRX_TRC20:  { gas: 0.005, slippage: 0.000 },
    ETC_ETC:    { gas: 0.008, slippage: 0.003 },
    XLM_STELLAR:{ gas: 0.002, slippage: 0.001 },
    // Default for unknown networks
    DEFAULT:    { gas: 0.015, slippage: 0.005 },
  } as Record<string, { gas: number; slippage: number }>,
} as const;

// ── Configurable spread (admin panel → PlatformSettings) ─────────────
// Cached for a few seconds so quote bursts don't each hit the DB.
let spreadCache: { value: Decimal; exp: number } | null = null;
const SPREAD_TTL_MS = 10_000;

export async function getConfiguredSpread(): Promise<Decimal> {
  if (spreadCache && spreadCache.exp > Date.now()) return spreadCache.value;
  let value = DEFAULT_SPREAD;
  try {
    const row = await prisma.platformSettings.findUnique({ where: { key: SPREAD_SETTING_KEY } });
    if (row?.value != null && row.value !== '') {
      const parsed = new Decimal(row.value);
      // Sanity clamp: spread must be in [0, 50 %) to avoid nonsensical quotes.
      if (parsed.gte(0) && parsed.lt(0.5)) value = parsed;
    }
  } catch {
    // DB unavailable — fall back to default.
  }
  spreadCache = { value, exp: Date.now() + SPREAD_TTL_MS };
  return value;
}

// Invalidate the cache immediately after an admin update.
export function invalidateSpreadCache(): void {
  spreadCache = null;
}

// Helper to get network fees for any asset/network combo
function getNetworkFees(asset: string, network: string): { gas: number; slippage: number } {
  const key = `${asset.toUpperCase()}_${network.toUpperCase()}`;
  return FEES.network[key] ?? FEES.network.DEFAULT;
}

export type Side = 'BUY' | 'SELL';
export type SupportedAsset = string; // Any cryptocurrency symbol

const BINANCE_REST = process.env.BINANCE_REST_URL || 'https://api.binance.com';

/**
 * Maps any asset to the Binance ticker symbol paired vs USDT.
 * USDT itself has no ticker — it's 1:1.
 */
function toBinanceSymbol(asset: string): string | null {
  const upper = asset.toUpperCase();
  if (upper === 'USDT' || upper === 'USDC') return null; // Stablecoins are 1:1
  // Common quote pairs on Binance
  return `${upper}USDT`;
}

function networkKey(asset: string, network: string): string {
  const assetUpper = asset.toUpperCase();
  const networkUpper = network.toUpperCase();
  
  // Special cases
  if (assetUpper === 'USDT') {
    return networkUpper === 'TRC20' ? 'USDT_TRC20' : 'USDT_ERC20';
  }
  if (assetUpper === 'ETH') return 'ETH_ERC20';
  if (assetUpper === 'BNB') return 'BNB_BEP20';
  if (assetUpper === 'LINK' || assetUpper === 'UNI' || assetUpper === 'AAVE') {
    return `${assetUpper}_ERC20`;
  }
  
  // Default: asset_network format
  return `${assetUpper}_${networkUpper}`;
}

// ── In-process price micro-cache (5 s) ───────────────────────────────
// Prevents a storm of simultaneous quote requests from each hitting Binance.
// Redis is used when available; this map is the fast in-process fallback.
const priceCache = new Map<string, { price: Decimal; exp: number }>();
const PRICE_TTL_MS = 5_000;
const PRICE_TTL_S  = 5;

// ── "Last good" price fallback (SHORT, time-bounded) ─────────────────
// Binance can be temporarily unreachable from the production host (HTTP 451
// geo-block, timeouts). To absorb a brief blip we keep the last successfully
// fetched price and may serve it when a live fetch fails — BUT only if it is
// still FRESH. Pricing a real trade off a price that's minutes-to-hours old
// is a financial-integrity bug (it's how a BTC quote showed 70326 while the
// market was 66982). So the fallback is strictly time-bounded: a stale price
// older than STALE_PRICE_MAX_AGE_MS is NOT used — the quote fails cleanly and
// the user retries, rather than trading at a wrong rate.
//
// We persist the value WITH its fetch timestamp (Redis key holds {p,t}); a
// short TTL on the key is a second guard so nothing ancient can ever resurface.
const STALE_PRICE_MAX_AGE_MS = 90_000; // 90s — old enough to bridge a blip, fresh enough to trade
const STALE_PRICE_TTL_S = 120;         // Redis key self-expires shortly after max age
type StaleEntry = { price: Decimal; t: number };
const lastGoodPrice = new Map<string, StaleEntry>();

function staleKey(symbol: string): string {
  return `price:last:${symbol}`;
}

/** Returns the last-good price ONLY if it's within the freshness window. */
async function readStalePrice(symbol: string): Promise<Decimal | null> {
  const fresh = (e: StaleEntry | null): Decimal | null =>
    e && Date.now() - e.t <= STALE_PRICE_MAX_AGE_MS ? e.price : null;

  const mem = lastGoodPrice.get(symbol);
  const memFresh = fresh(mem ?? null);
  if (memFresh) return memFresh;

  try {
    const cached = await redisGet<{ p: string; t: number }>(staleKey(symbol));
    if (cached && typeof cached.t === 'number') {
      const entry: StaleEntry = { price: new Decimal(cached.p), t: cached.t };
      lastGoodPrice.set(symbol, entry);
      return fresh(entry);
    }
  } catch { /* Redis unavailable — no stale price */ }
  return null;
}

function writeStalePrice(symbol: string, price: Decimal): void {
  const entry: StaleEntry = { price, t: Date.now() };
  lastGoodPrice.set(symbol, entry);
  redisSet(staleKey(symbol), { p: price.toString(), t: entry.t }, STALE_PRICE_TTL_S)
    .catch(() => { /* non-fatal */ });
}

/**
 * Fetch the last trade price for a USDT-quoted symbol (e.g. "BTCUSDT").
 * Results are cached in Redis (5 s) with an in-process fallback to absorb
 * burst traffic without hitting the upstream on every quote request.
 */
// ── Price providers ──────────────────────────────────────────────────
// Binance is primary, but it returns HTTP 451 to many data-center IPs and
// regions — so production hosts often can't reach it at all. We therefore
// try a chain of providers, each reachable from blocked regions, and use
// the first that answers. All are symbol-driven (no per-coin ID map), keyed
// off the base asset extracted from the "<ASSET>USDT" symbol, and priced in
// USD/USDT (≈1:1 for our spread math). Order matters: cheapest/most-reliable
// first. Override or disable Binance via BINANCE_REST_URL.
type PriceProvider = { name: string; fetch: (base: string) => Promise<Decimal | null> };

const PRICE_PROVIDERS: PriceProvider[] = [
  {
    name: 'binance',
    fetch: async (base) => {
      const url = `${BINANCE_REST}/api/v3/ticker/price?symbol=${encodeURIComponent(base)}USDT`;
      const { data } = await axios.get<{ price: string }>(url, { timeout: 5000 });
      return data?.price ? new Decimal(data.price) : null;
    },
  },
  {
    name: 'coinbase',
    fetch: async (base) => {
      // https://api.coinbase.com/v2/prices/BTC-USD/spot
      const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(base)}-USD/spot`;
      const { data } = await axios.get<{ data?: { amount?: string } }>(url, { timeout: 5000 });
      const amt = data?.data?.amount;
      return amt ? new Decimal(amt) : null;
    },
  },
  {
    name: 'cryptocompare',
    fetch: async (base) => {
      // https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USDT
      const url = `https://min-api.cryptocompare.com/data/price?fsym=${encodeURIComponent(base)}&tsyms=USDT`;
      const { data } = await axios.get<{ USDT?: number; Response?: string }>(url, { timeout: 5000 });
      // CryptoCompare returns 200 with { Response: "Error" } for unknown syms.
      return data && typeof data.USDT === 'number' ? new Decimal(data.USDT) : null;
    },
  },
  {
    name: 'coingecko',
    fetch: async (base) => {
      // CoinGecko uses coin IDs, not tickers. Map the assets we trade; unknowns
      // return null so the chain moves on. https://api.coingecko.com/api/v3/simple/price
      const ids: Record<string, string> = {
        BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
        XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', TRX: 'tron',
        LINK: 'chainlink', MATIC: 'matic-network', DOT: 'polkadot', AVAX: 'avalanche-2',
        USDT: 'tether', USDC: 'usd-coin',
      };
      const id = ids[base.toUpperCase()];
      if (!id) return null;
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
      const { data } = await axios.get<Record<string, { usd?: number }>>(url, { timeout: 5000 });
      const usd = data?.[id]?.usd;
      return typeof usd === 'number' ? new Decimal(usd) : null;
    },
  },
];

/** "BTCUSDT" → "BTC". Symbols here are always `<ASSET>USDT`. */
function symbolToBase(symbol: string): string {
  return symbol.toUpperCase().replace(/USDT$/, '');
}

export async function getMarketPrice(symbol: string): Promise<Decimal> {
  const cacheKey = `price:${symbol}`;

  // 1. In-process cache (sub-millisecond hit, no network)
  const hit = priceCache.get(symbol);
  if (hit && hit.exp > Date.now()) return hit.price;

  // 2. Redis cache (shared across workers)
  try {
    const cached = await redisGet<string>(cacheKey);
    if (cached) {
      const price = new Decimal(cached);
      priceCache.set(symbol, { price, exp: Date.now() + PRICE_TTL_MS });
      return price;
    }
  } catch { /* Redis miss — fall through */ }

  // 3. Live fetch — try each provider until one answers.
  const base = symbolToBase(symbol);
  const failures: string[] = [];
  for (const provider of PRICE_PROVIDERS) {
    try {
      const price = await provider.fetch(base);
      if (price && price.gt(0)) {
        // Populate the fresh caches and the long-lived "last good" fallback.
        priceCache.set(symbol, { price, exp: Date.now() + PRICE_TTL_MS });
        redisSet(cacheKey, price.toString(), PRICE_TTL_S).catch(() => { /* non-fatal */ });
        writeStalePrice(symbol, price);
        if (provider.name !== 'binance') {
          logger.info('[priceEngine] price via fallback provider', { symbol, provider: provider.name });
        }
        return price;
      }
      failures.push(`${provider.name}:empty`);
    } catch (err) {
      const status = (err as any)?.response?.status;
      failures.push(`${provider.name}:${status ?? (err instanceof Error ? err.message : 'err')}`);
    }
  }

  // 4. All providers failed. Serve the last known good price rather than
  // 500ing the quote. Only if we have never fetched this symbol do we throw.
  const stale = await readStalePrice(symbol);
  if (stale) {
    logger.warn('[priceEngine] all providers failed — serving stale price', {
      symbol, stalePrice: stale.toString(), failures,
    });
    priceCache.set(symbol, { price: stale, exp: Date.now() + PRICE_TTL_MS });
    return stale;
  }
  logger.error('[priceEngine] all providers failed and no stale price', { symbol, failures });
  throw new Error(`Could not fetch price for ${base} from any provider (${failures.join(', ')})`);
}

export interface Quote {
  id: string;
  side: Side;
  asset: string;
  network: string;

  // Fiat/stablecoin wallet the trade settles into (SELL) or funds from (BUY).
  // `fiatAmount` is USD/USDT-denominated for pricing math. `settlementAmount`
  // is the exact amount in `settlementCurrency` the user sees and pays/receives.
  settlementCurrency: string;

  marketPrice: string;     // raw Binance mid
  quotedPrice: string;     // what user sees (market * (1 + spread) on BUY)
  spreadPct: string;       // disclosed spread fraction, e.g. "0.025" = 2.5 %

  fiatAmount: string;      // USDT in
  cryptoAmount: string;    // asset out

  platformFee: string;
  networkFee: string;
  spreadCapture: string;   // your profit (fiat terms)
  settlementAmount: string;
  platformFeeSettlement: string;
  networkFeeSettlement: string;

  totalUserPays: string;   // BUY: settlementAmount | SELL: cryptoAmount
  expiresAt: number;       // unix ms
  /** The user the quote was issued to. Only they can execute it. */
  userId?: string;
}

// ── Quote cache (Redis-backed with in-memory fallback) ───────────────
// Step-up challenges may require an emailed code before execute retries.
// Thirty seconds made that flow expire quotes before users could enter it.
const QUOTE_TTL_MS = 90_000;
const QUOTE_TTL_S = QUOTE_TTL_MS / 1000; // 90 seconds

// In-memory fallback store (used when Redis is unavailable)
const quoteStore = new Map<string, Quote>();

function sweepQuotes() {
  const now = Date.now();
  for (const [id, q] of quoteStore) {
    if (q.expiresAt <= now) quoteStore.delete(id);
  }
}
setInterval(sweepQuotes, 10_000).unref?.();

async function setQuote(quote: Quote): Promise<void> {
  // Use Redis when available; fall back to in-memory otherwise.
  if (getRedisClient()) {
    try {
      await redisSet(`quote:${quote.id}`, quote, QUOTE_TTL_S);
      return;
    } catch {
      // Redis write failed — fall through to in-memory
    }
  }
  quoteStore.set(quote.id, quote);
}

export async function getQuote(id: string): Promise<Quote | null> {
  // Try Redis first
  try {
    const redisQuote = await redisGet<Quote>(`quote:${id}`);
    if (redisQuote !== null) {
      if (redisQuote.expiresAt <= Date.now()) {
        await redisDel(`quote:${id}`);
        return null;
      }
      return redisQuote;
    }
  } catch {
    // Redis unavailable — fall through to in-memory
  }

  // Fall back to in-memory
  const q = quoteStore.get(id);
  if (!q) return null;
  if (q.expiresAt <= Date.now()) {
    quoteStore.delete(id);
    return null;
  }
  return q;
}

/**
 * Take a quote for execution. Single-use: GETDEL (or the in-process map's
 * synchronous get+delete) guarantees that of several concurrent executions
 * of the same quote, exactly one receives it. A quote issued to another user
 * is treated as not found and left in place for its owner.
 */
export async function consumeQuote(id: string, userId?: string): Promise<Quote | null> {
  const peek = await getQuote(id);
  if (!peek) return null;
  if (peek.userId && peek.userId !== userId) return null;

  let taken = await redisGetDel<Quote>(`quote:${id}`);
  if (!taken) {
    const local = quoteStore.get(id);
    if (local) {
      quoteStore.delete(id);
      taken = local;
    }
  }
  if (!taken || taken.expiresAt <= Date.now()) return null;
  return taken;
}

/**
 * Build a quote.
 *
 * BUY flow:
 *   user commits `fiatAmount` USDT
 *   → platformFee + networkFee are taken off the top
 *   → remaining USDT buys asset at `quotedPrice = marketPrice * (1 + spread)`
 *   → cryptoAmount credited to user, spreadCapture is our profit
 *
 * SELL flow (symmetric):
 *   user delivers `cryptoAmount` asset
 *   → sold at `quotedPrice = marketPrice * (1 - spread)`
 *   → fees debited from fiat proceeds, remainder credited as USDT
 */
/**
 * Convert an amount in `currency` to USD. USD/USDT/USDC are 1:1; other fiats
 * route through the FX provider (getRate(currency,'USD') = USD per 1 unit).
 * Falls back to 1:1 only if no rate is resolvable, which should be rare given
 * the provider's static fallback table.
 */
async function fundingToUsd(currency: string, amount: Decimal): Promise<Decimal> {
  const c = currency.toUpperCase();
  if (c === 'USD' || c === 'USDT' || c === 'USDC') return amount;
  const { getRate } = await import('./fxRateProvider.service');
  const pair = await getRate(c, 'USD').catch(() => null);
  // User is converting funding currency into USD purchasing power, so use the
  // SELL side: what the user receives when selling 1 unit of the funding fiat.
  const usdPerUnit = pair ? new Decimal(pair.sellPrice || pair.buyPrice) : new Decimal(0);
  if (usdPerUnit.lte(0)) return amount; // last-resort: treat as USD
  return amount.mul(usdPerUnit);
}

async function usdToFunding(currency: string, usdAmount: Decimal): Promise<Decimal> {
  const c = currency.toUpperCase();
  if (c === 'USD' || c === 'USDT' || c === 'USDC') return usdAmount;
  const { getRate } = await import('./fxRateProvider.service');
  const pair = await getRate('USD', c).catch(() => null);
  const unitsPerUsd = pair ? new Decimal(pair.sellPrice || pair.buyPrice) : new Decimal(0);
  if (unitsPerUsd.lte(0)) return usdAmount; // last-resort: treat as USD
  return usdAmount.mul(unitsPerUsd);
}

export async function buildQuote(opts: {
  asset: string;
  network: string;
  fiatAmount?: string | number;    // required for BUY (in the FUNDING currency)
  cryptoAmount?: string | number;  // required for SELL
  side: Side;
  settlementCurrency: string;      // fiat/stablecoin wallet; required, never defaulted
  userId?: string;                 // who may execute this quote
}): Promise<Quote> {
  const asset = opts.asset.toUpperCase();
  const network = opts.network.toUpperCase();
  const { side } = opts;
  const settlementCurrency = opts.settlementCurrency.toUpperCase();
  if (!isLedgerCurrency(settlementCurrency)) {
    throw new Error(`Unsupported settlement currency: ${settlementCurrency}`);
  }
  if (settlementCurrency === asset) {
    throw new Error(`Settlement currency must differ from the asset (${asset})`);
  }
  
  const nkey = networkKey(asset, network);
  const spreadPct = await getConfiguredSpread();
  const netCfg = getNetworkFees(asset, network);
  const networkPct = new Decimal(netCfg.gas).plus(netCfg.slippage);
  const platformPct = new Decimal(FEES.platform);

  // Live network-fee floor (USD): the real on-chain cost right now. We charge
  // at least this so a gas spike above the static estimate can't eat margin.
  // `null` when no live oracle covers the chain → static table is used as-is.
  const { liveNetworkCostUsd } = await import('./gasOracle.service');
  const liveNetworkFloor = await liveNetworkCostUsd(nkey).catch(() => null);

  // Fetch market price (USDT = 1).
  const sym = toBinanceSymbol(asset);
  let marketPrice: Decimal;
  try {
    marketPrice = sym ? await getMarketPrice(sym) : new Decimal(1);
  } catch (e) {
    // Fallback: if Binance doesn't have the pair, assume price of 1 for stablecoins
    // or throw error for others
    if (asset === 'USDT' || asset === 'USDC') {
      marketPrice = new Decimal(1);
    } else {
      throw new Error(`Could not fetch price for ${asset}. Market may not be available.`);
    }
  }

  // Symmetric spread: BUY is marked up, SELL is marked down by the same
  // configured fraction. This spread is disclosed to the user (returned as
  // `spreadPct` and surfaced in the UI).
  const quotedPrice = side === 'BUY'
    ? marketPrice.mul(new Decimal(1).plus(spreadPct))
    : marketPrice.mul(new Decimal(1).minus(spreadPct));

  let fiatAmount: Decimal;
  let cryptoAmount: Decimal;
  let platformFee: Decimal;
  let networkFee: Decimal;
  let spreadCapture: Decimal;
  let settlementAmount: Decimal;
  let platformFeeSettlement: Decimal;
  let networkFeeSettlement: Decimal;

  if (side === 'BUY') {
    if (opts.fiatAmount == null) throw new Error('fiatAmount required for BUY');
    // The user enters the spend amount in their FUNDING currency (LYD, USD,
    // USDT, …). Internal crypto math is USD-denominated, so convert non-USD
    // fiats to USD here. `fiatAmount` below is therefore always USD-equivalent;
    // the settlement leg debits the original funding amount in its own currency.
    const enteredAmount = new Decimal(opts.fiatAmount);
    if (enteredAmount.lte(0)) throw new Error('fiatAmount must be > 0');
    settlementAmount = enteredAmount;
    fiatAmount = await fundingToUsd(settlementCurrency, enteredAmount);

    platformFee = fiatAmount.mul(platformPct);
    networkFee = fiatAmount.mul(networkPct);
    // Never charge below the live on-chain cost.
    if (liveNetworkFloor && liveNetworkFloor.gt(networkFee)) networkFee = liveNetworkFloor;
    const spendable = fiatAmount.minus(platformFee).minus(networkFee);
    if (spendable.lte(0)) throw new Error('Amount too small to cover fees');

    cryptoAmount = spendable.div(quotedPrice);
    // Our profit in USDT: (quotedPrice - marketPrice) * cryptoAmount.
    spreadCapture = quotedPrice.minus(marketPrice).mul(cryptoAmount);
  } else {
    if (opts.cryptoAmount == null) throw new Error('cryptoAmount required for SELL');
    cryptoAmount = new Decimal(opts.cryptoAmount);
    if (cryptoAmount.lte(0)) throw new Error('cryptoAmount must be > 0');

    const gross = cryptoAmount.mul(quotedPrice);
    platformFee = gross.mul(platformPct);
    networkFee = gross.mul(networkPct);
    // Never charge below the live on-chain cost.
    if (liveNetworkFloor && liveNetworkFloor.gt(networkFee)) networkFee = liveNetworkFloor;
    fiatAmount = gross.minus(platformFee).minus(networkFee);
    if (fiatAmount.lte(0)) throw new Error('Amount too small to cover fees');
    spreadCapture = marketPrice.minus(quotedPrice).mul(cryptoAmount); // positive on SELL
    settlementAmount = await usdToFunding(settlementCurrency, fiatAmount);
  }

  platformFeeSettlement = await usdToFunding(settlementCurrency, platformFee);
  networkFeeSettlement = await usdToFunding(settlementCurrency, networkFee);

  const quote: Quote = {
    id: randomUUID(),
    side,
    asset,
    network: network.toUpperCase(),
    settlementCurrency,
    marketPrice: marketPrice.toFixed(8),
    quotedPrice: quotedPrice.toFixed(8),
    spreadPct: spreadPct.toFixed(6),
    fiatAmount: fiatAmount.toFixed(8),
    cryptoAmount: cryptoAmount.toFixed(18),
    platformFee: platformFee.toFixed(8),
    networkFee: networkFee.toFixed(8),
    spreadCapture: spreadCapture.toFixed(8),
    settlementAmount: settlementAmount.toFixed(8),
    platformFeeSettlement: platformFeeSettlement.toFixed(8),
    networkFeeSettlement: networkFeeSettlement.toFixed(8),
    totalUserPays: side === 'BUY' ? settlementAmount.toFixed(8) : cryptoAmount.toFixed(18),
    expiresAt: Date.now() + QUOTE_TTL_MS,
    userId: opts.userId,
  };
  await setQuote(quote);
  return quote;
}
