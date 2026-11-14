/**
 * Android widget headless task: runs when a widget is added, resized or due
 * for its periodic update — also while the app is closed. It renders from
 * the snapshot the app last stored; the Holdings widget first refreshes
 * prices from the public feeds so they stay current without the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { WIDGET_NAMES, WIDGET_SNAPSHOT_KEY, withFreshPrices, type PriceFeeds, type WidgetName, type WidgetSnapshot } from '../snapshot';
import { renderWidget } from './widgets';

export async function loadSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    const s = raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
    return s?.v === 1 ? s : null;
  } catch {
    return null;
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Public price feeds only — no account data, no token. */
export async function fetchPriceFeeds(apiBase: string): Promise<PriceFeeds> {
  const [tickers, live] = await Promise.all([
    getJson<{ tickers: Array<{ base: string; price: number; changePct24h: number }> }>(`${apiBase}/markets/ticker`),
    getJson<{ currencies: PriceFeeds['fiat'] }>(`${apiBase}/rates/live`),
  ]);
  const crypto: NonNullable<PriceFeeds['crypto']> = {};
  for (const t of tickers?.tickers ?? []) crypto[t.base] = { price: t.price, changePct24h: t.changePct24h ?? null };
  return { crypto, fiat: live?.currencies ?? {} };
}

const deviceLang = (): 'en' | 'ar' => {
  try { return Intl.DateTimeFormat().resolvedOptions().locale.startsWith('ar') ? 'ar' : 'en'; } catch { return 'en'; }
};

export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget: draw }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const name = widgetInfo.widgetName as WidgetName;
  if (!(WIDGET_NAMES as readonly string[]).includes(name)) return;

  let snapshot = await loadSnapshot();
  let pricesAt: string | undefined;
  if (snapshot && name === 'TazdanHoldings' && snapshot.holdings.length) {
    const feeds = await fetchPriceFeeds(snapshot.apiBase);
    if (Object.keys(feeds.crypto ?? {}).length || Object.keys(feeds.fiat ?? {}).length) {
      snapshot = withFreshPrices(snapshot, feeds);
      pricesAt = new Date().toISOString();
    }
  }
  draw(renderWidget(name, snapshot, { width: widgetInfo.width, height: widgetInfo.height }, { pricesAt, lang: snapshot?.locale ?? deviceLang() }));
}
