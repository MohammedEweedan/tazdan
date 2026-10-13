/**
 * Executable conversion prices between two balances (wallet swap).
 *
 * Fiat legs price through the FX engine (spread applied). The LYD leg is
 * priced by the LYD market maker: a customer selling LYD buys USD from us at
 * our ASK, and a customer buying LYD sells USD to us at our BID, both pip
 * quotes around the Fulus reference. USDT/LYD is therefore USDT at par
 * through the same USD/LYD quote. Crypto legs price through the market price
 * engine with the configured quote spread. The source currency is SOLD and
 * the target BOUGHT.
 *
 * Static fallback rates are refused here. They exist so a quote screen can
 * render during a feed outage, not to execute customer conversions.
 */
import { Decimal } from '@prisma/client/runtime/library';
import type { Currency } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import type { Leg } from '../ledger/ledger.service';
import { getRate } from './fxRateProvider.service';
import { quoteLydMarket } from './lydMarketMaker.service';
import { getConfiguredSpread, getMarketPrice } from './priceEngine.service';

export const FIAT = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'TRY', 'TND']);
const USD_LIKE = new Set(['USD', 'USDT']);

/** The market maker's side of a LYD leg. Internal: never returned to customers. */
export interface LydLeg {
  /** ASK: we sold USD (the customer paid LYD). BID: we bought USD (the customer received LYD). */
  side: 'ASK' | 'BID';
  /** LYD per USD at our side of the quote. */
  price: Decimal;
  /** Fulus USD/LYD reference the quote was built on. */
  reference: Decimal;
}

export interface LegPrice { usdPerUnit: Decimal; source: string; lyd?: LydLeg }

export async function executableUsdPrice(currency: string, side: 'SELL' | 'BUY'): Promise<LegPrice> {
  const cur = currency.toUpperCase();
  if (USD_LIKE.has(cur)) return { usdPerUnit: new Decimal(1), source: 'par' };

  if (cur === 'LYD') {
    let q;
    try {
      q = await quoteLydMarket('USD');
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Live LYD pricing is unavailable right now. Please try again shortly.', 503, 'PROVIDER_UNAVAILABLE');
    }
    const lydSide: LydLeg['side'] = side === 'SELL' ? 'ASK' : 'BID';
    const price = new Decimal((lydSide === 'ASK' ? q.ask : q.bid).toString());
    return {
      usdPerUnit: new Decimal(1).div(price),
      source: 'live:fulus',
      lyd: { side: lydSide, price, reference: new Decimal(q.reference.toString()) },
    };
  }

  if (FIAT.has(cur)) {
    let pair;
    try {
      pair = await getRate(cur, 'USD');
    } catch {
      throw new AppError(`No live ${cur}/USD rate is available right now`, 503, 'PROVIDER_UNAVAILABLE');
    }
    if (pair.source.startsWith('fallback:')) {
      throw new AppError(`Live ${cur} pricing is unavailable right now. Please try again shortly.`, 503, 'PROVIDER_UNAVAILABLE');
    }
    const px = new Decimal(side === 'SELL' ? pair.sellPrice : pair.buyPrice);
    if (!px.isFinite() || px.lte(0)) throw new AppError(`Invalid ${cur}/USD rate`, 503, 'PROVIDER_UNAVAILABLE');
    return { usdPerUnit: px, source: pair.source };
  }

  let mid: Decimal;
  try {
    mid = await getMarketPrice(`${cur}USDT`);
  } catch {
    throw new AppError(`No live ${cur} price is available right now`, 503, 'PROVIDER_UNAVAILABLE');
  }
  const spread = await getConfiguredSpread();
  const px = side === 'SELL' ? mid.mul(new Decimal(1).minus(spread)) : mid.mul(new Decimal(1).plus(spread));
  return { usdPerUnit: px, source: `market±${spread.toString()}` };
}

