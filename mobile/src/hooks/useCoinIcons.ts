/**
 * useCoinIcons — synchronous coin icon resolver.
 *
 * Priority:
 *   1. Server /api/markets/icons map (fast, best quality)
 *   2. Client-side CoinGecko search cache (fills gaps dynamically)
 *   3. CoinCap CDN (broader than jsDelivr, ~2,000 coins)
 *   4. jsDelivr cryptocurrency-icons (reliable fallback, ~800 coins)
 *
 * Returns a URL immediately; background searches upgrade quality later.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP } from '@/constants';

const JSDELIVR = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color';
const COINCAP  = 'https://assets.coincap.io/assets/icons';

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

function coinCapUrl(sym: string): string {
  return `${COINCAP}/${sym.toLowerCase()}@2x.png`;
}

// ── Server-side CoinGecko map ────────────────────────────────────────────────
const API_ROOT = APP.apiBaseUrl.replace(/\/api\/?$/, '');
let serverMap: Record<string, string> = {};
let serverState: 'idle' | 'loading' | 'done' = 'idle';
const serverListeners: Array<(map: Record<string, string>) => void> = [];

function loadServerIcons() {
  if (serverState !== 'idle') return;
  serverState = 'loading';
  fetch(`${API_ROOT}/api/markets/icons`, { signal: AbortSignal.timeout?.(8000) })
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
    if (url) clientMap[sym] = url;
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

// ── Exported hook ────────────────────────────────────────────────────────────
export function useCoinIcons(): (symbol: string) => string {
  const [serverReady, setServerReady] = useState(serverState === 'done');
  const [clientVersion, setClientVersion] = useState(0); // bumps when clientMap updates
  const mounted = useRef(true);

  // Subscribe to server map load
  useEffect(() => {
    mounted.current = true;
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

    // 1. Server map (best quality)
    if (serverReady && serverMap[upper]) return serverMap[upper];

    // 2. Client-side CoinGecko cache
    if (clientMap[upper]) return clientMap[upper];

    // 3. CoinCap CDN (broader coverage)
    const cap = coinCapUrl(upper);

    // 4. Kick off a client-side search if completely unknown
    if (!serverReady || !serverMap[upper]) {
      enqueueSearch(upper);
    }

    return cap;
  }, [serverReady, clientVersion]);
}
