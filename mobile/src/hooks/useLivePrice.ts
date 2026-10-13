import { useEffect, useState } from "react";
import { AppState } from "react-native";
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

/* ── Connection policy ────────────────────────────────────────────────────
   Binance's default stream host (stream.binance.com:9443) is unreachable on
   some networks — the old loop then reconnected every 2 s forever and logged
   the whole error event each time. Now:
   - rotate through Binance's public market-data hosts (the :443 port and the
     binance.vision mirror usually work where :9443 is blocked);
   - exponential backoff with jitter (2 s → 60 s), reset when a stream opens;
   - while no stream is open, REST-poll the 24h tickers (also with a mirror)
     so prices stay fresh;
   - pause in the background and when nothing is subscribed;
   - one short dev-only log line per state change, never raw events. */
const WS_HOSTS = [
  'wss://stream.binance.com:9443',
  'wss://stream.binance.com:443',
  'wss://data-stream.binance.vision',
];
const REST_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision'];
const BACKOFF_MIN_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;
const REST_POLL_MS = 30_000;
const IDLE_CLOSE_MS = 30_000;

let ws: WebSocket | null = null;
let wsHost = 0;
let attempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let restTimer: ReturnType<typeof setInterval> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let restHost = 0;
let active = false;          // subscribers present and app in the foreground
let streamOpen = false;
let lastLogged = '';
let appStateSub: { remove: () => void } | null = null;

function log(state: string) {
  if (!__DEV__ || state === lastLogged) return;
  lastLogged = state;
  console.log(`[BinanceLive] ${state}`);
}

function notify() {
  const snapshot = prices;
  subscribers.forEach((fn) => fn(snapshot));
}

function applyTick(base: string, lp: LivePrice) {
  prices = { ...prices, [base]: lp };
  notify();
}

async function fetchRest(): Promise<void> {
  const symbols = SYMBOLS_BASE.map((b) => `${b}USDT`);
  for (let i = 0; i < REST_HOSTS.length; i++) {
    const host = REST_HOSTS[(restHost + i) % REST_HOSTS.length];
    try {
      const r = await fetch(`${host}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`);
      if (!r.ok) continue;
      const rows: any[] = await r.json();
      if (!Array.isArray(rows)) continue;
      const seed: Record<string, LivePrice> = {};
      const now = Date.now();
      rows.forEach((row) => {
        const base = SYMBOL_TO_BASE[row.symbol];
        if (!base) return;
        seed[base] = {
          price: parseFloat(row.lastPrice),
          changePct24h: parseFloat(row.priceChangePercent),
          high24h: parseFloat(row.highPrice),
          low24h: parseFloat(row.lowPrice),
          open24h: parseFloat(row.openPrice),
          volume24h: parseFloat(row.quoteVolume),
          ts: now,
        };
      });
      restHost = (restHost + i) % REST_HOSTS.length;
      // Live stream ticks win over a REST snapshot of the same symbol.
      prices = streamOpen ? { ...seed, ...prices } : { ...prices, ...seed };
      notify();
      return;
    } catch { /* try the next host */ }
  }
  log('price snapshot unavailable — will retry');
}

function startRestPolling() {
  if (restTimer) return;
  restTimer = setInterval(() => { if (!streamOpen) void fetchRest(); }, REST_POLL_MS);
}

function stopRestPolling() {
  if (restTimer) clearInterval(restTimer);
  restTimer = null;
}

function streamUrl(host: string) {
  const parts: string[] = [];
  SYMBOLS_BASE.forEach((b) => {
    const sym = `${b.toLowerCase()}usdt`;
    parts.push(`${sym}@trade`, `${sym}@ticker`);
  });
  return `${host}/stream?streams=${parts.join('/')}`;
}

function onMessage(ev: { data: any }) {
  try {
    const d = JSON.parse(ev.data)?.data;
    if (!d || !d.s) return;
    const base = SYMBOL_TO_BASE[d.s];
    if (!base) return;
    const now = Date.now();
    const prev = prices[base];
    if (d.e === 'trade') {
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
    } else if (d.e === '24hrTicker') {
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
  } catch { /* ignore malformed frames */ }
}

function connect() {
  if (!active) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const host = WS_HOSTS[wsHost % WS_HOSTS.length];
  let socket: WebSocket;
  try {
    socket = new WebSocket(streamUrl(host));
  } catch {
    scheduleReconnect();
    return;
  }
  ws = socket;
  socket.onopen = () => {
    streamOpen = true;
    attempts = 0;
    log(`live prices connected (${host.replace('wss://', '')})`);
  };
  socket.onmessage = onMessage;
  socket.onerror = () => {
    // Details arrive with onclose; closing here keeps one code path.
    try { socket.close(); } catch {}
  };
  socket.onclose = () => {
    if (ws === socket) ws = null;
    const wasOpen = streamOpen;
    streamOpen = false;
    if (!active) return;
    if (!wasOpen) wsHost += 1; // never opened → try the next host next time
    void fetchRest();
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (reconnectTimer || !active) return;
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempts);
  const delay = Math.round(exp * (0.75 + Math.random() * 0.5));
  attempts += 1;
  log(`live prices unavailable — using snapshots, retrying in ${Math.round(delay / 1000)}s`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function teardown() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  stopRestPolling();
  const socket = ws;
  ws = null;
  streamOpen = false;
  if (socket) {
    socket.onclose = null;
    try { socket.close(); } catch {}
  }
}

function resume() {
  if (active) return;
  active = true;
  attempts = 0;
  void fetchRest();
  startRestPolling();
  connect();
}

function pause() {
  if (!active) return;
  active = false;
  teardown();
  log('live prices paused');
}

function onSubscribersChanged() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (subscribers.size > 0) {
    if (!appStateSub) {
      appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active' && subscribers.size > 0) resume();
        else if (state === 'background') pause();
      });
    }
    if (AppState.currentState !== 'background') resume();
  } else {
    // Keep the stream briefly so navigating between screens doesn't churn it.
    idleTimer = setTimeout(() => {
      if (subscribers.size === 0) {
        pause();
        appStateSub?.remove();
        appStateSub = null;
      }
    }, IDLE_CLOSE_MS);
  }
}

export function useBinanceLive(): Record<string, LivePrice> {
  const [snap, setSnap] = useState(prices);

  useEffect(() => {
    subscribers.add(setSnap);
    setSnap(prices);
    onSubscribersChanged();
    return () => {
      subscribers.delete(setSnap);
      onSubscribersChanged();
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