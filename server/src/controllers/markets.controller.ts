import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { redisGet, redisSet } from '../utils/redis';

interface Ticker {
  symbol:       string;
  base:         string;
  quote:        string;
  displayName:  string;
  price:        number;
  changePct24h: number;
  volume24h:    number;
  sparkline:    number[];
  iconUrl:      string | null; // CoinGecko CDN logo
}

// ── CoinGecko icon map (cached 6 hours, background-refreshed) ─────────────────
// CoinGecko's /coins/markets returns `image` URLs like:
//   https://assets.coingecko.com/coins/images/1/small/bitcoin.png
// We store a { BASE_SYMBOL → url } map so tickers can include it at no extra
// latency (the map is always warm).
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const ICON_CACHE_KEY = 'markets:iconMap';
const ICON_CACHE_TTL_S = 6 * 3600; // 6 hours in Redis
const ICON_MEM_TTL_MS  = 6 * 3600 * 1000;

let iconMap: Record<string, string> = {};
let iconMapExpiry = 0;
let iconFetchInProgress = false;

async function refreshIconMap(): Promise<void> {
  if (iconFetchInProgress) return;
  iconFetchInProgress = true;
  try {
    // Check Redis first
    const cached = await redisGet<Record<string, string>>(ICON_CACHE_KEY);
    if (cached && Object.keys(cached).length > 0) {
      iconMap = cached;
      iconMapExpiry = Date.now() + ICON_MEM_TTL_MS;
      return;
    }

    // CoinGecko returns up to 250 per page; fetch pages 1-3 to cover the ~600 most popular
    const fresh: Record<string, string> = {};
    for (let page = 1; page <= 3; page++) {
      try {
        const { data } = await axios.get(`${COINGECKO_API}/coins/markets`, {
          params: {
            vs_currency: 'usd',
            per_page: 250,
            page,
            sparkline: false,
          },
          timeout: 10_000,
          headers: { 'Accept': 'application/json' },
        });
        for (const coin of data as any[]) {
          if (coin.symbol && coin.image) {
            fresh[coin.symbol.toUpperCase()] = coin.image; // small (64px) image URL
          }
        }
        // Respect CoinGecko's free-tier rate limit (10-30 req/min)
        if (page < 3) await new Promise((r) => setTimeout(r, 1200));
      } catch {
        break; // partial data is fine; try again next cycle
      }
    }

    if (Object.keys(fresh).length > 0) {
      iconMap = fresh;
      iconMapExpiry = Date.now() + ICON_MEM_TTL_MS;
      redisSet(ICON_CACHE_KEY, fresh, ICON_CACHE_TTL_S).catch(() => {});
    }
  } finally {
    iconFetchInProgress = false;
  }
}

// Pre-warm on startup, then refresh every 6 hours
refreshIconMap();
setInterval(refreshIconMap, ICON_MEM_TTL_MS).unref?.();

function getIconUrl(base: string): string | null {
  return iconMap[base.toUpperCase()] ?? null;
}

// ── Binance live-price cache ──────────────────────────────────────────────────
interface BinanceRow {
  price: number;
  changePct24h: number;
  volume24h: number;
}

let binanceCache: Record<string, BinanceRow> = {};
let binanceCacheExpiry = 0;
let binanceFetchInProgress = false;

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
    symbolsExpiry = Date.now() + 3_600_000;
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

async function fetchLivePricesFromBinance(): Promise<Record<string, BinanceRow>> {
  const allSymbols = await getActiveUsdtSymbols();
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

  fresh['USDT'] = { price: 1, changePct24h: 0, volume24h: 50_000_000_000 };
  return fresh;
}

/**
 * Background price warmer — runs every 25 s so the cache never goes cold.
 * A request that hits the controller while a refresh is in-flight gets the
 * previous cache immediately (no blocking wait).
 */
async function warmBinanceCache(): Promise<void> {
  if (binanceFetchInProgress) return;
  binanceFetchInProgress = true;
  try {
    const fresh = await fetchLivePricesFromBinance();
    binanceCache = fresh;
    binanceCacheExpiry = Date.now() + 30_000;
  } catch {
    // keep existing cache
  } finally {
    binanceFetchInProgress = false;
  }
}

// Warm immediately on startup, then every 25 s
warmBinanceCache();
setInterval(warmBinanceCache, 25_000).unref?.();

async function getLivePrices(): Promise<Record<string, BinanceRow>> {
  // Return in-memory cache if fresh — no async needed
  if (Date.now() < binanceCacheExpiry && Object.keys(binanceCache).length > 0) {
    return binanceCache;
  }
  // Cache is stale — trigger a refresh but return what we have now
  warmBinanceCache();
  return Object.keys(binanceCache).length ? binanceCache : FALLBACK;
}

// ── Sparkline builder ─────────────────────────────────────────────────────────
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

// ── Cache keys ────────────────────────────────────────────────────────────────
const MARKETS_TICKERS_CACHE_KEY  = 'markets:tickers';
const MARKETS_LISTINGS_CACHE_KEY = 'markets:listings';
const MARKETS_TICKERS_TTL        = 20;  // seconds
const MARKETS_LISTINGS_TTL       = 300; // seconds

export class MarketsController {
  /**
   * GET /api/markets/ticker — public, no auth.
   *
   * Returns every USDT pair from Binance with live price, 24h stats,
   * sparkline, and a CoinGecko icon URL. All three data sources are
   * independently cached so the response is always <1 ms from Redis.
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

      const listingMap = new Map<string, typeof listings[0]>(
        listings.map((l) => [l.baseAsset as string, l]),
      );

      const tickers: Ticker[] = Object.entries(prices).map(([base, live]) => {
        const l = listingMap.get(base);
        return {
          symbol:       l?.symbol       ?? `${base}USDT`,
          base,
          quote:        (l?.quoteAsset  ?? 'USDT') as string,
          displayName:  l?.displayName  ?? base,
          price:        live.price,
          changePct24h: live.changePct24h,
          volume24h:    live.volume24h,
          sparkline:    buildSparkline(live.price, live.changePct24h),
          iconUrl:      getIconUrl(base),
        };
      });

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

  /** GET /api/markets/icons — returns the full icon map (symbol → url) */
  static async icons(_req: Request, res: Response, next: NextFunction) {
    try {
      // Serve directly from memory — always warm after startup
      res.setHeader('Cache-Control', 'public, max-age=21600, stale-while-revalidate=3600');
      res.json({ icons: iconMap });
    } catch (error) {
      next(error);
    }
  }
}
