/**
 * Wallet — everything you hold, in one calm view.
 *
 *  Hero      total value in the user's display currency, the cash/crypto
 *            split as one thin bar, and the three money moves.
 *  Filter    All · Fiat · Crypto · Cards
 *  Holdings  one Panel per kind, largest first. Empty wallets fold away
 *            behind a single "show" link so the list stays about money held.
 *
 * Values are estimates (live prices × balance) — the footnote says so.
 */
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { useWallets, useCards, useHaptics, useMarkets, useDisplayCurrency } from '@/hooks';
import { useFeatures } from '@/hooks/useFeatures';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { getCurrencyMeta, normalizeCurrencyCode } from '@/constants';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useUiStore } from '@/store/uiStore';
import { CardVisual } from '@/components/cards/CardVisual';
import { TopGradient, Panel, PanelRow, SectionLabel } from '@/components/ui/ScreenShell';
import { HEADER, HeaderIconButton, TabHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import type { Wallet } from '@/types';

type Filter = 'ALL' | 'FIAT' | 'CRYPTO' | 'CARDS';
type IconName = keyof typeof Ionicons.glyphMap;

const MASK = '••••••';

interface Holding {
  wallet: Wallet;
  kind: 'fiat' | 'crypto';
  usd: number;
  /** 24h price change in percent — crypto only, when the ticker has it. */
  change?: number;
}

export default function WalletScreen() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const theme = useTheme((s) => s.mode);
  const rtl = useI18n((s) => s.locale === 'ar');
  const dc = useDisplayCurrency();
  const hidden = useUiStore((s) => s.balancesHidden);
  const toggleHidden = useUiStore((s) => s.toggleBalancesHidden);
  const walletQuery = useWallets();
  const cardQuery = useCards();
  const { data: tickers } = useMarkets();
  const features = useFeatures();
  const cards = cardQuery.data ?? [];

  const [filter, setFilter] = useState<Filter>('ALL');
  const [showEmpty, setShowEmpty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [breakdown, setBreakdown] = useState(false);

  const holdings = useMemo<Holding[]>(() => {
    const tickerBy = new Map((tickers ?? []).map((m) => [m.base, m]));
    return (walletQuery.data ?? [])
      .map((wallet): Holding | null => {
        const kind = getCurrencyMeta(wallet.currency)?.kind;
        if (kind !== 'fiat' && kind !== 'crypto') return null;
        const symbol = normalizeCurrencyCode(wallet.currency);
        const ticker = symbol ? tickerBy.get(symbol) : undefined;
        const usd = ticker ? Number(wallet.balance) * ticker.price : Number(wallet.fiatValueUsd ?? 0);
        const change = kind === 'crypto' ? (ticker?.changePct24h ?? wallet.changePct24h) : undefined;
        return { wallet, kind, usd: Number.isFinite(usd) ? usd : 0, change };
      })
      .filter((x): x is Holding => x !== null)
      .sort((a, b) => b.usd - a.usd || Number(b.wallet.balance) - Number(a.wallet.balance));
  }, [walletQuery.data, tickers]);

  const fiat = holdings.filter((x) => x.kind === 'fiat');
  const crypto = holdings.filter((x) => x.kind === 'crypto');
  // Amounts are summed in the display currency. A wallet already in that
  // currency counts at its exact balance, not a USD round-trip.
  const inDisplay = (x: Holding) => (x.wallet.currency === dc.currency ? Number(x.wallet.balance) : dc.convert(x.usd));
  const fiatValue = fiat.reduce((sum, x) => sum + inDisplay(x), 0);
  const cryptoValue = crypto.reduce((sum, x) => sum + inDisplay(x), 0);
  const total = fiatValue + cryptoValue;
  const fiatShare = total > 0 ? fiatValue / total : 0;
  const ready = walletQuery.data !== undefined && !walletQuery.isError;

  const money = (amount: number) => (hidden ? MASK : dc.fmtDirect(amount));
  const pct = (share: number) => `${Math.round(share * 100)}%`;

  const refresh = async () => {
    setRefreshing(true);
    try { await Promise.all([walletQuery.refetch(), cardQuery.refetch()]); } finally { setRefreshing(false); }
  };
  const openAsset = (w: Wallet) => {
    h.selection();
    router.push({ pathname: '/asset/[currency]', params: { currency: w.currency } });
  };

  const visible = filter === 'FIAT' ? fiat : filter === 'CRYPTO' ? crypto : holdings;
  const held = (list: Holding[]) => (showEmpty ? list : list.filter((x) => Number(x.wallet.balance) > 0));
  const emptyCount = visible.filter((x) => Number(x.wallet.balance) <= 0).length;

  const holdingsPanel = (list: Holding[]) => (
    <Panel>
      {list.map((x, i) => (
        <AssetRow key={x.wallet.id} holding={x} value={money(inDisplay(x))} hidden={hidden} rtl={rtl}
          last={i === list.length - 1} onPress={() => openAsset(x.wallet)} />
      ))}
    </Panel>
  );

  const renderHoldings = () => {
    if (walletQuery.isPending) {
      return <View style={{ marginTop: 20 }}>{[0, 1, 2].map((n) => <SkeletonRow key={n} />)}</View>;
    }
    if (walletQuery.isError) {
      return <EmptyState icon="cloud-offline-outline" title={t('wallet.loadError')} message={t('wallet.loadErrorBody')}
        actionLabel={t('common.retry')} onAction={refresh} />;
    }
    const shownFiat = held(fiat);
    const shownCrypto = held(crypto);
    const shown = filter === 'FIAT' ? shownFiat : filter === 'CRYPTO' ? shownCrypto : [...shownFiat, ...shownCrypto];
    if (shown.length === 0 && emptyCount === 0) {
      return <EmptyState icon="wallet-outline" title={t('wallet.emptyTitle')} message={t('wallet.emptyBody')}
        actionLabel={t('action.topup')} onAction={() => router.push('/topup')} />;
    }
    return (
      <>
        {shown.length === 0 ? (
          <Text style={{ color: p.fgMuted, fontSize: 14, textAlign: 'center', marginTop: 32 }}>{t('wallet.nothingHeld')}</Text>
        ) : filter === 'ALL' ? (
          <>
            {!!shownFiat.length && <><SectionLabel first>{t('wallet.fiat')}</SectionLabel>{holdingsPanel(shownFiat)}</>}
            {!!shownCrypto.length && <><SectionLabel first={!shownFiat.length}>{t('wallet.crypto')}</SectionLabel>{holdingsPanel(shownCrypto)}</>}
          </>
        ) : (
          <View style={{ marginTop: 20 }}>{holdingsPanel(shown)}</View>
        )}
        {emptyCount > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => { h.selection(); setShowEmpty((v) => !v); }}
            style={({ pressed }) => ({ alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', marginTop: 10, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '600' }}>
              {showEmpty ? t('wallet.hideEmpty') : t('wallet.showEmpty', { count: emptyCount })}
            </Text>
          </Pressable>
        )}
      </>
    );
  };

  const renderCards = () => {
    if (cardQuery.isPending) return <View style={{ marginTop: 20 }}><Skeleton height={190} radius={24} /></View>;
    if (cardQuery.isError) {
      return <EmptyState icon="cloud-offline-outline" title={t('wallet.loadError')} message={t('wallet.loadErrorBody')}
        actionLabel={t('common.retry')} onAction={() => cardQuery.refetch()} />;
    }
    if (cards.length === 0) {
      return <EmptyState icon="card-outline" title={t('cards.noneIssued')}
        message={!features.cards ? t('features.cardsPaused') : undefined}
        actionLabel={features.cards ? t('cards.orderCard') : undefined}
        onAction={features.cards ? () => router.push('/cards') : undefined} />;
    }
    return (
      <View style={{ marginTop: 20, gap: 16 }}>
        {cards.map((card) => <CardVisual key={card.id} card={card} />)}
        <Button label={t('cards.manage')} variant="secondary" onPress={() => router.push('/cards')} />
        {!features.cards && <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 21 }}>{t('features.cardsPaused')}</Text>}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.accentText} colors={[p.accent]} />}
        >
          <TabHeader
            title={t('wallet.title')}
            right={<>
              <HeaderIconButton icon={hidden ? 'eye-off-outline' : 'eye-outline'}
                label={t(hidden ? 'wallet.showBalances' : 'wallet.hideBalances')}
                onPress={toggleHidden} />
              <HeaderIconButton icon="time-outline" label={t('home.activity')} onPress={() => router.push('/history')} />
            </>}
          />

          <View style={{ paddingHorizontal: HEADER.gutter }}>
            {/* ── Hero ─────────────────────────────────────────── */}
            <Pressable
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel={`${t('wallet.totalBalance')}, ${ready ? money(total) : ''}. ${t('wallet.balanceBreakdown')}`}
              onPress={() => { h.selection(); setBreakdown(true); }}
              style={{ paddingTop: 14, paddingBottom: 26 }}
            >
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{t('wallet.totalBalance')}</Text>
              <View style={{ marginTop: 8, minHeight: 54, justifyContent: 'center' }}>
                {walletQuery.isPending
                  ? <Skeleton width="62%" height={46} radius={12} />
                  : <HeroAmount text={ready ? money(total) : '—'} />}
              </View>

              {ready && total > 0 && (
                <View style={{ marginTop: 20 }}>
                  <AllocationBar share={fiatShare} fiatColor={p.accent} cryptoColor={p.fgFaint} track={p.pillBg} />
                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
                    <Legend color={p.accent} label={t('wallet.fiat')} value={pct(fiatShare)} rtl={rtl} />
                    <Legend color={p.fgFaint} label={t('wallet.crypto')} value={pct(1 - fiatShare)} rtl={rtl} />
                    <View style={{ flex: 1 }} />
                    <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={14} color={p.fgFaint} />
                  </View>
                </View>
              )}
            </Pressable>

            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 10, marginBottom: 30 }}>
              <MoneyAction icon="add" label={t('action.topup')} primary onPress={() => router.push('/topup')} />
              <MoneyAction icon="arrow-up" label={t('action.send')} onPress={() => router.push('/send')} />
              <MoneyAction icon="arrow-down" label={t('action.receive')} onPress={() => router.push('/receive')} />
            </View>

            <SegmentedControl<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { key: 'ALL', label: t('wallet.all') },
                { key: 'FIAT', label: t('wallet.fiat') },
                { key: 'CRYPTO', label: t('wallet.crypto') },
                { key: 'CARDS', label: t('home.cards') },
              ]}
            />

            {filter === 'CARDS' ? renderCards() : renderHoldings()}

            <Text style={{ color: p.fgFaint, fontSize: 12, lineHeight: 19, marginTop: 28, textAlign: 'center' }}>
              {t('wallet.valueNote')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <BottomSheet visible={breakdown} onClose={() => setBreakdown(false)} title={t('wallet.balanceBreakdown')}>
        <Panel>
          <PanelRow icon="cash-outline" label={t('wallet.fiat')} description={pct(fiatShare)} value={money(fiatValue)}
            onPress={() => { setBreakdown(false); router.push('/portfolio/fiat'); }} />
          <PanelRow icon="logo-bitcoin" label={t('wallet.crypto')} description={pct(1 - fiatShare)} value={money(cryptoValue)} last
            onPress={() => { setBreakdown(false); router.push('/portfolio/crypto'); }} />
        </Panel>
        <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 20, marginVertical: 20 }}>{t('wallet.valueNote')}</Text>
      </BottomSheet>
    </View>
  );
}

