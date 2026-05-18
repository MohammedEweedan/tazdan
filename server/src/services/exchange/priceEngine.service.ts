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
import { redisGet, redisSet, redisDel, getRedisClient } from '../../utils/redis';

Decimal.set({ precision: 40 });

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

// Helper to get spread for any asset
function getSpread(asset: string): number {
  return FEES.spread[asset.toUpperCase()] ?? FEES.spread.DEFAULT;
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

/**
 * Fetch the last trade price for a Binance pair. Throws on network /
 * invalid-symbol errors so the caller fails closed (no silent fallback).
 */
export async function getMarketPrice(symbol: string): Promise<Decimal> {
  const url = `${BINANCE_REST}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  const { data } = await axios.get<{ symbol: string; price: string }>(url, { timeout: 5000 });
  if (!data?.price) throw new Error(`Binance returned no price for ${symbol}`);
  return new Decimal(data.price);
}

export interface Quote {
  id: string;
  side: Side;
  asset: string;
  network: string;

  marketPrice: string;     // raw Binance mid
  quotedPrice: string;     // what user sees (market * (1 + spread) on BUY)

  fiatAmount: string;      // USDT in
  cryptoAmount: string;    // asset out

  platformFee: string;
  networkFee: string;
  spreadCapture: string;   // your profit (fiat terms)

  totalUserPays: string;   // BUY: fiatAmount (they committed this) | SELL: what we owe them
  expiresAt: number;       // unix ms
}

// ── Quote cache (Redis-backed with in-memory fallback) ───────────────
const QUOTE_TTL_MS = 30_000;
const QUOTE_TTL_S = QUOTE_TTL_MS / 1000; // 30 seconds

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

export async function consumeQuote(id: string): Promise<Quote | null> {
  const q = await getQuote(id);
  if (q) {
    try {
      await redisDel(`quote:${id}`);
    } catch {
      // ignore Redis errors
    }
    quoteStore.delete(id);
  }
  return q;
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
export async function buildQuote(opts: {
  asset: string;
  network: string;
  fiatAmount?: string | number;    // required for BUY
  cryptoAmount?: string | number;  // required for SELL
  side: Side;
}): Promise<Quote> {
  const asset = opts.asset.toUpperCase();
  const network = opts.network.toUpperCase();
  const { side } = opts;
  
  const nkey = networkKey(asset, network);
  const spreadPct = new Decimal(getSpread(asset));
  const netCfg = getNetworkFees(asset, network);
  const networkPct = new Decimal(netCfg.gas).plus(netCfg.slippage);
  const platformPct = new Decimal(FEES.platform);

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

  const quotedPrice = side === 'BUY'
    ? marketPrice.mul(new Decimal(1).plus(spreadPct))
    : marketPrice.mul(new Decimal(1).minus(spreadPct));

  let fiatAmount: Decimal;
  let cryptoAmount: Decimal;
  let platformFee: Decimal;
  let networkFee: Decimal;
  let spreadCapture: Decimal;

  if (side === 'BUY') {
    if (opts.fiatAmount == null) throw new Error('fiatAmount required for BUY');
    fiatAmount = new Decimal(opts.fiatAmount);
    if (fiatAmount.lte(0)) throw new Error('fiatAmount must be > 0');

    platformFee = fiatAmount.mul(platformPct);
    networkFee = fiatAmount.mul(networkPct);
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
    fiatAmount = gross.minus(platformFee).minus(networkFee);
    if (fiatAmount.lte(0)) throw new Error('Amount too small to cover fees');
    spreadCapture = marketPrice.minus(quotedPrice).mul(cryptoAmount); // positive on SELL
  }

  const quote: Quote = {
    id: randomUUID(),
    side,
    asset,
    network: network.toUpperCase(),
    marketPrice: marketPrice.toFixed(8),
    quotedPrice: quotedPrice.toFixed(8),
    fiatAmount: fiatAmount.toFixed(8),
    cryptoAmount: cryptoAmount.toFixed(18),
    platformFee: platformFee.toFixed(8),
    networkFee: networkFee.toFixed(8),
    spreadCapture: spreadCapture.toFixed(8),
    totalUserPays: side === 'BUY' ? fiatAmount.toFixed(8) : cryptoAmount.toFixed(18),
    expiresAt: Date.now() + QUOTE_TTL_MS,
  };
  await setQuote(quote);
  return quote;
}
