/**
 * SellWidget — Sell crypto for fiat. Theme-aware widget for modal use.
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics, useMarkets, useSwap, useWallets, extractErrorMessage } from '@/hooks';
import type { Currency } from '@/types';

// Extended list of supported sell assets - matches BuyWidget
const COINS: Currency[] = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];

const ASSET_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  BTC:  { label: 'Bitcoin',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: '₿' },
  ETH:  { label: 'Ethereum',  color: '#818cf8', bg: 'rgba(129,140,248,0.12)', icon: 'Ξ' },
  SOL:  { label: 'Solana',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '◎' },
  USDT: { label: 'Tether',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: '₮' },
  BNB:  { label: 'BNB',       color: '#f3ba2f', bg: 'rgba(243,186,47,0.12)',  icon: 'B' },
  XRP:  { label: 'XRP',       color: '#23292f', bg: 'rgba(35,41,47,0.12)',   icon: '✕' },
  ADA:  { label: 'Cardano',   color: '#0033ad', bg: 'rgba(0,51,173,0.12)',   icon: '₳' },
  DOGE: { label: 'Dogecoin',  color: '#c3a634', bg: 'rgba(195,166,52,0.12)',  icon: 'Ð' },
  MATIC:{ label: 'Polygon',   color: '#8247e5', bg: 'rgba(130,71,229,0.12)',  icon: '◆' },
  DOT:  { label: 'Polkadot',  color: '#e6007a', bg: 'rgba(230,0,122,0.12)',   icon: '●' },
  AVAX: { label: 'Avalanche', color: '#e84142', bg: 'rgba(232,65,66,0.12)',   icon: '▲' },
};

export function SellWidget() {
  const p = useThemedPalette();
  const haptics = useHaptics();
  const user = useAuthStore((s) => s.user);
  const { data: tickers } = useMarkets();
  const { data: wallets } = useWallets();
  const swap = useSwap();
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError, setCtaError] = useState<string | null>(null);

  const [coin, setCoin] = useState<Currency>('BTC');
  const [amount, setAmount] = useState('');
  const [coinSearch, setCoinSearch] = useState('');

  // Get user's base currency for display
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';
  const currencySymbol = baseCurrency === 'EUR' ? '€' : baseCurrency === 'GBP' ? '£' : '$';

  // Get available coins from user wallets that have balance
  const availableCoins = useMemo(() => {
    if (!wallets) return COINS;
    const walletCurrencies = wallets
      .filter((w) => Number(w.balance) > 0)
      .map((w) => w.currency);
    return COINS.filter((c) => walletCurrencies.includes(c));
  }, [wallets]);

  // Filter coins based on search
  const filteredCoins = useMemo(() => {
    if (!coinSearch.trim()) return availableCoins;
    const query = coinSearch.toUpperCase();
    return availableCoins.filter((c) => 
      c.toUpperCase().includes(query) || 
      (ASSET_META[c]?.label?.toUpperCase().includes(query))
    );
  }, [availableCoins, coinSearch]);

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
  const meta = ASSET_META[coin] ?? ASSET_META.BTC;

  const onSell = async () => {
    if (cryptoAmount <= 0 || overspend) return;
    setCtaState('loading');
    setCtaError(null);
    try {
      await swap.mutateAsync({ from: coin, to: 'USD', amount: cryptoAmount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCtaState('success');
      setAmount('');
      setTimeout(() => setCtaState('idle'), 1500);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCtaError(extractErrorMessage(e, 'Order failed'));
      setCtaState('error');
      setTimeout(() => setCtaState('idle'), 1800);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
      {/* Search */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.pillBg, borderRadius: 12,
        borderWidth: 1, borderColor: p.border,
        paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
      }}>
        <Ionicons name="search" size={16} color={p.fgMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={coinSearch}
          onChangeText={setCoinSearch}
          placeholder="Search coin..."
          placeholderTextColor={p.fgFaint}
          style={{ flex: 1, fontSize: 14, fontWeight: '500', color: p.fg }}
          autoCapitalize="characters"
        />
        {coinSearch.length > 0 && (
          <Pressable onPress={() => setCoinSearch('')}>
            <Ionicons name="close-circle" size={16} color={p.fgMuted} />
          </Pressable>
        )}
      </View>

      {/* Coin chooser */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {filteredCoins.map((c) => {
          const m = ASSET_META[c];
          const active = coin === c;
          return (
            <Pressable
              key={c}
              onPress={() => { haptics.selection(); setCoin(c); setAmount(''); }}
              style={({ pressed }) => ({
                paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14,
                backgroundColor: active ? p.fg : p.pillBg,
                borderWidth: 1, borderColor: active ? p.fg : p.border,
                opacity: pressed ? 0.85 : 1,
                alignItems: 'center', flexDirection: 'row', gap: 6,
              })}
            >
              <Text style={{ color: active ? p.bg : m.color, fontWeight: '700', fontSize: 14 }}>
                {m.icon}
              </Text>
              <Text style={{ color: active ? p.bg : p.fg, fontWeight: '700', fontSize: 13 }}>
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Spot card */}
      <View style={{
        marginTop: 18, padding: 18,
        backgroundColor: p.pillBg, borderRadius: 16, borderWidth: 1, borderColor: p.border,
      }}>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>1 {coin} =</Text>
        <Text style={{
          color: p.fg, fontSize: 26, fontWeight: '800',
          letterSpacing: -0.7, marginTop: 4, fontVariant: ['tabular-nums'],
        }}>
          {currencySymbol}{spot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 6 }}>
          Available: {balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} {coin}
        </Text>
      </View>

      {/* Amount input */}
      <View style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
            AMOUNT ({coin})
          </Text>
          <Pressable hitSlop={6} onPress={() => { haptics.selection(); setAmount(String(balance)); }}>
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>USE MAX</Text>
          </Pressable>
        </View>
        <View style={{
          marginTop: 10, height: 64, borderRadius: 16,
          backgroundColor: p.pillBg,
          borderWidth: 1.5, borderColor: overspend ? p.redFg : p.border,
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
        }}>
          <TextInput
            value={amount}
            onChangeText={(t) => {
              // Only allow numbers and single decimal point
              const filtered = t.replace(/[^0-9.]/g, '');
              const parts = filtered.split('.');
              const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered;
              setAmount(clean);
            }}
            placeholder="0.00"
            placeholderTextColor={p.fgFaint}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
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
            : `≈ ${currencySymbol}${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </Text>
      </View>

      {/* CTA */}
      <View style={{ marginTop: 28 }}>
        <Pressable
          onPress={onSell}
          disabled={cryptoAmount <= 0 || overspend || ctaState === 'loading'}
          style={({ pressed }) => ({
            height: 52, borderRadius: 14,
            backgroundColor: ctaState === 'success' ? p.greenFg : ctaState === 'error' ? p.redFg : p.ctaBg,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            opacity: pressed || ctaState === 'loading' ? 0.85 : 1,
          })}
        >
          {ctaState === 'loading' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons 
                name={ctaState === 'success' ? 'checkmark' : ctaState === 'error' ? 'alert-circle' : 'cash-outline'} 
                size={18} 
                color="#fff" 
              />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                {ctaState === 'success'
                  ? `Sold ${coin}`
                  : ctaState === 'error'
                  ? (ctaError ?? 'Order failed')
                  : cryptoAmount > 0
                    ? `Sell ${cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${coin}`
                    : `Sell ${coin}`}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Success/Error message */}
      {(ctaState === 'success' || ctaState === 'error') && (
        <View style={{
          marginTop: 12, padding: 12, borderRadius: 12,
          backgroundColor: ctaState === 'success' ? p.greenBg : 'rgba(239,68,68,0.12)',
          flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <Ionicons 
            name={ctaState === 'success' ? 'checkmark-circle' : 'alert-circle'} 
            size={16} 
            color={ctaState === 'success' ? p.greenFg : p.redFg} 
          />
          <Text style={{ 
            color: ctaState === 'success' ? p.greenFg : p.redFg, 
            fontSize: 13, fontWeight: '600', flex: 1 
          }}>
            {ctaState === 'success' 
              ? `Successfully sold ${cryptoAmount > 0 ? cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 }) : ''} ${coin}`
              : (ctaError ?? 'Order failed')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

export default SellWidget;