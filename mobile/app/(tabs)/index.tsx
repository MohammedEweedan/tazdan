/**
 * Home dashboard.
 *  Header → @handle + cog
 *  Total value + delta
 *  ROW OF 5 ACTION BUTTONS — Buy · Sell · Send · Receive · Deposit
 *  Assets / Wallets tab switch
 *  Asset rows with proper currency icons
 *
 * Theme-aware. Every button has a real onPress that navigates to a
 * theme-aware modal.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cryptoWalletAPI } from '@/lib/cryptoApi';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TopGradient, Panel, PanelRow, SectionLabel } from '@/components/ui/ScreenShell';
import { HeaderIconButton as ChromeIconButton } from '@/components/ui/ScreenHeader';
import { ShimmerBackdrop, useShimmerInk } from '@/components/home/ShimmerBackdrop';
import { ActivityIndicator, Animated, Dimensions, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, TextInput } from '@/components/ui/Text';
import BalanceSvg, { Path as SvgPath, Defs as SvgDefs, LinearGradient as SvgLinearGradient, Stop as SvgStop, Line as SvgLine, Circle as SvgCircle } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { realHandle, avatarMode } from '@/utils/displayUser';
import { useWallets, useHaptics, useTransactions, useActivities, useActivityRealtime, useNotificationRealtime, useUnreadCount, useMarkets, useDisplayCurrency, useBudgets } from '@/hooks';
import { useMarkets as useCoinGeckoMarkets, ID_TO_SYM } from '@/hooks/useMarkets';
import { useTheme, useThemedPalette, isMonochrome, type Palette } from '@/store/themeStore';
import { useT, useI18n } from '@/store/i18nStore';
import { Sparkline } from '@/components/ui/Sparkline';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { getCurrencyMeta, fiatSymbol } from '@/constants';
import { formatMoney } from '@/utils/format';
import { BuyWidget } from '@/components/exchange/BuyWidget';
import { SellWidget } from '@/components/exchange/SellWidget';
import { SendWidget } from '@/components/exchange/SendWidget';
import { ReceiveWidget } from '@/components/exchange/ReceiveWidget';
import { WithdrawWidget } from '@/components/exchange/WithdrawWidget';
import { RecurringBuyWidget } from '@/components/exchange/RecurringBuyWidget';
import { PressableScale } from '@/components/ui/Motion';
import { AnnouncementBanner } from '@/components/ui/AnnouncementBanner';
import { Avatar } from '@/components/ui/Avatar';
import { contactsService } from '@/services/contacts';
import { useForexRates, useLiveFiatRates } from '@/hooks/useForexRates';
import { F } from '@/theme';
import type { Wallet } from '@/types';

import { BottomSheet } from '@/components/ui/BottomSheet';
type Tab = 'ASSETS' | 'ACTIVITY';

/** Height of both header capsules (@handle + the action track). They must
 *  match or the header row stops reading as one line — so it lives here
 *  rather than being typed twice. */
const HEADER_PILL_H = 38;

