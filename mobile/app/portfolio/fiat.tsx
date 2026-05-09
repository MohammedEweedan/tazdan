/**
 * Fiat Portfolio Detail Page
 * Shows detailed charts and KPIs for the user's fiat holdings.
 * Includes:
 * - Total fiat value by currency
 * - Currency allocation pie chart
 * - Asset list with individual balances
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';

import { useWallets } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import type { Wallet, Currency } from '@/types';

type SortOption = 'value' | 'name';

export default function FiatPortfolio() {
  const router = useRouter();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const { data: wallets } = useWallets();
  const [sort, setSort] = useState<SortOption>('value');

  const fiatWallets = useMemo(
    () => (wallets ?? []).filter((w) => CURRENCY_META[w.currency]?.kind === 'fiat'),
    [wallets],
  );

  const valueOf = (w: Wallet) => {
    return Number(w.balance);
  };

  const totalFiat = useMemo(
    () => fiatWallets.reduce((s, w) => s + valueOf(w), 0),
    [fiatWallets],
  );

  // Sort assets
  const sortedAssets = useMemo(() => {
    const assets = fiatWallets.map((w) => ({
      ...w,
      value: valueOf(w),
    }));

    switch (sort) {
      case 'value':
        return assets.sort((a, b) => b.value - a.value);
      case 'name':
        return assets.sort((a, b) => a.currency.localeCompare(b.currency));
      default:
        return assets;
    }
  }, [fiatWallets, sort]);

  // Currency allocation for pie chart
  const allocation = useMemo(() => {
    const sorted = [...fiatWallets].sort((a, b) => valueOf(b) - valueOf(a));
    const data = sorted.map((w) => ({
      currency: w.currency,
      value: valueOf(w),
      percentage: totalFiat > 0 ? (valueOf(w) / totalFiat) * 100 : 0,
    }));

    return data;
  }, [fiatWallets, totalFiat]);

  const formatFiat = (val: number, currency: Currency) => {
    const meta = CURRENCY_META[currency];
    const symbol = meta?.symbol || currency;
    if (val >= 1e9) return `${symbol}${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${symbol}${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${symbol}${(val / 1e3).toFixed(2)}K`;
    return `${symbol}${val.toFixed(2)}`;
  };

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

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
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              Total Fiat Holdings
            </Text>
            <Text style={{ color: p.fg, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 }}>
              {fiatWallets.length > 0 ? formatFiat(totalFiat, fiatWallets[0].currency) : '$0.00'}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 4 }}>
              Across {fiatWallets.length} currency{fiatWallets.length !== 1 ? 'ies' : ''}
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
              {(['value', 'name'] as SortOption[]).map((option) => (
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
                const meta = CURRENCY_META[asset.currency];
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
                        {formatFiat(asset.value, asset.currency)}
                      </Text>
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
