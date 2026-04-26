/**
 * P2P marketplace.
 *  - BUY / SELL segmented control
 *  - Quick filter chips per fiat (USD / AED / SAR / EUR / EGP)
 *  - Offer list: trader avatar + handle + rating · rate · limits · methods
 *  - Tapping an offer opens a hypothetical detail sheet (TODO).
 *
 * Filters are local for now (offers come from the mocked p2pService). Once
 * backend is live the API call accepts side + fiat + country query params.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { Avatar } from '@/components/ui/Avatar';
import { useP2POffers, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import type { Currency, P2POffer } from '@/types';

type Side = 'BUY' | 'SELL';

const FIATS: Currency[] = ['USD', 'AED', 'SAR', 'EUR', 'EGP'];

export default function P2P() {
  const h = useHaptics();
  const [side, setSide]   = useState<Side>('BUY');
  const [fiat, setFiat]   = useState<Currency | 'ALL'>('ALL');
  const { data: offers }  = useP2POffers(side);

  const filtered = useMemo(() => {
    const list = offers ?? [];
    if (fiat === 'ALL') return list;
    return list.filter((o) => o.quote === fiat);
  }, [offers, fiat]);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View className="px-5 pt-3 pb-1 flex-row items-center justify-between">
          <Text className="text-ink-primary text-xl font-bold" style={{ letterSpacing: -0.4 }}>P2P market</Text>
          <Pressable
            hitSlop={8}
            className="w-10 h-10 rounded-full items-center justify-center bg-white/[0.06] border border-white/[0.08]"
          >
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Segmented BUY / SELL */}
        <View className="px-5 mt-3">
          <View
            className="flex-row p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]"
            style={{ gap: 4 }}
          >
            {(['BUY', 'SELL'] as Side[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => { h.selection(); setSide(s); }}
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    paddingVertical: 10, borderRadius: 14, alignItems: 'center',
                    backgroundColor: side === s
                      ? (s === 'BUY' ? '#0057B8' : '#9b1d4d')
                      : 'transparent',
                  }}
                >
                  <Text style={{
                    color: side === s ? '#fff' : 'rgba(255,255,255,0.55)',
                    fontWeight: '700', fontSize: 13, letterSpacing: 0.5,
                  }}>
                    I want to {s.toLowerCase()}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Fiat chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, gap: 8 }}
        >
          <Chip
            active={fiat === 'ALL'}
            onPress={() => { h.selection(); setFiat('ALL'); }}
            label="All"
          />
          {FIATS.map((f) => (
            <Chip
              key={f}
              active={fiat === f}
              onPress={() => { h.selection(); setFiat(f); }}
              label={`${CURRENCY_META[f].flagOrIcon}  ${f}`}
            />
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 }}>
          {filtered.length === 0 && (
            <View className="items-center py-10">
              <Ionicons name="search-outline" size={28} color="rgba(255,255,255,0.3)" />
              <Text className="text-ink-tertiary text-sm mt-3">No offers match your filters.</Text>
            </View>
          )}

          {filtered.map((o, i) => (
            <MotiView
              key={o.id}
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 320, delay: 40 * i }}
            >
              <OfferCard offer={o} />
            </MotiView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ── Chip ──────────────────────────────────────────────────────────── */
function Chip({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
        backgroundColor: active ? 'rgba(74,143,224,0.18)' : 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: active ? '#4A8FE0' : 'rgba(255,255,255,0.08)',
      }}
    >
      <Text style={{ color: active ? '#fff' : 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Offer card ────────────────────────────────────────────────────── */
function OfferCard({ offer }: { offer: P2POffer }) {
  const h = useHaptics();
  const verifiedColor = offer.trader.verified ? '#22c55e' : 'rgba(255,255,255,0.4)';
  const isBuySide = offer.side === 'BUY';
  return (
    <Pressable
      onPress={() => { h.light(); /* TODO: open offer sheet */ }}
      style={({ pressed }) => ({
        marginBottom: 12,
        padding: 16,
        borderRadius: 20,
        backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
      })}
    >
      {/* Top: trader */}
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Avatar name={offer.trader.name} size={42} />
        <View style={{ flex: 1 }}>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text className="text-ink-primary text-sm font-bold">{offer.trader.handle}</Text>
            {offer.trader.verified && (
              <Ionicons name="shield-checkmark" size={13} color={verifiedColor} />
            )}
          </View>
          <View className="flex-row items-center mt-0.5" style={{ gap: 8 }}>
            <View className="flex-row items-center" style={{ gap: 3 }}>
              <Ionicons name="star" size={11} color="#f59e0b" />
              <Text className="text-ink-secondary text-xs font-semibold">{offer.trader.rating.toFixed(1)}</Text>
            </View>
            <Text className="text-ink-tertiary text-xs">·</Text>
            <Text className="text-ink-tertiary text-xs">{offer.trader.orders} orders</Text>
            {offer.country && (
              <>
                <Text className="text-ink-tertiary text-xs">·</Text>
                <Text className="text-ink-tertiary text-xs">{offer.country}</Text>
              </>
            )}
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
            backgroundColor: isBuySide ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.16)',
          }}
        >
          <Text style={{ color: isBuySide ? '#22c55e' : '#ef4444', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 }}>
            {offer.side}
          </Text>
        </View>
      </View>

      {/* Price + rate */}
      <View className="flex-row items-baseline mt-4" style={{ gap: 6 }}>
        <Text className="text-ink-tertiary text-xs">Rate</Text>
        <Text className="text-ink-primary" style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
          {Number(offer.price).toLocaleString('en-US', { maximumFractionDigits: 4 })}
        </Text>
        <Text className="text-ink-secondary text-sm font-semibold">{offer.quote} / {offer.base}</Text>
      </View>

      {/* Limits */}
      <View className="flex-row items-center justify-between mt-3">
        <View>
          <Text className="text-ink-tertiary text-xs font-medium" style={{ letterSpacing: 0.4 }}>LIMITS</Text>
          <Text className="text-ink-primary text-xs font-bold mt-0.5">
            {offer.minLimit} – {offer.maxLimit} {offer.quote}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text className="text-ink-tertiary text-xs font-medium" style={{ letterSpacing: 0.4 }}>AVAILABLE</Text>
          <Text className="text-ink-primary text-xs font-bold mt-0.5">
            {offer.available} {offer.base}
          </Text>
        </View>
      </View>

      {/* Methods */}
      <View className="flex-row mt-3" style={{ gap: 6, flexWrap: 'wrap' }}>
        {offer.paymentMethods.map((m) => (
          <View
            key={m}
            style={{
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
            }}
          >
            <Text className="text-ink-secondary text-2xs font-semibold">{m}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
