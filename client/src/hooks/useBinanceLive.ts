"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────
   Direct Binance WebSocket → browser stream.
   - Free, no auth, no rate limits, no API key.
   - 1 update per second per symbol.
   - Singleton pattern: one WS for the whole app, many subscribers.
   - REST seed for instant first paint, then WS takes over.
   ───────────────────────────────────────────────────────────────── */

export interface LivePrice {
  price: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  open24h: number;
  volume24h: number;
  /** ms timestamp of last tick — useful for staleness checks */
  ts: number;
}

const SYMBOLS_BASE = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE"] as const;

/* Stable-coins or fiat that quote 1:1 against USD (no Binance feed needed) */
const STABLE_USD: Record<string, number> = {
  USD:  1.0,
  USDT: 1.0,
  USDC: 1.0,
};

const SYMBOL_TO_BASE: Record<string, string> = Object.fromEntries(
  SYMBOLS_BASE.map(b => [`${b}USDT`, b]),
);

/* ── Module-level singleton state ── */
let prices: Record<string, LivePrice> = {};
const subscribers = new Set<(p: Record<string, LivePrice>) => void>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let restSeeded = false;
let connectionStarted = false;

function notify() {
  const snapshot = prices;
  subscribers.forEach(fn => fn(snapshot));
}

function applyTick(base: string, lp: LivePrice) {
  prices = { ...prices, [base]: lp };
  notify();
}

function seedFromRest() {
  if (restSeeded) return;
  restSeeded = true;
  const symbols = SYMBOLS_BASE.map(b => `${b}USDT`);
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  fetch(url)
    .then(r => r.json())
    .then((rows: any[]) => {
      if (!Array.isArray(rows)) return;
      const seed: Record<string, LivePrice> = {};
      const now = Date.now();
      rows.forEach(r => {
        const base = SYMBOL_TO_BASE[r.symbol];
        if (!base) return;
        seed[base] = {
          price:        parseFloat(r.lastPrice),
          changePct24h: parseFloat(r.priceChangePercent),
          high24h:      parseFloat(r.highPrice),
          low24h:       parseFloat(r.lowPrice),
          open24h:      parseFloat(r.openPrice),
          volume24h:    parseFloat(r.quoteVolume),
          ts:           now,
        };
      });
      // Don't overwrite WS data that may already have arrived
      prices = { ...seed, ...prices };
      notify();
    })
    .catch(() => { /* fall back silently — WS will catch up */ });
}

function connect() {
  if (typeof window === "undefined") return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  /* Subscribe to BOTH streams per symbol:
   *   - @trade   : fires on EVERY market trade (multiple per second on BTC) → visceral price movement
   *   - @ticker  : fires once per second with 24h stats (high/low/open/% change/volume)
   */
  const parts: string[] = [];
  SYMBOLS_BASE.forEach(b => {
    const sym = `${b.toLowerCase()}usdt`;
    parts.push(`${sym}@trade`);
    parts.push(`${sym}@ticker`);
  });
  const url = `wss://stream.binance.com:9443/stream?streams=${parts.join("/")}`;

  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      const d   = msg?.data;
      if (!d || !d.s) return;
      const base = SYMBOL_TO_BASE[d.s];
      if (!base) return;
      const e   = d.e as string;     // "trade" or "24hrTicker"
      const now = Date.now();
      const prev = prices[base];

      if (e === "trade") {
        /* Every trade — update price + ts immediately, keep last 24h stats */
        const px = parseFloat(d.p);
        applyTick(base, {
          price:        px,
          changePct24h: prev?.changePct24h ?? 0,
          high24h:      prev?.high24h ?? px,
          low24h:       prev?.low24h ?? px,
          open24h:      prev?.open24h ?? px,
          volume24h:    prev?.volume24h ?? 0,
          ts:           now,
        });
      } else if (e === "24hrTicker") {
        /* Once per second — refresh 24h stats, keep latest live price */
        applyTick(base, {
          price:        prev?.price ?? parseFloat(d.c),
          changePct24h: parseFloat(d.P),
          high24h:      parseFloat(d.h),
          low24h:       parseFloat(d.l),
          open24h:      parseFloat(d.o),
          volume24h:    parseFloat(d.q),
          ts:           prev?.ts ?? now,
        });
      }
    } catch { /* ignore parse errors */ }
  };

  ws.onclose = () => {
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    try { ws?.close(); } catch {}
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

/* ─────────────────────────────────────────────────────────────────
   PUBLIC HOOKS
   ───────────────────────────────────────────────────────────────── */

/** Subscribe to ALL live prices. Re-renders every tick (~1/sec/symbol). */
export function useBinanceLive(): Record<string, LivePrice> {
  const [snap, setSnap] = useState(prices);
  useEffect(() => {
    subscribers.add(setSnap);
    startConnection();
    return () => { subscribers.delete(setSnap); };
  }, []);
  return snap;
}

/** Convenience: live price for ONE asset. Returns null until first tick. */
export function useBinanceLivePrice(base: string): LivePrice | null {
  const all = useBinanceLive();
  const sym = base.toUpperCase();
  if (STABLE_USD[sym] !== undefined) {
    return {
      price: STABLE_USD[sym],
      changePct24h: 0,
      high24h: STABLE_USD[sym],
      low24h:  STABLE_USD[sym],
      open24h: STABLE_USD[sym],
      volume24h: 0,
      ts: Date.now(),
    };
  }
  return all[sym] ?? null;
}

/** Convenience: USD value for any currency (treats stable-coins as $1). */
export function priceForCurrency(base: string, live: Record<string, LivePrice>): number | undefined {
  const sym = base.toUpperCase();
  if (STABLE_USD[sym] !== undefined) return STABLE_USD[sym];
  return live[sym]?.price;
}

/** Convenience: 24h % change for any currency (stable-coins → 0). */
export function changeForCurrency(base: string, live: Record<string, LivePrice>): number | undefined {
  const sym = base.toUpperCase();
  if (STABLE_USD[sym] !== undefined) return 0;
  return live[sym]?.changePct24h;
}
