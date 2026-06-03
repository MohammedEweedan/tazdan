/**
 * useCoinIcons — synchronous coin icon resolver.
 *
 * Priority:
 *   1. Server markets/icons map (fast, best quality)
 *   2. Client-side CoinGecko search cache (fills gaps dynamically)
 *   3. CoinCap CDN (broader than jsDelivr, ~2,000 coins)
 *   4. jsDelivr cryptocurrency-icons (reliable fallback, ~800 coins)
 *
 * Returns a URL immediately; background searches upgrade quality later.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP } from '@/constants';

// Persisted icon cache — CoinGecko-resolved URLs survive cold starts so the
// app doesn't re-resolve (and re-rate-limit) every launch, which was the main
// reason icons showed up "severely missing" on a fresh open.
const ICON_CACHE_KEY = 'tazdan.coinIcons.v1';
let _persistLoaded = false;
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistIconCache() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    AsyncStorage.setItem(ICON_CACHE_KEY, JSON.stringify(clientMap)).catch(() => {});
  }, 1500);
}
function hydrateIconCache() {
  if (_persistLoaded) return;
  _persistLoaded = true;
  AsyncStorage.getItem(ICON_CACHE_KEY).then((raw) => {
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(saved)) if (!clientMap[k]) clientMap[k] = v;
      clientListeners.forEach((fn) => fn('*'));
    } catch { /* ignore corrupt cache */ }
  }).catch(() => {});
}

const JSDELIVR = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color';

function normalize(sym: string): string {
  let s = sym.toUpperCase();
  s = s.replace(/_.*$/, '');
  // Only strip USDT/USDC when they're suffixes (BTCUSDT → BTC), not when the symbol IS USDT
  s = s.replace(/(?<!^)USDT$/, '');
  s = s.replace(/(?<!^)USDC$/, '');
  s = s.replace(/BTC$/, (m, offset) => (offset > 0 ? '' : m));
  return s || sym.toUpperCase().split(/USDT|USDC/)[0];
}

function jsDelivrUrl(sym: string): string {
  return `${JSDELIVR}/${sym.toLowerCase()}.png`;
}

// ── Server-side CoinGecko map ────────────────────────────────────────────────
const API_ROOT = APP.apiBaseUrl.replace(/\/+$/, '');
let serverMap: Record<string, string> = {};
let serverState: 'idle' | 'loading' | 'done' = 'idle';
const serverListeners: Array<(map: Record<string, string>) => void> = [];

function loadServerIcons() {
  if (serverState !== 'idle') return;
  serverState = 'loading';
  fetch(`${API_ROOT}/markets/icons`, { signal: AbortSignal.timeout?.(8000) })
    .then((r) => r.json())
    .then((data) => {
      if (data?.icons && typeof data.icons === 'object') {
        const upgraded: Record<string, string> = {};
        for (const [sym, url] of Object.entries(data.icons as Record<string, string>)) {
          upgraded[sym.toUpperCase()] = (url as string).replace('/small/', '/large/');
        }
        serverMap = upgraded;
        serverState = 'done';
        serverListeners.forEach((fn) => fn(serverMap));
        serverListeners.length = 0;
      }
    })
    .catch(() => { serverState = 'idle'; });
}

// ── Client-side CoinGecko search cache ───────────────────────────────────────
const clientMap: Record<string, string> = {};
const searching = new Set<string>();
const searchQueue: string[] = [];
let searchTimer: ReturnType<typeof setTimeout> | null = null;

async function cgSearch(sym: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`,
      { signal: AbortSignal.timeout?.(6000) }
    );
    const data = await res.json();
    const coin = data.coins?.[0];
    if (coin?.large || coin?.thumb) {
      return coin.large || coin.thumb;
    }
  } catch {}
  return null;
}

function processQueue() {
  searchTimer = null;
  const sym = searchQueue.shift();
  if (!sym) return;
  searching.add(sym);
  cgSearch(sym).then((url) => {
    if (url) { clientMap[sym] = url; persistIconCache(); }
    searching.delete(sym);
    // Notify all hook instances that a new icon is ready
    clientListeners.forEach((fn) => fn(sym));
    // Process next with a small delay to respect rate limits
    if (searchQueue.length > 0) {
      searchTimer = setTimeout(processQueue, 350);
    }
  });
}

function enqueueSearch(sym: string) {
  if (clientMap[sym] || searching.has(sym) || searchQueue.includes(sym)) return;
  searchQueue.push(sym);
  if (!searchTimer) {
    searchTimer = setTimeout(processQueue, 0);
  }
}

const clientListeners: Array<(sym: string) => void> = [];
const lockedIconUrls: Record<string, string> = {};

// ── Exported hook ────────────────────────────────────────────────────────────
export function useCoinIcons(): (symbol: string) => string {
  const [serverReady, setServerReady] = useState(serverState === 'done');
  const [clientVersion, setClientVersion] = useState(0); // bumps when clientMap updates
  const mounted = useRef(true);

  // Subscribe to server map load
  useEffect(() => {
    mounted.current = true;
    hydrateIconCache(); // load persisted CoinGecko icons (instant on cold start)
    if (serverState === 'done') {
      setServerReady(true);
    } else {
      const handler = () => { if (mounted.current) setServerReady(true); };
      serverListeners.push(handler);
      loadServerIcons();
    }
    return () => { mounted.current = false; };
  }, []);

  // Subscribe to client search completions
  useEffect(() => {
    const handler = () => { if (mounted.current) setClientVersion((v) => v + 1); };
    clientListeners.push(handler);
    return () => {
      const idx = clientListeners.indexOf(handler);
      if (idx >= 0) clientListeners.splice(idx, 1);
    };
  }, []);

  return useCallback((symbol: string): string => {
    const upper = normalize(symbol);
    const locked = lockedIconUrls[upper];
    if (locked) return locked;

    // 1. Server map (best quality)
    if (serverReady && serverMap[upper]) {
      lockedIconUrls[upper] = serverMap[upper];
      return lockedIconUrls[upper];
    }

    // 2. Client-side CoinGecko cache
    if (clientMap[upper]) {
      lockedIconUrls[upper] = clientMap[upper];
      return lockedIconUrls[upper];
    }

    // 3. jsDelivr cryptocurrency-icons — reliable, synchronous, ~800 coins.
    //    (CoinCap's icon CDN was deprecated and now mostly 404s, which is why
    //    icons were "severely missing" — we no longer default to it.)
    const fallback = jsDelivrUrl(upper);

    // 4. Kick off a client-side CoinGecko search to UPGRADE quality / cover
    //    coins jsDelivr doesn't have. This was the better-fetching source.
    if (!serverReady || !serverMap[upper]) {
      enqueueSearch(upper);
    }

    // Don't permanently lock the synchronous fallback — if the CoinGecko search
    // finds a real icon, let it replace the generic one on the next render.
    return clientMap[upper] || fallback;
  }, [serverReady, clientVersion]);
}