export default function Home() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: wallets, refetch: refetchWallets, isPending: walletsLoading, isError: walletsError } = useWallets();
  const { data: budgets = [] } = useBudgets();
  // `useTransactions` still feeds screens that need the raw Transaction
  // ledger. The home Activity tab uses the unified `useActivities` feed
  // so P2P trades, card spend, deposits, withdrawals, ramps, and crypto
  // orders all show up alongside trades.
  const { data: txData, refetch: refetchTxs } = useTransactions(1);
  const { data: activityData, refetch: refetchActivity } = useActivities(1, 'ALL', 25);
  useActivityRealtime(user?.id);
  useNotificationRealtime(user?.id);

  // Adapt the unified Activity shape to TxItem so the existing
  // ActivityList renderer (which handles every type string we set on
  // the server) can render it without changes.
  const activityItems = useMemo(() => {
    const list = activityData?.items ?? [];
    return list.map((a) => ({
      id: a.id,
      type: a.type,
      amount: a.amount,
      currency: a.currency,
      description: a.description ?? null,
      createdAt: a.createdAt,
      status: a.status ?? null,
      fee: a.fee ?? null,
      reference: a.reference ?? null,
      counterpartyHandle: a.counterparty?.username ?? null,
      counterpartyName:   a.counterparty?.name ?? a.counterparty?.username ?? null,
      metadata: (a.metadata ?? null) as any,
    }));
  }, [activityData?.items]);
  const { data: unreadData } = useUnreadCount();
  const p = useThemedPalette();
  const dc = useDisplayCurrency();
  const themeMode = useTheme((s) => s.mode);
  const [tab, setTab] = useState<Tab>('ASSETS');
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [balanceChartVisible, setBalanceChartVisible] = useState(false);

  const list = wallets ?? [];

  // Live USD price map keyed by ticker (e.g. { BTC: 67_432.10, ETH: 3_240.50 }).
  // Computed from Binance WebSocket + backend ticker overlay. We re-derive `totalUsd` from
  // these so the home balance fluctuates in real time exactly like the
  // asset detail screen.
  const { data: tickers, refetch: refetchMarkets } = useMarkets();
  const { data: cgMarkets } = useCoinGeckoMarkets();
  const [showSparkline, setShowSparkline] = useState(true);


  // Pull-to-refresh — refetches every live data source the home screen
  // depends on. Triggers a haptic tap on release for that polished feel.
  const [refreshing, setRefreshing] = useState(false);

  // Scroll-driven glass for the sticky top block. At rest the
  // gradient is already visible at a soft baseline so the safe-area
  // (Dynamic Island / status bar) sits on the brand glass instead of
  // raw bg.  Once the user starts scrolling, the BlurView + gradient
  // ramp up to full opacity so pinned content reads cleanly over the
  // feed that's sliding underneath.
  const scrollY = useRef(new Animated.Value(0)).current;
  // Two interpolations: blur ramps from 0→1, gradient ramps from a
  // visible 0.55 baseline → 1.  Keeping them separate means the
  // gradient never disappears, even at scrollY=0.
  // Once the hero (balance + actions) has scrolled away, a compact bar with
  // the balance fades in at the top.
  // The bar takes over exactly when the actions have scrolled under it.
  const [heroH, setHeroH] = useState(0);
  const COMPACT_AT = Math.max(120, heroH - (insets.top + 58));
  const compactRef = useRef(false);
  const [compact, setCompact] = useState(false);
  const compactOpacity = scrollY.interpolate({ inputRange: [COMPACT_AT - 24, COMPACT_AT], outputRange: [0, 1], extrapolate: 'clamp' });

  const onRefresh = async () => {
    setRefreshing(true);
    h.light();
    try {
      await Promise.all([refetchWallets(), refetchTxs(), refetchActivity(), refetchMarkets()]);
    } finally {
      setRefreshing(false);
    }
  };
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(tickers)) {
      tickers.forEach((m) => { map[m.base] = m.price; });
    }
    return map;
  }, [tickers]);

  // Per-asset 7d sparkline from CoinGecko — the same source as the asset
  // detail chart, so the data is real and per-asset (not synthesised).
  const sparklineMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    if (!Array.isArray(cgMarkets)) return map;
    cgMarkets.forEach((m) => {
      const sym = ID_TO_SYM[m.id];
      if (!sym) return;
      const pts = m.sparkline_in_7d?.price;
      if (!Array.isArray(pts) || pts.length < 2) return;
      const stride = Math.max(1, Math.floor(pts.length / 32));
      map[sym] = pts.filter((_, i) => i % stride === 0);
    });
    return map;
  }, [cgMarkets]);

  // 24h change map — colors the sparkline green/red per-asset.
  const changeMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(tickers)) {
      tickers.forEach((m) => { map[m.base] = m.changePct24h ?? 0; });
    }
    return map;
  }, [tickers]);

  // "Assets" tab only shows wallets the user actually holds. This turns
  // the implicit "you have 7 empty wallets" into the correct "no assets
  // owned" empty state.
  const ownedAssets = useMemo(
    () => list.filter((w) => Number(w.balance) > 0),
    [list],
  );

  // Fiat currencies — everything else is treated as crypto
  const FIAT_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY']);

  // Normalize a wallet currency to its Binance ticker base.
  // USDT_ERC20 / USDT_TRC20 both track as USDT (pegged $1).
  function tickerKey(currency: string): string {
    if (currency === 'USDT_ERC20' || currency === 'USDT_TRC20') return 'USDT';
    return currency;
  }

  const cryptoAssets = useMemo(
    () => ownedAssets.filter((w) => {
      if (FIAT_CURRENCIES.has(w.currency)) return false;
      // Hide ONLY wallets with a truly zero crypto balance. A coin with real
      // balance but a missing price (price=0) must still be shown — never
      // treat "price not loaded yet" as "$0 value".
      return Number(w.balance) > 0;
    }),
    [ownedAssets],
  );
  const dustAssets = useMemo(
    () => ownedAssets.filter((w) => {
      if (FIAT_CURRENCIES.has(w.currency)) return false;
      if (Number(w.balance) <= 0) return false;
      const tk = tickerKey(w.currency);
      const price = priceMap[tk] ?? (tk === 'USDT' ? 1 : 0);
      if (price <= 0) return false; // unknown price → can't judge dust yet
      const usdVal = Number(w.balance) * price;
      return usdVal < 5;
    }),
    [ownedAssets, priceMap],
  );
  const fiatAssets = useMemo(
    () => ownedAssets.filter((w) => FIAT_CURRENCIES.has(w.currency)),
    [ownedAssets],
  );
  const [dustPromptDismissed, setDustPromptDismissed] = useState(false);

  // Swipeable balances (Revolut-style): the total, then each currency held
  // (in that currency), then crypto as one page.
  const cryptoUsd = useMemo(() => cryptoAssets.reduce((sum, w) => {
    const tk = tickerKey(w.currency);
    const price = priceMap[tk] ?? (tk === 'USDT' ? 1 : 0);
    return sum + Number(w.balance) * price;
  }, 0), [cryptoAssets, priceMap]);
  type BalancePage = { key: string; kind: 'total' } | { key: string; kind: 'fiat'; wallet: Wallet } | { key: string; kind: 'crypto' };
  const balancePages = useMemo<BalancePage[]>(() => [
    { key: 'TOTAL', kind: 'total' },
    ...fiatAssets.filter((w) => Number(w.balance) > 0)
      .sort((a, b) => Number(b.fiatValueUsd) - Number(a.fiatValueUsd))
      .map((w) => ({ key: w.currency, kind: 'fiat' as const, wallet: w })),
    ...(cryptoAssets.length ? [{ key: 'CRYPTO', kind: 'crypto' as const }] : []),
  ], [fiatAssets, cryptoAssets]);
  const [balancePage, setBalancePage] = useState(0);
  const currentPage = balancePages[Math.min(balancePage, balancePages.length - 1)];
  const pageWidth = Dimensions.get('window').width;

  const totalUsd = useMemo(() => {
    return list.reduce((sum, w) => {
      const key = tickerKey(w.currency);
      const live = priceMap[key] ?? (key === 'USDT' ? 1 : undefined);
      if (live !== undefined) return sum + Number(w.balance) * live;
      return sum + Number(w.fiatValueUsd);
    }, 0);
  }, [list, priceMap]);

  // 24h change of the WHOLE balance. Only priced assets move; cash held in
  // fiat doesn't, so it dilutes the percentage rather than scaling the move.
  // Each asset's USD move is value × pct / (100 + pct) — its change since the
  // price 24h ago, measured from today's value.
  const deltaUsd = useMemo(() => {
    if (totalUsd <= 0 || !tickers || tickers.length === 0) return 0;
    let moved = 0;
    list.forEach((w) => {
      const m = tickers.find((t) => t.base === tickerKey(w.currency));
      if (!m || !m.changePct24h || m.changePct24h <= -100) return;
      moved += (Number(w.balance) * m.price * m.changePct24h) / (100 + m.changePct24h);
    });
    return moved;
  }, [list, tickers, totalUsd]);
  const deltaPct = totalUsd - deltaUsd > 0 ? (deltaUsd / (totalUsd - deltaUsd)) * 100 : 0;
  const positive = deltaPct >= 0;
  // Privacy mode is shared with the Wallet tab and persisted.
  const showBalance = !useUiStore((st) => st.balancesHidden);
  const toggleBalancesHidden = useUiStore((st) => st.toggleBalancesHidden);
  // Hidden balances can be peeked at by holding the figure; release hides again.
  const [peek, setPeek] = useState(false);
  const revealed = showBalance || peek;
  const locale = useI18n((st) => st.locale);
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: contactsService.list, staleTime: 60_000 });
  const { data: liveFiat } = useLiveFiatRates();
  const { data: forexRates } = useForexRates();
  const [cryptoOpen, setCryptoOpen] = useState(true);
  const [fiatOpen, setFiatOpen] = useState(true);

  // Display helpers — NEVER use the email local-part as a handle (PII leak).
  // Every account has a @handle, so we render it directly; the empty string
  // only shows for the brief moment before the user object hydrates.
  const handleSlug = realHandle(user);
  const handleLabel = handleSlug ? `@${handleSlug}` : '';
  const av = avatarMode(user);
  const initial = av.kind === 'initials' ? av.char : (user?.firstName?.[0] ?? '?').toUpperCase();

  // Primary actions sit directly under the balance — Buy, Sell, Send, Top up,
  // then the More (···) overflow. Everything else lives in the More modal.
  // The dock: the three moves people make most, plus More. Each opens a
  // full page (never an in-place modal), so back/swipe and deep links work.
  const ink = useShimmerInk();
  const DOCK: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { key: 'topup', icon: 'add',          label: t('action.topup'), onPress: () => router.push((currentPage?.kind === 'fiat' ? { pathname: '/topup', params: { currency: currentPage.wallet.currency } } : '/topup') as any) },
    { key: 'send',  icon: 'arrow-up',     label: t('action.send'),  onPress: () => router.push('/send' as any) },
    { key: 'buy',   icon: currentPage?.kind === 'fiat' ? 'swap-horizontal' : 'trending-up',
      label: t(currentPage?.kind === 'fiat' ? 'fx.exchange' : 'action.buy'),
      onPress: () => router.push((currentPage?.kind === 'fiat' ? { pathname: '/exchange', params: { from: currentPage.wallet.currency } } : '/buy') as any) },
    { key: 'more',  icon: 'grid-outline', label: t('home.more'),    onPress: () => setMoreMenuVisible(true) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {/* Light status bar over the blue compact card. */}
      <StatusBar style={themeMode !== 'light' ? 'light' : 'dark'} />
      <TopGradient />
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: 'transparent' }}
          contentContainerStyle={{ paddingBottom: 140 }}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: true,
              // Only flips at the threshold, so this re-renders twice per pass, not per frame.
              listener: (e: any) => {
                const past = e.nativeEvent.contentOffset.y > COMPACT_AT;
                if (past !== compactRef.current) { compactRef.current = past; setCompact(past); }
              },
            },
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={p.fg}
              colors={[p.ctaBg]}
              progressBackgroundColor={p.bgElev}
            />
          }
        >
          {/* Hero — header, balance and actions on the shimmer. It scrolls
              away with the feed; the compact bar (after the ScrollView)
              takes over at the top once it's gone. */}
          <View onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
          {/* Full-bleed shimmer behind the whole top section; it dissolves
              into the page at the bottom. */}
          <ShimmerBackdrop pageColor={p.bg} />

          {/* Header — who you are on the left (tap for your QR, hold for
              profile), scan + notifications on the right. */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingHorizontal: 24, paddingTop: insets.top + 4, paddingBottom: 0,
          }}>
            <Pressable
              onPress={() => { h.selection(); router.push('/receive'); }}
              onLongPress={() => { h.selection(); router.push('/profile'); }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('action.receive')}
              style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{
                width: 38, height: 38, borderRadius: 19, overflow: 'hidden',
                backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {av.kind === 'image' ? (
                  <Image source={{ uri: av.uri }} style={{ width: 38, height: 38 }} />
                ) : av.kind === 'emoji' ? (
                  <Text style={{ fontSize: 19 }}>{av.char}</Text>
                ) : (
                  <Text style={{ color: p.fg, fontWeight: '700', fontSize: 15 }}>{initial}</Text>
                )}
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, color: p.fg, fontSize: 21, fontWeight: '700', letterSpacing: -0.5 }}>
                {handleLabel || user?.firstName || ''}
              </Text>
              {user?.role === 'ADMIN' && (
                <Pressable
                  onPress={() => { h.selection(); router.push('/admin' as any); }}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
                    backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: p.accentText, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 }}>ADMIN</Text>
                </Pressable>
              )}
            </Pressable>
            <ChromeIconButton icon={showBalance ? 'eye-outline' : 'eye-off-outline'} label={t(showBalance ? 'wallet.hideBalances' : 'wallet.showBalances')} onPress={() => { h.selection(); toggleBalancesHidden(); }} />
            <ChromeIconButton icon="scan-outline" label={t('home.scan')} onPress={() => router.push('/scanner')} />
            <ChromeIconButton icon="notifications-outline" label={t('notifications.title')} badge={unreadData ?? 0} onPress={() => router.push('/notifications')} />
          </View>

          {/* Balances — swipe between the total, each currency held and crypto.
              Tap a figure for detail; when hidden, hold it to peek. */}
            {walletsLoading ? <View style={{ alignItems: 'center', paddingVertical: 10, marginTop: 14 }}><Skeleton width={200} height={48} /></View> : walletsError ? <EmptyState icon="cloud-offline-outline" title={t('wallet.loadError')} actionLabel={t('common.retry')} onAction={() => refetchWallets()} /> : <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
                if (i !== balancePage) { h.selection(); setBalancePage(i); }
              }}
              style={{ marginTop: 12 }}
            >
              {balancePages.map((pg) => {
                const peekProps = {
                  onLongPress: () => { if (!showBalance) { h.selection(); setPeek(true); } },
                  onPressOut: () => setPeek(false),
                };
                const label = pg.kind === 'total' ? t('home.balanceTotal')
                  : pg.kind === 'crypto' ? t('home.balanceCrypto')
                  : `${getCurrencyMeta(pg.wallet.currency)?.name ?? pg.wallet.currency} · ${pg.wallet.currency}`;
                return (
                  <View key={pg.key} style={{ width: pageWidth, alignItems: 'center' }}>
                    <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{label}</Text>
                    {pg.kind === 'fiat' ? (
                      <BalanceFigure
                        symbol={fiatSymbol(pg.wallet.currency as any, locale)}
                        amount={Number(pg.wallet.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: ['LYD', 'TND'].includes(String(pg.wallet.currency)) ? 3 : 2 })}
                        revealed={revealed}
                        palette={p}
                        onPress={() => { h.selection(); router.push(`/asset/${pg.wallet.currency}`); }}
                        {...peekProps}
                      />
                    ) : (
                      <AnimatedTotal
                        value={pg.kind === 'total' ? totalUsd : cryptoUsd}
                        palette={p}
                        dc={dc}
                        showBalance={revealed}
                        onPress={() => { h.selection(); if (pg.kind === 'total') setBalanceChartVisible(true); else router.push('/portfolio/crypto' as any); }}
                        {...peekProps}
                      />
                    )}
                    {/* One plain line under each figure. */}
                    {pg.kind === 'fiat' ? (() => {
                      const lf = liveFiat?.[String(pg.wallet.currency)];
                      const isDisplay = String(pg.wallet.currency) === dc.currency;
                      const value = lf ? Number(pg.wallet.balance) * lf.usd : Number(pg.wallet.fiatValueUsd);
                      const rate = !isDisplay && lf ? fiatRateLabel(String(pg.wallet.currency), lf.usd, dc, locale) : '';
                      return (
                        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                          {[isDisplay ? null : revealed ? `≈ ${dc.fmt(value)}` : '••••', rate || null].filter(Boolean).join('  ·  ')}
                        </Text>
                      );
                    })() : Math.abs(deltaUsd) >= 0.005 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={10} color={revealed ? (positive ? p.greenFg : p.redFg) : p.fgFaint} />
                        <Text style={{ color: revealed ? (positive ? p.greenFg : p.redFg) : p.fgFaint, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                          {revealed ? `${positive ? '+' : '−'}${dc.fmt(Math.abs(deltaUsd))} (${Math.abs(pg.kind === 'crypto' && cryptoUsd - deltaUsd > 0 ? (deltaUsd / (cryptoUsd - deltaUsd)) * 100 : deltaPct).toFixed(2)}%)` : '••••'}
                        </Text>
                        <Text style={{ color: p.fgMuted, fontSize: 13 }}>{pg.kind === 'crypto' ? t('home.assetsCount', { count: cryptoAssets.length }) + ' · ' + t('home.today') : t('home.today')}</Text>
                      </View>
                    ) : pg.kind === 'crypto' ? (
                      <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }}>{t('home.assetsCount', { count: cryptoAssets.length })}</Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
            {/* Page dots — the active one is a short pill. */}
            {balancePages.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 }}>
                {balancePages.map((pg, i) => (
                  <View key={pg.key} style={{ height: 5, width: i === balancePage ? 14 : 5, borderRadius: 3, backgroundColor: i === balancePage ? p.fg : p.fgFaint, opacity: i === balancePage ? 0.9 : 0.45 }} />
                ))}
              </View>
            )}
            {!showBalance && (
              <Text style={{ color: p.fgFaint, fontSize: 11, textAlign: 'center', marginTop: 6 }}>{t('home.holdToPeek')}</Text>
            )}
            </>}

            {/* Actions — compact glass circles on the gradient; only Top up is filled. */}
            <View style={{ flexDirection: 'row', marginTop: 20, marginHorizontal: 12, paddingBottom: 22 }}>
              {DOCK.map((a, i) => (
                <Pressable
                  key={a.key}
                  onPress={() => { h.light(); a.onPress(); }}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: i === 0 ? p.ctaBg : ink.glass,
                    borderWidth: i === 0 ? 0 : 1, borderColor: ink.glassBorder,
                  }}>
                    <Ionicons name={a.icon} size={18} color={i === 0 ? p.ctaFg : p.fg} />
                  </View>
                  <Text numberOfLines={1} style={{ color: p.fg, fontSize: 11.5, fontWeight: '600' }}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {/* /hero */}

          {/* Announcement Banner — out of the sticky region; lives
              between the pinned hero and the scrolling feed. */}
          <AnnouncementBanner />

          {/* Contacts — people you've sent money to or received from. */}
          {contacts.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 24, marginBottom: 10 }}>
                {t('home.contacts').toUpperCase()}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 6 }}>
                <Pressable onPress={() => { h.light(); router.push('/send' as any); }} style={({ pressed }) => ({ width: 64, alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bgElev, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border }}>
                    <Ionicons name="add" size={22} color={p.fg} />
                  </View>
                  <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 12 }}>{t('action.send')}</Text>
                </Pressable>
                {contacts.slice(0, 15).map((c) => (
                  <Pressable key={c.id} onPress={() => { h.selection(); router.push(`/contact/${c.id}` as any); }} style={({ pressed }) => ({ width: 64, alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
                    <Avatar name={c.name} uri={c.avatarUrl ?? undefined} size={50} />
                    <Text numberOfLines={1} style={{ color: p.fg, fontSize: 12, maxWidth: 62 }}>{c.name.split(' ')[0]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ paddingHorizontal: 24, marginTop: 18, marginBottom: 4 }}>
            <SegmentedControl<Tab> value={tab} onChange={setTab} options={[
              { key: 'ASSETS', label: t('home.assets') },
              { key: 'ACTIVITY', label: t('home.activity') },
            ]} />
          </View>

          {/* Rows */}
          {tab === 'ACTIVITY' ? (
            <ActivityList palette={p} dc={dc} items={activityItems} onSeeAll={() => { h.light(); router.push('/history'); }} />
          ) : ownedAssets.length > 0 ? (
            // Assets tab - divided into crypto and fiat sections
            <>
              {/* Crypto Assets Section */}
              {cryptoAssets.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 4 }}>
                    <Pressable onPress={() => setCryptoOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 }}>
                        {t('home.cryptoAssets').toUpperCase()}
                      </Text>
                      <Ionicons name={cryptoOpen ? 'chevron-up' : 'chevron-down'} size={12} color={p.fgFaint} />
                    </Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {showBalance ? dc.fmt(cryptoAssets.reduce((s, w) => {
                          const tk = tickerKey(w.currency);
                          const price = priceMap[tk] ?? (tk === 'USDT' ? 1 : 0);
                          return s + Number(w.balance) * price;
                        }, 0)) : '••••••'}
                      </Text>
                      <Pressable
                        onPress={() => { h.selection(); setShowSparkline((v) => !v); }}
                        hitSlop={8}
                        style={{ opacity: showSparkline ? 1 : 0.4 }}
                      >
                        <Ionicons name="pulse-outline" size={15} color={p.fgFaint} />
                      </Pressable>
                    </View>
                  </View>
                  {cryptoOpen && cryptoAssets.map((w, i) => {
                    const tk = tickerKey(w.currency);
                    const price = priceMap[tk] ?? (tk === 'USDT' ? 1 : undefined);
                    return (
                      <AssetRow
                        key={w.id}
                        last={i === cryptoAssets.length - 1}
                        wallet={w}
                        palette={p}
                        sparkline={sparklineMap[tk]}
                        changePct={changeMap[tk]}
                        unitPrice={price}
                        liveUsd={price !== undefined ? Number(w.balance) * price : undefined}
                        showBalance={showBalance}
                        showSparkline={showSparkline}
                        onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
                      />
                    );
                  })}
                  {/* Dust prompt — shown when ≥1 holding is worth < $5. Tapping
                      it deep-links into that asset's sell sheet so the user can
                      actually convert the dust. Only the X dismisses it. */}
                  {cryptoOpen && dustAssets.length > 0 && !dustPromptDismissed && (
                    <Pressable
                      onPress={() => { h.selection(); router.push({ pathname: '/sell', params: { asset: dustAssets[0].currency } } as any); }}
                      style={({ pressed }) => ({
                        marginHorizontal: 24, marginTop: 10, marginBottom: 4,
                        paddingHorizontal: 14, paddingVertical: 11,
                        borderRadius: 14,
                        backgroundColor: pressed ? p.bgElev : p.accentSoft,
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                      })}
                    >
                      <Ionicons name="swap-horizontal-outline" size={18} color={p.accentText} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '700' }}>
                          {dustAssets.length === 1
                            ? `${dustAssets[0].currency} dust — convert it?`
                            : `${dustAssets.length} small balances under $5 — convert them?`}
                        </Text>
                        <Text style={{ color: p.accentText, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                          {dustAssets.length === 1 ? 'Tap to sell or swap it' : `Tap to convert ${dustAssets[0].currency} first`}
                        </Text>
                      </View>
                      <Pressable onPress={() => setDustPromptDismissed(true)} hitSlop={10}>
                        <Ionicons name="close" size={16} color={p.accentText} style={{ opacity: 0.6 }} />
                      </Pressable>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Fiat Assets Section */}
              {fiatAssets.length > 0 && (
                <View style={{ marginTop: 24 }}>
                  <Pressable
                    onPress={() => setFiatOpen((v) => !v)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 4 }}
                  >
                    <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 }}>
                      {t('home.fiatAssets').toUpperCase()}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {showBalance ? dc.fmt(fiatAssets.reduce((s, w) => s + Number(w.fiatValueUsd), 0)) : '••••••'}
                      </Text>
                      <Ionicons name={fiatOpen ? 'chevron-up' : 'chevron-down'} size={14} color={p.fgFaint} />
                    </View>
                  </Pressable>
                  {fiatOpen && fiatAssets.map((w, i) => {
                    // Live rate (LYD from the parallel market), like crypto rows.
                    const lf = liveFiat?.[String(w.currency)];
                    const currency = String(w.currency);
                    const isDisplay = currency === dc.currency;
                    const perUsd = forexRates?.[currency];
                    const unitUsd = currency === 'USD' ? 1 : lf?.usd ?? (perUsd && perUsd > 0 ? 1 / perUsd : undefined);
                    const displayAvailable = dc.currency === 'USD' || Boolean(forexRates?.[dc.currency]);
                    const rateLabel = isDisplay ? `${fiatSymbol(currency, locale)}1 = ${fiatSymbol(currency, locale)}1`
                      : unitUsd && displayAvailable ? fiatRateLabel(currency, unitUsd, dc, locale) : t('wallet.rateUnavailable');
                    return (
                    <AssetRow
                      key={w.id}
                      last={i === fiatAssets.length - 1}
                      wallet={w}
                      palette={p}
                      sparkline={!isDisplay && lf?.points?.length ? lf.points : undefined}
                      changePct={!isDisplay && lf?.change24hPct != null ? lf.change24hPct : undefined}
                      liveUsd={unitUsd ? Number(w.balance) * unitUsd : undefined}
                      rateLabel={rateLabel}
                      showSparkline={showSparkline}
                      showBalance={showBalance}
                      onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
                    />
                    );
                  })}
                </View>
              )}

              {/* Savings / Budgets Section — named goals (trips, gifts, rainy
                  day). Tap a goal to open it, or "New goal" to start one. */}
              <View style={{ marginTop: 24 }}>
                <Pressable
                  onPress={() => { h.selection(); router.push('/budgets'); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 10 }}
                >
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6 }}>
                    {t('home.savings').toUpperCase()}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {budgets.length > 0 && (
                      <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600' }}>
                        {budgets.length} {budgets.length === 1 ? t('home.goal') : t('home.goals')}
                      </Text>
                    )}
                    <Ionicons name="chevron-forward" size={14} color={p.fgFaint} />
                  </View>
                </Pressable>

                {budgets.slice(0, 4).map((bud) => {
                  const bsym = fiatSymbol(bud.currency as any);
                  const bsaved = Number(bud.balance);
                  const btarget = bud.targetAmount != null ? Number(bud.targetAmount) : null;
                  const bpct = bud.progressPct != null
                    ? Math.min(100, Math.round(bud.progressPct))
                    : (btarget ? Math.min(100, Math.round((bsaved / btarget) * 100)) : 100);
                  const bdone = bud.status === 'COMPLETED';
                  return (
                    <Pressable
                      key={bud.id}
                      onPress={() => { h.selection(); router.push(`/budgets/${bud.id}`); }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: pressed ? p.bgElev : 'transparent' })}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>{bud.emoji ?? '🎯'}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{bud.name}</Text>
                          {bud.locked && <Ionicons name="lock-closed" size={11} color={p.fgMuted} />}
                          {bdone && <Ionicons name="checkmark-circle" size={13} color={p.greenFg} />}
                        </View>
                        {/* Progress bar */}
                        <View style={{ height: 5, borderRadius: 3, backgroundColor: p.border, marginTop: 6, overflow: 'hidden' }}>
                          <View style={{ width: `${bpct}%`, height: '100%', borderRadius: 3, backgroundColor: bdone ? p.greenFg : p.accent }} />
                        </View>
                      </View>
                      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {showBalance ? `${bsym}${bsaved.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '••••'}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => { h.medium(); router.push('/budgets/new'); }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: pressed ? p.bgElev : 'transparent' })}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="add" size={20} color={p.accentText} />
                  </View>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600', flex: 1 }}>
                    {budgets.length > 0 ? t('home.newGoal') : t('home.startSaving')}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={p.fgFaint} />
                </Pressable>
              </View>
            </>
          ) : (
            <View style={{ paddingVertical: 56, alignItems: 'center', paddingHorizontal: 24 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="wallet-outline" size={26} color={p.fgMuted} />
              </View>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600', marginTop: 14, letterSpacing: -0.2 }}>
                {t('home.noAssetsOwned')}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 4, textAlign: 'center' }}>
                {t('home.noAssetsBody')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <Pressable
                  onPress={() => { h.medium(); router.push('/buy' as any); }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22,
                    backgroundColor: p.ctaBg, opacity: pressed ? 0.85 : 1,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  })}
                >
                  <Ionicons name="add" size={14} color={p.ctaFg} />
                  <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '600' }}>{t('home.buyCrypto')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => { h.medium(); router.push('/topup' as any); }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22,
                    backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  })}
                >
                  <Ionicons name="arrow-down" size={14} color={p.fg} />
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{t('action.deposit')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Animated.ScrollView>

      {/* Compact balance card — takes over once the hero has scrolled off:
          brand blue, your photo and @handle, a large balance, privacy and
          notifications. Greyscale in mono. */}
      <Animated.View
        pointerEvents={compact ? 'box-none' : 'none'}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, opacity: compactOpacity,
          shadowColor: p.bg, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
        }}
      >
        <LinearGradient
          colors={p.balanceGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 8, paddingBottom: 18, paddingHorizontal: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => { h.selection(); router.push('/profile'); }} hitSlop={6} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.75 : 1 })}>
              <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                {av.kind === 'image' ? (
                  <Image source={{ uri: av.uri }} style={{ width: 34, height: 34 }} />
                ) : av.kind === 'emoji' ? (
                  <Text style={{ fontSize: 17 }}>{av.char}</Text>
                ) : (
                  <Text style={{ color: p.fg, fontWeight: '700', fontSize: 14 }}>{initial}</Text>
                )}
              </View>
              <Text numberOfLines={1} style={{ flexShrink: 1, color: p.fg, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }}>
                {handleLabel || user?.firstName || ''}
              </Text>
            </Pressable>
            <ChromeIconButton variant="default" icon={showBalance ? 'eye-outline' : 'eye-off-outline'} label={t(showBalance ? 'wallet.hideBalances' : 'wallet.showBalances')} onPress={toggleBalancesHidden} />
            <ChromeIconButton variant="default" icon="notifications-outline" label={t('notifications.title')} badge={unreadData ?? 0} onPress={() => router.push('/notifications')} />
          </View>
          <Pressable
            onPress={() => { h.selection(); setBalanceChartVisible(true); }}
            onLongPress={() => { if (!showBalance) { h.selection(); setPeek(true); } }}
            onPressOut={() => setPeek(false)}
            delayLongPress={220}
            accessibilityRole="button"
            accessibilityLabel={t('wallet.totalBalance')}
            style={{ marginTop: 14 }}
          >
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{t('wallet.totalBalance')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flexShrink: 1, color: p.fg, fontFamily: F.semibold, fontSize: 32, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>
                {revealed ? dc.fmt(totalUsd) : '••••••'}
              </Text>
              {Math.abs(deltaUsd) >= 0.005 && (
                <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  {revealed ? `${positive ? '▲' : '▼'} ${Math.abs(deltaPct).toFixed(2)}%` : ''}
                </Text>
              )}
            </View>
          </Pressable>
        </LinearGradient>
      </Animated.View>


      {/* More — the rest of the money moves (round icons, four across, no
          tiles), then account and tools as a plain list. */}
      <BottomSheet visible={moreMenuVisible} onClose={() => setMoreMenuVisible(false)} title={t('home.more')}>
        <SectionLabel first>{t('home.moveMoney')}</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginHorizontal: -4 }}>
          {[
            { icon: 'swap-horizontal' as const,    label: t('fx.exchange'),       href: '/exchange' },
            { icon: 'trending-down' as const,      label: t('action.sell'),       href: '/sell' },
            { icon: 'arrow-down' as const,         label: t('action.receive'),    href: '/receive' },
            { icon: 'arrow-up-circle-outline' as const, label: t('action.withdraw'), href: '/withdraw' },
            { icon: 'swap-horizontal' as const,    label: t('action.swap'),       href: '/transfer' },
            { icon: 'globe-outline' as const,      label: t('action.sendAbroad'), href: '/remit' },
            { icon: 'repeat' as const,             label: t('recurring.title'),   href: '/recurring' },
            { icon: 'people-outline' as const,     label: 'P2P',                  href: '/p2p' },
            { icon: 'scan-outline' as const,       label: t('home.scan'),         href: '/scanner' },
          ].map((item) => (
            <Pressable
              key={item.href}
              onPress={() => { h.selection(); setMoreMenuVisible(false); router.push(item.href as any); }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => ({ width: '25%', alignItems: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{
                width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.bgElev, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border,
              }}>
                <Ionicons name={item.icon} size={21} color={p.fg} />
              </View>
              <Text numberOfLines={1} style={{ color: p.fg, fontSize: 12, fontWeight: '500', maxWidth: '92%' }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <SectionLabel>{t('home.yourAccount')}</SectionLabel>
        <Panel>
          {[
            { icon: 'flag-outline' as const,          label: t('home.budgets'),         href: '/budgets' },
            { icon: 'card-outline' as const,          label: t('home.cards'),           href: '/cards' },
            { icon: 'time-outline' as const,          label: t('home.history'),         href: '/history' },
            { icon: 'document-text-outline' as const, label: t('home.statements'),      href: '/statements' },
            { icon: 'pie-chart-outline' as const,     label: t('home.cryptoPortfolio'), href: '/portfolio/crypto' },
            { icon: 'wallet-outline' as const,        label: t('home.fiatPortfolio'),   href: '/portfolio/fiat' },
            { icon: 'gift-outline' as const,          label: t('home.referral'),        href: '/referral' },
            { icon: 'settings-outline' as const,      label: t('settings.title'),       href: '/settings' },
          ].map((item, i, all) => (
            <PanelRow key={item.href} icon={item.icon} label={item.label} last={i === all.length - 1}
              onPress={() => { h.selection(); setMoreMenuVisible(false); router.push(item.href as any); }} />
          ))}
        </Panel>
      </BottomSheet>

      <BalanceHistoryModal
        visible={balanceChartVisible}
        onClose={() => setBalanceChartVisible(false)}
        totalUsd={totalUsd}
        txItems={txData?.items ?? []}
        priceMap={priceMap}
        dc={dc}
        palette={p}
      />
    </View>
  );
}

/* ── Animated total balance ──
 *
 *  Behaviour:
 *   1. On the FIRST mount the displayed number animates from 0 → value
 *      over ~900ms (count-up effect).
 *   2. Every time `value` changes after that we animate from the
 *      previously-displayed number to the new one (so live price ticks
 *      smoothly cascade through the digits instead of jump-cutting).
 *   3. When `value` rises we briefly flash the text green and slide a
 *      pill (+$X.YZ) up beside it; when it falls we flash red. The pill
 *      fades out after 1.8s so the user sees the cause of the change.
 *
 *  Implementation note: we don't use Reanimated here because the digits
 *  need to be re-stringified on every frame (Reanimated runs on the UI
 *  thread and can't easily mutate Text content). A 60Hz JS interval is
 *  fine for a single label.
 */

/* ── Balance History Chart ─── */
type HistoryPt = { date: Date; balanceUsd: number };
type ChartRange = '1W' | '1M' | '3M' | 'ALL';

function buildBalanceHistory(
  currentTotal: number,
  txs: Array<{ amount: string | number; currency: string; createdAt: string | Date }>,
  priceMap: Partial<Record<string, number>>,
): HistoryPt[] {
  const pts: HistoryPt[] = [];
  let running = currentTotal;
  pts.push({ date: new Date(), balanceUsd: running });
  for (const tx of txs) {
    const amt = Number(tx.amount);
    if (isNaN(amt)) continue;
    const price = priceMap[tx.currency] ?? 1;
    running = Math.max(0, running - amt * price);
    pts.push({ date: new Date(tx.createdAt), balanceUsd: running });
  }
  return pts.reverse();
}

function fmtDDMMYYYY(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function smoothSvgPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], curr = pts[i];
    const mx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C ${mx} ${prev.y.toFixed(1)}, ${mx} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

function BalanceHistoryModal({
  visible, onClose, totalUsd, txItems, priceMap, dc, palette: p,
}: {
  visible: boolean;
  onClose: () => void;
  totalUsd: number;
  txItems: Array<{ amount: string | number; currency: string; createdAt: string | Date }>;
  priceMap: Partial<Record<string, number>>;
  dc: ReturnType<typeof useDisplayCurrency>;
  palette: Palette;
}) {
  const insets = useSafeAreaInsets();
  const W = Dimensions.get('window').width;
  const CHART_H = 200;
  const CHART_W = W - 48;
  const PLOT_H = CHART_H - 24; // leave 24px for x-axis labels

  const [range, setRange] = useState<ChartRange>('1M');
  const [touchIdx, setTouchIdx] = useState<number | null>(null);

  const allPoints = useMemo(
    () => buildBalanceHistory(totalUsd, txItems, priceMap),
    [totalUsd, txItems, priceMap],
  );

  const points = useMemo(() => {
    const days: Record<ChartRange, number> = { '1W': 7, '1M': 30, '3M': 90, 'ALL': Infinity };
    const d = days[range];
    if (!isFinite(d)) return allPoints;
    const cutoff = Date.now() - d * 86_400_000;
    const filtered = allPoints.filter((pt) => pt.date.getTime() >= cutoff);
    return filtered.length >= 2 ? filtered : allPoints.slice(-Math.max(2, allPoints.length));
  }, [allPoints, range]);

  const { svgPts } = useMemo(() => {
    if (points.length < 2) return { svgPts: [] as Array<{ x: number; y: number }> };
    const vals = points.map((pt) => pt.balanceUsd);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const spread = mx - mn || 1;
    const svgPts = points.map((pt, i) => ({
      x: (i / (points.length - 1)) * CHART_W,
      y: PLOT_H - ((pt.balanceUsd - mn) / spread) * (PLOT_H - 10) - 5,
    }));
    return { svgPts };
  }, [points, CHART_W, PLOT_H]);

  const linePath = useMemo(() => smoothSvgPath(svgPts), [svgPts]);
  const fillPath = linePath
    ? `${linePath} L ${CHART_W.toFixed(1)} ${PLOT_H.toFixed(1)} L 0 ${PLOT_H.toFixed(1)} Z`
    : '';

  const trend = points.length > 1
    ? points[points.length - 1].balanceUsd >= points[0].balanceUsd
    : true;
  const lineColor = trend ? p.greenFg : p.redFg;

  const activeIdx = touchIdx !== null ? Math.max(0, Math.min(points.length - 1, touchIdx)) : points.length - 1;
  const activePoint = points[activeIdx];
  const activeSvg = svgPts[activeIdx];

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const x = e.nativeEvent.locationX;
          setTouchIdx(Math.round((x / CHART_W) * (points.length - 1)));
        },
        onPanResponderMove: (e) => {
          const x = e.nativeEvent.locationX;
          setTouchIdx(Math.round((x / CHART_W) * (points.length - 1)));
        },
        onPanResponderRelease: () => setTouchIdx(null),
      }),
    [CHART_W, points.length],
  );

  // 3 evenly-spaced x-axis date labels
  const xLabels = useMemo(() => {
    if (points.length < 2) return [];
    return [0, Math.floor((points.length - 1) / 2), points.length - 1].map((idx) => ({
      label: fmtDDMMYYYY(points[idx].date),
    }));
  }, [points]);

  if (!visible) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} contentStyle={{ paddingHorizontal: 0 }}>
          {/* Active balance */}
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <Text style={{
              color: p.fg, fontSize: 34, fontWeight: '600',
              letterSpacing: -1.2, fontVariant: ['tabular-nums'],
            }}>
              {activePoint ? dc.fmt(activePoint.balanceUsd) : dc.fmt(totalUsd)}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 3 }}>
              {activePoint ? fmtDDMMYYYY(activePoint.date) : fmtDDMMYYYY(new Date())}
              {touchIdx === null ? ` · ${fmtDDMMYYYY(new Date())}` : ''}
            </Text>
          </View>

          {/* Chart */}
          {points.length < 2 ? (
            <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center', marginHorizontal: 24 }}>
              <Ionicons name="analytics-outline" size={32} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 10 }}>
                Not enough data yet
              </Text>
            </View>
          ) : (
            <View style={{ marginHorizontal: 24 }}>
              <View
                style={{ height: CHART_H }}
                {...panResponder.panHandlers}
              >
                <BalanceSvg width={CHART_W} height={CHART_H}>
                  <SvgDefs>
                    <SvgLinearGradient id="bhGrad" x1="0" y1="0" x2="0" y2="1">
                      <SvgStop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
                      <SvgStop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
                    </SvgLinearGradient>
                  </SvgDefs>

                  {/* Gradient fill */}
                  {fillPath ? <SvgPath d={fillPath} fill="url(#bhGrad)" /> : null}

                  {/* Stroke */}
                  {linePath ? (
                    <SvgPath
                      d={linePath}
                      stroke={lineColor}
                      strokeWidth={2.2}
                      fill="none"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ) : null}

                  {/* Start point */}
                  {svgPts[0] && (
                    <SvgCircle cx={svgPts[0].x} cy={svgPts[0].y} r={4} fill={lineColor} />
                  )}

                  {/* Cursor */}
                  {activeSvg && touchIdx !== null && (
                    <>
                      <SvgLine
                        x1={activeSvg.x} y1={0}
                        x2={activeSvg.x} y2={PLOT_H}
                        stroke={p.fgFaint}
                        strokeWidth={1}
                        strokeDasharray="4,3"
                      />
                      <SvgCircle cx={activeSvg.x} cy={activeSvg.y} r={9} fill={lineColor} fillOpacity={0.2} />
                      <SvgCircle cx={activeSvg.x} cy={activeSvg.y} r={5} fill={lineColor} />
                    </>
                  )}

                  {/* End dot (when not touching) */}
                  {svgPts.length > 0 && touchIdx === null && (
                    <>
                      <SvgCircle
                        cx={svgPts[svgPts.length - 1].x}
                        cy={svgPts[svgPts.length - 1].y}
                        r={8}
                        fill={lineColor}
                        fillOpacity={0.2}
                      />
                      <SvgCircle
                        cx={svgPts[svgPts.length - 1].x}
                        cy={svgPts[svgPts.length - 1].y}
                        r={4}
                        fill={lineColor}
                      />
                    </>
                  )}
                </BalanceSvg>
              </View>

              {/* X-axis labels */}
              {xLabels.length === 3 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  {xLabels.map((l, i) => (
                    <Text key={i} style={{ color: p.fgFaint, fontSize: 9, fontWeight: '600' }}>
                      {l.label}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Range pills */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20, paddingHorizontal: 24 }}>
            {(['1W', '1M', '3M', 'ALL'] as ChartRange[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => { setTouchIdx(null); setRange(r); }}
                style={{
                  paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20,
                  backgroundColor: range === r ? p.accent : p.pillBg,
                  borderWidth: 1,
                  borderColor: range === r ? p.accent : p.border,
                }}
              >
                <Text style={{
                  color: range === r ? p.accentFg : p.fgMuted,
                  fontSize: 13, fontWeight: '600',
                }}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
        </BottomSheet>
  );
}

/**
 * Self-contained breathing radial gradient for the sticky card.
 *
 * Its per-frame state lives HERE, not in Home — so the animation re-renders
 * only this tiny SVG, never the whole screen (asset rows, etc.). That's the
 * fix for the card jitter: previously the rAF→setState loop sat in Home and
 * re-rendered everything ~25×/s. Memoised so parent re-renders don't reset it.
 * Flat charcoal (no motion) in mono theme.
 */
function AnimatedTotal({
  value,
  palette: p,
  dc,
  showBalance,
  onPress,
  onLongPress,
  onPressOut,
}: {
  value: number;
  palette: Palette;
  dc: ReturnType<typeof useDisplayCurrency>;
  showBalance: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
}) {
  const t = useT();
  const initializedRef = useRef(false);
  const [displayed, setDisplayed] = useState(0);
  // Live mirror of `displayed` so the animation always eases from the CURRENT
  // number, not a stale render closure (the old [value]-dep effect read a stale
  // `displayed`, which made it jump/restart on every live tick — the jitter).
  const displayedRef = useRef(0);

  useEffect(() => {
    // First real value → snap, no count-up.
    if (!initializedRef.current && value > 0) {
      initializedRef.current = true;
      displayedRef.current = value;
      setDisplayed(value);
      return;
    }
    const from = displayedRef.current;
    const delta = value - from;
    // Ignore micro-ticks (sub-cent / rounding noise from live prices) so the
    // number doesn't twitch every websocket frame.
    if (Math.abs(delta) < 0.01) return;

    // Duration scales gently with how big the jump is, capped — small live
    // ticks settle fast (~450ms), big changes glide (~1100ms). Keeps it smooth
    // without ever feeling sluggish or restarting a long anim on every tick.
    const dur = Math.min(1100, 350 + Math.abs(delta) / Math.max(1, Math.abs(value)) * 4000);
    const start = Date.now();
    let raf: any;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / dur);
      // easeOutCubic — fast, natural settle (no jarring mid-point kink).
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + delta * eased;
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);


  const converted = dc.convert(displayed);
  const totalStr = converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: dc.isCrypto ? 6 : 2 });
  const visibleTotal = showBalance ? totalStr : '••••••';
  const digitCount = totalStr.replace(/[^0-9]/g, '').length;
  const amountSize = digitCount <= 7 ? 48 : digitCount <= 9 ? 42 : digitCount <= 11 ? 34 : 28;
  const symbolSize = Math.max(22, Math.round(amountSize * 0.5));
  const fractionSize = Math.max(18, Math.round(amountSize * 0.6));
  const lineHeight = Math.round(amountSize * 1.06);

  // One clean numeric lockup: all parts use Outfit with tabular numerals,
  // zero tracking, and a restrained fraction so the balance matches the rest
  // of the app instead of reading like a separate display treatment.
  const [whole, frac] = visibleTotal.split('.');

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 2, paddingBottom: 2 }}>
      {/* Centred under its label. Tap for the balance history chart. */}
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
        delayLongPress={220}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('home.totalBalance')}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'center',
          maxWidth: '100%',
        }}
      >
        <Text style={{
          color: p.fgMuted,
          fontFamily: F.semibold,
          fontSize: symbolSize,
          lineHeight,
          marginTop: Math.max(0.5, amountSize * 0.06),
          marginRight: 3,
          letterSpacing: 0,
          fontVariant: ['tabular-nums'],
        }}>
          {dc.symbol}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={{
            color: p.fg,
            fontFamily: F.semibold,
            fontWeight: '600',
            fontSize: amountSize,
            lineHeight,
            letterSpacing: -0.5,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
            includeFontPadding: false,
          }}
        >
          {whole}
          {frac != null && (
            <Text style={{
              color: p.fgFaint,
              fontFamily: F.semibold,
              fontSize: fractionSize,
              lineHeight,
              letterSpacing: 0,
              fontVariant: ['tabular-nums'],
              includeFontPadding: false,
            }}>
              .{frac}
            </Text>
          )}
        </Text>
      </Pressable>
    </View>
  );
}

/** "$1 = 9.37 LD" for currencies worth less than the display currency, "€1 = $1.12" otherwise. */
function fiatRateLabel(currency: string, usdPerUnit: number, dc: ReturnType<typeof useDisplayCurrency>, locale: string): string {
  const inDisplay = dc.convert(usdPerUnit);
  if (!Number.isFinite(inDisplay) || inDisplay <= 0) return '';
  const own = fiatSymbol(currency as any, locale);
  if (inDisplay < 1) {
    const per = 1 / inDisplay;
    return `${dc.symbol}1 = ${per.toLocaleString('en-US', { maximumFractionDigits: per >= 100 ? 2 : per >= 10 ? 3 : 4 })} ${own}`;
  }
  return `${own}1 = ${dc.symbol}${inDisplay.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
}

/** A static balance in its own currency, in the same lockup as AnimatedTotal. */
function BalanceFigure({ symbol, amount, revealed, palette: p, onPress, onLongPress, onPressOut }: {
  symbol: string; amount: string; revealed: boolean; palette: Palette;
  onPress?: () => void; onLongPress?: () => void; onPressOut?: () => void;
}) {
  const shown = revealed ? amount : '••••••';
  const [whole, frac] = shown.split('.');
  const digits = amount.replace(/[^0-9]/g, '').length;
  const size = digits <= 7 ? 48 : digits <= 9 ? 42 : digits <= 11 ? 34 : 28;
  const lineHeight = Math.round(size * 1.06);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} delayLongPress={220} hitSlop={12}
      style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 2, maxWidth: '100%' }}>
      <Text style={{ color: p.fgMuted, fontFamily: F.semibold, fontSize: Math.max(18, Math.round(size * (symbol.length > 2 ? 0.36 : 0.5))), lineHeight, marginTop: Math.max(0.5, size * 0.06), marginRight: 4, fontVariant: ['tabular-nums'] }}>
        {symbol}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}
        style={{ color: p.fg, fontFamily: F.semibold, fontWeight: '600', fontSize: size, lineHeight, letterSpacing: -0.5, fontVariant: ['tabular-nums'], includeFontPadding: false }}>
        {whole}
        {frac != null && (
          <Text style={{ color: p.fgFaint, fontFamily: F.semibold, fontSize: Math.max(18, Math.round(size * 0.6)), lineHeight, fontVariant: ['tabular-nums'] }}>.{frac}</Text>
        )}
      </Text>
    </Pressable>
  );
}

