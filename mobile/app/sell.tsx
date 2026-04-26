/**
 * Sell crypto — mirror of Buy. Pick coin, enter crypto amount, see fiat
 * payout estimate, choose payout destination (Promrkts wallet / linked bank).
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/ui/Sparkline';
import { useMarkets, useWallets, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { formatPercent, formatAmount } from '@/utils/format';
import type { Currency } from '@/types';

interface Payout { id: string; label: string; tail: string; icon: keyof typeof Ionicons.glyphMap }
const PAYOUTS: Payout[] = [
  { id: 'wallet', label: 'Promrkts Wallet',  tail: 'USD · instant',     icon: 'wallet'  },
  { id: 'bank',   label: 'Bank · IBAN',      tail: '•• 0130 · 1–2 days', icon: 'business' },
];

export default function Sell() {
  const router = useRouter();
  const h = useHaptics();
  const { data: markets } = useMarkets();
  const { data: wallets } = useWallets();

  const [coin, setCoin]       = useState<Currency>('BTC');
  const [amount, setAmount]   = useState('0');
  const [payoutId, setPayout] = useState('wallet');

  const ticker = markets?.find((m) => m.base === coin);
  const wallet = wallets?.find((w) => w.currency === coin);
  const max    = Number(wallet?.balance ?? 0);
  const value  = Number(amount);
  const overspend = value > max;

  const fee  = useMemo(() => value * (ticker?.price ?? 0) * 0.015, [value, ticker]);
  const fiatOut = useMemo(() => Math.max(0, value * (ticker?.price ?? 0) - fee), [value, ticker, fee]);

  const onSubmit = () => {
    if (overspend || value <= 0) { h.error(); return; }
    h.success();
    Alert.alert(
      'Sale confirmed',
      `Selling ${value} ${coin} for $${fiatOut.toFixed(2)}. Funds arrive ${payoutId === 'wallet' ? 'instantly' : 'in 1–2 business days'}.`,
      [{ text: 'Done', onPress: () => router.back() }],
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Sell crypto" subtitle={`Live ${coin} / USDT spot`} showBack />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>

          {/* Coin chips */}
          <View className="flex-row mt-2" style={{ gap: 8, flexWrap: 'wrap' }}>
            {(['BTC', 'ETH', 'SOL', 'BNB'] as Currency[]).map((c) => (
              <Pressable
                key={c}
                onPress={() => { h.selection(); setCoin(c); setAmount('0'); }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
                  backgroundColor: coin === c ? '#9b1d4d' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: coin === c ? '#9b1d4d' : 'rgba(255,255,255,0.08)',
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{CURRENCY_META[c].flagOrIcon}</Text>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{c}</Text>
              </Pressable>
            ))}
          </View>

          {ticker && (
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 360 }}>
              <Card padding={20} radius={24} glow style={{ marginTop: 20 }}>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>
                      {ticker.displayName.toUpperCase()} · USDT
                    </Text>
                    <Text className="text-ink-primary mt-1" style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>
                      ${ticker.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={{
                      color: ticker.changePct24h >= 0 ? '#22c55e' : '#ef4444',
                      fontSize: 12, fontWeight: '700', marginTop: 2,
                    }}>
                      {formatPercent(ticker.changePct24h, { signed: true })} · 24h
                    </Text>
                  </View>
                  <Sparkline data={ticker.sparkline} width={120} height={48} color={ticker.changePct24h >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} />
                </View>
              </Card>
            </MotiView>
          )}

          {/* Amount */}
          <Text className="text-ink-tertiary text-xs font-semibold mt-7 ml-1" style={{ letterSpacing: 1 }}>YOU SELL</Text>
          <View
            className="px-4 mt-2 flex-row items-center"
            style={{
              height: 76, borderRadius: 20,
              backgroundColor: overspend ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
              borderWidth: 1, borderColor: overspend ? '#ef4444' : 'rgba(255,255,255,0.08)',
              gap: 10,
            }}
          >
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, '') || '0')}
              keyboardType="decimal-pad"
              selectionColor="#4A8FE0"
              style={{
                flex: 1, color: overspend ? '#ef4444' : '#fff',
                fontSize: 36, fontWeight: '800', letterSpacing: -1,
                fontVariant: ['tabular-nums'],
              }}
            />
            <Pressable
              onPress={() => { h.selection(); setAmount(String(max)); }}
              hitSlop={6}
              className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]"
            >
              <Text className="text-ink-secondary text-xs font-bold">MAX · {coin}</Text>
            </Pressable>
          </View>
          <Text className={overspend ? 'text-danger text-xs mt-2 ml-1 font-semibold' : 'text-ink-tertiary text-xs mt-2 ml-1'}>
            {overspend
              ? `Exceeds available balance (${formatAmount(max, coin)} ${coin})`
              : `Available · ${formatAmount(max, coin)} ${coin}`}
          </Text>

          {/* Quote */}
          <View className="mt-5 bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]" style={{ gap: 8 }}>
            <RowKV k="You receive"  v={`≈ $${fiatOut.toFixed(2)}`} bold />
            <RowKV k="Rate"         v={`1 ${coin} ≈ $${ticker?.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—'}`} />
            <RowKV k="Provider fee" v={`$${fee.toFixed(2)}`} />
            <RowKV k="Settles"      v={payoutId === 'wallet' ? 'Instantly' : 'In 1–2 business days'} valueColor="#22c55e" />
          </View>

          {/* Payout */}
          <Text className="text-ink-tertiary text-xs font-semibold mt-7 ml-1" style={{ letterSpacing: 1 }}>SEND TO</Text>
          <View className="bg-white/[0.03] rounded-2xl mt-2 border border-white/[0.06]">
            {PAYOUTS.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => { h.selection(); setPayout(p.id); }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center',
                  padding: 14, gap: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <View
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: payoutId === p.id ? 'rgba(74,143,224,0.22)' : 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name={p.icon} size={18} color={payoutId === p.id ? '#4A8FE0' : 'rgba(255,255,255,0.6)'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-ink-primary text-sm font-semibold">{p.label}</Text>
                  <Text className="text-ink-tertiary text-xs mt-0.5">{p.tail}</Text>
                </View>
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: 2,
                    borderColor: payoutId === p.id ? '#4A8FE0' : 'rgba(255,255,255,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {payoutId === p.id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A8FE0' }} />}
                </View>
              </Pressable>
            ))}
          </View>

          <View className="mt-7">
            <Button
              label={`Sell ${coin}`}
              size="lg"
              fullWidth
              onPress={onSubmit}
              disabled={overspend || value <= 0}
              haptic="medium"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function RowKV({ k, v, valueColor = '#fff', bold }: { k: string; v: string; valueColor?: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-ink-tertiary text-sm">{k}</Text>
      <Text style={{ color: valueColor, fontSize: bold ? 15 : 13, fontWeight: bold ? '800' : '600' }}>{v}</Text>
    </View>
  );
}
