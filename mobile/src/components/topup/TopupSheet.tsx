/**
 * TopupSheet — the entire top-up flow extracted out of the route file
 * so it can be presented either as a full-page screen (`/topup`) or
 * as a bottom-sheet modal from any other screen (home, asset detail,
 * card detail). Single source of truth for top-up UI.
 *
 * Pass `presentation="sheet"` to render inside a BottomSheet shell.
 * Pass `presentation="screen"` to render with a header — used by the
 * `/topup` route for deep-linking.
 *
 * Three steps stay in-flow: METHOD → AMOUNT → CONFIRM. Step state is
 * internal; the parent only controls open/close. A bank or agent top-up then
 * shows where to pay and the reference to quote; the page stays open until
 * the customer is done with it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { CTAButton, type CTAState } from '@/components/ui/ScreenShell';
import { BottomSheet, SheetSection } from '@/components/ui/BottomSheet';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';
import { FeeBreakdown } from '@/components/ui/FeeBreakdown';
import { PressableScale, FadeIn } from '@/components/ui/Motion';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { CurrencyPicker, type CurrencyItem } from '@/components/ui/CurrencyPicker';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useStepUpAuth, StepUpDeniedError, usePlatformBanks, useTransactionSound } from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { useUsdValue } from '@/hooks/useForexRates';
import { depositService } from '@/services';
import type { PlatformBank } from '@/services/geoService';
import { formatMoney } from '@/utils/format';
import { fiatSymbol as fiatGlyph, getCurrencyMeta } from '@/constants';
import {
  methodsForCountry, fiatsForCountry,
  type PaymentMethod,
} from '@/constants/paymentMethods';
import type { Currency } from '@/types';

type Step = 'METHOD' | 'AMOUNT' | 'CONFIRM';

export interface TopupSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-select a currency (jumps straight to AMOUNT step). */
  initialCurrency?: Currency;
}

export function TopupSheet({ visible, onClose, initialCurrency }: TopupSheetProps) {
  const p = useThemedPalette();
  const country = useAuthStore((s) => s.user?.country ?? null);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Top up balance"
      subtitle={country ? `Available methods for your country (${country})` : undefined}
      scroll={false}
      contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}
    >
      <TopupBody
        palette={p}
        initialCurrency={initialCurrency}
        onComplete={onClose}
      />
    </BottomSheet>
  );
}

/**
 * The actual flow. Exported so the /topup route can render it inside
 * a ScreenShell without the BottomSheet wrapper.
 */
