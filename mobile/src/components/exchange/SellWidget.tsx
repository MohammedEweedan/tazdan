/**
 * SellWidget — Trust Wallet-style sell sheet.
 * Asset chip row · large amount input · live USD value · full-width CTA.
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics, useMarkets, useSwap, useWallets, extractErrorMessage } from '@/hooks';
import type { Currency } from '@/types';

const COINS: Currency[] = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];

const ASSET_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  BTC:  { label: 'Bitcoin',   color: '#fb923c', bg: 'rgba(251,146,60,0.14)',  icon: '₿' },
  ETH:  { label: 'Ethereum',  color: '#818cf8', bg: 'rgba(129,140,248,0.14)', icon: 'Ξ' },
  SOL:  { label: 'Solana',    color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', icon: '◎' },
  USDT: { label: 'Tether',    color: '#4ade80', bg: 'rgba(74,222,128,0.14)',  icon: '₮' },
  BNB:  { label: 'BNB',       color: '#f3ba2f', bg: 'rgba(243,186,47,0.14)',  icon: 'B' },
  XRP:  { label: 'XRP',       color: '#7eb8f7', bg: 'rgba(126,184,247,0.14)', icon: '✕' },
  ADA:  { label: 'Cardano',   color: '#3b82f6', bg: 'rgba(59,130,246,0.14)',  icon: '₳' },
  DOGE: { label: 'Dogecoin',  color: '#c3a634', bg: 'rgba(195,166,52,0.14)',  icon: 'Ð' },
  MATIC:{ label: 'Polygon',   color: '#8247e5', bg: 'rgba(130,71,229,0.14)',  icon: '◆' },
  DOT:  { label: 'Polkadot',  color: '#e6007a', bg: 'rgba(230,0,122,0.14)',   icon: '●' },
  AVAX: { label: 'Avalanche', color: '#e84142', bg: 'rgba(232,65,66,0.14)',   icon: '▲' },
};

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
function sym(c: string) { return CURRENCY_SYMBOLS[c] ?? c; }

export function SellWidget() {
  const p = useThemedPalette();
  const haptics = useHaptics();
  const user = useAuthStore((s) => s.user);
  const { data: tickers } = useMarkets();
  const { data: wallets } = useWallets();
  const swap = useSwap();
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';
  const currSym = sym(baseCurrency);

  const [coin, setCoin]       = useState<Currency>('BTC');
  const [amount, setAmount]   = useState('');
  const [ctaState, setCta]    = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError, setCtaErr] = useState<string | null>(null);

  // Only show coins that exist in the user's wallets with balance, fallback to full list
  const availableCoins = useMemo(() => {
    if (!wallets) return COINS;
    const withBalance = wallets.filter((w) => Number(w.balance) > 0).map((w) => w.currency as Currency);
    const filtered = COINS.filter((c) => withBalance.includes(c));
    return filtered.length > 0 ? filtered : COINS;
  }, [wallets]);

  const ticker  = tickers?.find((t) => t.base === coin) ?? null;
  const wallet  = wallets?.find((w) => w.currency === coin);
  const balance = wallet ? Number(wallet.balance) : 0;
  const spot    = ticker ? Number(ticker.price) : 0;
  const meta    = ASSET_META[coin] ?? ASSET_META.BTC;
  const cryptoAmt = Number(amount || 0);
  const fiatValue = cryptoAmt * spot;
  const overspend = cryptoAmt > balance;

  const change24h = ticker?.changePct24h ?? 0;
  const changePos = change24h >= 0;

  const onSell = async () => {
    if (cryptoAmt <= 0 || overspend) return;
    setCta('loading'); setCtaErr(null);
    try {
      await swap.mutateAsync({ from: coin, to: 'USD', amount: cryptoAmt });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCta('success');
      setAmount('');
      setTimeout(() => setCta('idle'), 2000);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCtaErr(extractErrorMessage(e, 'Order failed'));
      setCta('error');
      setTimeout(() => setCta('idle'), 2000);
    }
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Coin selector chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
        {availableCoins.map((c) => {
          const m = ASSET_META[c];
          const active = coin === c;
          return (
            <Pressable
              key={c}
              onPress={() => { haptics.selection(); setCoin(c); setAmount(''); setCta('idle'); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24,
                backgroundColor: active ? p.fg : p.bgElev,
                borderWidth: 1, borderColor: active ? p.fg : p.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: active ? 'rgba(255,255,255,0.15)' : m.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: active ? p.bg : m.color, fontSize: 13, fontWeight: '800' }}>{m.icon}</Text>
              </View>
              <Text style={{ color: active ? p.bg : p.fg, fontSize: 13, fontWeight: '800' }}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Price info card ── */}
      <View style={{
        backgroundColor: p.bgElev, borderRadius: 18, borderWidth: 1, borderColor: p.border,
        padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center',
      }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
          <Text style={{ color: meta.color, fontSize: 20, fontWeight: '700' }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fg, fontSize: 16, fontWeight: '800' }}>{meta.label}</Text>
          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>{coin}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            {currSym}{spot > 0 ? spot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </Text>
          {change24h !== 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <Ionicons name={changePos ? 'trending-up' : 'trending-down'} size={12} color={changePos ? p.greenFg : p.redFg} />
              <Text style={{ color: changePos ? p.greenFg : p.redFg, fontSize: 12, fontWeight: '700' }}>
                {changePos ? '+' : ''}{change24h.toFixed(2)}%
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Amount input ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>YOU SELL ({coin})</Text>
        <Pressable onPress={() => { haptics.selection(); setAmount(String(balance)); }} hitSlop={8}>
          <Text style={{ color: p.ctaBg, fontSize: 12, fontWeight: '800' }}>USE MAX</Text>
        </Pressable>
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 18,
        borderWidth: 1.5, borderColor: overspend ? p.redFg : p.border,
        paddingHorizontal: 18, marginBottom: 8,
      }}>
        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
          placeholder="0.00"
          placeholderTextColor={p.fgFaint}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={{ flex: 1, color: p.fg, fontSize: 34, fontWeight: '700', paddingVertical: 16, fontVariant: ['tabular-nums'] }}
        />
        <Text style={{ color: p.fgMuted, fontSize: 16, fontWeight: '700' }}>{coin}</Text>
      </View>

      {/* Balance / fiat estimate */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        <Text style={{ color: overspend ? p.redFg : p.fgMuted, fontSize: 13, fontWeight: '600' }}>
          {overspend
            ? `Over by ${(cryptoAmt - balance).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${coin}`
            : `Balance: ${balance.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${coin}`}
        </Text>
        {fiatValue > 0 && !overspend && (
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
            ≈ {currSym}{fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        )}
      </View>

      {/* ── You receive panel ── */}
      <View style={{
        backgroundColor: p.bgElev, borderRadius: 18, borderWidth: 1, borderColor: p.border,
        padding: 16, marginBottom: 20,
      }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 }}>YOU RECEIVE</Text>
        <Text style={{ color: p.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>
          {fiatValue > 0 && !overspend
            ? `${currSym}${fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `${currSym}0.00`}
        </Text>
        <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 4 }}>Instant · No hidden fees</Text>
      </View>

      {/* Success / Error feedback */}
      {ctaState === 'success' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.greenBg, borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <Ionicons name="checkmark-circle" size={16} color={p.greenFg} />
          <Text style={{ color: p.greenFg, fontSize: 13, flex: 1, fontWeight: '600' }}>
            Sold {cryptoAmt > 0 ? `${amount} ` : ''}{coin} for {currSym}{fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      )}
      {ctaState === 'error' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
          <Ionicons name="alert-circle-outline" size={16} color={p.redFg} />
          <Text style={{ color: p.redFg, fontSize: 13, flex: 1 }}>{ctaError ?? 'Order failed'}</Text>
        </View>
      )}

      {/* ── CTA ── */}
      <Pressable
        onPress={onSell}
        disabled={cryptoAmt <= 0 || overspend || ctaState === 'loading'}
        style={({ pressed }) => {
          const active = cryptoAmt > 0 && !overspend && ctaState !== 'loading';
          const bg = ctaState === 'success' ? p.greenFg : ctaState === 'error' ? p.redFg : active ? p.ctaBg : p.bgElev;
          return {
            height: 56, borderRadius: 28,
            backgroundColor: bg,
            borderWidth: active ? 0 : 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
            opacity: pressed || ctaState === 'loading' ? 0.85 : 1,
            shadowColor: active ? p.ctaBg : 'transparent',
            shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
          };
        }}
      >
        {ctaState === 'loading' ? (
          <ActivityIndicator color={p.ctaFg} />
        ) : (
          <>
            <Ionicons
              name={ctaState === 'success' ? 'checkmark' : ctaState === 'error' ? 'alert-circle' : 'trending-down'}
              size={18}
              color={cryptoAmt > 0 && !overspend ? p.ctaFg : p.fgMuted}
            />
            <Text style={{ color: cryptoAmt > 0 && !overspend ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '800' }}>
              {ctaState === 'success' ? `Sold ${coin}!`
                : ctaState === 'error' ? 'Try again'
                : cryptoAmt > 0 && !overspend
                  ? `Sell ${amount} ${coin} · ${currSym}${fiatValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `Sell ${coin}`}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default SellWidget;
