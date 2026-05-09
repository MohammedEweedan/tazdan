import { useEffect, useState } from "react";
export interface LivePrice {
  price: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  open24h: number;
  volume24h: number;
  ts: number;
}

const SYMBOLS_BASE = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'] as const;

const STABLE_USD: Record<string, number> = {
  USD: 1,
  USDT: 1,
  USDC: 1,
};

const SYMBOL_TO_BASE: Record<string, string> = Object.fromEntries(
  SYMBOLS_BASE.map((b) => [`${b}USDT`, b]),
);

let prices: Record<string, LivePrice> = {};
const subscribers = new Set<(p: Record<string, LivePrice>) => void>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let restSeeded = false;
let connectionStarted = false;

function notify() {
  const snapshot = prices;
  subscribers.forEach((fn) => fn(snapshot));
}

function applyTick(base: string, lp: LivePrice) {
  prices = { ...prices, [base]: lp };
  notify();
}

function seedFromRest() {
  if (restSeeded) return;
  restSeeded = true;
  const symbols = SYMBOLS_BASE.map((b) => `${b}USDT`);
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;

  console.log('[BinanceLive] Seeding from REST:', url);

  fetch(url)
    .then((r) => r.json())
    .then((rows: any[]) => {
      if (!Array.isArray(rows)) {
        console.warn('[BinanceLive] REST seed returned non-array');
        return;
      }
      const seed: Record<string, LivePrice> = {};
      const now = Date.now();
      rows.forEach((r) => {
        const base = SYMBOL_TO_BASE[r.symbol];
        if (!base) return;
        seed[base] = {
          price: parseFloat(r.lastPrice),
          changePct24h: parseFloat(r.priceChangePercent),
          high24h: parseFloat(r.highPrice),
          low24h: parseFloat(r.lowPrice),
          open24h: parseFloat(r.openPrice),
          volume24h: parseFloat(r.quoteVolume),
          ts: now,
        };
      });
      prices = { ...seed, ...prices };
      console.log('[BinanceLive] REST seed completed with', Object.keys(seed).length, 'symbols');
      notify();
    })
    .catch((e) => {
      console.error('[BinanceLive] REST seed failed:', e);
    });
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log('[BinanceLive] WebSocket already connected/connecting');
    return;
  }

  const parts: string[] = [];
  SYMBOLS_BASE.forEach((b) => {
    const sym = `${b.toLowerCase()}usdt`;
    parts.push(`${sym}@trade`);
    parts.push(`${sym}@ticker`);
  });
  const url = `wss://stream.binance.com:9443/stream?streams=${parts.join('/')}`;

  console.log('[BinanceLive] Connecting to:', url);

  try {
    ws = new WebSocket(url);
  } catch (e) {
    console.error('[BinanceLive] WebSocket creation failed:', e);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[BinanceLive] WebSocket connected');
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      const d = msg?.data;
      if (!d || !d.s) return;
      const base = SYMBOL_TO_BASE[d.s];
      if (!base) return;
      const e = d.e as string;
      const now = Date.now();
      const prev = prices[base];

      if (e === 'trade') {
        const px = parseFloat(d.p);
        applyTick(base, {
          price: px,
          changePct24h: prev?.changePct24h ?? 0,
          high24h: prev?.high24h ?? px,
          low24h: prev?.low24h ?? px,
          open24h: prev?.open24h ?? px,
          volume24h: prev?.volume24h ?? 0,
          ts: now,
        });
      } else if (e === '24hrTicker') {
        applyTick(base, {
          price: prev?.price ?? parseFloat(d.c),
          changePct24h: parseFloat(d.P),
          high24h: parseFloat(d.h),
          low24h: parseFloat(d.l),
          open24h: parseFloat(d.o),
          volume24h: parseFloat(d.q),
          ts: prev?.ts ?? now,
        });
      }
    } catch (err) {
      console.error('[BinanceLive] Message parse error:', err);
    }
  };

  ws.onclose = () => {
    console.log('[BinanceLive] WebSocket closed, scheduling reconnect');
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = (e) => {
    console.error('[BinanceLive] WebSocket error:', e);
    try {
      ws?.close();
    } catch {}
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 2000);
}

function startConnection() {
  if (connectionStarted) return;
  connectionStarted = true;
  seedFromRest();
  connect();
}

export function useBinanceLive(): Record<string, LivePrice> {
  const [snap, setSnap] = useState(prices);

  useEffect(() => {
    console.log('[BinanceLive] Hook mounted, starting connection');
    subscribers.add(setSnap);
    startConnection();
    return () => {
      console.log('[BinanceLive] Hook unmounted');
      subscribers.delete(setSnap);
    };
  }, []);

  return snap;
}

export function useBinanceLivePrice(base: string): LivePrice | null {
  const all = useBinanceLive();
  const sym = base.toUpperCase();

  if (STABLE_USD[sym] !== undefined) {
    return {
      price: STABLE_USD[sym],
      changePct24h: 0,
      high24h: STABLE_USD[sym],
      low24h: STABLE_USD[sym],
      open24h: STABLE_USD[sym],
      volume24h: 0,
      ts: Date.now(),
    };
  }

  return all[sym] ?? null;
}

export function useLivePrice(base: string): number | null {
  return useBinanceLivePrice(base)?.price ?? null;
}

export function priceForCurrency(base: string, live: Record<string, LivePrice>): number | undefined {
  const sym = base.toUpperCase();
  if (STABLE_USD[sym] !== undefined) return STABLE_USD[sym];
  return live[sym]?.price;
}

export function changeForCurrency(base: string, live: Record<string, LivePrice>): number | undefined {
  const sym = base.toUpperCase();
  if (STABLE_USD[sym] !== undefined) return 0;
  return live[sym]?.changePct24h;
}