export function TopupBody({
  palette: p, initialCurrency, onComplete,
}: {
  palette: Palette;
  initialCurrency?: Currency;
  onComplete: () => void;
}) {
  const h = useHaptics();
  const stepUp = useStepUpAuth();
  const router = useRouter();
  const [instructions, setInstructions] = useState<{ reference: string; amount: number; currency: string; bank: PlatformBank | null; agent: boolean } | null>(null);
  const user = useAuthStore((s) => s.user);
  const country = user?.country ?? null;
  const toUsd = useUsdValue();

  const methods = useMemo(() => methodsForCountry(country), [country]);
  const fiats   = useMemo(() => fiatsForCountry(country), [country]);

  const [step, setStep]         = useState<Step>('METHOD');
  const [method, setMethod]     = useState<PaymentMethod | null>(methods[0] ?? null);
  const [currency, setCurrency] = useState<Currency>(initialCurrency ?? fiats[0]);
  const [amount, setAmount]     = useState('');
  const [busy, setBusy]         = useState(false);
  const [ctaState, setCtaState] = useState<CTAState>('idle');
  const [successLabel, setSuccessLabel] = useState<string | null>(null);
  const [errorLabel, setErrorLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!method && methods.length > 0) {
      setMethod(methods[0]);
      return;
    }
    if (!method) return;
    if (!method.currencies.includes(currency)) {
      setCurrency(method.currencies[0] ?? fiats[0]);
    }
  }, [method, methods, currency, fiats]);

  const numeric = Number(amount || 0);
  // Bank transfers need a Tazdan account in this currency to pay into.
  const banksQ = usePlatformBanks(method?.id === 'BANK_TRANSFER' ? currency : undefined);
  const payTo = method?.id === 'BANK_TRANSFER' ? (banksQ.data ?? []).find((b) => b.currency === currency && b.isActive) ?? null : null;
  const bankUnavailable = method?.id === 'BANK_TRANSFER' && !banksQ.isLoading && !payTo;
  const usdEquivalent = useMemo(() => {
    if (!Number.isFinite(numeric)) return 0;
    return toUsd(numeric, currency) ?? numeric;
  }, [numeric, currency, toUsd]);

  const feeRows = useMemo(() => {
    if (!method || numeric <= 0) return null;
    let pct = 0;
    let flat = 0;
    if (method.id === 'CARD' || method.id === 'APPLE_PAY') { pct = 0.029; flat = 0.30; }
    if (method.id === 'LYD_AGENT')                          { pct = 0.01;  flat = 0;    }
    if (method.id === 'MOONPAY')                            { pct = 0.045; flat = 0;    }
    if (method.id === 'P2P')                                { pct = 0.005; flat = 0;    }
    if (method.id === 'BANK_TRANSFER')                      { pct = 0;     flat = numeric >= 100 ? 0 : 1.50; }
    const processing = numeric * pct + flat;
    const total = numeric + processing;
    return {
      rows: [
        { label: 'Amount', amount: numeric, currency, muted: false as const },
        ...(processing > 0 ? [{
          label: 'Processing fee',
          amount: processing,
          currency,
          muted: true as const,
          hint: pct > 0 ? `${(pct * 100).toFixed(1)}%${flat ? ` + ${formatMoney(flat, currency, { showSymbol: true })}` : ''}` : undefined,
        }] : []),
      ],
      total: { label: 'You pay', amount: total, currency },
    };
  }, [method, numeric, currency]);

  const goToAmount = (m: PaymentMethod) => {
    if (!m.enabled) return;
    h.selection();
    setMethod(m);
    setStep('AMOUNT');
  };

  const goToConfirm = () => {
    if (!method || numeric <= 0) return;
    if (method.minUsd && usdEquivalent < method.minUsd) {
      Alert.alert('Below minimum', `${method.name} requires at least $${method.minUsd} equivalent.`);
      return;
    }
    if (method.maxUsd && usdEquivalent > method.maxUsd) {
      Alert.alert('Above limit', `${method.name} accepts up to $${method.maxUsd} per transaction.`);
      return;
    }
    h.selection();
    setStep('CONFIRM');
  };

  const submit = async () => {
    if (!method || (numeric <= 0 && method.id !== 'P2P')) return;
    if (method.minUsd && usdEquivalent < method.minUsd) {
      Alert.alert('Below minimum', `${method.name} requires at least $${method.minUsd} equivalent.`);
      return;
    }
    if (method.maxUsd && usdEquivalent > method.maxUsd) {
      Alert.alert('Above limit', `${method.name} accepts up to $${method.maxUsd} per transaction.`);
      return;
    }
    setBusy(true);
    setCtaState('idle');
    setErrorLabel(null);
    try {
      await stepUp.guard({
        usdValue: usdEquivalent,
        reason: `Confirm ${formatMoney(numeric, currency, { showSymbol: true })} top-up`,
      });

      if (method.serverMethod === 'CARD' || method.serverMethod === 'APPLE_PAY') {
        const { quote, providerName } = await depositService.gatewayQuote({
          fiatCurrency: currency,
          fiatAmount: numeric,
          cryptoCurrency: 'USDT',
          paymentMethod: method.serverMethod,
        });
        const confirm = await depositService.gatewayConfirm({
          providerRef: quote.providerRef,
          fiatCurrency: currency,
          fiatAmount: numeric,
          cryptoCurrency: 'USDT',
          idempotencyKey: `topup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        });

        if (confirm.redirectUrl && confirm.redirectUrl.startsWith('stripe:')) {
          Alert.alert(
            providerName,
            'Stripe Payment Sheet integration pending. Your top-up is queued and will appear once the webhook fires.',
          );
        } else if (confirm.redirectUrl) {
          await WebBrowser.openBrowserAsync(confirm.redirectUrl);
        }
        h.success();
        setCtaState('success');
        setSuccessLabel('Top-up queued ✓');
        setTimeout(onComplete, 2000);
        return;
      }

      if (method.id === 'P2P') {
        // Buying from another customer happens in the P2P market.
        onComplete();
        router.push('/p2p' as never);
        return;
      }

      if (bankUnavailable) {
        setCtaState('error');
        setErrorLabel(`Bank top-up in ${currency} isn't available yet`);
        return;
      }
      const { deposit } = await depositService.createBankDeposit({
        currency,
        amount: numeric,
        notes: method.id === 'LYD_AGENT' ? 'Cash via tazdan agent' : undefined,
      });
      h.success();
      // Show where to pay and the reference to quote; nothing is credited
      // until the money arrives and staff confirm it.
      setInstructions({ reference: deposit.reference, amount: numeric, currency, bank: payTo, agent: method.id === 'LYD_AGENT' });
    } catch (e: any) {
      h.error();
      if (e instanceof StepUpDeniedError) {
        Alert.alert('Verification needed', e.message);
        return;
      }
      setCtaState('error');
      setErrorLabel(e?.response?.data?.error ?? e?.message ?? 'Top-up failed');
      setTimeout(() => setCtaState('idle'), 3000);
    } finally {
      setBusy(false);
    }
  };

  const { height } = useWindowDimensions();
  const tight = height < 700;
  const compact = height < 780;
  const amountMaxSize = tight ? 48 : compact ? 56 : 64;
  const keypadHeight = tight ? 42 : compact ? 48 : 56;
  const keypadFont = tight ? 22 : compact ? 24 : 27;
  const selectedMethod = method ?? methods[0] ?? null;
  const meta = getCurrencyMeta(currency);
  const symbol = meta?.kind === 'fiat' ? fiatGlyph(currency) : (meta?.symbol ?? currency);
  const currencyItems = useMemo<CurrencyItem[]>(
    () => (selectedMethod?.currencies ?? fiats).map((c) => {
      const m = getCurrencyMeta(c);
      const isFiat = m?.kind !== 'crypto';
      return {
        currency: c,
        balance: 0,
        label: m?.name ?? c,
        icon: isFiat ? fiatGlyph(c) : (m?.symbol ?? c),
        color: isFiat ? p.fg : p.accent,
        bg: p.bgElev,
        kind: isFiat ? 'fiat' : 'crypto',
        isFiat,
        showBalance: false,
      };
    }),
    [selectedMethod, fiats, p.accent, p.bgElev, p.fg],
  );
  const slideLabel = !selectedMethod
    ? 'Choose a method'
    : bankUnavailable
    ? `Not available in ${currency} yet`
    : selectedMethod.id === 'P2P'
    ? 'Slide to open the P2P market'
    : numeric > 0
    ? `Slide to top up ${formatMoney(numeric, currency, { showSymbol: true })}`
    : 'Enter amount';

  if (instructions) {
    return <TransferInstructions {...instructions} palette={p} onDone={onComplete} />;
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
    >
      <FadeIn>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>
          METHOD
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {methods.map((m) => {
            const on = selectedMethod?.id === m.id;
            return (
              <Pressable
                key={m.id}
                disabled={!m.enabled}
                onPress={() => { if (!m.enabled) return; h.selection(); setMethod(m); setAmount(''); setCtaState('idle'); }}
                style={({ pressed }) => ({
                  minWidth: 130,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 16,
                  backgroundColor: on ? p.fg : p.bgElev,
                  borderWidth: 1,
                  borderColor: on ? p.fg : p.border,
                  opacity: !m.enabled ? 0.45 : pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={m.icon as any} size={16} color={on ? p.bg : p.fg} />
                  <Text style={{ color: on ? p.bg : p.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    {m.name}
                  </Text>
                </View>
                <Text style={{ color: on ? p.bg : p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 3 }} numberOfLines={1}>
                  {m.speed} · {m.feeSummary}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>
          CURRENCY
        </Text>
        <View style={{ marginBottom: compact ? 10 : 14 }}>
          <CurrencyPicker
            items={currencyItems}
            value={currency}
            onChange={(c) => { setCurrency(c as Currency); setAmount(''); setCtaState('idle'); }}
            palette={p}
          />
        </View>

        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <AmountDisplay value={amount} symbol={symbol} palette={p} maxSize={amountMaxSize} />
        </View>

        {bankUnavailable ? (
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: p.amberBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: compact ? 8 : 12 }}>
            <Ionicons name="information-circle-outline" size={18} color={p.amberFg} />
            <Text style={{ color: p.fg, fontSize: 13, lineHeight: 18, flex: 1 }}>
              Bank transfer top-ups in {currency} aren't set up yet. Choose another currency or method.
            </Text>
          </View>
        ) : null}
        <View style={{
          display: bankUnavailable ? 'none' : 'flex',
          backgroundColor: p.bgElev,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: p.border,
          paddingHorizontal: 14,
          paddingVertical: compact ? 9 : 11,
          marginBottom: compact ? 8 : 12,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>{selectedMethod?.name ?? 'Method'}</Text>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>
              {feeRows ? formatMoney(feeRows.total.amount, currency, { showSymbol: true }) : selectedMethod?.feeSummary ?? ''}
            </Text>
          </View>
          {selectedMethod && (
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500', marginTop: 4 }} numberOfLines={1}>
              {selectedMethod.speed} · {selectedMethod.description}
            </Text>
          )}
        </View>

        {usdEquivalent >= stepUp.threshold && numeric > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.amberBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 }}>
            <Ionicons name="finger-print" size={15} color={p.amberFg} />
            <Text style={{ color: p.amberFg, fontSize: 12, fontWeight: '600', flex: 1 }}>
              Face ID required
            </Text>
          </View>
        )}
      </FadeIn>

      <View style={{ marginBottom: 14, marginTop: 4 }}>
        <NumericKeypad
          value={amount}
          onChange={(v) => { setAmount(v); setCtaState('idle'); setErrorLabel(null); }}
          palette={p}
          maxDecimals={meta?.decimals ?? 2}
          keyHeight={keypadHeight}
          fontSize={keypadFont}
        />
      </View>

      <SlideToConfirm
        label={slideLabel}
        onConfirm={() => { if (selectedMethod && (numeric > 0 || selectedMethod.id === 'P2P') && !busy && !bankUnavailable) submit(); }}
        enabled={!!selectedMethod && (numeric > 0 || selectedMethod.id === 'P2P') && !busy && !bankUnavailable}
        status={busy ? 'loading' : ctaState}
        successLabel={successLabel ?? undefined}
        errorLabel={errorLabel ?? undefined}
        accent={p.accent}
        accentFg={p.accentFg}
        trackBg={p.bgElev}
        trackFg={p.fg}
        border={p.border}
        greenBg={p.greenBg} greenFg={p.greenFg}
        redBg={p.redBg} redFg={p.redFg}
      />
    </ScrollView>
  );
}

/* ── Step sub-components ─────────────────────────────────────────── */

/** Where to pay and the reference to quote, shown once a bank or agent top-up is created. */
function TransferInstructions({ reference, amount, currency, bank, agent, palette: p, onDone }: {
  reference: string; amount: number; currency: string; bank: PlatformBank | null; agent: boolean; palette: Palette; onDone: () => void;
}) {
  const h = useHaptics();
  const { playSuccess } = useTransactionSound();
  const [copied, setCopied] = useState<string | null>(null);
  // Success feedback once: sound + haptic, and the check mark springs in.
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    playSuccess('deposit');
    Animated.spring(pop, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    h.selection();
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
  };
  const rows: Array<[string, string | null | undefined]> = bank ? [
    ['Bank', bank.bankName],
    ['Account name', bank.accountName],
    ['IBAN', bank.iban],
    ['Account number', bank.accountNumber],
    ['SWIFT / BIC', bank.swift],
    ['Sort code', bank.sortCode],
    ['Routing number', bank.routingNumber],
    ['Branch', bank.branch],
  ] : [];
  const amountText = formatMoney(amount, currency as Currency, { showSymbol: true });

  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <Pressable onPress={() => copy(label, value)} style={({ pressed }) => ({
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
      borderTopWidth: 1, borderTopColor: p.border, opacity: pressed ? 0.7 : 1,
    })}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
        <Text selectable style={{ color: p.fg, fontSize: strong ? 17 : 14, fontWeight: strong ? '700' : '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
      <Ionicons name={copied === label ? 'checkmark' : 'copy-outline'} size={16} color={copied === label ? p.greenFg : p.fgMuted} />
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
      <FadeIn>
        <Animated.View style={{
          width: 56, height: 56, borderRadius: 28, backgroundColor: p.greenBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
        }}>
          <Ionicons name="checkmark" size={30} color={p.greenFg} />
        </Animated.View>
        <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', marginBottom: 6 }}>
          {agent ? `Pay ${amountText} to an agent` : `Send ${amountText} to Tazdan`}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
          {agent
            ? 'Show this reference to a Tazdan agent and pay in cash. Your wallet is credited once the agent confirms.'
            : 'Make a transfer from a bank account in your name. Include the reference so we can match it. Your wallet is credited once the money arrives, usually within one business day.'}
        </Text>
        <View style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
          <View style={{ marginTop: -1 }}>
            <Row label="Reference" value={reference} strong />
            <Row label="Amount" value={amountText} />
            {rows.filter(([, v]) => !!v).map(([label, value]) => <Row key={label} label={label} value={value!} />)}
          </View>
        </View>
        {bank?.memo ? <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 18, marginTop: 12 }}>{bank.memo}</Text> : null}
        <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 12 }}>Tap a line to copy it. You can find this deposit later in your activity.</Text>
        <View style={{ height: 20 }} />
        <CTAButton label="Done" onPress={onDone} />
      </FadeIn>
    </ScrollView>
  );
}

function Stepper({ step, palette: p }: { step: Step; palette: Palette }) {
  const idx = step === 'METHOD' ? 0 : step === 'AMOUNT' ? 1 : 2;
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            flex: 1, height: 4, borderRadius: 2,
            backgroundColor: i <= idx ? p.accent : p.divider,
          }}
        />
      ))}
    </View>
  );
}