function TabBtn({ label, active, palette: p, onPress }: {
  label: string; active: boolean; palette: Palette; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={4}>
      <View style={{
        paddingHorizontal: 22, paddingVertical: 7,
        borderRadius: 9,
        backgroundColor: active ? p.accent : 'transparent',
      }}>
        <Text style={{
          color: active ? p.accentFg : p.fgMuted,
          fontSize: 14,
          fontWeight: active ? '700' : '600',
          letterSpacing: -0.2,
        }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

type TxItem = {
  id: string; type: string; amount: string | number; currency: string;
  description?: string | null; createdAt: string | Date;
  status?: string | null;
  fee?: string | null;
  reference?: string | null;
  counterpartyHandle?: string | null;
  counterpartyName?: string | null;
  counterpartyAvatar?: string | null;
  note?: string | null;
  metadata?: { asset?: string; cryptoAmount?: number; priceUsd?: number; counterpartyName?: string; note?: string; settlementCurrency?: string; settlementAmount?: string } | null;
};

/* ── Detail row ─── */
function DetailRow({
  label, value, palette: p, icon, borderTop,
}: {
  label: string; value: string; palette: Palette;
  icon: keyof typeof Ionicons.glyphMap; borderTop?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
      borderTopWidth: borderTop ? StyleSheet.hairlineWidth : 0,
      borderTopColor: p.border,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: p.bg, borderWidth: 1, borderColor: p.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={14} color={p.fgMuted} />
      </View>
      <Text style={{ flex: 1, color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatCryptoDisplay(value: unknown, currency: string, maximumFractionDigits = 8): string {
  const raw = String(value ?? '').trim();
  const n = Number(raw);
  const amount = Number.isFinite(n)
    ? n.toLocaleString('en-US', { maximumFractionDigits })
    : raw.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return `${amount} ${currency}`;
}

/* ── Transaction detail bottom sheet ─── */
function TxDetailModal({
  tx, palette: p, dc, onClose,
}: {
  tx: TxItem | null;
  palette: Palette;
  dc: ReturnType<typeof useDisplayCurrency>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  if (!tx) return null;

  const meta      = tx.metadata ?? {};
  const amt       = Number(tx.amount);
  const abs       = Math.abs(amt);
  const isCredit  = amt >= 0;
  const type      = tx.type;
  const asset     = meta.asset ?? tx.currency;
  const showDual  = (type === 'BUY' || type === 'SELL') && meta.cryptoAmount;
  // The amount is denominated in the transaction's OWN currency (the
  // wallet/method actually used) — never the display currency. Show it
  // exactly, with that currency's symbol & precision.
  const settleCcy = (meta.settlementCurrency ?? tx.currency) as any;
  const settleAbs = meta.settlementAmount != null ? Math.abs(Number(meta.settlementAmount)) : abs;
  const fiatStr   = formatMoney(settleAbs, settleCcy, { showSymbol: true });
  const cryptoStr = meta.cryptoAmount
    ? formatCryptoDisplay(meta.cryptoAmount, asset, 8)
    : null;

  const dt        = new Date(tx.createdAt);
  const dateLabel = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeLabel = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const cpName    = tx.counterpartyName ?? meta.counterpartyName ?? null;
  const cpHandle  = tx.counterpartyHandle ?? null;
  const cpAvatar  = tx.counterpartyAvatar ?? null;
  const note      = tx.note ?? meta.note ?? null;
  const fee       = tx.fee && Number(tx.fee) > 0 ? Number(tx.fee) : null;
  const reference = tx.reference ?? tx.id;
  const status    = ((tx.status ?? 'COMPLETED') as string).toUpperCase();

  let title = '';
  if      (type === 'BUY')          title = `Bought ${asset}`;
  else if (type === 'SELL')         title = `Sold ${asset}`;
  else if (type === 'DEPOSIT')      title = 'Deposit';
  else if (type === 'WITHDRAW' || type === 'WITHDRAWAL') title = 'Withdrawal';
  else if (type === 'TRANSFER_IN')  title = 'Transfer In';
  else if (type === 'TRANSFER_OUT') title = 'Transfer Out';
  else if (type === 'SEND')         title = 'Sent';
  else if (type === 'RECEIVE')      title = 'Received';
  else if (type === 'SWAP')         title = 'Swap';
  else if (type === 'P2P_BUY')      title = `P2P Buy · ${asset}`;
  else if (type === 'P2P_SELL')     title = `P2P Sell · ${asset}`;
  else if (type === 'CARD_SPEND')   title = 'Card Spend';
  else if (type === 'CASHBACK')     title = 'Cashback';
  else title = type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ');

  const isIncoming = type === 'BUY' || type === 'RECEIVE' || type === 'TRANSFER_IN'
    || type === 'DEPOSIT' || type === 'CASHBACK' || type === 'P2P_BUY' || isCredit;
  const accent   = isIncoming ? p.greenFg : p.redFg;
  const accentBg = isIncoming ? p.greenBg : p.redBg;

  const statusColors: Record<string, { bg: string; fg: string }> = {
    COMPLETED:  { bg: p.greenBg,               fg: p.greenFg  },
    PENDING:    { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b'  },
    PROCESSING: { bg: 'rgba(99,102,241,0.15)',  fg: '#818cf8'  },
    FAILED:     { bg: p.redBg,   fg: p.redFg    },
    CANCELLED:  { bg: p.pillBg,                fg: p.fgMuted  },
  };
  const sc = statusColors[status] ?? statusColors.COMPLETED;

  const cpDirection = (type === 'TRANSFER_IN' || type === 'RECEIVE') ? 'FROM' : 'TO';

  async function copyRef() {
    await Clipboard.setStringAsync(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <BottomSheet visible={true} onClose={onClose} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

            {/* ── Hero ── */}
            <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: accentBg, alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, overflow: 'hidden',
              }}>
                <CurrencyIcon currency={asset} palette={p} size={64} />
              </View>

              <Text style={{ color: p.fg, fontSize: 24, fontWeight: '600', letterSpacing: -0.5, textAlign: 'center' }}>
                {title}
              </Text>

              <View style={{
                marginTop: 10, paddingHorizontal: 14, paddingVertical: 5,
                borderRadius: 20, backgroundColor: sc.bg,
              }}>
                <Text style={{ color: sc.fg, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 }}>
                  {status}
                </Text>
              </View>

              <View style={{ marginTop: 28, alignItems: 'center' }}>
                {showDual && cryptoStr ? (
                  <>
                    <Text style={{
                      color: type === 'BUY' ? p.greenFg : p.redFg,
                      fontSize: 36, fontWeight: '600', letterSpacing: -1.2, fontVariant: ['tabular-nums'],
                    }}>
                      {type === 'BUY' ? '+' : '−'}{cryptoStr}
                    </Text>
                    <Text style={{
                      color: p.fgMuted, fontSize: 20, fontWeight: '600', marginTop: 6, fontVariant: ['tabular-nums'],
                    }}>
                      {type === 'BUY' ? '−' : '+'}{fiatStr}
                    </Text>
                  </>
                ) : (
                  <Text style={{
                    color: accent, fontSize: 36, fontWeight: '600', letterSpacing: -1.2, fontVariant: ['tabular-nums'],
                  }}>
                    {isCredit ? '+' : '−'}{fiatStr}
                  </Text>
                )}
              </View>
            </View>

            {/* ── Details ── */}
            <View style={{
              marginHorizontal: 20, marginBottom: 12,
              backgroundColor: p.bgElev, borderRadius: 20,
              borderWidth: 1, borderColor: p.border, overflow: 'hidden',
            }}>
              <DetailRow icon="calendar-outline" label="Date"     value={dateLabel} palette={p} />
              <DetailRow icon="time-outline"     label="Time"     value={timeLabel} palette={p} borderTop />
              {(type === 'BUY' || type === 'SELL') && meta.priceUsd != null && (
                <DetailRow icon="pricetag-outline" label="Asset Price" value={dc.fmt(meta.priceUsd)} palette={p} borderTop />
              )}
              {(type === 'BUY' || type === 'SELL') && meta.cryptoAmount != null && (
                <DetailRow
                  icon="layers-outline" label="Quantity"
                  value={formatCryptoDisplay(meta.cryptoAmount, asset, 8)}
                  palette={p} borderTop
                />
              )}
              {fee !== null && (
                <DetailRow icon="flash-outline" label="Network Fee" value={formatMoney(fee, settleCcy, { showSymbol: true })} palette={p} borderTop />
              )}
              <DetailRow
                icon="wallet-outline"
                label={type === 'BUY' ? 'Paid with' : type === 'SELL' ? 'Received in' : 'Currency'}
                value={settleCcy}
                palette={p} borderTop
              />
            </View>

            {/* ── Counterparty ── */}
            {(cpName || cpHandle) && (
              <View style={{
                marginHorizontal: 20, marginBottom: 12,
                backgroundColor: p.bgElev, borderRadius: 20,
                borderWidth: 1, borderColor: p.border,
                padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
              }}>
                <View style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: p.border,
                  alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {cpAvatar
                    ? <Image source={{ uri: cpAvatar }} style={{ width: 52, height: 52 }} />
                    : <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600' }}>
                        {(cpName ?? cpHandle ?? '?')[0].toUpperCase()}
                      </Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 }}>
                    {cpDirection}
                  </Text>
                  {cpName && (
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{cpName}</Text>
                  )}
                  {cpHandle && (
                    <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 1 }}>
                      @{cpHandle}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* ── Note ── */}
            {note && note !== cpName && (
              <View style={{
                marginHorizontal: 20, marginBottom: 12,
                backgroundColor: p.bgElev, borderRadius: 20,
                borderWidth: 1, borderColor: p.border, padding: 16,
              }}>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>
                  NOTE
                </Text>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600', lineHeight: 21 }}>{note}</Text>
              </View>
            )}

            {/* ── Reference ── */}
            <View style={{
              marginHorizontal: 20,
              backgroundColor: p.bgElev, borderRadius: 20,
              borderWidth: 1, borderColor: p.border,
              padding: 16, flexDirection: 'row', alignItems: 'center',
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 }}>
                  REFERENCE
                </Text>
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 }} numberOfLines={1}>
                  {reference}
                </Text>
              </View>
              <Pressable
                onPress={copyRef} hitSlop={8}
                style={({ pressed }) => ({
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: copied ? p.greenBg : (pressed ? p.border : p.pillBg),
                  borderWidth: 1, borderColor: copied ? p.greenFg : p.border,
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                })}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={13}
                  color={copied ? p.greenFg : p.fgMuted}
                />
                <Text style={{ color: copied ? p.greenFg : p.fgMuted, fontSize: 12, fontWeight: '600' }}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </Pressable>
            </View>

          </ScrollView>
        </BottomSheet>
  );
}

/* ── Activity list — the most recent transactions inline on home ───
 * Grouped by day, one calm row per transaction: the asset icon with a small
 * direction badge, a short title, time + context underneath, and the amount
 * (incoming in green, outgoing in the normal ink — red is for failures). */
const INCOMING = new Set(['DEPOSIT', 'TRANSFER_IN', 'RECEIVE', 'SELL', 'P2P_BUY', 'CASHBACK', 'ADMIN_CREDIT', 'REFERRAL_REWARD']);
const TRADES = new Set(['BUY', 'SELL', 'SWAP']);
const PENDING_STATES = new Set(['PENDING', 'WAITING_CONFIRMATION', 'PROCESSING', 'QUEUED', 'SUBMITTED', 'IN_PROGRESS', 'AWAITING_ESCROW', 'ESCROW_FUNDED', 'PAYMENT_SENT',
  'COMPLIANCE_PENDING', 'MANUAL_REVIEW', 'FUNDING_PENDING', 'FUNDED', 'ROUTING', 'ROUTED', 'SETTLEMENT_PENDING', 'SETTLED', 'PAYOUT_PENDING']);
const FAILED_STATES = new Set(['FAILED', 'REJECTED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'REFUNDED']);

function dayLabel(d: Date, t: (k: string) => string, locale: string): string {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400_000);
  if (diff === 0) return t('home.dayToday');
  if (diff === 1) return t('home.yesterday');
  return d.toLocaleDateString(locale === 'ar' ? 'ar-LY' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(diff > 300 ? { year: 'numeric' } : {}) });
}

function ActivityList({
  palette: p, dc, items, onSeeAll,
}: {
  palette: Palette;
  dc: ReturnType<typeof useDisplayCurrency>;
  items: TxItem[];
  onSeeAll: () => void;
}) {
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);

  if (items.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
        <Ionicons name="receipt-outline" size={28} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12, fontWeight: '600' }}>
          {t('home.noActivity')}
        </Text>
      </View>
    );
  }

  const shown = items.slice(0, 8);
  let lastDay = '';

  return (
    <View style={{ marginTop: 6 }}>
      {shown.map((tx, idx) => {
        const meta = tx.metadata ?? {};
        const amt  = Number(tx.amount);
        const abs  = Math.abs(amt);
        const type = tx.type;
        const when = new Date(tx.createdAt);
        const day = dayLabel(when, t, locale);
        const header = day !== lastDay ? day : null;
        lastDay = day;
        const nextDay = idx + 1 < shown.length ? dayLabel(new Date(shown[idx + 1].createdAt), t, locale) : null;
        const lastInGroup = nextDay !== day;

        const cpName = meta.counterpartyName ?? tx.counterpartyName ?? null;
        const txAsset = meta.asset ?? tx.currency;
        const assetName = getCurrencyMeta(txAsset)?.name ?? txAsset;

        let title: string;
        if      (type === 'BUY')          title = `Bought ${assetName}`;
        else if (type === 'SELL')         title = `Sold ${assetName}`;
        else if (type === 'DEPOSIT')      title = 'Top-up';
        else if (type === 'WITHDRAW' || type === 'WITHDRAWAL') title = 'Withdrawal';
        else if (type === 'TRANSFER_IN' || type === 'RECEIVE') title = cpName ? cpName : 'Received';
        else if (type === 'TRANSFER_OUT' || type === 'SEND')   title = cpName ? cpName : 'Sent';
        else if (type === 'SWAP')         title = `Converted to ${assetName}`;
        else if (type === 'P2P_BUY')      title = `P2P · bought ${assetName}`;
        else if (type === 'P2P_SELL')     title = `P2P · sold ${assetName}`;
        else if (type === 'CARD_SPEND')   title = tx.description ?? 'Card payment';
        else if (type === 'CASHBACK')     title = 'Cashback';
        else if (type === 'ADMIN_CREDIT') title = 'Credit from Tazdan';
        else title = tx.description ?? (type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' '));

        const time = when.toLocaleTimeString(locale === 'ar' ? 'ar-LY' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
        const st = String(tx.status ?? '').toUpperCase();
        const pending = PENDING_STATES.has(st);
        const failed = FAILED_STATES.has(st);
        let context: string | null = null;
        if (type === 'BUY' || type === 'SELL') {
          const settleCcy = meta.settlementCurrency as string | undefined;
          context = settleCcy ? `${type === 'BUY' ? 'Paid with' : 'Received in'} ${settleCcy}` : null;
        } else if (type === 'TRANSFER_IN' || type === 'RECEIVE') context = cpName ? 'Received' : null;
        else if (type === 'TRANSFER_OUT' || type === 'SEND') context = cpName ? 'Sent' : null;
        const note = meta.note ?? tx.note;

        const incoming = INCOMING.has(type) || (!TRADES.has(type) && amt > 0);
        const badgeIcon: keyof typeof Ionicons.glyphMap = TRADES.has(type) ? 'swap-horizontal' : incoming ? 'arrow-down' : 'arrow-up';

        const showDual  = (type === 'BUY' || type === 'SELL') && meta.cryptoAmount;
        // The fiat side in the transaction's own currency, never the display currency.
        const settleCcy = (meta.settlementCurrency ?? tx.currency) as any;
        const settleAbs = meta.settlementAmount != null ? Math.abs(Number(meta.settlementAmount)) : abs;
        const fiatStr   = formatMoney(settleAbs, settleCcy, { showSymbol: true });
        const cryptoStr = meta.cryptoAmount ? formatCryptoDisplay(meta.cryptoAmount, txAsset, 6) : null;
        const primary = showDual && cryptoStr
          ? `${type === 'BUY' ? '+' : '−'}${cryptoStr}`
          : `${incoming ? '+' : '−'}${fiatStr}`;
        const primaryColor = failed ? p.fgFaint : (showDual ? type === 'BUY' : incoming) ? p.greenFg : p.fg;

        return (
          <View key={tx.id}>
            {header ? (
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 24, marginTop: idx === 0 ? 4 : 18, marginBottom: 2 }}>
                {header.toUpperCase()}
              </Text>
            ) : null}
            <Pressable
              onPress={() => setSelectedTx(tx)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 24, paddingVertical: 11,
                backgroundColor: pressed ? p.bgElev : 'transparent',
              })}
            >
              <View style={{ width: 40, height: 40 }}>
                <CurrencyIcon currency={txAsset} palette={p} size={40} />
                <View style={{
                  position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9,
                  backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center',
                }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.bgElev, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={badgeIcon} size={9} color={incoming && !TRADES.has(type) ? p.greenFg : p.fgMuted} />
                  </View>
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
                <Text style={{ color: failed ? p.fgMuted : p.fg, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 }} numberOfLines={1}>
                  {title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {pending && !failed ? (
                    <Text style={{ color: p.amberFg, fontSize: 12, fontWeight: '600' }}>{t('home.pending')}</Text>
                  ) : null}
                  <Text style={{ color: p.fgMuted, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
                    {[failed ? String(tx.status).charAt(0) + String(tx.status).slice(1).toLowerCase() : null, time, context, note].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', flexShrink: 0, marginLeft: 10 }}>
                <Text style={{
                  color: primaryColor, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'],
                  textDecorationLine: failed ? 'line-through' : 'none',
                }}>
                  {primary}
                </Text>
                {showDual && cryptoStr ? (
                  <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {type === 'BUY' ? '−' : '+'}{fiatStr}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            {!lastInGroup ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border, marginLeft: 24 + 40 + 14, marginRight: 24 }} /> : null}
          </View>
        );
      })}

      <Pressable
        onPress={onSeeAll}
        accessibilityRole="link"
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
          marginTop: 14, paddingVertical: 10, opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: p.accentText, fontSize: 14, fontWeight: '600' }}>{t('home.seeAllTx')}</Text>
        <Ionicons name="chevron-forward" size={14} color={p.accentText} />
      </Pressable>

      <TxDetailModal tx={selectedTx} palette={p} dc={dc} onClose={() => setSelectedTx(null)} />
    </View>
  );
}

/* ── Wallet addresses list ──
 * The "Wallets" tab is meaningfully different from "Assets" - it shows
 * each crypto wallet's deposit address (with chain) and a copy button.
 * Fiat wallets show their reference + a "Top up" CTA instead.
 *
 * We deterministically derive a faux on-chain address from the wallet id
 * so each user sees stable addresses across sessions without any backend
 * change. (Replace with the real chain address once integrated.)
 */
function WalletAddressList({
  palette: p, wallets, onCopy,
}: {
  palette: Palette;
  wallets: Wallet[];
  onCopy: () => void;
}) {
  const t = useT();
  // Whichever wallet's QR is currently being shown in the modal.
  const [qrFor, setQrFor] = useState<{ wallet: Wallet; address: string; chain: string } | null>(null);

  if (wallets.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
        <Ionicons name="key-outline" size={28} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 12 }}>
          {t('home.noWallets')}
        </Text>
      </View>
    );
  }
  const FIAT_SET = new Set(['USD','EUR','GBP','AED','SAR','EGP','LYD','CAD','AUD','CHF','JPY','CNY']);

  // Collapse every BASE / BASE_CHAIN cluster into a single row.
  // USDT_ERC20 + USDT_TRC20 fold into "USDT"; if ETH ever picks up
  // an ETH_ERC20 variant the same code rolls it up automatically.
  // The combined balance aggregates funds; switching chain just
  // swaps which deposit address + QR we surface.
  const rows = mergeChainVariants(wallets);

  return (
    <View>
      {rows.map((row) => (
        <WalletRow
          key={row.key}
          wallet={row.wallet}
          variants={row.variants}
          combinedBalance={row.combinedBalance}
          palette={p}
          isCrypto={!FIAT_SET.has(row.wallet.currency)}
          onCopy={onCopy}
          onShowQr={(address, chain) => setQrFor({ wallet: row.wallet, address, chain })}
        />
      ))}
      <QrModal palette={p} info={qrFor} onClose={() => setQrFor(null)} />
    </View>
  );
}

