/**
 * DepositWidget — production-ready fiat + crypto deposit flow.
 *
 * Fiat: KYC gate → centered amount entry → platform bank details + sender info → submit.
 * Crypto: show wallet address (handled by ReceiveWidget shortcut).
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { depositService } from '@/services';
import { usePlatformBanks } from '@/hooks';

// ── Fiat currencies that require KYC ────────────────────────────────
const FIAT_SET = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD']);

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'USDT', 'BTC', 'ETH', 'SOL', 'BNB'];

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SAR: '﷼',
  EGP: 'E£', LYD: 'LD', USDT: '₮', BTC: '₿', ETH: 'Ξ', SOL: '◎', BNB: 'BNB',
};

// Platform receiving bank details per fiat currency
const PLATFORM_BANKS: Record<string, {
  bankName: string;
  accountHolder: string;
  accountNumber?: string;
  iban?: string;
  swift: string;
  sortCode?: string;
  routingNumber?: string;
  extra?: string;
}> = {
  USD: { bankName: 'JPMorgan Chase Bank', accountHolder: 'Fortuni Inc.', accountNumber: '000123456789', swift: 'CHASUS33', routingNumber: '021000021' },
  EUR: { bankName: 'Deutsche Bank AG', accountHolder: 'Fortuni GmbH', iban: 'DE89370400440532013000', swift: 'DEUTDEFF' },
  GBP: { bankName: 'Barclays Bank plc', accountHolder: 'Fortuni Ltd', iban: 'GB82WEST12345698765432', swift: 'BARCGB22', sortCode: '20-00-00', accountNumber: '98765432' },
  AED: { bankName: 'Emirates NBD', accountHolder: 'Fortuni DMCC', iban: 'AE070331234567890123456', swift: 'EBILAEAD' },
  SAR: { bankName: 'Saudi National Bank', accountHolder: 'Fortuni Arabia', iban: 'SA0380000000608010167519', swift: 'NCBASARI' },
  EGP: { bankName: 'National Bank of Egypt', accountHolder: 'Fortuni Egypt', iban: 'EG380002000000000012345678901', swift: 'NBEGEGCX' },
  LYD: { bankName: 'Bank of Commerce & Development', accountHolder: 'Fortuni Libya', accountNumber: '001-123456-001', swift: 'BCDLLYLT' },
};

type Step = 'currency' | 'amount' | 'bank';

function CopyRow({ label, value, p }: { label: string; value: string; p: any }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '500', letterSpacing: 0.7, marginBottom: 4 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 }} numberOfLines={2}>
          {value}
        </Text>
        <Pressable onPress={copy} hitSlop={8} style={{ padding: 6, borderRadius: 8, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? p.greenFg : p.fgMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export function DepositWidget() {
  const p = useThemedPalette();
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('currency');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [senderName, setSenderName] = useState(
    user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
  );
  const [reference, setReference] = useState('');

  const isFiat = FIAT_SET.has(currency);
  const sym = SYMBOLS[currency] ?? currency;
  const v = Number(amount || 0);

  // Platform beneficiary banks are now admin-managed and fetched live
  // from /api/platform-banks. We fall back to the hardcoded constant
  // only when the API has no row for the selected currency yet, so the
  // UI never goes blank during the rollout.
  const { data: platformBanks } = usePlatformBanks(currency);
  const apiBank = (platformBanks ?? []).find((b) => b.currency === currency && b.isActive);
  const bank = apiBank
    ? {
        bankName:       apiBank.bankName,
        accountHolder:  apiBank.accountName,
        accountNumber:  apiBank.accountNumber ?? undefined,
        iban:           apiBank.iban ?? undefined,
        swift:          apiBank.swift ?? '',
        sortCode:       apiBank.sortCode ?? undefined,
        routingNumber:  apiBank.routingNumber ?? undefined,
        extra:          apiBank.memo ?? undefined,
      }
    : PLATFORM_BANKS[currency];
  const kycApproved = user?.kycStatus === 'APPROVED';
  const valid = v > 0 && senderName.trim().length >= 2 && reference.trim().length >= 3;

  const depositMutation = useMutation({
    mutationFn: () => depositService.createBankDeposit({
      currency,
      amount: v,
      bankName: bank?.bankName ?? '',
      accountNumber: bank?.iban ?? bank?.accountNumber ?? '',
      senderName: senderName.trim(),
      notes: `REF: ${reference.trim()}`,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Deposit Submitted ✓',
        `Your ${sym}${v.toFixed(2)} deposit request has been received. We'll credit your account once the transfer clears (typically 1–3 business days).`,
        [{ text: 'Got it' }],
      );
      setStep('currency');
      setAmount('');
      setReference('');
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to submit deposit';
      Alert.alert('Deposit Failed', msg);
    },
  });

  /* ── STEP 0: Currency selection ── */
  if (step === 'currency') {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CURRENCIES.map((c) => {
            const on = c === currency;
            return (
              <Pressable
                key={c}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCurrency(c); }}
                style={({ pressed }) => ({
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                  backgroundColor: on ? p.fg : p.pillBg,
                  borderWidth: 1, borderColor: on ? p.fg : p.border,
                  opacity: pressed ? 0.8 : 1,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                })}
              >
                <Text style={{ color: on ? p.bg : p.fg, fontWeight: '500', fontSize: 14 }}>{c}</Text>
                {FIAT_SET.has(c) && (
                  <Text style={{ color: on ? p.bg : p.fgFaint, fontSize: 10 }}>fiat</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* KYC warning for fiat */}
        {isFiat && !kycApproved && (
          <View style={{
            marginTop: 20, padding: 16, borderRadius: 14,
            backgroundColor: 'rgba(245,158,11,0.10)',
            borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Ionicons name="shield-outline" size={20} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontSize: 14, fontWeight: '500', flex: 1 }}>
                KYC Required for Fiat Deposits
              </Text>
            </View>
            <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 }}>
              To deposit {currency} you need to complete identity verification. Crypto deposits are available without KYC.
            </Text>
            <Pressable
              onPress={() => router.push('/kyc' as any)}
              style={{ backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14 }}>Complete KYC →</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (isFiat && !kycApproved) {
              Alert.alert('KYC Required', 'Please complete identity verification to deposit fiat currencies.');
              return;
            }
            setStep('amount');
          }}
          style={({ pressed }) => ({
            marginTop: 24, height: 56, borderRadius: 14,
            backgroundColor: (isFiat && !kycApproved) ? p.bgElev : p.ctaBg,
            borderWidth: (isFiat && !kycApproved) ? 1 : 0, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: (isFiat && !kycApproved) ? p.fgMuted : p.ctaFg, fontSize: 16, fontWeight: '500' }}>
            Continue with {currency}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={(isFiat && !kycApproved) ? p.fgMuted : p.ctaFg} />
        </Pressable>
      </View>
    );
  }

  /* ── STEP 1: Amount (centered, big) ── */
  if (step === 'amount') {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        {/* Back */}
        <Pressable onPress={() => setStep('currency')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 }}>
          <Ionicons name="chevron-back" size={18} color={p.fgMuted} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>{currency}</Text>
        </Pressable>

        {/* Big centered amount */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ color: p.fgFaint, fontSize: 13, fontWeight: '500', marginBottom: 16, letterSpacing: 0.5 }}>
            HOW MUCH?
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={{ color: v > 0 ? p.fg : p.fgFaint, fontSize: 52, fontWeight: '500', letterSpacing: -0.5 }}>
              {sym}
            </Text>
            <TextInput
              value={amount}
              onChangeText={(raw) => {
                const filtered = raw.replace(/[^0-9.]/g, '');
                const parts = filtered.split('.');
                setAmount(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered);
              }}
              placeholder="0"
              placeholderTextColor={p.fgFaint}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              autoFocus
              style={{
                color: v > 0 ? p.fg : p.fgFaint,
                fontSize: 64, fontWeight: '500', letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
                minWidth: 80, textAlign: 'center',
              }}
            />
          </View>
          <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 8 }}>
            Bank transfer · {isFiat ? '1–3 business days' : 'crypto on-chain'}
          </Text>
        </View>

        {/* Quick chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 28 }}>
          {[50, 100, 250, 500, 1000].map((q) => (
            <Pressable
              key={q}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAmount(String(q)); }}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 11, borderRadius: 12,
                backgroundColor: Number(amount) === q ? p.fg : p.pillBg,
                borderWidth: 1, borderColor: Number(amount) === q ? p.fg : p.border,
                alignItems: 'center', opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: Number(amount) === q ? p.bg : p.fg, fontSize: 12, fontWeight: '500' }}>
                {sym}{q}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => { if (v > 0) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('bank'); } }}
          disabled={v <= 0}
          style={({ pressed }) => ({
            height: 56, borderRadius: 14,
            backgroundColor: v > 0 ? p.ctaBg : p.bgElev,
            borderWidth: v > 0 ? 0 : 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: v > 0 ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '500' }}>
            {v > 0 ? `Deposit ${sym}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Enter an amount'}
          </Text>
          {v > 0 && <Ionicons name="arrow-forward" size={16} color={p.ctaFg} />}
        </Pressable>
      </View>
    );
  }

  /* ── STEP 2: Bank details + sender info ── */
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
    >
      {/* Back */}
      <Pressable onPress={() => setStep('amount')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        <Ionicons name="chevron-back" size={18} color={p.fgMuted} />
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>
          {sym}{v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </Pressable>

      {/* Amount summary */}
      <View style={{
        backgroundColor: p.bgElev, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: p.border, marginBottom: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '500', letterSpacing: 0.6 }}>YOU SEND</Text>
          <Text style={{ color: p.fg, fontSize: 26, fontWeight: '500', letterSpacing: 0, marginTop: 2 }}>
            {sym}{v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={{ padding: 10, borderRadius: 10, backgroundColor: p.greenBg }}>
          <Ionicons name="arrow-down-circle" size={22} color={p.greenFg} />
        </View>
      </View>

      {/* Platform bank details */}
      {bank && (
        <View style={{
          backgroundColor: p.bgElev, borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: p.border, marginBottom: 20,
        }}>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '500', letterSpacing: 0.7, marginBottom: 14 }}>
            TRANSFER TO THIS ACCOUNT
          </Text>
          <CopyRow label="BANK" value={bank.bankName} p={p} />
          <CopyRow label="ACCOUNT HOLDER" value={bank.accountHolder} p={p} />
          {bank.iban && <CopyRow label="IBAN" value={bank.iban} p={p} />}
          {bank.accountNumber && !bank.iban && <CopyRow label="ACCOUNT NUMBER" value={bank.accountNumber} p={p} />}
          {bank.sortCode && <CopyRow label="SORT CODE" value={bank.sortCode} p={p} />}
          {bank.routingNumber && <CopyRow label="ROUTING NUMBER" value={bank.routingNumber} p={p} />}
          <CopyRow label="SWIFT / BIC" value={bank.swift} p={p} />
          <View style={{
            backgroundColor: p.bg, borderRadius: 10, padding: 12, marginTop: 4,
            borderWidth: 1, borderColor: p.border,
          }}>
            <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 18 }}>
              Transfer exactly <Text style={{ fontWeight: '500', color: p.fg }}>{sym}{v.toFixed(2)}</Text>. Use your name and the reference below so we can match your payment.
            </Text>
          </View>
        </View>
      )}

      {/* Sender name */}
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '500', letterSpacing: 0.7, marginBottom: 8 }}>
        YOUR NAME (AS ON YOUR BANK ACCOUNT)
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 14,
        borderWidth: 1, borderColor: senderName.trim().length > 0 && senderName.trim().length < 2 ? p.redFg : p.border,
        paddingHorizontal: 14, marginBottom: 16,
      }}>
        <Ionicons name="person-outline" size={17} color={p.fgMuted} style={{ marginRight: 10 }} />
        <TextInput
          value={senderName}
          onChangeText={setSenderName}
          placeholder="Full name"
          placeholderTextColor={p.fgFaint}
          autoCapitalize="words"
          style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
        />
      </View>

      {/* Reference */}
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '500', letterSpacing: 0.7, marginBottom: 8 }}>
        PAYMENT REFERENCE
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 14,
        borderWidth: 1, borderColor: reference.trim().length > 0 && reference.trim().length < 3 ? p.redFg : p.border,
        paddingHorizontal: 14, marginBottom: 24,
      }}>
        <Ionicons name="document-text-outline" size={17} color={p.fgMuted} style={{ marginRight: 10 }} />
        <TextInput
          value={reference}
          onChangeText={setReference}
          placeholder="e.g. Bank transfer ref / SEPA ref"
          placeholderTextColor={p.fgFaint}
          autoCapitalize="characters"
          style={{ flex: 1, color: p.fg, fontSize: 15, paddingVertical: 14 }}
        />
      </View>

      <Pressable
        onPress={() => { if (valid) depositMutation.mutate(); }}
        disabled={!valid || depositMutation.isPending}
        style={({ pressed }) => ({
          height: 56, borderRadius: 14,
          backgroundColor: valid ? p.ctaBg : p.bgElev,
          borderWidth: valid ? 0 : 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
          opacity: pressed || depositMutation.isPending ? 0.85 : 1,
        })}
      >
        {depositMutation.isPending ? (
          <ActivityIndicator color={p.ctaFg} />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={17} color={valid ? p.ctaFg : p.fgMuted} />
            <Text style={{ color: valid ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '500' }}>
              {valid
                ? `I've sent ${sym}${v.toFixed(2)}`
                : 'Complete all fields'}
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

export default DepositWidget;
