/**
 * New international transfer: corridor → recipient → amount (live quote) → review.
 *
 * The quote is priced and locked by the server for its TTL; confirming spends
 * it once (idempotency key per review). High-value or new-device transfers
 * confirm with Face ID / Touch ID and, if the server asks, a 6-digit code.
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, useWallets, useStepUpAuth, StepUpDeniedError, extractErrorMessage } from '@/hooks';
import { useUsdValue } from '@/hooks/useForexRates';
import { isStepUpChallengeError } from '@/lib/stepUpErrors';
import { remittanceService, type Beneficiary, type Corridor, type PayoutMethod, type Quote } from '@/services/remittance';
import { QUERY_KEYS } from '@/constants';

type Step = 'corridor' | 'recipient' | 'amount' | 'review';
const PURPOSES = ['FAMILY_SUPPORT', 'EDUCATION', 'MEDICAL', 'SAVINGS', 'GOODS_AND_SERVICES', 'SALARY', 'RENT', 'GIFT', 'OTHER'];
const newKey = () => `rmt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const fmt = (v: string | number, max = 2) => Number(v).toLocaleString('en-US', { maximumFractionDigits: max, minimumFractionDigits: Math.min(2, max) });

export default function NewRemittance() {
  const router = useRouter();
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const qc = useQueryClient();
  const stepUp = useStepUpAuth();
  const { data: wallets } = useWallets();
  const toUsd = useUsdValue();

  const [step, setStep] = useState<Step>('corridor');
  const [corridor, setCorridor] = useState<Corridor | null>(null);
  const [recipient, setRecipient] = useState<Beneficiary | null>(null);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('FAMILY_SUPPORT');
  const [sourceOfFunds, setSourceOfFunds] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const idem = useRef(newKey());

  const corridorsQ = useQuery({ queryKey: ['remit-corridors'], queryFn: remittanceService.corridors });
  const benQ = useQuery({ queryKey: ['remit-beneficiaries'], queryFn: remittanceService.beneficiaries });
  const available = (corridorsQ.data ?? []).filter((c) => c.available);
  const recipients = (benQ.data ?? []).filter((b) => corridor && b.currency === corridor.destCurrency && corridor.payoutMethods.includes(b.payoutMethod));

  const wallet = wallets?.find((w) => w.currency === corridor?.sourceCurrency);
  const balance = wallet ? Number(wallet.balance) - Number(wallet.frozen ?? 0) : 0;
  const v = Number(amount || 0);

  // Live quote — debounced, refreshed before the server-side TTL lapses.
  const [debounced, setDebounced] = useState(0);
  useEffect(() => { const id = setTimeout(() => setDebounced(v), 400); return () => clearTimeout(id); }, [v]);
  const quoteQ = useQuery({
    queryKey: ['remit-quote', corridor?.code, recipient?.id, debounced],
    queryFn: () => remittanceService.quote({ corridorCode: corridor!.code, sendAmount: debounced, beneficiaryId: recipient!.id }),
    enabled: Boolean(corridor && recipient && debounced > 0 && (step === 'amount' || step === 'review')),
    refetchInterval: corridor ? Math.max(10, corridor.quoteTtlSeconds - 10) * 1000 : false,
    retry: false,
  });
  const quote: Quote | null = quoteQ.data && debounced === v ? quoteQ.data : null;
  useEffect(() => { idem.current = newKey(); }, [quote?.id]); // a new price is a new request
  const overspend = quote ? Number(quote.totalDebit) > balance : false;

  const send = useMutation({
    mutationFn: async (stepUpCode?: string) => {
      let biometricVerified = false;
      if (!stepUpCode) {
        // Same valuation the Send screen uses; the server re-values and decides step-up itself.
        const usdValue = toUsd(Number(quote!.totalDebit), corridor!.sourceCurrency) ?? Number.POSITIVE_INFINITY;
        biometricVerified = await stepUp.guard({ usdValue, reason: t('remit.confirmBiometric', { amount: fmt(quote!.receiveAmount), currency: corridor!.destCurrency, name: recipient!.fullName }) });
      }
      return remittanceService.create({
        quoteId: quote!.id, beneficiaryId: recipient!.id, purpose, idempotencyKey: idem.current,
        ...(sourceOfFunds.trim() ? { sourceOfFunds: sourceOfFunds.trim() } : {}),
        ...(stepUpCode ? { stepUpCode } : {}),
        ...(biometricVerified ? { biometricVerified: true } : {}),
      });
    },
    onSuccess: ({ transfer }) => {
      h.success();
      setStepUpOpen(false);
      qc.invalidateQueries({ queryKey: ['remit-transfers'] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.wallets });
      router.replace(`/remit/${transfer.id}` as never);
    },
  });

  const confirm = async (stepUpCode?: string) => {
    try { await send.mutateAsync(stepUpCode); }
    catch (e: any) {
      if (e instanceof StepUpDeniedError) { h.error(); Alert.alert(t('remit.failed'), e.message); return; }
      if (isStepUpChallengeError(e) && !stepUpCode) { setStepUpOpen(true); return; }
      if (stepUpCode) throw e; // the code modal shows the error
      h.error();
      if (e?.response?.status === 409 || /quote/i.test(String(e?.response?.data?.error ?? ''))) void quoteQ.refetch();
      Alert.alert(t('remit.failed'), extractErrorMessage(e, t('common.retry')));
    }
  };

  const back = () => {
    if (step === 'recipient') setStep('corridor');
    else if (step === 'amount') setStep('recipient');
    else if (step === 'review') setStep('amount');
    else router.back();
  };

  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: p.fgMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: p.fg, fontSize: strong ? 15 : 13, fontWeight: strong ? '700' : '600' }}>{value}</Text>
    </View>
  );

  return (
    <ScreenShell title={t('remit.new')} onBack={back} keyboard>
      {/* ── 1. Corridor ── */}
      {step === 'corridor' && (
        <View>
          <Text style={{ color: p.fgMuted, fontSize: 14, marginBottom: 14 }}>{t('remit.pickCorridor')}</Text>
          {corridorsQ.isLoading ? <Text style={{ color: p.fgMuted }}>{t('common.loading')}</Text> : available.length === 0 ? (
            <Panel style={{ padding: 18 }}><Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center' }}>{t('remit.noCorridors')}</Text></Panel>
          ) : (
            <View style={{ gap: 8 }}>
              {available.map((c) => (
                <Pressable key={c.code} onPress={() => { h.selection(); setCorridor(c); setRecipient(null); setAmount(''); setStep('recipient'); }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 14, padding: 14, opacity: pressed ? 0.8 : 1 })}>
                  <View>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{c.name}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{c.sourceCurrency} → {c.destCurrency}{c.sandbox ? ` · ${t('remit.sandboxShort')}` : ''}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={p.fgFaint} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── 2. Recipient ── */}
      {step === 'recipient' && corridor && (
        <View>
          <Text style={{ color: p.fgMuted, fontSize: 14, marginBottom: 14 }}>{t('remit.pickRecipient', { country: corridor.name })}</Text>
          <View style={{ gap: 8 }}>
            {recipients.map((b) => (
              <Pressable key={b.id} onPress={() => { h.selection(); setRecipient(b); setStep('amount'); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 14, padding: 14, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{b.fullName}</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
                    {t(`remit.method.${b.payoutMethod}`)}{b.iban ? ` · …${b.iban.slice(-4)}` : b.accountNumber ? ` · …${b.accountNumber.slice(-4)}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={p.fgFaint} />
              </Pressable>
            ))}
            {!benQ.isLoading && recipients.length === 0 ? <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 4 }}>{t('remit.noRecipients')}</Text> : null}
          </View>
          <View style={{ marginTop: 16 }}>
            <CTAButton label={t('remit.addRecipient')} icon="person-add-outline" onPress={() => setAddOpen(true)} />
          </View>
        </View>
      )}

      {/* ── 3. Amount ── */}
      {step === 'amount' && corridor && recipient && (
        <View>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>{t('remit.youSend').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.bgElev, borderWidth: 1, borderColor: overspend ? p.redFg : p.border, borderRadius: 14, paddingHorizontal: 14 }}>
            <TextInput value={amount} onChangeText={(x) => setAmount(x.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.fgFaint}
              style={{ flex: 1, color: p.fg, fontSize: 26, fontWeight: '600', paddingVertical: 14 }} />
            <Text style={{ color: p.fgMuted, fontSize: 16, fontWeight: '600' }}>{corridor.sourceCurrency}</Text>
          </View>
          <Text style={{ color: overspend ? p.redFg : p.fgFaint, fontSize: 12, marginTop: 6 }}>
            {t('remit.available', { amount: fmt(balance), currency: corridor.sourceCurrency })}
          </Text>

          <Panel style={{ marginTop: 18, padding: 14 }}>
            {quote ? (
              <View>
                <Row label={t('remit.fee')} value={`${fmt(quote.feeAmount)} ${corridor.sourceCurrency}`} />
                <Row label={t('remit.rate')} value={`1 ${corridor.sourceCurrency} = ${fmt(quote.customerRate, 6)} ${corridor.destCurrency}`} />
                <Row label={t('remit.totalToPay')} value={`${fmt(quote.totalDebit)} ${corridor.sourceCurrency}`} />
                <View style={{ height: 1, backgroundColor: p.border, marginVertical: 6 }} />
                <Row label={t('remit.theyGet', { name: recipient.fullName.split(' ')[0] })} value={`${fmt(quote.receiveAmount)} ${corridor.destCurrency}`} strong />
                {quote.estimatedDeliveryMinutes !== null ? <Row label={t('remit.arrives')} value={quote.estimatedDeliveryMinutes < 60 ? t('remit.minutes', { n: quote.estimatedDeliveryMinutes }) : t('remit.hours', { n: Math.ceil(quote.estimatedDeliveryMinutes / 60) })} /> : null}
                {!quote.payoutAvailable ? <Text style={{ color: p.amberFg, fontSize: 12, marginTop: 6 }}>{t('remit.noPayoutRoute')}</Text> : null}
              </View>
            ) : (
              <Text style={{ color: quoteQ.isError ? p.redFg : p.fgMuted, fontSize: 13 }}>
                {quoteQ.isError ? extractErrorMessage(quoteQ.error, t('remit.quoteFailed')) : v > 0 ? t('remit.pricing') : t('remit.enterAmount')}
              </Text>
            )}
          </Panel>

          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginTop: 20, marginBottom: 8 }}>{t('remit.purpose').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PURPOSES.filter((x) => corridor.purposes.includes(x)).map((x) => {
              const on = purpose === x;
              return (
                <Pressable key={x} onPress={() => { h.selection(); setPurpose(x); }}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border }}>
                  <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600' }}>{t(`remit.purpose.${x}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginTop: 20, marginBottom: 8 }}>{t('remit.sourceOfFunds').toUpperCase()}</Text>
          <TextInput value={sourceOfFunds} onChangeText={setSourceOfFunds} placeholder={t('remit.sourceOfFundsHint')} placeholderTextColor={p.fgFaint}
            style={{ color: p.fg, fontSize: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 12, padding: 12 }} />

          <View style={{ marginTop: 22 }}>
            <CTAButton label={t('common.continue')} icon="arrow-forward" disabled={!quote || overspend || !quote.payoutAvailable} onPress={() => { h.selection(); setStep('review'); }} />
          </View>
        </View>
      )}

      {/* ── 4. Review ── */}
      {step === 'review' && corridor && recipient && (
        <View>
          <Panel style={{ padding: 16 }}>
            <Row label={t('remit.to')} value={recipient.fullName} />
            <Row label={t('remit.via')} value={t(`remit.method.${recipient.payoutMethod}`)} />
            <Row label={t('remit.corridor')} value={corridor.name} />
            <Row label={t('remit.purpose')} value={t(`remit.purpose.${purpose}`)} />
            <View style={{ height: 1, backgroundColor: p.border, marginVertical: 6 }} />
            {quote ? (
              <>
                <Row label={t('remit.youSend')} value={`${fmt(quote.sendAmount)} ${corridor.sourceCurrency}`} />
                <Row label={t('remit.fee')} value={`${fmt(quote.feeAmount)} ${corridor.sourceCurrency}`} />
                <Row label={t('remit.rate')} value={`1 ${corridor.sourceCurrency} = ${fmt(quote.customerRate, 6)} ${corridor.destCurrency}`} />
                <Row label={t('remit.totalToPay')} value={`${fmt(quote.totalDebit)} ${corridor.sourceCurrency}`} strong />
                <Row label={t('remit.theyGet', { name: recipient.fullName.split(' ')[0] })} value={`${fmt(quote.receiveAmount)} ${corridor.destCurrency}`} strong />
              </>
            ) : <Text style={{ color: p.fgMuted, fontSize: 13 }}>{t('remit.pricing')}</Text>}
          </Panel>
          {quote?.sandbox ? (
            <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: p.amberBg }}>
              <Text style={{ color: p.amberFg, fontSize: 12, lineHeight: 18 }}>{t('remit.sandboxNotice')}</Text>
            </View>
          ) : null}
          <Text style={{ color: p.fgFaint, fontSize: 12, lineHeight: 18, marginTop: 12 }}>{t('remit.reviewNote')}</Text>
          <View style={{ marginTop: 18 }}>
            <CTAButton label={t('remit.send')} icon="paper-plane" loading={send.isPending} disabled={!quote || overspend || send.isPending} onPress={() => { void confirm(); }} />
          </View>
        </View>
      )}

      <AddRecipientSheet visible={addOpen} corridor={corridor} onClose={() => setAddOpen(false)}
        onAdded={(b) => { setAddOpen(false); qc.invalidateQueries({ queryKey: ['remit-beneficiaries'] }); setRecipient(b); setStep('amount'); }} />
      <StepUpModal visible={stepUpOpen} action="transfer"
        subtitle={quote && corridor ? `${fmt(quote.receiveAmount)} ${corridor.destCurrency} → ${recipient?.fullName ?? ''}` : undefined}
        onSubmit={(code) => confirm(code)} onCancel={() => setStepUpOpen(false)} />
    </ScreenShell>
  );
}

function AddRecipientSheet({ visible, corridor, onClose, onAdded }: { visible: boolean; corridor: Corridor | null; onClose: () => void; onAdded: (b: Beneficiary) => void }) {
  const p = useThemedPalette();
  const t = useT();
  const methods = (corridor?.payoutMethods ?? []) as PayoutMethod[];
  const [method, setMethod] = useState<PayoutMethod>('BANK_ACCOUNT');
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [country, setCountry] = useState('');
  const [iban, setIban] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [mobileWallet, setMobileWallet] = useState('');
  const [handle, setHandle] = useState('');
  useEffect(() => {
    if (!visible || !corridor) return;
    setMethod(methods.includes('BANK_ACCOUNT') ? 'BANK_ACCOUNT' : methods[0]);
    setCountry(corridor.destCountry === 'EU' ? '' : corridor.destCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, corridor?.code]);
  const uk = country.toUpperCase() === 'GB';

  const add = useMutation({
    mutationFn: () => remittanceService.addBeneficiary({
      fullName: fullName.trim(), relationship: relationship.trim() || undefined, country: country.trim().toUpperCase(), currency: corridor!.destCurrency, payoutMethod: method,
      ...(method === 'BANK_ACCOUNT' ? { bankName: bankName.trim() || undefined, ...(iban.trim() ? { iban: iban.trim() } : { sortCode: sortCode.trim() || undefined, accountNumber: accountNumber.trim() || undefined }) } : {}),
      ...(method === 'MOBILE_WALLET' ? { mobileWallet: mobileWallet.trim() } : {}),
      ...(method === 'TAZDAN_WALLET' ? { tazdanHandle: handle.trim() } : {}),
    }),
    onSuccess: (b) => { setFullName(''); setRelationship(''); setIban(''); setSortCode(''); setAccountNumber(''); setBankName(''); setMobileWallet(''); setHandle(''); onAdded(b); },
    onError: (e: any) => Alert.alert(t('remit.addFailed'), extractErrorMessage(e, t('common.retry'))),
  });

  const field = (label: string, value: string, set: (x: string) => void, extra: Record<string, any> = {}) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 }}>{label.toUpperCase()}</Text>
      <TextInput value={value} onChangeText={set} placeholderTextColor={p.fgFaint}
        style={{ color: p.fg, fontSize: 15, backgroundColor: p.bg, borderWidth: 1, borderColor: p.border, borderRadius: 12, padding: 12 }} {...extra} />
    </View>
  );

  const ready = fullName.trim().split(/\s+/).length >= 2 && country.trim().length === 2 && (
    method === 'BANK_ACCOUNT' ? Boolean(iban.trim() || (uk ? sortCode.trim() && accountNumber.trim() : accountNumber.trim()))
      : method === 'MOBILE_WALLET' ? Boolean(mobileWallet.trim())
      : method === 'TAZDAN_WALLET' ? Boolean(handle.trim()) : true);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('remit.addRecipient')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {methods.map((m) => {
          const on = method === m;
          return (
            <Pressable key={m} onPress={() => setMethod(m)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border }}>
              <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600' }}>{t(`remit.method.${m}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      {field(t('remit.fullName'), fullName, setFullName, { autoCapitalize: 'words', placeholder: t('remit.fullNameHint') })}
      {field(t('remit.relationship'), relationship, setRelationship, { placeholder: t('remit.relationshipHint') })}
      {method !== 'TAZDAN_WALLET' ? field(t('remit.country'), country, (x) => setCountry(x.toUpperCase().slice(0, 2)), { autoCapitalize: 'characters', placeholder: 'GB' }) : null}
      {method === 'BANK_ACCOUNT' ? (
        <>
          {field(t('remit.bankName'), bankName, setBankName)}
          {field('IBAN', iban, setIban, { autoCapitalize: 'characters', placeholder: uk ? t('remit.optional') : '' })}
          {!iban.trim() && uk ? field(t('remit.sortCode'), sortCode, setSortCode, { keyboardType: 'number-pad', placeholder: '00-00-00' }) : null}
          {!iban.trim() ? field(t('remit.accountNumber'), accountNumber, setAccountNumber, { keyboardType: 'number-pad' }) : null}
        </>
      ) : null}
      {method === 'MOBILE_WALLET' ? field(t('remit.mobileWallet'), mobileWallet, setMobileWallet, { keyboardType: 'phone-pad' }) : null}
      {method === 'TAZDAN_WALLET' ? field(t('remit.handle'), handle, setHandle, { autoCapitalize: 'none', placeholder: '@handle' }) : null}
      <CTAButton label={t('remit.saveRecipient')} icon="checkmark" loading={add.isPending} disabled={!ready || add.isPending} onPress={() => add.mutate()} />
    </BottomSheet>
  );
}