interface VariantOption {
  currency: string;
  label: string; // short pill label, e.g. "ERC20", "TRC20"
}

interface MergedRow {
  key: string;
  wallet: Wallet; // representative wallet (highest balance variant)
  variants?: VariantOption[];
  combinedBalance: number;
}

/** Base symbol of a currency string. e.g. `USDT_TRC20` → `USDT`,
 *  `ETH_ERC20` → `ETH`, `BTC` → `BTC`.  Chained variants of the same
 *  base are treated as a single logical asset. */
function baseSymbol(currency: string): string {
  const i = currency.indexOf('_');
  return i >= 0 ? currency.slice(0, i) : currency;
}

/** Human-friendly chain label derived from a `BASE_CHAIN` currency.
 *  `USDT_TRC20` → `TRC20`. Used as the chain selector pill label. */
function chainLabel(currency: string): string {
  const i = currency.indexOf('_');
  return i >= 0 ? currency.slice(i + 1) : '';
}

/** Group wallets by base symbol so all chain variants of the same
 *  logical asset render as one row.  The row exposes a chain
 *  switcher when more than one variant exists; the balance is the
 *  sum across every variant in the cluster.
 *
 *  Generalises the previous USDT-only carveout — any future
 *  BASE/BASE_CHAIN pair (USDC + USDC_ERC20, ETH + ETH_ARBITRUM,
 *  …) collapses automatically. */
