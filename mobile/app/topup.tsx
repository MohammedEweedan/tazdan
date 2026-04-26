/**
 * Topup — add money to balance via card. Theme-aware.
 */

import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import type { Currency } from '@/types';

const FIATS: Currency[] = ['USD', 'EUR', 'GBP', 'AED'];

export default function Topup() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();

  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const v = Number(amount || 0);

  return (
    <ScreenShell title="Top up balance">
      {/* Currency */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {FIATS.map((c) => (
          <Pressable
            key={c}
            onPress={() => { h.selection(); setCurrency(c); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 12, borderRadius: 12,
              backgroundColor: currency === c ? p.fg : p.bgElev,
              borderWidth: 1, borderColor: currency === c ? p.fg : p.border,
              opacity: pressed ? 0.85 : 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: currency === c ? p.bg : p.fg, fontWeight: '700', fontSize: 13 }}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Big amount */}
      <View style={{ alignItems: 'center', marginTop: 36, marginBottom: 12 }}>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
          You're adding
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10,
        }}>
          <Text style={{ color: p.fg, fontSize: 56, fontWeight: '800', letterSpacing: -2 }}>$</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            placeholderTextColor={p.fgFaint}
            keyboardType="decimal-pad"
            style={{
              color: p.fg, fontSize: 64, fontWeight: '800',
              letterSpacing: -2, fontVariant: ['tabular-nums'],
              minWidth: 100, textAlign: 'left',
            }}
          />
        </View>
      </View>

      {/* Quick chips */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[25, 50, 100, 250].map((q) => (
          <Pressable
            key={q}
            onPress={() => { h.selection(); setAmount(String(q)); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 11, borderRadius: 12,
              backgroundColor: pressed ? p.border : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>${q}</Text>
          </Pressable>
        ))}
      </View>

      {/* Saved card */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 26 }}>
        PAY WITH
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 12,
            backgroundColor: p.pillBg,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: p.border,
          }}>
            <Ionicons name="card" size={20} color={p.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>•••• 4242</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>Visa</Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={p.greenFg} />
        </View>
      </Panel>

      {/* CTA */}
      <View style={{ marginTop: 28 }}>
        <CTAButton
          label={v > 0 ? `Top up $${v.toFixed(2)}` : 'Enter amount'}
          icon="add-circle"
          disabled={v <= 0}
          onPress={() => {
            h.success();
            Alert.alert(
              'Top-up complete',
              `${v.toFixed(2)} ${currency} has been added to your balance.`,
              [{ text: 'OK', onPress: () => router.back() }],
            );
          }}
        />
      </View>
    </ScreenShell>
  );
}
