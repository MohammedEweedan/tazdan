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
import { ActivityIndicator, Animated, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAuthStore } from '@/store/authStore';
import { useWallets, useHaptics, useTransactions, useUnreadCount } from '@/hooks';
import { useMarkets as useGeckoMarkets, ID_TO_SYM } from '@/hooks/useMarkets';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { formatFiat } from '@/utils/format';
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
  const user = useAuthStore((s) => s.user);
  const { data: wallets, refetch: refetchWallets } = useWallets();
  const { data: txData, refetch: refetchTxs } = useTransactions(1);
  const { data: unreadData } = useUnreadCount();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const [tab, setTab] = useState<Tab>('ASSETS');
  const [buyModalVisible, setBuyModalVisible] = useState(false);
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);

  const list = wallets ?? [];

  // Live USD price map keyed by ticker (e.g. { BTC: 67_432.10, ETH: 3_240.50 }).
  // Computed from CoinGecko + 60s REST poll. We re-derive `totalUsd` from
  // these so the home balance fluctuates in real time exactly like the
  // asset detail screen.
  const { data: gecko, refetch: refetchMarkets } = useGeckoMarkets();

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
    if (Array.isArray(gecko)) {
      gecko.forEach((m) => {
        const sym = ID_TO_SYM[m.id];
        if (sym) map[sym] = m.current_price;
      });
    }
    return map;
  }, [gecko]);

  // Per-asset 7d sparkline (already-real CoinGecko data) so each asset row
  // can render a mini chart between the name and the price — same data
  // source as the asset-detail screen, just downsampled inline.
  const sparklineMap = useMemo(() => {
    const map: Partial<Record<Currency, number[]>> = {};
    if (Array.isArray(gecko)) {
      gecko.forEach((m) => {
        const sym = ID_TO_SYM[m.id];
        const points = m.sparkline_in_7d?.price;
        if (!sym || !Array.isArray(points) || points.length < 2) return;
        // Keep ~32 points — enough for a smooth curve at row size.
        const stride = Math.max(1, Math.floor(points.length / 32));
        map[sym] = points.filter((_, i) => i % stride === 0);
      });
    }
    return map;
  }, [gecko]);

  // 24h change map — colors the sparkline green/red per-asset.
  const changeMap = useMemo(() => {
    const map: Partial<Record<Currency, number>> = {};
    if (Array.isArray(gecko)) {
      gecko.forEach((m) => {
        const sym = ID_TO_SYM[m.id];
        if (sym) map[sym] = m.price_change_percentage_24h ?? 0;
      });
    }
    return map;
  }, [gecko]);

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

  const cryptoWallets = useMemo(
    () => list.filter((w) => CRYPTO_CURRENCIES.includes(w.currency)),
    [list],
  );
  const fiatWallets = useMemo(
    () => list.filter((w) => FIAT_CURRENCIES.includes(w.currency)),
    [list],
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
    if (totalUsd <= 0 || !gecko) return 0;
    let weightedChange = 0;
    list.forEach((w) => {
      const m = (gecko ?? []).find((g) => ID_TO_SYM[g.id] === w.currency);
      if (!m) return;
      const exposure = Number(w.balance) * m.current_price;
      weightedChange += (exposure / totalUsd) * (m.price_change_percentage_24h ?? 0);
    });
    return weightedChange;
  }, [list, gecko, totalUsd]);
  const deltaUsd = (totalUsd * deltaPct) / 100;
  const positive = deltaPct >= 0;

  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase();
  const handle = user?.username ?? user?.email?.split('@')[0] ?? 'me';
  const userEmoji = user?.avatarUrl;

  const ACTIONS: ActionDef[] = [
    { key: 'buy',     icon: 'add',                   label: 'Buy',     onPress: () => setBuyModalVisible(true) },
    { key: 'sell',    icon: 'cash-outline',          label: 'Sell',    onPress: () => setSellModalVisible(true) },
    { key: 'send',    icon: 'paper-plane-outline',   label: 'Send',    onPress: () => setSendModalVisible(true) },
    { key: 'receive', icon: 'qr-code-outline',       label: 'Receive', onPress: () => setReceiveModalVisible(true) },
    { key: 'deposit', icon: 'arrow-down',            label: 'Deposit', onPress: () => setDepositModalVisible(true) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={p.fg}
              colors={[p.fg]}
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
                backgroundColor: userEmoji ? (themeMode === 'dark' ? '#1a1d27' : '#f5f5f7') : (themeMode === 'dark' ? '#a78bfa' : '#7c3aed'),
                alignItems: 'center', justifyContent: 'center',
                borderWidth: userEmoji ? 1 : 0,
                borderColor: userEmoji ? (themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)') : 'transparent',
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
                  backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
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
                  backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="scan-outline" size={18} color={p.fg} />
              </Pressable>
            </View>
          </View>
          <AnimatedTotal value={totalUsd} palette={p} />

          {/* 24h delta */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            justifyContent: 'center',
            paddingHorizontal: 24, marginTop: 6,
          }}>
            <Text style={{
              color: positive ? p.greenFg : p.redFg,
              fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'],
            }}>
              {positive ? '+' : '-'}${formatFiat(Math.abs(deltaUsd))}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
              backgroundColor: positive ? p.greenBg : 'rgba(239,68,68,0.16)',
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
            paddingHorizontal: 16, marginTop: 28,
            gap: 4,
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
            paddingHorizontal: 24, marginTop: 32,
            justifyContent: 'center',
          }}>
            <TabBtn label="Assets"   active={tab === 'ASSETS'}   palette={p} onPress={() => { h.selection(); setTab('ASSETS'); }} />
            <TabBtn label="Wallets"  active={tab === 'WALLETS'}  palette={p} onPress={() => { h.selection(); setTab('WALLETS'); }} />
            <TabBtn label="Activity" active={tab === 'ACTIVITY'} palette={p} onPress={() => { h.selection(); setTab('ACTIVITY'); }} />
          </View>

          <View style={{ height: 1, backgroundColor: p.border, marginTop: 14 }} />

          {/* Rows */}
          {tab === 'ACTIVITY' ? (
            <ActivityList palette={p} items={txData?.items ?? []} onSeeAll={() => { h.light(); router.push('/history'); }} />
          ) : tab === 'WALLETS' ? (
            // Wallets tab - divided into crypto and fiat sections
            <>
              {/* Crypto Wallets Section */}
              <View style={{ marginTop: 16, paddingHorizontal: 24 }}>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
                  CRYPTO WALLETS
                </Text>
                {cryptoWallets.length > 0 ? (
                  cryptoWallets.map((w) => (
                    <WalletRow
                      key={w.id}
                      wallet={w}
                      palette={p}
                      onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
                    />
                  ))
                ) : (
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', paddingVertical: 12 }}>
                    No crypto wallets
                  </Text>
                )}
              </View>

              {/* Fiat Wallets Section */}
              <View style={{ marginTop: 24, paddingHorizontal: 24 }}>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
                  FIAT WALLETS
                </Text>
                {fiatWallets.length > 0 ? (
                  fiatWallets.map((w) => (
                    <WalletRow
                      key={w.id}
                      wallet={w}
                      palette={p}
                      onPress={() => { h.selection(); router.push(`/asset/${w.currency}`); }}
                    />
                  ))
                ) : (
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', paddingVertical: 12 }}>
                    No fiat wallets
                  </Text>
                )}
              </View>
            </>
          ) : ownedAssets.length > 0 ? (
            // Assets tab - divided into crypto and fiat sections
            <>
              {/* Crypto Assets Section */}
              {cryptoAssets.length > 0 && (
                <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
                    CRYPTO ASSETS
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
                <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
                    FIAT ASSETS
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
                No assets owned
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 4, textAlign: 'center' }}>
                Buy or deposit crypto to get started.
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
                  <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '800' }}>Buy crypto</Text>
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
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '800' }}>Deposit</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Buy Widget Modal */}
      <Modal
        visible={buyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBuyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={() => setBuyModalVisible(false)}
          >
            <Pressable
              style={{ backgroundColor: p.bg, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, maxHeight: '85%' }}
              onPress={(e) => e.stopPropagation()}
            >
              <BuyWidget />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sell Widget Modal */}
      <Modal
        visible={sellModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSellModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={() => setSellModalVisible(false)}
          >
            <Pressable
              style={{ backgroundColor: p.bg, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, maxHeight: '85%' }}
              onPress={(e) => e.stopPropagation()}
            >
              <SellWidget />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Send Widget Modal */}
      <Modal
        visible={sendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSendModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={() => setSendModalVisible(false)}
          >
            <Pressable
              style={{ backgroundColor: p.bg, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, maxHeight: '85%' }}
              onPress={(e) => e.stopPropagation()}
            >
              <SendWidget />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Receive Widget Modal */}
      <Modal
        visible={receiveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiveModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
            onPress={() => setReceiveModalVisible(false)}
          >
            <Pressable
              style={{ backgroundColor: p.bg, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, maxHeight: '85%' }}
              onPress={(e) => e.stopPropagation()}
            >
              <ReceiveWidget />
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
function AnimatedTotal({ value, palette: p }: { value: number; palette: Palette }) {
  const [displayed, setDisplayed] = useState(0);
  const fromRef = useRef(0);
  const targetRef = useRef(value);
  const startTsRef = useRef<number | null>(null);

  // Flash state: { dir: 'up' | 'down' | null, delta: number }
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashTranslateY = useRef(new Animated.Value(6)).current;
  const [flash, setFlash] = useState<{ dir: 'up' | 'down'; delta: number } | null>(null);
  const prevValueRef = useRef<number | null>(null);

  // Drive the count-up tween whenever the target changes.
  // The first mount uses a 2.4s ramp - slow + deliberate, like a wealth
  // app revealing your net worth. Subsequent retargets use 1.4s so live
  // price ticks still feel responsive without ever snapping.
  // Easing: a tuned ease-in-out-quart so the digits accelerate from
  // rest, glide through the middle, and settle gently at the target.
  useEffect(() => {
    fromRef.current = displayed;
    targetRef.current = value;
    startTsRef.current = Date.now();
    const isFirstReveal = prevValueRef.current === null;
    const dur = isFirstReveal ? 2400 : 1400;
    let raf: any;
    let lastFrameTs = 0;
    const tick = () => {
      const now = Date.now();
      // Throttle to ~30 fps for the long ramp - looks smooth, halves the
      // re-renders compared to 60 fps and avoids jank on slower devices.
      if (now - lastFrameTs < 33) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastFrameTs = now;
      const elapsed = now - (startTsRef.current ?? now);
      const t = Math.min(1, elapsed / dur);
      // ease-in-out quart - slow start, glide, slow finish.
      const eased = t < 0.5
        ? 8 * t * t * t * t
        : 1 - Math.pow(-2 * t + 2, 4) / 2;
      const next = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplayed(next);
      if (t < 1) raf = requestAnimationFrame(tick);
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

  const totalStr = displayed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const digitCount = totalStr.replace(/[^0-9]/g, '').length;
  const fontSize = digitCount <= 7 ? 48 : digitCount <= 9 ? 40 : digitCount <= 11 ? 34 : 28;

  return (
    <View style={{ alignItems: 'center', marginTop: 4, paddingHorizontal: 24 }}>
      <Text style={{
        color: flash ? flashColor : p.fg,
        fontSize, fontWeight: '800', letterSpacing: -1.6,
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
      }}>
        ${totalStr}
      </Text>

      {flash && (
        <Animated.View
          style={{
            position: 'absolute', top: -6, right: '8%',
            opacity: flashOpacity,
            transform: [{ translateY: flashTranslateY }],
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
            backgroundColor: flash.dir === 'up' ? p.greenBg : 'rgba(239,68,68,0.16)',
            borderWidth: 1,
            borderColor: flash.dir === 'up' ? p.greenFg : p.redFg,
          }}
        >
          <Ionicons
            name={flash.dir === 'up' ? 'arrow-up' : 'arrow-down'}
            size={10}
            color={flash.dir === 'up' ? p.greenFg : p.redFg}
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
        opacity: pressed ? 0.7 : 1,
        gap: 6,
      })}
    >
      <Ionicons name={icon} size={24} color={p.fg} />
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

/* ── Activity list — shows the most recent transactions inline on home ─── */
function ActivityList({
  palette: p, items, onSeeAll,
}: {
  palette: Palette;
  items: Array<{ id: string; type: string; amount: string | number; currency: string; description?: string | null; createdAt: string | Date }>;
  onSeeAll: () => void;
}) {
  if (items.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
        <Ionicons name="receipt-outline" size={28} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12, fontWeight: '500' }}>
          No activity yet.
        </Text>
      </View>
    );
  }
  const recent = items.slice(0, 8);
  return (
    <View>
      {recent.map((t, i) => {
        const amt = Number(t.amount);
        const negative = amt < 0;
        const abs = Math.abs(amt);
        return (
          <View
            key={t.id}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 24, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: p.border,
              gap: 12,
            }}
          >
            <View style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons
                name={
                  t.type === 'BUY'          ? 'cart' :
                  t.type === 'SELL'         ? 'cash' :
                  t.type === 'DEPOSIT'      ? 'add-circle' :
                  t.type === 'WITHDRAW'     ? 'remove-circle' :
                  t.type === 'SEND'         ? 'arrow-up' :
                  t.type === 'TRANSFER_OUT' ? 'arrow-up' :
                  t.type === 'RECEIVE'      ? 'arrow-down' :
                  t.type === 'TRANSFER_IN'  ? 'arrow-down' :
                  'swap-horizontal'
                }
                size={16}
                color={p.fg}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                {t.description || prettyTxType(t.type)}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                {new Date(t.createdAt).toLocaleDateString()} · {t.type}
              </Text>
            </View>
            <Text style={{
              color: negative ? p.fg : p.greenFg,
              fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'],
            }}>
              {negative ? '-' : '+'}{formatFiat(abs)} {t.currency}
            </Text>
          </View>
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
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>See all transactions</Text>
        <Ionicons name="chevron-forward" size={14} color={p.fg} />
      </Pressable>
    </View>
  );
}

function prettyTxType(t: string) {
  return t.charAt(0) + t.slice(1).toLowerCase();
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
  // Whichever wallet's QR is currently being shown in the modal.
  const [qrFor, setQrFor] = useState<{ wallet: Wallet; address: string; chain: string } | null>(null);

  if (wallets.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center' }}>
        <Ionicons name="key-outline" size={28} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 12 }}>
          No wallets yet.
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
                  {isCrypto ? `${chain} network` : 'Bank reference'}
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
                  setQrFor({ wallet: w, address: addr, chain: isCrypto ? chain : 'Bank reference' });
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
                Receive {meta.title}
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
              ADDRESS
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
              <Text style={{ color: p.fg, fontWeight: '800', fontSize: 14 }}>Copy</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 24,
                backgroundColor: pressed ? '#000' : p.ctaBg,
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Text style={{ color: p.ctaFg, fontWeight: '800', fontSize: 14 }}>Done</Text>
            </Pressable>
          </View>

          <Text style={{
            color: p.fgFaint, fontSize: 11, fontWeight: '600',
            textAlign: 'center', marginTop: 14,
          }}>
            Send only {wallet.currency} on the {chain} network. Other assets will be lost.
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
  const meta = ASSET_META[wallet.currency] ?? ASSET_META.DEFAULT;
  // Prefer the freshly-computed live value; fall back to the server's
  // snapshot only when CoinGecko hasn't loaded yet.
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
      {/* Icon with minimal spacing */}
      <View style={{ width: 36, alignItems: 'center' }}>
        <CurrencyIcon currency={wallet.currency} palette={p} />
      </View>
      
      {/* Token name and holdings */}
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

      {/* Live sparkline — centered in row */}
      {sparkline && sparkline.length >= 2 && (
        <View style={{ marginHorizontal: 8, opacity: 0.9 }}>
          <Sparkline data={sparkline} width={60} height={28} color={sparkColor} strokeWidth={1.5} />
        </View>
      )}

      {/* Value in USD/base currency */}
      <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
        <Text style={{
          color: p.fg, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'],
        }}>
          ${formatFiat(usd)}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 1 }}>
          {meta.title}
        </Text>
      </View>
    </Pressable>
  );
}

/* ── Wallet row (for Wallets tab) ─── */
function WalletRow({ wallet, palette: p, onPress }: {
  wallet: Wallet;
  palette: Palette;
  onPress?: () => void;
}) {
  const meta = ASSET_META[wallet.currency] ?? ASSET_META.DEFAULT;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: pressed ? p.bgElev : 'transparent',
        borderRadius: 12,
        marginBottom: 4,
      })}
    >
      <CurrencyIcon currency={wallet.currency} palette={p} />
      <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
          {meta.title}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
          {Number(wallet.balance).toLocaleString('en-US', {
            minimumFractionDigits: meta.subDecimals,
            maximumFractionDigits: meta.subDecimals,
          })} {wallet.currency}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{
          color: p.fg, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'],
        }}>
          ${formatFiat(Number(wallet.fiatValueUsd))}
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