function mergeChainVariants(wallets: Wallet[]): MergedRow[] {
  // Stable key per base; preserves input order on first occurrence.
  const groups = new Map<string, { wallets: Wallet[]; balance: number; order: number }>();
  let order = 0;
  for (const w of wallets) {
    const base = baseSymbol(String(w.currency));
    const g = groups.get(base);
    if (g) {
      g.wallets.push(w);
      g.balance += Number(w.balance ?? 0);
    } else {
      groups.set(base, { wallets: [w], balance: Number(w.balance ?? 0), order: order++ });
    }
  }
  const out: MergedRow[] = [];
  for (const [base, g] of groups) {
    // Representative wallet = the variant with the largest balance,
    // so meta lookups (icon, title, decimals) prefer the chain the
    // user has the most of.
    const pick = [...g.wallets].sort(
      (a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0),
    )[0];
    // Variants list — one entry per distinct on-chain wallet the
    // user holds.  Falls back to a single virtual entry if the
    // user only has the base symbol.
    const variants: VariantOption[] = g.wallets
      .filter((w) => String(w.currency) !== base)
      .map((w) => ({
        currency: String(w.currency),
        label: chainLabel(String(w.currency)),
      }));
    out.push({
      key: variants.length > 1 ? `${base}_MERGED` : pick.id,
      wallet: { ...pick, currency: base } as Wallet,
      variants: variants.length > 1 ? variants : undefined,
      combinedBalance: g.balance,
    });
  }
  // Re-sort by original wallet order (stable group order, plus
  // largest-balance variant inside each group).
  return out.sort((a, b) => {
    const ga = groups.get(baseSymbol(String(a.wallet.currency)))!.order;
    const gb = groups.get(baseSymbol(String(b.wallet.currency)))!.order;
    return ga - gb;
  });
}

