/**
 * PayForm — pay one known payee (a scanned shop or person, or a picked
 * @handle). Payee on top, amount in the middle, keypad + confirm docked.
 *
 * A code may fix the currency and amount (a shop's till). A fixed amount
 * hides the keypad; the reference becomes the transfer note.
 *
 * Money safety mirrors the Send screen: one idempotency key per intended
 * payment (a retry after a lost reply never pays twice), limits before any
 * Face ID or code, risk-based step-up, recipient check before confirming.
 */
import { useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { Text, TextInput } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { OffersChip } from '@/components/pay/BusinessPosts';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { CurrencyPicker, type CurrencyItem } from '@/components/ui/CurrencyPicker';
import { ConfirmAction, ltr, useConfirmDockInset } from '@/components/ui/ConfirmAction';
import { CTAButton } from '@/components/ui/ScreenShell';
import { LimitNotice } from '@/components/limits/LimitNotice';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { CURRENCY_META } from '@/constants';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, useWallets, extractErrorMessage, useStepUpAuth, StepUpDeniedError, useTransactionSound } from '@/hooks';
import { useLimitBlock, LIMITS_QUERY_KEY } from '@/hooks/useLimits';
import { useUsdValue } from '@/hooks/useForexRates';
import { isStepUpChallengeError } from '@/lib/stepUpErrors';
import { isTransientSendError } from '@/hooks/useMessages';
import { lydtService, messageService, type Payee } from '@/services';
import { useFeatures } from '@/hooks/useFeatures';
import type { PayPreset } from '@/lib/payCode';
import type { Currency } from '@/types';

const META = CURRENCY_META as Record<string, { kind: string; decimals: number; name: string; flagOrIcon: string }>;
const isFiat = (c: string) => META[c]?.kind === 'fiat';
/** LYDT (the dinar token) behaves like dinars everywhere on this screen. */
const LYDT = 'LYDT';
const decimalsOf = (c: string) => (c === LYDT ? 3 : isFiat(c) ? META[c].decimals : null);
/** Fiat at its own precision (LYD 3 decimals: 18.500), crypto up to 8. */
const fmt = (n: number, currency: string) => {
  const d = decimalsOf(currency);
  return d != null
    ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
    : n.toLocaleString('en-US', { maximumFractionDigits: 8 });
};

type Receipt = { amount: string; currency: string; reference?: string; at: Date };

