/**
 * Sell crypto — mirror of Buy but in reverse. Theme-aware.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useMarkets, useWallets } from '@/hooks';
import type { Currency } from '@/types';

const COINS: Currency[] = ['BTC', 'ETH', 'USDT', 'SOL'];

export default function Sell() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const { data: tickers } = useMarkets();
  const { data: wallets } = useWallets();

  const [coin, setCoin] = useState<Currency>('BTC');
  const [amount, setAmount] = useState('');

  const ticker = useMemo(
    () => tickers?.find((t) => t.base === coin) ?? null,
    [tickers, coin],
  );
  const wallet = wallets?.find((w) => w.currency === coin);
  const balance = wallet ? Number(wallet.balance) : 0;
  const spot = ticker ? Number(ticker.price) : 0;
  const cryptoAmount = Number(amount || 0);
  const usdAmount = cryptoAmount * spot;
  const overspend = cryptoAmount > balance;

  return (
    <ScreenShell title="Sell crypto">
      {/* Coin chooser */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {COINS.map((c) => (
          <Pressable
            key={c}
            onPress={() => { h.selection(); setCoin(c); setAmount(''); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 12, borderRadius: 14,
              backgroundColor: coin === c ? p.fg : p.bgElev,
              borderWidth: 1, borderColor: coin === c ? p.fg : p.border,
              opacity: pressed ? 0.85 : 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: coin === c ? p.bg : p.fg, fontWeight: '700', fontSize: 13 }}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Spot card */}
      <Panel style={{ marginTop: 18, padding: 18 }}>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>1 {coin} =</Text>
        <Text style={{
          color: p.fg, fontSize: 26, fontWeight: '800',
          letterSpacing: -0.7, marginTop: 4, fontVariant: ['tabular-nums'],
        }}>
          ${spot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 6 }}>
          Available: {balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} {coin}
        </Text>
      </Panel>

      {/* Amount input */}
      <View style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
            AMOUNT ({coin})
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
            style={{
              flex: 1, color: p.fg, fontSize: 28, fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}
          />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>{coin}</Text>
        </View>
        <Text style={{
          color: overspend ? p.redFg : p.fgMuted,
          fontSize: 13, fontWeight: '600', marginTop: 8, marginLeft: 4,
        }}>
          {overspend
            ? `Exceeds balance by ${(cryptoAmount - balance).toFixed(8)} ${coin}`
            : `≈ $${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </Text>
      </View>

      {/* CTA */}
      <View style={{ marginTop: 28 }}>
        <CTAButton
          label={`Sell ${coin}`}
          icon="cash-outline"
          disabled={cryptoAmount <= 0 || overspend}
          onPress={() => {
            h.success();
            Alert.alert(
              'Order confirmed',
              `Sold ${cryptoAmount.toFixed(8)} ${coin} for $${usdAmount.toFixed(2)}.`,
              [{ text: 'OK', onPress: () => router.back() }],
            );
          }}
        />
      </View>
    </ScreenShell>
  );
}
