/**
 * P2P marketplace — theme-aware.
 * "Create listing" and "Start trade" both happen as inline bottom sheets,
 * no page navigation required.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useP2POffers, useHaptics, useCreateP2PListing, useInitiateP2PTrade, useWallets, useMarkets,
} from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import type { Currency, MarketTicker, P2POffer } from '@/types';
import { TopGradient } from '@/components/ui/ScreenShell';

type Side = 'BUY' | 'SELL';
const FIATS: Currency[]   = ['USD', 'AED', 'SAR', 'EUR', 'EGP'];
// CRYPTOS is now dynamic — built from user holdings + market tickers in CreateListingSheet
const FIAT_OPTIONS        = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'] as const;
const METHODS             = ['Bank Transfer', 'Wise', 'Revolut', 'Cash', 'PayPal', 'Internal Wallet'] as const;
const FIAT_SET            = new Set<string>(['USD','EUR','GBP','AED','SAR','EGP','LYD','CAD','AUD','CHF','JPY','CNY']);

function Section({ title, palette: p, children }: { title: string; palette: Palette; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginLeft: 4, marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function P2P() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const t = useT();
  const themeMode = useTheme((s) => s.mode);
  const [side, setSide] = useState<Side>('BUY');
  const [fiat, setFiat] = useState<Currency | 'ALL'>('ALL');
  const { data: offers } = useP2POffers(side);

  const [selectedOffer, setSelectedOffer] = useState<P2POffer | null>(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [cryptoSearch, setCryptoSearch]   = useState('');

  const filtered = useMemo(() => {
    const list = offers ?? [];
    const byFiat = fiat === 'ALL' ? list : list.filter((o) => o.quote === fiat);
    const q = cryptoSearch.trim().toLowerCase();
    return q ? byFiat.filter((o) => o.base.toLowerCase().includes(q)) : byFiat;
  }, [offers, fiat, cryptoSearch]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
        }}>
          <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}>
            {t('p2p.title')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => { h.light(); router.push('/p2p/trades'); }}
              hitSlop={6}
              style={{
                height: 36, borderRadius: 18, paddingHorizontal: 12,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                flexDirection: 'row', gap: 6,
              }}
            >
              <Ionicons name="lock-closed-outline" size={14} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>
                {t('p2p.trades')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { h.medium(); setShowCreate(true); }}
              hitSlop={6}
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
          borderRadius: 14, backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border, gap: 4,
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
                  {t('p2p.listingType').toUpperCase()} {s === 'BUY' ? t('p2p.buy').toUpperCase() : t('p2p.sell').toUpperCase()}
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
          <Chip palette={p} active={fiat === 'ALL'} onPress={() => { h.selection(); setFiat('ALL'); }} label="···" />
          {FIATS.map((f) => (
            <Chip
              key={f}
              palette={p}
              active={fiat === f}
              onPress={() => { h.selection(); setFiat(f); }}
              flag={CURRENCY_META[f].flagOrIcon}
              label={f}
            />
          ))}
        </ScrollView>

        {/* Crypto search — BUY side only */}
        {side === 'BUY' && (
          <View style={{
            marginHorizontal: 20, marginTop: 10,
            flexDirection: 'row', alignItems: 'center', gap: 10,
            height: 44, borderRadius: 12,
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            paddingHorizontal: 12,
          }}>
            <Ionicons name="search-outline" size={16} color={p.fgFaint} />
            <TextInput
              value={cryptoSearch}
              onChangeText={setCryptoSearch}
              placeholder="Search by asset (BTC, ETH, SOL…)"
              placeholderTextColor={p.fgFaint}
              autoCapitalize="characters"
              style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '600' }}
            />
            {cryptoSearch.length > 0 && (
              <Pressable onPress={() => setCryptoSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={p.fgFaint} />
              </Pressable>
            )}
          </View>
        )}

        {/* Offers list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 140 }}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 56 }}>
              <Ionicons name="search-outline" size={28} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12 }}>
                {t('p2p.noOffers')}
              </Text>
            </View>
          ) : (
            filtered.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                palette={p}
                onPress={() => { h.light(); setSelectedOffer(o); }}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Offer detail sheet */}
      {selectedOffer && (
        <OfferDetailSheet
          offer={selectedOffer}
          palette={p}
          t={t}
          onClose={() => setSelectedOffer(null)}
          onTradeStarted={() => {
            setSelectedOffer(null);
            router.push('/p2p/trades');
          }}
        />
      )}

      {/* Create listing sheet */}
      {showCreate && (
        <CreateListingSheet
          palette={p}
          t={t}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </View>
  );
}

