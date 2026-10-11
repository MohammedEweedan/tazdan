/**
 * P2P marketplace — theme-aware.
 * "Create listing" and "Start trade" both happen as inline bottom sheets,
 * no page navigation required.
 */

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useP2POffers, useHaptics, useCreateP2PListing, useInitiateP2PTrade, useWallets, useMarkets,
} from '@/hooks';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import type { Currency, MarketTicker, P2POffer } from '@/types';
import { TopGradient, SectionLabel, Panel, ToggleRow } from '@/components/ui/ScreenShell';
import { HEADER, HeaderIconButton, TabHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApproxLocation, openLocationSettings } from '@/hooks/useApproxLocation';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useFeatures } from '@/hooks/useFeatures';

import { BottomSheet } from '@/components/ui/BottomSheet';
type Side = 'BUY' | 'SELL';
type TFn = (k: string, v?: Record<string, string | number>) => string;
const FIATS: Currency[]   = ['LYD', 'AED', 'SAR', 'EGP', 'USD', 'EUR'];
// CRYPTOS is now dynamic — built from user holdings + market tickers in CreateListingSheet
const FIAT_OPTIONS        = ['LYD', 'AED', 'SAR', 'EGP', 'USD', 'EUR', 'GBP'] as const;
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
  const rtl = useI18n((s) => s.locale === 'ar');
  const themeMode = useTheme((s) => s.mode);
  const features = useFeatures();
  const location = useApproxLocation();
  // The tab is what the USER wants to do. Buying means taking someone's
  // SELL listing (the server makes the taker the buyer), and vice versa.
  const [side, setSide] = useState<Side>('BUY');
  const [fiat, setFiat] = useState<Currency | 'ALL'>('ALL');
  const [nearMe, setNearMe] = useState(false);
  const near = nearMe && location.status === 'granted' ? location.coords : null;
  const offersQuery = useP2POffers(side === 'BUY' ? 'SELL' : 'BUY', near);
  const offers = offersQuery.data;
  const [refreshing, setRefreshing] = useState(false);

  const [selectedOffer, setSelectedOffer] = useState<P2POffer | null>(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [cryptoSearch, setCryptoSearch]   = useState('');

  const filtered = useMemo(() => {
    const list = offers ?? [];
    const byFiat = fiat === 'ALL' ? list : list.filter((o) => o.quote === fiat);
    const q = cryptoSearch.trim().toLowerCase();
    return q ? byFiat.filter((o) => o.base.toLowerCase().includes(q)) : byFiat;
  }, [offers, fiat, cryptoSearch]);
  const nearby = near ? filtered.filter((o) => o.distanceKm !== undefined) : [];
  const others = near ? filtered.filter((o) => o.distanceKm === undefined) : filtered;

  const toggleNearMe = async () => {
    h.selection();
    if (nearMe) { setNearMe(false); return; }
    setNearMe(true);
    if (location.status !== 'granted') await location.request();
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      if (nearMe) await location.request();
      await offersQuery.refetch();
    } finally { setRefreshing(false); }
  };

  const card = (o: P2POffer) => (
    <OfferCard key={o.id} offer={o} palette={p} t={t} rtl={rtl} userSide={side}
      onPress={() => { h.light(); setSelectedOffer(o); }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <TabHeader
          title={t('p2p.title')}
          right={
            <>
              <HeaderIconButton icon="receipt-outline" label={t('p2p.trades')} onPress={() => router.push('/p2p/trades')} />
              {features.p2p && (
                <HeaderIconButton icon="add" label={t('p2p.createListing')} variant="primary" onPress={() => setShowCreate(true)} />
              )}
            </>
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.accentText} colors={[p.accent]} />}
        >
          <View style={{ paddingHorizontal: HEADER.gutter }}>
            {!features.p2p && (
              <View style={{ marginBottom: 12 }}>
                <StatusBanner kind="info" message={t('features.p2pPaused')} />
              </View>
            )}
            <SegmentedControl<Side> value={side} onChange={(v) => { setSide(v); setSelectedOffer(null); }} options={[
              { key: 'BUY', label: t('p2p.buy') },
              { key: 'SELL', label: t('p2p.sell') },
            ]} />
            <Text style={{ color: p.fgMuted, fontSize: 12.5, lineHeight: 18, marginTop: 10, marginHorizontal: 4 }}>
              {side === 'BUY' ? t('p2p.buyHint') : t('p2p.sellHint')}
            </Text>
          </View>

          {/* Filters stay pinned while the list scrolls. */}
          <View style={{ backgroundColor: p.bg, paddingTop: 12, paddingBottom: 10 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: HEADER.gutter, gap: 8 }}
            >
              <Chip palette={p} active={nearMe} onPress={toggleNearMe} label={t('p2p.nearMe')}
                icon={location.status === 'locating' ? undefined : 'navigate'} loading={location.status === 'locating'} />
              <View style={{ width: 1, marginVertical: 8, backgroundColor: p.border }} />
              <Chip palette={p} active={fiat === 'ALL'} onPress={() => { h.selection(); setFiat('ALL'); }} label={t('wallet.all')} />
              {FIATS.map((f) => (
                <Chip key={f} palette={p} active={fiat === f} onPress={() => { h.selection(); setFiat(f); }} label={f} />
              ))}
            </ScrollView>

            <View style={{
              marginHorizontal: HEADER.gutter, marginTop: 10,
              flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10,
              height: 44, borderRadius: 14,
              backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
              paddingHorizontal: 14,
            }}>
              <Ionicons name="search" size={16} color={p.fgFaint} />
              <TextInput
                value={cryptoSearch}
                onChangeText={setCryptoSearch}
                placeholder={t('p2p.searchAsset')}
                placeholderTextColor={p.fgFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={t('p2p.searchAsset')}
                style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '500', textAlign: rtl ? 'right' : 'left' }}
              />
              {cryptoSearch.length > 0 && (
                <Pressable onPress={() => setCryptoSearch('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                  <Ionicons name="close-circle" size={16} color={p.fgFaint} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={{ paddingHorizontal: HEADER.gutter, paddingTop: 6 }}>
            {nearMe && (location.status === 'denied' || location.status === 'unavailable') && (
              <View style={{
                flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12,
                padding: 14, borderRadius: 16, marginBottom: 14,
                backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder,
              }}>
                <Ionicons name="location-outline" size={18} color={p.accentText} />
                <Text style={{ flex: 1, color: p.fg, fontSize: 13, lineHeight: 19 }}>
                  {location.status === 'denied' ? t('p2p.locationDenied') : t('p2p.locationUnavailable')}
                </Text>
                {location.status === 'denied' && !location.canAskAgain ? (
                  <Pressable onPress={openLocationSettings} hitSlop={8} accessibilityRole="button">
                    <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '600' }}>{t('p2p.openSettings')}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => location.request()} hitSlop={8} accessibilityRole="button">
                    <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '600' }}>{t('common.retry')}</Text>
                  </Pressable>
                )}
              </View>
            )}

            {offersQuery.isPending ? (
              <View style={{ gap: 12 }}>{[0, 1, 2].map((n) => <Skeleton key={n} height={168} radius={22} />)}</View>
            ) : offersQuery.isError ? (
              <EmptyState icon="cloud-offline-outline" title={t('common.error')} actionLabel={t('common.retry')} onAction={refresh} />
            ) : filtered.length === 0 ? (
              <EmptyState icon="storefront-outline" title={t('p2p.noOffers')} message={t('p2p.noOffersBody')}
                actionLabel={features.p2p ? t('p2p.createListing') : undefined}
                onAction={features.p2p ? () => setShowCreate(true) : undefined} />
            ) : near ? (
              <>
                <SectionLabel first>{t('p2p.nearYou')}</SectionLabel>
                {nearby.length > 0 ? <View style={{ gap: 12 }}>{nearby.map(card)}</View> : (
                  <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, marginHorizontal: 4 }}>{t('p2p.noneNearby')}</Text>
                )}
                {others.length > 0 && <>
                  <SectionLabel>{t('p2p.elsewhere')}</SectionLabel>
                  <View style={{ gap: 12 }}>{others.map(card)}</View>
                </>}
              </>
            ) : (
              <View style={{ gap: 12 }}>{filtered.map(card)}</View>
            )}
          </View>
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
function Chip({ active, onPress, label, icon, loading, palette: p }: {
  active: boolean; onPress: () => void; label: string;
  icon?: keyof typeof Ionicons.glyphMap; loading?: boolean; palette: Palette;
}) {
  const fg = active ? p.accentFg : p.fg;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        height: 36, paddingHorizontal: 14, borderRadius: 18,
        backgroundColor: active ? p.accent : p.bgElev,
        borderWidth: 1, borderColor: active ? p.accent : p.border,
        opacity: pressed ? 0.75 : 1,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      })}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** "128 trades · 98%" once a trader has history; "New trader" before. */
