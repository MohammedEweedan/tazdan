/**
 * Wallet tab — same minimal aesthetic as the home dashboard.
 *  - Title "Wallets"
 *  - Net worth amount + "Across N assets"
 *  - All / Crypto / Fiat segmented filter
 *  - Asset rows (icon + name + amount-in-currency / USD value)
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWallets, useCards, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import type { Wallet } from '@/types';

type Filter = 'ALL' | 'CRYPTO' | 'FIAT';

export default function WalletScreen() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const { data: wallets } = useWallets();
  const { data: cards } = useCards();
  const [filter, setFilter] = useState<Filter>('ALL');

  const filtered = useMemo(() => {
    if (!wallets) return [] as Wallet[];
    if (filter === 'ALL') return wallets;
    return wallets.filter((w) => CURRENCY_META[w.currency].kind === filter.toLowerCase());
  }, [wallets, filter]);

  const totalUsd = (wallets ?? []).reduce((s, w) => s + Number(w.fiatValueUsd), 0);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 4 }}>
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}>
              {t('wallet.title') || 'Wallets'}
            </Text>
            <Pressable
              hitSlop={6}
              onPress={() => { h.light(); router.push('/cards'); }}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: p.pillBg,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={18} color={p.fg} />
            </Pressable>
          </View>

          {/* Issued Cards */}
          {cards && cards.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginBottom: 10 }}>
                {t('wallet.cards') || 'Your Cards'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 12 }}>
                {cards.map((card) => (
                  <Pressable
                    key={card.id}
                    onPress={() => { h.selection(); router.push('/cards'); }}
                    style={({ pressed }) => ({
                      width: 160, height: 100, borderRadius: 16,
                      backgroundColor: pressed ? p.border : p.bgElev,
                      borderWidth: 1, borderColor: p.border,
                      padding: 14,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                        {card.tier}
                      </Text>
                      <View style={{
                        width: 32, height: 20, borderRadius: 4,
                        backgroundColor: card.colorway === 'platinum' ? '#e5e4e2' :
                                   card.colorway === 'obsidian' ? '#1a1a1a' :
                                   card.colorway === 'sapphire' ? '#0f52ba' :
                                   card.colorway === 'rose' ? '#b76e79' :
                                   card.colorway === 'emerald' ? '#50c878' : '#ccc',
                      }} />
                    </View>
                    <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', marginTop: 'auto', letterSpacing: 1 }}>
                      •••• {card.last4}
                    </Text>
                    <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 4 }}>
                      {card.expiryMonth}/{card.expiryYear}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Net worth */}
          <Text style={{
            color: p.fgMuted, fontSize: 14, fontWeight: '500',
            marginTop: 24, textAlign: 'center',
          }}>
            {t('wallet.netWorth') || 'Net worth'}
          </Text>
          <Text style={{
            color: p.fg, fontSize: 44, fontWeight: '800', letterSpacing: -1.4,
            marginTop: 4, textAlign: 'center', fontVariant: ['tabular-nums'],
          }}>
            ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={{
            color: p.fgMuted, fontSize: 13, fontWeight: '500',
            marginTop: 4, textAlign: 'center',
          }}>
            {t('wallet.acrossAssets') || `Across ${wallets?.length ?? 0} assets`} · 24h
          </Text>

          {/* Segmented filter */}
          <View style={{
            flexDirection: 'row',
            marginHorizontal: 24, marginTop: 24,
            padding: 4,
            borderRadius: 14,
            backgroundColor: p.pillBg,
            gap: 4,
          }}>
            {(['ALL', 'CRYPTO', 'FIAT'] as Filter[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => { h.selection(); setFilter(f); }}
                style={{ flex: 1 }}
              >
                <View style={{
                  paddingVertical: 9,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: filter === f ? p.fg : 'transparent',
                }}>
                  <Text style={{
                    color: filter === f ? p.bg : p.fgMuted,
                    fontWeight: '700',
                    fontSize: 12,
                    letterSpacing: 0.4,
                  }}>
                    {f}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Hairline */}
          <View style={{ height: 1, backgroundColor: p.border, marginTop: 24 }} />

          {/* Rows */}
          {filtered.map((w) => {
            const meta = CURRENCY_META[w.currency];
            return (
              <Pressable
                key={w.id}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  backgroundColor: pressed ? p.bgElev : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: p.border,
                })}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: p.pillBg,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: p.border,
                  marginRight: 14,
                }}>
                  <Text style={{ color: p.fg, fontWeight: '700', fontSize: 14 }}>
                    {meta.flagOrIcon}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                    {meta.name}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                    {Number(w.balance).toLocaleString('en-US', { maximumFractionDigits: meta.decimals })} {w.currency}
                  </Text>
                </View>
                <Text style={{
                  color: p.fg, fontSize: 15, fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                }}>
                  ${Number(w.fiatValueUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
