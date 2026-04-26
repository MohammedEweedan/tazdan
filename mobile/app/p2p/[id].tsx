/**
 * P2P offer detail — opens when the user taps a card on the marketplace.
 *
 *  - Looks up the offer by id from the React-Query cache (same key the
 *    marketplace fills).
 *  - Lets the user enter how much fiat / crypto they want to trade.
 *  - "Start trade" hits POST /api/p2p/trades (gracefully no-ops if the
 *    backend rejects, e.g. demo session).
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useP2POffers } from '@/hooks';
import { api } from '@/lib/api';
import type { P2POffer } from '@/types';

export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();

  // Try both BUY + SELL caches — the offer can be in either side bucket.
  const { data: buyList } = useP2POffers('BUY');
  const { data: sellList } = useP2POffers('SELL');

  const offer = useMemo<P2POffer | null>(() => {
    const all = [...(buyList ?? []), ...(sellList ?? [])];
    return all.find((o) => o.id === id) ?? null;
  }, [buyList, sellList, id]);

  const [fiatAmount, setFiatAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!offer) {
    return (
      <ScreenShell title="Offer">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
          <Ionicons name="alert-circle-outline" size={36} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 12 }}>
            Offer not found.
          </Text>
        </View>
      </ScreenShell>
    );
  }

  const price = Number(offer.price);
  const fiat  = Number(fiatAmount || 0);
  const cryptoAmount = price > 0 ? fiat / price : 0;
  const minLimit = Number(offer.minLimit);
  const maxLimit = Number(offer.maxLimit);
  const tooLow  = fiat > 0 && fiat < minLimit;
  const tooHigh = fiat > maxLimit;
  const valid   = fiat >= minLimit && fiat <= maxLimit;
  const isBuy   = offer.side === 'BUY';
  const action  = isBuy ? 'Sell to' : 'Buy from';

  const startTrade = async () => {
    try {
      setSubmitting(true);
      h.medium();
      // The API accepts crypto amount, not fiat — convert here.
      await api.post('/p2p/trades', {
        listingId: offer.id,
        amount: Number(cryptoAmount.toFixed(8)),
      });
      h.success();
      Alert.alert(
        'Trade started',
        `Your trade for ${cryptoAmount.toFixed(6)} ${offer.base} is now in escrow. Open Trades to follow up.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      h.error();
      const msg = e?.response?.data?.error ?? e?.message ?? 'Could not start trade.';
      Alert.alert('Trade failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title={`${action} ${offer.trader.name}`} subtitle={offer.trader.handle}>
      {/* Trader card */}
      <Panel style={{ marginTop: 12 }}>
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 46, height: 46, borderRadius: 23,
            backgroundColor: p.pillBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800' }}>
              {offer.trader.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '800' }}>{offer.trader.handle}</Text>
              {offer.trader.verified && (
                <Ionicons name="shield-checkmark" size={14} color={p.greenFg} />
              )}
            </View>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
              ★ {offer.trader.rating.toFixed(1)} · {offer.trader.orders} orders
              {offer.country ? ` · ${offer.country}` : ''}
            </Text>
          </View>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
            backgroundColor: isBuy ? p.greenBg : 'rgba(239,68,68,0.16)',
          }}>
            <Text style={{
              color: isBuy ? p.greenFg : p.redFg,
              fontSize: 11, fontWeight: '800', letterSpacing: 0.4,
            }}>
              {offer.side}
            </Text>
          </View>
        </View>
      </Panel>

      {/* Rate panel */}
      <Panel style={{ marginTop: 12 }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
            RATE
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <Text style={{
              color: p.fg, fontSize: 28, fontWeight: '800',
              letterSpacing: -0.5, fontVariant: ['tabular-nums'],
            }}>
              {price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>
              {offer.quote} / {offer.base}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            <View>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>LIMITS</Text>
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                {minLimit.toLocaleString()} – {maxLimit.toLocaleString()} {offer.quote}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>AVAILABLE</Text>
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                {Number(offer.available).toLocaleString()} {offer.base}
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
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700' }}>{m}</Text>
              </View>
            ))}
          </View>
        </View>
      </Panel>

      {/* Amount input */}
      <View style={{ marginTop: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
            YOU PAY ({offer.quote})
          </Text>
          <Pressable hitSlop={6} onPress={() => { h.selection(); setFiatAmount(String(maxLimit)); }}>
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>USE MAX</Text>
          </Pressable>
        </View>
        <View style={{
          marginTop: 10, height: 64, borderRadius: 16,
          backgroundColor: p.bgElev,
          borderWidth: 1.5, borderColor: tooHigh || tooLow ? p.redFg : p.border,
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
        }}>
          <TextInput
            value={fiatAmount}
            onChangeText={(t) => setFiatAmount(t.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={p.fgFaint}
            keyboardType="decimal-pad"
            style={{ flex: 1, color: p.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
          />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>{offer.quote}</Text>
        </View>
        <Text style={{
          color: tooHigh || tooLow ? p.redFg : p.fgMuted,
          fontSize: 12, fontWeight: '600', marginTop: 8, marginLeft: 4,
        }}>
          {tooLow
            ? `Below minimum (${minLimit.toLocaleString()} ${offer.quote})`
            : tooHigh
              ? `Above maximum (${maxLimit.toLocaleString()} ${offer.quote})`
              : `≈ ${cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${offer.base}`}
        </Text>
      </View>

      {/* Quick chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {[minLimit, Math.round((minLimit + maxLimit) / 2), maxLimit].map((v, i) => (
          <Pressable
            key={i}
            onPress={() => { h.selection(); setFiatAmount(String(v)); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 10, borderRadius: 12,
              backgroundColor: pressed ? p.border : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>
              {Number(v).toLocaleString()} {offer.quote}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* CTA */}
      <View style={{ marginTop: 28 }}>
        <CTAButton
          label={
            submitting
              ? 'Starting trade…'
              : valid
                ? `${isBuy ? 'Sell' : 'Buy'} ${cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${offer.base}`
                : 'Enter an amount'
          }
          icon={isBuy ? 'cash-outline' : 'cart-outline'}
          disabled={!valid || submitting}
          loading={submitting}
          onPress={startTrade}
        />
      </View>
    </ScreenShell>
  );
}
