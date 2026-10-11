/**
 * Executable conversion prices between two balances (wallet swap).
 *
 * Fiat legs price through the FX engine (Fulus parallel rate first, admin
 * override, spread applied). Crypto legs price through the market price
 * engine with the configured quote spread. A conversion is executed at the
 * customer side of each leg: the source currency is SOLD, the target BOUGHT.
 *
 * Static fallback rates are refused here — they exist so a quote screen can
 * render during a feed outage, not to execute customer conversions.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../middleware/errorHandler';
import { getRate } from './fxRateProvider.service';
import { getConfiguredSpread, getMarketPrice } from './priceEngine.service';

export const FIAT = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'TRY', 'TND']);
const USD_LIKE = new Set(['USD', 'USDT']);

export interface LegPrice { usdPerUnit: Decimal; source: string }

export async function executableUsdPrice(currency: string, side: 'SELL' | 'BUY'): Promise<LegPrice> {
  const cur = currency.toUpperCase();
  if (USD_LIKE.has(cur)) return { usdPerUnit: new Decimal(1), source: 'par' };

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
  const usd = amount.mul(fromLeg.usdPerUnit);
  const decimals = FIAT.has(to.toUpperCase()) ? (to.toUpperCase() === 'LYD' || to.toUpperCase() === 'TND' ? 3 : 2) : 8;
  // Round the credit DOWN so the platform never pays out fractions it did not price.
  const credited = usd.div(toLeg.usdPerUnit).toDecimalPlaces(decimals, Decimal.ROUND_DOWN);
  if (credited.lte(0)) throw new AppError('Amount is too small to convert', 400);
  return { from, to, amount, credited, rate: credited.div(amount), fromLeg, toLeg };
}
