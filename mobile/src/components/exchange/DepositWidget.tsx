/**
 * DepositWidget — Top up balance via card. Theme-aware widget for modal use.
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import type { Currency } from '@/types';

const FIATS: Currency[] = ['USD', 'EUR', 'GBP', 'AED'];

export function DepositWidget() {
  const p = useThemedPalette();
  const haptics = useHaptics();
  const user = useAuthStore((s) => s.user);

  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'success'>('idle');
  const v = Number(amount || 0);

  // Get user's base currency for display
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'AED' ? 'د.إ' : '$';

  const onDeposit = () => {
    if (v <= 0) return;
    setCtaState('loading');
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCtaState('success');
      setAmount('');
      Alert.alert(
        'Top-up complete',
        `${v.toFixed(2)} ${currency} has been added to your balance.`,
      );
      setTimeout(() => setCtaState('idle'), 1000);
    }, 1000);
  };

  return (
    <View>
      {/* Currency */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {FIATS.map((c) => (
          <Pressable
            key={c}
            onPress={() => { haptics.selection(); setCurrency(c); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 12, borderRadius: 12,
              backgroundColor: currency === c ? p.fg : p.pillBg,
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
          <Text style={{ color: p.fg, fontSize: 56, fontWeight: '800', letterSpacing: -2 }}>{currencySymbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => {
              // Only allow numbers and single decimal point
              const filtered = t.replace(/[^0-9.]/g, '');
              const parts = filtered.split('.');
              const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered;
              setAmount(clean);
            }}
            placeholder="0"
            placeholderTextColor={p.fgFaint}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
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
            onPress={() => { haptics.selection(); setAmount(String(q)); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 11, borderRadius: 12,
              backgroundColor: pressed ? p.border : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{currencySymbol}{q}</Text>
          </Pressable>
        ))}
      </View>

      {/* Saved card */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 26 }}>
        PAY WITH
      </Text>
      <View style={{
        marginTop: 8, backgroundColor: p.pillBg, borderRadius: 14, borderWidth: 1, borderColor: p.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 12,
            backgroundColor: p.bgElev,
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
      </View>

      {/* CTA */}
      <View style={{ marginTop: 28 }}>
        <Pressable
          onPress={onDeposit}
          disabled={v <= 0 || ctaState === 'loading'}
          style={({ pressed }) => ({
            height: 52, borderRadius: 14,
            backgroundColor: ctaState === 'success' ? p.greenFg : p.ctaBg,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            opacity: pressed || ctaState === 'loading' ? 0.85 : 1,
          })}
        >
          {ctaState === 'loading' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name={ctaState === 'success' ? 'checkmark' : 'add-circle'} size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                {ctaState === 'success' ? 'Added!' : v > 0 ? `Top up ${currencySymbol}${v.toFixed(2)}` : 'Enter amount'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default DepositWidget;
