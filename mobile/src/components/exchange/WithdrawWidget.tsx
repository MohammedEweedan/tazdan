/**
 * WithdrawWidget — production-ready withdrawal flow.
 *
 * Fiat:  KYC gate → select bank account (edit/delete/add) → amount → submit.
 * Crypto: no KYC gate → wallet address + network + amount → submit.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useWallets, useTransactionSound } from '@/hooks';
import { bankAccountService, withdrawalService } from '@/services';
import type { BankAccount } from '@/types';

const FIAT_SET = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD']);
const CRYPTO_ENUM = new Set(['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX']);

type Screen = 'select' | 'bank' | 'amount';
type Network = 'TRC20' | 'ERC20';

/* ── Add / Edit bank account form with live bank search ── */
function BankAccountForm({
  initial, onSave, onCancel, palette: p,
}: {
  initial?: Partial<BankAccount>;
  onSave: (data: any) => void;
  onCancel: () => void;
  palette: any;
}) {
  const [bankName, setBankName] = useState(initial?.bankName ?? '');
  const [bankSearch, setBankSearch] = useState(initial?.bankName ?? '');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [accountHolder, setAccountHolder] = useState(initial?.accountName ?? '');
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? '');
  const [iban, setIban] = useState(initial?.iban ?? '');
  const [swift, setSwift] = useState(initial?.swift ?? '');
  const [sortCode, setSortCode] = useState(initial?.sortCode ?? '');
  const [routingNumber, setRoutingNumber] = useState(initial?.routingNumber ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [saving, setSaving] = useState(false);

  // Fetch banks whenever country has 2 characters (ISO code)
  const countryCode = country.trim().toUpperCase();
  const { data: apiBanks = [], isFetching: fetchingBanks } = useQuery({
    queryKey: ['banks-by-country', countryCode],
    queryFn: () => bankAccountService.getBanksByCountry(countryCode),
    enabled: countryCode.length === 2,
    staleTime: 10 * 60 * 1000,
  });

  const filteredBanks = bankSearch.length > 0
    ? apiBanks.filter((b) => b.toLowerCase().includes(bankSearch.toLowerCase()))
    : apiBanks;

  const selectBank = useCallback((name: string) => {
    setBankName(name);
    setBankSearch(name);
    setShowBankDropdown(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const valid = bankName.trim().length > 1 && accountHolder.trim().length > 1 && (accountNumber.trim().length > 3 || iban.trim().length > 8);

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({
        bankName: bankName.trim(),
        accountName: accountHolder.trim(),
        accountNumber: accountNumber.trim() || iban.trim(),
        iban: iban.trim() || undefined,
        swift: swift.trim() || undefined,
        sortCode: sortCode.trim() || undefined,
        routingNumber: routingNumber.trim() || undefined,
        country: countryCode || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: { placeholder?: string; autoCapitalize?: 'none' | 'characters' | 'words'; optional?: boolean }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 6 }}>
        {label}{opts?.optional ? ' (optional)' : ''}
      </Text>
      <View style={{ backgroundColor: p.pillBg, borderRadius: 14, borderWidth: 0, paddingHorizontal: 14 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={opts?.placeholder ?? label}
          placeholderTextColor={p.fgFaint}
          autoCapitalize={opts?.autoCapitalize ?? 'words'}
          style={{ color: p.fg, fontSize: 15, paddingVertical: 13 }}
        />
      </View>
    </View>
  );

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
      <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 20 }}>
        {initial?.id ? 'Edit Bank Account' : 'Add Bank Account'}
      </Text>

      {/* Country first — drives bank list */}
      <View style={{ marginBottom: 14 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 6 }}>
          COUNTRY (ISO CODE)
        </Text>
        <View style={{ backgroundColor: p.pillBg, borderRadius: 14, borderWidth: 0, paddingHorizontal: 14 }}>
          <TextInput
            value={country}
            onChangeText={(v) => {
              setCountry(v);
              setBankSearch('');
              setBankName('');
              setShowBankDropdown(false);
            }}
            placeholder="e.g. US, GB, AE, DE"
            placeholderTextColor={p.fgFaint}
            autoCapitalize="characters"
            maxLength={2}
            style={{ color: p.fg, fontSize: 15, paddingVertical: 13 }}
          />
        </View>
        {countryCode.length === 2 && (
          <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 4 }}>
            {fetchingBanks ? 'Loading banks…' : `${apiBanks.length} bank${apiBanks.length !== 1 ? 's' : ''} found for ${countryCode}`}
          </Text>
        )}
      </View>

      {/* Bank name — searchable if country set */}
      <View style={{ marginBottom: 14 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 6 }}>
          BANK NAME
        </Text>
        <View style={{ backgroundColor: p.pillBg, borderRadius: 14, borderWidth: 0, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={bankSearch}
            onChangeText={(v) => {
              setBankSearch(v);
              setBankName(v);
              if (v.length > 0 && apiBanks.length > 0) setShowBankDropdown(true);
              else setShowBankDropdown(false);
            }}
            onFocus={() => { if (apiBanks.length > 0) setShowBankDropdown(true); }}
            placeholder={countryCode.length === 2 ? 'Search banks…' : 'e.g. HSBC, Chase, Emirates NBD'}
            placeholderTextColor={p.fgFaint}
            autoCapitalize="words"
            style={{ flex: 1, color: p.fg, fontSize: 15, paddingVertical: 13 }}
          />
          {fetchingBanks && <ActivityIndicator size="small" color={p.fgMuted} style={{ marginLeft: 8 }} />}
          {bankName.length > 0 && !fetchingBanks && (
            <Pressable onPress={() => { setBankName(''); setBankSearch(''); setShowBankDropdown(false); }} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={p.fgMuted} />
            </Pressable>
          )}
        </View>
        {/* Bank dropdown */}
        {showBankDropdown && filteredBanks.length > 0 && (
          <View style={{
            backgroundColor: p.pillBg, borderRadius: 14, borderWidth: 0,
            maxHeight: 200, marginTop: 4, overflow: 'hidden',
          }}>
            <FlatList
              data={filteredBanks.slice(0, 50)}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => selectBank(item)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: p.border,
                    backgroundColor: pressed ? p.pillBg : 'transparent',
                  })}
                >
                  <Text style={{ color: p.fg, fontSize: 14 }}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      {field('ACCOUNT HOLDER NAME', accountHolder, setAccountHolder, { placeholder: 'Full name as on account' })}
      {field('ACCOUNT NUMBER', accountNumber, setAccountNumber, { placeholder: 'Account / BBAN number', autoCapitalize: 'characters', optional: true })}
      {field('IBAN', iban, setIban, { placeholder: 'e.g. GB82WEST12345698765432', autoCapitalize: 'characters', optional: true })}
      {field('SWIFT / BIC', swift, setSwift, { placeholder: 'e.g. BARCGB22', autoCapitalize: 'characters', optional: true })}
      {field('SORT CODE (UK)', sortCode, setSortCode, { placeholder: 'e.g. 20-00-00', autoCapitalize: 'none', optional: true })}
      {field('ROUTING NUMBER (US)', routingNumber, setRoutingNumber, { placeholder: 'e.g. 021000021', autoCapitalize: 'none', optional: true })}

      <Pressable
        onPress={submit}
        disabled={!valid || saving}
        style={({ pressed }) => ({
          height: 52, borderRadius: 14,
          backgroundColor: valid ? p.ctaBg : p.bgElev,
          borderWidth: valid ? 0 : 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
          opacity: pressed || saving ? 0.8 : 1, marginBottom: 12,
        })}
      >
        {saving ? <ActivityIndicator color={p.ctaFg} /> : (
          <Text style={{ color: valid ? p.ctaFg : p.fgMuted, fontSize: 15, fontWeight: '600' }}>
            {initial?.id ? 'Save Changes' : 'Add Account'}
          </Text>
        )}
      </Pressable>
      <Pressable onPress={onCancel} style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

export function WithdrawWidget() {
  const p = useThemedPalette();
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: wallets } = useWallets();
  const { playSuccess, playError } = useTransactionSound();

  const [screen, setScreen] = useState<Screen>('select');
  const [currency, setCurrency] = useState('USD');
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [network, setNetwork] = useState<Network>('TRC20');
  const [showAddBank, setShowAddBank] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

  const isFiat = FIAT_SET.has(currency);
  const isCrypto = !isFiat;
  const kycApproved = user?.kycStatus === 'APPROVED';

  const { data: bankAccounts = [], isLoading: loadingBanks, refetch: refetchBanks } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountService.list,
  });

  const wallet = wallets?.find((w) => w.currency === currency);
  const balance = wallet ? Number(wallet.balance) : 0;
  const withdrawAmount = Number(amount || 0);
  const overspend = withdrawAmount > balance;

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawalService.create({
      currency,
      amount: withdrawAmount,
      ...(isFiat ? {
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: selectedBank?.id,
        bankName: selectedBank?.bankName,
        accountNumber: selectedBank?.accountNumber ?? undefined,
        accountName: selectedBank?.accountName,
      } : {
        walletAddress: walletAddress.trim(),
        network,
      }),
    }),
    onSuccess: () => {
      playSuccess('withdrawal');
      Alert.alert(
        'Withdrawal Requested ✓',
        `Your ${currency} withdrawal of ${withdrawAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} has been submitted and is pending review.`,
        [{ text: 'OK' }],
      );
      setScreen('select');
      setAmount('');
      setWalletAddress('');
      qc.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (err: any) => {
      playError();
      const msg = err?.response?.data?.error ?? err?.message ?? 'Withdrawal failed';
      Alert.alert('Withdrawal Failed', msg);
    },
  });

  const deleteBankAccount = async (bank: BankAccount) => {
    Alert.alert(
      'Delete Bank Account',
      `Remove ${bank.bankName} from your saved accounts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await bankAccountService.delete(bank.id);
              if (selectedBank?.id === bank.id) setSelectedBank(null);
              refetchBanks();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error ?? 'Could not delete account');
            }
          },
        },
      ],
    );
  };

  /* ── SCREEN 0: Select currency ── */
  if (screen === 'select') {
    const ownedCurrencies = wallets
      ?.filter((w) => Number(w.balance) > 0)
      .map((w) => w.currency as string) ?? [];

    const allOptions = [...new Set([...ownedCurrencies, 'USD', 'EUR', 'USDT', 'BTC', 'ETH'])];

    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 14 }}>
          SELECT CURRENCY TO WITHDRAW
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {allOptions.map((c) => {
            const on = c === currency;
            const w = wallets?.find((wl) => wl.currency === c);
            const bal = w ? Number(w.balance) : 0;
            return (
              <Pressable
                key={c}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCurrency(c); }}
                style={({ pressed }) => ({
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                  backgroundColor: on ? p.fg : p.pillBg,
                  borderWidth: 1, borderColor: on ? p.fg : p.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: on ? p.bg : p.fg, fontWeight: '700', fontSize: 14 }}>{c}</Text>
                {bal > 0 && (
                  <Text style={{ color: on ? p.bg : p.fgFaint, fontSize: 10, marginTop: 2 }}>
                    {bal.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* KYC gate for fiat */}
        {isFiat && !kycApproved && (
          <View style={{
            marginBottom: 20, padding: 16, borderRadius: 14,
            backgroundColor: 'rgba(245,158,11,0.10)',
            borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Ionicons name="shield-outline" size={20} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontSize: 14, fontWeight: '600' }}>KYC Required</Text>
            </View>
            <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
              Fiat withdrawals require identity verification. Crypto withdrawals are available immediately.
            </Text>
            <Pressable
              onPress={() => router.push('/kyc' as any)}
              style={{ backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Verify Identity →</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => {
            if (isFiat && !kycApproved) {
              Alert.alert('KYC Required', 'Complete identity verification to withdraw fiat.');
              return;
            }
            setScreen(isFiat ? 'bank' : 'amount');
          }}
          style={({ pressed }) => ({
            height: 56, borderRadius: 14,
            backgroundColor: (isFiat && !kycApproved) ? p.bgElev : p.ctaBg,
            borderWidth: (isFiat && !kycApproved) ? 1 : 0, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: (isFiat && !kycApproved) ? p.fgMuted : p.ctaFg, fontSize: 16, fontWeight: '600' }}>
            Continue with {currency}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={(isFiat && !kycApproved) ? p.fgMuted : p.ctaFg} />
        </Pressable>
      </View>
    );
  }

  /* ── SCREEN 1 (fiat): Select bank account ── */
  if (screen === 'bank') {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => setScreen('select')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <Ionicons name="chevron-back" size={18} color={p.fgMuted} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600' }}>{currency} Withdrawal</Text>
        </Pressable>

        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 12 }}>
          BANK ACCOUNT
        </Text>

        {loadingBanks ? (
          <ActivityIndicator color={p.fgMuted} style={{ marginVertical: 20 }} />
        ) : bankAccounts.length === 0 ? (
          <View style={{ backgroundColor: p.pillBg, borderRadius: 16, borderWidth: 0, padding: 20, alignItems: 'center', marginBottom: 14 }}>
            <Ionicons name="business-outline" size={28} color={p.fgFaint} />
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 10 }}>No bank accounts saved</Text>
            <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 4, textAlign: 'center' }}>Add a bank account to withdraw funds</Text>
          </View>
        ) : (
          bankAccounts.map((bank) => {
            const selected = selectedBank?.id === bank.id;
            return (
              <Pressable
                key={bank.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedBank(bank); }}
                style={({ pressed }) => ({
                  backgroundColor: selected ? p.accentSoft : p.bgElev,
                  borderWidth: 1.5, borderColor: selected ? p.accent : p.border,
                  borderRadius: 14, padding: 14, marginBottom: 8,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="business-outline" size={20} color={p.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{bank.bankName}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
                      {bank.accountName} · ••••{bank.accountNumber?.slice(-4) ?? bank.iban?.slice(-4)}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={p.fg} />}
                </View>
                {/* Edit / Delete actions */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: p.border }}>
                  <Pressable
                    onPress={() => setEditingBank(bank)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border }}
                  >
                    <Ionicons name="pencil-outline" size={13} color={p.fgMuted} />
                    <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700' }}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deleteBankAccount(bank)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.20)' }}
                  >
                    <Ionicons name="trash-outline" size={13} color={p.redFg} />
                    <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '700' }}>Delete</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}

        {/* Add bank account */}
        <Pressable
          onPress={() => setShowAddBank(true)}
          style={({ pressed }) => ({
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            borderRadius: 14, padding: 14,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: pressed ? 0.8 : 1, marginBottom: 20,
          })}
        >
          <Ionicons name="add-circle-outline" size={20} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Add Bank Account</Text>
        </Pressable>

        <Pressable
          onPress={() => { if (selectedBank) setScreen('amount'); }}
          disabled={!selectedBank}
          style={({ pressed }) => ({
            height: 56, borderRadius: 14,
            backgroundColor: selectedBank ? p.ctaBg : p.bgElev,
            borderWidth: selectedBank ? 0 : 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: selectedBank ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '600' }}>
            {selectedBank ? `Continue with ${selectedBank.bankName}` : 'Select a bank account'}
          </Text>
          {selectedBank && <Ionicons name="arrow-forward" size={16} color={p.ctaFg} />}
        </Pressable>

        {/* Add bank modal */}
        <Modal visible={showAddBank} animationType="slide" transparent onRequestClose={() => setShowAddBank(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
              <View style={{ alignItems: 'center', paddingTop: 10 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 4 }} />
              </View>
              <BankAccountForm
                onSave={async (data) => {
                  await bankAccountService.add(data);
                  setShowAddBank(false);
                  refetchBanks();
                }}
                onCancel={() => setShowAddBank(false)}
                palette={p}
              />
            </View>
          </View>
        </Modal>

        {/* Edit bank modal */}
        <Modal visible={!!editingBank} animationType="slide" transparent onRequestClose={() => setEditingBank(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
              <View style={{ alignItems: 'center', paddingTop: 10 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 4 }} />
              </View>
              {editingBank && (
                <BankAccountForm
                  initial={editingBank}
                  onSave={async (data) => {
                    await bankAccountService.update(editingBank.id, data);
                    setEditingBank(null);
                    refetchBanks();
                  }}
                  onCancel={() => setEditingBank(null)}
                  palette={p}
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  /* ── SCREEN 2: Amount + submit ── */
  const cryptoValid = isCrypto && walletAddress.trim().length > 10 && withdrawAmount > 0 && !overspend;
  const fiatValid = isFiat && !!selectedBank && withdrawAmount > 0 && !overspend;
  const canSubmit = isFiat ? fiatValid : cryptoValid;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
    >
      <Pressable onPress={() => setScreen(isFiat ? 'bank' : 'select')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        <Ionicons name="chevron-back" size={18} color={p.fgMuted} />
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600' }}>
          {isFiat ? selectedBank?.bankName : `${currency} Withdrawal`}
        </Text>
      </Pressable>

      {/* Balance */}
      <View style={{ backgroundColor: p.pillBg, borderRadius: 16, borderWidth: 0, padding: 16, marginBottom: 20 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>AVAILABLE BALANCE</Text>
        <Text style={{ color: p.fg, fontSize: 26, fontWeight: '600', letterSpacing: -1, marginTop: 4 }}>
          {balance.toLocaleString('en-US', { maximumFractionDigits: isFiat ? 2 : 8 })} {currency}
        </Text>
      </View>

      {/* Crypto: wallet address + network */}
      {isCrypto && (
        <>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8 }}>NETWORK</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {(['TRC20', 'ERC20'] as Network[]).map((net) => (
              <Pressable
                key={net}
                onPress={() => setNetwork(net)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: network === net ? p.accent : p.pillBg, borderWidth: 1, borderColor: network === net ? p.accent : p.border, alignItems: 'center' }}
              >
                <Text style={{ color: network === net ? p.accentFg : p.fg, fontWeight: '700', fontSize: 13 }}>{net}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8 }}>WALLET ADDRESS</Text>
          <View style={{ backgroundColor: p.pillBg, borderRadius: 14, borderWidth: 0, paddingHorizontal: 14, marginBottom: 20 }}>
            <TextInput
              value={walletAddress}
              onChangeText={setWalletAddress}
              placeholder={network === 'TRC20' ? 'T...' : '0x...'}
              placeholderTextColor={p.fgFaint}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ color: p.fg, fontSize: 14, paddingVertical: 14, fontFamily: 'monospace' }}
            />
          </View>
        </>
      )}

      {/* Amount */}
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8 }}>AMOUNT</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 14,
        borderWidth: 1.5, borderColor: overspend ? p.redFg : p.border,
        paddingHorizontal: 16, marginBottom: 6,
      }}>
        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
          placeholder="0.00"
          placeholderTextColor={p.fgFaint}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={{ flex: 1, color: p.fg, fontSize: 32, fontWeight: '700', paddingVertical: 16, fontVariant: ['tabular-nums'] }}
        />
        <Pressable
          onPress={() => setAmount(balance.toFixed(isFiat ? 2 : 8))}
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border }}
        >
          <Text style={{ color: p.fg, fontSize: 11, fontWeight: '600' }}>MAX</Text>
        </Pressable>
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700', marginLeft: 10 }}>{currency}</Text>
      </View>
      <Text style={{ color: overspend ? p.redFg : p.fgMuted, fontSize: 12, fontWeight: '600', marginBottom: 24 }}>
        {overspend ? 'Exceeds available balance' : `Available: ${balance.toLocaleString('en-US', { maximumFractionDigits: isFiat ? 2 : 8 })} ${currency}`}
      </Text>

      <Pressable
        onPress={() => { if (canSubmit) withdrawMutation.mutate(); }}
        disabled={!canSubmit || withdrawMutation.isPending}
        style={({ pressed }) => ({
          height: 56, borderRadius: 14,
          backgroundColor: canSubmit ? p.ctaBg : p.bgElev,
          borderWidth: canSubmit ? 0 : 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
          opacity: pressed || withdrawMutation.isPending ? 0.8 : 1,
        })}
      >
        {withdrawMutation.isPending ? (
          <ActivityIndicator color={p.ctaFg} />
        ) : (
          <>
            <Ionicons name="arrow-up-circle-outline" size={17} color={canSubmit ? p.ctaFg : p.fgMuted} />
            <Text style={{ color: canSubmit ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '600' }}>
              {canSubmit
                ? `Withdraw ${withdrawAmount.toLocaleString('en-US', { maximumFractionDigits: isFiat ? 2 : 8 })} ${currency}`
                : isCrypto && !walletAddress ? 'Enter wallet address' : 'Enter amount'}
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

export default WithdrawWidget;
