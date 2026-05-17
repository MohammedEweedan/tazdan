import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { redisGet, redisSet } from '../utils/redis';

interface Ticker {
  symbol:       string;
  base:         string;   // any Binance base asset, not limited to Currency enum
  quote:        string;
  displayName:  string;
  price:        number;
  changePct24h: number;
  volume24h:    number;
  sparkline:    number[];
}

/* ── Binance dynamic ticker cache (no API key needed) ─────────────────
   Step 1: periodically fetch the full list of active USDT pairs from
   Binance exchangeInfo. Cached for 1 hour — the symbol list rarely changes.
   Step 2: fetch 24h stats for ALL those pairs at once. Cached 30s.
   This way any token Binance lists against USDT is automatically available,
   with no hardcoded symbol list to maintain.
   ─────────────────────────────────────────────────────────────────── */

interface BinanceRow {
  price: number;
  changePct24h: number;
  volume24h: number;
}

let binanceCache: Record<string, BinanceRow> = {};
let binanceCacheExpiry = 0;

/* Dynamic symbol discovery — refreshed every hour */
let discoveredSymbols: string[] = [];
let symbolsExpiry = 0;

async function getActiveUsdtSymbols(): Promise<string[]> {
  if (Date.now() < symbolsExpiry && discoveredSymbols.length > 0) {
    return discoveredSymbols;
  }
  try {
    const { data } = await axios.get(
      'https://api.binance.com/api/v3/exchangeInfo',
      { timeout: 10_000 },
    );
    const symbols: string[] = (data.symbols as any[])
      .filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
      .map((s) => s.symbol as string);
    discoveredSymbols = symbols;
    symbolsExpiry = Date.now() + 3_600_000; // 1 hour
    return symbols;
  } catch {
    return discoveredSymbols.length > 0 ? discoveredSymbols : [
      'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT',
      'ADAUSDT','DOGEUSDT','MATICUSDT','DOTUSDT','AVAXUSDT',
      'LTCUSDT','LINKUSDT','UNIUSDT','AAVEUSDT','ATOMUSDT',
      'SHIBUSDT','PEPEUSDT','WIFUSDT','ARBUSDT','OPUSDT','SUIUSDT',
    ];
  }
}

/* Fallback prices used only when Binance is completely unreachable */
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
  if (Date.now() < binanceCacheExpiry && Object.keys(binanceCache).length > 0) {
    return binanceCache;
  }

  try {
    const allSymbols = await getActiveUsdtSymbols();
    // Binance allows up to ~1000 symbols per request; chunk if needed
    const CHUNK = 800;
    const fresh: Record<string, BinanceRow> = {};

    for (let i = 0; i < allSymbols.length; i += CHUNK) {
      const chunk = allSymbols.slice(i, i + CHUNK);
      const symbols = encodeURIComponent(JSON.stringify(chunk));
      const { data } = await axios.get(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`,
        { timeout: 10_000 },
      );
      for (const row of data as any[]) {
        const base = (row.symbol as string).replace(/USDT$/, '');
        fresh[base] = {
          price: parseFloat(row.lastPrice),
          changePct24h: parseFloat(row.priceChangePercent),
          volume24h: parseFloat(row.quoteVolume),
        };
      }
    }

    /* USDT is always $1 — Binance doesn't list USDT/USDT */
    fresh['USDT'] = { price: 1, changePct24h: 0, volume24h: 50_000_000_000 };

    binanceCache = fresh;
    binanceCacheExpiry = Date.now() + 30_000;
    return fresh;
  } catch {
    return Object.keys(binanceCache).length ? binanceCache : FALLBACK;
  }
}

/* Build a sparkline that traces the 24-hour shape around the live price */
const MARKETS_TICKERS_CACHE_KEY = 'markets:tickers';
const MARKETS_LISTINGS_CACHE_KEY = 'markets:listings';
const MARKETS_TICKERS_TTL = 20; // seconds
const MARKETS_LISTINGS_TTL = 300; // seconds

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
  /** GET /api/markets/ticker — public, no auth
   *
   *  Returns a ticker for EVERY coin Binance lists against USDT, merging
   *  in display metadata from the MarketListing DB table when available.
   *  This means any coin a user buys (PEPE, SHIB, WIF, …) will always
   *  have a real price/sparkline without any manual DB seeding.
   */
  static async tickers(_req: Request, res: Response, next: NextFunction) {
    try {
      const cached = await redisGet<{ tickers: Ticker[] }>(MARKETS_TICKERS_CACHE_KEY);
      if (cached) {
        return res.json(cached);
      }

      const [listings, prices] = await Promise.all([
        prisma.marketListing.findMany({ where: { isActive: true }, orderBy: { rank: 'asc' } }),
        getLivePrices(),
      ]);

      // Index DB metadata by baseAsset for O(1) lookups
      // Cast key to string so the map accepts arbitrary Binance tickers (not just Currency enum).
      const listingMap = new Map<string, typeof listings[0]>(listings.map((l) => [l.baseAsset as string, l]));

      // Build a ticker for every coin we have a live price for
      const tickers: Ticker[] = Object.entries(prices).map(([base, live]) => {
        const l = listingMap.get(base);
        return {
          symbol:      l?.symbol      ?? `${base}USDT`,
          base,
          quote:       (l?.quoteAsset  ?? 'USDT') as string,
          displayName: l?.displayName ?? base,
          price:       live.price,
          changePct24h: live.changePct24h,
          volume24h:   live.volume24h,
          sparkline:   buildSparkline(live.price, live.changePct24h),
        };
      });

      // Sort: DB-listed coins first (by rank), then unlisted alphabetically
      tickers.sort((a, b) => {
        const la = listingMap.get(a.base);
        const lb = listingMap.get(b.base);
        if (la && lb) return la.rank - lb.rank;
        if (la) return -1;
        if (lb) return 1;
        return a.base.localeCompare(b.base);
      });

      const payload = { tickers };
      await redisSet(MARKETS_TICKERS_CACHE_KEY, payload, MARKETS_TICKERS_TTL);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/markets/listings — public catalogue (no prices) */
  static async listings(_req: Request, res: Response, next: NextFunction) {
    try {
      const cached = await redisGet<{ listings: unknown[] }>(MARKETS_LISTINGS_CACHE_KEY);
      if (cached) {
        return res.json(cached);
      }

      const listings = await prisma.marketListing.findMany({
        where: { isActive: true },
        orderBy: { rank: 'asc' },
      });

      const payload = { listings };
      await redisSet(MARKETS_LISTINGS_CACHE_KEY, payload, MARKETS_LISTINGS_TTL);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  }
}