/* ── Chip ── */
function Chip({ active, onPress, label, flag, palette: p }: {
  active: boolean; onPress: () => void; label: string; flag?: string; palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
        backgroundColor: active ? p.fg : p.bgElev,
        borderWidth: 1, borderColor: active ? p.fg : p.border,
        opacity: pressed ? 0.7 : 1,
        flexDirection: 'row', alignItems: 'center', gap: 4,
      })}
    >
      {flag ? (
        <>
          <Text style={{ fontSize: 14, lineHeight: 18 }}>{flag}</Text>
          <Text style={{ color: active ? p.bg : p.fgMuted, fontSize: 13, fontWeight: '700' }}>{label}</Text>
        </>
      ) : (
        <Text style={{ color: active ? p.bg : p.fgMuted, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ── Offer card ── */
function OfferCard({ offer, palette: p, onPress }: {
  offer: P2POffer; palette: Palette; onPress: () => void;
}) {
  const isBuy = offer.side === 'BUY';
  const traderInitial = offer.trader.name.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginBottom: 10, padding: 16, borderRadius: 18,
        backgroundColor: pressed ? p.border : p.bgElev,
        borderWidth: 1, borderColor: p.border,
      })}
    >
      {/* Trader row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: p.fg, fontWeight: '700', fontSize: 14 }}>{traderInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!offer.trader.anonymous
              ? <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{offer.trader.handle}</Text>
              : <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>🥷 Anonymous</Text>
            }
            {offer.trader.verified && <Ionicons name="shield-checkmark" size={12} color={p.greenFg} />}
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
            fontSize: 10.5, fontWeight: '600', letterSpacing: 0.5,
          }}>
            {offer.side}
          </Text>
        </View>
      </View>

      {/* Rate */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>RATE</Text>
        <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.5 }}>
          {Number(offer.price).toLocaleString('en-US', { maximumFractionDigits: 4 })}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
          {offer.quote} / {offer.base}
        </Text>
      </View>

      {/* Limits + available */}
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
          <View key={m} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border }}>
            <Text style={{ color: p.fgMuted, fontSize: 10.5, fontWeight: '700' }}>{m}</Text>
          </View>
        ))}
        {offer.paymentMethods.includes('Cash') && offer.city && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location-outline" size={11} color="#f59e0b" />
            <Text style={{ color: '#f59e0b', fontSize: 10.5, fontWeight: '700' }}>{offer.city}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/* ── Offer detail bottom sheet ── */
function OfferDetailSheet({ offer, palette: p, t, onClose, onTradeStarted }: {
  offer: P2POffer;
  palette: Palette;
  t: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void;
  onTradeStarted: () => void;
}) {
  const h = useHaptics();
  const insets = useSafeAreaInsets();
  const initiate = useInitiateP2PTrade();

  const [inputMode, setInputMode]     = useState<'fiat' | 'crypto'>('fiat');
  const [rawAmount, setRawAmount]     = useState('');
  const [selectedMethod, setMethod]   = useState(offer.paymentMethods[0] ?? '');
  const price      = Number(offer.price);
  const minLimit   = Number(offer.minLimit);
  const maxLimit   = Number(offer.maxLimit);
  const isBuy      = offer.side === 'BUY';

  const fiat        = inputMode === 'fiat'   ? Number(rawAmount || 0) : (Number(rawAmount || 0) * price);
  const cryptoAmount = inputMode === 'crypto' ? Number(rawAmount || 0) : (price > 0 ? fiat / price : 0);
  const tooLow  = fiat > 0 && fiat < minLimit;
  const tooHigh = fiat > maxLimit;
  const valid   = fiat >= minLimit && fiat <= maxLimit;

  const startTrade = async () => {
    if (!valid) return;
    h.medium();
    try {
      await initiate.mutateAsync({
        listingId: offer.id,
        amount: Number(cryptoAmount.toFixed(8)),
        paymentMethod: selectedMethod || undefined,
      });
      h.success();
      Alert.alert(
        t('p2p.startTrade'),
        `${cryptoAmount.toFixed(6)} ${offer.base} ${t('p2p.escrowLocked').toLowerCase()}`,
        [{ text: t('common.done'), onPress: onTradeStarted }],
      );
    } catch (e: any) {
      h.error();
      Alert.alert('Trade failed', e?.response?.data?.error ?? e?.message ?? 'Could not start trade.');
    }
  };

  const ctaLabel = initiate.isPending
    ? 'Starting…'
    : valid
      ? `${isBuy ? t('p2p.sell') : t('p2p.buy')} ${cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${offer.base}`
      : t('p2p.startTrade');

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
          <Pressable
            style={{
              backgroundColor: p.bg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              maxHeight: '92%',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            >
              {/* Trader info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600' }}>
                    {offer.trader.anonymous ? '🥷' : offer.trader.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {offer.trader.anonymous
                      ? <Text style={{ color: p.fgMuted, fontSize: 16, fontWeight: '600' }}>Anonymous</Text>
                      : <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}>{offer.trader.handle}</Text>
                    }
                    {offer.trader.verified && <Ionicons name="shield-checkmark" size={14} color={p.greenFg} />}
                  </View>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                    ★ {offer.trader.rating.toFixed(1)} · {offer.trader.orders} orders
                    {offer.timeframeMins !== 30 ? ` · ⏱ ${offer.timeframeMins}min` : ''}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: isBuy ? p.greenBg : 'rgba(239,68,68,0.16)' }}>
                  <Text style={{ color: isBuy ? p.greenFg : p.redFg, fontSize: 11, fontWeight: '600' }}>{offer.side}</Text>
                </View>
              </View>

              {/* Rate + limits */}
              <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700' }}>RATE</Text>
                  <Text style={{ color: p.fg, fontSize: 26, fontWeight: '600', letterSpacing: -0.5 }}>
                    {price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{offer.quote}/{offer.base}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                  <View>
                    <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>MIN – MAX</Text>
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
              </View>

              {/* Payment method picker */}
              {offer.paymentMethods.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>PAYMENT METHOD</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {offer.paymentMethods.map((m) => {
                      const active = selectedMethod === m;
                      return (
                        <Pressable key={m} onPress={() => { h.selection(); setMethod(m); }}
                          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: active ? p.fg : p.pillBg, borderWidth: 1, borderColor: active ? p.fg : p.border }}>
                          <Text style={{ color: active ? p.bg : p.fgMuted, fontSize: 12, fontWeight: '700' }}>{m}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {selectedMethod === 'Cash' && offer.city && (
                    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                      <Ionicons name="location" size={14} color="#f59e0b" />
                      <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '700' }}>Meet in {offer.city}{offer.country ? `, ${offer.country}` : ''}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Input mode toggle + amount */}
              <View style={{ marginTop: 20 }}>
                {/* fiat / crypto toggle */}
                <View style={{ flexDirection: 'row', backgroundColor: p.bgElev, borderRadius: 10, padding: 3, gap: 3, marginBottom: 10, alignSelf: 'flex-start' }}>
                  {(['fiat', 'crypto'] as const).map((mode) => (
                    <Pressable key={mode} onPress={() => { h.selection(); setInputMode(mode); setRawAmount(''); }}
                      style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: inputMode === mode ? p.fg : 'transparent' }}>
                      <Text style={{ color: inputMode === mode ? p.bg : p.fgMuted, fontSize: 11, fontWeight: '600' }}>
                        {mode === 'fiat' ? offer.quote : offer.base}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700' }}>
                    {inputMode === 'fiat' ? `YOU PAY (${offer.quote})` : `YOU BUY (${offer.base})`}
                  </Text>
                  <Pressable hitSlop={6} onPress={() => { h.selection(); setInputMode('fiat'); setRawAmount(String(maxLimit)); }}>
                    <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>USE MAX</Text>
                  </Pressable>
                </View>
                <View style={{ height: 64, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1.5, borderColor: tooHigh || tooLow ? p.redFg : p.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 }}>
                  <TextInput
                    value={rawAmount}
                    onChangeText={(v) => setRawAmount(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor={p.fgFaint}
                    keyboardType="decimal-pad"
                    style={{ flex: 1, color: p.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
                  />
                  <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>
                    {inputMode === 'fiat' ? offer.quote : offer.base}
                  </Text>
                </View>
                <Text style={{ color: tooHigh || tooLow ? p.redFg : p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 8, marginLeft: 4 }}>
                  {tooLow
                    ? `Below minimum (${minLimit.toLocaleString()} ${offer.quote})`
                    : tooHigh
                      ? `Above maximum (${maxLimit.toLocaleString()} ${offer.quote})`
                      : fiat > 0
                        ? inputMode === 'fiat'
                          ? `≈ ${cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${offer.base}`
                          : `≈ ${fiat.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${offer.quote}`
                        : `Min ${minLimit.toLocaleString()} · Max ${maxLimit.toLocaleString()} ${offer.quote}`}
                </Text>
              </View>

              {/* YOU RECEIVE panel */}
              {valid && (
                <View style={{ marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
                  <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 }}>YOU RECEIVE</Text>
                  <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
                    {cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })}{' '}
                    <Text style={{ fontSize: 14, fontWeight: '700', color: p.fgMuted }}>{offer.base}</Text>
                  </Text>
                </View>
              )}

              {/* Quick chips (fiat) */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {[minLimit, Math.round((minLimit + maxLimit) / 2), maxLimit].map((v, i) => {
                  const isActive = inputMode === 'fiat' && rawAmount === String(v);
                  return (
                    <Pressable key={i} onPress={() => { h.selection(); setInputMode('fiat'); setRawAmount(String(v)); }}
                      style={({ pressed }) => ({ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: isActive ? p.ctaBg : pressed ? p.border : p.pillBg, borderWidth: 1, borderColor: isActive ? p.ctaBg : p.border, alignItems: 'center' })}>
                      <Text style={{ color: isActive ? p.ctaFg : p.fg, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                        {Number(v).toLocaleString()} {offer.quote}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Sticky CTA — outside ScrollView, attached to sheet bottom */}
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
              <Pressable
                onPress={startTrade}
                disabled={!valid || initiate.isPending}
                style={({ pressed }) => ({
                  height: 56, borderRadius: 28,
                  backgroundColor: valid ? p.ctaBg : p.pillBg,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                  opacity: (!valid || initiate.isPending) ? 0.6 : pressed ? 0.85 : 1,
                })}
              >
                {initiate.isPending
                  ? <ActivityIndicator size="small" color={p.ctaFg} />
                  : <Ionicons name={isBuy ? 'cash-outline' : 'cart-outline'} size={18} color={valid ? p.ctaFg : p.fgMuted} />
                }
                <Text style={{ color: valid ? p.ctaFg : p.fgMuted, fontSize: 15, fontWeight: '600' }}>
                  {ctaLabel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Create listing bottom sheet ── */
function CreateListingSheet({ palette: p, t, onClose, onCreated }: {
  palette: Palette;
  t: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const h = useHaptics();
  const insets = useSafeAreaInsets();
  const create = useCreateP2PListing();
  const { data: wallets } = useWallets();
  const { data: tickers } = useMarkets();

  // Held crypto wallets for the SELL dropdown (with balances)
  const heldCryptos = useMemo(() => {
    return (wallets ?? [])
      .filter((w) => !FIAT_SET.has(w.currency) && Number(w.balance) > 0)
      .sort((a, b) => Number(b.balance) - Number(a.balance));
  }, [wallets]);

  // All crypto the user holds PLUS any coin in the tickers feed (so they can list coins they plan to acquire).
  // User holdings come first; remaining tickers sorted by volume.
  const availableCryptos = useMemo((): string[] => {
    const held: string[] = heldCryptos.map((w) => w.currency as string);
    const fromTickers = (tickers ?? [])
      .filter((tk: MarketTicker) => !FIAT_SET.has(tk.base) && !held.includes(tk.base))
      .sort((a: MarketTicker, b: MarketTicker) => b.volume24h - a.volume24h)
      .slice(0, 50)
      .map((tk: MarketTicker) => tk.base);
    const all = [...new Set([...held, ...fromTickers])];
    return all.length > 0 ? all : ['USDT', 'BTC', 'ETH', 'SOL', 'BNB'];
  }, [heldCryptos, tickers]);

  const [side, setSide]             = useState<'BUY' | 'SELL'>('SELL');
  const [currency, setCurrency]     = useState<string>('USDT');
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [fiatCurrency, setFiat]     = useState<typeof FIAT_OPTIONS[number]>('USD');
  const [price, setPrice]           = useState('');
  const [amount, setAmount]         = useState('');
  const [minLimit, setMin]          = useState('');
  const [maxLimit, setMax]          = useState('');
  const [minMode, setMinMode]       = useState<'fiat' | 'asset'>('fiat');
  const [maxMode, setMaxMode]       = useState<'fiat' | 'asset'>('fiat');
  const [methods, setMethods]       = useState<string[]>(['Bank Transfer']);
  const [anonymous, setAnonymous]   = useState(false);
  const [city, setCity]             = useState('');
  const [timeframeMins, setTimeframe] = useState('30');
  const [terms, setTerms]           = useState('');
  const [showTerms, setShowTerms]   = useState(false);
  const hasCash = methods.includes('Cash');

  const priceN  = Number(price);
  const amountN = Number(amount);
  const minN    = Number(minLimit);
  const maxN    = Number(maxLimit);
  const totalFiat = priceN > 0 && amountN > 0 ? priceN * amountN : 0;
  
  // Convert minimum to fiat for validation/submission if in asset mode
  const minFiat = minMode === 'asset' && priceN > 0 && minN > 0 ? minN * priceN : minN;
  const minFiatN = Number(minFiat);
  
  // Convert maximum to fiat for validation/submission if in asset mode
  const maxFiat = maxMode === 'asset' && priceN > 0 && maxN > 0 ? maxN * priceN : maxN;
  const maxFiatN = Number(maxFiat);

  const minOverTotal = minFiatN > 0 && totalFiat > 0 && minFiatN > totalFiat;
  const maxOverTotal = maxFiatN > 0 && totalFiat > 0 && maxFiatN > totalFiat;
  const minOverMax   = minFiatN > 0 && maxFiatN > 0 && minFiatN > maxFiatN;

  const valid   = priceN > 0 && amountN > 0 && minFiatN > 0 && maxFiatN >= minFiatN && !minOverTotal && !maxOverTotal && methods.length > 0;

  const toggleMethod = (m: string) => {
    h.selection();
    setMethods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const submit = async () => {
    if (!valid) {
      h.error();
      const reason = minOverTotal
        ? `Min limit (${minFiatN.toLocaleString()} ${fiatCurrency}) must be ≤ total listing value (${totalFiat.toLocaleString()} ${fiatCurrency}).`
        : maxOverTotal
          ? `Max limit (${maxFiatN.toLocaleString()} ${fiatCurrency}) must be ≤ total listing value (${totalFiat.toLocaleString()} ${fiatCurrency}).`
          : minOverMax
            ? 'Min limit must be ≤ max limit.'
            : 'Price, amount and limits must be positive numbers, max ≥ min, and at least one payment method.';
      Alert.alert('Check your inputs', reason);
      return;
    }
    try {
      const tfMins = parseInt(timeframeMins) || 30;
      await create.mutateAsync({
        side, currency, fiatCurrency,
        price: priceN, amount: amountN,
        minLimit: minFiatN, maxLimit: maxFiatN,
        paymentMethods: methods,
        terms: terms || undefined,
        anonymous,
        city: hasCash && city.trim() ? city.trim() : undefined,
        timeframeMins: tfMins,
      });
      h.success();
      Alert.alert(
        t('p2p.createListing'),
        `Your ${side} ${currency} listing is live.`,
        [{ text: t('common.done'), onPress: onCreated }],
      );
    } catch (e: any) {
      h.error();
      Alert.alert('Error', e?.response?.data?.error ?? e?.message ?? 'Please try again.');
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
          <Pressable
            style={{
              backgroundColor: p.bg,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              height: '88%',
              overflow: 'hidden',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle + header */}
           <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View
              style={{
                width: 42,
                height: 5,
                borderRadius: 3,
                backgroundColor: p.border,
                marginBottom: 20,
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                paddingHorizontal: 24,
                paddingBottom: 18,
                borderBottomWidth: 1,
                borderBottomColor: p.border,
              }}
            >
              <Text
                style={{
                  color: p.fg,
                  fontSize: 22,
                  fontWeight: '600',
                  letterSpacing: -0.4,
                }}
              >
                {t('p2p.createListing')}
              </Text>

              <Pressable onPress={() => router.back()}>
                <Ionicons name="close" size={22} color={p.fgMuted} />
              </Pressable>
            </View>
          </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 18,
                paddingBottom: 120,
              }}
            >
              {/* BUY / SELL toggle */}
              <View style={{
                flexDirection: 'row', backgroundColor: p.pillBg,
                borderRadius: 14, padding: 4, gap: 4, marginTop: 16,
              }}>
                {(['BUY', 'SELL'] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => { h.selection(); setSide(s); }}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
                      backgroundColor: side === s ? p.fg : 'transparent',
                    }}
                  >
                    <Text style={{
                      color: side === s ? p.bg : p.fgMuted,
                      fontSize: 13, fontWeight: '600', letterSpacing: 0.4,
                    }}>
                      {t('p2p.listingType').toUpperCase()} {s === 'BUY' ? t('p2p.buy').toUpperCase() : t('p2p.sell').toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
                {side === 'SELL'
                  ? `You'll send ${currency} into escrow. Buyers pay in ${fiatCurrency}.`
                  : `You want to buy ${currency}, paying sellers in ${fiatCurrency}.`}
              </Text>

              {/* Asset */}
              <SheetSection title={t('p2p.asset').toUpperCase()} palette={p}>
                {side === 'SELL' ? (
                  /* Dropdown — shows holdings with balance */
                  <>
                    <Pressable
                      onPress={() => { h.selection(); setShowAssetPicker(true); }}
                      style={{
                        height: 56, borderRadius: 14, backgroundColor: p.bgElev,
                        borderWidth: 1, borderColor: p.border,
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 16, gap: 10,
                      }}
                    >
                      <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: p.fg }}>
                          {currency.slice(0, 2)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>{currency}</Text>
                        {(() => {
                          const w = heldCryptos.find((x) => x.currency === currency);
                          return w ? (
                            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                              Balance: {Number(w.balance).toLocaleString('en-US', { maximumFractionDigits: 8 })}
                            </Text>
                          ) : (
                            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                              Not in holdings
                            </Text>
                          );
                        })()}
                      </View>
                      <Ionicons name="chevron-down" size={16} color={p.fgMuted} />
                    </Pressable>

                    {/* Asset picker modal */}
                    <Modal visible={showAssetPicker} animationType="slide" transparent onRequestClose={() => setShowAssetPicker(false)}>
                      <Pressable
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
                        onPress={() => setShowAssetPicker(false)}
                      >
                        <Pressable
                          style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '72%' }}
                          onPress={(e) => e.stopPropagation()}
                        >
                          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
                          </View>
                          <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600', paddingHorizontal: 20, paddingBottom: 12 }}>
                            Select Asset
                          </Text>
                          {/* Search */}
                          <View style={{
                            marginHorizontal: 20, marginBottom: 10,
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                            height: 42, borderRadius: 11,
                            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                            paddingHorizontal: 12,
                          }}>
                            <Ionicons name="search-outline" size={15} color={p.fgFaint} />
                            <TextInput
                              value={assetSearch}
                              onChangeText={setAssetSearch}
                              placeholder="Search…"
                              placeholderTextColor={p.fgFaint}
                              autoCapitalize="characters"
                              style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '600' }}
                            />
                            {assetSearch.length > 0 && (
                              <Pressable onPress={() => setAssetSearch('')} hitSlop={8}>
                                <Ionicons name="close-circle" size={15} color={p.fgFaint} />
                              </Pressable>
                            )}
                          </View>
                          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {/* Holdings section */}
                            {heldCryptos.filter((w) => !assetSearch || w.currency.toLowerCase().includes(assetSearch.toLowerCase())).length > 0 && (
                              <>
                                <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6 }}>
                                  MY HOLDINGS
                                </Text>
                                {heldCryptos
                                  .filter((w) => !assetSearch || w.currency.toLowerCase().includes(assetSearch.toLowerCase()))
                                  .map((w) => {
                                    const selected = currency === w.currency;
                                    return (
                                      <Pressable
                                        key={w.currency}
                                        onPress={() => {
                                          h.selection();
                                          setCurrency(w.currency);
                                          setAmount(Number(w.balance).toFixed(8).replace(/\.?0+$/, ''));
                                          setAssetSearch('');
                                          setShowAssetPicker(false);
                                        }}
                                        style={({ pressed }) => ({
                                          flexDirection: 'row', alignItems: 'center', gap: 12,
                                          paddingHorizontal: 20, paddingVertical: 13,
                                          backgroundColor: selected ? p.bgElev : pressed ? p.bgElev : 'transparent',
                                        })}
                                      >
                                        <View style={{
                                          width: 38, height: 38, borderRadius: 19,
                                          backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
                                        }}>
                                          <Text style={{ fontSize: 13, fontWeight: '600', color: p.fg }}>
                                            {w.currency.slice(0, 2)}
                                          </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{w.currency}</Text>
                                          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 1 }}>
                                            {Number(w.balance).toLocaleString('en-US', { maximumFractionDigits: 8 })} available
                                          </Text>
                                        </View>
                                        {selected && <Ionicons name="checkmark-circle" size={20} color={p.fg} />}
                                      </Pressable>
                                    );
                                  })}
                              </>
                            )}
                            {/* Other crypto from tickers */}
                            {availableCryptos
                              .filter((c) => !heldCryptos.find((w) => w.currency === c))
                              .filter((c) => !assetSearch || c.toLowerCase().includes(assetSearch.toLowerCase()))
                              .length > 0 && (
                              <>
                                <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
                                  OTHER ASSETS
                                </Text>
                                {availableCryptos
                                  .filter((c) => !heldCryptos.find((w) => w.currency === c))
                                  .filter((c) => !assetSearch || c.toLowerCase().includes(assetSearch.toLowerCase()))
                                  .map((c) => {
                                    const selected = currency === c;
                                    return (
                                      <Pressable
                                        key={c}
                                        onPress={() => {
                                          h.selection();
                                          setCurrency(c);
                                          setAssetSearch('');
                                          setShowAssetPicker(false);
                                        }}
                                        style={({ pressed }) => ({
                                          flexDirection: 'row', alignItems: 'center', gap: 12,
                                          paddingHorizontal: 20, paddingVertical: 13,
                                          backgroundColor: selected ? p.bgElev : pressed ? p.bgElev : 'transparent',
                                        })}
                                      >
                                        <View style={{
                                          width: 38, height: 38, borderRadius: 19,
                                          backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
                                        }}>
                                          <Text style={{ fontSize: 13, fontWeight: '600', color: p.fgMuted }}>
                                            {c.slice(0, 2)}
                                          </Text>
                                        </View>
                                        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', flex: 1 }}>{c}</Text>
                                        {selected && <Ionicons name="checkmark-circle" size={20} color={p.fg} />}
                                      </Pressable>
                                    );
                                  })}
                              </>
                            )}
                            <View style={{ height: 32 }} />
                          </ScrollView>
                        </Pressable>
                      </Pressable>
                    </Modal>
                  </>
                ) : (
                  /* BUY side: same dropdown as SELL */
                  <>
                    <Pressable
                      onPress={() => { h.selection(); setShowAssetPicker(true); }}
                      style={{
                        height: 56, borderRadius: 14, backgroundColor: p.bgElev,
                        borderWidth: 1, borderColor: p.border,
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 16, gap: 10,
                      }}
                    >
                      <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: p.fg }}>
                          {currency.slice(0, 2)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>{currency}</Text>
                        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                          Tap to search any asset
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={16} color={p.fgMuted} />
                    </Pressable>

                    <Modal visible={showAssetPicker} animationType="slide" transparent onRequestClose={() => setShowAssetPicker(false)}>
                      <Pressable
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
                        onPress={() => setShowAssetPicker(false)}
                      >
                        <Pressable
                          style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '72%' }}
                          onPress={(e) => e.stopPropagation()}
                        >
                          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
                          </View>
                          <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600', paddingHorizontal: 20, paddingBottom: 12 }}>
                            Select Asset to Buy
                          </Text>
                          <View style={{
                            marginHorizontal: 20, marginBottom: 10,
                            flexDirection: 'row', alignItems: 'center', gap: 8,
                            height: 42, borderRadius: 11,
                            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                            paddingHorizontal: 12,
                          }}>
                            <Ionicons name="search-outline" size={15} color={p.fgFaint} />
                            <TextInput
                              value={assetSearch}
                              onChangeText={setAssetSearch}
                              placeholder="Search…"
                              placeholderTextColor={p.fgFaint}
                              autoCapitalize="characters"
                              style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '600' }}
                            />
                            {assetSearch.length > 0 && (
                              <Pressable onPress={() => setAssetSearch('')} hitSlop={8}>
                                <Ionicons name="close-circle" size={15} color={p.fgFaint} />
                              </Pressable>
                            )}
                          </View>
                          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {availableCryptos
                              .filter((c) => !assetSearch || c.toLowerCase().includes(assetSearch.toLowerCase()))
                              .map((c) => {
                                const selected = currency === c;
                                const heldWallet = heldCryptos.find((w) => w.currency === c);
                                return (
                                  <Pressable
                                    key={c}
                                    onPress={() => {
                                      h.selection();
                                      setCurrency(c);
                                      setAssetSearch('');
                                      setShowAssetPicker(false);
                                    }}
                                    style={({ pressed }) => ({
                                      flexDirection: 'row', alignItems: 'center', gap: 12,
                                      paddingHorizontal: 20, paddingVertical: 13,
                                      backgroundColor: selected ? p.bgElev : pressed ? p.bgElev : 'transparent',
                                    })}
                                  >
                                    <View style={{
                                      width: 38, height: 38, borderRadius: 19,
                                      backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? p.fg : p.fgMuted }}>
                                        {c.slice(0, 2)}
                                      </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{c}</Text>
                                      {heldWallet && (
                                        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 1 }}>
                                          You hold: {Number(heldWallet.balance).toLocaleString('en-US', { maximumFractionDigits: 8 })}
                                        </Text>
                                      )}
                                    </View>
                                    {selected && <Ionicons name="checkmark-circle" size={20} color={p.fg} />}
                                  </Pressable>
                                );
                              })}
                            <View style={{ height: 32 }} />
                          </ScrollView>
                        </Pressable>
                      </Pressable>
                    </Modal>
                  </>
                )}
              </SheetSection>

              {/* Fiat */}
              <SheetSection title="PRICED IN" palette={p}>
                <ChipRow palette={p} options={[...FIAT_OPTIONS]} value={fiatCurrency} onPick={(c) => setFiat(c as typeof FIAT_OPTIONS[number])} />
              </SheetSection>

              {/* Price */}
              <SheetSection title={`${t('p2p.price').toUpperCase()} (${fiatCurrency}/${currency})`} palette={p}>
                <NumberField palette={p} value={price} onChangeText={setPrice} placeholder="0.00" suffix={fiatCurrency} />
              </SheetSection>

              {/* Amount */}
              <SheetSection title={`${t('p2p.amount').toUpperCase()} (${currency})`} palette={p}>
                <NumberField palette={p} value={amount} onChangeText={setAmount} placeholder="100" suffix={currency} />
              </SheetSection>

              {/* Min / Max */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SheetSection title={`${t('p2p.min').toUpperCase()}`} palette={p}>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                      {(['fiat', 'asset'] as const).map((mode) => (
                        <Pressable
                          key={mode}
                          onPress={() => { h.selection(); setMinMode(mode); }}
                          style={{
                            flex: 1, paddingVertical: 6, borderRadius: 8,
                            backgroundColor: minMode === mode ? p.fg : p.pillBg,
                            borderWidth: 1, borderColor: minMode === mode ? p.fg : p.border,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            color: minMode === mode ? p.bg : p.fgMuted,
                            fontSize: 11, fontWeight: '600',
                          }}>
                            {mode === 'fiat' ? fiatCurrency : currency}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <NumberField 
                      palette={p} 
                      value={minLimit} 
                      onChangeText={setMin} 
                      placeholder={minMode === 'fiat' ? '50' : '10'}
                      suffix={minMode === 'fiat' ? fiatCurrency : currency}
                      error={minOverTotal || minOverMax}
                    />
                  </SheetSection>
                </View>
                <View style={{ flex: 1 }}>
                  <SheetSection title={`${t('p2p.max').toUpperCase()}`} palette={p}>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                      {(['fiat', 'asset'] as const).map((mode) => (
                        <Pressable
                          key={mode}
                          onPress={() => { h.selection(); setMaxMode(mode); }}
                          style={{
                            flex: 1, paddingVertical: 6, borderRadius: 8,
                            backgroundColor: maxMode === mode ? p.fg : p.pillBg,
                            borderWidth: 1, borderColor: maxMode === mode ? p.fg : p.border,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            color: maxMode === mode ? p.bg : p.fgMuted,
                            fontSize: 11, fontWeight: '600',
                          }}>
                            {mode === 'fiat' ? fiatCurrency : currency}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <NumberField 
                      palette={p} 
                      value={maxLimit} 
                      onChangeText={setMax} 
                      placeholder={maxMode === 'fiat' ? '2000' : '500'}
                      suffix={maxMode === 'fiat' ? fiatCurrency : currency}
                      error={maxOverTotal}
                    />
                  </SheetSection>
                </View>
              </View>

              {/* Limits hint / errors */}
              {(totalFiat > 0 || minOverTotal || maxOverTotal || minOverMax) && (
                <Text style={{
                  color: minOverTotal || maxOverTotal || minOverMax ? p.redFg : p.fgMuted,
                  fontSize: 12, fontWeight: '600', marginTop: 8, marginLeft: 4, lineHeight: 17,
                }}>
                  {minOverTotal
                    ? `Min limit must be ≤ total listing value (${totalFiat.toLocaleString()} ${fiatCurrency}).`
                    : maxOverTotal
                      ? `Max limit must be ≤ total listing value (${totalFiat.toLocaleString()} ${fiatCurrency}).`
                      : minOverMax
                        ? 'Min limit must be ≤ max limit.'
                        : `Total listing value: ${totalFiat.toLocaleString()} ${fiatCurrency}`}
                </Text>
              )}

              {/* Payment methods */}
              <SheetSection title={t('p2p.paymentMethod').toUpperCase()} palette={p}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {METHODS.map((m) => {
                    const on = methods.includes(m);
                    return (
                      <Pressable
                        key={m}
                        onPress={() => toggleMethod(m)}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                          backgroundColor: on ? p.fg : p.pillBg,
                          borderWidth: 1, borderColor: on ? p.fg : p.border,
                        }}
                      >
                        <Text style={{ color: on ? p.bg : p.fg, fontSize: 12, fontWeight: '700' }}>
                          {m}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </SheetSection>

              {/* Cash → city */}
              {hasCash && (
                <SheetSection title="CITY (CASH MEETUP)" palette={p}>
                  <View style={{ height: 56, borderRadius: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                    <TextInput value={city} onChangeText={setCity} placeholder="e.g. London" placeholderTextColor={p.fgFaint} style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '600' }} />
                  </View>
                </SheetSection>
              )}

              {/* Payment timeframe */}
              <SheetSection title="PAYMENT WINDOW (MINUTES)" palette={p}>
                <NumberField palette={p} value={timeframeMins} onChangeText={setTimeframe} placeholder="30" suffix="min" />
                <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', marginTop: 6 }}>
                  Default 30 min · Cash meetups can be longer (e.g. 240)
                </Text>
              </SheetSection>

              {/* Anonymous toggle */}
              <SheetSection title="IDENTITY" palette={p}>
                <Pressable
                  onPress={() => { h.selection(); setAnonymous((v) => !v); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: anonymous ? p.fg : p.border }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: anonymous ? p.fg : p.border, backgroundColor: anonymous ? p.fg : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {anonymous && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.bg }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>Post anonymously</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 2 }}>Your @handle won't appear on this listing</Text>
                  </View>
                </Pressable>
              </SheetSection>

              <Section title="NOTES" palette={p}>
                <Pressable
                  onPress={() => setShowTerms(!showTerms)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <Ionicons
                    name={showTerms ? 'remove-circle-outline' : 'add-circle-outline'}
                    size={18}
                    color={p.fg}
                  />
                  <Text style={{ color: p.fg, fontWeight: '700' }}>
                    {showTerms ? 'Hide notes' : 'Add notes'}
                  </Text>
                </Pressable>

                {showTerms && (
                  <View
                    style={{
                      borderRadius: 16,
                      backgroundColor: p.bgElev,
                      borderWidth: 1,
                      borderColor: p.border,
                    }}
                  >
                    <TextInput
                      value={terms}
                      onChangeText={setTerms}
                      multiline
                      placeholder="Optional instructions..."
                      placeholderTextColor={p.fgFaint}
                      style={{
                        color: p.fg,
                        padding: 16,
                        minHeight: 90,
                        textAlignVertical: 'top',
                      }}
                    />
                  </View>
                )}
              </Section>
            </ScrollView>

            {/* Sticky CTA footer */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingHorizontal: 20,
                paddingTop: 14,
                paddingBottom: insets.bottom + 12,
                backgroundColor: p.bg,
                borderTopWidth: 1,
                borderTopColor: p.border,
              }}
            >
              <Pressable
                onPress={submit}
                disabled={!valid || create.isPending}
                style={({ pressed }) => ({
                  height: 56, borderRadius: 28,
                  backgroundColor: valid ? p.ctaBg : p.bgElev,
                  borderWidth: valid ? 0 : 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                  opacity: (!valid || create.isPending) ? 0.6 : pressed ? 0.85 : 1,
                  shadowColor: valid ? p.ctaBg : 'transparent',
                  shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
                })}
              >
                {create.isPending
                  ? <ActivityIndicator size="small" color={p.ctaFg} />
                  : <Ionicons name="megaphone" size={16} color={valid ? p.ctaFg : p.fgMuted} />
                }
                <Text style={{
                  color: valid ? p.ctaFg : p.fgMuted,
                  fontSize: 16, fontWeight: '600', letterSpacing: -0.2,
                }}>
                  {create.isPending ? 'Posting…' : t('p2p.publishListing')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Small helpers ── */
function SheetSection({ title, palette: p, children }: { title: string; palette: Palette; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginLeft: 4, marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ChipRow({ palette: p, options, value, onPick }: {
  palette: Palette; options: string[]; value: string; onPick: (v: string) => void;
}) {
  const h = useHaptics();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => { h.selection(); onPick(o); }}
            style={{
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
              backgroundColor: on ? p.fg : p.pillBg,
              borderWidth: 1, borderColor: on ? p.fg : p.border,
            }}
          >
            <Text style={{ color: on ? p.bg : p.fg, fontSize: 13, fontWeight: '700' }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberField({ palette: p, value, onChangeText, placeholder, suffix, error }: {
  palette: Palette; value: string;
  onChangeText: (v: string) => void;
  placeholder: string; suffix?: string; error?: boolean;
}) {
  return (
    <View style={{
      height: 56, borderRadius: 14, backgroundColor: p.bgElev,
      borderWidth: error ? 1.5 : 1, borderColor: error ? p.redFg : p.border,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    }}>
      <TextInput
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/[^0-9.]/g, ''))}
        placeholder={placeholder}
        placeholderTextColor={p.fgFaint}
        keyboardType="decimal-pad"
        style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}
      />
      {suffix && (
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{suffix}</Text>
      )}
    </View>
  );
}
