import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { useWallets, useMarkets } from '@/hooks';
import { getCurrencyMeta } from '@/constants';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import type { Wallet } from '@/types';
import { TopGradient } from '@/components/ui/ScreenShell';

type SortOption = 'value' | 'change' | 'name';

const FIAT_SET = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY']);

function tickerKey(currency: string): string {
  if (currency.startsWith('USDT_')) return 'USDT';
  return currency;
}

export default function CryptoPortfolio() {
  const router = useRouter();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const { data: wallets } = useWallets();
  const { data: tickers } = useMarkets();
  const [sort, setSort] = useState<SortOption>('value');

  const cryptoWallets = useMemo(
    () => (wallets ?? []).filter((w) => !FIAT_SET.has(w.currency) && Number(w.balance) > 0),
    [wallets],
  );

  const priceMap = useMemo(() => {
    const map: Record<string, number> = { USDT: 1 };
    (tickers ?? []).forEach((m) => { map[m.base] = m.price; });
    return map;
  }, [tickers]);

  const changeMap = useMemo(() => {
    const map: Record<string, number> = {};
    (tickers ?? []).forEach((m) => { map[m.base] = m.changePct24h ?? 0; });
    return map;
  }, [tickers]);

  const valueOf = (w: Wallet) => {
    const key = tickerKey(w.currency);
    const live = priceMap[key];
    return live !== undefined ? Number(w.balance) * live : 0;
  };

  const totalCryptoUsd = useMemo(
    () => cryptoWallets.reduce((s, w) => s + valueOf(w), 0),
    [cryptoWallets, priceMap],
  );

  const deltaPct = useMemo(() => {
    if (totalCryptoUsd <= 0) return 0;
    let weighted = 0;
    let exposure = 0;
    cryptoWallets.forEach((w) => {
      const key = tickerKey(w.currency);
      const chg = changeMap[key] ?? 0;
      if (!chg) return;
      const val = valueOf(w);
      weighted += val * chg;
      exposure += val;
    });
    return exposure > 0 ? weighted / exposure : 0;
  }, [cryptoWallets, changeMap, totalCryptoUsd]);

  const deltaUsd = (totalCryptoUsd * deltaPct) / 100;
  const positive = deltaPct >= 0;

  const sortedAssets = useMemo(() => {
    const assets = cryptoWallets.map((w) => ({
      ...w,
      value: valueOf(w),
      changePct24h: changeMap[tickerKey(w.currency)] ?? 0,
    }));
    switch (sort) {
      case 'value':  return assets.sort((a, b) => b.value - a.value);
      case 'change': return assets.sort((a, b) => b.changePct24h - a.changePct24h);
      case 'name':   return assets.sort((a, b) => a.currency.localeCompare(b.currency));
      default:       return assets;
    }
  }, [cryptoWallets, priceMap, changeMap, sort]);

  const allocation = useMemo((): Array<{ currency: string; value: number; percentage: number }> => {
    const sorted = [...cryptoWallets].sort((a, b) => valueOf(b) - valueOf(a));
    const top5 = sorted.slice(0, 5);
    const othersVal = sorted.slice(5).reduce((s, w) => s + valueOf(w), 0);
    const data: Array<{ currency: string; value: number; percentage: number }> = top5.map((w) => ({
      currency: w.currency,
      value: valueOf(w),
      percentage: totalCryptoUsd > 0 ? (valueOf(w) / totalCryptoUsd) * 100 : 0,
    }));
    if (othersVal > 0) {
      data.push({ currency: 'Others', value: othersVal, percentage: (othersVal / totalCryptoUsd) * 100 });
    }
    return data;
  }, [cryptoWallets, priceMap, totalCryptoUsd]);

  const formatFiat = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  const COLORS = ['#f7931a', '#627eea', '#9945ff', '#0085c0', '#22c55e', '#8247e5', '#ef4444', '#f59e0b'];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
          }}>
            <Pressable
              hitSlop={6} onPress={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={18} color={p.fg} />
            </Pressable>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}>
              Crypto Portfolio
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Total Value Card */}
          <View style={{
            marginHorizontal: 24, marginTop: 16, padding: 20,
            borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
          }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              Total Crypto Value
            </Text>
            <Text style={{ color: p.fg, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 }}>
              {formatFiat(totalCryptoUsd)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Text style={{ color: positive ? p.greenFg : p.redFg, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                {positive ? '+' : '-'}{formatFiat(Math.abs(deltaUsd))}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
                backgroundColor: positive ? p.greenBg : 'rgba(239,68,68,0.16)',
              }}>
                <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={9} color={positive ? p.greenFg : p.redFg} />
                <Text style={{ color: positive ? p.greenFg : p.redFg, fontSize: 12, fontWeight: '700' }}>
                  {Math.abs(deltaPct).toFixed(2)}%
                </Text>
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 12, marginLeft: 4 }}>24h</Text>
            </View>
          </View>

          {/* Asset Allocation */}
          {cryptoWallets.length > 0 && (
            <View style={{
              marginHorizontal: 24, marginTop: 20, padding: 20,
              borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            }}>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>
                Asset Allocation
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <Svg width={120} height={120}>
                  <Circle cx={60} cy={60} r={44} fill="transparent" stroke={p.border} strokeWidth={18} />
                  {allocation.map((item, index) => {
                    const circumference = 2 * Math.PI * 44;
                    const dash = circumference * (item.percentage / 100);
                    const prevPct = allocation.slice(0, index).reduce((s, i) => s + i.percentage, 0);
                    return (
                      <Circle
                        key={item.currency}
                        cx={60} cy={60} r={44}
                        fill="transparent"
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={18}
                        strokeDasharray={[dash, circumference]}
                        rotation={(prevPct / 100) * 360 - 90}
                        originX={60} originY={60}
                      />
                    );
                  })}
                  <SvgText x={60} y={56} textAnchor="middle" fill={p.fg} fontSize="13" fontWeight="800">
                    {cryptoWallets.length}
                  </SvgText>
                  <SvgText x={60} y={70} textAnchor="middle" fill={p.fgMuted} fontSize="9" fontWeight="600">
                    ASSETS
                  </SvgText>
                </Svg>
                <View style={{ flex: 1 }}>
                  {allocation.map((item, index) => {
                    const meta = getCurrencyMeta(item.currency);
                    return (
                      <View key={item.currency} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS[index % COLORS.length], marginRight: 8 }} />
                        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600', flex: 1 }}>
                          {meta?.name ?? item.currency}
                        </Text>
                        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>
                          {item.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Sort Options */}
          <View style={{
            flexDirection: 'row', marginHorizontal: 24, marginTop: 20,
            padding: 4, borderRadius: 12, backgroundColor: p.pillBg,
          }}>
            {(['value', 'change', 'name'] as SortOption[]).map((option) => (
              <Pressable
                key={option} onPress={() => setSort(option)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: sort === option ? p.bg : 'transparent' }}
              >
                <Text style={{ color: sort === option ? p.accentText : p.fgMuted, fontSize: 13, fontWeight: sort === option ? '600' : '500', textTransform: 'capitalize' }}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Asset List */}
          <View style={{ marginHorizontal: 24, marginTop: 16 }}>
            {sortedAssets.length === 0 && (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Ionicons name="wallet-outline" size={28} color={p.fgFaint} />
                <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12, fontWeight: '500' }}>
                  No crypto holdings yet
                </Text>
              </View>
            )}
            {sortedAssets.map((asset) => {
              const meta = getCurrencyMeta(asset.currency);
              const assetPositive = asset.changePct24h >= 0;
              return (
                <Pressable
                  key={asset.id}
                  onPress={() => router.push(`/asset/${asset.currency}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    backgroundColor: pressed ? p.bgElev : 'transparent',
                    borderRadius: 12, marginBottom: 8,
                  })}
                >
                  <CoinIcon symbol={asset.currency} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                      {meta?.name ?? asset.currency}
                    </Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                      {Number(asset.balance).toLocaleString('en-US', { maximumFractionDigits: meta?.decimals ?? 8 })} {asset.currency}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                      {formatFiat(asset.value)}
                    </Text>
                    <Text style={{ color: assetPositive ? p.greenFg : p.redFg, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                      {assetPositive ? '+' : ''}{asset.changePct24h.toFixed(2)}%
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
