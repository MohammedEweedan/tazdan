/**
 * Home dashboard — flagship screen.
 *
 *   1. Greeting + avatar + bell
 *   2. Total balance with animated tick + 24h change pill + visibility toggle
 *   3. Quick actions (Send / Receive / Buy / Top up)
 *   4. Wallet cards horizontal slider (paged, snap)
 *   5. Markets preview (top 5 with sparklines, link to full screen)
 *   6. Recent transactions (last 6, link to full history)
 */

import { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Avatar } from '@/components/ui/Avatar';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { WalletCard } from '@/components/wallet/WalletCard';
import { QuickActions } from '@/components/wallet/QuickActions';
import { TransactionItem } from '@/components/transactions/TransactionItem';
import { MarketRow } from '@/components/markets/MarketRow';
import { useAuthStore } from '@/store/authStore';
import { useWallets, useTransactions, useMarkets, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 56;   // 24px page padding + 16px peek of next card

export default function Home() {
  const router = useRouter();
  const h = useHaptics();
  const user = useAuthStore((s) => s.user);
  const { data: wallets } = useWallets();
  const { data: txData }  = useTransactions(1);
  const { data: markets } = useMarkets();
  const [hidden, setHidden] = useState(false);

  // Find a sparkline that matches the wallet currency (for crypto cards).
  const sparkFor = useMemo(() => {
    const map: Record<string, number[]> = {};
    markets?.forEach((m) => { map[m.base] = m.sparkline; });
    return map;
  }, [markets]);

  const totalUsd = useMemo(
    () => (wallets ?? []).reduce((sum, w) => sum + Number(w.fiatValueUsd), 0),
    [wallets],
  );
  // Aggregate 24h change weighted by fiat value (for crypto only)
  const change24h = useMemo(() => {
    if (!wallets) return 0;
    const cryptos = wallets.filter((w) => CURRENCY_META[w.currency].kind === 'crypto');
    const totalCrypto = cryptos.reduce((s, w) => s + Number(w.fiatValueUsd), 0);
    if (totalCrypto === 0) return 0;
    return cryptos.reduce((acc, w) => acc + (w.changePct24h ?? 0) * (Number(w.fiatValueUsd) / totalCrypto), 0);
  }, [wallets]);
  const positive = change24h >= 0;

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* ── Header ───────────────────────────────────────── */}
          <View className="px-5 pt-2 pb-1 flex-row items-center justify-between">
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <Avatar name={`${user?.firstName ?? 'P'} ${user?.lastName ?? ''}`} size={42} />
              <View>
                <Text className="text-ink-tertiary text-xs font-medium">Welcome back</Text>
                <Text className="text-ink-primary text-base font-bold" style={{ letterSpacing: -0.2 }}>
                  {user?.firstName ?? 'Trader'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <HeaderIcon icon="search-outline" onPress={() => router.push('/history')} />
              <HeaderIcon icon="notifications-outline" onPress={() => router.push('/notifications')} dot />
            </View>
          </View>

          {/* ── Total balance ────────────────────────────────── */}
          <View className="px-5 pt-7 pb-5">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1.2 }}>
                TOTAL BALANCE
              </Text>
              <Pressable onPress={() => { h.selection(); setHidden((s) => !s); }} hitSlop={8}>
                <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={14} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <View className="flex-row items-baseline mt-2" style={{ gap: 8 }}>
              {hidden ? (
                <Text className="text-ink-primary" style={{ fontSize: 44, fontWeight: '800', letterSpacing: -1.4 }}>
                  • • • • • •
                </Text>
              ) : (
                <AnimatedNumber
                  value={totalUsd}
                  prefix="$"
                  decimals={2}
                  style={{ color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: -1.4 }}
                />
              )}
              <View
                style={{
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: positive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                }}
              >
                <Text style={{ color: positive ? '#22c55e' : '#ef4444', fontSize: 12, fontWeight: '700' }}>
                  {positive ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
                </Text>
              </View>
            </View>
            <Text className="text-ink-tertiary text-xs mt-1">Across {wallets?.length ?? 0} wallets · 24h</Text>
          </View>

          {/* ── Quick actions ────────────────────────────────── */}
          <View className="px-5">
            <QuickActions />
          </View>

          {/* ── Wallet cards slider ──────────────────────────── */}
          <View className="mt-7">
            <View className="px-5 flex-row items-center justify-between mb-3">
              <Text className="text-ink-primary text-base font-bold">Wallets</Text>
              <Pressable onPress={() => router.push('/(tabs)/wallet')} hitSlop={8}>
                <Text className="text-brand-400 text-sm font-semibold">See all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + 14}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {(wallets ?? []).map((w, i) => (
                <MotiView
                  key={w.id}
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 360, delay: 60 * i }}
                >
                  <WalletCard
                    wallet={w}
                    width={CARD_W}
                    sparkline={CURRENCY_META[w.currency].kind === 'crypto' ? sparkFor[w.currency] : undefined}
                    onPress={() => router.push('/(tabs)/wallet')}
                  />
                </MotiView>
              ))}
            </ScrollView>
          </View>

          {/* ── Markets preview ──────────────────────────────── */}
          <View className="mt-8 px-5">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="text-ink-primary text-base font-bold">Markets</Text>
                <View className="flex-row items-center" style={{ gap: 5 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                  <Text className="text-ink-tertiary text-xs font-medium">Live</Text>
                </View>
              </View>
              <Pressable hitSlop={8}>
                <Text className="text-brand-400 text-sm font-semibold">Markets</Text>
              </Pressable>
            </View>
            <View className="bg-white/[0.03] rounded-2xl px-3 mt-2 border border-white/[0.06]">
              {(markets ?? []).slice(0, 5).map((m, i) => (
                <View key={m.symbol} style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <MarketRow ticker={m} />
                </View>
              ))}
            </View>
          </View>

          {/* ── Recent transactions ──────────────────────────── */}
          <View className="mt-8 px-5">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-ink-primary text-base font-bold">Recent activity</Text>
              <Pressable onPress={() => router.push('/history')} hitSlop={8}>
                <Text className="text-brand-400 text-sm font-semibold">View all</Text>
              </Pressable>
            </View>
            <View className="bg-white/[0.03] rounded-2xl px-3 mt-2 border border-white/[0.06]">
              {!txData ? (
                <View>
                  <SkeletonRow /><SkeletonRow /><SkeletonRow />
                </View>
              ) : (
                txData.items.slice(0, 6).map((tx, i) => (
                  <View key={tx.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                    <TransactionItem tx={tx} />
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────
function HeaderIcon({ icon, onPress, dot }: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  dot?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="w-10 h-10 rounded-full items-center justify-center bg-white/[0.06] border border-white/[0.08]"
    >
      <Ionicons name={icon} size={19} color="#fff" />
      {dot && (
        <View
          style={{
            position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4,
            backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#070d22',
          }}
        />
      )}
    </Pressable>
  );
}
