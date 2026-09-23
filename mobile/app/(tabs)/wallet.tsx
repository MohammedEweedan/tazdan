/** Wallet overview — shared surfaces and controls, real balances and working asset navigation. */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { useWallets, useCards, useHaptics, useMarkets } from '@/hooks';
import { useFeatures } from '@/hooks/useFeatures';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { getCurrencyMeta, normalizeCurrencyCode } from '@/constants';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { CardVisual } from '@/components/cards/CardVisual';
import { TopGradient, Panel, PanelRow } from '@/components/ui/ScreenShell';
import { HeaderIconButton, TabHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import type { Wallet } from '@/types';

type Filter = 'ALL' | 'CRYPTO' | 'FIAT' | 'CARDS';
const dollars = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WalletScreen() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const theme = useTheme((s) => s.mode);
  const walletQuery = useWallets();
  const cardQuery = useCards();
  const { data: tickers } = useMarkets();
  const features = useFeatures();
  const wallets = walletQuery.data ?? [];
  const cards = cardQuery.data ?? [];
  const [filter, setFilter] = useState<Filter>('ALL');
  const [hidden, setHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [breakdown, setBreakdown] = useState(false);
  const [cryptoOpen, setCryptoOpen] = useState(true);
  const [fiatOpen, setFiatOpen] = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet(['wallet.cryptoOpen', 'wallet.fiatOpen']).then((pairs) => {
      const map = Object.fromEntries(pairs);
      setCryptoOpen(map['wallet.cryptoOpen'] !== '0');
      setFiatOpen(map['wallet.fiatOpen'] !== '0');
    }).catch(() => {});
  }, []);
  const toggle = (kind: 'crypto' | 'fiat') => {
    h.selection();
    const next = !(kind === 'crypto' ? cryptoOpen : fiatOpen);
    (kind === 'crypto' ? setCryptoOpen : setFiatOpen)(next);
    AsyncStorage.setItem(`wallet.${kind}Open`, next ? '1' : '0').catch(() => {});
  };
  const refresh = async () => {
    setRefreshing(true);
    try { await Promise.all([walletQuery.refetch(), cardQuery.refetch()]); } finally { setRefreshing(false); }
  };
  const prices = useMemo(() => Object.fromEntries((tickers ?? []).map((m) => [m.base, m.price])), [tickers]);
  const valueOf = (w: Wallet) => {
    const symbol = normalizeCurrencyCode(w.currency);
    const price = symbol ? prices[symbol] : undefined;
    return price !== undefined ? Number(w.balance) * price : Number(w.fiatValueUsd ?? 0);
  };
  const crypto = wallets.filter((w) => getCurrencyMeta(w.currency)?.kind === 'crypto');
  const fiat = wallets.filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat');
  const cryptoUsd = crypto.reduce((sum, w) => sum + valueOf(w), 0);
  const fiatUsd = fiat.reduce((sum, w) => sum + valueOf(w), 0);
  const total = cryptoUsd + fiatUsd;
  const totalReady = walletQuery.data !== undefined && !walletQuery.isError;
  const display = (amount: number) => hidden ? '••••••' : dollars(amount);
  const openAsset = (wallet: Wallet) => { h.selection(); router.push({ pathname: '/asset/[currency]', params: { currency: wallet.currency } }); };

  const assetList = (items: Wallet[]) => (
    <Panel>
      {items.map((w, i) => (
        <AssetRow key={w.id} wallet={w} value={display(valueOf(w))} hidden={hidden} last={i === items.length - 1} onPress={() => openAsset(w)} />
      ))}
    </Panel>
  );
  const section = (kind: 'crypto' | 'fiat', items: Wallet[], open: boolean) => (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600' }}>{t(`wallet.${kind}`)} <Text style={{ color: p.fgFaint, fontSize: 13 }}> {items.length}</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t(open ? 'wallet.hide' : 'wallet.show')} ${t(`wallet.${kind}`)}`} accessibilityState={{ expanded: open }} onPress={() => toggle(kind)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: p.fgMuted, fontSize: 12 }}>{t(open ? 'wallet.hide' : 'wallet.show')}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={p.fgMuted} />
        </Pressable>
      </View>
      {open && assetList(items)}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.accentText} colors={[p.accent]} />}>
          <TabHeader title={t('wallet.title')} right={<HeaderIconButton icon="time-outline" label={t('home.activity')} onPress={() => router.push('/history')} />} />
          <View style={{ paddingHorizontal: 24 }}>
            <Text style={{ color: p.fgMuted, fontSize: 14, marginBottom: 22 }}>{t('wallet.overview')}</Text>
            <Panel style={{ padding: 22, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{t('wallet.estimate')}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t(hidden ? 'wallet.showBalances' : 'wallet.hideBalances')} onPress={() => setHidden(!hidden)} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12, marginVertical: -8 }}>
                  <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={p.fgMuted} />
                </Pressable>
              </View>
              <Pressable disabled={!totalReady} accessibilityRole="button" accessibilityLabel={t('wallet.balanceBreakdown')} onPress={() => setBreakdown(true)} style={{ paddingTop: 14, paddingBottom: 20 }}>
                {walletQuery.isPending ? <Skeleton width="75%" height={48} /> : <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: p.fg, fontSize: 38, fontWeight: '500', letterSpacing: -1.4, fontVariant: ['tabular-nums'] }}>{totalReady ? display(total) : '—'}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
                  <Text style={{ color: p.accentText, fontSize: 12, fontWeight: '500' }}>{t('wallet.balanceBreakdown')}</Text><Ionicons name="chevron-forward" size={12} color={p.accentText} />
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label={t('action.topup')} iconLeft={<Ionicons name="add" size={18} color={p.ctaFg} />} onPress={() => router.push('/topup')} style={{ flex: 1 }} />
                <Button label={t('action.send')} variant="secondary" iconLeft={<Ionicons name="arrow-up-outline" size={17} color={p.fg} />} onPress={() => router.push('/send')} style={{ flex: 1 }} />
              </View>
            </Panel>
            <SegmentedControl<Filter> value={filter} onChange={setFilter} options={[
              { key: 'ALL', label: t('wallet.all') }, { key: 'CRYPTO', label: t('wallet.crypto') }, { key: 'FIAT', label: t('wallet.fiat') }, { key: 'CARDS', label: t('home.cards') },
            ]} />
            {filter === 'CARDS' ? (
              <View style={{ marginTop: 24, gap: 16 }}>
                {cardQuery.isPending ? <Skeleton height={190} radius={24} /> : cardQuery.isError ? (
                  <EmptyState icon="cloud-offline-outline" title={t('wallet.loadError')} message={t('wallet.loadErrorBody')} actionLabel={t('common.retry')} onAction={() => cardQuery.refetch()} />
                ) : cards.length === 0 ? (
                  <EmptyState icon="card-outline" title={t('cards.noneIssued')} message={!features.cards ? t('features.cardsPaused') : undefined} actionLabel={features.cards ? t('cards.orderCard') : undefined} onAction={features.cards ? () => router.push('/cards') : undefined} />
                ) : <>{cards.map((card) => <CardVisual key={card.id} card={card} />)}<Button label={t('cards.manage')} variant="secondary" onPress={() => router.push('/cards')} />{!features.cards && <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 21 }}>{t('features.cardsPaused')}</Text>}</>}
              </View>
            ) : walletQuery.isPending ? (
              <View style={{ marginTop: 20 }}>{[0, 1, 2].map((n) => <SkeletonRow key={n} />)}</View>
            ) : walletQuery.isError ? (
              <EmptyState icon="cloud-offline-outline" title={t('wallet.loadError')} message={t('wallet.loadErrorBody')} actionLabel={t('common.retry')} onAction={refresh} />
            ) : (filter === 'ALL' ? wallets : filter === 'CRYPTO' ? crypto : fiat).length === 0 ? (
              <EmptyState icon="wallet-outline" title={t('wallet.emptyTitle')} message={t('wallet.emptyBody')} actionLabel={t('action.topup')} onAction={() => router.push('/topup')} />
            ) : filter === 'ALL' ? <>
              {!!crypto.length && section('crypto', crypto, cryptoOpen)}
              {!!fiat.length && section('fiat', fiat, fiatOpen)}
            </> : <View style={{ marginTop: 24 }}>{assetList(filter === 'CRYPTO' ? crypto : fiat)}</View>}
            <Text style={{ color: p.fgFaint, fontSize: 12, lineHeight: 19, marginTop: 24, textAlign: 'center' }}>{t('wallet.valueNote')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
      <BottomSheet visible={breakdown} onClose={() => setBreakdown(false)} title={t('wallet.balanceBreakdown')}>
        <Panel>
          <PanelRow icon="logo-bitcoin" label={t('wallet.crypto')} value={display(cryptoUsd)} onPress={() => { setBreakdown(false); router.push('/portfolio/crypto'); }} />
          <PanelRow icon="cash-outline" label={t('wallet.fiat')} value={display(fiatUsd)} last onPress={() => { setBreakdown(false); router.push('/portfolio/fiat'); }} />
        </Panel>
        <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 20, marginVertical: 20 }}>{t('wallet.valueNote')}</Text>
      </BottomSheet>
    </View>
  );
}

function AssetRow({ wallet, value, hidden, last, onPress }: { wallet: Wallet; value: string; hidden: boolean; last: boolean; onPress: () => void }) {
  const p = useThemedPalette();
  const meta = getCurrencyMeta(wallet.currency);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${meta?.name ?? wallet.currency}, ${value}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border, backgroundColor: pressed ? p.bgRaised : 'transparent' })}>
      {meta?.kind === 'fiat' ? <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: p.fg, fontSize: 22 }}>{meta.flagOrIcon}</Text></View> : <CoinIcon symbol={wallet.currency} size={40} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{meta?.name ?? wallet.currency}</Text>
        <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 4 }}>{hidden ? '••••' : Number(wallet.balance).toLocaleString('en-US', { maximumFractionDigits: meta?.decimals ?? 8 })} {wallet.currency}</Text>
      </View>
      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Ionicons name="chevron-forward" size={13} color={p.fgFaint} />
    </Pressable>
  );
}
