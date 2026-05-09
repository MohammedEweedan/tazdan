import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../utils/prisma';

interface Ticker {
  symbol: string;
  base: string;
  quote: string;
  displayName: string;
  price: number;
  changePct24h: number;
  volume24h: number;
  sparkline: number[];
}

/* ── Binance public ticker cache (no API key needed) ──────────────────
   Uses the free Binance REST endpoint — 1 200 requests/min per IP.
   We cache for 30 s so a busy landing page won't exhaust the limit.
   ─────────────────────────────────────────────────────────────────── */

interface BinanceRow {
  price: number;
  changePct24h: number;
  volume24h: number;
}

let binanceCache: Record<string, BinanceRow> = {};
let binanceCacheExpiry = 0;

const BINANCE_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT',
  'ADAUSDT','DOGEUSDT','MATICUSDT','DOTUSDT','AVAXUSDT','USDTUSDT',
];

/* Fallback prices used only when Binance is unreachable */
const FALLBACK: Record<string, BinanceRow> = {
  BTC:   { price: 65_240,  changePct24h: 0, volume24h: 32_400_000_000 },
  ETH:   { price:  3_215,  changePct24h: 0, volume24h: 14_200_000_000 },
  SOL:   { price:    150,  changePct24h: 0, volume24h:  2_100_000_000 },
  BNB:   { price:    602,  changePct24h: 0, volume24h:  1_200_000_000 },
  XRP:   { price:   0.55,  changePct24h: 0, volume24h:    900_000_000 },
  ADA:   { price:   0.45,  changePct24h: 0, volume24h:    400_000_000 },
  DOGE:  { price:   0.12,  changePct24h: 0, volume24h:    600_000_000 },
  MATIC: { price:   0.62,  changePct24h: 0, volume24h:    180_000_000 },
  DOT:   { price:    7.40, changePct24h: 0, volume24h:    160_000_000 },
  AVAX:  { price:   34.20, changePct24h: 0, volume24h:    220_000_000 },
  USDT:  { price:    1.00, changePct24h: 0, volume24h: 50_000_000_000 },
};

async function getLivePrices(): Promise<Record<string, BinanceRow>> {
  if (Date.now() < binanceCacheExpiry) return binanceCache;

  try {
    const symbols = encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS));
    const { data } = await axios.get(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`,
      { timeout: 5_000 },
    );

    const fresh: Record<string, BinanceRow> = {};
    for (const row of data as any[]) {
      const base = (row.symbol as string).replace('USDT', '');
      fresh[base] = {
        price: parseFloat(row.lastPrice),
        changePct24h: parseFloat(row.priceChangePercent),
        volume24h: parseFloat(row.quoteVolume),
      };
    }

    binanceCache = fresh;
    binanceCacheExpiry = Date.now() + 30_000;
    return fresh;
  } catch {
    /* Return stale cache if available, otherwise fallback constants */
    return Object.keys(binanceCache).length ? binanceCache : FALLBACK;
  }
}

/* Build a sparkline that traces the 24-hour shape around the live price */
function buildSparkline(price: number, changePct: number, n = 24): number[] {
  const start = price / (1 + changePct / 100);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const trend = start + (price - start) * t;
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * price * 0.003;
    out.push(Number((trend + noise).toFixed(price >= 1 ? 2 : 6)));
  }
  return out;
}

export class MarketsController {
  /** GET /api/markets/ticker — public, no auth */
  static async tickers(_req: Request, res: Response, next: NextFunction) {
    try {
      const [listings, prices] = await Promise.all([
        prisma.marketListing.findMany({ where: { isActive: true }, orderBy: { rank: 'asc' } }),
        getLivePrices(),
      ]);

      const tickers: Ticker[] = listings.map((l) => {
        const live = prices[l.baseAsset] ?? FALLBACK[l.baseAsset];
        return {
          symbol: l.symbol,
          base: l.baseAsset,
          quote: l.quoteAsset,
          displayName: l.displayName ?? l.baseAsset,
          price: live?.price ?? 0,
          changePct24h: live?.changePct24h ?? 0,
          volume24h: live?.volume24h ?? 0,
          sparkline: live ? buildSparkline(live.price, live.changePct24h) : [],
        };
      });

      res.json({ tickers });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/markets/listings — public catalogue (no prices) */
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
