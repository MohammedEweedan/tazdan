/**
 * Wallet tab - MoonPay-flavoured net-worth dashboard.
 *
 *  Header:        title + (+) action
 *  Net worth:     centred big number + 24h delta pill
 *  Segmented:     ALL · CRYPTO · FIAT · CARDS
 *  ALL:           3-tile hero grid splitting Crypto / Fiat / Cards totals
 *                 followed by the unified asset list.
 *  CRYPTO/FIAT:   filtered asset list.
 *  CARDS:         per-card panel with last4, status, daily limit + a
 *                 "Manage" CTA into /cards.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useWallets, useCards, useHaptics, useMarkets } from '@/hooks';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { getCurrencyMeta, normalizeCurrencyCode } from '@/constants';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { CardVisual } from '@/components/cards/CardVisual';
import type { Wallet, Currency, CardEntity } from '@/types';
import { TopGradient } from '@/components/ui/ScreenShell';

type Filter = 'ALL' | 'CRYPTO' | 'FIAT' | 'CARDS';

export default function WalletScreen() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const { data: wallets } = useWallets();
  const { data: cards } = useCards();
  const { data: tickers } = useMarkets();
  const [filter, setFilter] = useState<Filter>('ALL');

  // Persisted show/hide state for the Crypto + Fiat sections in the ALL view
  const [cryptoOpen, setCryptoOpen] = useState(true);
  const [fiatOpen, setFiatOpen]     = useState(true);
  useEffect(() => {
    AsyncStorage.multiGet(['wallet.cryptoOpen', 'wallet.fiatOpen']).then((pairs) => {
      const map = Object.fromEntries(pairs);
      if (map['wallet.cryptoOpen'] !== null) setCryptoOpen(map['wallet.cryptoOpen'] !== '0');
      if (map['wallet.fiatOpen']   !== null) setFiatOpen  (map['wallet.fiatOpen']   !== '0');
    }).catch(() => {});
  }, []);
  const toggleCrypto = () => {
    h.selection();
    setCryptoOpen((v) => {
      AsyncStorage.setItem('wallet.cryptoOpen', v ? '0' : '1').catch(() => {});
      return !v;
    });
  };
  const toggleFiat = () => {
    h.selection();
    setFiatOpen((v) => {
      AsyncStorage.setItem('wallet.fiatOpen', v ? '0' : '1').catch(() => {});
      return !v;
    });
  };

  /** Symbol -> live USD price. */
  const priceMap = useMemo(() => {
    const map: Partial<Record<Currency, number>> = {};
    (tickers ?? []).forEach((m) => {
      map[m.base as Currency] = m.price;
    });
    return map;
  }, [tickers]);

  /** Live USD value for a single wallet (balance × spot, with fiat fallback). */
  const valueOf = (w: Wallet) => {
    const normalized = normalizeCurrencyCode(w.currency);
    const live = normalized ? priceMap[normalized] : undefined;
    if (live !== undefined) return Number(w.balance) * live;
    return Number(w.fiatValueUsd ?? 0);
  };

  /** Buckets the user actually cares about. */
  const cryptoUsd = useMemo(
    () => (wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'crypto').reduce((s, w) => s + valueOf(w), 0),
    [wallets, priceMap],
  );
  const fiatUsd = useMemo(
    () => (wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat').reduce((s, w) => s + valueOf(w), 0),
    [wallets, priceMap],
  );
  const cardsUsd = useMemo(
    () => (cards ?? []).reduce((s, c: any) => s + Number(c.balance ?? 0), 0),
    [cards],
  );

  const list = useMemo<Wallet[]>(() => {
    if (!wallets) return [];
    if (filter === 'CRYPTO') return wallets.filter((w) => getCurrencyMeta(w.currency)?.kind === 'crypto');
    if (filter === 'FIAT')   return wallets.filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat');
    return wallets; // ALL
  }, [wallets, filter]);

  const totalUsd = cryptoUsd + fiatUsd + cardsUsd;

  // Calculate 24h change for crypto only (fiat doesn't have 24h change)
  const deltaPct = useMemo(() => {
    if (cryptoUsd <= 0 || !tickers || tickers.length === 0) return 0;
    let weightedChange = 0;
    let totalCryptoExposure = 0;
    (wallets ?? []).forEach((w) => {
      const normalized = normalizeCurrencyCode(w.currency);
      if (!normalized || getCurrencyMeta(w.currency)?.kind !== 'crypto') return;
      const m = tickers.find((t) => t.base === normalized);
      if (!m || m.changePct24h === undefined || m.changePct24h === 0) return;
      const exposure = Number(w.balance) * m.price;
      weightedChange += exposure * m.changePct24h;
      totalCryptoExposure += exposure;
    });
    if (totalCryptoExposure <= 0) return 0;
    return weightedChange / totalCryptoExposure;
  }, [wallets, tickers, cryptoUsd]);

  const deltaUsd = (cryptoUsd * deltaPct) / 100;
  const positive = deltaPct >= 0;

  const [breakdownVisible, setBreakdownVisible] = useState(false);

  const swipeGesture = Gesture.Pan()
    .onEnd(() => {
      runOnJS(setBreakdownVisible)(true);
    });

  const formatFiat = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
          }}>
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}>
              {t('wallet.title') || 'Wallets'}
            </Text>
            <Pressable
              hitSlop={6}
              onPress={() => { h.light(); router.push('/cards'); }}
              accessibilityLabel="Manage cards"
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

          {/* Net worth with swipe gesture */}
          <GestureDetector gesture={swipeGesture}>
            <Pressable
              onPress={() => { h.light(); setBreakdownVisible(true); }}
              style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}
            >
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                {t('home.totalBalance')}
              </Text>
              <Text style={{ color: p.fg, fontSize: 42, fontWeight: '700', letterSpacing: -0.8 }}>
                {formatFiat(totalUsd)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Text style={{
                  color: positive ? p.greenFg : p.redFg,
                  fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'],
                }}>
                  {positive ? '+' : '-'}{formatFiat(Math.abs(deltaUsd))}
                </Text>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7,
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
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 8 }}>
                {t('wallet.swipeBreakdown')}
              </Text>
            </Pressable>
          </GestureDetector>

          {/* Segmented filter */}
          <View style={{
            flexDirection: 'row',
            marginHorizontal: 24, marginTop: 18,
            padding: 4,
            borderRadius: 14,
            backgroundColor: p.pillBg,
            gap: 4,
          }}>
            {(['ALL', 'CRYPTO', 'FIAT', 'CARDS'] as Filter[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => { h.selection(); setFilter(f); }}
                style={{ flex: 1 }}
              >
                <View style={{
                  paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                  backgroundColor: filter === f ? p.accent : 'transparent',
                }}>
                  <Text style={{
                    color: filter === f ? p.accentFg : p.fgMuted,
                    fontWeight: '700', fontSize: 11, letterSpacing: 0.6,
                  }}>
                    {f === 'CARDS' ? t('home.cards') : t(`wallet.${f.toLowerCase()}`)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* ALL: 3-tile hero split */}
          {filter === 'ALL' && (
            <View style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 18, marginHorizontal: 24,
            }}>
              <BucketTile palette={p} icon="logo-bitcoin" label={t('wallet.crypto')} usd={cryptoUsd} count={(wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'crypto').length} accent="#f7931a" />
              <BucketTile palette={p} icon="cash-outline" label={t('wallet.fiat')}   usd={fiatUsd}   count={(wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat').length}   accent="#22c55e" />
              <BucketTile palette={p} icon="card-outline" label={t('home.cards')}  usd={cardsUsd}  count={cards?.length ?? 0} accent="#7c3aed" />
            </View>
          )}

          {/* CARDS view */}
          {filter === 'CARDS' ? (
            <View style={{ paddingHorizontal: 24, marginTop: 18, gap: 12 }}>
              {(cards ?? []).length === 0 ? (
                <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                  <Ionicons name="card-outline" size={36} color={p.fgFaint} />
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 12 }}>
                    {t('cards.noneIssued')}
                  </Text>
                  <Pressable
                    onPress={() => { h.medium(); router.push('/cards'); }}
                    style={{
                      alignSelf: 'stretch', width: '100%',
                      marginTop: 14, height: 52, borderRadius: 26,
                      backgroundColor: p.ctaBg,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '700' }}>{t('cards.orderCard')}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {/*
                   * Premium card carousel - real artwork (Starter / Master /
                   * Pro PNGs), masked PAN/CVV/expiry by default, biometric
                   * reveal on tap of the eye icon. See `CardVisual` for the
                   * full security flow.
                   */}
                  {(cards as CardEntity[]).map((c) => (
                    <View key={c.id} style={{ gap: 12 }}>
                      <CardVisual card={c} />
                      <Pressable
                        onPress={() => { h.selection(); router.push('/cards'); }}
                        style={({ pressed }) => ({
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
                          backgroundColor: pressed ? p.border : p.bgElev,
                          borderWidth: 1, borderColor: p.border,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{
                            width: 8, height: 8, borderRadius: 4,
                            backgroundColor: c.status === 'ACTIVE' ? '#10b981' : c.status === 'FROZEN' ? '#63a1db' : p.fgFaint,
                          }} />
                          <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>
                            {c.status === 'ACTIVE' ? t('cards.active') : c.status === 'FROZEN' ? t('cards.frozen') : c.status}
                          </Text>
                          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
                            · ${Number((c as any).spentMonth ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} {t('cards.thisMonth')}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => { h.light(); router.push('/cards'); }}
                    style={({ pressed }) => ({
                      marginTop: 6, height: 48, borderRadius: 24,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 6,
                      backgroundColor: pressed ? p.border : p.pillBg,
                      borderWidth: 1, borderColor: p.border,
                    })}
                  >
                    <Ionicons name="settings-outline" size={14} color={p.fg} />
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{t('cards.manage')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : filter === 'ALL' ? (
            <>
              <View style={{ height: 1, backgroundColor: p.border, marginTop: 18 }} />

              {/* CRYPTO section */}
              <SectionHeader
                palette={p}
                label={t('wallet.crypto') || 'Crypto'}
                count={(wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'crypto').length}
                usd={cryptoUsd}
                open={cryptoOpen}
                onToggle={toggleCrypto}
              />
              {cryptoOpen && (wallets ?? [])
                .filter((w) => getCurrencyMeta(w.currency)?.kind === 'crypto')
                .map((w) => (<AssetRow key={w.id} wallet={w} palette={p} valueUsd={valueOf(w)} onPress={() => h.selection()}  />))}

              {/* FIAT section */}
              <SectionHeader
                palette={p}
                label={t('wallet.fiat') || 'Fiat'}
                count={(wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat').length}
                usd={fiatUsd}
                open={fiatOpen}
                onToggle={toggleFiat}
              />
              {fiatOpen && (wallets ?? [])
                .filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat')
                .map((w) => (<AssetRow key={w.id} wallet={w} palette={p} valueUsd={valueOf(w)} onPress={() => h.selection()}  />))}
            </>
          ) : (
            <>
              <View style={{ height: 1, backgroundColor: p.border, marginTop: 18 }} />
              {list.map((w) => (
                <AssetRow key={w.id} wallet={w} palette={p} valueUsd={valueOf(w)} onPress={() => h.selection()}  />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Balance breakdown modal */}
      <Modal
        visible={breakdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBreakdownVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => { h.light(); setBreakdownVisible(false); }}
          />
          <View style={{
            backgroundColor: p.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 40,
          }}>
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: p.border,
              alignSelf: 'center',
              marginBottom: 20,
            }} />
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
              {t('wallet.balanceBreakdown')}
            </Text>

            {/* Crypto section */}
            <Pressable
              onPress={() => {
                h.light();
                setBreakdownVisible(false);
                router.push('/portfolio/crypto');
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 16,
                borderBottomWidth: 1, borderBottomColor: p.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(247,147,26,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 20 }}>₿</Text>
                </View>
                <View>
                  <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                    {t('wallet.crypto')}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 13 }}>
                    {(wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'crypto').length} {t('wallet.assetsCount')}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                  {formatFiat(cryptoUsd)}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 12 }}>
                  {Math.abs(deltaPct).toFixed(2)}% 24h
                </Text>
              </View>
            </Pressable>

            {/* Fiat section */}
            <Pressable
              onPress={() => {
                h.light();
                setBreakdownVisible(false);
                router.push('/portfolio/fiat');
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 16,
                borderBottomWidth: 1, borderBottomColor: p.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(34,197,94,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 20 }}>$</Text>
                </View>
                <View>
                  <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                    {t('wallet.fiat')}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 13 }}>
                    {(wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat').length} {t('wallet.currenciesCount')}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                  {formatFiat(fiatUsd)}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 12 }}>
                  {t('wallet.no24hChange')}
                </Text>
              </View>
            </Pressable>

            {/* Cards section */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingVertical: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(168,85,247,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="card" size={20} color="#a855f7" />
                </View>
                <View>
                  <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                    {t('home.cards')}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 13 }}>
                    {cards?.length || 0} {t('wallet.cardsCount')}
                  </Text>
                </View>
              </View>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                {formatFiat(cardsUsd)}
              </Text>
            </View>

            <Pressable
              onPress={() => { h.light(); setBreakdownVisible(false); }}
              style={{
                marginTop: 20,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: p.pillBg,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>
                {t('common.close')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ── Helpers ─────────────────────────────────────── */

/**
 * Collapsible section header for the Crypto / Fiat asset groups.
 * Tap anywhere on the row to show/hide the asset list beneath.
 */
function SectionHeader({
  palette: p, label, count, usd, open, onToggle,
}: {
  palette: Palette;
  label: string;
  count: number;
  usd: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: p.border,
      }}
    >
      {/* Label + count */}
      <Text style={{
        color: p.fg, fontSize: 13, fontWeight: '800',
        letterSpacing: 0.8, textTransform: 'uppercase',
      }}>
        {label}
      </Text>
      <View style={{
        marginLeft: 8,
        paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9,
        backgroundColor: p.pillBg,
      }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700' }}>
          {count}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      {/* Section total */}
      <Text style={{
        color: p.fgMuted, fontSize: 13, fontWeight: '700',
        fontVariant: ['tabular-nums'],
        marginRight: 10,
      }}>
        ${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </Text>

      {/* Explicit Show / Hide button */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Hide' : 'Show'} ${label}`}
        hitSlop={6}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingLeft: 10, paddingRight: 8, height: 28,
          borderRadius: 14,
          backgroundColor: pressed ? p.bgRaised : p.pillBg,
          borderWidth: 1, borderColor: p.border,
        })}
      >
        <Text style={{
          color: p.fg, fontSize: 11, fontWeight: '800',
          letterSpacing: 0.6,
        }}>
          {open ? 'HIDE' : 'SHOW'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={p.fg}
        />
      </Pressable>
    </View>
  );
}

/**
 * A single asset row. Extracted so the same render path is used in
 * the ALL view (per-section) and the filtered CRYPTO/FIAT views.
 */
function AssetRow({
  wallet: w, palette: p, valueUsd, onPress,
}: {
  wallet: Wallet;
  palette: Palette;
  valueUsd: number;
  onPress: () => void;
}) {
  const meta = getCurrencyMeta(w.currency);
  if (!meta) return null;
  const isCrypto = meta.kind === 'crypto';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16,
        backgroundColor: pressed ? p.bgElev : 'transparent',
        borderBottomWidth: 1, borderBottomColor: p.border,
      })}
    >
      <View style={{ marginRight: 14 }}>
        {isCrypto ? (
          <CoinIcon symbol={w.currency} size={42} />
        ) : (
          <Text style={{ color: p.fg, fontSize: 28, lineHeight: 42, width: 42, textAlign: 'center' }}>
            {meta.flagOrIcon}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
          {meta.name}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
          {Number(w.balance).toLocaleString('en-US', {
            maximumFractionDigits: meta.decimals,
          })} {w.currency}
        </Text>
      </View>
      <Text style={{
        color: p.fg, fontSize: 15, fontWeight: '700',
        fontVariant: ['tabular-nums'],
      }}>
        ${valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
    </Pressable>
  );
}

function BucketTile({
  palette: p, icon, label, usd, count, accent,
}: {
  palette: Palette;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  usd: number;
  count: number;
  accent: string;
}) {
  const t = useT();
  return (
    <View style={{
      flex: 1,
      borderRadius: 18,
      backgroundColor: p.bgElev,
      borderWidth: 1, borderColor: p.border,
      padding: 14,
      gap: 10,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: `${accent}22`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <View>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
          {label.toUpperCase()}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: p.fg, fontSize: 17, fontWeight: '600',
            marginTop: 2, fontVariant: ['tabular-nums'],
          }}
        >
          ${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', marginTop: 2 }}>
          {count} {count === 1 ? t('wallet.item') : t('wallet.items')}
        </Text>
      </View>
    </View>
  );
}
