/**
 * Send money — recipient handle/email + amount + note + confirm.
 * Theme-aware, no NativeWind, every Pressable wired.
 */

import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useWallets } from '@/hooks';
import type { Currency } from '@/types';

const FIATS: Currency[] = ['USD', 'EUR', 'GBP', 'AED', 'LYD'];

export default function Send() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const { data: wallets } = useWallets();

  const [currency, setCurrency] = useState<Currency>('USD');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const wallet = wallets?.find((w) => w.currency === currency);
  const balance = wallet ? Number(wallet.balance) : 0;
  const sendAmount = Number(amount || 0);
  const overspend = sendAmount > balance;
  const valid = recipient.trim().length >= 3 && sendAmount > 0 && !overspend;

  return (
    <ScreenShell title="Send money">
      {/* Recipient */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 12 }}>
        TO
      </Text>
      <View style={{
        marginTop: 8, height: 56, borderRadius: 16,
        backgroundColor: p.bgElev,
        borderWidth: 1, borderColor: p.border,
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        gap: 10,
      }}>
        <Ionicons name="person-outline" size={18} color={p.fgMuted} />
        <TextInput
          value={recipient}
          onChangeText={setRecipient}
          placeholder="@handle, email, or phone"
          placeholderTextColor={p.fgFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '500' }}
        />
      </View>

      {/* Currency picker */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22 }}>
        FROM
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {FIATS.map((c) => (
          <Pressable
            key={c}
            onPress={() => { h.selection(); setCurrency(c); setAmount(''); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 12, borderRadius: 12,
              backgroundColor: currency === c ? p.fg : p.bgElev,
              borderWidth: 1, borderColor: currency === c ? p.fg : p.border,
              opacity: pressed ? 0.85 : 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: currency === c ? p.bg : p.fg, fontWeight: '700', fontSize: 12 }}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 8, marginLeft: 4 }}>
        Available: {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
      </Text>

      {/* Amount */}
      <View style={{ marginTop: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
            AMOUNT
          </Text>
          <Pressable hitSlop={6} onPress={() => { h.selection(); setAmount(String(balance)); }}>
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>USE MAX</Text>
          </Pressable>
        </View>
        <View style={{
          marginTop: 10, height: 64, borderRadius: 16,
          backgroundColor: p.bgElev,
          borderWidth: 1.5, borderColor: overspend ? p.redFg : p.border,
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
        }}>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={p.fgFaint}
            keyboardType="decimal-pad"
            style={{ flex: 1, color: p.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
          />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>{currency}</Text>
        </View>
        {overspend && (
          <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600', marginTop: 8, marginLeft: 4 }}>
            Exceeds balance
          </Text>
        )}
      </View>

      {/* Note */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22 }}>
        NOTE (OPTIONAL)
      </Text>
      <View style={{
        marginTop: 8, minHeight: 56, borderRadius: 16,
        backgroundColor: p.bgElev,
        borderWidth: 1, borderColor: p.border,
        paddingHorizontal: 16, paddingVertical: 12,
      }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What's it for?"
          placeholderTextColor={p.fgFaint}
          style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}
        />
      </View>

      {/* Summary */}
      {valid && (
        <Panel style={{ marginTop: 22 }}>
          <View style={{ padding: 14, gap: 8 }}>
            <Row label="Recipient" value={recipient} palette={p} />
            <Row label="Amount" value={`${sendAmount.toFixed(2)} ${currency}`} palette={p} />
            <Row label="Fee" value="Free" palette={p} accent={p.greenFg} />
          </View>
        </Panel>
      )}

      {/* CTA */}
      <View style={{ marginTop: 24 }}>
        <CTAButton
          label="Send"
          icon="paper-plane"
          disabled={!valid}
          onPress={() => {
            h.success();
            Alert.alert(
              'Sent',
              `${sendAmount.toFixed(2)} ${currency} sent to ${recipient}.`,
              [{ text: 'OK', onPress: () => router.back() }],
            );
          }}
        />
      </View>
    </ScreenShell>
  );
}

function Row({ label, value, accent, palette: p }: { label: string; value: string; accent?: string; palette: ReturnType<typeof useThemedPalette> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <Text style={{ color: accent ?? p.fg, fontSize: 13, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}