function WalletRow({ wallet: w, variants, combinedBalance, palette: p, isCrypto, onCopy, onShowQr }: {
  wallet: Wallet;
  variants?: VariantOption[];
  combinedBalance?: number;
  palette: Palette;
  isCrypto: boolean;
  onCopy: () => void;
  onShowQr: (address: string, chain: string) => void;
}) {
  const t = useT();
  const meta  = ASSET_META[w.currency] ?? { title: w.currency, subDecimals: 6 };

  // When this row is a merged USDT view, the parent passes a `variants`
  // list. Track which chain the user currently wants to receive on; we
  // refetch the deposit address against that variant.
  const [activeVariant, setActiveVariant] = useState<VariantOption | null>(
    variants?.[0] ?? null,
  );
  const addressCurrency = activeVariant?.currency ?? w.currency;
  const chain = CHAIN_LABEL[addressCurrency] ?? CHAIN_LABEL[w.currency] ?? w.currency;
  const displayBalance = combinedBalance ?? Number(w.balance ?? 0);

  // Fetch real custodial address from the server for crypto wallets.
  const { data: serverAddr, isLoading: addrLoading } = useDepositAddress(addressCurrency, isCrypto);
  const fiatRef = `PRMK-${w.currency}-${w.id.slice(0, 8).toUpperCase()}`;
  const addr = isCrypto ? (serverAddr ?? '') : fiatRef;
  const addrReady = isCrypto ? !!serverAddr : true;

  return (
    <View style={{
      paddingHorizontal: 24, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: p.border,
      gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CurrencyIcon currency={w.currency} palette={p} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{meta.title}</Text>
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
            {isCrypto ? `${chain} ${t('home.network')}` : t('home.bankReference')}
          </Text>
        </View>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {displayBalance.toLocaleString('en-US', { maximumFractionDigits: Math.min(meta.subDecimals, 8) })} {w.currency}
        </Text>
      </View>

      {variants && variants.length > 1 && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {variants.map((v) => {
            const active = activeVariant?.currency === v.currency;
            return (
              <Pressable
                key={v.currency}
                onPress={() => setActiveVariant(v)}
                style={({ pressed }) => ({
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
                  backgroundColor: active ? p.accent : p.bgElev,
                  borderWidth: 1, borderColor: active ? p.accent : p.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{
                  color: active ? p.accentFg : p.fgMuted,
                  fontSize: 10, fontWeight: '700', letterSpacing: 0.6,
                }}>
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={async () => {
            if (!addrReady) return;
            onCopy();
            await Clipboard.setStringAsync(addr);
          }}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14,
            backgroundColor: pressed ? p.border : p.bgElev,
            borderWidth: 1, borderColor: p.border,
          })}
        >
          <Ionicons name={isCrypto ? 'wallet-outline' : 'card-outline'} size={14} color={p.fgMuted} />
          {addrLoading ? (
            <ActivityIndicator size="small" color={p.fgMuted} style={{ flex: 1 }} />
          ) : (
            <Text numberOfLines={1} style={{ flex: 1, color: p.fg, fontSize: 12, fontWeight: '600', fontFamily: 'Menlo' as any }}>
              {addr}
            </Text>
          )}
          <Ionicons name="copy-outline" size={14} color={p.fgMuted} />
        </Pressable>

        <Pressable
          onPress={() => {
            if (!addrReady) return;
            onCopy();
            onShowQr(addr, isCrypto ? chain : t('home.bankReference'));
          }}
          style={({ pressed }) => ({
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: pressed ? p.border : p.bgElev,
            borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
          })}
          accessibilityLabel={`Show QR code for ${meta.title} address`}
        >
          <Ionicons name="qr-code-outline" size={18} color={p.fg} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Full-screen QR sheet for receiving on a wallet. Renders the QR via the
 * public qrserver.com endpoint so we don't need a new RN dependency. The
 * background colour matches the palette; the inner card is always white
 * so the QR is high-contrast and reliably scannable.
 */
function QrModal({
  info, palette: p, onClose,
}: {
  info: { wallet: Wallet; address: string; chain: string } | null;
  palette: Palette;
  onClose: () => void;
}) {
  const t = useT();
  if (!info) return null;
  const { wallet, address, chain } = info;
  const meta = ASSET_META[wallet.currency] ?? ASSET_META.DEFAULT;
  // QR rendered locally via react-native-qrcode-svg below — no
  // network round-trip, works offline.

  return (
    <Modal visible={!!info} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 380,
            backgroundColor: p.bg,
            borderRadius: 28, padding: 22,
            borderWidth: 1, borderColor: p.border,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CurrencyIcon currency={wallet.currency} palette={p} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}>
                {t('home.receiveAsset')} {meta.title}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                {chain}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <Ionicons name="close" size={18} color={p.fgMuted} />
            </Pressable>
          </View>

          {/* QR */}
          <View style={{
            marginTop: 18,
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 14,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <QRCode
              value={address}
              size={220}
              backgroundColor="#ffffff"
              color="#000000"
              ecl="H"
              logo={require('../../assets/icon-asterisk.png')}
              logoSize={42}
              logoBackgroundColor="#ffffff"
              logoMargin={4}
              logoBorderRadius={10}
            />
          </View>

          {/* Address */}
          <View style={{
            marginTop: 16,
            paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
          }}>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 }}>
              {t('home.address').toUpperCase()}
            </Text>
            <Text
              selectable
              style={{
                color: p.fg, fontSize: 12, fontWeight: '600',
                fontFamily: 'Menlo' as any,
                marginTop: 4,
              }}
            >
              {address}
            </Text>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={async () => { await Clipboard.setStringAsync(address); }}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 24,
                backgroundColor: pressed ? p.border : p.pillBg,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 6,
              })}
            >
              <Ionicons name="copy-outline" size={14} color={p.fg} />
              <Text style={{ color: p.fg, fontWeight: '600', fontSize: 14 }}>{t('common.copy')}</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 24,
                backgroundColor: pressed ? '#000' : p.ctaBg,
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Text style={{ color: p.ctaFg, fontWeight: '600', fontSize: 14 }}>{t('common.done')}</Text>
            </Pressable>
          </View>

          <Text style={{
            color: p.fgFaint, fontSize: 11, fontWeight: '600',
            textAlign: 'center', marginTop: 14,
          }}>
            {t('home.sendOnlyWarning', { currency: wallet.currency, chain })}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CHAIN_LABEL: Record<string, string> = {
  BTC:        'Bitcoin',
  ETH:        'Ethereum (ERC-20)',
  USDT:       'Ethereum (ERC-20)',
  USDT_ERC20: 'Ethereum (ERC-20)',
  USDT_TRC20: 'Tron (TRC-20)',
  USDC:       'Ethereum (ERC-20)',
  SOL:        'Solana',
  BNB:        'BNB Smart Chain',
  XRP:        'XRP Ledger',
  ADA:        'Cardano',
  DOGE:       'Dogecoin',
  MATIC:      'Polygon',
  DOT:        'Polkadot',
  AVAX:       'Avalanche C-Chain',
  LTC:        'Litecoin',
  LINK:       'Ethereum (ERC-20)',
  UNI:        'Ethereum (ERC-20)',
  AAVE:       'Ethereum (ERC-20)',
  ATOM:       'Cosmos Hub',
  TRX:        'Tron',
  XLM:        'Stellar',
  ARB:        'Arbitrum One',
  OP:         'Optimism',
  TON:        'TON',
  SUI:        'Sui',
  APT:        'Aptos',
  INJ:        'Injective',
};

// Map each currency to the asset + network the deposit-address endpoint expects.
const DEPOSIT_ROUTE: Record<string, { asset: string; network: string }> = {
  BTC:        { asset: 'BTC',  network: 'BTC'   },
  SOL:        { asset: 'SOL',  network: 'SOL'   },
  ETH:        { asset: 'ETH',  network: 'ERC20' },
  USDT:       { asset: 'USDT', network: 'ERC20' },
  USDT_ERC20: { asset: 'USDT', network: 'ERC20' },
  USDT_TRC20: { asset: 'USDT', network: 'TRC20' },
  TRX:        { asset: 'TRX',  network: 'TRON'  },
  XRP:        { asset: 'XRP',  network: 'XRP'   },
};
// Everything not listed above is an EVM token (ERC-20 / BEP-20)
function depositRoute(currency: string): { asset: string; network: string } {
  return DEPOSIT_ROUTE[currency.toUpperCase()] ?? { asset: currency.toUpperCase(), network: 'ERC20' };
}

function useDepositAddress(currency: string, enabled: boolean) {
  const { asset, network } = depositRoute(currency);
  return useQuery({
    queryKey: ['deposit-address', asset, network],
    enabled,
    queryFn: async () => {
      const res = await cryptoWalletAPI.depositAddress(asset, network);
      return res.data.address;
    },
    staleTime: Infinity, // addresses don't change
    retry: 1,
  });
}

/* ── Asset row ─── */
function AssetRow({ wallet, palette: p, onPress, liveUsd, unitPrice, rateLabel, sparkline, changePct, showBalance = true, showSparkline = true, last = false }: {
  wallet: Wallet;
  palette: Palette;
  onPress?: () => void;
  liveUsd?: number;
  unitPrice?: number;
  /** Fiat rows: the exchange rate against the display currency (e.g. "$1 = 9.37 LD"). */
  rateLabel?: string;
  sparkline?: number[];
  changePct?: number;
  showBalance?: boolean;
  showSparkline?: boolean;
  /** Last row of its section: no separator underneath. */
  last?: boolean;
}) {
  const dc = useDisplayCurrency();
  const meta = ASSET_META[wallet.currency] ?? { title: wallet.currency, subDecimals: 6 };
  const usd = liveUsd ?? Number(wallet.fiatValueUsd);
  const positive = (changePct ?? 0) >= 0;
  const maxDec = Math.min(meta.subDecimals, 8);
  const amount = Number(wallet.balance).toLocaleString('en-US', { maximumFractionDigits: maxDec });
  // Privacy mode hides what you HOLD (amount, value) — never the market
  // (unit price, 24h change), which is public information.
  const price = rateLabel ?? (unitPrice !== undefined
    ? '$' + unitPrice.toLocaleString('en-US', { maximumFractionDigits: unitPrice >= 1 ? 2 : 6 })
    : null);
  const ticker = wallet.currency.replace(/_.*/, '');
  const holding = `${showBalance ? amount : '••••'} ${ticker}`;
  const isCrypto = getCurrencyMeta(wallet.currency)?.kind === 'crypto';
  const hasSpark = showSparkline && sparkline && sparkline.length >= 2;

  return (
    <View testID={`asset-row-${wallet.currency}`}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 24, paddingVertical: 12,
          backgroundColor: pressed ? p.bgElev : 'transparent',
        })}
      >
        <CurrencyIcon currency={wallet.currency} palette={p} size={40} />
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 }} numberOfLines={1}>
            {isCrypto ? ticker : meta.title}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
            {price ?? '—'}
          </Text>
        </View>
        {showSparkline && <View testID="asset-chart-column" style={{ width: 54, flexShrink: 0, height: 28, marginHorizontal: 8, justifyContent: 'center', opacity: .85 }}>
          {hasSpark && <Sparkline data={sparkline!} width={54} height={22} color={positive ? p.greenFg : p.redFg} strokeWidth={1.4} />}
        </View>}
        <View testID="asset-value-column" style={{ alignItems: 'flex-end', width: '32%', flexShrink: 0, gap: 2 }}>
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -.1, textAlign: 'right', width: '100%' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.7}>
            {showBalance ? dc.fmt(usd) : '••••••'}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 11.5, fontVariant: ['tabular-nums'], textAlign: 'right', width: '100%' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.7}>
            {holding}
          </Text>
          {changePct !== undefined ? (
            <Text style={{ color: positive ? p.greenFg : p.redFg, fontSize: 12, fontWeight: '500', marginTop: 2, fontVariant: ['tabular-nums'] }}>
              {positive ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
            </Text>
          ) : null}
        </View>
      </Pressable>
      {!last ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border, marginLeft: 24 + 40 + 14, marginRight: 24 }} /> : null}
    </View>
  );
}


