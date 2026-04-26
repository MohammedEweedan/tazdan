/**
 * Top up — fast Apple/Google Pay flow.
 *  - Big amount, fiat picker, quick-amount chips
 *  - Saved cards list with default flag
 *  - "Add new card" pseudo-Apple-Pay button (CTA — actual flow handed to Stripe)
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useHaptics } from '@/hooks';
import type { Currency } from '@/types';
import { CURRENCY_META } from '@/constants';

interface SavedCard { id: string; brand: 'visa' | 'mastercard' | 'amex'; last4: string; default?: boolean }
const SAVED: SavedCard[] = [
  { id: 'c1', brand: 'visa',       last4: '4421', default: true },
  { id: 'c2', brand: 'mastercard', last4: '8821' },
];

export default function Topup() {
  const router = useRouter();
  const h = useHaptics();
  const [amount, setAmount] = useState('100');
  const [fiat, setFiat]     = useState<Currency>('USD');
  const [card, setCard]     = useState<string>(SAVED[0].id);

  const fee = 0; // free for Apple/Google Pay
  const credited = Math.max(0, Number(amount) - fee);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Top up" subtitle="Add money to your wallet" showBack />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>

          {/* Big amount */}
          <View className="items-center mt-4">
            <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>
              YOU TOP UP
            </Text>
            <View className="flex-row items-baseline mt-2" style={{ gap: 4 }}>
              <Text style={{ color: '#4A8FE0', fontSize: 22, fontWeight: '700', alignSelf: 'flex-start', marginTop: 16 }}>
                {CURRENCY_META[fiat].symbol}
              </Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, '') || '0')}
                keyboardType="decimal-pad"
                selectionColor="#4A8FE0"
                style={{
                  color: '#fff', fontSize: 56, fontWeight: '800', letterSpacing: -2,
                  fontVariant: ['tabular-nums'], minWidth: 80, textAlign: 'center',
                }}
              />
            </View>
            <View className="flex-row mt-3" style={{ gap: 6 }}>
              {(['USD', 'EUR', 'GBP', 'AED'] as Currency[]).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => { h.selection(); setFiat(c); }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                    backgroundColor: fiat === c ? '#0057B8' : 'rgba(255,255,255,0.04)',
                    borderWidth: 1, borderColor: fiat === c ? '#0057B8' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text style={{ color: fiat === c ? '#fff' : 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700' }}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Quick amounts */}
          <View className="flex-row mt-7" style={{ gap: 8 }}>
            {['25', '50', '100', '250', '500'].map((v) => (
              <Pressable
                key={v}
                onPress={() => { h.selection(); setAmount(v); }}
                style={{
                  flex: 1, paddingVertical: 11, borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: amount === v ? 'rgba(74,143,224,0.18)' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: amount === v ? '#4A8FE0' : 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ color: amount === v ? '#4A8FE0' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' }}>
                  {CURRENCY_META[fiat].symbol}{v}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Apple / Google */}
          <View className="mt-7" style={{ gap: 10 }}>
            <Pressable
              onPress={() => {
                h.medium();
                Alert.alert('Apple Pay', `Top up ${CURRENCY_META[fiat].symbol}${amount} via Apple Pay?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Confirm', onPress: () => { h.success(); router.back(); } },
                ]);
              }}
            >
              <LinearGradient
                colors={['#000', '#1a1a1a']}
                style={{
                  height: 56, borderRadius: 16,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Pay</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Saved cards */}
          <Text className="text-ink-tertiary text-xs font-semibold mt-7 ml-1" style={{ letterSpacing: 1 }}>
            OR USE A SAVED CARD
          </Text>
          <View className="bg-white/[0.03] rounded-2xl mt-2 border border-white/[0.06]">
            {SAVED.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => { h.selection(); setCard(c.id); }}
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
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="card" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Text className="text-ink-primary text-sm font-semibold">
                      {c.brand === 'visa' ? 'Visa' : c.brand === 'mastercard' ? 'Mastercard' : 'Amex'} •• {c.last4}
                    </Text>
                    {c.default && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(34,197,94,0.16)' }}>
                        <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 }}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-ink-tertiary text-xs mt-0.5">Free on Pro tier</Text>
                </View>
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: 2,
                    borderColor: card === c.id ? '#4A8FE0' : 'rgba(255,255,255,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {card === c.id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A8FE0' }} />}
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => { h.light(); /* TODO: add card flow */ }}
            style={({ pressed }) => ({
              marginTop: 12,
              paddingVertical: 14, borderRadius: 14,
              alignItems: 'center', gap: 6, flexDirection: 'row', justifyContent: 'center',
              backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              borderStyle: 'dashed',
            })}
          >
            <Ionicons name="add" size={16} color="#4A8FE0" />
            <Text className="text-brand-400 text-sm font-bold">Add a new card</Text>
          </Pressable>

          {/* Quote summary */}
          <View className="mt-6 bg-white/[0.03] rounded-2xl p-4 border border-white/[0.06]" style={{ gap: 8 }}>
            <Row k="You credit" v={`${CURRENCY_META[fiat].symbol}${credited.toFixed(2)}`} bold />
            <Row k="Provider fee" v="Free" valueColor="#22c55e" />
            <Row k="Settles" v="Instantly" valueColor="#22c55e" />
          </View>

          <View className="mt-7">
            <Button
              label={`Top up ${CURRENCY_META[fiat].symbol}${amount}`}
              size="lg"
              fullWidth
              onPress={() => {
                if (Number(amount) <= 0) { h.error(); return; }
                h.success();
                Alert.alert('Top-up complete', `${CURRENCY_META[fiat].symbol}${amount} added to your wallet.`, [
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

function Row({ k, v, valueColor = '#fff', bold }: { k: string; v: string; valueColor?: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-ink-tertiary text-sm">{k}</Text>
      <Text style={{ color: valueColor, fontSize: bold ? 15 : 13, fontWeight: bold ? '800' : '600' }}>{v}</Text>
    </View>
  );
}
