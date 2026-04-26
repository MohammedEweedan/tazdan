/**
 * Binance market-data abstraction.
 *
 * Frontend pulls live spot prices and OHLCV candles from this layer. Switching
 * to a different exchange (Bybit, OKX, Kraken) means swapping providers without
 * touching the routes.
 *
 * Real implementation TODO: REST polling 8s for spot ticker, klines endpoint
 * for OHLCV by interval, optional WebSocket bridge to socket.io rooms.
 */

import type { Currency } from '@prisma/client';

export interface SpotTicker {
  symbol: string;        // e.g. "BTCUSDT"
  price: number;
  changePercent24h: number;
  volume24h: number;
}

export type OhlcvInterval = '1H' | '1D' | '1W' | '1M' | '1Y';

export interface OhlcvCandle {
  openTime: number;      // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataProvider {
  readonly name: string;
  /** Single-symbol ticker. Throws if symbol unknown. */
  ticker(symbol: string): Promise<SpotTicker>;
  /** Multi-symbol ticker (1 round-trip). */
  tickers(symbols: string[]): Promise<SpotTicker[]>;
  /** OHLCV candles for chart rendering. `range` defines lookback window AND default candle size. */
  ohlcv(symbol: string, range: OhlcvInterval): Promise<OhlcvCandle[]>;
}

// Default symbol mapping — base+quote → Binance pair
export function pairSymbol(base: Currency, quote: Currency = 'USDT' as Currency): string {
  return `${base}${quote}`;
}

// ─── Mock implementation ─────────────────────────────────────────────
// Deterministic-ish fake data that "drifts" so the UI sparkline animates.
class MockMarketDataProvider implements MarketDataProvider {
  readonly name = 'mock';
  private base: Record<string, number> = {
    BTCUSDT: 65_000, ETHUSDT: 3_200, SOLUSDT: 150,
    BNBUSDT: 600,    XRPUSDT: 0.55,  ADAUSDT: 0.45,
    DOGEUSDT: 0.15,  MATICUSDT: 0.7, DOTUSDT: 7, AVAXUSDT: 35,
  };

  async ticker(symbol: string): Promise<SpotTicker> {
    const base = this.base[symbol];
    if (base == null) throw new Error(`Unknown symbol ${symbol}`);
    const wobble = (Math.sin(Date.now() / 60_000) + 1) * 0.02; // ±2% over 60s
    const price = base * (1 + wobble - 0.02);
    return {
      symbol,
      price: Number(price.toFixed(price < 1 ? 6 : 2)),
      changePercent24h: Number(((wobble - 0.02) * 100).toFixed(2)),
      volume24h: Math.round(base * 1_000),
    };
  }

  async tickers(symbols: string[]): Promise<SpotTicker[]> {
    return Promise.all(symbols.map((s) => this.ticker(s)));
  }

  async ohlcv(symbol: string, range: OhlcvInterval): Promise<OhlcvCandle[]> {
    const t = await this.ticker(symbol);
    const buckets = { '1H': 60, '1D': 96, '1W': 168, '1M': 90, '1Y': 365 } as const;
    const stepMs = { '1H': 60_000, '1D': 15 * 60_000, '1W': 60 * 60_000, '1M': 8 * 60 * 60_000, '1Y': 24 * 60 * 60_000 } as const;
    const n = buckets[range];
    const step = stepMs[range];
    const now = Date.now();
    const candles: OhlcvCandle[] = [];
    let last = t.price * 0.95;
    for (let i = n; i >= 0; i--) {
      const drift = (Math.sin(i / 6) + Math.cos(i / 4)) * 0.005;
      const open = last;
      const close = open * (1 + drift);
      const high = Math.max(open, close) * 1.003;
      const low = Math.min(open, close) * 0.997;
      candles.push({
        openTime: now - i * step,
        open: Number(open.toFixed(open < 1 ? 6 : 2)),
        high: Number(high.toFixed(high < 1 ? 6 : 2)),
        low:  Number(low.toFixed(low < 1 ? 6 : 2)),
        close: Number(close.toFixed(close < 1 ? 6 : 2)),
        volume: Math.round(Math.random() * 100),
      });
      last = close;
    }
    return candles;
  }
}

// ─── Binance REST stub (TODO: real axios calls + WS bridge) ──────────
class BinanceMarketDataProvider implements MarketDataProvider {
  readonly name = 'binance';
  // Real impl will hit:
  //   GET https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT
  //   GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=…
  // and stream wss://stream.binance.com:9443/ws/btcusdt@ticker
  async ticker(_symbol: string): Promise<SpotTicker> { throw new Error('Binance provider not implemented. Set MARKET_PROVIDER=MOCK or implement REST/WS calls.'); }
  async tickers(_symbols: string[]): Promise<SpotTicker[]> { throw new Error('Binance provider not implemented.'); }
  async ohlcv(_s: string, _r: OhlcvInterval): Promise<OhlcvCandle[]> { throw new Error('Binance provider not implemented.'); }
}

let cached: MarketDataProvider | null = null;

export function getMarketDataProvider(): MarketDataProvider {
  if (cached) return cached;
  const name = (process.env.MARKET_PROVIDER || 'MOCK').toUpperCase();
  switch (name) {
    case 'BINANCE': cached = new BinanceMarketDataProvider(); break;
    case 'MOCK':
    default:        cached = new MockMarketDataProvider();    break;
  }
  return cached;
}

export function __resetMarketDataProvider() { cached = null; }
