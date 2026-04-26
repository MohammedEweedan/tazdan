/**
 * Wallet detail tab — full breakdown of every wallet held.
 *  - Hero: total value + 24h change
 *  - Tabs: All / Crypto / Fiat (segmented control, NW classes)
 *  - List: each wallet with icon, name, balance, USD value, % change
 *
 * Tapping a row scrolls to a detail bottom sheet (TODO — left as `console.log`
 * placeholder so you can wire BottomSheet later).
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/ui/Sparkline';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { CURRENCY_META } from '@/constants';
import { formatAmount, formatPercent } from '@/utils/format';
import { useWallets, useMarkets, useHaptics } from '@/hooks';
import type { Wallet } from '@/types';

type Filter = 'ALL' | 'CRYPTO' | 'FIAT';

export default function WalletScreen() {
  const h = useHaptics();
  const { data: wallets } = useWallets();
  const { data: markets } = useMarkets();
  const [filter, setFilter] = useState<Filter>('ALL');

  const sparkFor = useMemo(() => {
    const map: Record<string, number[]> = {};
    markets?.forEach((m) => { map[m.base] = m.sparkline; });
    return map;
  }, [markets]);

  const filtered = useMemo(() => {
    if (!wallets) return [] as Wallet[];
    if (filter === 'ALL') return wallets;
    return wallets.filter((w) => CURRENCY_META[w.currency].kind === filter.toLowerCase());
  }, [wallets, filter]);

  const totalUsd = (wallets ?? []).reduce((s, w) => s + Number(w.fiatValueUsd), 0);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Header */}
          <View className="px-5 pt-3 pb-1 flex-row items-center justify-between">
            <Text className="text-ink-primary text-xl font-bold" style={{ letterSpacing: -0.4 }}>
              Wallets
            </Text>
            <Pressable
              hitSlop={8}
              className="w-10 h-10 rounded-full items-center justify-center bg-white/[0.06] border border-white/[0.08]"
            >
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* Hero card */}
          <View className="px-5 mt-4">
            <Card padding={20} radius={24} glow>
              <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1.2 }}>
                NET WORTH
              </Text>
              <AnimatedNumber
                value={totalUsd}
                prefix="$"
                style={{ color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1.2, marginTop: 4 }}
              />
              <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                <View
                  style={{
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                    backgroundColor: 'rgba(34,197,94,0.15)',
                  }}
                >
                  <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>▲ 1.42%</Text>
                </View>
                <Text className="text-ink-tertiary text-xs">vs yesterday</Text>
              </View>
            </Card>
          </View>

          {/* Segmented control */}
          <View className="px-5 mt-6">
            <View
              className="flex-row p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]"
              style={{ gap: 4 }}
            >
              {(['ALL', 'CRYPTO', 'FIAT'] as Filter[]).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => { h.selection(); setFilter(f); }}
                  style={{ flex: 1 }}
                >
                  <View
                    style={{
                      paddingVertical: 10,
                      borderRadius: 14,
                      alignItems: 'center',
                      backgroundColor: filter === f ? '#0057B8' : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: filter === f ? '#fff' : 'rgba(255,255,255,0.55)',
                        fontWeight: '700', fontSize: 13, letterSpacing: 0.5,
                      }}
                    >
                      {f}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Wallet list */}
          <View className="px-5 mt-5">
            {filtered.map((w, i) => {
              const meta = CURRENCY_META[w.currency];
              const positive = (w.changePct24h ?? 0) >= 0;
              return (
                <MotiView
                  key={w.id}
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 320, delay: 30 * i }}
                >
                  <Pressable
                    onPress={() => { h.light(); /* TODO: open detail sheet */ }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      borderRadius: 18,
                      backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.06)',
                      marginBottom: 10,
                    })}
                  >
                    <View
                      style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: 'rgba(74,143,224,0.18)',
                        alignItems: 'center', justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{meta.flagOrIcon}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text className="text-ink-primary text-sm font-semibold">{meta.name}</Text>
                      <Text className="text-ink-tertiary text-xs mt-0.5">
                        {formatAmount(w.balance, w.currency)} {w.currency}
                      </Text>
                    </View>

                    {meta.kind === 'crypto' && sparkFor[w.currency] && (
                      <Sparkline
                        data={sparkFor[w.currency]}
                        width={56}
                        height={20}
                        color={positive ? '#22c55e' : '#ef4444'}
                      />
                    )}

                    <View style={{ alignItems: 'flex-end', marginLeft: 10, minWidth: 80 }}>
                      <Text className="text-ink-primary text-sm font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                        ${Number(w.fiatValueUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </Text>
                      {meta.kind === 'crypto' && w.changePct24h != null && (
                        <Text style={{ color: positive ? '#22c55e' : '#ef4444', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                          {formatPercent(w.changePct24h, { signed: true })}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                </MotiView>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
