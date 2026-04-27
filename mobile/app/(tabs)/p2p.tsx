/**
 * P2P marketplace — theme-aware. BUY/SELL segmented + fiat chips + offer rows.
 * No NativeWind. Every Pressable wired with real onPress.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useP2POffers, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import type { Currency, P2POffer } from '@/types';

type Side = 'BUY' | 'SELL';
const FIATS: Currency[] = ['USD', 'AED', 'SAR', 'EUR', 'EGP'];

export default function P2P() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const [side, setSide] = useState<Side>('BUY');
  const [fiat, setFiat] = useState<Currency | 'ALL'>('ALL');
  const { data: offers } = useP2POffers(side);

  const filtered = useMemo(() => {
    const list = offers ?? [];
    return fiat === 'ALL' ? list : list.filter((o) => o.quote === fiat);
  }, [offers, fiat]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
        }}>
          <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}>
            P2P market
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => { h.light(); router.push('/p2p/trades'); }}
              hitSlop={6}
              accessibilityLabel="My trades and escrow"
              style={{
                height: 36, borderRadius: 18,
                paddingHorizontal: 12,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.pillBg,
                borderWidth: 1, borderColor: p.border,
                flexDirection: 'row', gap: 6,
              }}
            >
              <Ionicons name="lock-closed-outline" size={14} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>
                Trades
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { h.light(); router.push('/p2p/new'); }}
              hitSlop={6}
              accessibilityLabel="Create new P2P listing"
              style={{
                width: 36, height: 36, borderRadius: 18,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.ctaBg,
              }}
            >
              <Ionicons name="add" size={20} color={p.ctaFg} />
            </Pressable>
          </View>
        </View>

        {/* Segmented BUY / SELL */}
        <View style={{
          flexDirection: 'row', padding: 4,
          marginHorizontal: 24, marginTop: 14,
          borderRadius: 14,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          gap: 4,
        }}>
          {(['BUY', 'SELL'] as Side[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => { h.selection(); setSide(s); }}
              style={{ flex: 1 }}
            >
              <View style={{
                paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: side === s ? p.ctaBg : 'transparent',
              }}>
                <Text style={{
                  color: side === s ? p.ctaFg : p.fgMuted,
                  fontWeight: '700', fontSize: 13, letterSpacing: 0.4,
                }}>
                  I want to {s.toLowerCase()}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Fiat chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, gap: 8 }}
          style={{ flexGrow: 0 }}
        >
          <Chip
            palette={p}
            active={fiat === 'ALL'}
            onPress={() => { h.selection(); setFiat('ALL'); }}
            label="All"
          />
          {FIATS.map((f) => (
            <Chip
              key={f}
              palette={p}
              active={fiat === f}
              onPress={() => { h.selection(); setFiat(f); }}
              label={`${CURRENCY_META[f].flagOrIcon}  ${f}`}
            />
          ))}
        </ScrollView>

        {/* Offers list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 140 }}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 56 }}>
              <Ionicons name="search-outline" size={28} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12 }}>
                No offers match your filters.
              </Text>
            </View>
          ) : (
            filtered.map((o) => <OfferCard key={o.id} offer={o} palette={p} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Chip ── */
function Chip({ active, onPress, label, palette: p }: {
  active: boolean; onPress: () => void; label: string; palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
        backgroundColor: active ? p.fg : p.bgElev,
        borderWidth: 1, borderColor: active ? p.fg : p.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{
        color: active ? p.bg : p.fgMuted,
        fontSize: 13, fontWeight: '700',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Offer card ── */
function OfferCard({ offer, palette: p }: { offer: P2POffer; palette: Palette }) {
  const h = useHaptics();
  const router = useRouter();
  const isBuy = offer.side === 'BUY';
  const traderInitial = offer.trader.name.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={() => {
        h.light();
        router.push(`/p2p/${offer.id}`);
      }}
      style={({ pressed }) => ({
        marginBottom: 10,
        padding: 16,
        borderRadius: 18,
        backgroundColor: pressed ? p.border : p.bgElev,
        borderWidth: 1, borderColor: p.border,
      })}
    >
      {/* Trader row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: p.pillBg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: p.fg, fontWeight: '700', fontSize: 14 }}>{traderInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{offer.trader.handle}</Text>
            {offer.trader.verified && (
              <Ionicons name="shield-checkmark" size={12} color={p.greenFg} />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Ionicons name="star" size={11} color="#f59e0b" />
            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>
              {offer.trader.rating.toFixed(1)} · {offer.trader.orders} orders
            </Text>
          </View>
        </View>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
          backgroundColor: isBuy ? p.greenBg : 'rgba(239,68,68,0.16)',
        }}>
          <Text style={{
            color: isBuy ? p.greenFg : p.redFg,
            fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5,
          }}>
            {offer.side}
          </Text>
        </View>
      </View>

      {/* Rate */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>RATE</Text>
        <Text style={{ color: p.fg, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
          {Number(offer.price).toLocaleString('en-US', { maximumFractionDigits: 4 })}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
          {offer.quote} / {offer.base}
        </Text>
      </View>

      {/* Limits */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <View>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>LIMITS</Text>
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
            {offer.minLimit} – {offer.maxLimit} {offer.quote}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>AVAILABLE</Text>
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
            {offer.available} {offer.base}
          </Text>
        </View>
      </View>

      {/* Methods */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {offer.paymentMethods.map((m) => (
          <View
            key={m}
            style={{
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
              backgroundColor: p.pillBg,
              borderWidth: 1, borderColor: p.border,
            }}
          >
            <Text style={{ color: p.fgMuted, fontSize: 10.5, fontWeight: '700' }}>{m}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
