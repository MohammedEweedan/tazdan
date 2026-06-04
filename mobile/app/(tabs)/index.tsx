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
import { TopGradient } from '@/components/ui/ScreenShell';
import { ActivityIndicator, Animated, Dimensions, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Text, TextInput } from '@/components/ui/Text';
import BalanceSvg, { Path as SvgPath, Defs as SvgDefs, LinearGradient as SvgLinearGradient, RadialGradient as SvgRadialGradient, Rect as SvgRect, Stop as SvgStop, Line as SvgLine, Circle as SvgCircle } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAuthStore } from '@/store/authStore';
import { realHandle, avatarMode } from '@/utils/displayUser';
import { useWallets, useHaptics, useTransactions, useActivities, useActivityRealtime, useNotificationRealtime, useUnreadCount, useMarkets, useDisplayCurrency, useBudgets } from '@/hooks';
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
import { DepositWidget } from '@/components/exchange/DepositWidget';
import { RecurringBuyWidget } from '@/components/exchange/RecurringBuyWidget';
import { PressableScale } from '@/components/ui/Motion';
import { AnnouncementBanner } from '@/components/ui/AnnouncementBanner';
import type { Wallet } from '@/types';

type Tab = 'ASSETS' | 'ACTIVITY';

export default function Home() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: wallets, refetch: refetchWallets } = useWallets();
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
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [recurringModalVisible, setRecurringModalVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [balanceChartVisible, setBalanceChartVisible] = useState(false);

  const list = wallets ?? [];

  // Live USD price map keyed by ticker (e.g. { BTC: 67_432.10, ETH: 3_240.50 }).
  // Computed from Binance WebSocket + backend ticker overlay. We re-derive `totalUsd` from
  // these so the home balance fluctuates in real time exactly like the
  // asset detail screen.
  const { data: tickers, refetch: refetchMarkets } = useMarkets();

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
  const blurOpacity = scrollY.interpolate({
    inputRange: [0, 30, 110],
    outputRange: [0.92, 0.96, 1],
    extrapolate: 'clamp',
  });
  const gradientOpacity = scrollY.interpolate({
    inputRange: [0, 110],
    outputRange: [1, 1],
    extrapolate: 'clamp',
  });

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

  // Per-asset 7d sparkline (from backend ticker) so each asset row
  // can render a mini chart between the name and the price.
  const sparklineMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    if (Array.isArray(tickers)) {
      tickers.forEach((m) => {
        const points = m.sparkline;
        if (!Array.isArray(points) || points.length < 2) return;
        const stride = Math.max(1, Math.floor(points.length / 32));
        map[m.base] = points.filter((_, i) => i % stride === 0);
      });
    }
    return map;
  }, [tickers]);

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

  const cryptoAssets = useMemo(
    () => ownedAssets.filter((w) => !FIAT_CURRENCIES.has(w.currency)),
    [ownedAssets],
  );
  const fiatAssets = useMemo(
    () => ownedAssets.filter((w) => FIAT_CURRENCIES.has(w.currency)),
    [ownedAssets],
  );

  // Normalize a wallet currency to its Binance ticker base.
  // USDT_ERC20 / USDT_TRC20 both track as USDT (pegged $1).
  function tickerKey(currency: string): string {
    if (currency === 'USDT_ERC20' || currency === 'USDT_TRC20') return 'USDT';
    return currency;
  }

  const totalUsd = useMemo(() => {
    return list.reduce((sum, w) => {
      const key = tickerKey(w.currency);
      const live = priceMap[key] ?? (key === 'USDT' ? 1 : undefined);
      if (live !== undefined) return sum + Number(w.balance) * live;
      return sum + Number(w.fiatValueUsd);
    }, 0);
  }, [list, priceMap]);

  // Aggregate 24h change weighted by USD exposure.
  const deltaPct = useMemo(() => {
    if (totalUsd <= 0 || !tickers || tickers.length === 0) return 0;
    let weightedChange = 0;
    let totalCryptoExposure = 0;
    list.forEach((w) => {
      const m = tickers.find((t) => t.base === tickerKey(w.currency));
      if (!m || m.changePct24h === undefined || m.changePct24h === 0) return;
      const exposure = Number(w.balance) * m.price;
      weightedChange += exposure * m.changePct24h;
      totalCryptoExposure += exposure;
    });
    if (totalCryptoExposure <= 0) return 0;
    return weightedChange / totalCryptoExposure;
  }, [list, tickers, totalUsd]);
  const deltaUsd = (totalUsd * deltaPct) / 100;
  const positive = deltaPct >= 0;
  const [showBalance, setShowBalance] = useState(true);
  const [cryptoOpen, setCryptoOpen] = useState(true);
  const [fiatOpen, setFiatOpen] = useState(true);

  // Display helpers — NEVER use the email local-part as a handle (PII leak).
  // Every account has a @handle, so we render it directly; the empty string
  // only shows for the brief moment before the user object hydrates.
  const handleSlug = realHandle(user);
  const handleLabel = handleSlug ? `@${handleSlug}` : '';
  const av = avatarMode(user);
  const initial = av.kind === 'initials' ? av.char : (user?.firstName?.[0] ?? '?').toUpperCase();

  // Primary actions sit directly under the balance. Three pills —
  // Buy, Sell, Top up (deposit). Withdraw + everything else lives
  // in the More (···) modal.
  const ACTIONS: ActionDef[] = [
    { key: 'buy',     icon: 'arrow-up-outline',          label: t('action.buy'),    tone: 'white', onPress: () => setBuyModalVisible(true) },
    { key: 'sell',    icon: 'arrow-down-outline',        label: t('action.sell'),   tone: 'grey',  onPress: () => setSellModalVisible(true) },
    { key: 'topup',   icon: 'arrow-down-circle-outline', label: t('action.topup'),  tone: 'black', onPress: () => setDepositModalVisible(true) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <TopGradient />
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: 'transparent' }}
          contentContainerStyle={{ paddingBottom: 140 }}
          stickyHeaderIndices={[0]}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
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
          {/* Index 0 — sticky TOP block.  Contains header + balance
              + 24h delta + primary actions + Assets/Activity tabs so
              the entire top of the screen pins as a single unit
              while feed rows scroll underneath it.  Glass-morphism
              (BlurView + soft gradient) fades in only after the
              user starts scrolling; at rest the block reads naked
              on the page bg.  No hairline — the glass does the
              separation. The block carries its own `paddingTop:
              insets.top` so the avatar / icon row never tucks under
              the Dynamic Island while the block is pinned. */}
          <View>
          {/* Gradient layer — covers the full block including safe-area.
              The BlurView + gradient now extend all the way to the top
              of the screen so the battery / Dynamic Island / clock sit
              on the glass, not on raw bg. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              opacity: gradientOpacity,
              overflow: 'hidden',
            }}
          >
            <BreathingGradient mode={themeMode} />
          </Animated.View>

          {/* Blur layer — only fades in once scrolling so the at-rest
              state stays "open" (gradient-only) and the scrolled
              state reads as proper frosted glass. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              opacity: blurOpacity,
            }}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 48 : 0}
              tint={themeMode === 'light' ? 'light' : 'dark'}
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: Platform.OS === 'ios'
                  ? 'transparent'
                  : (themeMode === 'dark'
                      ? 'rgba(22,24,28,0.80)'
                      : 'rgba(250,250,247,0.82)'),
              }}
            />
          </Animated.View>

          {/* Show/hide balance — pinned to the upper-right corner of the
              card, level with the balance (clear of the header icon
              cluster). Sits above the gradient/blur so it stays tappable. */}
          <Pressable
            onPress={() => { h.selection(); setShowBalance((v) => !v); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={showBalance ? 'Hide balance' : 'Show balance'}
            style={{
              position: 'absolute',
              top: insets.top + 64, right: 20,
              zIndex: 5,
              width: 30, height: 30, borderRadius: 15,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons
              name={showBalance ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={p.fgFaint}
            />
          </Pressable>

          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: insets.top + 8, paddingBottom: 6,
            gap: 10,
          }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {/* Tapping the avatar + @handle opens the receive / QR-code
                  sheet (the QR trigger). Long-press still jumps to the
                  full profile. */}
              <Pressable
                onPress={() => { h.selection(); setReceiveModalVisible(true); }}
                onLongPress={() => { h.selection(); router.push('/profile'); }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('action.receive')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: p.bgElev,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: p.border,
                  flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {av.kind === 'image' ? (
                    <Image source={{ uri: av.uri }} style={{ width: 36, height: 36 }} />
                  ) : av.kind === 'emoji' ? (
                    <Text style={{ fontSize: 20 }}>{av.char}</Text>
                  ) : (
                    <Text style={{ color: p.fg, fontWeight: '700', fontSize: 16 }}>{initial}</Text>
                  )}
                </View>
                <View style={{ flexShrink: 1, minWidth: 0 }}>
                  {/* Every account has a @handle, so the header always greets
                      "Hi, @handle" — no "Set @handle" state exists. */}
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', letterSpacing: 0.2 }} numberOfLines={1}>
                    {t('home.greeting')}
                  </Text>
                  <Text
                    style={{
                      color: p.fg,
                      fontSize: (handleLabel.length <= 8 ? 17 : handleLabel.length <= 14 ? 15 : handleLabel.length <= 20 ? 13 : 11),
                      fontWeight: '600',
                      letterSpacing: -0.3,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {handleLabel}
                  </Text>
                </View>
              </Pressable>
              {(user?.role === 'ADMIN') && (
                <Pressable
                  onPress={() => { h.selection(); router.push('/admin' as any); }}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 4,
                    borderRadius: 7,
                    backgroundColor: p.accentSoft,
                    borderWidth: 1, borderColor: p.accentBorder,
                    opacity: pressed ? 0.7 : 1,
                    flexShrink: 0,
                  })}
                >
                  <Ionicons name="shield-checkmark" size={11} color={p.accentText} />
                  <Text style={{ color: p.accentText, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 }}>
                    ADMIN
                  </Text>
                </Pressable>
              )}
            </View>
            {/* Icon cluster — one segmented track holding all three
                actions so they read as a single intentional control
                rather than three heavy floating circles. */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', flexShrink: 0,
              backgroundColor: p.pillBg,
              borderRadius: 17,
              paddingHorizontal: 3,
            }}>
              <HeaderIconButton
                icon="repeat-outline"
                onPress={() => { h.selection(); setRecurringModalVisible(true); }}
                palette={p}
                a11y={t('recurring.title')}
              />
              <HeaderIconButton
                icon="notifications-outline"
                onPress={() => { h.selection(); router.push('/notifications'); }}
                palette={p}
                a11y="Notifications"
                badge={unreadData ?? 0}
              />
              <HeaderIconButton
                icon="scan-outline"
                onPress={() => { h.selection(); router.push('/scanner'); }}
                palette={p}
                a11y="Scan QR"
              />
            </View>
          </View>

          <AnimatedTotal
            value={totalUsd}
            palette={p}
            dc={dc}
            showBalance={showBalance}
            onPress={() => { h.selection(); setBalanceChartVisible(true); }}
          />

          {/* 24h delta — compact, directly under balance */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            justifyContent: 'center',
            paddingHorizontal: 24, marginTop: 1,
          }}>
            <Text style={{
              color: p.fgMuted,
              fontSize: 10, fontWeight: '500', fontVariant: ['tabular-nums'],
            }}>
              {showBalance
                ? `${positive ? '+' : '-'}${dc.fmt(Math.abs(deltaUsd))}`
                : `${dc.symbol}****`}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 2,
              paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5,
              backgroundColor: showBalance
                ? (positive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)')
                : p.pillBg,
              borderWidth: 1,
              borderColor: showBalance
                ? (positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)')
                : p.border,
            }}>
              {showBalance && (
                <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={7} color={positive ? p.greenFg : p.redFg} />
              )}
              <Text style={{
                color: showBalance ? (positive ? p.greenFg : p.redFg) : p.fgFaint,
                fontSize: 9, fontWeight: '600',
              }}>
                {showBalance ? `${Math.abs(deltaPct).toFixed(2)}%` : '**.**%'}
              </Text>
            </View>
          </View>

          {/* ── PRIMARY ACTIONS ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, marginTop: 18 }}>
            {ACTIONS.map((a) => (
              <ActionButton key={a.key} label={a.label} icon={a.icon} to={a.to} tone={a.tone} onPress={a.onPress} palette={p} />
            ))}
            <MoreActionButton palette={p} onPress={() => { h.selection(); setMoreMenuVisible(true); }} />
          </View>

          {/* Spacer between the action pills and the Assets/Activity
              switcher so the pinned hero block has breathing room. */}
          <View style={{ height: 16 }} />
          </View>
          {/* /sticky top block */}

          {/* Announcement Banner — out of the sticky region; lives
              between the pinned hero and the scrolling feed. */}
          <AnnouncementBanner />

          {/* Assets / Activity — segmented control. No longer pinned; it
              sits above the asset/activity rows and scrolls with them. */}
          <View style={{ paddingHorizontal: 24, alignItems: 'center', marginTop: 18, marginBottom: 4 }}>
            <View style={{
              flexDirection: 'row',
              backgroundColor: p.pillBg,
              borderRadius: 12,
              padding: 3,
              alignSelf: 'center',
            }}>
              <TabBtn label={t('home.assets')}   active={tab === 'ASSETS'}   palette={p} onPress={() => { h.selection(); setTab('ASSETS'); }} />
              <TabBtn label={t('home.activity')} active={tab === 'ACTIVITY'} palette={p} onPress={() => { h.selection(); setTab('ACTIVITY'); }} />
            </View>
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
                  <Pressable
                    onPress={() => setCryptoOpen((v) => !v)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 10 }}
                  >
                    <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                      {t('home.cryptoAssets').toUpperCase()}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {showBalance ? dc.fmt(cryptoAssets.reduce((s, w) => {
                          const tk = tickerKey(w.currency);
                          const price = priceMap[tk] ?? (tk === 'USDT' ? 1 : 0);
                          return s + Number(w.balance) * price;
                        }, 0)) : '****'}
                      </Text>
                      <Ionicons name={cryptoOpen ? 'chevron-up' : 'chevron-down'} size={14} color={p.fgFaint} />
                    </View>
                  </Pressable>
                  {cryptoOpen && cryptoAssets.map((w) => {
                    const tk = tickerKey(w.currency);
                    const price = priceMap[tk] ?? (tk === 'USDT' ? 1 : undefined);
                    return (
                      <AssetRow
                        key={w.id}
                        wallet={w}
                        palette={p}
                        sparkline={sparklineMap[tk]}
                        changePct={changeMap[tk]}
                        liveUsd={price !== undefined ? Number(w.balance) * price : undefined}
                        showBalance={showBalance}
                        onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
                      />
                    );
                  })}
                </View>
              )}

              {/* Fiat Assets Section */}
              {fiatAssets.length > 0 && (
                <View style={{ marginTop: 24 }}>
                  <Pressable
                    onPress={() => setFiatOpen((v) => !v)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 10 }}
                  >
                    <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                      {t('home.fiatAssets').toUpperCase()}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {showBalance ? dc.fmt(fiatAssets.reduce((s, w) => s + Number(w.fiatValueUsd), 0)) : '****'}
                      </Text>
                      <Ionicons name={fiatOpen ? 'chevron-up' : 'chevron-down'} size={14} color={p.fgFaint} />
                    </View>
                  </Pressable>
                  {fiatOpen && fiatAssets.map((w) => (
                    <AssetRow
                      key={w.id}
                      wallet={w}
                      palette={p}
                      sparkline={undefined}
                      changePct={undefined}
                      liveUsd={undefined}
                      showBalance={showBalance}
                      onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
                    />
                  ))}
                </View>
              )}

              {/* Savings / Budgets Section — named goals (trips, gifts, rainy
                  day). Tap a goal to open it, or "New goal" to start one. */}
              <View style={{ marginTop: 24 }}>
                <Pressable
                  onPress={() => { h.selection(); router.push('/budgets'); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 10 }}
                >
                  <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
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
                        {showBalance ? `${bsym}${bsaved.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '****'}
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
                  onPress={() => { h.medium(); setBuyModalVisible(true); }}
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
                  onPress={() => { h.medium(); setDepositModalVisible(true); }}
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


      {/* Buy Widget Modal */}
      <Modal visible={buyModalVisible} transparent animationType="slide" onRequestClose={() => setBuyModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setBuyModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
                <BuyWidget />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sell Widget Modal */}
      <Modal visible={sellModalVisible} transparent animationType="slide" onRequestClose={() => setSellModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setSellModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
                <SellWidget />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Send Widget Modal */}
      <Modal visible={sendModalVisible} transparent animationType="slide" onRequestClose={() => setSendModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setSendModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }}>{t('home.sendMoney')}</Text>
                <Pressable onPress={() => setSendModalVisible(false)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={16} color={p.fg} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
                <SendWidget />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdraw Widget Modal */}
      <Modal visible={withdrawModalVisible} transparent animationType="slide" onRequestClose={() => setWithdrawModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setWithdrawModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }}>{t('action.withdraw')}</Text>
                <Pressable onPress={() => setWithdrawModalVisible(false)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={16} color={p.fg} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
                <WithdrawWidget />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Receive Widget Modal */}
      <Modal visible={receiveModalVisible} transparent animationType="slide" onRequestClose={() => setReceiveModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setReceiveModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }}>{t('action.receive')}</Text>
                <Pressable onPress={() => setReceiveModalVisible(false)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={16} color={p.fg} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
                <ReceiveWidget />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Recurring Buy Widget Modal */}
      <Modal visible={recurringModalVisible} transparent animationType="slide" onRequestClose={() => setRecurringModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setRecurringModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }}>{t('recurring.title')}</Text>
                <Pressable onPress={() => setRecurringModalVisible(false)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={16} color={p.fg} />
                </Pressable>
              </View>
              <RecurringBuyWidget onDone={() => setRecurringModalVisible(false)} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Deposit Widget Modal */}
      <Modal visible={depositModalVisible} transparent animationType="slide" onRequestClose={() => setDepositModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setDepositModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
                <DepositWidget />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* More Menu Modal */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          onPress={() => setMoreMenuVisible(false)}
        >
          <Pressable
            style={{ backgroundColor: p.bg, borderRadius: 24, paddingTop: 20, paddingBottom: 8, width: '100%', maxWidth: 360 }}
            onPress={(e) => e.stopPropagation()}
          >

            {/* Primary actions — matches web three-dot */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: p.border }}>
              {[
                { icon: 'arrow-up-circle-outline' as const, label: t('action.withdraw'), onPress: () => { setMoreMenuVisible(false); setWithdrawModalVisible(true); } },
                { icon: 'swap-horizontal-outline' as const, label: t('action.swap'),     onPress: () => { setMoreMenuVisible(false); router.push('/transfer'); } },
                { icon: 'paper-plane-outline' as const,   label: t('action.send'),     onPress: () => { setMoreMenuVisible(false); setSendModalVisible(true); } },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  style={({ pressed }) => ({
                    flex: 1, alignItems: 'center', gap: 8,
                    paddingVertical: 14, borderRadius: 16,
                    backgroundColor: pressed ? p.bgElev : p.pillBg,
                    borderWidth: 1, borderColor: p.border,
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.bgElev, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon} size={20} color={p.fg} />
                  </View>
                  <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Secondary options */}
            <View style={{ paddingVertical: 8 }}>
              {[
                { icon: 'flag-outline' as const,         label: t('home.budgets'),         onPress: () => { setMoreMenuVisible(false); router.push('/budgets'); } },
                { icon: 'card-outline' as const,         label: t('home.cards'),           onPress: () => { setMoreMenuVisible(false); router.push('/cards'); } },
                { icon: 'time-outline' as const,         label: t('home.history'),         onPress: () => { setMoreMenuVisible(false); router.push('/history'); } },
                { icon: 'document-text-outline' as const, label: 'Statements',              onPress: () => { setMoreMenuVisible(false); router.push('/statements'); } },
                { icon: 'pie-chart-outline' as const,    label: t('home.cryptoPortfolio'), onPress: () => { setMoreMenuVisible(false); router.push('/portfolio/crypto'); } },
                { icon: 'wallet-outline' as const,       label: t('home.fiatPortfolio'),   onPress: () => { setMoreMenuVisible(false); router.push('/portfolio/fiat'); } },
                { icon: 'people-outline' as const,       label: t('home.referral'),        onPress: () => { setMoreMenuVisible(false); router.push('/referral'); } },
                { icon: 'settings-outline' as const,     label: t('settings.title'),       onPress: () => { setMoreMenuVisible(false); router.push('/settings'); } },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 14, paddingHorizontal: 20,
                    backgroundColor: pressed ? p.bgElev : 'transparent',
                  })}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon} size={18} color={p.fg} />
                  </View>
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600', flex: 1 }}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={p.fgMuted} />
                </Pressable>
              ))}
            </View>

            {/* Close pill */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
              <Pressable
                onPress={() => setMoreMenuVisible(false)}
                style={({ pressed }) => ({
                  height: 46, borderRadius: 23,
                  backgroundColor: pressed ? p.bgElev : p.pillBg,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                })}
              >
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{t('common.close')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{
          backgroundColor: p.bg,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingBottom: insets.bottom + 24,
        }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          {/* Title row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 }}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={p.fgMuted} />
            </Pressable>
          </View>

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
        </View>
      </View>
    </Modal>
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
/**
 * Static brand-glow backdrop behind the balance hero.
 *
 * Was an animated "breathing" radial driven by a 20fps requestAnimationFrame
 * loop — it caused jank (every frame re-rendered the SVG) and never quite
 * read right. Replaced with a STATIC two-layer glow: no rAF, no state, zero
 * re-renders. A soft off-axis brand-blue core sits over a deeper page-bg
 * fill, giving the hero depth and a calm blue aura without any runtime cost.
 *
 * `mono` stays a flat charcoal (no colour, by design).
 */
const BreathingGradient = memo(function BreathingGradient({ mode }: { mode: 'dark' | 'light' | 'mono' }) {
  if (mode === 'mono') {
    return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#161617' }} />;
  }

  // Two radial stops per theme: a bright-ish blue core fading into the page bg.
  // `core` carries the #63a1db tint; `edge` is the surrounding surface so the
  // glow melts seamlessly into the scroll body below.
  const core = mode === 'dark' ? '#3C5E80' : '#BCD6EE';
  const edge = mode === 'dark' ? '#16181C' : '#FAFAF7';

  return (
    <BalanceSvg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <SvgDefs>
        {/* Primary glow — offset up-left of centre so the light feels
            directional, not a flat spotlight. */}
        <SvgRadialGradient id="cardGlow" cx="38%" cy="30%" r="95%">
          <SvgStop offset="0%"   stopColor={core} stopOpacity={mode === 'dark' ? 0.9 : 0.8} />
          <SvgStop offset="55%"  stopColor={core} stopOpacity={mode === 'dark' ? 0.28 : 0.22} />
          <SvgStop offset="100%" stopColor={edge} stopOpacity={1} />
        </SvgRadialGradient>
        {/* Secondary cool accent — a faint #63a1db wash low-right for depth. */}
        <SvgRadialGradient id="cardGlowAccent" cx="82%" cy="78%" r="70%">
          <SvgStop offset="0%"   stopColor="#63A1DB" stopOpacity={mode === 'dark' ? 0.16 : 0.10} />
          <SvgStop offset="100%" stopColor="#63A1DB" stopOpacity={0} />
        </SvgRadialGradient>
      </SvgDefs>
      <SvgRect x="0" y="0" width="100%" height="100%" fill={edge} />
      <SvgRect x="0" y="0" width="100%" height="100%" fill="url(#cardGlow)" />
      <SvgRect x="0" y="0" width="100%" height="100%" fill="url(#cardGlowAccent)" />
    </BalanceSvg>
  );
});

function AnimatedTotal({
  value,
  palette: p,
  dc,
  showBalance,
  onPress,
}: {
  value: number;
  palette: Palette;
  dc: ReturnType<typeof useDisplayCurrency>;
  showBalance: boolean;
  onPress?: () => void;
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
  const digitCount = totalStr.replace(/[^0-9]/g, '').length;
  const fontSize = digitCount <= 7 ? 52 : digitCount <= 9 ? 44 : digitCount <= 11 ? 36 : 30;

  // Split into the whole part and the cents so the fraction can render
  // smaller/dimmer — a small touch that makes the balance read like a
  // premium fintech figure rather than one flat number.
  const [whole, frac] = (showBalance ? totalStr : totalStr.replace(/[0-9]/g, '*')).split('.');

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 6, paddingBottom: 2 }}>
      {/* Balance centers cleanly — the show/hide eye now lives pinned in
          the sticky block's top-right corner, not beside the number. */}
      <Pressable onPress={onPress} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Currency symbol — smaller + muted, raised like a superscript. */}
        <Text style={{
          color: p.fgMuted, fontSize: fontSize * 0.5, fontWeight: '600',
          marginTop: fontSize * 0.12, marginRight: 2, letterSpacing: -0.5,
        }}>
          {dc.symbol}
        </Text>
        <Text style={{
          color: p.fg,
          fontSize, fontWeight: '700', letterSpacing: -1.2,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}>
          {whole}
          {frac != null && (
            <Text style={{ color: p.fgMuted, fontSize: fontSize * 0.56, fontWeight: '700', letterSpacing: -0.6 }}>
              .{frac}
            </Text>
          )}
        </Text>
      </Pressable>
    </View>
  );
}

/* ── Action buttons — pill row (Revolut / Robinhood style) ────────── */
type ActionTone = 'white' | 'grey' | 'black';
interface ActionDef { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; tone?: ActionTone; to?: string; onPress?: () => void }

/**
 * Visual recipe for an action pill. Clean flat solids (gradients read muddy at
 * this size) with three clear weights:
 *   • Buy    → solid brand blue, white ink — the hero, only one that's coloured
 *   • Sell   → elevated surface + hairline, full-contrast fg ink (neutral)
 *   • Top up → fg inverse (white-on-charcoal / black-on-paper), max contrast
 * `mono` collapses all three to the original white / grey / black.
 */
type ActionLook = {
  bg: string;                    // flat fill
  fg: string;                    // ink (label + icon)
  border?: string;               // optional hairline
  glow?: string;                 // shadow colour (only Buy glows)
};

function actionLook(tone: ActionTone, p: Palette, mono: boolean): ActionLook {
  if (mono) {
    const m = {
      white: { bg: '#FFFFFF', fg: '#111111' },
      grey:  { bg: p.bgElev,  fg: p.fg, border: p.divider },
      black: { bg: '#111111', fg: '#FFFFFF' },
    } as const;
    return m[tone];
  }
  switch (tone) {
    case 'white': // Buy — the one coloured pill. Solid brand blue, white ink, soft blue glow.
      return { bg: p.accent, fg: '#FFFFFF', glow: p.accent };
    case 'grey':  // Sell — neutral elevated surface, full-contrast ink + hairline.
      return { bg: p.bgElev, fg: p.fg, border: p.divider };
    case 'black': // Top up — fg inverse for the third distinct weight.
      return { bg: p.fg, fg: p.bg };
  }
}

/**
 * Action pill — icon + label, three distinct high-contrast looks. The Buy
 * hero gets a brand-blue gradient; Sell and Top up are crisp solids.
 */
function ActionButton({
  label, icon, onPress, to, tone = 'white', palette: p,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  to?: string;
  tone?: ActionTone;
  palette: Palette;
}) {
  const router = useRouter();
  const mono = isMonochrome(useTheme((s) => s.mode));
  const look = actionLook(tone, p, mono);

  const handlePress = () => {
    if (onPress) onPress();
    else if (to) router.push(to as any);
  };

  const glowing = !!look.glow;
  return (
    <PressableScale onPress={handlePress} style={{ flex: 1 }}>
      <View style={{
        height: 46,
        borderRadius: 23,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        backgroundColor: look.bg,
        borderWidth: look.border ? 1 : 0,
        borderColor: look.border,
        // Only the Buy hero casts a soft brand-blue glow; the others sit flat.
        shadowColor: look.glow ?? '#000000',
        shadowOffset: { width: 0, height: glowing ? 5 : 2 },
        shadowOpacity: glowing ? 0.28 : 0.10,
        shadowRadius: glowing ? 12 : 5,
        elevation: glowing ? 5 : 1,
      }}>
        {icon && <Ionicons name={icon} size={15} color={look.fg} />}
        <Text style={{ color: look.fg, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 }}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

function MoreActionButton({ palette: p, onPress }: { palette: Palette; onPress: () => void }) {
  // Neutral square pill — sized to match the action row (46px) so the four
  // controls line up. Stays neutral so the three coloured actions lead.
  return (
    <PressableScale onPress={onPress}>
      <View style={{
        width: 46, height: 46,
        borderRadius: 23,
        backgroundColor: p.pillBg,
        borderWidth: 1, borderColor: p.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name="ellipsis-horizontal" size={18} color={p.fg} />
      </View>
    </PressableScale>
  );
}

/**
 * Small circular icon used in the home header. Optional badge dot.
 */
function HeaderIconButton({
  icon, onPress, palette: p, a11y, badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  palette: Palette;
  a11y: string;
  badge?: number;
}) {
  // Lives inside the header's segmented pill track, so it carries no
  // background/border of its own — just a tappable icon with a soft
  // pressed-state highlight.
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: pressed ? p.border : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      })}
    >
      <Ionicons name={icon} size={16} color={p.fg} />
      {badge !== undefined && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -1, right: -1,
            minWidth: 16, height: 16, borderRadius: 8,
            backgroundColor: p.redFg,
            borderWidth: 2, borderColor: p.bg,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * One segment of the Assets / Activity switcher. Active segment is a
 * filled ctaBg pill; inactive is transparent muted text.
 */
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
  const accentBg = isIncoming ? p.greenBg : 'rgba(239,68,68,0.15)';

  const statusColors: Record<string, { bg: string; fg: string }> = {
    COMPLETED:  { bg: p.greenBg,               fg: p.greenFg  },
    PENDING:    { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b'  },
    PROCESSING: { bg: 'rgba(99,102,241,0.15)',  fg: '#818cf8'  },
    FAILED:     { bg: 'rgba(239,68,68,0.15)',   fg: p.redFg    },
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
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: p.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%' }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          {/* Close */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 4 }}>
            <Pressable
              onPress={onClose} hitSlop={8}
              style={({ pressed }) => ({
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: pressed ? p.border : p.bgElev,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Ionicons name="close" size={15} color={p.fg} />
            </Pressable>
          </View>

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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Activity list — shows the most recent transactions inline on home ─── */
function ActivityList({
  palette: p, dc, items, onSeeAll,
}: {
  palette: Palette;
  dc: ReturnType<typeof useDisplayCurrency>;
  items: TxItem[];
  onSeeAll: () => void;
}) {
  const t = useT();
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

  return (
    <View>
      {items.slice(0, 8).map((tx) => {
        const meta = tx.metadata ?? {};
        const amt  = Number(tx.amount);
        const abs  = Math.abs(amt);
        const type = tx.type;

        const cpName = meta.counterpartyName ?? tx.counterpartyName ?? tx.description;
        const txAsset = meta.asset ?? tx.currency;
        const assetMeta = getCurrencyMeta(txAsset);
        const assetName = assetMeta?.name ?? txAsset;

        let title = '';
        if      (type === 'BUY')          title = `Bought ${assetName}`;
        else if (type === 'SELL')         title = `Sold ${assetName}`;
        else if (type === 'DEPOSIT')      title = `Deposit · ${assetName}`;
        else if (type === 'WITHDRAW' || type === 'WITHDRAWAL') title = `Withdrawal · ${assetName}`;
        else if (type === 'TRANSFER_IN')  title = cpName ? `From ${cpName}` : 'Transfer in';
        else if (type === 'TRANSFER_OUT') title = cpName ? `To ${cpName}` : 'Transfer out';
        else if (type === 'SEND')         title = cpName ? `Sent to ${cpName}` : 'Sent';
        else if (type === 'RECEIVE')      title = cpName ? `From ${cpName}` : 'Received';
        else if (type === 'SWAP')         title = `Swap · ${assetName}`;
        else if (type === 'P2P_BUY')      title = `P2P Buy · ${assetName}`;
        else if (type === 'P2P_SELL')     title = `P2P Sell · ${assetName}`;
        else if (type === 'CARD_SPEND')   title = `Card Spend`;
        else if (type === 'CASHBACK')     title = `Cashback`;
        else title = tx.description ?? (type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' '));

        const dateStr = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        let subtitle = dateStr;
        if (type === 'BUY' || type === 'SELL') {
          // Show the actual wallet/currency used to fund (BUY) or receive (SELL).
          const settleCcy = meta.settlementCurrency as string | undefined;
          const settleAmt = meta.settlementAmount as string | undefined;
          const verb = type === 'BUY' ? 'paid with' : 'received as';
          const fundPart = settleCcy
            ? `${verb} ${settleAmt ? `${settleAmt} ` : ''}${settleCcy}`
            : null;
          const pricePart = meta.priceUsd ? `@ ${dc.fmt(meta.priceUsd)}` : null;
          subtitle = [pricePart, fundPart, dateStr].filter(Boolean).join('  ·  ');
        } else if ((type === 'TRANSFER_IN' || type === 'TRANSFER_OUT' || type === 'SEND' || type === 'RECEIVE') && (meta.note ?? tx.note ?? tx.description)) {
          subtitle = (meta.note ?? tx.note ?? tx.description ?? '') + '  ·  ' + dateStr;
        }

        const showDual  = (type === 'BUY' || type === 'SELL') && meta.cryptoAmount;
        // Display the fiat side in the transaction's OWN currency (the
        // wallet/method actually used), exactly — never the display currency.
        const settleCcy = (meta.settlementCurrency ?? tx.currency) as any;
        const settleAbs = meta.settlementAmount != null ? Math.abs(Number(meta.settlementAmount)) : abs;
        const fiatStr   = formatMoney(settleAbs, settleCcy, { showSymbol: true });
        const cryptoStr = meta.cryptoAmount
          ? formatCryptoDisplay(meta.cryptoAmount, txAsset, 6)
          : null;

        return (
          <Pressable
            key={tx.id}
            onPress={() => setSelectedTx(tx)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 20, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: p.border,
              backgroundColor: pressed ? p.bgElev : 'transparent',
            })}
          >
            {/* Currency icon */}
            <View style={{ flexShrink: 0 }}>
              <CurrencyIcon currency={txAsset} palette={p} size={40} />
            </View>

            {/* Title + subtitle */}
            <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                {title}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>

            {/* Value */}
            <View style={{ alignItems: 'flex-end', flexShrink: 0, marginLeft: 8 }}>
              {showDual && cryptoStr ? (
                <>
                  <Text style={{ color: type === 'BUY' ? p.greenFg : p.redFg, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                    {type === 'BUY' ? '+' : '−'}{cryptoStr}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {type === 'BUY' ? '−' : '+'}{fiatStr}
                  </Text>
                </>
              ) : (
                <Text style={{
                  color: amt >= 0 ? p.greenFg : p.redFg,
                  fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'],
                }}>
                  {amt >= 0 ? '+' : '−'}{fiatStr}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}

      <Pressable
        onPress={onSeeAll}
        style={({ pressed }) => ({
          marginTop: 18, marginHorizontal: 24,
          height: 44, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
          backgroundColor: pressed ? p.border : p.pillBg,
          borderWidth: 1, borderColor: p.border,
        })}
      >
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{t('home.seeAllTx')}</Text>
        <Ionicons name="chevron-forward" size={14} color={p.fg} />
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
              logo={require('../../assets/icon-color.png')}
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
function AssetRow({ wallet, palette: p, onPress, liveUsd, sparkline, changePct, showBalance = true }: {
  wallet: Wallet;
  palette: Palette;
  onPress?: () => void;
  liveUsd?: number;
  sparkline?: number[];
  changePct?: number;
  showBalance?: boolean;
}) {
  const dc = useDisplayCurrency();
  const meta = ASSET_META[wallet.currency] ?? { title: wallet.currency, subDecimals: 6 };
  const usd = liveUsd ?? Number(wallet.fiatValueUsd);
  const positive = (changePct ?? 0) >= 0;
  const sparkColor = positive ? p.greenFg : p.redFg;
  const maxDec = Math.min(meta.subDecimals, 8);
  const balanceStr = Number(wallet.balance).toLocaleString('en-US', { maximumFractionDigits: maxDec });
  const usdStr = dc.fmt(usd);
  const maskedBalance = balanceStr.replace(/[0-9]/g, '*');
  const maskedUsd = usdStr.replace(/[0-9]/g, '*');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 16, marginBottom: 4,
        paddingHorizontal: 14, paddingVertical: 13,
        borderRadius: 18,
        backgroundColor: pressed ? p.bgElev : p.bgElev,
        borderWidth: 1, borderColor: p.border,
      })}
    >
      {/* Top row: icon, name/balance, value + change pill */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <CurrencyIcon currency={wallet.currency} palette={p} />
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text style={{ color: p.fg, fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2 }} numberOfLines={1}>
            {meta.title}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 12.5, fontWeight: '500', marginTop: 2, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
            {showBalance ? balanceStr : maskedBalance} {wallet.currency}
          </Text>
        </View>

        {/* Mid: sparkline sits between name and value for rhythm */}
        {sparkline && sparkline.length >= 2 && (
          <View style={{ marginHorizontal: 10, opacity: 0.85 }}>
            <Sparkline data={sparkline} width={62} height={28} color={sparkColor} strokeWidth={1.6} />
          </View>
        )}

        <View style={{ alignItems: 'flex-end', minWidth: 72 }}>
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.2 }} numberOfLines={1}>
            {showBalance ? usdStr : maskedUsd}
          </Text>
          {changePct !== undefined && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4,
              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
              backgroundColor: !showBalance ? p.pillBg : positive ? p.greenBg : p.redBg,
            }}>
              {showBalance && (
                <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={8} color={positive ? p.greenFg : p.redFg} />
              )}
              <Text style={{ color: showBalance ? (positive ? p.greenFg : p.redFg) : p.fgFaint, fontSize: 10.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {showBalance ? `${Math.abs(changePct).toFixed(2)}%` : '**.**%'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}


/* ── Currency icons ── */
function CurrencyIcon({ currency, palette: p, size = 44 }: { currency: string; palette: Palette; size?: number }) {
  const locale = useI18n((s) => s.locale);
  const meta = getCurrencyMeta(currency);
  const isCrypto = meta?.kind === 'crypto';
  if (isCrypto) {
    return <CoinIcon symbol={currency} size={size} />;
  }
  // Fiat → locale-aware, font-safe symbol (Arabic variants, LD for LYD, …).
  const glyph = fiatSymbol(currency, locale);
  // Multi-letter codes (AED/SAR/LD) need to read smaller than a single $/€.
  const fontSize = glyph.length > 2 ? size * 0.3 : size * 0.5;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize, lineHeight: size * 0.64, color: p.fg, fontWeight: '700' }} numberOfLines={1}>{glyph}</Text>
    </View>
  );
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