function MethodList({
  methods, onPick, palette: p,
}: { methods: PaymentMethod[]; onPick: (m: PaymentMethod) => void; palette: Palette }) {
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          color: p.fgMuted, fontSize: 11, fontWeight: '500',
          letterSpacing: 0.8, marginBottom: 4,
        }}
      >
        CHOOSE A METHOD
      </Text>
      {methods.map((m) => (
        <PressableScale
          key={m.id}
          onPress={() => onPick(m)}
          disabled={!m.enabled}
          style={{
            flexDirection: 'row', alignItems: 'center',
            padding: 14, gap: 14, borderRadius: 18,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
            opacity: m.enabled ? 1 : 0.5,
          }}
        >
          <View
            style={{
              width: 44, height: 44, borderRadius: 14,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: p.pillBg,
            }}
          >
            <Ionicons name={m.icon as any} size={20} color={p.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}>{m.name}</Text>
              {!m.enabled && (
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: p.pillBg }}>
                  <Text style={{ color: p.fgMuted, fontSize: 9, fontWeight: '500' }}>SOON</Text>
                </View>
              )}
            </View>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
              {m.description}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500' }}>{m.speed}</Text>
              <Text style={{ color: p.fgFaint, fontSize: 11 }}>·</Text>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500' }}>{m.feeSummary}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={p.fgFaint} />
        </PressableScale>
      ))}
    </View>
  );
}

