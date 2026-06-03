/**
 * P2P offer detail — opens when the user taps a card on the marketplace.
 * Styled to match BuyWidget / SellWidget visual language.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useP2POffers } from '@/hooks';
import { useT } from '@/store/i18nStore';
import { api } from '@/lib/api';
import type { P2POffer } from '@/types';

export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const t = useT();
  const insets = useSafeAreaInsets();

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
      <ScreenShell title={t('p2p.startTrade')}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
          <Ionicons name="alert-circle-outline" size={40} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600', marginTop: 14 }}>
            {t('p2p.offerNotFound')}
          </Text>
        </View>
      </ScreenShell>
    );
  }

  const price      = Number(offer.price);
  const fiat       = Number(fiatAmount || 0);
  const cryptoAmt  = price > 0 ? fiat / price : 0;
  const minLimit   = Number(offer.minLimit);
  const maxLimit   = Number(offer.maxLimit);
  const tooLow     = fiat > 0 && fiat < minLimit;
  const tooHigh    = fiat > maxLimit;
  const valid      = fiat >= minLimit && fiat <= maxLimit;
  const isBuy      = offer.side === 'BUY'; // trader wants to buy → I'm selling
  const sideColor  = isBuy ? p.greenFg : p.redFg;
  const sideBg     = isBuy ? p.greenBg : 'rgba(239,68,68,0.16)';

  const startTrade = async () => {
    try {
      setSubmitting(true);
      h.medium();
      await api.post('/p2p/trades', {
        listingId: offer.id,
        amount: Number(cryptoAmt.toFixed(8)),
      });
      h.success();
      Alert.alert(
        t('p2p.tradeStarted'),
        t('p2p.tradeStartedDesc', {
          amount: cryptoAmt.toLocaleString('en-US', { maximumFractionDigits: 6 }),
          asset: offer.base,
        }),
        [{ text: t('p2p.viewTrade'), onPress: () => router.replace('/p2p/trades') }],
      );
    } catch (e: any) {
      h.error();
      Alert.alert(t('p2p.tradeFailed'), e?.response?.data?.error ?? e?.message ?? 'Could not start trade.');
    } finally {
      setSubmitting(false);
    }
  };

  const ctaLabel = submitting
    ? t('p2p.startingTrade')
    : valid
      ? isBuy
        ? t('p2p.sellTo', { amount: cryptoAmt.toLocaleString('en-US', { maximumFractionDigits: 6 }), asset: offer.base })
        : t('p2p.buyFrom', { amount: cryptoAmt.toLocaleString('en-US', { maximumFractionDigits: 6 }), asset: offer.base })
      : t('p2p.enterAmount');

  return (
    <ScreenShell
      title={`${offer.trader.handle}`}
      scroll={false}
      contentStyle={{ paddingHorizontal: 0, flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      >

        {/* ── Trader card ── */}
        <Panel style={{ marginTop: 12 }}>
          <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: p.pillBg,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: p.border,
            }}>
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600' }}>
                {offer.trader.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>
                  {offer.trader.handle}
                </Text>
                {offer.trader.verified && (
                  <Ionicons name="shield-checkmark" size={14} color={p.greenFg} />
                )}
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                ★ {offer.trader.rating.toFixed(1)} · {offer.trader.orders} orders
              </Text>
            </View>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
              backgroundColor: sideBg,
            }}>
              <Text style={{ color: sideColor, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>
                {offer.side}
              </Text>
            </View>
          </View>
        </Panel>

        {/* ── Rate + limits row ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 16, paddingHorizontal: 4,
        }}>
          <View>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
              {t('p2p.rate').toUpperCase()}
            </Text>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] }}>
              1 {offer.base} = {price.toLocaleString('en-US', { maximumFractionDigits: 4 })} {offer.quote}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
              {t('p2p.limits').toUpperCase()}
            </Text>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] }}>
              {minLimit.toLocaleString()} – {maxLimit.toLocaleString()} {offer.quote}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
              {t('p2p.available').toUpperCase()}
            </Text>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] }}>
              {Number(offer.available).toLocaleString()} {offer.base}
            </Text>
          </View>
        </View>

        {/* ── Payment methods ── */}
        {offer.paymentMethods.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {offer.paymentMethods.map((m) => (
              <View
                key={m}
                style={{
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                }}
              >
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700' }}>{m}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── YOU PAY input ── */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>
              {t('p2p.youPay').toUpperCase()} ({offer.quote})
            </Text>
            <Pressable hitSlop={8} onPress={() => { h.selection(); setFiatAmount(String(maxLimit)); }}>
              <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>
                {t('p2p.useMax')}
              </Text>
            </Pressable>
          </View>

          {/* Large centered input — BuyWidget/SellWidget style */}
          <View style={{
            backgroundColor: p.bgElev,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: tooHigh || tooLow ? p.redFg : fiatAmount ? p.accent : p.border,
            paddingHorizontal: 20, paddingVertical: 18,
            alignItems: 'center', flexDirection: 'row',
          }}>
            <TextInput
              value={fiatAmount}
              onChangeText={(v) => setFiatAmount(v.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={p.fgFaint}
              keyboardType="decimal-pad"
              style={{
                flex: 1, color: p.fg,
                fontSize: 36, fontWeight: '600',
                letterSpacing: -1, fontVariant: ['tabular-nums'],
                textAlign: 'center',
              }}
            />
            <Text style={{ color: p.fgMuted, fontSize: 16, fontWeight: '700', marginLeft: 6 }}>
              {offer.quote}
            </Text>
          </View>

          {/* Error / estimate */}
          <Text style={{
            color: tooHigh || tooLow ? p.redFg : p.fgMuted,
            fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center',
          }}>
            {tooLow
              ? t('p2p.belowMin', { min: minLimit.toLocaleString(), currency: offer.quote })
              : tooHigh
                ? t('p2p.aboveMax', { max: maxLimit.toLocaleString(), currency: offer.quote })
                : fiat > 0
                  ? t('p2p.approxReceive', {
                      amount: cryptoAmt.toLocaleString('en-US', { maximumFractionDigits: 8 }),
                      asset: offer.base,
                    })
                  : `Min ${minLimit.toLocaleString()} · Max ${maxLimit.toLocaleString()} ${offer.quote}`}
          </Text>
        </View>

        {/* ── YOU RECEIVE panel ── */}
        {fiat > 0 && !tooLow && !tooHigh && (
          <View style={{
            marginTop: 16,
            backgroundColor: p.bgElev,
            borderRadius: 16, borderWidth: 1, borderColor: p.border,
            padding: 16,
          }}>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 }}>
              {t('p2p.youReceive').toUpperCase()}
            </Text>
            <Text style={{
              color: p.fg, fontSize: 26, fontWeight: '600',
              letterSpacing: -0.8, fontVariant: ['tabular-nums'],
            }}>
              {cryptoAmt.toLocaleString('en-US', { maximumFractionDigits: 8 })}
              {' '}
              <Text style={{ fontSize: 16, fontWeight: '700', color: p.fgMuted }}>{offer.base}</Text>
            </Text>
          </View>
        )}

        {/* ── Quick chips ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {[minLimit, Math.round((minLimit + maxLimit) / 2), maxLimit].map((v, i) => {
            const isActive = fiatAmount === String(v);
            return (
              <Pressable
                key={i}
                onPress={() => { h.selection(); setFiatAmount(String(v)); }}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 11, borderRadius: 14,
                  backgroundColor: isActive ? p.ctaBg : pressed ? p.border : p.pillBg,
                  borderWidth: 1, borderColor: isActive ? p.ctaBg : p.border,
                  alignItems: 'center',
                })}
              >
                <Text style={{
                  color: isActive ? p.ctaFg : p.fg,
                  fontSize: 12, fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                }}>
                  {Number(v).toLocaleString()} {offer.quote}
                </Text>
              </Pressable>
            );
          })}
        </View>

      </ScrollView>

      {/* ── CTA footer — natural flow, no absolute, no border ── */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: insets.bottom + 12,
        backgroundColor: p.bg,
      }}>
        <CTAButton
          label={ctaLabel}
          icon={isBuy ? 'cash-outline' : 'cart-outline'}
          disabled={!valid || submitting}
          loading={submitting}
          onPress={startTrade}
        />
      </View>
    </ScreenShell>
  );
}
