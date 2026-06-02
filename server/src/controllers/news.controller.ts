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

/**
 * Fiat currencies → their country, used to surface COUNTRY news (not crypto
 * news) on a fiat asset's detail page. Each entry carries a Google News
 * locale (hl/gl/ceid) so the feed comes back in the right language/region,
 * plus a human label used as the search topic.
 */
const FIAT_COUNTRY: Record<string, { topic: string; hl: string; gl: string; ceid: string }> = {
  USD: { topic: 'United States economy', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  EUR: { topic: 'Eurozone economy',      hl: 'en',    gl: 'EU', ceid: 'EU:en' },
  GBP: { topic: 'United Kingdom economy',hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  AED: { topic: 'United Arab Emirates economy', hl: 'en', gl: 'AE', ceid: 'AE:en' },
  SAR: { topic: 'Saudi Arabia economy',  hl: 'en',    gl: 'SA', ceid: 'SA:en' },
  EGP: { topic: 'Egypt economy',         hl: 'en',    gl: 'EG', ceid: 'EG:en' },
  LYD: { topic: 'Libya economy',         hl: 'en',    gl: 'LY', ceid: 'LY:en' },
  SDG: { topic: 'Sudan economy',         hl: 'en',    gl: 'SD', ceid: 'SD:en' },
  NGN: { topic: 'Nigeria economy',       hl: 'en-NG', gl: 'NG', ceid: 'NG:en' },
  TRY: { topic: 'Turkey economy',        hl: 'en',    gl: 'TR', ceid: 'TR:en' },
  LBP: { topic: 'Lebanon economy',       hl: 'en',    gl: 'LB', ceid: 'LB:en' },
};

/** Minimal Google News RSS → NewsItem parser (no XML dep — regex over items). */
function parseGoogleNewsRss(xml: string, sourceFallback: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const block of blocks) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? m[1] : '';
    };
    const strip = (s: string) =>
      s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
       .replace(/<[^>]+>/g, '')
       .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
       .trim();
    const title = strip(get('title'));
    const link  = strip(get('link'));
    if (!title || !link) continue;
    const pub = Date.parse(strip(get('pubDate')));
    // Google News titles end with " - Source"; pull that as the source.
    const dashIdx = title.lastIndexOf(' - ');
    const source = dashIdx > 0 ? title.slice(dashIdx + 3) : sourceFallback;
    items.push({
      title: dashIdx > 0 ? title.slice(0, dashIdx) : title,
      source,
      url: link,
      published: Number.isNaN(pub) ? 0 : Math.floor(pub / 1000),
      body: strip(get('description')).slice(0, 240),
      categories: 'country',
    });
    if (items.length >= 10) break;
  }
  return items;
}

const SYM_KEYWORDS: Record<string, string[]> = {
  BTC: ['BTC', 'BITCOIN'], ETH: ['ETH', 'ETHEREUM', 'ETHER'],
  SOL: ['SOL', 'SOLANA'],  BNB: ['BNB', 'BINANCE'],
  XRP: ['XRP', 'RIPPLE'],  ADA: ['ADA', 'CARDANO'],
  DOGE: ['DOGE', 'DOGECOIN'], MATIC: ['MATIC', 'POLYGON'],
  DOT: ['DOT', 'POLKADOT'],   AVAX: ['AVAX', 'AVALANCHE'],
  USDT: ['USDT', 'TETHER'],   USDC: ['USDC'],
  LTC: ['LTC', 'LITECOIN'],   LINK: ['LINK', 'CHAINLINK'],
  TRX: ['TRX', 'TRON'],       TON: ['TON', 'TONCOIN'],
  SHIB: ['SHIB', 'SHIBA'],    ARB: ['ARB', 'ARBITRUM'],
};

function matchesSym(item: NewsItem, sym: string): boolean {
  const keywords = SYM_KEYWORDS[sym] ?? [sym];
  const hay = ((item.title ?? '') + ' ' + (item.body ?? '') + ' ' + (item.categories ?? '')).toUpperCase();
  return keywords.some((k) => hay.includes(k));
}

