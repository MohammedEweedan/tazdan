/**
 * Transfer — convert between two of your wallets. Theme-aware.
 * Priced by the server's executable rates (GET /wallets/swap/quote); the
 * conversion itself re-prices and refuses to fill below the amount shown.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useWallets, extractErrorMessage } from '@/hooks';
import { api } from '@/lib/api';
import { swapService } from '@/services';
import { QUERY_KEYS } from '@/constants';
import type { Currency } from '@/types';

const PICKABLE: Currency[] = ['USDT', 'BTC', 'ETH', 'USD', 'EUR', 'AED'];

export default function Transfer() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const { data: wallets } = useWallets();

  const [from, setFrom] = useState<Currency>('USD');
  const [to, setTo] = useState<Currency>('BTC');
  const [amount, setAmount] = useState('');

  const qc = useQueryClient();
  const fromWallet = wallets?.find((w) => w.currency === from);
  const balance = fromWallet ? Number(fromWallet.balance) - Number(fromWallet.frozen ?? 0) : 0;
  const v = Number(amount || 0);
  const overspend = v > balance;

  // Live, indicative quote — debounced so typing doesn't hammer the API.
  const [debounced, setDebounced] = useState(0);
  useEffect(() => { const t = setTimeout(() => setDebounced(v), 350); return () => clearTimeout(t); }, [v]);
  const quoteQ = useQuery({
    queryKey: ['swap-quote', from, to, debounced],
    queryFn: async () => (await api.get('/wallets/swap/quote', { params: { from, to, amount: debounced } })).data.quote as { credited: string; rate: string },
    enabled: debounced > 0 && from !== to,
    refetchInterval: 15_000,
    retry: false,
  });
  const quote = quoteQ.data && debounced === v ? quoteQ.data : null;
  const rate = quote ? Number(quote.rate) : null;
  const youGet = quote ? Number(quote.credited) : null;

  const convert = useMutation({
    // Allow 0.5% movement between the quote shown and execution; beyond that the server refuses.
    mutationFn: () => swapService.swap({ from, to, amount: v, minCredited: (youGet! * 0.995).toFixed(8) }),
    onSuccess: (r) => {
      h.success();
      qc.invalidateQueries({ queryKey: QUERY_KEYS.wallets });
      Alert.alert('Converted', `${v} ${from} → ${Number(r.credited).toLocaleString('en-US', { maximumFractionDigits: 8 })} ${to}`, [{ text: 'OK', onPress: () => router.back() }]);
    },
    onError: (e: any) => {
      h.error();
      if (e?.response?.status === 409) void quoteQ.refetch();
      Alert.alert('Conversion failed', extractErrorMessage(e, 'Please try again.'));
    },
  });

  const swap = () => { h.medium(); setFrom(to); setTo(from); setAmount(''); };

  return (
    <ScreenShell closeOnly title="Convert">
      {/* From */}
      <CurrencySelector
        title="FROM"
        currency={from}
        palette={p}
        balance={balance}
        onPick={(c) => { h.selection(); setFrom(c); setAmount(''); }}
      />

      {/* Swap button */}
      <Pressable
        onPress={swap}
        style={({ pressed }) => ({
          alignSelf: 'center', marginTop: 14, marginBottom: 14,
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: pressed ? p.border : p.pillBg,
          borderWidth: 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center',
        })}
      >
        <Ionicons name="swap-vertical" size={20} color={p.fg} />
      </Pressable>

      {/* To */}
      <CurrencySelector
        title="TO"
        currency={to}
        palette={p}
        onPick={(c) => { h.selection(); setTo(c); }}
      />

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
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>{from}</Text>
        </View>
      </View>

      {/* Quote */}
      <Panel style={{ marginTop: 22, padding: 14 }}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>Rate</Text>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>
              {rate !== null ? `1 ${from} ≈ ${rate.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${to}` : quoteQ.isError ? 'Unavailable' : v > 0 ? '…' : '—'}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: p.border, marginVertical: 4 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>You receive</Text>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>
              {youGet !== null ? `${youGet.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${to}` : '—'}
            </Text>
          </View>
        </View>
      </Panel>

      {/* CTA */}
      <View style={{ marginTop: 24 }}>
        <CTAButton
          label="Convert"
          icon="swap-horizontal"
          disabled={v <= 0 || overspend || from === to || youGet === null || convert.isPending}
          onPress={() => convert.mutate()}
        />
      </View>
    </ScreenShell>
  );
}

function CurrencySelector({
  title, currency, balance, onPick, palette: p,
}: {
  title: string;
  currency: Currency;
  balance?: number;
  onPick: (c: Currency) => void;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
          {title}
        </Text>
        {balance !== undefined && (
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>
            Avail: {balance.toLocaleString('en-US', { maximumFractionDigits: 4 })} {currency}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {PICKABLE.map((c) => (
          <Pressable
            key={c}
            onPress={() => onPick(c)}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 11, borderRadius: 11,
              backgroundColor: currency === c ? p.accent : p.bgElev,
              borderWidth: 1, borderColor: currency === c ? p.accent : p.border,
              opacity: pressed ? 0.85 : 1,
              alignItems: 'center',
            })}
          >
            <Text style={{
              color: currency === c ? p.accentFg : p.fg,
              fontWeight: '700', fontSize: 11,
            }}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
