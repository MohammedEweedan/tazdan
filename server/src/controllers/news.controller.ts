/**
 * News proxy + aggregator.
 *
 * The mobile app's asset detail page used to hit CryptoCompare's free
 * news CDN directly.  That CDN was returning empty / failing on
 * several user networks (regional throttling, ATS quirks, slow
 * response) which manifested as the dreaded "No news found for X"
 * panel even on flagship coins like BTC.
 *
 * We now proxy news through the server so:
 *   - One IP (the server) talks to the upstream CDN — fewer throttle
 *     hits.
 *   - We can layer a cache (60s in-memory) to flatten bursts.
 *   - We can try multiple sources (CryptoCompare today, easy to add
 *     CoinDesk / CoinTelegraph RSS / a Pro feed later).
 *   - We don't ship the upstream's CORS / TLS quirks to the client.
 */

import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types';
import { logger } from '../utils/logger';

type NewsItem = {
  title: string;
  source: string;
  url: string;
  published: number;       // epoch seconds
  imageUrl?: string;
  body?: string;
  categories?: string;
};

interface CacheEntry { at: number; data: NewsItem[]; fallback: boolean }
const TTL_MS = 60_000;
const cache  = new Map<string, CacheEntry>();

const CC_CATEGORIES = new Set([
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ETC', 'ADA', 'DOGE', 'DOT', 'LINK',
  'SOL', 'AVAX', 'MATIC', 'TRX', 'BNB', 'USDT', 'USDC', 'XLM', 'XMR',
  'ATOM', 'NEAR', 'FIL', 'ALGO', 'VET', 'AAVE', 'ARB', 'OP', 'SUI', 'SHIB',
]);

const SYM_KEYWORDS: Record<string, string[]> = {
  BTC: ['BTC', 'BITCOIN'],
  ETH: ['ETH', 'ETHEREUM', 'ETHER'],
  SOL: ['SOL', 'SOLANA'],
  BNB: ['BNB', 'BINANCE COIN'],
  XRP: ['XRP', 'RIPPLE'],
  ADA: ['ADA', 'CARDANO'],
  DOGE: ['DOGE', 'DOGECOIN'],
  MATIC: ['MATIC', 'POLYGON'],
  DOT: ['DOT', 'POLKADOT'],
  AVAX: ['AVAX', 'AVALANCHE'],
  USDT: ['USDT', 'TETHER'],
  USDC: ['USDC'],
  LTC: ['LTC', 'LITECOIN'],
  LINK: ['LINK', 'CHAINLINK'],
  TRX: ['TRX', 'TRON'],
  TON: ['TON', 'TONCOIN'],
};

function matchesSym(item: NewsItem, sym: string): boolean {
  const keywords = SYM_KEYWORDS[sym] ?? [sym];
  const hay = (
    (item.title ?? '') + ' ' +
    (item.body ?? '')  + ' ' +
    (item.categories ?? '')
  ).toUpperCase();
  return keywords.some((k) => hay.includes(k));
}

function mapCcItem(n: any): NewsItem {
  return {
    title:      n.title ?? 'Untitled',
    source:     n.source_info?.name ?? n.source ?? 'CryptoCompare',
    url:        n.url ?? '',
    published:  n.published_on ?? 0,
    imageUrl:   n.imageurl,
    body:       n.body ?? '',
    categories: n.categories ?? '',
  };
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export class NewsController {
  /**
   * GET /api/news?sym=BTC
   * Returns up to 6 news items for the given symbol, plus a
   * `fallback` flag when we couldn't find symbol-specific coverage
   * and dropped to general crypto news.  Empty `items` + no
   * `fallback` is the "no news" terminal state — distinct from a
   * fetch failure (which surfaces as a 503).
   */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sym = String(req.query.sym ?? '').toUpperCase();
      if (!sym) {
        return res.status(400).json({ error: 'sym query param is required' });
      }

      const cached = cache.get(sym);
      if (cached && Date.now() - cached.at < TTL_MS) {
        return res.json({ items: cached.data, fallback: cached.fallback });
      }

      // 1) CryptoCompare category filter for symbols it knows.
      if (CC_CATEGORIES.has(sym)) {
        const j = await fetchJson(
          `https://min-api.cryptocompare.com/data/v2/news/?categories=${sym}&lang=EN`,
        );
        if (j?.Type === 100 && Array.isArray(j.Data) && j.Data.length > 0) {
          const items = j.Data.slice(0, 6).map(mapCcItem);
          cache.set(sym, { at: Date.now(), data: items, fallback: false });
          return res.json({ items, fallback: false });
        }
      }

      // 2) CryptoCompare general feed with keyword filter.
      const j = await fetchJson(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN',
      );
      if (j?.Type === 100 && Array.isArray(j.Data)) {
        const all = j.Data.slice(0, 100).map(mapCcItem);
        const matched = all.filter((n: NewsItem) => matchesSym(n, sym));
        if (matched.length > 0) {
          const items = matched.slice(0, 6);
          cache.set(sym, { at: Date.now(), data: items, fallback: false });
          return res.json({ items, fallback: false });
        }
        // 3) Fall back to general top-crypto coverage so the panel is
        //    never empty.  Marked `fallback: true` so the client can
        //    soften the heading ("Top crypto news" instead of
        //    "{sym} news").
        if (all.length > 0) {
          const items = all.slice(0, 6);
          cache.set(sym, { at: Date.now(), data: items, fallback: true });
          return res.json({ items, fallback: true });
        }
      }

      // No upstream returned usable data — surface a 503 so the
      // client can render a "couldn't load — retry" state instead of
      // a misleading "no news".
      logger.warn('[news] all upstreams returned empty/failed', { sym });
      return res.status(503).json({ error: 'News feed unavailable', items: [], fallback: false });
    } catch (e) {
      next(e);
    }
  }
}