function traderStatsLabel(trader: P2POffer['trader'], t: TFn): string {
  const n = trader.completedTrades ?? trader.orders ?? 0;
  if (!n) return t('p2p.newTrader');
  const rate = trader.completionRate;
  return rate == null ? t('p2p.tradesCount', { count: n }) : `${t('p2p.tradesCount', { count: n })} · ${rate}%`;
}

// Stored method names → translation keys. Brand names (Wise, Revolut, PayPal) stay as-is.
const METHOD_KEYS: Record<string, string> = {
  'Bank Transfer': 'p2p.method.bank', BANK_TRANSFER: 'p2p.method.bank',
  'Cash': 'p2p.method.cash', CASH: 'p2p.method.cash',
  'Internal Wallet': 'p2p.method.internal', INTERNAL_WALLET: 'p2p.method.internal',
};
const methodLabel = (m: string, t: TFn) => (METHOD_KEYS[m] ? t(METHOD_KEYS[m]) : m);

/* ── Offer card ── */
function OfferCard({ offer, palette: p, t, rtl, userSide, onPress }: {
  offer: P2POffer; palette: Palette; t: TFn; rtl: boolean; userSide: Side; onPress: () => void;
}) {
  const row = rtl ? 'row-reverse' as const : 'row' as const;
  const price = Number(offer.price);
  const initial = offer.trader.anonymous ? '' : offer.trader.handle.replace('@', '').charAt(0).toUpperCase();
  const place = [offer.distanceKm !== undefined ? t('p2p.kmAway', { km: offer.distanceKm }) : null, offer.city]
    .filter(Boolean).join(' · ');
  const action = userSide === 'BUY' ? t('p2p.actionBuy', { asset: offer.base }) : t('p2p.actionSell', { asset: offer.base });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.trader.anonymous ? t('p2p.anonymous') : offer.trader.handle}, ${price} ${offer.quote} ${offer.base}${place ? `, ${place}` : ''}`}
      style={({ pressed }) => ({
        padding: 18, borderRadius: 22,
        backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {/* Trader */}
      <View style={{ flexDirection: row, alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
        }}>
          {offer.trader.anonymous
            ? <Ionicons name="eye-off-outline" size={17} color={p.fgMuted} />
            : <Text style={{ color: p.fg, fontWeight: '700', fontSize: 15 }}>{initial}</Text>}
        </View>
        <View style={{ flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 5 }}>
            <Text numberOfLines={1} style={{ color: offer.trader.anonymous ? p.fgMuted : p.fg, fontSize: 15, fontWeight: '600' }}>
              {offer.trader.anonymous ? t('p2p.anonymous') : offer.trader.handle}
            </Text>
            {offer.trader.verified && <Ionicons name="checkmark-circle" size={14} color={p.accentText} accessibilityLabel={t('p2p.verified')} />}
          </View>
          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{traderStatsLabel(offer.trader, t)}</Text>
        </View>
        {!!place && (
          <View style={{
            flexDirection: row, alignItems: 'center', gap: 4, maxWidth: '42%',
            paddingHorizontal: 9, height: 26, borderRadius: 13, backgroundColor: p.accentSoft,
          }}>
            <Ionicons name="location" size={11} color={p.accentText} />
            <Text numberOfLines={1} style={{ color: p.accentText, fontSize: 11.5, fontWeight: '600' }}>{place}</Text>
          </View>
        )}
      </View>

      {/* Price + action */}
      <View style={{ flexDirection: row, alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 }}>
        <View style={{ alignItems: rtl ? 'flex-end' : 'flex-start' }}>
          <Text style={{ color: p.fg, fontSize: 26, fontWeight: '600', letterSpacing: -0.8, fontVariant: ['tabular-nums'] }}>
            {price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', letterSpacing: 0 }}> {offer.quote}</Text>
          </Text>
          <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 2 }}>{t('p2p.perUnit', { asset: offer.base })}</Text>
        </View>
        <View style={{ height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: p.ctaBg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '600' }}>{action}</Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: p.border, marginVertical: 14 }} />

      {/* Terms */}
      <View style={{ flexDirection: row, justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
          <Text style={{ color: p.fgFaint, fontSize: 11.5 }}>{t('p2p.limits')}</Text>
          <Text numberOfLines={1} style={{ color: p.fg, fontSize: 13, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] }}>
            {Number(offer.minLimit).toLocaleString('en-US', { maximumFractionDigits: 2 })} – {Number(offer.maxLimit).toLocaleString('en-US', { maximumFractionDigits: 2 })} {offer.quote}
          </Text>
        </View>
        <View style={{ alignItems: rtl ? 'flex-start' : 'flex-end' }}>
          <Text style={{ color: p.fgFaint, fontSize: 11.5 }}>{t('p2p.available')}</Text>
          <Text numberOfLines={1} style={{ color: p.fg, fontSize: 13, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] }}>
            {Number(offer.available).toLocaleString('en-US', { maximumFractionDigits: 6 })} {offer.base}
          </Text>
        </View>
      </View>
      {offer.paymentMethods.length > 0 && (
        <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 12, marginTop: 10, textAlign: rtl ? 'right' : 'left' }}>
          {offer.paymentMethods.map((m) => methodLabel(m, t)).join(' · ')}
        </Text>
      )}
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
    <BottomSheet
      visible
      onClose={onClose}
      // What the viewer does here — taking a BUY listing means selling.
      title={isBuy ? t('p2p.actionSell', { asset: offer.base }) : t('p2p.actionBuy', { asset: offer.base })}
      scroll={false}
      contentStyle={{ paddingHorizontal: 0 }}
    >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            >
              {/* Trader info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                  {offer.trader.anonymous
                    ? <Ionicons name="eye-off-outline" size={19} color={p.fgMuted} />
                    : <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600' }}>{offer.trader.handle.replace('@', '').charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {offer.trader.anonymous
                      ? <Text style={{ color: p.fgMuted, fontSize: 16, fontWeight: '600' }}>{t('p2p.anonymous')}</Text>
                      : <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}>{offer.trader.handle}</Text>
                    }
                    {offer.trader.verified && <Ionicons name="checkmark-circle" size={15} color={p.accentText} />}
                  </View>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                    {traderStatsLabel(offer.trader, t)}
                    {offer.timeframeMins ? ` · ${t('p2p.payWithin', { mins: offer.timeframeMins })}` : ''}
                  </Text>
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
                          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: active ? p.accent : p.pillBg, borderWidth: 1, borderColor: active ? p.accent : p.border }}>
                          <Text style={{ color: active ? p.accentFg : p.fgMuted, fontSize: 12, fontWeight: '700' }}>{m}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {selectedMethod === 'Cash' && (offer.city || offer.distanceKm !== undefined) && (
                    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder }}>
                      <Ionicons name="location" size={14} color={p.accentText} />
                      <Text style={{ flex: 1, color: p.fg, fontSize: 12.5, fontWeight: '500', lineHeight: 18 }}>
                        {[offer.city ? t('p2p.meetIn', { place: [offer.city, offer.country].filter(Boolean).join(', ') }) : null,
                          offer.distanceKm !== undefined ? t('p2p.kmAway', { km: offer.distanceKm }) : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  )}
                  {selectedMethod === 'Cash' && (
                    <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{t('p2p.cashSafety')}</Text>
                  )}
                </View>
              )}

              {/* Input mode toggle + amount */}
              <View style={{ marginTop: 20 }}>
                {/* fiat / crypto toggle */}
                <View style={{ flexDirection: 'row', backgroundColor: p.bgElev, borderRadius: 10, padding: 3, gap: 3, marginBottom: 10, alignSelf: 'flex-start' }}>
                  {(['fiat', 'crypto'] as const).map((mode) => (
                    <Pressable key={mode} onPress={() => { h.selection(); setInputMode(mode); setRawAmount(''); }}
                      style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: inputMode === mode ? p.accent : 'transparent' }}>
                      <Text style={{ color: inputMode === mode ? p.accentFg : p.fgMuted, fontSize: 11, fontWeight: '600' }}>
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
          </BottomSheet>
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
  const [fiatCurrency, setFiat]     = useState<typeof FIAT_OPTIONS[number]>('LYD');
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
  const [shareLocation, setShareLocation] = useState(false);
  const location = useApproxLocation();
  const hasCash = methods.includes('Cash');

  const toggleShareLocation = async (on: boolean) => {
    h.selection();
    if (!on) { setShareLocation(false); return; }
    setShareLocation(true);
    const coords = location.coords ?? await location.request();
    if (!coords) {
      setShareLocation(false);
      Alert.alert(t('p2p.shareDistance'),
        useApproxLocation.getState().status === 'denied' ? t('p2p.locationDenied') : t('p2p.locationUnavailable'),
        useApproxLocation.getState().canAskAgain
          ? [{ text: t('common.done') }]
          : [{ text: t('common.cancel'), style: 'cancel' }, { text: t('p2p.openSettings'), onPress: openLocationSettings }]);
    }
  };

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
        location: shareLocation && location.coords ? location.coords : undefined,
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
    <BottomSheet visible={true} onClose={onClose} title={t('p2p.createListing')} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 4,
                paddingBottom: 120,
              }}
            >
              {/* BUY / SELL toggle */}
              <View style={{
                flexDirection: 'row', backgroundColor: p.pillBg,
                borderRadius: 14, padding: 4, gap: 4,
              }}>
                {(['BUY', 'SELL'] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => { h.selection(); setSide(s); }}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
                      backgroundColor: side === s ? p.accent : 'transparent',
                    }}
                  >
                    <Text style={{
                      color: side === s ? p.accentFg : p.fgMuted,
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
                    <BottomSheet visible={showAssetPicker} onClose={() => setShowAssetPicker(false)} title={"Select Asset"} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
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
                        </BottomSheet>
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

                    <BottomSheet visible={showAssetPicker} onClose={() => setShowAssetPicker(false)} title={"Select Asset to Buy"} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
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
                                      <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? p.accentText : p.fgMuted }}>
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
                        </BottomSheet>
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
                            backgroundColor: minMode === mode ? p.accent : p.pillBg,
                            borderWidth: 1, borderColor: minMode === mode ? p.accent : p.border,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            color: minMode === mode ? p.accentFg : p.fgMuted,
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
                            backgroundColor: maxMode === mode ? p.accent : p.pillBg,
                            borderWidth: 1, borderColor: maxMode === mode ? p.accent : p.border,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            color: maxMode === mode ? p.accentFg : p.fgMuted,
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
                          backgroundColor: on ? p.accent : p.pillBg,
                          borderWidth: 1, borderColor: on ? p.accent : p.border,
                        }}
                      >
                        <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '700' }}>
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

              {/* Near-me discovery (opt-in) */}
              <SheetSection title={t('p2p.discovery').toUpperCase()} palette={p}>
                <Panel>
                  <ToggleRow
                    icon="navigate-outline"
                    label={t('p2p.shareDistance')}
                    description={t('p2p.shareDistanceBody')}
                    value={shareLocation}
                    onValueChange={toggleShareLocation}
                    disabled={location.status === 'locating'}
                    last
                  />
                </Panel>
              </SheetSection>

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
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: anonymous ? p.accent : p.border }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: anonymous ? p.accent : p.border, backgroundColor: anonymous ? p.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
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
          </BottomSheet>
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
              backgroundColor: on ? p.accent : p.pillBg,
              borderWidth: 1, borderColor: on ? p.accent : p.border,
            }}
          >
            <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 13, fontWeight: '700' }}>{o}</Text>
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
