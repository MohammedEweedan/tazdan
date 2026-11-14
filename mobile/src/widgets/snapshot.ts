/**
 * Home-screen widgets — the data contract.
 *
 * The app writes ONE snapshot (JSON) whenever balances, activity, chats or
 * prices change. iOS widgets (targets/widgets, SwiftUI) read it from the
 * shared App Group; Android widgets (src/widgets/android) read it from
 * AsyncStorage in their headless task. Neither holds a login token.
 *
 * Holdings carry raw amounts and USD prices so both platforms can refresh
 * PRICES on their own from the public feeds (/markets/ticker, /rates/live)
 * while the app is closed. Payments and chats are as fresh as the last time
 * the app ran; every widget shows when that was.
 *
 * Privacy: `hidden` (the app's hide-balances setting) masks every amount and
 * total but never market prices. Chat text appears only when the user's
 * "Show preview" notification setting is on. Signing out clears everything.
 *
 * Keep in sync with targets/widgets/Snapshot.swift.
 */

/** Shared with the widget extension. The local iPhone test build has its own identifiers. */
export const WIDGET_APP_GROUP = process.env.EXPO_PUBLIC_LOCAL_TEST_BUILD === '1' ? 'group.com.tazdan.localtest' : 'group.com.tazdan.app';
export const WIDGET_SNAPSHOT_KEY = 'tazdan.widgets.snapshot';
export const WIDGET_NAMES = ['TazdanPayments', 'TazdanChats', 'TazdanHoldings'] as const;
export type WidgetName = typeof WIDGET_NAMES[number];

export const MASK = '••••';

export interface WidgetLabels {
  payments: string; send: string; receive: string; scan: string; topUp: string;
  noPayments: string; chats: string; noChats: string; unread: string; newMessage: string;
  assets: string; total: string; noAssets: string; updated: string; openApp: string;
}

export interface WidgetHolding {
  code: string;
  name: string;
  kind: 'crypto' | 'fiat';
  amount: number;
  /** USD value of one unit when the snapshot was written. */
  usdPrice: number;
  change24hPct: number | null;
}

export interface WidgetPayment {
  id: string;
  title: string;
  amountText: string;
  incoming: boolean;
  failed: boolean;
  pending: boolean;
  at: string;
}

export interface WidgetChat {
  partnerId: string;
  name: string;
  initial: string;
  preview: string;
  unread: number;
  at: string;
  support: boolean;
}

export interface WidgetSnapshot {
  v: 1;
  updatedAt: string;
  locale: 'en' | 'ar';
  /** API origin the app uses (…/api) — widgets fetch public prices from it. */
  apiBase: string;
  hidden: boolean;
  labels: WidgetLabels;
  /** The user's display currency: value = usd × perUsd. */
  display: { code: string; symbol: string; perUsd: number; decimals: number; symbolAfter: boolean };
  holdings: WidgetHolding[];
  payments: WidgetPayment[];
  chats: { unread: number; items: WidgetChat[] };
}

/**
 * Money is always left-to-right, even with an Arabic symbol (د.ل). Without
 * the marks, digits after an Arabic letter join its right-to-left run and
 * "د.ل48.00" displays as "48.00د.ل".
 */
const LRM = '\u200E';
const withSymbol = (formatted: string, d: WidgetSnapshot['display']) =>
  d.symbolAfter ? `${LRM}${formatted} ${d.symbol}` : `${LRM}${d.symbol}${LRM}${formatted}`;

/** Same thousands/decimals rules as useDisplayCurrency.fmt. */
export function formatDisplay(usd: number, display: WidgetSnapshot['display']): string {
  const n = usd * display.perUsd;
  return withSymbol(n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: display.decimals }), display);
}

/** A unit price: small coins keep their significant digits. */
export function formatPrice(usd: number, display: WidgetSnapshot['display']): string {
  const n = usd * display.perUsd;
  const decimals = n >= 1 ? 2 : n >= 0.01 ? 4 : 8;
  return withSymbol(n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: decimals }), display);
}

export function formatChange(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '';
  return `${pct > 0 ? '▲' : pct < 0 ? '▼' : ''}${Math.abs(pct).toFixed(2)}%`;
}

/** The price line of a holding: a crypto price, or "$1 = 9.37 LYD" for fiat. */
export function priceLine(h: WidgetHolding, display: WidgetSnapshot['display']): string {
  if (h.kind === 'crypto') return formatPrice(h.usdPrice, display);
  if (h.code === 'USD' || h.usdPrice <= 0) return h.name;
  const perUsd = 1 / h.usdPrice;
  return `$1 = ${perUsd.toLocaleString('en-US', { maximumFractionDigits: perUsd >= 100 ? 0 : 2 })} ${h.code}`;
}

export interface PriceFeeds {
  crypto?: Record<string, { price: number; changePct24h: number | null }>;
  fiat?: Record<string, { usd: number; perUsd: number; change24hPct: number | null }>;
}

/**
 * The snapshot with fresher prices from the public feeds (widgets call this
 * on their own refresh). Amounts never change here — only prices.
 */
export function withFreshPrices(s: WidgetSnapshot, feeds: PriceFeeds): WidgetSnapshot {
  const holdings = s.holdings.map((h) => {
    if (h.kind === 'crypto') {
      const t = feeds.crypto?.[h.code];
      return t && t.price > 0 ? { ...h, usdPrice: t.price, change24hPct: t.changePct24h } : h;
    }
    const f = feeds.fiat?.[h.code];
    return f && f.usd > 0 ? { ...h, usdPrice: f.usd, change24hPct: f.change24hPct } : h;
  });
  // Display currency: fiat from the fiat feed, a crypto base from its price.
  const df = feeds.fiat?.[s.display.code];
  const dc = feeds.crypto?.[s.display.code];
  const perUsd = df && df.perUsd > 0 ? df.perUsd : dc && dc.price > 0 ? 1 / dc.price : s.display.perUsd;
  const display = { ...s.display, perUsd };
  return { ...s, holdings, display };
}

export const totalUsd = (s: WidgetSnapshot) => s.holdings.reduce((sum, h) => sum + h.amount * h.usdPrice, 0);
