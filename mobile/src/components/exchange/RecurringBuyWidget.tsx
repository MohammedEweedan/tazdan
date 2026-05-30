/**
 * RecurringBuyWidget — create and manage automated recurring buys.
 *
 * A recurring buy is a standing order: buy a fixed amount (in the user's
 * preferred currency) of a chosen asset on a chosen cadence, funded from
 * either a fiat wallet balance or a saved card. The widget makes the
 * automatic-charge behaviour explicit before the user confirms.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';

import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useWallets, useCards, useDisplayCurrency } from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { ExpressPayButton } from '@/components/ui/ExpressPayButton';
import {
  recurringBuyAPI,
  type RecurringBuy,
  type RecurringFrequency,
  type RecurringSourceType,
} from '@/lib/cryptoApi';
import { getCurrencyMeta } from '@/constants';

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
  const dc = useDisplayCurrency();
  const baseCurrency: string = useAuthStore((s) => (s.user as any)?.baseCurrency ?? 'USD');

  const { data: wallets } = useWallets();
  const { data: cards } = useCards();

  const [asset, setAsset] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('WEEKLY');
  const [sourceType, setSourceType] = useState<RecurringSourceType>('WALLET');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
  const walletBalance = selectedWallet ? Number(selectedWallet.balance) : 0;

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
    numAmount > 0 &&
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
    if (!valid || submitting) return;
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
      setSubmitting(false);
    }
  }

  const meta = getCurrencyMeta(asset);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
    >
      {/* Asset */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 8, marginBottom: 10 }}>
        {t('recurring.assetLabel').toUpperCase()}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {ASSETS.map((a) => {
          const active = a === asset;
          return (
            <Pressable
              key={a}
              onPress={() => { Haptics.selectionAsync(); setAsset(a); }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 7,
                paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14,
                backgroundColor: active ? p.fg : p.bgElev,
                borderWidth: 1, borderColor: active ? p.fg : p.border,
              }}
            >
              <CoinAvatar sym={a} size={20} />
              <Text style={{ color: active ? p.bg : p.fg, fontSize: 14, fontWeight: '700' }}>{a}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Amount */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 10 }}>
        {t('recurring.amountLabel').toUpperCase()}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
        borderRadius: 16, paddingHorizontal: 16, height: 60,
      }}>
        <Text style={{ color: p.fg, fontSize: 28, fontWeight: '700', marginRight: 4 }}>{dc.symbol}</Text>
        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
          placeholder="0"
          placeholderTextColor={p.fgFaint}
          keyboardType="decimal-pad"
          style={{ flex: 1, color: p.fg, fontSize: 28, fontWeight: '700' }}
        />
        <Text style={{ color: p.fgFaint, fontSize: 13, fontWeight: '600' }}>{baseCurrency}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {QUICK_AMOUNTS.map((q) => (
          <Pressable
            key={q}
            onPress={() => { Haptics.selectionAsync(); setAmount(String(q)); }}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
            }}
          >
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{dc.symbol}{q}</Text>
          </Pressable>
        ))}
      </View>

      {/* Frequency */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 10 }}>
        {t('recurring.frequencyLabel').toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FREQUENCIES.map((f) => {
          const active = f.key === frequency;
          return (
            <Pressable
              key={f.key}
              onPress={() => { Haptics.selectionAsync(); setFrequency(f.key); }}
              style={{
                paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13,
                backgroundColor: active ? p.fg : p.bgElev,
                borderWidth: 1, borderColor: active ? p.fg : p.border,
              }}
            >
              <Text style={{ color: active ? p.bg : p.fg, fontSize: 14, fontWeight: '700' }}>
                {t(f.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Funding source */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 10 }}>
        {t('recurring.fundingLabel').toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <FundingTab
          icon="wallet-outline"
          label={t('recurring.source.wallet')}
          active={sourceType === 'WALLET'}
          onPress={() => { Haptics.selectionAsync(); setSourceType('WALLET'); setSourceId(null); }}
          palette={p}
        />
        <FundingTab
          icon="card-outline"
          label={t('recurring.source.card')}
          active={sourceType === 'CARD'}
          onPress={() => { Haptics.selectionAsync(); setSourceType('CARD'); setSourceId(null); }}
          palette={p}
        />
      </View>

      {/* Source picker */}
      <View style={{ marginTop: 10, gap: 8 }}>
        {sourceType === 'WALLET'
          ? (fiatWallets.length === 0
              ? <Text style={{ color: p.fgFaint, fontSize: 13 }}>{t('recurring.noWallet')}</Text>
              : fiatWallets.map((w) => {
                  const active = (effectiveSourceId === w.currency);
                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => { Haptics.selectionAsync(); setSourceId(w.currency); }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 14, borderRadius: 14, backgroundColor: p.bgElev,
                        borderWidth: 1.5, borderColor: active ? p.fg : p.border,
                      }}
                    >
                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>
                        {getCurrencyMeta(w.currency)?.name ?? w.currency}
                      </Text>
                      <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600' }}>
                        {getCurrencyMeta(w.currency)?.symbol}{Number(w.balance).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </Text>
                    </Pressable>
                  );
                }))
          : (activeCards.length === 0
              ? <Text style={{ color: p.fgFaint, fontSize: 13 }}>{t('recurring.noCard')}</Text>
              : activeCards.map((c) => {
                  const active = (effectiveSourceId === c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => { Haptics.selectionAsync(); setSourceId(c.id); }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 14, borderRadius: 14, backgroundColor: p.bgElev,
                        borderWidth: 1.5, borderColor: active ? p.fg : p.border,
                      }}
                    >
                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>
                        {c.nickname || c.tier} •••• {c.last4}
                      </Text>
                      <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? p.fg : p.fgFaint} />
                    </Pressable>
                  );
                }))}
      </View>

      {/* Apple / Google Pay — express first-charge when funding by card.
          Recurring off-session charges are provisioned separately; this
          funds the first buy instantly via the express sheet. */}
      {sourceType === 'CARD' && numAmount > 0 && (
        <View style={{ marginTop: 12 }}>
          <ExpressPayButton
            amount={numAmount}
            currency={baseCurrency}
            cryptoCurrency={asset}
            enabled={!submitting}
            onSuccess={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(t('recurring.createdTitle'), t('recurring.firstChargeDone'));
              onDone?.();
            }}
            onError={(m) => Alert.alert(t('common.error') || 'Error', m)}
          />
        </View>
      )}

      {/* Awareness notice */}
      <View style={{
        flexDirection: 'row', gap: 10, marginTop: 20, padding: 14,
        borderRadius: 14, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
      }}>
        <Ionicons name="information-circle-outline" size={18} color={p.fgMuted} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, color: p.fgMuted, fontSize: 12.5, lineHeight: 18 }}>
          {numAmount > 0
            ? t('recurring.notice')
                .replace('{amount}', `${dc.symbol}${numAmount}`)
                .replace('{frequency}', freqLabel(frequency).toLowerCase())
                .replace('{source}', sourceType === 'CARD' ? t('recurring.source.card') : t('recurring.source.wallet'))
            : t('recurring.noticeGeneric')}
        </Text>
      </View>

      {/* Insufficient-funds warning */}
      {insufficientFunds && (
        <View style={{
          flexDirection: 'row', gap: 10, marginTop: 12, padding: 14,
          borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.10)',
          borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)',
        }}>
          <Ionicons name="alert-circle-outline" size={18} color={p.redFg} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: p.redFg, fontSize: 12.5, lineHeight: 18 }}>
            {t('recurring.insufficientFunds')} {t('recurring.topUpFirst')}
          </Text>
        </View>
      )}

      {/* Confirm */}
      <Pressable
        onPress={submit}
        disabled={!valid || submitting}
        style={{
          marginTop: 18, height: 56, borderRadius: 16,
          backgroundColor: valid ? p.fg : p.bgElev,
          alignItems: 'center', justifyContent: 'center',
          opacity: submitting ? 0.7 : 1,
          borderWidth: 1, borderColor: valid ? p.fg : p.border,
        }}
      >
        {submitting
          ? <ActivityIndicator color={valid ? p.bg : p.fg} />
          : (
            <Text style={{ color: valid ? p.bg : p.fgFaint, fontSize: 16, fontWeight: '700' }}>
              {t('recurring.confirmCta')}
            </Text>
          )}
      </Pressable>

      <ExistingSchedules palette={p} />
    </ScrollView>
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
        backgroundColor: active ? p.fg : p.bgElev,
        borderWidth: 1, borderColor: active ? p.fg : p.border,
      }}
    >
      <Ionicons name={icon} size={17} color={active ? p.bg : p.fg} />
      <Text style={{ color: active ? p.bg : p.fg, fontSize: 14, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function ExistingSchedules({ palette: p }: { palette: any }) {
  const t = useT();
  const qc = useQueryClient();
  const [list, setList] = useState<RecurringBuy[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    recurringBuyAPI.list()
      .then((r) => { if (mounted) setList(r.data.recurringBuys); })
      .catch(() => { if (mounted) setList([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function refresh() {
    const r = await recurringBuyAPI.list();
    setList(r.data.recurringBuys);
    await qc.invalidateQueries({ queryKey: ['recurring-buys'] });
  }

  async function toggle(rb: RecurringBuy) {
    Haptics.selectionAsync();
    await recurringBuyAPI.update(rb.id, { status: rb.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' });
    await refresh();
  }
  async function cancel(rb: RecurringBuy) {
    Alert.alert(t('recurring.cancelTitle'), t('recurring.cancelBody'), [
      { text: t('common.cancel') || 'Cancel', style: 'cancel' },
      {
        text: t('recurring.cancelConfirm'), style: 'destructive',
        onPress: async () => { await recurringBuyAPI.remove(rb.id); await refresh(); },
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
            padding: 14, borderRadius: 14, marginBottom: 8,
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
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
          <Pressable onPress={() => toggle(rb)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name={rb.status === 'ACTIVE' ? 'pause' : 'play'} size={18} color={p.fg} />
          </Pressable>
          <Pressable onPress={() => cancel(rb)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={17} color={p.redFg} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