export interface ConversionQuote {
  from: string;
  to: string;
  amount: Decimal;
  credited: Decimal;
  rate: Decimal; // units of `to` per 1 `from`
  fromLeg: LegPrice;
  toLeg: LegPrice;
}

export async function quoteConversion(from: string, to: string, amount: Decimal): Promise<ConversionQuote> {
  const [fromLeg, toLeg] = await Promise.all([executableUsdPrice(from, 'SELL'), executableUsdPrice(to, 'BUY')]);
  // LYD legs use the quoted LYD-per-USD price directly (exact), not its inverse.
  const usd = fromLeg.lyd ? amount.div(fromLeg.lyd.price) : amount.mul(fromLeg.usdPerUnit);
  const decimals = FIAT.has(to.toUpperCase()) ? (to.toUpperCase() === 'LYD' || to.toUpperCase() === 'TND' ? 3 : 2) : 8;
  // Round the credit DOWN so the platform never pays out fractions it did not price.
  const raw = toLeg.lyd ? usd.mul(toLeg.lyd.price) : usd.div(toLeg.usdPerUnit);
  const credited = raw.toDecimalPlaces(decimals, Decimal.ROUND_DOWN);
  if (credited.lte(0)) throw new AppError('Amount is too small to convert', 400);
  return { from, to, amount, credited, rate: credited.div(amount), fromLeg, toLeg };
}

/**
 * LYD the market maker captured against the Fulus reference on a conversion
 * with a LYD leg, rounded down to the dirham. Zero when no leg is LYD.
 *   customer paid LYD:     m = amount − (USD delivered) × reference
 *   customer received LYD: m = (USD received) × reference − credited
 */
export function lydConversionMargin(q: ConversionQuote): Decimal {
  let m = new Decimal(0);
  if (q.fromLeg.lyd) m = q.amount.minus(q.credited.mul(q.toLeg.usdPerUnit).mul(q.fromLeg.lyd.reference));
  else if (q.toLeg.lyd) m = q.amount.mul(q.fromLeg.usdPerUnit).mul(q.toLeg.lyd.reference).minus(q.credited);
  return Decimal.max(0, m).toDecimalPlaces(3, Decimal.ROUND_DOWN);
}

/**
 * Swap journal with the market maker's margin recognised as PLATFORM revenue
 * through the existing ledger path. No new money movement: the customer
 * legs are unchanged, and SYSTEM_FX's LYD leg is split so the FX position is
 * flat at the reference. Balanced per currency. Without a LYD leg it is the
 * plain four-leg swap journal.
 */
export function conversionLedgerLegs(userId: string, q: ConversionQuote): Leg[] {
  const from = q.from.toUpperCase() as Currency;
  const to = q.to.toUpperCase() as Currency;
  const m = lydConversionMargin(q);
  if (m.gt(0) && from === 'LYD') {
    return [
      { type: 'USER', userId, currency: from, amount: q.amount.neg() },
      { type: 'SYSTEM_FX', currency: from, amount: q.amount.minus(m) },
      { type: 'PLATFORM', currency: from, amount: m },
      { type: 'SYSTEM_FX', currency: to, amount: q.credited.neg() },
      { type: 'USER', userId, currency: to, amount: q.credited },
    ];
  }
  if (m.gt(0) && to === 'LYD') {
    return [
      { type: 'USER', userId, currency: from, amount: q.amount.neg() },
      { type: 'SYSTEM_FX', currency: from, amount: q.amount },
      { type: 'SYSTEM_FX', currency: to, amount: q.credited.plus(m).neg() },
      { type: 'PLATFORM', currency: to, amount: m },
      { type: 'USER', userId, currency: to, amount: q.credited },
    ];
  }
  return [
    { type: 'USER', userId, currency: from, amount: q.amount.neg() },
    { type: 'SYSTEM_FX', currency: from, amount: q.amount },
    { type: 'SYSTEM_FX', currency: to, amount: q.credited.neg() },
    { type: 'USER', userId, currency: to, amount: q.credited },
  ];
}
