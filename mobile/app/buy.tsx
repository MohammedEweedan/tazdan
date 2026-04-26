/**
 * Buy crypto.
 *  - Coin selector chips (BTC / ETH / SOL / BNB / USDT)
 *  - Live spot card (selected coin) with sparkline + 24h change
 *  - Large fiat amount input with "You receive" preview + fee breakdown
 *  - Payment method picker (Apple Pay / Google Pay / Visa / Bank)
 *  - CTA: "Buy {AMT} {COIN}" → success alert
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
import { useMarkets, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { formatPercent } from '@/utils/format';
import type { Currency } from '@/types';

interface PayMethod { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; tail?: string }
const METHODS: PayMethod[] = [
  { id: 'apple',    label: 'Apple Pay',     icon: 'logo-apple' },
  { id: 'google',   label: 'Google Pay',    icon: 'logo-google' },
  { id: 'visa',     label: 'Visa •• 4421',  icon: 'card',         tail: 'default' },
  { id: 'sepa',     label: 'Bank transfer', icon: 'business',     tail: 'free' },
];

export default function Buy() {
  const router = useRouter();
  const h = useHaptics();
  const { data: markets } = useMarkets();

  const [coin, setCoin]       = useState<Currency>('BTC');
  const [fiatAmount, setFiat] = useState('100');
  const [methodId, setMethod] = useState<string>('apple');

  const ticker = markets?.find((m) => m.base === coin);

  const fee = useMemo(() => Number(fiatAmount) * 0.029 + 0.30, [fiatAmount]);
  const cryptoOut = useMemo(() => {
    if (!ticker) return 0;
    return Math.max(0, (Number(fiatAmount) - fee) / ticker.price);
  }, [fiatAmount, fee, ticker]);

  const onSubmit = () => {
    if (Number(fiatAmount) <= 0) { h.error(); return; }
    h.success();
    Alert.alert(
      'Order placed',
      `Buying ${cryptoOut.toFixed(8)} ${coin} for $${fiatAmount}.\nFunds will appear in your wallet within seconds.`,
      [{ text: 'Done', onPress: () => router.back() }],
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Buy crypto" subtitle="Quote refreshes every 30s" showBack />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>

          {/* Coin chips */}
          <View className="flex-row mt-2" style={{ gap: 8, flexWrap: 'wrap' }}>
            {(['BTC', 'ETH', 'SOL', 'BNB', 'USDT'] as Currency[]).map((c) => (
              <Pressable
                key={c}
                onPress={() => { h.selection(); setCoin(c); }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
                  backgroundColor: coin === c ? '#0057B8' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: coin === c ? '#0057B8' : 'rgba(255,255,255,0.08)',
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{CURRENCY_META[c].flagOrIcon}</Text>
                <Text style={{ color: coin === c ? '#fff' : 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '700' }}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Live spot card */}
          {ticker && (
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 360 }}>
              <Card padding={20} radius={24} glow style={{ marginTop: 20 }}>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>
                      {ticker.displayName.toUpperCase()} · USDT
                    </Text>
                    <Text className="text-ink-primary mt-1" style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>
                      ${ticker.price.toLocaleString('en-US', { maximumFractionDigits: ticker.price < 1 ? 4 : 2 })}
                    </Text>
                    <Text style={{
                      color: ticker.changePct24h >= 0 ? '#22c55e' : '#ef4444',
                      fontSize: 12, fontWeight: '700', marginTop: 2,
                    }}>
                      {formatPercent(ticker.changePct24h, { signed: true })} · 24h
                    </Text>
                  </View>
                  <Sparkline
                    data={ticker.sparkline}
                    width={120} height={48}
                    color={ticker.changePct24h >= 0 ? '#22c55e' : '#ef4444'}
                    strokeWidth={2}
                  />
                </View>
              </Card>
            </MotiView>
          )}

          {/* Amount input */}
          <Text className="text-ink-tertiary text-xs font-semibold mt-7 ml-1" style={{ letterSpacing: 1 }}>YOU PAY</Text>
          <View
            className="px-4 mt-2 flex-row items-center"
            style={{
              height: 76, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              gap: 10,
            }}
          >
            <Text style={{ color: '#4A8FE0', fontSize: 32, fontWeight: '700' }}>$</Text>
            <TextInput
              value={fiatAmount}
              onChangeText={(t) => setFiat(t.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholderTextColor="rgba(255,255,255,0.3)"
              selectionColor="#4A8FE0"
              style={{
                flex: 1, color: '#fff',
                fontSize: 36, fontWeight: '800', letterSpacing: -1,
                fontVariant: ['tabular-nums'],
              }}
            />
            <View className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
              <Text className="text-ink-secondary text-xs font-bold">USD</Text>
            </View>
          </View>

          {/* Quote summary */}
          <View className="mt-4 bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]" style={{ gap: 8 }}>
            <RowKV k="You receive"      v={`≈ ${cryptoOut.toFixed(coin === 'USDT' ? 2 : 8)} ${coin}`} bold />
            <RowKV k="Rate"             v={`1 ${coin} ≈ $${ticker?.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—'}`} />
            <RowKV k="Provider fee"     v={`$${fee.toFixed(2)}`} />
            <RowKV k="Estimated arrival" v="Instant" valueColor="#22c55e" />
          </View>

          {/* Quick amount chips */}
          <View className="flex-row mt-4" style={{ gap: 8 }}>
            {['50', '100', '250', '500', '1000'].map((v) => (
              <Pressable
                key={v}
                onPress={() => { h.selection(); setFiat(v); }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: fiatAmount === v ? 'rgba(74,143,224,0.18)' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: fiatAmount === v ? '#4A8FE0' : 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ color: fiatAmount === v ? '#4A8FE0' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' }}>
                  ${v}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Payment method */}
          <Text className="text-ink-tertiary text-xs font-semibold mt-7 ml-1" style={{ letterSpacing: 1 }}>
            PAY WITH
          </Text>
          <View className="bg-white/[0.03] rounded-2xl mt-2 border border-white/[0.06]">
            {METHODS.map((m, i) => (
              <Pressable
                key={m.id}
                onPress={() => { h.selection(); setMethod(m.id); }}
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
                    backgroundColor: methodId === m.id ? 'rgba(74,143,224,0.22)' : 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name={m.icon} size={18} color={methodId === m.id ? '#4A8FE0' : 'rgba(255,255,255,0.6)'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-ink-primary text-sm font-semibold">{m.label}</Text>
                  {m.tail && <Text className="text-ink-tertiary text-xs mt-0.5">{m.tail}</Text>}
                </View>
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: 2,
                    borderColor: methodId === m.id ? '#4A8FE0' : 'rgba(255,255,255,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {methodId === m.id && (
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A8FE0' }} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          {/* CTA */}
          <View className="mt-7">
            <Button
              label={`Buy ${coin}`}
              size="lg"
              fullWidth
              onPress={onSubmit}
              haptic="medium"
              iconRight={<Ionicons name="arrow-forward" size={18} color="#fff" />}
            />
            <Text className="text-ink-muted text-xs text-center mt-3">
              Quote valid for 30s. Settled by promrkts via MoonPay.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function RowKV({ k, v, valueColor = '#fff', bold }: {
  k: string; v: string; valueColor?: string; bold?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-ink-tertiary text-sm">{k}</Text>
      <Text style={{ color: valueColor, fontSize: bold ? 15 : 13, fontWeight: bold ? '800' : '600' }}>{v}</Text>
    </View>
  );
}
