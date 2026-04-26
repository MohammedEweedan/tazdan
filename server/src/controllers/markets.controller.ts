import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

/**
 * Markets controller — drives the homepage / mobile dashboard ticker.
 *
 * Source of truth is the `MarketListing` table (seeded in utils/seed.ts).
 * Live price / volume / sparkline are not yet wired to a real exchange feed,
 * so we generate deterministic-but-jittered demo values per request. Swap
 * `computeTicker` for a real price oracle (Binance, CoinGecko) when ready.
 */

interface Ticker {
  symbol: string;
  base: string;
  quote: string;
  displayName: string;
  price: number;
  changePct24h: number;
  volume24h: number;
  sparkline: number[];
  iconUrl?: string;
}

/* Baseline prices (USD) for demo. Real implementation should pull these from
   a live source and cache on a short TTL. */
const BASELINE: Record<string, { price: number; vol: number; vol24h: number }> = {
  BTC:   { price: 65_240,  vol: 800,  vol24h: 32_400_000_000 },
  ETH:   { price:  3_215,  vol: 25,   vol24h: 14_200_000_000 },
  SOL:   { price:    150,  vol: 3,    vol24h:  2_100_000_000 },
  BNB:   { price:    602,  vol: 5,    vol24h:  1_200_000_000 },
  XRP:   { price:   0.55,  vol: 0.01, vol24h:    900_000_000 },
  ADA:   { price:   0.45,  vol: 0.008,vol24h:    400_000_000 },
  DOGE:  { price:   0.12,  vol: 0.003,vol24h:    600_000_000 },
  MATIC: { price:   0.62,  vol: 0.01, vol24h:    180_000_000 },
  DOT:   { price:    7.40, vol: 0.10, vol24h:    160_000_000 },
  AVAX:  { price:   34.20, vol: 0.50, vol24h:    220_000_000 },
  USDT:  { price:    1.00, vol: 0.001,vol24h: 50_000_000_000 },
};

/** Build a demo sparkline of `n` close prices around `base`. */
function sparkline(base: number, vol: number, n = 24): number[] {
  const out: number[] = [];
  let last = base;
  for (let i = 0; i < n; i++) {
    last = last + (Math.sin(i / 3) + Math.cos(i / 5)) * vol + (Math.random() - 0.5) * vol * 0.5;
    out.push(Number(last.toFixed(2)));
  }
  return out;
}

function computeTicker(symbol: string, base: string, quote: string, displayName: string | null): Ticker {
  const cfg = BASELINE[base] ?? { price: 1, vol: 0.01, vol24h: 1_000_000 };
  const change = +((Math.random() * 8) - 3).toFixed(2); // -3% to +5%
  return {
    symbol,
    base,
    quote,
    displayName: displayName ?? base,
    price: cfg.price,
    changePct24h: change,
    volume24h: cfg.vol24h,
    sparkline: sparkline(cfg.price, cfg.vol),
  };
}

export class MarketsController {
  /** GET /api/markets/ticker — public, no auth */
  static async tickers(_req: Request, res: Response, next: NextFunction) {
    try {
      const listings = await prisma.marketListing.findMany({
        where: { isActive: true },
        orderBy: { rank: 'asc' },
      });

      const tickers: Ticker[] = listings.map((l) =>
        computeTicker(l.symbol, l.baseAsset, l.quoteAsset, l.displayName),
      );

      res.json({ tickers });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/markets/listings — public catalogue (no demo prices) */
  static async listings(_req: Request, res: Response, next: NextFunction) {
    try {
      const listings = await prisma.marketListing.findMany({
        where: { isActive: true },
        orderBy: { rank: 'asc' },
      });
      res.json({ listings });
    } catch (error) {
      next(error);
    }
  }
}