/** The headline figure. Cents step down in size and weight so the whole
 *  amount reads first. */
function HeroAmount({ text }: { text: string }) {
  const p = useThemedPalette();
  const m = /^(.*?)([.,]\d+)$/.exec(text);
  const [whole, fraction] = m ? [m[1], m[2]] : [text, ''];
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit
      style={{ color: p.fg, fontSize: 46, fontWeight: '600', letterSpacing: -1.6, fontVariant: ['tabular-nums'] }}>
      {whole}
      {!!fraction && <Text style={{ color: p.fgFaint, fontSize: 28, fontWeight: '500', letterSpacing: -0.6 }}>{fraction}</Text>}
    </Text>
  );
}

function AllocationBar({ share, fiatColor, cryptoColor, track }: {
  share: number; fiatColor: string; cryptoColor: string; track: string;
}) {
  // A sliver still shows when one side is tiny, so the split never looks broken.
  const fiatPct = share <= 0 ? 0 : share >= 1 ? 100 : Math.min(98, Math.max(2, share * 100));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: track, flexDirection: 'row', overflow: 'hidden', gap: fiatPct > 0 && fiatPct < 100 ? 3 : 0 }}>
      {fiatPct > 0 && <View style={{ width: `${fiatPct}%`, backgroundColor: fiatColor, borderRadius: 3 }} />}
      {fiatPct < 100 && <View style={{ flex: 1, backgroundColor: cryptoColor, borderRadius: 3 }} />}
    </View>
  );
}

