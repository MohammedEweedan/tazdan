/**
 * Fiat Portfolio Detail Page
 * Shows detailed charts and KPIs for the user's fiat holdings.
 * Includes:
 * - Total fiat value by currency
 * - Currency allocation pie chart
 * - Asset list with individual balances
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { useWallets } from '@/hooks';
import { getCurrencyMeta, fiatSymbol } from '@/constants';
import { useI18n } from '@/store/i18nStore';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import type { Wallet } from '@/types';
import { TopGradient } from '@/components/ui/ScreenShell';

type SortOption = 'value' | 'name' | 'rate';

export default function FiatPortfolio() {
  const router = useRouter();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const locale = useI18n((s) => s.locale);
  const { data: wallets } = useWallets();
  const [sort, setSort] = useState<SortOption>('value');

  const fiatWallets = useMemo(
    () => (wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat'),
    [wallets],
  );

  const usdOf  = (w: Wallet) => Number(w.fiatValueUsd || 0);
  const rateOf = (w: Wallet) => {
    const bal = Number(w.balance);
    return bal > 0 ? usdOf(w) / bal : 0;
  };

  const totalUsd = useMemo(
    () => fiatWallets.reduce((s, w) => s + usdOf(w), 0),
    [fiatWallets],
  );

  // Sort assets
  const sortedAssets = useMemo(() => {
    const assets = fiatWallets.map((w) => ({
      ...w,
      usd:  usdOf(w),
      rate: rateOf(w),
    }));
    switch (sort) {
      case 'value':  return assets.sort((a, b) => b.usd - a.usd);
      case 'rate':   return assets.sort((a, b) => b.rate - a.rate);
      case 'name':   return assets.sort((a, b) => a.currency.localeCompare(b.currency));
      default:       return assets;
    }
  }, [fiatWallets, sort]);

  // Currency allocation for donut chart
  const allocation = useMemo(() => {
    const sorted = [...fiatWallets].sort((a, b) => usdOf(b) - usdOf(a));
    return sorted.map((w) => ({
      currency: w.currency,
      usd: usdOf(w),
      percentage: totalUsd > 0 ? (usdOf(w) / totalUsd) * 100 : 0,
    }));
  }, [fiatWallets, totalUsd]);

  const formatUsd = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };
  const formatNative = (w: Wallet) => {
    const meta = getCurrencyMeta(w.currency);
    const sym = fiatSymbol(w.currency, locale);
    return `${sym}${Number(w.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: meta?.decimals ?? 2 })}`;
  };

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
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
              Fiat Portfolio
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
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
              TOTAL FIAT (USD EQUIVALENT)
            </Text>
            <Text style={{ color: p.fg, fontSize: 34, fontWeight: '600', letterSpacing: -0.8, marginTop: 6 }}>
              {formatUsd(totalUsd)}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 4 }}>
              Across {fiatWallets.length} {fiatWallets.length === 1 ? 'currency' : 'currencies'}
            </Text>
          </View>

          {/* Currency Allocation */}
          {fiatWallets.length > 0 && (
            <View style={{
              marginHorizontal: 24, marginTop: 20,
              padding: 20,
              borderRadius: 16,
              backgroundColor: p.bgElev,
              borderWidth: 1, borderColor: p.border,
            }}>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>
                Currency Allocation
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                {/* Donut chart */}
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
                    {fiatWallets.length}
                  </SvgText>
                  <SvgText x={60} y={70} textAnchor="middle" fill={p.fgMuted} fontSize="9" fontWeight="600">
                    CURRENCIES
                  </SvgText>
                </Svg>
                <View style={{ flex: 1 }}>
                  {allocation.map((item, index) => (
                    <View key={item.currency} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                      <View style={{
                        width: 10, height: 10, borderRadius: 5,
                        backgroundColor: COLORS[index % COLORS.length], marginRight: 8,
                      }} />
                      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', flex: 1 }}>
                        {item.currency}
                      </Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {item.percentage.toFixed(1)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Sort Options */}
          {fiatWallets.length > 1 && (
            <View style={{
              flexDirection: 'row',
              marginHorizontal: 24, marginTop: 20,
              padding: 4,
              borderRadius: 12,
              backgroundColor: p.pillBg,
            }}>
              {(['value', 'rate', 'name'] as SortOption[]).map((option) => (
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
          )}

          {/* Asset List */}
          <View style={{ marginHorizontal: 24, marginTop: 16 }}>
            {sortedAssets.length === 0 ? (
              <View style={{
                padding: 40,
                alignItems: 'center',
                borderRadius: 16,
                backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border,
              }}>
                <Ionicons name="wallet-outline" size={48} color={p.fgMuted} style={{ marginBottom: 12 }} />
                <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
                  No fiat holdings yet
                </Text>
                <Text style={{ color: p.fgFaint, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                  Add funds to get started
                </Text>
              </View>
            ) : (
              sortedAssets.map((asset) => {
                const meta = getCurrencyMeta(asset.currency);
                if (!meta) return null;
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
                    <Text style={{ fontSize: fiatSymbol(asset.currency, locale).length > 2 ? 18 : 28, width: 40, textAlign: 'center', marginRight: 12, fontWeight: '700', color: p.fg }}>
                      {fiatSymbol(asset.currency, locale)}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{meta.name}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                        {formatNative(asset)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                        {formatUsd(asset.usd)}
                      </Text>
                      {asset.currency !== 'USD' && asset.rate > 0 && (
                        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 1, fontVariant: ['tabular-nums'] }}>
                          1 {asset.currency} = ${asset.rate.toFixed(4)}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
