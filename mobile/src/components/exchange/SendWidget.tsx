/**
 * SendWidget — clean internal transfer sheet.
 * Recipient search · currency chips · large amount input · summary · CTA.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, useWallets, extractErrorMessage, useStepUpAuth, StepUpDeniedError } from '@/hooks';
import { useForexRates } from '@/hooks/useForexRates';
import { profileService, messageService } from '@/services';
import type { Currency } from '@/types';

const FIATS: Currency[] = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'];

const FIAT_SET = new Set<string>(FIATS);

// Static meta for known assets; unknown alts get a generated fallback below.
const KNOWN_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  BTC:  { label: 'Bitcoin',     color: '#fb923c', bg: 'rgba(251,146,60,0.14)',  icon: '₿' },
  ETH:  { label: 'Ethereum',    color: '#627eea', bg: 'rgba(98,126,234,0.14)',  icon: 'Ξ' },
  SOL:  { label: 'Solana',      color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', icon: '◎' },
  BNB:  { label: 'BNB',         color: '#f0b90b', bg: 'rgba(240,185,11,0.14)',  icon: '⬡' },
  XRP:  { label: 'XRP',         color: '#346aa9', bg: 'rgba(52,106,169,0.14)',  icon: '✕' },
  ADA:  { label: 'Cardano',     color: '#0033ad', bg: 'rgba(0,51,173,0.14)',    icon: '₳' },
  DOGE: { label: 'Dogecoin',    color: '#c2a633', bg: 'rgba(194,166,51,0.14)',  icon: 'Ð' },
  MATIC:{ label: 'Polygon',     color: '#8247e5', bg: 'rgba(130,71,229,0.14)',  icon: '◆' },
  DOT:  { label: 'Polkadot',    color: '#e6007a', bg: 'rgba(230,0,122,0.14)',   icon: '●' },
  AVAX: { label: 'Avalanche',   color: '#e84142', bg: 'rgba(232,65,66,0.14)',   icon: '▲' },
  USDT: { label: 'Tether',      color: '#4ade80', bg: 'rgba(74,222,128,0.14)',  icon: '₮' },
  USDT_ERC20: { label: 'USDT ERC-20', color: '#4ade80', bg: 'rgba(74,222,128,0.14)', icon: '₮' },
  USDT_TRC20: { label: 'USDT TRC-20', color: '#ef4444', bg: 'rgba(239,68,68,0.14)',  icon: '₮' },
  LTC:  { label: 'Litecoin',    color: '#bfbbbb', bg: 'rgba(191,187,187,0.14)', icon: 'Ł' },
  LINK: { label: 'Chainlink',   color: '#2a5ada', bg: 'rgba(42,90,218,0.14)',   icon: '⬡' },
  UNI:  { label: 'Uniswap',     color: '#ff007a', bg: 'rgba(255,0,122,0.14)',   icon: '🦄' },
  SHIB: { label: 'Shiba Inu',   color: '#e35014', bg: 'rgba(227,80,20,0.14)',   icon: '🐕' },
  PEPE: { label: 'Pepe',        color: '#4bae19', bg: 'rgba(75,174,25,0.14)',   icon: '🐸' },
  ARB:  { label: 'Arbitrum',    color: '#28a0f0', bg: 'rgba(40,160,240,0.14)',  icon: '◈' },
  OP:   { label: 'Optimism',    color: '#ff0420', bg: 'rgba(255,4,32,0.14)',    icon: '○' },
  SUI:  { label: 'Sui',         color: '#6fbcf0', bg: 'rgba(111,188,240,0.14)', icon: '◎' },
  TON:  { label: 'TON',         color: '#0098ea', bg: 'rgba(0,152,234,0.14)',   icon: '◈' },
  USD:  { label: 'US Dollar',   color: '#60a5fa', bg: 'rgba(96,165,250,0.14)',  icon: '$' },
  EUR:  { label: 'Euro',        color: '#60a5fa', bg: 'rgba(96,165,250,0.14)',  icon: '€' },
  GBP:  { label: 'Pound',       color: '#7c3aed', bg: 'rgba(124,58,237,0.14)',  icon: '£' },
  AED:  { label: 'UAE Dirham',  color: '#0f766e', bg: 'rgba(15,118,110,0.14)',  icon: 'د' },
  SAR:  { label: 'Saudi Riyal', color: '#15803d', bg: 'rgba(21,128,61,0.14)',   icon: '﷼' },
  EGP:  { label: 'Egypt Pound', color: '#dc2626', bg: 'rgba(220,38,38,0.14)',   icon: '£' },
};

function assetMeta(currency: string) {
  return KNOWN_META[currency] ?? {
    label: currency,
    color: `hsl(${[...currency].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0) % 360},70%,55%)`,
    bg: 'rgba(128,128,128,0.14)',
    icon: currency.slice(0, 2),
  };
}

type Mode    = 'FIAT' | 'CRYPTO';
type Profile = { id: string; username: string; firstName: string; lastName: string; avatarUrl?: string; kycTier?: string };

export function SendWidget() {
  const p       = useThemedPalette();
  const t       = useT();
  const haptics = useHaptics();
  const { data: wallets } = useWallets();
  const { data: fxRates } = useForexRates();
  const stepUp = useStepUpAuth();

  const [mode,      setMode]      = useState<Mode>('FIAT');
  const [currency,  setCurrency]  = useState<string>('USD');
  const [recipient, setRecipient] = useState('');
  const [picked,    setPicked]    = useState<Profile | null>(null);
  const [amount,    setAmount]    = useState('');
  const [note,      setNote]      = useState('');
  const [ctaState,  setCta]       = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError,  setCtaErr]    = useState<string | null>(null);

  // Build crypto list from actual held balances > 0
  const cryptoCurrencies = useMemo(
    () => (wallets ?? [])
      .filter((w) => !FIAT_SET.has(w.currency) && Number(w.balance) > 0)
      .map((w) => w.currency),
    [wallets],
  );

  useEffect(() => {
    if (mode === 'FIAT') { setCurrency('USD'); }
    else { setCurrency(cryptoCurrencies[0] ?? 'BTC'); }
    setAmount('');
  }, [mode, cryptoCurrencies.join(',')]);

  const wallet     = wallets?.find((w) => w.currency === currency);
  const balance    = wallet ? Number(wallet.balance) : 0;
  const sendAmount = Number(amount || 0);
  const overspend  = sendAmount > balance;

  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(recipient.trim().replace(/^@/, '')), 200);
    return () => clearTimeout(timer);
  }, [recipient]);

  const { data: matches = [], isFetching: searching } = useQuery({
    queryKey:  ['profile-search', debounced],
    queryFn:   () => profileService.search(debounced),
    enabled:   debounced.length >= 1 && !picked,
    staleTime: 30_000,
  });

  const valid = !!picked && sendAmount > 0 && !overspend;

  const onSend = async () => {
    if (!valid || !picked) return;
    setCta('loading'); setCtaErr(null);
    try {
      const usdRate = fxRates?.[currency as Currency] ?? 1;
      const usdValue = sendAmount * usdRate;
      await stepUp.guard({
        usdValue,
        reason: `Send ${sendAmount} ${currency} to @${picked.username}`,
      });

      await messageService.transfer({ receiverId: picked.id, currency: currency as Currency, amount: sendAmount, note: note || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCta('success');
      setAmount(''); setNote(''); setRecipient(''); setPicked(null);
      setTimeout(() => setCta('idle'), 2000);
    } catch (e: any) {
      if (e instanceof StepUpDeniedError) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setCtaErr(e.message);
        setCta('error');
        setTimeout(() => setCta('idle'), 2000);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCtaErr(extractErrorMessage(e, t('send.failed')));
      setCta('error');
      setTimeout(() => setCta('idle'), 2000);
    }
  };

  const currencies = mode === 'FIAT' ? FIATS : cryptoCurrencies;
  const meta       = assetMeta(currency);

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Fiat / Crypto toggle ── */}
      <View style={{ flexDirection: 'row', backgroundColor: p.bgElev, borderRadius: 14, padding: 3, borderWidth: 1, borderColor: p.border, marginBottom: 20 }}>
        {(['FIAT', 'CRYPTO'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => { haptics.selection(); setMode(m); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: mode === m ? p.ctaBg : 'transparent' }}
          >
            <Text style={{ color: mode === m ? p.ctaFg : p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>
              {m === 'FIAT' ? 'FIAT' : 'CRYPTO'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Recipient field ── */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>{t('send.to').toUpperCase()}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 18,
        borderWidth: 1, borderColor: picked ? p.ctaBg : p.border,
        paddingHorizontal: 14, marginBottom: 8,
      }}>
        <Ionicons name="search-outline" size={18} color={p.fgMuted} />
        <TextInput
          value={recipient}
          onChangeText={(t) => { setRecipient(t); setPicked(null); }}
          placeholder={t('send.recipientPlaceholder')}
          placeholderTextColor={p.fgFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '500', paddingVertical: 16, marginLeft: 10 }}
        />
        {picked && <Ionicons name="checkmark-circle" size={18} color={p.greenFg} />}
      </View>

      {/* Type-ahead dropdown */}
      {recipient.trim().length >= 1 && !picked && (
        <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12, overflow: 'hidden' }}>
          {searching ? (
            <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={p.fgMuted} />
              <Text style={{ color: p.fgMuted, fontSize: 13 }}>{t('send.searching')}</Text>
            </View>
          ) : matches.length === 0 ? (
            <View style={{ padding: 14 }}>
              <Text style={{ color: p.fgMuted, fontSize: 13 }}>{t('send.noMatches')}</Text>
            </View>
          ) : (
            matches.map((m: Profile, i: number) => (
              <Pressable
                key={m.id}
                onPress={() => { haptics.selection(); setPicked(m); setRecipient(`@${m.username}`); }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
                  backgroundColor: pressed ? p.border : 'transparent',
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border,
                })}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                    {m.firstName?.[0]?.toUpperCase() ?? m.username[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{m.firstName} {m.lastName}</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>@{m.username}</Text>
                </View>
                {m.kycTier && m.kycTier !== 'TIER_0' && (
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: p.greenBg }}>
                    <Text style={{ color: p.greenFg, fontSize: 9, fontWeight: '600' }}>KYC</Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* ── Currency chips ── */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>{t('send.currency').toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
        {currencies.map((c) => {
          const m = assetMeta(c);
          const active = currency === c;
          return (
            <Pressable
              key={c}
              onPress={() => { haptics.selection(); setCurrency(c); setAmount(''); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 7,
                paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
                backgroundColor: active ? p.fg : p.bgElev,
                borderWidth: 1, borderColor: active ? p.fg : p.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: active ? 'rgba(255,255,255,0.15)' : m.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: active ? p.bg : m.color, fontSize: 11, fontWeight: '600' }}>{m.icon}</Text>
              </View>
              <Text style={{ color: active ? p.bg : p.fg, fontSize: 12, fontWeight: '600' }}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Amount input ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{t('send.amount').toUpperCase()}</Text>
        <Pressable onPress={() => { haptics.selection(); setAmount(String(balance)); }} hitSlop={8}>
          <Text style={{ color: p.ctaBg, fontSize: 12, fontWeight: '600' }}>{t('common.useMax').toUpperCase()}</Text>
        </Pressable>
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 18,
        borderWidth: 1.5, borderColor: overspend ? p.redFg : p.border,
        paddingHorizontal: 18, marginBottom: 8,
      }}>
        <Text style={{ color: p.fgMuted, fontSize: 22, fontWeight: '300', marginRight: 4 }}>{meta.icon}</Text>
        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
          placeholder="0.00"
          placeholderTextColor={p.fgFaint}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={{ flex: 1, color: p.fg, fontSize: 34, fontWeight: '700', paddingVertical: 16, fontVariant: ['tabular-nums'] }}
        />
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>{currency}</Text>
      </View>
      <Text style={{ color: overspend ? p.redFg : p.fgMuted, fontSize: 13, fontWeight: '600', marginBottom: 20 }}>
        {overspend
          ? t('send.exceedsBalance')
          : `${t('common.available')}: ${balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${currency}`}
      </Text>

      {/* ── Note ── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 14,
        borderWidth: 1, borderColor: p.border,
        paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
      }}>
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={p.fgMuted} />
        <TextInput
          value={note} onChangeText={setNote}
          placeholder={t('send.notePlaceholder')}
          placeholderTextColor={p.fgFaint}
          style={{ flex: 1, color: p.fg, fontSize: 14, marginLeft: 10 }}
        />
      </View>

      {/* Transfer summary */}
      {valid && (
        <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 20, gap: 8 }}>
          {[
            { label: t('send.summaryTo'),      value: `@${picked!.username}` },
            { label: t('send.summaryAmount'),  value: `${sendAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${currency}` },
            { label: t('send.summaryNetwork'), value: mode === 'CRYPTO' ? t('send.onChain') : t('send.internalInstant') },
            { label: t('send.summaryFee'),     value: t('common.free'), color: p.greenFg },
          ].map(({ label, value, color }) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: p.fgMuted, fontSize: 13 }}>{label}</Text>
              <Text style={{ color: color ?? p.fg, fontSize: 13, fontWeight: '700' }}>{value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Feedback */}
      {ctaState === 'success' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.greenBg, borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <Ionicons name="checkmark-circle" size={16} color={p.greenFg} />
          <Text style={{ color: p.greenFg, fontSize: 13, fontWeight: '600', flex: 1 }}>{t('send.sent')}</Text>
        </View>
      )}
      {ctaState === 'error' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
          <Ionicons name="alert-circle-outline" size={16} color={p.redFg} />
          <Text style={{ color: p.redFg, fontSize: 13, flex: 1 }}>{ctaError ?? t('send.failed')}</Text>
        </View>
      )}

      {/* ── CTA ── */}
      <Pressable
        onPress={onSend}
        disabled={!valid || ctaState === 'loading'}
        style={({ pressed }) => ({
          height: 56, borderRadius: 28,
          backgroundColor: valid ? p.ctaBg : p.bgElev,
          borderWidth: valid ? 0 : 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
          opacity: pressed || ctaState === 'loading' ? 0.85 : 1,
          shadowColor: valid ? p.ctaBg : 'transparent',
          shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
        })}
      >
        {ctaState === 'loading' ? (
          <ActivityIndicator color={p.ctaFg} />
        ) : (
          <>
            <Ionicons name="paper-plane" size={17} color={valid ? p.ctaFg : p.fgMuted} />
            <Text style={{ color: valid ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '600' }}>
              {valid
                ? `Send ${sendAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${currency}`
                : t('send.cta')}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default SendWidget;