function Legend({ color, label, value, rtl }: { color: string; label: string; value: string; rtl: boolean }) {
  const p = useThemedPalette();
  return (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{label}</Text>
      <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

/** Action tile: icon over label. `primary` marks the main move. */
function MoneyAction({ icon, label, onPress, primary }: {
  icon: IconName; label: string; onPress: () => void; primary?: boolean;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => { h.light(); onPress(); }}
      style={({ pressed }) => ({
        flex: 1, height: 76, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 7,
        backgroundColor: primary ? p.ctaBg : p.bgElev,
        borderWidth: primary ? 0 : 1, borderColor: p.border,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Ionicons name={icon} size={21} color={primary ? p.ctaFg : p.fg} />
      <Text numberOfLines={1} style={{ color: primary ? p.ctaFg : p.fg, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

function AssetRow({ holding, value, hidden, rtl, last, onPress }: {
  holding: Holding; value: string; hidden: boolean; rtl: boolean; last: boolean; onPress: () => void;
}) {
  const p = useThemedPalette();
  const { wallet, kind, change } = holding;
  const meta = getCurrencyMeta(wallet.currency);
  const balance = Number(wallet.balance);
  const empty = balance <= 0;
  const amount = hidden ? '••••' : balance.toLocaleString('en-US', {
    minimumFractionDigits: kind === 'fiat' ? 2 : 0,
    maximumFractionDigits: meta?.decimals ?? 8,
  });
  const up = (change ?? 0) >= 0;
  const align = rtl ? 'flex-start' : 'flex-end';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta?.name ?? wallet.currency}, ${value}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: 16, paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border,
        backgroundColor: pressed ? p.bgRaised : 'transparent',
        opacity: empty ? 0.55 : 1,
      })}
    >
      {kind === 'fiat' ? (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 21 }}>{meta?.flagOrIcon}</Text>
        </View>
      ) : (
        <CoinIcon symbol={wallet.currency} size={40} />
      )}

      <View style={{ flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
        <Text numberOfLines={1} style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{meta?.name ?? wallet.currency}</Text>
        <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 13, marginTop: 3, fontVariant: ['tabular-nums'] }}>
          {amount} {meta?.code ?? wallet.currency}
        </Text>
      </View>

      <View style={{ alignItems: align }}>
        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
        {change !== undefined && Number.isFinite(change) && !empty && (
          <Text style={{ color: up ? p.greenFg : p.redFg, fontSize: 12, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] }}>
            {up ? '+' : '−'}{Math.abs(change).toFixed(2)}%
          </Text>
        )}
      </View>
    </Pressable>
  );
}