function AmountStep({
  method, currency, amount, onChangeAmount, onChangeCurrency, feeRows,
  onBack, onContinue, palette: p, stepUpThreshold, usdEquivalent,
}: {
  method: PaymentMethod;
  currency: Currency;
  amount: string;
  onChangeAmount: (v: string) => void;
  onChangeCurrency: (c: Currency) => void;
  feeRows: any;
  onBack: () => void;
  onContinue: () => void;
  palette: Palette;
  stepUpThreshold: number;
  usdEquivalent: number;
}) {
  const h = useHaptics();
  const v = Number(amount || 0);
  const requiresStepUp = usdEquivalent >= stepUpThreshold;
  const quickAmounts = method.id === 'LYD_AGENT' ? [100, 250, 500, 1000] : [25, 50, 100, 250];

  return (
    <View>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}
      >
        <Ionicons name="chevron-back" size={16} color={p.fgMuted} />
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{method.name}</Text>
      </Pressable>

      <Text
        style={{
          color: p.fgMuted, fontSize: 11, fontWeight: '500',
          letterSpacing: 0.8, marginBottom: 8,
        }}
      >
        CURRENCY
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {method.currencies.map((c) => (
          <Pressable
            key={c}
            onPress={() => { h.selection(); onChangeCurrency(c); }}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <CurrencyBadge
              code={c}
              variant="chip"
              size="md"
              style={{
                backgroundColor: currency === c ? p.accent : p.bgElev,
                borderColor: currency === c ? p.accent : p.border,
              }}
              codeStyle={{ color: currency === c ? p.accentFg : p.fg }}
            />
          </Pressable>
        ))}
      </View>

      <Text
        style={{
          color: p.fgMuted, fontSize: 11, fontWeight: '500',
          letterSpacing: 0.8, marginBottom: 8,
        }}
      >
        AMOUNT
      </Text>
      <View
        style={{
          flexDirection: 'row', alignItems: 'baseline',
          backgroundColor: p.bgElev,
          borderRadius: 16, borderWidth: 1, borderColor: p.border,
          paddingHorizontal: 18, paddingVertical: 14, gap: 8,
        }}
      >
        <CurrencyBadge code={currency} size="lg" glyphOnly />
        <TextInput
          value={amount}
          onChangeText={(t) => onChangeAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
          placeholder="0"
          placeholderTextColor={p.fgFaint}
          keyboardType="decimal-pad"
          style={{
            flex: 1, color: p.fg,
            fontSize: 36, fontWeight: '500',
            letterSpacing: -1.2,
            fontVariant: ['tabular-nums'],
          }}
        />
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{currency}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {quickAmounts.map((q) => (
          <PressableScale
            key={q}
            onPress={() => { h.selection(); onChangeAmount(String(q)); }}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 12,
              backgroundColor: p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '500' }}>
              {formatMoney(q, currency, { showSymbol: true })}
            </Text>
          </PressableScale>
        ))}
      </View>

      {feeRows && (
        <View style={{ marginTop: 22 }}>
          <Text
            style={{
              color: p.fgMuted, fontSize: 11, fontWeight: '500',
              letterSpacing: 0.8, marginBottom: 8,
            }}
          >
            FEE BREAKDOWN
          </Text>
          <FeeBreakdown rows={feeRows.rows} total={feeRows.total} />
        </View>
      )}

      {requiresStepUp && (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            marginTop: 14,
            paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
            backgroundColor: p.amberBg,
          }}
        >
          <Ionicons name="finger-print" size={16} color={p.amberFg} />
          <Text style={{ color: p.amberFg, fontSize: 12, fontWeight: '500', flex: 1 }}>
            Face ID required to confirm transactions ≥ ${stepUpThreshold}.
          </Text>
        </View>
      )}

      <View style={{ marginTop: 20 }}>
        <CTAButton
          label={v > 0 ? `Continue · ${formatMoney(v, currency, { showSymbol: true })}` : 'Enter amount'}
          icon="arrow-forward"
          disabled={v <= 0}
          onPress={onContinue}
        />
      </View>
    </View>
  );
}