export function PayForm({ payee, preset }: { payee: Payee; preset: PayPreset }) {
  const p = useThemedPalette();
  const t = useT();
  const haptics = useHaptics();
  const router = useRouter();
  const qc = useQueryClient();
  const dock = useConfirmDockInset();
  const { height } = useWindowDimensions();
  const compact = height < 780;
  const tight = height < 700;
  const { playSuccess, playError } = useTransactionSound();
  const { data: wallets } = useWallets();
  const features = useFeatures();
  const lydtMe = useQuery({ queryKey: ['lydt-me'], queryFn: lydtService.me, enabled: features.lydt });
  const lydtBalance = Number(lydtMe.data?.balance ?? 0);
  const usdValue = useUsdValue();
  const toUsd = (n: number, c: string) => usdValue(n, c === LYDT ? 'LYD' : c);
  const stepUp = useStepUpAuth();

  const fixedAmount = !!preset.amount;
  const [picked, setPicked] = useState<string | null>(null);
  const [amount, setAmount] = useState(preset.amount ?? '');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [cta, setCta] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // What the customer holds, plus LYD always — fiat first, then by balance.
  const held = useMemo(() => {
    const m = new Map<string, number>();
    (wallets ?? []).forEach((w) => { if (Number(w.balance) > 0) m.set(w.currency, Number(w.balance)); });
    if (!m.has('LYD')) m.set('LYD', 0);
    if (lydtBalance > 0) m.set(LYDT, lydtBalance);
    return [...m.entries()].sort(([a, x], [b, y]) => {
      if (a === 'LYD' || b === 'LYD') return a === 'LYD' ? -1 : 1;
      if (isFiat(a) !== isFiat(b)) return isFiat(a) ? -1 : 1;
      return y - x;
    });
  }, [wallets, lydtBalance]);
  const pickerItems = useMemo<CurrencyItem[]>(() => held.map(([cur, bal]) => {
    const meta = META[cur];
    const fiat = isFiat(cur) || cur === LYDT;
    return {
      currency: cur, balance: bal, label: meta?.name ?? (cur === LYDT ? 'Libyan Dinar Token' : cur), icon: meta?.flagOrIcon ?? (cur === LYDT ? 'LD' : cur.slice(0, 2)),
      color: fiat ? p.accentText : p.fg, bg: fiat ? p.accentSoft : p.bgRaised, isFiat: fiat,
    };
  }), [held, p.accentText, p.accentSoft, p.fg, p.bgRaised]);

  // A code's currency wins; else the customer's pick; else LYD if held, else
  // their biggest balance.
  const currency = preset.currency ?? picked ?? (held.find(([, b]) => b > 0)?.[0] ?? 'LYD');
  const balance = currency === LYDT ? lydtBalance : Number(wallets?.find((w) => w.currency === currency)?.balance ?? 0);
  const payAmount = Number(amount || 0);
  const overspend = payAmount > balance;
  const transferNote = preset.reference ?? (note.trim() || undefined);

  const { data: eligibility } = useQuery({
    queryKey: ['recipient-check', payee.id],
    queryFn: () => messageService.recipientCheck(payee.id),
    enabled: !payee.self,
    staleTime: 30_000,
  });
  const blockedNotice = payee.self || eligibility?.reason === 'SELF' ? t('confirm.recipientSelf')
    : eligibility?.canReceive === false ? t('confirm.recipientUnavailable')
    : null;

  const payUsd = payAmount > 0 ? toUsd(payAmount, currency) : null;
  const limit = useLimitBlock('SEND', payUsd);
  const valid = !blockedNotice && payAmount > 0 && !overspend && !limit.blocked;

  // One key per intended payment: confirming again after a lost reply reuses
  // it, so the server answers with the first transfer instead of paying twice.
  const attemptRef = useRef<{ key: string; sig: string } | null>(null);
  const transferKey = (sig: string) => {
    if (attemptRef.current?.sig === sig) return attemptRef.current.key;
    const key = `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    attemptRef.current = { key, sig };
    return key;
  };

  const onPay = async (stepUpCode?: string) => {
    if (!valid) return;
    setCta('loading'); setCtaError(null);
    try {
      let biometricVerified = false;
      if (!stepUpCode) {
        // Unknown price → treat as high value so the check is never skipped.
        biometricVerified = await stepUp.guard({
          usdValue: toUsd(payAmount, currency) ?? Number.POSITIVE_INFINITY,
          reason: `Pay ${payAmount} ${currency} to ${payee.name}`,
        });
      }
      const idempotencyKey = transferKey(`${payee.id}|${currency}|${payAmount}|${transferNote ?? ''}`);
      const auth = { ...(stepUpCode ? { stepUpCode } : {}), ...(biometricVerified ? { biometricVerified: true } : {}) };
      const reference = currency === LYDT
        ? (await lydtService.transfer({ receiverId: payee.id, amount: payAmount, note: transferNote, idempotencyKey, ...auth })).reference
        : (await messageService.transfer({ receiverId: payee.id, currency: currency as Currency, amount: payAmount, note: transferNote, idempotencyKey, ...(preset.till ? { tillId: preset.till } : {}), ...auth }))?.transfer?.reference;
      attemptRef.current = null;
      setStepUpOpen(false);
      playSuccess('transfer');
      void qc.invalidateQueries({ queryKey: LIMITS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ['pay-recent'] });
      if (currency === LYDT) void qc.invalidateQueries({ queryKey: ['lydt-me'] });
      setCta('success');
      setReceipt({ amount: fmt(payAmount, currency), currency, reference, at: new Date() });
      import('@/lib/reviewPrompt').then(({ maybeAskForReview }) => maybeAskForReview());
    } catch (e: any) {
      if (e instanceof StepUpDeniedError) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setCtaError(e.message);
        setCta('error');
        setTimeout(() => setCta('idle'), 2000);
        return;
      }
      // New device or high value: the server emailed (or wants) a 6-digit code.
      if (isStepUpChallengeError(e) && !stepUpCode) {
        setCta('idle');
        setStepUpOpen(true);
        return;
      }
      if (stepUpCode && !isTransientSendError(e)) { setCta('idle'); throw e; } // the modal shows a wrong-code error
      setStepUpOpen(false);
      playError();
      // No reply: it may have gone through — confirming again is safe.
      setCtaError(isTransientSendError(e) ? t('pay.unconfirmed') : extractErrorMessage(e, t('pay.failed')));
      setCta('error');
      setTimeout(() => setCta('idle'), 2000);
    }
  };

  const handle = payee.username ? `@${payee.username}` : '';
  const merchant = payee.kind === 'MERCHANT';
  const sub = merchant ? [t('pay.business'), handle].filter(Boolean).join(' · ') : handle;

  if (receipt) {
    return (
      <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: dock }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="polite">
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: p.greenBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={36} color={p.greenFg} />
          </View>
          <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600', marginTop: 18 }}>{t('pay.paid')}</Text>
          <Text style={{ color: p.fg, fontSize: 40, fontWeight: '600', letterSpacing: -1, marginTop: 4 }}>
            {ltr(`${receipt.amount} ${receipt.currency}`)}
          </Text>
          <Text style={{ color: p.fg, fontSize: 16, fontWeight: '500', marginTop: 8 }}>{t('pay.paidTo', { name: payee.name })}</Text>
          <Text selectable style={{ color: p.fgMuted, fontSize: 13, marginTop: 14 }}>
            {[preset.reference, receipt.reference, receipt.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <CTAButton label={t('pay.done')} onPress={() => { haptics.selection(); router.back(); }} />
      </View>
    );
  }

  const amountText = `${fmt(payAmount, currency)} ${currency}`;
  const prompt = blockedNotice ?? (limit.blocked ? t('limits.reached') : overspend ? t('sell.insufficient') : t('buy.enterAmount'));

  return (
    // Bottom spacing comes from ConfirmAction's dock (clear of the home indicator).
    <View style={{ flex: 1, paddingHorizontal: 20 }}>
      {/* ── Who is being paid ── */}
      <View style={{ alignItems: 'center', paddingTop: tight ? 0 : 4 }}>
        <Avatar name={payee.name || handle} uri={payee.avatarUrl ?? undefined} size={tight ? 48 : 60} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, maxWidth: '100%' }}>
          <Text numberOfLines={1} style={{ color: p.fg, fontSize: 19, fontWeight: '600', letterSpacing: -0.3, flexShrink: 1 }}>
            {payee.name || handle}
          </Text>
          {merchant && <Ionicons name="checkmark-circle" size={18} color={p.accentText} accessibilityLabel={t('pay.business')} />}
        </View>
        {!!sub && <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }}>{sub}</Text>}
        {merchant && !tight && <OffersChip refId={payee.id} name={payee.name || handle} />}
        {!!preset.reference && (
          <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 13, marginTop: 6 }}>
            {t('pay.reference')} · {preset.reference}
          </Text>
        )}
      </View>

      {blockedNotice && (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          <Ionicons name="information-circle-outline" size={16} color={p.redFg} />
          <Text style={{ color: p.redFg, fontSize: 13, fontWeight: '500' }}>{blockedNotice}</Text>
        </View>
      )}

      {/* ── Currency (unless the code fixed it) ── */}
      {!preset.currency && pickerItems.length > 1 && (
        <View style={{ marginTop: compact ? 14 : 20 }}>
          <CurrencyPicker items={pickerItems} value={currency} onChange={(c) => { setPicked(c); if (!fixedAmount) setAmount(''); }} palette={p} />
        </View>
      )}

      {/* ── Amount ── */}
      <View style={{ marginTop: compact ? 14 : 24 }}>
        <AmountDisplay value={amount} symbol={currency} palette={p} tint={overspend ? p.redFg : undefined} maxSize={tight ? 48 : compact ? 56 : 64} />
      </View>
      <Text style={{ color: overspend ? p.redFg : p.fgMuted, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6 }}>
        {overspend ? t('send.exceedsBalance')
          : fixedAmount ? `${t('pay.amountSet', { name: payee.name || handle })} · ${t('common.available')}: ${ltr(`${fmt(balance, currency)} ${currency}`)}`
          : `${t('common.available')}: ${ltr(`${fmt(balance, currency)} ${currency}`)}`}
      </Text>

      {/* Optional note — not when the code carries the shop's reference. */}
      {!preset.reference && (noteOpen ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', marginTop: 12,
          backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border,
          paddingHorizontal: 12, paddingVertical: 8,
        }}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={p.fgMuted} />
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={140}
            autoFocus
            placeholder={t('pay.notePlaceholder')}
            placeholderTextColor={p.fgFaint}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={{ flex: 1, color: p.fg, fontSize: 14, marginLeft: 10, paddingVertical: 4 }}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => { haptics.selection(); setNoteOpen(true); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('pay.notePlaceholder')}
          style={({ pressed }) => ({
            alignSelf: 'center', marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="add" size={16} color={p.accentText} />
          <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '600' }}>{t('pay.notePlaceholder')}</Text>
        </Pressable>
      ))}

      <View style={{ flex: 1, minHeight: 8 }} />

      {!fixedAmount && (
        <View style={{ marginBottom: 14 }}>
          <NumericKeypad value={amount} onChange={setAmount} palette={p} keyHeight={tight ? 42 : compact ? 48 : 56} fontSize={tight ? 22 : compact ? 24 : 27} />
        </View>
      )}

      <LimitNotice action="SEND" amountUsd={payUsd} style={{ marginBottom: 10 }} />
      <ConfirmAction
        action={t('confirm.act.pay', { amount: ltr(amountText) })}
        prompt={prompt}
        onConfirm={() => { if (valid && cta === 'idle') onPay(); }}
        disabled={!valid || cta !== 'idle'}
        status={cta}
        successLabel={t('pay.paid')}
        errorLabel={ctaError ?? t('pay.failed')}
        review={{
          amount: amountText,
          caption: t('pay.paidTo', { name: payee.name || handle }),
          rows: [
            { label: t('confirm.to'), value: payee.name || handle, ...(sub ? { sub } : {}) },
            { label: t('confirm.from'), value: currency, sub: `${t('common.available')}: ${ltr(`${fmt(balance, currency)} ${currency}`)}` },
            ...(transferNote ? [{ label: preset.reference ? t('pay.reference') : t('confirm.note'), value: transferNote }] : []),
          ],
        }}
      />

      {/* Server-requested 6-digit confirmation (new device or high value) */}
      <StepUpModal
        visible={stepUpOpen}
        action="transfer"
        subtitle={`${amountText} → ${payee.name || handle}`}
        onSubmit={(code) => onPay(code)}
        onCancel={() => { setStepUpOpen(false); setCta('idle'); }}
      />
    </View>
  );
}