// Maps the new CryptoCompare Data API (data-api.cryptocompare.com) shape.
function mapNewApiItem(n: any): NewsItem {
  return {
    title:      n.TITLE ?? 'Untitled',
    source:     n.SOURCE_DATA?.NAME ?? 'CryptoCompare',
    url:        n.URL ?? n.GUID ?? '',
    published:  n.PUBLISHED_ON ?? 0,
    imageUrl:   n.IMAGE_URL,
    body:       n.BODY ?? '',
    categories: '',
  };
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'TazdanNews/1.0' } });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Country/economy news for a fiat currency, via Google News RSS. */
async function fetchCountryNews(sym: string): Promise<NewsItem[]> {
  const meta = FIAT_COUNTRY[sym];
  if (!meta) return [];
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(meta.topic)}` +
    `&hl=${meta.hl}&gl=${meta.gl}&ceid=${encodeURIComponent(meta.ceid)}`;
  const xml = await fetchText(url);
  if (!xml) return [];
  return parseGoogleNewsRss(xml, meta.topic);
}

// CryptoCompare new Data API — no key needed for basic access.
const CC_BASE = 'https://data-api.cryptocompare.com/news/v1/article/list?lang=EN&limit=30';

export class NewsController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sym = String(req.query.sym ?? '').toUpperCase();
      if (!sym) return res.status(400).json({ error: 'sym query param is required' });

      const cached = cache.get(sym);
      if (cached && Date.now() - cached.at < TTL_MS) {
        return res.json({ items: cached.data, fallback: cached.fallback });
      }

      // Fiat currencies → show the currency's COUNTRY/economy news instead of
      // crypto news (the old behaviour was a dead "no news for fiat" panel).
      if (sym in FIAT_COUNTRY) {
        const countryItems = await fetchCountryNews(sym);
        if (countryItems.length > 0) {
          cache.set(sym, { at: Date.now(), data: countryItems, fallback: false });
          return res.json({ items: countryItems, fallback: false, kind: 'country' });
        }
        logger.warn('[news] country feed empty', { sym });
        return res.status(503).json({ error: 'News feed unavailable', items: [], fallback: false, kind: 'country' });
      }

      // 1) Asset-specific feed via the `categories` param. CryptoCompare's
      //    article list keys news by category (e.g. BTC, ETH, SOL). The old
      //    `asset_lookup` param was silently ignored, so every symbol got the
      //    same generic feed — that's why news wasn't pair-specific. We still
      //    keyword-filter the result as a guard, since some categories are
      //    broad. Unknown symbols fall through to the keyword path below.
      //    NOTE: an unknown/invalid category silently returns the generic
      //    feed, so we keyword-filter and only treat it as pair-specific when
      //    at least one item actually mentions the asset. Otherwise we fall
      //    through to the general path, which labels the result as a fallback.
      const specific = await fetchJson(`${CC_BASE}&categories=${encodeURIComponent(sym)}`);
      if (Array.isArray(specific?.Data) && specific.Data.length > 0) {
        const mapped = specific.Data.map(mapNewApiItem);
        const matched = mapped.filter((n: NewsItem) => matchesSym(n, sym));
        if (matched.length > 0) {
          const items = matched.slice(0, 8);
          cache.set(sym, { at: Date.now(), data: items, fallback: false });
          return res.json({ items, fallback: false });
        }
      }

      // 2) General feed with keyword filter.
      const general = await fetchJson(`${CC_BASE}&limit=60`);
      if (Array.isArray(general?.Data)) {
        const all = general.Data.map(mapNewApiItem);
        const matched = all.filter((n: NewsItem) => matchesSym(n, sym));
        if (matched.length > 0) {
          const items = matched.slice(0, 8);
          cache.set(sym, { at: Date.now(), data: items, fallback: false });
          return res.json({ items, fallback: false });
        }
        // 3) Fallback — top crypto news, marked so client softens the heading.
        if (all.length > 0) {
          const items = all.slice(0, 8);
          cache.set(sym, { at: Date.now(), data: items, fallback: true });
          return res.json({ items, fallback: true });
        }
      }

      logger.warn('[news] all upstreams returned empty/failed', { sym });
      return res.status(503).json({ error: 'News feed unavailable', items: [], fallback: false });
    } catch (e) {
      next(e);
    }
  }
}