function ConfirmStep({
  method, currency, amount, feeRows, busy, ctaState, successLabel, errorLabel, onBack, onSubmit, requiresBiometric, palette: p,
}: {
  method: PaymentMethod;
  currency: Currency;
  amount: number;
  feeRows: { rows: any[]; total: any };
  busy: boolean;
  ctaState: CTAState;
  successLabel?: string;
  errorLabel?: string;
  onBack: () => void;
  onSubmit: () => void;
  requiresBiometric: boolean;
  palette: Palette;
}) {
  return (
    <View>
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}
      >
        <Ionicons name="chevron-back" size={16} color={p.fgMuted} />
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>Edit amount</Text>
      </Pressable>

      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>You're topping up</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
        <Text
          style={{
            color: p.fg, fontSize: 44, fontWeight: '500',
            letterSpacing: -1.6, fontVariant: ['tabular-nums'],
          }}
        >
          {formatMoney(amount, currency, { showSymbol: true })}
        </Text>
      </View>

      <SheetSection label="Method">
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            padding: 14, borderRadius: 16,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
          }}
        >
          <View
            style={{
              width: 40, height: 40, borderRadius: 12,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: p.pillBg,
            }}
          >
            <Ionicons name={method.icon as any} size={18} color={p.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500' }}>{method.name}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{method.speed} · {method.feeSummary}</Text>
          </View>
        </View>
      </SheetSection>

      <SheetSection label="Cost">
        <FeeBreakdown rows={feeRows.rows} total={feeRows.total} />
      </SheetSection>

      <View style={{ marginTop: 22 }}>
        <CTAButton
          label={requiresBiometric ? 'Confirm with Face ID' : `Confirm top-up`}
          icon={requiresBiometric ? 'finger-print' : 'checkmark-circle'}
          loading={busy}
          state={ctaState}
          successLabel={successLabel ?? undefined}
          errorLabel={errorLabel ?? undefined}
          onPress={onSubmit}
        />
      </View>
      {busy && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <ActivityIndicator color={p.fgMuted} />
        </View>
      )}
    </View>
  );
}
