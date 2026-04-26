/**
 * Internal wallet → wallet transfer (e.g. USDT → BTC at live spot price).
 * Displays a "from" + "to" pair with a swap arrow. Zero fee.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { useWallets, useMarkets, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { formatAmount } from '@/utils/format';
import type { Currency } from '@/types';

export default function Transfer() {
  const router = useRouter();
  const h = useHaptics();
  const { data: wallets } = useWallets();
  const { data: markets } = useMarkets();

  const [from, setFrom]     = useState<Currency>('USDT');
  const [to, setTo]         = useState<Currency>('BTC');
  const [amount, setAmount] = useState('100');

  const fromBalance = Number(wallets?.find((w) => w.currency === from)?.balance ?? 0);
  const overspend   = Number(amount) > fromBalance;

  const fromUsd = (CURRENCY_META[from].kind === 'crypto'
    ? markets?.find((m) => m.base === from)?.price ?? 1
    : 1);
  const toUsd = (CURRENCY_META[to].kind === 'crypto'
    ? markets?.find((m) => m.base === to)?.price ?? 1
    : 1);
  const received = useMemo(() => (Number(amount) * fromUsd) / toUsd, [amount, fromUsd, toUsd]);

  const swap = () => { h.medium(); setFrom(to); setTo(from); setAmount('0'); };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Convert" subtitle="Wallet ↔ Wallet · zero fee" showBack />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>

          {/* From */}
          <View style={{ ...box, marginTop: 16 }}>
            <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>FROM</Text>
            <View className="flex-row items-center mt-2" style={{ gap: 12 }}>
              <CurrencyTab value={from} onChange={setFrom} />
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, '') || '0')}
                keyboardType="decimal-pad"
                selectionColor="#4A8FE0"
                style={{
                  flex: 1, color: overspend ? '#ef4444' : '#fff',
                  fontSize: 32, fontWeight: '800', letterSpacing: -0.8,
                  textAlign: 'right',
                  fontVariant: ['tabular-nums'],
                }}
              />
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-ink-tertiary text-xs">
                Balance · {formatAmount(fromBalance, from)} {from}
              </Text>
              <Pressable onPress={() => { h.selection(); setAmount(String(fromBalance)); }} hitSlop={6}>
                <Text className="text-brand-400 text-xs font-bold">MAX</Text>
              </Pressable>
            </View>
          </View>

          {/* Swap arrow */}
          <View className="items-center" style={{ marginTop: -10, marginBottom: -10, zIndex: 2 }}>
            <Pressable
              onPress={swap}
              hitSlop={8}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#0c1430',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="swap-vertical" size={20} color="#4A8FE0" />
            </Pressable>
          </View>

          {/* To */}
          <View style={box}>
            <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>TO</Text>
            <View className="flex-row items-center mt-2" style={{ gap: 12 }}>
              <CurrencyTab value={to} onChange={setTo} />
              <Text
                style={{
                  flex: 1, color: '#fff',
                  fontSize: 32, fontWeight: '800', letterSpacing: -0.8,
                  textAlign: 'right',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {received.toFixed(CURRENCY_META[to].kind === 'crypto' ? 6 : 2)}
              </Text>
            </View>
            <Text className="text-ink-tertiary text-xs mt-2">
              1 {from} ≈ {(fromUsd / toUsd).toFixed(6)} {to}
            </Text>
          </View>

          <View className="mt-7">
            <Button
              label={`Convert ${amount} ${from}`}
              size="lg" fullWidth
              disabled={overspend || Number(amount) <= 0}
              onPress={() => {
                h.success();
                Alert.alert('Converted', `Received ${received.toFixed(6)} ${to}.`, [
                  { text: 'Done', onPress: () => router.back() },
                ]);
              }}
              haptic="medium"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function CurrencyTab({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  const h = useHaptics();
  const opts: Currency[] = ['USDT', 'BTC', 'ETH', 'SOL', 'USD', 'EUR', 'AED'];
  return (
    <Pressable
      onPress={() => {
        h.selection();
        const idx = opts.indexOf(value);
        onChange(opts[(idx + 1) % opts.length]);
      }}
      style={{
        paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 14 }}>{CURRENCY_META[value].flagOrIcon}</Text>
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{value}</Text>
      <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.5)" />
    </Pressable>
  );
}

const box = {
  padding: 18, borderRadius: 22,
  backgroundColor: 'rgba(255,255,255,0.04)',
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
} as const;
