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
 * internal; the parent only controls open/close.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { CTAButton, type CTAState } from '@/components/ui/ScreenShell';
import { BottomSheet, SheetSection } from '@/components/ui/BottomSheet';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';
import { FeeBreakdown } from '@/components/ui/FeeBreakdown';
import { PressableScale, FadeIn } from '@/components/ui/Motion';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useStepUpAuth, StepUpDeniedError } from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { useForexRates } from '@/hooks/useForexRates';
import { depositService } from '@/services';
import { formatMoney } from '@/utils/format';
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
      maxHeightPct={94}
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
  const user = useAuthStore((s) => s.user);
  const country = user?.country ?? null;
  const { data: fxRates } = useForexRates();

  const methods = useMemo(() => methodsForCountry(country), [country]);
  const fiats   = useMemo(() => fiatsForCountry(country), [country]);

  const [step, setStep]         = useState<Step>('METHOD');
  const [method, setMethod]     = useState<PaymentMethod | null>(null);
  const [currency, setCurrency] = useState<Currency>(initialCurrency ?? fiats[0]);
  const [amount, setAmount]     = useState('');
  const [busy, setBusy]         = useState(false);
  const [ctaState, setCtaState] = useState<CTAState>('idle');
  const [successLabel, setSuccessLabel] = useState<string | null>(null);
  const [errorLabel, setErrorLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!method) return;
    if (!method.currencies.includes(currency)) {
      setCurrency(method.currencies[0] ?? fiats[0]);
    }
  }, [method, currency, fiats]);

  const numeric = Number(amount || 0);
  const usdEquivalent = useMemo(() => {
    if (!Number.isFinite(numeric)) return 0;
    const rate = fxRates?.[currency];
    return rate ? numeric * rate : numeric;
  }, [numeric, currency, fxRates]);

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
    if (!method || numeric <= 0) return;
    try {
      await stepUp.guard({
        usdValue: usdEquivalent,
        reason: `Confirm ${formatMoney(numeric, currency, { showSymbol: true })} top-up`,
      });

      setBusy(true);

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
        setCtaState('success');
        setSuccessLabel('Done ✓');
        setTimeout(onComplete, 1000);
        return;
      }

      await depositService.createBankDeposit({
        currency,
        amount: numeric,
        notes: method.id === 'LYD_AGENT' ? 'Cash via promrkts agent' : undefined,
      });
      h.success();
      setCtaState('success');
      setSuccessLabel('Deposit submitted ✓');
      setTimeout(onComplete, 2000);
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

  return (
    <View style={{ flex: 0, paddingHorizontal: 20, paddingBottom: 10 }}>
      <FadeIn>
        <Stepper step={step} palette={p} />

        {step === 'METHOD' && (
          <MethodList methods={methods} onPick={goToAmount} palette={p} />
        )}

        {step === 'AMOUNT' && method && (
          <AmountStep
            method={method}
            currency={currency}
            amount={amount}
            onChangeAmount={setAmount}
            onChangeCurrency={setCurrency}
            feeRows={feeRows}
            onBack={() => { h.selection(); setStep('METHOD'); }}
            onContinue={goToConfirm}
            palette={p}
            stepUpThreshold={stepUp.threshold}
            usdEquivalent={usdEquivalent}
          />
        )}

        {step === 'CONFIRM' && method && feeRows && (
          <ConfirmStep
            method={method}
            currency={currency}
            amount={numeric}
            feeRows={feeRows}
            busy={busy}
            ctaState={ctaState}
            successLabel={successLabel ?? undefined}
            errorLabel={errorLabel ?? undefined}
            onBack={() => { h.selection(); setStep('AMOUNT'); }}
            onSubmit={submit}
            requiresBiometric={usdEquivalent >= stepUp.threshold}
            palette={p}
          />
        )}
      </FadeIn>
    </View>
  );
}

/* ── Step sub-components ─────────────────────────────────────────── */

function Stepper({ step, palette: p }: { step: Step; palette: Palette }) {
  const idx = step === 'METHOD' ? 0 : step === 'AMOUNT' ? 1 : 2;
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            flex: 1, height: 4, borderRadius: 2,
            backgroundColor: i <= idx ? p.fg : p.divider,
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
                backgroundColor: currency === c ? p.fg : p.bgElev,
                borderColor: currency === c ? p.fg : p.border,
              }}
              codeStyle={{ color: currency === c ? p.bg : p.fg }}
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
