import { FiatFlag } from '@/components/ui/FiatFlag';
/**
 * RecurringBuyWidget — create and manage automated recurring buys.
 *
 * A recurring buy is a standing order: buy a fixed amount (in the user's
 * preferred currency) of a chosen asset on a chosen cadence, funded from
 * either a fiat wallet balance or a saved card. The widget makes the
 * automatic-charge behaviour explicit before the user confirms.
 */
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useWallets, useCards } from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { CTAButton } from '@/components/ui/ScreenShell';
import {
  recurringBuyAPI,
  type RecurringBuy,
  type RecurringFrequency,
  type RecurringSourceType,
} from '@/lib/cryptoApi';
import { fiatSymbol, getCurrencyMeta } from '@/constants';

const ASSETS = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX'];

const FREQUENCIES: { key: RecurringFrequency; labelKey: string }[] = [
  { key: 'DAILY',    labelKey: 'recurring.freq.daily' },
  { key: 'WEEKLY',   labelKey: 'recurring.freq.weekly' },
  { key: 'BIWEEKLY', labelKey: 'recurring.freq.biweekly' },
  { key: 'MONTHLY',  labelKey: 'recurring.freq.monthly' },
];

const QUICK_AMOUNTS = [10, 25, 50, 100];

export function RecurringBuyWidget({ onDone }: { onDone?: () => void }) {
  const p = useThemedPalette();
  const t = useT();
  const qc = useQueryClient();
  const locale = useI18n((s) => s.locale);
  const preferred: string = useAuthStore((s) => (s.user as any)?.baseCurrency ?? 'USD');
  const baseCurrency = getCurrencyMeta(preferred)?.kind === 'fiat' ? preferred : 'USD';
  const symbol = fiatSymbol(baseCurrency, locale);

  const { data: wallets } = useWallets();
  const { data: cards } = useCards();

  const [asset, setAsset] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('WEEKLY');
  const [sourceType, setSourceType] = useState<RecurringSourceType>('WALLET');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<'asset' | 'frequency' | 'funding' | null>(null);
  const submittingRef = useRef(false);

  // Fiat wallets the user can fund from.
  const fiatWallets = useMemo(
    () => (wallets ?? []).filter((w) => getCurrencyMeta(w.currency)?.kind === 'fiat'),
    [wallets],
  );
  const activeCards = useMemo(
    () => (cards ?? []).filter((c) => c.status === 'ACTIVE' && !c.frozen),
    [cards],
  );

  // Default the funding wallet to the preferred currency wallet if present.
  const effectiveSourceId = useMemo(() => {
    if (sourceId) return sourceId;
    if (sourceType === 'WALLET') {
      const pref = fiatWallets.find((w) => w.currency === baseCurrency);
      return pref?.currency ?? fiatWallets[0]?.currency ?? baseCurrency;
    }
    return activeCards[0]?.id ?? null;
  }, [sourceId, sourceType, fiatWallets, activeCards, baseCurrency]);

  const numAmount = Number(amount);

  // Balance of the selected funding wallet (in that wallet's own currency).
  const selectedWallet = useMemo(
    () => (sourceType === 'WALLET' ? fiatWallets.find((w) => w.currency === effectiveSourceId) : undefined),
    [sourceType, fiatWallets, effectiveSourceId],
  );
  const walletBalance = selectedWallet ? Math.max(0, Number(selectedWallet.balance) - Number(selectedWallet.frozen ?? 0)) : 0;

  // The amount is denominated in the user's preferred currency. When the
  // funding wallet is that same currency (the common case) we can check the
  // balance directly. We require a funded wallet with enough balance to
  // cover at least the first run — a recurring buy from an empty wallet
  // would just fail on the first scheduled execution.
  const fundingSameCurrency = !selectedWallet || selectedWallet.currency === baseCurrency;
  const insufficientFunds =
    sourceType === 'WALLET' && fundingSameCurrency && numAmount > 0 && numAmount > walletBalance;
  const noFundingSource =
    (sourceType === 'WALLET' && !selectedWallet) || (sourceType === 'CARD' && !effectiveSourceId);

  const valid =
    Number.isFinite(numAmount) && numAmount > 0 &&
    !!asset &&
    !noFundingSource &&
    !insufficientFunds;

  const freqLabel = (f: RecurringFrequency) =>
    t(FREQUENCIES.find((x) => x.key === f)!.labelKey);

  const sourceLabel = useMemo(() => {
    if (sourceType === 'CARD') {
      const c = activeCards.find((x) => x.id === effectiveSourceId);
      return c ? `•••• ${c.last4}` : t('recurring.noCard');
    }
    return `${effectiveSourceId} ${t('recurring.walletBalance')}`;
  }, [sourceType, effectiveSourceId, activeCards, t]);

  async function submit() {
    if (!valid || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await recurringBuyAPI.create({
        asset,
        fiatCurrency: baseCurrency,
        fiatAmount: numAmount,
        frequency,
        sourceType,
        sourceId: effectiveSourceId ?? undefined,
      });
      await qc.invalidateQueries({ queryKey: ['recurring-buys'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount('');
      Alert.alert(t('recurring.createdTitle'), t('recurring.createdBody'));
      onDone?.();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? t('recurring.createFailed');
      Alert.alert(t('common.error') || 'Error', msg);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const meta = getCurrencyMeta(asset);
  const displayAmount = numAmount.toLocaleString(locale === 'ar' ? 'ar-LY' : locale, { maximumFractionDigits: 3 });

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 }}>
        <Text accessibilityRole="header" style={{ color: p.fg, fontSize: 28, fontWeight: '600', letterSpacing: -.5 }}>
          {t('recurring.title')}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 310 }}>{t('recurring.intro')}</Text>

        <Pressable onPress={() => setPicker('asset')} accessibilityLabel={t('recurring.chooseAsset')}
          style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 10, paddingVertical: 16, marginTop: 18 }}>
          <CoinAvatar sym={asset} size={38} />
          <View>
            <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600' }}>{meta?.name ?? asset}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{asset}</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={p.fgMuted} />
        </Pressable>

        <Text style={{ color: p.fgMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>{t('recurring.amountLabel')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
          <Text style={{ color: p.fgMuted, fontSize: 30, fontWeight: '600' }}>{symbol}</Text>
          <TextInput value={amount} onChangeText={(v) => {
            const next = v.replace(/[^0-9.]/g, '');
            const decimals = getCurrencyMeta(baseCurrency)?.decimals ?? 2;
            if (new RegExp(`^\\d{0,12}(\\.\\d{0,${decimals}})?$`).test(next)) setAmount(next);
          }} placeholder="0" placeholderTextColor={p.fgFaint} keyboardType="decimal-pad" selectTextOnFocus
            accessibilityLabel={t('recurring.amountLabel')}
            style={{ color: p.fg, fontSize: 56, fontWeight: '600', width: Math.min(245, Math.max(72, (amount.length || 1) * 35 + 16)), maxWidth: '78%',
              paddingHorizontal: 8, paddingVertical: 0, minHeight: 76, textAlign: 'center', includeFontPadding: false }} />
        </View>
        <Text style={{ color: p.fgFaint, fontSize: 12, textAlign: 'center' }}>{baseCurrency}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18, marginBottom: 26 }}>
          {QUICK_AMOUNTS.map((q) => <Pressable key={q} onPress={() => { Haptics.selectionAsync(); setAmount(String(q)); }}
            style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: p.pillBg }}>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '500' }}>{symbol}{q}</Text>
          </Pressable>)}
        </View>

        <Pressable onPress={() => setPicker('frequency')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17 }}>
          <Ionicons name="repeat-outline" size={22} color={p.fgMuted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fgFaint, fontSize: 12 }}>{t('recurring.frequencyLabel')}</Text>
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '500', marginTop: 4 }}>{freqLabel(frequency)}</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={p.fgMuted} />
        </Pressable>
        <Pressable onPress={() => setPicker('funding')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17 }}>
          <Ionicons name={sourceType === 'WALLET' ? 'wallet-outline' : 'card-outline'} size={22} color={p.fgMuted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fgFaint, fontSize: 12 }}>{t('recurring.fundingLabel')}</Text>
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '500', marginTop: 4 }}>{sourceLabel}</Text>
            {sourceType === 'WALLET' && selectedWallet && <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 4 }}>
              {fiatSymbol(selectedWallet.currency, locale)}{walletBalance.toLocaleString(locale, { maximumFractionDigits: 3 })} {t('fx.available').toLowerCase()}
            </Text>}
          </View>
          <Ionicons name="chevron-down" size={16} color={p.fgMuted} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, marginBottom: 22 }}>
          <Ionicons name="information-circle-outline" size={17} color={p.fgFaint} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, color: p.fgMuted, fontSize: 12, lineHeight: 18 }}>
            {numAmount > 0 ? t('recurring.notice').replace('{amount}', `${symbol}${displayAmount} ${baseCurrency}`)
              .replace('{frequency}', freqLabel(frequency).toLowerCase())
              .replace('{source}', sourceType === 'CARD' ? t('recurring.source.card') : t('recurring.source.wallet'))
              : t('recurring.noticeGeneric')}
          </Text>
        </View>
        {(insufficientFunds || noFundingSource) && <Text style={{ color: p.redFg, fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
          {insufficientFunds ? `${t('recurring.insufficientFunds')} ${t('recurring.topUpFirst')}`
            : sourceType === 'CARD' ? t('recurring.noCard') : t('recurring.noWallet')}
        </Text>}
        <CTAButton label={t('recurring.confirmCta')} disabled={!valid} loading={submitting} onPress={submit} />
        <ExistingSchedules palette={p} />
      </ScrollView>

      <BottomSheet visible={picker !== null} onClose={() => setPicker(null)}
        title={picker === 'asset' ? t('recurring.chooseAsset') : picker === 'frequency' ? t('recurring.frequencyLabel') : t('recurring.chooseFunding')}>
        {picker === 'asset' && ASSETS.map((a) => <Pressable key={a} onPress={() => { Haptics.selectionAsync(); setAsset(a); setPicker(null); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 }}>
          <CoinAvatar sym={a} size={38} />
          <View style={{ flex: 1 }}><Text style={{ color: p.fg, fontSize: 16, fontWeight: '500' }}>{getCurrencyMeta(a)?.name ?? a}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 3 }}>{a}</Text></View>
          {a === asset && <Ionicons name="checkmark" size={20} color={p.accentText} />}
        </Pressable>)}
        {picker === 'frequency' && FREQUENCIES.map((f) => <Pressable key={f.key}
          onPress={() => { Haptics.selectionAsync(); setFrequency(f.key); setPicker(null); }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 }}>
          <Text style={{ color: p.fg, fontSize: 17, fontWeight: '500' }}>{t(f.labelKey)}</Text>
          {f.key === frequency && <Ionicons name="checkmark" size={20} color={p.accentText} />}
        </Pressable>)}
        {picker === 'funding' && <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
            <FundingTab icon="wallet-outline" label={t('recurring.source.wallet')} active={sourceType === 'WALLET'}
              onPress={() => { setSourceType('WALLET'); setSourceId(null); }} palette={p} />
            <FundingTab icon="card-outline" label={t('recurring.source.card')} active={sourceType === 'CARD'}
              onPress={() => { setSourceType('CARD'); setSourceId(null); }} palette={p} />
          </View>
          {sourceType === 'WALLET' ? fiatWallets.length === 0 ? <Text style={{ color: p.fgMuted }}>{t('recurring.noWallet')}</Text>
            : fiatWallets.map((w) => <Pressable key={w.id} onPress={() => { setSourceId(w.currency); setPicker(null); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 }}>
              <FiatFlag currency={w.currency} size={40} />
              <View style={{ flex: 1 }}><Text style={{ color: p.fg, fontSize: 16 }}>{getCurrencyMeta(w.currency)?.name ?? w.currency}</Text>
                <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 4 }}>{Math.max(0, Number(w.balance) - Number(w.frozen ?? 0)).toLocaleString(locale)} {w.currency}</Text></View>
              {effectiveSourceId === w.currency && <Ionicons name="checkmark" size={20} color={p.accentText} />}
            </Pressable>)
            : activeCards.length === 0 ? <Text style={{ color: p.fgMuted }}>{t('recurring.noCard')}</Text>
              : activeCards.map((c) => <Pressable key={c.id} onPress={() => { setSourceId(c.id); setPicker(null); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 }}>
                <Ionicons name="card-outline" size={24} color={p.fg} />
                <Text style={{ color: p.fg, fontSize: 16, flex: 1 }}>{c.nickname || c.tier} · •••• {c.last4}</Text>
                {effectiveSourceId === c.id && <Ionicons name="checkmark" size={20} color={p.accentText} />}
              </Pressable>)}
        </>}
      </BottomSheet>
    </>
  );
}

