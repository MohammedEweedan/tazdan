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

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import BalanceSvg, { Path as SvgPath, Defs as SvgDefs, LinearGradient as SvgLinearGradient, Stop as SvgStop, Line as SvgLine, Circle as SvgCircle } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAuthStore } from '@/store/authStore';
import { useWallets, useHaptics, useTransactions, useUnreadCount, useMarkets, useDisplayCurrency } from '@/hooks';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { Sparkline } from '@/components/ui/Sparkline';
import { BuyWidget } from '@/components/exchange/BuyWidget';
import { SellWidget } from '@/components/exchange/SellWidget';
import { SendWidget } from '@/components/exchange/SendWidget';
import { ReceiveWidget } from '@/components/exchange/ReceiveWidget';
import { DepositWidget } from '@/components/exchange/DepositWidget';
import type { Wallet, Currency } from '@/types';

type Tab = 'ASSETS' | 'WALLETS' | 'ACTIVITY';

export default function Home() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: wallets, refetch: refetchWallets } = useWallets();
  const { data: txData, refetch: refetchTxs } = useTransactions(1);
  const { data: unreadData } = useUnreadCount();
  const p = useThemedPalette();
  const dc = useDisplayCurrency();
  const themeMode = useTheme((s) => s.mode);
  const [tab, setTab] = useState<Tab>('ASSETS');
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
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
  const onRefresh = async () => {
    setRefreshing(true);
    h.light();
    try {
      await Promise.all([refetchWallets(), refetchTxs(), refetchMarkets()]);
    } finally {
      setRefreshing(false);
    }
  };
  const priceMap = useMemo(() => {
    const map: Partial<Record<Currency, number>> = {};
    if (Array.isArray(tickers)) {
      tickers.forEach((m) => {
        map[m.base] = m.price;
      });
    }
    return map;
  }, [tickers]);

  // Per-asset 7d sparkline (from backend ticker) so each asset row
  // can render a mini chart between the name and the price.
  const sparklineMap = useMemo(() => {
    const map: Partial<Record<Currency, number[]>> = {};
    if (Array.isArray(tickers)) {
      tickers.forEach((m) => {
        const points = m.sparkline;
        if (!Array.isArray(points) || points.length < 2) return;
        // Keep ~32 points — enough for a smooth curve at row size.
        const stride = Math.max(1, Math.floor(points.length / 32));
        map[m.base] = points.filter((_, i) => i % stride === 0);
      });
    }
    return map;
  }, [tickers]);

  // 24h change map — colors the sparkline green/red per-asset.
  const changeMap = useMemo(() => {
    const map: Partial<Record<Currency, number>> = {};
    if (Array.isArray(tickers)) {
      tickers.forEach((m) => {
        map[m.base] = m.changePct24h ?? 0;
      });
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

  // Crypto and fiat categorization
  const CRYPTO_CURRENCIES: Currency[] = ['BTC', 'ETH', 'SOL', 'USDT'];
  const FIAT_CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'];

  const cryptoAssets = useMemo(
    () => ownedAssets.filter((w) => CRYPTO_CURRENCIES.includes(w.currency)),
    [ownedAssets],
  );
  const fiatAssets = useMemo(
    () => ownedAssets.filter((w) => FIAT_CURRENCIES.includes(w.currency)),
    [ownedAssets],
  );

  const totalUsd = useMemo(() => {
    return list.reduce((sum, w) => {
      const live = priceMap[w.currency];
      // For crypto wallets we recompute USD from the live spot. For fiat
      // wallets we trust the server-side `fiatValueUsd` (which already has
      // FX baked in).
      if (live !== undefined) return sum + Number(w.balance) * live;
      return sum + Number(w.fiatValueUsd);
    }, 0);
  }, [list, priceMap]);

  // Aggregate 24h change weighted by USD exposure so the green/red pill
  // truly reflects today's portfolio move.
  const deltaPct = useMemo(() => {
    if (totalUsd <= 0 || !tickers || tickers.length === 0) return 0;
    let weightedChange = 0;
    let totalCryptoExposure = 0;
    list.forEach((w) => {
      const m = tickers.find((t) => t.base === w.currency);
      if (!m || m.changePct24h === undefined || m.changePct24h === 0) return;
      const exposure = Number(w.balance) * m.price;
      weightedChange += exposure * m.changePct24h;
      totalCryptoExposure += exposure;
    });
    // Use total crypto exposure as denominator, not totalUsd (which includes fiat)
    if (totalCryptoExposure <= 0) return 0;
    return weightedChange / totalCryptoExposure;
  }, [list, tickers, totalUsd]);
  const deltaUsd = (totalUsd * deltaPct) / 100;
  const positive = deltaPct >= 0;
  const [showBalance, setShowBalance] = useState(true);

  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase();
  const handle = user?.username ?? user?.email?.split('@')[0] ?? 'me';
  const userEmoji = user?.avatarUrl;

  const ACTIONS: ActionDef[] = [
    { key: 'buy',     icon: 'add',                    label: t('action.buy'),     onPress: () => setBuyModalVisible(true) },
    { key: 'sell',    icon: 'cash-outline',           label: t('action.sell'),    onPress: () => setSellModalVisible(true) },
    { key: 'send',    icon: 'paper-plane-outline',    label: t('action.send'),    onPress: () => setSendModalVisible(true) },
    { key: 'receive', icon: 'qr-code-outline',        label: t('action.receive'), onPress: () => setReceiveModalVisible(true) },
    { key: 'more',    icon: 'ellipsis-horizontal',    label: '···',               onPress: () => setMoreMenuVisible(true) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: p.bg }}
          contentContainerStyle={{ paddingBottom: 140 }}
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
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
          }}>
            <Pressable
              onPress={() => { h.selection(); router.push('/profile'); }}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: userEmoji ? p.bgElev : '#7c3aed',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1,
                borderColor: p.border,
              }}>
                {userEmoji ? (
                  <Text style={{ fontSize: 20 }}>{userEmoji}</Text>
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{initial}</Text>
                )}
              </View>
              <Text style={{ color: p.fg, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
                @{handle}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => { h.selection(); router.push('/notifications'); }}
                hitSlop={6}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="notifications-outline" size={17} color={p.fg} />
                {(unreadData ?? 0) > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -2, right: -2,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: '#ef4444',
                    alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                      {unreadData && unreadData > 9 ? '9+' : unreadData}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() => { h.selection(); router.push('/scanner'); }}
                hitSlop={6}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="scan-outline" size={18} color={p.fg} />
              </Pressable>
            </View>
          </View>
          <AnimatedTotal
            value={totalUsd}
            palette={p}
            dc={dc}
            showBalance={showBalance}
            onToggle={() => setShowBalance(v => !v)}
            onPress={() => { h.selection(); setBalanceChartVisible(true); }}
          />

          {/* 24h delta */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            justifyContent: 'center',
            paddingHorizontal: 24, marginTop: 6,
          }}>
            <Text style={{
              color: p.fgMuted,
              fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'],
            }}>
              {positive ? '+' : '-'}{dc.fmt(Math.abs(deltaUsd))}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
              backgroundColor: positive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              borderWidth: 1,
              borderColor: positive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
            }}>
              <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={9} color={positive ? p.greenFg : p.redFg} />
              <Text style={{
                color: positive ? p.greenFg : p.redFg,
                fontSize: 12, fontWeight: '700',
              }}>
                {Math.abs(deltaPct).toFixed(2)}%
              </Text>
            </View>
          </View>

          {/* ── 5 ACTION BUTTONS ── */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: 16, marginTop: 24,
            gap: 8,
            paddingBottom: 8,
          }}>
            {ACTIONS.map((a) => (
              <ActionButton
                key={a.key}
                icon={a.icon}
                label={a.label}
                to={a.to}
                onPress={a.onPress}
                palette={p}
              />
            ))}
          </View>

          {/* Tabs - center-aligned */}
          <View style={{
            flexDirection: 'row', gap: 32,
            paddingHorizontal: 24, marginTop: 20,
            justifyContent: 'center',
          }}>
            <TabBtn label={t('home.assets')}   active={tab === 'ASSETS'}   palette={p} onPress={() => { h.selection(); setTab('ASSETS'); }} />
            <TabBtn label={t('home.wallets')}  active={tab === 'WALLETS'}  palette={p} onPress={() => { h.selection(); setTab('WALLETS'); }} />
            <TabBtn label={t('home.activity')} active={tab === 'ACTIVITY'} palette={p} onPress={() => { h.selection(); setTab('ACTIVITY'); }} />
          </View>

          <View style={{ height: 1, backgroundColor: p.border, marginTop: 14 }} />

          {/* Rows */}
          {tab === 'ACTIVITY' ? (
            <ActivityList palette={p} dc={dc} items={txData?.items ?? []} onSeeAll={() => { h.light(); router.push('/history'); }} />
          ) : tab === 'WALLETS' ? (
            // Wallets tab — QR addresses + bank references inline
            <WalletAddressList palette={p} wallets={list} onCopy={() => h.selection()} />
          ) : ownedAssets.length > 0 ? (
            // Assets tab - divided into crypto and fiat sections
            <>
              {/* Crypto Assets Section */}
              {cryptoAssets.length > 0 && (
                <View style={{ marginTop: 16, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12, }}>
                    {t('home.cryptoAssets').toUpperCase()}
                  </Text>
                  {cryptoAssets.map((w) => (
                    <AssetRow
                      key={w.id}
                      wallet={w}
                      palette={p}
                      sparkline={sparklineMap[w.currency]}
                      changePct={changeMap[w.currency]}
                      liveUsd={priceMap[w.currency] !== undefined
                        ? Number(w.balance) * (priceMap[w.currency] as number)
                        : undefined}
                      onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
                    />
                  ))}
                </View>
              )}

              {/* Fiat Assets Section */}
              {fiatAssets.length > 0 && (
                <View style={{ marginTop: 24, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
                    {t('home.fiatAssets').toUpperCase()}
                  </Text>
                  {fiatAssets.map((w) => (
                    <AssetRow
                      key={w.id}
                      wallet={w}
                      palette={p}
                      sparkline={sparklineMap[w.currency]}
                      changePct={changeMap[w.currency]}
                      liveUsd={priceMap[w.currency] !== undefined
                        ? Number(w.balance) * (priceMap[w.currency] as number)
                        : undefined}
                      onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
                    />
                  ))}
                </View>
              )}
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
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '800', marginTop: 14, letterSpacing: -0.2 }}>
                {t('home.noAssetsOwned')}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 4, textAlign: 'center' }}>
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
                  <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '800' }}>{t('home.buyCrypto')}</Text>
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
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '800' }}>{t('action.deposit')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Buy Widget Modal */}
      <Modal visible={buyModalVisible} transparent animationType="slide" onRequestClose={() => setBuyModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setBuyModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{t('home.buyCryptoTitle')}</Text>
                <Pressable onPress={() => setBuyModalVisible(false)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={16} color={p.fg} />
                </Pressable>
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
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{t('home.sellCryptoTitle')}</Text>
                <Pressable onPress={() => setSellModalVisible(false)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={16} color={p.fg} />
                </Pressable>
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
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{t('home.sendMoney')}</Text>
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

      {/* Receive Widget Modal */}
      <Modal visible={receiveModalVisible} transparent animationType="slide" onRequestClose={() => setReceiveModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setReceiveModalVisible(false)}>
            <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{t('action.receive')}</Text>
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

      {/* Deposit Widget Modal */}
      <Modal
        visible={depositModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDepositModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={() => setDepositModalVisible(false)}
          >
            <Pressable
              style={{ backgroundColor: p.bg, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, maxHeight: '85%' }}
              onPress={(e) => e.stopPropagation()}
            >
              <DepositWidget />
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
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', marginBottom: 4, letterSpacing: -0.3, paddingHorizontal: 20 }}>
              {t('home.more')}
            </Text>

            {/* Primary actions — matches web three-dot */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: p.border }}>
              {[
                { icon: 'swap-horizontal-outline' as const, label: t('action.swap'),     onPress: () => { setMoreMenuVisible(false); router.push('/transfer'); } },
                { icon: 'arrow-down-circle-outline' as const, label: t('action.deposit'), onPress: () => { setMoreMenuVisible(false); setDepositModalVisible(true); } },
                { icon: 'paper-plane-outline' as const, label: t('action.withdraw'), onPress: () => { setMoreMenuVisible(false); setSendModalVisible(true); } },
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
                  <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Secondary options */}
            <View style={{ paddingVertical: 8 }}>
              {[
                { icon: 'card-outline' as const,       label: t('home.cards'),           onPress: () => { setMoreMenuVisible(false); router.push('/cards'); } },
                { icon: 'time-outline' as const,        label: t('home.history'),         onPress: () => { setMoreMenuVisible(false); router.push('/history'); } },
                { icon: 'pie-chart-outline' as const,   label: t('home.cryptoPortfolio'), onPress: () => { setMoreMenuVisible(false); router.push('/portfolio/crypto'); } },
                { icon: 'wallet-outline' as const,      label: t('home.fiatPortfolio'),  onPress: () => { setMoreMenuVisible(false); router.push('/portfolio/fiat'); } },
                { icon: 'people-outline' as const,      label: t('home.referral'),        onPress: () => { setMoreMenuVisible(false); router.push('/referral'); } },
                { icon: 'settings-outline' as const,    label: t('settings.title'),        onPress: () => { setMoreMenuVisible(false); router.push('/settings'); } },
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
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{t('common.close')}</Text>
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
  const lineColor = trend ? '#22c55e' : '#ef4444';

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
              color: p.fg, fontSize: 34, fontWeight: '800',
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
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 10 }}>
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
                  backgroundColor: range === r ? p.ctaBg : p.pillBg,
                  borderWidth: 1,
                  borderColor: range === r ? p.ctaBg : p.border,
                }}
              >
                <Text style={{
                  color: range === r ? p.ctaFg : p.fgMuted,
                  fontSize: 13, fontWeight: '700',
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

function AnimatedTotal({
  value,
  palette: p,
  dc,
  showBalance,
  onToggle,
  onPress,
}: {
  value: number;
  palette: Palette;
  dc: ReturnType<typeof useDisplayCurrency>;
  showBalance: boolean;
  onToggle: () => void;
  onPress?: () => void;
}) {
  const t = useT();
  const initializedRef = useRef(false);
  const [displayed, setDisplayed] = useState(0);
  const fromRef = useRef(0);
  const targetRef = useRef(value);
  const startTsRef = useRef<number | null>(null);

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashTranslateY = useRef(new Animated.Value(6)).current;
  const [flash, setFlash] = useState<{ dir: 'up' | 'down'; delta: number } | null>(null);
  const prevValueRef = useRef<number | null>(null);

  useEffect(() => {
    // On first load with real data, snap directly — no count-up from zero.
    if (!initializedRef.current && value > 0) {
      initializedRef.current = true;
      setDisplayed(value);
      prevValueRef.current = value;
      return;
    }
    // Subsequent value changes (live price ticks, new transactions) animate smoothly.
    fromRef.current = displayed;
    targetRef.current = value;
    startTsRef.current = Date.now();
    const dur = 1400;
    let raf: any;
    let lastFrameTs = 0;
    const tick = () => {
      const now = Date.now();
      if (now - lastFrameTs < 33) { raf = requestAnimationFrame(tick); return; }
      lastFrameTs = now;
      const elapsed = now - (startTsRef.current ?? now);
      const progress = Math.min(1, elapsed / dur);
      const eased = progress < 0.5
        ? 8 * progress * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 4) / 2;
      setDisplayed(fromRef.current + (targetRef.current - fromRef.current) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  // Detect transactions: when the value changes by a non-trivial amount,
  // pop the green/red flash pill.
  useEffect(() => {
    if (prevValueRef.current === null) {
      prevValueRef.current = value;
      return;
    }
    const diff = value - prevValueRef.current;
    prevValueRef.current = value;
    // Ignore tiny price-tick noise (< $0.50). Real txs move balances by
    // dollars or more so this still catches a deposit / send / fill.
    if (Math.abs(diff) < 0.5) return;
    setFlash({ dir: diff > 0 ? 'up' : 'down', delta: diff });
    flashOpacity.setValue(0);
    flashTranslateY.setValue(6);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(flashOpacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(flashTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      Animated.delay(1300),
      Animated.parallel([
        Animated.timing(flashOpacity,    { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(flashTranslateY, { toValue: -6, duration: 350, useNativeDriver: true }),
      ]),
    ]).start(() => setFlash(null));
  }, [value]);

  // Tint the main text briefly while a flash is active.
  const flashColor = flash?.dir === 'up' ? p.greenFg : flash?.dir === 'down' ? p.redFg : p.fg;

  const converted = dc.convert(displayed);
  const totalStr = converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: dc.isCrypto ? 6 : 2 });
  const digitCount = totalStr.replace(/[^0-9]/g, '').length;
  const fontSize = digitCount <= 7 ? 48 : digitCount <= 9 ? 40 : digitCount <= 11 ? 34 : 28;

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 }}>
      {/* <Text style={{
        color: p.fgMuted, fontSize: 12, fontWeight: '600',
        letterSpacing: 1.0, textTransform: 'uppercase', marginBottom: 8,
      }}>
        {t('home.totalBalance')}
      </Text> */}
      <Pressable onPress={onPress} hitSlop={12}>
        <Text style={{
          color: p.fg,
          fontSize, fontWeight: '800', letterSpacing: -1.6,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}>
          {dc.symbol}{totalStr}
        </Text>
      </Pressable>

      {flash && (
        <Animated.View
          style={{
            position: 'absolute', top: -6, right: '8%',
            opacity: flashOpacity,
            transform: [{ translateY: flashTranslateY }],
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
            backgroundColor: flash.dir === 'up' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
            borderWidth: 1,
            borderColor: flash.dir === 'up' ? '#22c55e' : '#ef4444',
          }}
        >
          <Ionicons
            name={flash.dir === 'up' ? 'arrow-up' : 'arrow-down'}
            size={10}
            color={flash.dir === 'up' ? '#22c55e' : '#ef4444'}
          />
          {/* <Text style={{
            color: flash.dir === 'up' ? p.greenFg : p.redFg,
            fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'],
          }}>
            {flash.dir === 'up' ? '+' : '-'}${formatFiat(Math.abs(flash.delta))}
          </Text> */}
        </Animated.View>
      )}
    </View>
  );
}

/* ── Action button — icon only + label below (no circles) ─── */
interface ActionDef { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; to?: string; onPress?: () => void }

function ActionButton({
  icon, label, onPress, to, palette: p,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  to?: string;
  palette: Palette;
}) {
  const router = useRouter();
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (to) {
      router.push(to);
    }
  };
  
  return (
    <Pressable
      onPress={handlePress}
      hitSlop={4}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        height: 56,
        borderRadius: 14,
        gap: 5,
        backgroundColor: pressed ? p.border : p.bgElev,
        borderWidth: 1,
        borderColor: p.border,
      })}
    >
      <Ionicons name={icon} size={19} color={p.fg} />
      <Text
        numberOfLines={1}
        style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TabBtn({ label, active, palette: p, onPress }: {
  label: string; active: boolean; palette: Palette; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <View style={{ paddingBottom: 10 }}>
        <Text style={{
          color: active ? p.fg : p.fgFaint,
          fontSize: 17,
          fontWeight: active ? '700' : '600',
          letterSpacing: -0.2,
        }}>
          {label}
        </Text>
        {active && (
          <View style={{
            position: 'absolute', bottom: -1, left: 0, right: 0,
            height: 2, backgroundColor: p.fg, borderRadius: 2,
          }} />
        )}
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
  metadata?: { asset?: string; cryptoAmount?: number; priceUsd?: number; counterpartyName?: string; note?: string } | null;
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
      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
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
  const fiatStr   = dc.fmt(abs);
  const cryptoStr = meta.cryptoAmount
    ? `${meta.cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${asset}`
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

  const iconName: keyof typeof Ionicons.glyphMap =
    type === 'BUY'  || type === 'P2P_BUY'   ? 'bag-handle'        :
    type === 'SELL' || type === 'P2P_SELL'  ? 'cash'              :
    type === 'DEPOSIT'                      ? 'arrow-down-circle' :
    type === 'WITHDRAW' || type === 'WITHDRAWAL' ? 'arrow-up-circle' :
    type === 'SEND' || type === 'TRANSFER_OUT'   ? 'paper-plane'    :
    type === 'RECEIVE' || type === 'TRANSFER_IN' ? 'arrow-down-circle' :
    type === 'SWAP'                         ? 'swap-horizontal'   :
    type === 'CARD_SPEND'                   ? 'card'              :
    type === 'CASHBACK'                     ? 'gift'              : 'receipt';

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
                marginBottom: 20,
              }}>
                <Ionicons name={iconName} size={36} color={accent} />
              </View>

              <Text style={{ color: p.fg, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' }}>
                {title}
              </Text>

              <View style={{
                marginTop: 10, paddingHorizontal: 14, paddingVertical: 5,
                borderRadius: 20, backgroundColor: sc.bg,
              }}>
                <Text style={{ color: sc.fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
                  {status}
                </Text>
              </View>

              <View style={{ marginTop: 28, alignItems: 'center' }}>
                {showDual && cryptoStr ? (
                  <>
                    <Text style={{
                      color: type === 'BUY' ? p.greenFg : p.redFg,
                      fontSize: 36, fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'],
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
                    color: accent, fontSize: 36, fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'],
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
                  value={`${meta.cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${asset}`}
                  palette={p} borderTop
                />
              )}
              {fee !== null && (
                <DetailRow icon="flash-outline" label="Network Fee" value={dc.fmt(fee)} palette={p} borderTop />
              )}
              <DetailRow icon="wallet-outline" label="Currency" value={tx.currency} palette={p} borderTop />
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
                    : <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800' }}>
                        {(cpName ?? cpHandle ?? '?')[0].toUpperCase()}
                      </Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 }}>
                    {cpDirection}
                  </Text>
                  {cpName && (
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{cpName}</Text>
                  )}
                  {cpHandle && (
                    <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 1 }}>
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
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>
                  NOTE
                </Text>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500', lineHeight: 21 }}>{note}</Text>
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
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 }}>
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
                <Text style={{ color: copied ? p.greenFg : p.fgMuted, fontSize: 12, fontWeight: '700' }}>
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
        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12, fontWeight: '500' }}>
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
        let title = '';
        if      (type === 'BUY')          title = `Bought ${meta.asset ?? tx.currency}`;
        else if (type === 'SELL')         title = `Sold ${meta.asset ?? tx.currency}`;
        else if (type === 'DEPOSIT')      title = `Deposit · ${tx.currency}`;
        else if (type === 'WITHDRAW' || type === 'WITHDRAWAL') title = `Withdrawal · ${tx.currency}`;
        else if (type === 'TRANSFER_IN')  title = cpName ? `From: ${cpName}` : 'Transfer in';
        else if (type === 'TRANSFER_OUT') title = cpName ? `To: ${cpName}` : 'Transfer out';
        else if (type === 'SEND')         title = cpName ? `Sent to: ${cpName}` : 'Sent';
        else if (type === 'RECEIVE')      title = cpName ? `From: ${cpName}` : 'Received';
        else if (type === 'SWAP')         title = `Swap · ${tx.currency}`;
        else if (type === 'P2P_BUY')      title = `P2P Buy · ${meta.asset ?? tx.currency}`;
        else if (type === 'P2P_SELL')     title = `P2P Sell · ${meta.asset ?? tx.currency}`;
        else if (type === 'CARD_SPEND')   title = `Card Spend`;
        else if (type === 'CASHBACK')     title = `Cashback`;
        else title = tx.description ?? (type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' '));

        const dateStr = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        let subtitle = dateStr;
        if ((type === 'BUY' || type === 'SELL') && meta.cryptoAmount) {
          subtitle = `${meta.cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${meta.asset ?? ''} · ${dateStr}`;
        } else if ((type === 'TRANSFER_IN' || type === 'TRANSFER_OUT' || type === 'SEND' || type === 'RECEIVE') && (meta.note ?? tx.note ?? tx.description)) {
          subtitle = (meta.note ?? tx.note ?? tx.description ?? '') + '  ·  ' + dateStr;
        }

        const showDual  = (type === 'BUY' || type === 'SELL') && meta.cryptoAmount;
        const fiatStr   = dc.fmt(abs);
        const cryptoStr = meta.cryptoAmount
          ? `${meta.cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${meta.asset ?? tx.currency}`
          : null;

        const isInRow = amt >= 0 || type === 'BUY' || type === 'DEPOSIT' || type === 'RECEIVE' || type === 'TRANSFER_IN' || type === 'CASHBACK';
        const iconName: keyof typeof Ionicons.glyphMap =
          type === 'BUY'  || type === 'P2P_BUY'        ? 'bag-handle'     :
          type === 'SELL' || type === 'P2P_SELL'       ? 'cash'           :
          type === 'DEPOSIT'                           ? 'add-circle'     :
          type === 'WITHDRAW' || type === 'WITHDRAWAL' ? 'remove-circle'  :
          type === 'SEND' || type === 'TRANSFER_OUT'   ? 'arrow-up'       :
          type === 'RECEIVE' || type === 'TRANSFER_IN' ? 'arrow-down'     :
          type === 'CARD_SPEND'                        ? 'card'           :
          type === 'CASHBACK'                          ? 'gift'           :
          'swap-horizontal';

        return (
          <Pressable
            key={tx.id}
            onPress={() => setSelectedTx(tx)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 24, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: p.border,
              gap: 12,
              backgroundColor: pressed ? p.bgElev : 'transparent',
            })}
          >
            {/* Icon */}
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: isInRow ? p.greenBg : 'rgba(239,68,68,0.12)',
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Ionicons name={iconName} size={17} color={isInRow ? p.greenFg : p.redFg} />
            </View>

            {/* Title + subtitle */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                {title}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>

            {/* Value(s) */}
            <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
              {showDual && cryptoStr ? (
                <>
                  <Text style={{ color: type === 'BUY' ? p.greenFg : p.redFg, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {type === 'BUY' ? '+' : '−'}{cryptoStr}
                  </Text>
                  <Text style={{ color: type === 'BUY' ? p.redFg : p.greenFg, fontSize: 12, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {type === 'BUY' ? '−' : '+'}{fiatStr}
                  </Text>
                </>
              ) : (
                <Text style={{
                  color: amt >= 0 ? p.greenFg : p.redFg,
                  fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'],
                }}>
                  {amt >= 0 ? '+' : '−'}{fiatStr}
                </Text>
              )}
            </View>

            {/* Chevron hint */}
            <Ionicons name="chevron-forward" size={13} color={p.fgFaint} />
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
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{t('home.seeAllTx')}</Text>
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
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 12 }}>
          {t('home.noWallets')}
        </Text>
      </View>
    );
  }
  return (
    <View>
      {wallets.map((w) => {
        const meta = ASSET_META[w.currency] ?? ASSET_META.DEFAULT;
        const isCrypto = ['BTC','ETH','USDT','SOL','BNB','XRP','ADA','DOGE','MATIC','DOT','AVAX'].includes(w.currency);
        const addr = isCrypto
          ? deriveAddress(w.id, w.currency)
          : `PRMK-${w.currency}-${w.id.slice(0, 8).toUpperCase()}`;
        const chain = CHAIN_LABEL[w.currency] ?? w.currency;
        return (
          <View
            key={w.id}
            style={{
              paddingHorizontal: 24, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: p.border,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <CurrencyIcon currency={w.currency} palette={p} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                  {meta.title}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  {isCrypto ? `${chain} ${t('home.network')}` : t('home.bankReference')}
                </Text>
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {Number(w.balance).toLocaleString('en-US', { maximumFractionDigits: meta.subDecimals })} {w.currency}
              </Text>
            </View>

            {/*
             * Two pressables side-by-side:
             *  - the long address pill copies on tap
             *  - the QR icon on the right opens the QR modal
             * Both are needed so a tap anywhere on the address is a copy
             * (the most common action) without accidentally losing the QR.
             */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={async () => {
                  onCopy();
                  await Clipboard.setStringAsync(addr);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14,
                  backgroundColor: pressed ? p.border : p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                })}
              >
                <Ionicons name={isCrypto ? 'wallet-outline' : 'card-outline'} size={14} color={p.fgMuted} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: p.fg, fontSize: 12, fontWeight: '600',
                    fontFamily: 'Menlo' as any,
                  }}
                >
                  {addr}
                </Text>
                <Ionicons name="copy-outline" size={14} color={p.fgMuted} />
              </Pressable>

              <Pressable
                onPress={() => {
                  onCopy();
                  setQrFor({ wallet: w, address: addr, chain: isCrypto ? chain : t('home.bankReference') });
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
      })}

      <QrModal palette={p} info={qrFor} onClose={() => setQrFor(null)} />
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
  // Use bg=white + black foreground so the code scans regardless of theme.
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=12&data=${encodeURIComponent(address)}&bgcolor=ffffff&color=000000`;

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
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '800' }}>
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
            <Image
              source={{ uri: qrUrl }}
              style={{ width: 220, height: 220, borderRadius: 8 }}
              resizeMode="contain"
            />
          </View>

          {/* Address */}
          <View style={{
            marginTop: 16,
            paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
          }}>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
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
              <Text style={{ color: p.fg, fontWeight: '800', fontSize: 14 }}>{t('common.copy')}</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 24,
                backgroundColor: pressed ? '#000' : p.ctaBg,
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Text style={{ color: p.ctaFg, fontWeight: '800', fontSize: 14 }}>{t('common.done')}</Text>
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
  BTC: 'Bitcoin', ETH: 'Ethereum (ERC-20)', USDT: 'Tron (TRC-20)',
  SOL: 'Solana', BNB: 'BNB Smart Chain', XRP: 'XRP Ledger',
  ADA: 'Cardano', DOGE: 'Dogecoin', MATIC: 'Polygon',
  DOT: 'Polkadot', AVAX: 'Avalanche C-Chain',
};

/** Stable demo address derived from the wallet id so every render shows
 *  the same string. Replace with chain RPC integration when ready. */
function deriveAddress(walletId: string, currency: string): string {
  const seed = walletId.replace(/-/g, '');
  if (currency === 'BTC')                       return `bc1q${seed.slice(0, 38)}`;
  if (currency === 'SOL')                       return seed.slice(0, 44);
  if (currency === 'XRP')                       return `r${seed.slice(0, 33)}`;
  if (currency === 'ADA')                       return `addr1${seed.slice(0, 56)}`;
  // EVM-style fallback for ETH / USDT / BNB / MATIC / AVAX / DOT / DOGE.
  return `0x${seed.slice(0, 40)}`;
}

/* ── Asset row ─── */
function AssetRow({ wallet, palette: p, onPress, liveUsd, sparkline, changePct }: {
  wallet: Wallet;
  palette: Palette;
  onPress?: () => void;
  liveUsd?: number;
  sparkline?: number[];
  changePct?: number;
}) {
  const dc = useDisplayCurrency();
  const meta = ASSET_META[wallet.currency] ?? ASSET_META.DEFAULT;
  const usd = liveUsd ?? Number(wallet.fiatValueUsd);
  const positive = (changePct ?? 0) >= 0;
  const sparkColor = positive ? '#22c55e' : '#ef4444';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: pressed ? p.bgElev : 'transparent',
        borderBottomWidth: 1, borderBottomColor: p.border,
      })}
    >
      <View style={{ width: 36, alignItems: 'center' }}>
        <CurrencyIcon currency={wallet.currency} palette={p} />
      </View>
      <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
          {wallet.currency}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
          {Number(wallet.balance).toLocaleString('en-US', {
            minimumFractionDigits: meta.subDecimals,
            maximumFractionDigits: meta.subDecimals,
          })} {wallet.currency}
        </Text>
      </View>
      {sparkline && sparkline.length >= 2 && (
        <View style={{ marginHorizontal: 8, opacity: 0.9 }}>
          <Sparkline data={sparkline} width={60} height={28} color={sparkColor} strokeWidth={1.5} />
        </View>
      )}
      <View style={{ alignItems: 'flex-end', minWidth: 72 }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {dc.fmt(usd)}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 1 }}>
          {meta.title}
        </Text>
      </View>
    </Pressable>
  );
}


/* ── Currency icons ── */
function CurrencyIcon({ currency, palette: p }: { currency: Currency; palette: Palette }) {
  const cfg = ICON_CFG[currency] ?? ICON_CFG.DEFAULT;
  return (
    <View style={{
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'transparent',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: p.fg, fontWeight: '700', fontSize: cfg.fontSize ? cfg.fontSize + 4 : 22 }}>
        {cfg.glyph}
      </Text>
    </View>
  );
}

interface AssetMeta { title: string; subDecimals: number }
const ASSET_META: Record<string, AssetMeta> = {
  BTC:   { title: 'Bitcoin',     subDecimals: 8 },
  ETH:   { title: 'Ethereum',    subDecimals: 6 },
  USDT:  { title: 'Tether',      subDecimals: 2 },
  SOL:   { title: 'Solana',      subDecimals: 4 },
  BNB:   { title: 'BNB',         subDecimals: 4 },
  XRP:   { title: 'XRP',         subDecimals: 4 },
  ADA:   { title: 'Cardano',     subDecimals: 4 },
  DOGE:  { title: 'Dogecoin',    subDecimals: 4 },
  MATIC: { title: 'Polygon',     subDecimals: 4 },
  DOT:   { title: 'Polkadot',    subDecimals: 4 },
  AVAX:  { title: 'Avalanche',   subDecimals: 4 },
  USD:   { title: 'US Dollar',         subDecimals: 2 },
  EUR:   { title: 'Euro',              subDecimals: 2 },
  GBP:   { title: 'British Pound',     subDecimals: 2 },
  AED:   { title: 'UAE Dirham',        subDecimals: 2 },
  SAR:   { title: 'Saudi Riyal',       subDecimals: 2 },
  EGP:   { title: 'Egyptian Pound',    subDecimals: 2 },
  DEFAULT: { title: 'Asset', subDecimals: 4 },
};

interface IconCfg { bg: string; fg: string; glyph: string; fontSize?: number }
const ICON_CFG: Record<string, IconCfg> = {
  BTC:   { bg: '#f7931a', fg: '#fff', glyph: '₿', fontSize: 17 },
  ETH:   { bg: '#627eea', fg: '#fff', glyph: 'Ξ', fontSize: 16 },
  USDT:  { bg: '#26a17b', fg: '#fff', glyph: '₮', fontSize: 16 },
  SOL:   { bg: '#9945ff', fg: '#fff', glyph: '◎', fontSize: 16 },
  BNB:   { bg: '#f3ba2f', fg: '#000', glyph: '⬡', fontSize: 16 },
  XRP:   { bg: '#23292f', fg: '#fff', glyph: '✕', fontSize: 14 },
  ADA:   { bg: '#0033ad', fg: '#fff', glyph: '₳', fontSize: 16 },
  DOGE:  { bg: '#c3a634', fg: '#fff', glyph: 'Ð', fontSize: 16 },
  MATIC: { bg: '#8247e5', fg: '#fff', glyph: '◆', fontSize: 14 },
  DOT:   { bg: '#e6007a', fg: '#fff', glyph: '●', fontSize: 14 },
  AVAX:  { bg: '#e84142', fg: '#fff', glyph: '▲', fontSize: 13 },
  USD:   { bg: '#2775ca', fg: '#fff', glyph: '$', fontSize: 16 },
  EUR:   { bg: '#1a73e8', fg: '#fff', glyph: '€', fontSize: 16 },
  GBP:   { bg: '#7c3aed', fg: '#fff', glyph: '£', fontSize: 16 },
  AED:   { bg: '#0f766e', fg: '#fff', glyph: 'د', fontSize: 13 },
  SAR:   { bg: '#15803d', fg: '#fff', glyph: '﷼', fontSize: 14 },
  EGP:   { bg: '#dc2626', fg: '#fff', glyph: '£', fontSize: 16 },
  DEFAULT: { bg: 'rgba(125,125,125,0.2)', fg: '#888', glyph: '?', fontSize: 14 },
};
