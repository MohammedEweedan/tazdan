/**
 * Keeps the home-screen widgets current while the app runs.
 *
 * Reads what the app already fetched (wallets, activity, chats, prices) from
 * the query cache — it adds no polling and no price socket. Changes to money,
 * activity or chats publish within ~1.5 s; price-only movement at most once a
 * minute (the widgets refresh prices themselves when the app is closed).
 * Going to the background always publishes the latest state.
 *
 * Mount once inside the signed-in tree.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { APP, QUERY_KEYS } from '@/constants';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/store/i18nStore';
import { useUiStore } from '@/store/uiStore';
import type { Activity } from '@/services';
import type { MarketTicker, Wallet } from '@/types';
import type { Conversation } from '@/types/messages';
import type { LiveFiat } from '@/hooks/useForexRates';
import { buildWidgetSnapshot } from './build';
import { publishWidgetSnapshot } from './publish';

const WATCHED = new Set(['wallets', 'activities', 'conversations', 'markets', 'forex-rates', 'rates-live']);
const PRICE_REPUBLISH_MS = 60_000;
export const NOTIF_PREFS_KEY = ['notif-prefs'] as const;

export function useWidgetSync(): void {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const baseCurrency = useAuthStore((s) => (s.user as any)?.baseCurrency ?? 'USD') as string;
  const locale = useI18n((s) => s.locale);
  const hidden = useUiStore((s) => s.balancesHidden);
  // Chat text reaches the widget only when notification previews are on.
  const { data: prefs } = useQuery({
    queryKey: NOTIF_PREFS_KEY,
    queryFn: async () => (await api.get('/notifications/preferences')).data?.preferences ?? null,
    staleTime: 5 * 60_000,
    enabled: !!userId,
  });
  const showChatPreview = prefs?.push?.messagePreview !== false;

  const settings = useRef({ locale, hidden, showChatPreview, baseCurrency });
  settings.current = { locale, hidden, showChatPreview, baseCurrency };
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastAt = 0;
    let lastShape = '';

    const publish = (force: boolean) => {
      timer = null;
      const wallets = qc.getQueryData<Wallet[]>(QUERY_KEYS.wallets);
      if (!wallets) return; // nothing honest to show before balances load
      const snapshot = buildWidgetSnapshot({
        ...settings.current,
        apiBase: APP.apiBaseUrl,
        meId: userId,
        wallets,
        tickers: qc.getQueryData<MarketTicker[]>(QUERY_KEYS.markets) ?? [],
        ratesPerUsd: qc.getQueryData<Record<string, number>>(['forex-rates']) ?? {},
        liveFiat: qc.getQueryData<Record<string, LiveFiat>>(['rates-live']) ?? {},
        activities: qc.getQueryData<{ items: Activity[] }>(QUERY_KEYS.activities(1, 'ALL'))?.items ?? [],
        conversations: qc.getQueryData<Conversation[]>(QUERY_KEYS.conversations) ?? [],
      });
      // Everything but prices: a change here publishes at once.
      const shape = JSON.stringify([
        snapshot.holdings.map((h) => [h.code, h.amount]), snapshot.payments, snapshot.chats,
        snapshot.hidden, snapshot.locale, snapshot.display.code,
      ]);
      if (!force && shape === lastShape && Date.now() - lastAt < PRICE_REPUBLISH_MS) return;
      lastShape = shape;
      lastAt = Date.now();
      void publishWidgetSnapshot(snapshot).then((published) => {
        if (!published) { lastShape = ''; lastAt = 0; }
      });
    };
    const schedule = () => { if (!timer) timer = setTimeout(() => publish(false), 1_500); };
    kick.current = schedule;

    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success' && WATCHED.has(String(event.query.queryKey[0]))) schedule();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (timer) clearTimeout(timer);
        publish(true);
      } else if (state === 'active') schedule();
    });
    schedule();

    return () => {
      unsubscribe();
      appState.remove();
      if (timer) clearTimeout(timer);
      kick.current = () => {};
    };
  }, [qc, userId]);

  // A setting the snapshot depends on changed (language, hide balances,
  // previews, display currency).
  useEffect(() => { kick.current(); }, [locale, hidden, showChatPreview, baseCurrency]);
}