function FundingTab({ icon, label, active, onPress, palette: p }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress: () => void; palette: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 13, borderRadius: 14,
        backgroundColor: active ? p.accent : p.bgElev,
        borderWidth: 1, borderColor: active ? p.accent : p.border,
      }}
    >
      <Ionicons name={icon} size={17} color={active ? p.accentFg : p.fg} />
      <Text style={{ color: active ? p.accentFg : p.fg, fontSize: 14, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function ExistingSchedules({ palette: p }: { palette: any }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: list = [], isLoading: loading } = useQuery({
    queryKey: ['recurring-buys'],
    queryFn: async () => (await recurringBuyAPI.list()).data.recurringBuys,
  });
  const [updating, setUpdating] = useState<string | null>(null);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['recurring-buys'] });
  }

  async function toggle(rb: RecurringBuy) {
    Haptics.selectionAsync();
    if (updating) return;
    setUpdating(rb.id);
    try {
      await recurringBuyAPI.update(rb.id, { status: rb.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' });
      await refresh();
    } catch (e: any) { Alert.alert(t('common.error'), e?.response?.data?.error ?? t('recurring.createFailed')); }
    finally { setUpdating(null); }
  }
  async function cancel(rb: RecurringBuy) {
    Alert.alert(t('recurring.cancelTitle'), t('recurring.cancelBody'), [
      { text: t('common.cancel') || 'Cancel', style: 'cancel' },
      {
        text: t('recurring.cancelConfirm'), style: 'destructive',
        onPress: async () => {
          setUpdating(rb.id);
          try { await recurringBuyAPI.remove(rb.id); await refresh(); }
          catch (e: any) { Alert.alert(t('common.error'), e?.response?.data?.error ?? t('recurring.createFailed')); }
          finally { setUpdating(null); }
        },
      },
    ]);
  }

  if (loading) return null;
  if (!list || list.length === 0) return null;

  return (
    <View style={{ marginTop: 28 }}>
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
        {t('recurring.activeLabel').toUpperCase()}
      </Text>
      {list.map((rb) => (
        <View
          key={rb.id}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingVertical: 16,
            opacity: rb.status === 'PAUSED' ? 0.55 : 1,
          }}
        >
          <CoinAvatar sym={rb.asset} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
              {getCurrencyMeta(rb.fiatCurrency)?.symbol}{Number(rb.fiatAmount).toLocaleString('en-US')} → {rb.asset}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
              {t(FREQUENCIES.find((f) => f.key === rb.frequency)!.labelKey)}
              {rb.status === 'PAUSED' ? ` · ${t('recurring.paused')}` : ''}
            </Text>
          </View>
          <Pressable disabled={!!updating} onPress={() => toggle(rb)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name={rb.status === 'ACTIVE' ? 'pause' : 'play'} size={18} color={p.fg} />
          </Pressable>
          <Pressable disabled={!!updating} onPress={() => cancel(rb)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={17} color={p.redFg} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