/* ── Currency icons ── */
function CurrencyIcon({ currency, size = 44 }: { currency: string; palette: Palette; size?: number }) {
  return <CoinIcon symbol={currency} size={size} />;
}

interface AssetMeta { title: string; subDecimals: number }
const ASSET_META: Record<string, AssetMeta> = {
  // ── Crypto ──
  BTC:        { title: 'Bitcoin',       subDecimals: 8 },
  ETH:        { title: 'Ethereum',      subDecimals: 6 },
  USDT:       { title: 'Tether',        subDecimals: 2 },
  USDT_ERC20: { title: 'Tether ERC20',  subDecimals: 2 },
  USDT_TRC20: { title: 'Tether TRC20',  subDecimals: 2 },
  USDC:       { title: 'USD Coin',      subDecimals: 2 },
  SOL:        { title: 'Solana',        subDecimals: 4 },
  BNB:        { title: 'BNB',           subDecimals: 4 },
  XRP:        { title: 'XRP',           subDecimals: 4 },
  ADA:        { title: 'Cardano',       subDecimals: 4 },
  DOGE:       { title: 'Dogecoin',      subDecimals: 4 },
  MATIC:      { title: 'Polygon',       subDecimals: 4 },
  DOT:        { title: 'Polkadot',      subDecimals: 4 },
  AVAX:       { title: 'Avalanche',     subDecimals: 4 },
  LTC:        { title: 'Litecoin',      subDecimals: 6 },
  LINK:       { title: 'Chainlink',     subDecimals: 4 },
  UNI:        { title: 'Uniswap',       subDecimals: 4 },
  AAVE:       { title: 'Aave',          subDecimals: 4 },
  ATOM:       { title: 'Cosmos',        subDecimals: 4 },
  ALGO:       { title: 'Algorand',      subDecimals: 4 },
  NEAR:       { title: 'NEAR',          subDecimals: 4 },
  FTM:        { title: 'Fantom',        subDecimals: 4 },
  VET:        { title: 'VeChain',       subDecimals: 2 },
  TRX:        { title: 'TRON',          subDecimals: 2 },
  XLM:        { title: 'Stellar',       subDecimals: 4 },
  FIL:        { title: 'Filecoin',      subDecimals: 4 },
  SHIB:       { title: 'Shiba Inu',     subDecimals: 0 },
  PEPE:       { title: 'Pepe',          subDecimals: 0 },
  WIF:        { title: 'dogwifhat',     subDecimals: 4 },
  ARB:        { title: 'Arbitrum',      subDecimals: 4 },
  OP:         { title: 'Optimism',      subDecimals: 4 },
  SUI:        { title: 'Sui',           subDecimals: 4 },
  APT:        { title: 'Aptos',         subDecimals: 4 },
  INJ:        { title: 'Injective',     subDecimals: 4 },
  SEI:        { title: 'Sei',           subDecimals: 4 },
  TON:        { title: 'Toncoin',       subDecimals: 4 },
  // ── Fiat ──
  USD:        { title: 'US Dollar',       subDecimals: 2 },
  EUR:        { title: 'Euro',            subDecimals: 2 },
  GBP:        { title: 'British Pound',   subDecimals: 2 },
  AED:        { title: 'UAE Dirham',      subDecimals: 2 },
  SAR:        { title: 'Saudi Riyal',     subDecimals: 2 },
  EGP:        { title: 'Egyptian Pound',  subDecimals: 2 },
  LYD:        { title: 'Libyan Dinar',    subDecimals: 3 },
  DEFAULT:    { title: 'Asset',           subDecimals: 4 },
};
