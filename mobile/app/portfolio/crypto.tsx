/**
 * Crypto Portfolio Detail Page
 * Shows detailed charts and KPIs for the user's crypto holdings.
 * Includes:
 * - Total crypto value with 24h change
 * - Asset allocation pie chart
 * - Top performers
 * - Asset list with individual performance
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';

import { useWallets, useMarkets } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import type { Wallet, Currency } from '@/types';

type SortOption = 'value' | 'change' | 'name';

export default function CryptoPortfolio() {
  const router = useRouter();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const { data: wallets } = useWallets();
  const { data: tickers } = useMarkets();
  const [sort, setSort] = useState<SortOption>('value');

  const cryptoWallets = useMemo(
    () => (wallets ?? []).filter((w) => CURRENCY_META[w.currency]?.kind === 'crypto'),
    [wallets],
  );

  const priceMap = useMemo(() => {
    const map: Partial<Record<Currency, number>> = {};
    (tickers ?? []).forEach((m) => {
      map[m.base] = m.price;
    });
    return map;
  }, [tickers]);

  const valueOf = (w: Wallet) => {
    const live = priceMap[w.currency];
    if (live !== undefined) return Number(w.balance) * live;
    return 0;
  };

  const totalCryptoUsd = useMemo(
    () => cryptoWallets.reduce((s, w) => s + valueOf(w), 0),
    [cryptoWallets, priceMap],
  );

  // Calculate 24h change weighted by exposure
  const deltaPct = useMemo(() => {
    if (totalCryptoUsd <= 0 || !tickers || tickers.length === 0) return 0;
    let weightedChange = 0;
    let totalExposure = 0;
    cryptoWallets.forEach((w) => {
      const m = tickers.find((t) => t.base === w.currency);
      if (!m || m.changePct24h === undefined || m.changePct24h === 0) return;
      const exposure = Number(w.balance) * m.price;
      weightedChange += exposure * m.changePct24h;
      totalExposure += exposure;
    });
    if (totalExposure <= 0) return 0;
    return weightedChange / totalExposure;
  }, [cryptoWallets, tickers, totalCryptoUsd]);

  const deltaUsd = (totalCryptoUsd * deltaPct) / 100;
  const positive = deltaPct >= 0;

  // Sort assets
  const sortedAssets = useMemo(() => {
    const assets = cryptoWallets.map((w) => {
      const m = tickers?.find((t) => t.base === w.currency);
      return {
        ...w,
        value: valueOf(w),
        changePct24h: m?.changePct24h ?? 0,
      };
    });

    switch (sort) {
      case 'value':
        return assets.sort((a, b) => b.value - a.value);
      case 'change':
        return assets.sort((a, b) => b.changePct24h - a.changePct24h);
      case 'name':
        return assets.sort((a, b) => a.currency.localeCompare(b.currency));
      default:
        return assets;
    }
  }, [cryptoWallets, tickers, priceMap, sort]);

  // Asset allocation for pie chart (top 5 + others)
  const allocation = useMemo(() => {
    const sorted = [...cryptoWallets].sort((a, b) => valueOf(b) - valueOf(a));
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((s, w) => s + valueOf(w), 0);

    const data = top5.map((w) => ({
      currency: w.currency,
      value: valueOf(w),
      percentage: (valueOf(w) / totalCryptoUsd) * 100,
    }));

    if (others > 0) {
      data.push({
        currency: 'Others' as any,
        value: others,
        percentage: (others / totalCryptoUsd) * 100,
      });
    }

    return data;
  }, [cryptoWallets, priceMap, totalCryptoUsd]);

  const formatFiat = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  const COLORS = ['#f7931a', '#627eea', '#9945ff', '#0085c0', '#0033ad', '#8247e5'];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
          }}>
            <Pressable
              hitSlop={6}
              onPress={() => router.back()}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: p.pillBg,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}
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
            marginHorizontal: 24, marginTop: 16,
            padding: 20,
            borderRadius: 16,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
          }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              Total Crypto Value
            </Text>
            <Text style={{ color: p.fg, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 }}>
              {formatFiat(totalCryptoUsd)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Text style={{
                color: positive ? p.greenFg : p.redFg,
                fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'],
              }}>
                {positive ? '+' : '-'}{formatFiat(Math.abs(deltaUsd))}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
                backgroundColor: positive ? p.greenBg : 'rgba(239,68,68,0.16)',
              }}>
                <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={9} color={positive ? p.greenFg : p.redFg} />
                <Text style={{
                  color: positive ? p.greenFg : p.redFg,
                  fontSize: 12, fontWeight: '700',
                }}>
                  {Math.abs(deltaPct).toFixed(2)}%
                </Text>
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 12, marginLeft: 4 }}>
                24h
              </Text>
            </View>
          </View>

          {/* Asset Allocation */}
          <View style={{
            marginHorizontal: 24, marginTop: 20,
            padding: 20,
            borderRadius: 16,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
          }}>
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>
              Asset Allocation
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              {/* Simple Pie Chart */}
              <Svg width={120} height={120}>
                {allocation.map((item, index) => {
                  const percentage = item.percentage / 100;
                  const circumference = 2 * Math.PI * 50;
                  const strokeDasharray = circumference * percentage;
                  const previousPercentages = allocation.slice(0, index).reduce((s, i) => s + i.percentage, 0);
                  const rotation = (previousPercentages / 100) * 360 - 90;
                  return (
                    <Circle
                      key={item.currency}
                      cx={60}
                      cy={60}
                      r={50}
                      fill="transparent"
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={20}
                      strokeDasharray={[strokeDasharray, circumference]}
                      rotation={rotation}
                      originX={60}
                      originY={60}
                    />
                  );
                })}
              </Svg>
              <View style={{ flex: 1 }}>
                {allocation.map((item, index) => (
                  <View key={item.currency} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{
                      width: 12, height: 12, borderRadius: 6,
                      backgroundColor: COLORS[index % COLORS.length],
                      marginRight: 8,
                    }} />
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600', flex: 1 }}>
                      {item.currency}
                    </Text>
                    <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>
                      {item.percentage.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Sort Options */}
          <View style={{
            flexDirection: 'row',
            marginHorizontal: 24, marginTop: 20,
            padding: 4,
            borderRadius: 12,
            backgroundColor: p.pillBg,
          }}>
            {(['value', 'change', 'name'] as SortOption[]).map((option) => (
              <Pressable
                key={option}
                onPress={() => setSort(option)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: sort === option ? p.bg : 'transparent',
                }}
              >
                <Text style={{
                  color: sort === option ? p.fg : p.fgMuted,
                  fontSize: 13, fontWeight: sort === option ? '600' : '500',
                  textTransform: 'capitalize',
                }}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Asset List */}
          <View style={{ marginHorizontal: 24, marginTop: 16 }}>
            {sortedAssets.map((asset) => {
              const meta = CURRENCY_META[asset.currency];
              if (!meta) return null;
              const assetPositive = asset.changePct24h >= 0;
              return (
                <Pressable
                  key={asset.id}
                  onPress={() => router.push(`/asset/${asset.currency}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                    backgroundColor: pressed ? p.bgElev : 'transparent',
                    borderRadius: 12,
                    marginBottom: 8,
                  })}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: p.pillBg,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: p.border,
                    marginRight: 12,
                  }}>
                    <Text style={{ color: p.fg, fontWeight: '700', fontSize: 14 }}>
                      {meta.flagOrIcon}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                      {meta.name}
                    </Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                      {Number(asset.balance).toLocaleString('en-US', {
                        maximumFractionDigits: meta.decimals,
                      })} {asset.currency}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                      {formatFiat(asset.value)}
                    </Text>
                    <Text style={{
                      color: assetPositive ? p.greenFg : p.redFg,
                      fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'],
                    }}>
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
