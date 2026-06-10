/**
 * SendWidget — clean internal transfer sheet.
 * Recipient search · currency chips · large amount input · summary · CTA.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { CurrencyPicker, type CurrencyItem } from '@/components/ui/CurrencyPicker';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, useWallets, extractErrorMessage, useStepUpAuth, StepUpDeniedError, useTransactionSound } from '@/hooks';
import { useForexRates } from '@/hooks/useForexRates';
import { profileService, messageService, claimLinkService } from '@/services';
import type { Currency } from '@/types';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Share, Alert, Modal } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// Match input that's clearly an off-platform identifier — the cue we use
// to surface the "Send via claim link" CTA.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()\-]{6,}$/;
function looksOffPlatform(v: string): { kind: 'email'; value: string } | { kind: 'phone'; value: string } | null {
  const trimmed = v.trim();
  if (EMAIL_RE.test(trimmed)) return { kind: 'email', value: trimmed };
  if (PHONE_RE.test(trimmed)) return { kind: 'phone', value: trimmed.replace(/[\s()\-]/g, '') };
  return null;
}

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
  USD:  { label: 'US Dollar',   color: '#63a1db', bg: 'rgba(99,161,219,0.14)',  icon: '$' },
  EUR:  { label: 'Euro',        color: '#63a1db', bg: 'rgba(99,161,219,0.14)',  icon: '€' },
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
  const router  = useRouter();
  const { height } = useWindowDimensions();
  const tight = height < 700;
  const compact = height < 780;
  const amountMaxSize = tight ? 48 : compact ? 56 : 64;
  const keypadHeight = tight ? 42 : compact ? 48 : 56;
  const keypadFont = tight ? 22 : compact ? 24 : 27;
  const { playSuccess, playError } = useTransactionSound();
  const { data: wallets } = useWallets();
  const { data: fxRates } = useForexRates();
  const stepUp = useStepUpAuth();

  const [currency,  setCurrency]  = useState<string>('USD');
  const [recipient, setRecipient] = useState('');
  const [picked,    setPicked]    = useState<Profile | null>(null);
  const [amount,    setAmount]    = useState('');
  const [note,      setNote]      = useState('');
  const [noteOpen,  setNoteOpen]  = useState(false);
  const [ctaState,  setCta]       = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError,  setCtaErr]    = useState<string | null>(null);
  const [qrUrl,     setQrUrl]     = useState<string | null>(null);

  // One unified holdings list — fiat AND crypto the user actually holds (>0),
  // plus the core fiats so they can always send those. No fiat/crypto toggle.
  const pickerItems = useMemo<CurrencyItem[]>(() => {
    const held = new Map<string, number>();
    (wallets ?? []).forEach((w) => { if (Number(w.balance) > 0) held.set(w.currency, Number(w.balance)); });
    // Always offer the core fiats even at zero balance.
    FIATS.forEach((f) => { if (!held.has(f)) held.set(f, 0); });
    return [...held.entries()]
      .map(([cur, bal]) => {
        const m = assetMeta(cur);
        return { currency: cur, balance: bal, label: m.label, icon: m.icon, color: m.color, bg: m.bg, isFiat: FIAT_SET.has(cur) };
      })
      // Fiat first, then crypto; within each, higher balance first.
      .sort((a, b) => {
        const af = FIAT_SET.has(a.currency) ? 0 : 1;
        const bf = FIAT_SET.has(b.currency) ? 0 : 1;
        if (af !== bf) return af - bf;
        return b.balance - a.balance;
      });
  }, [wallets]);

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
      playSuccess('transfer');
      setCta('success');
      // Money successfully sent = peak-happiness moment; the prompt lib
      // self-throttles (2nd success, once per install) and never throws.
      import('@/lib/reviewPrompt').then(({ maybeAskForReview }) => maybeAskForReview());
      setAmount(''); setNote(''); setRecipient(''); setPicked(null); setNoteOpen(false);
      setTimeout(() => setCta('idle'), 2000);
    } catch (e: any) {
      if (e instanceof StepUpDeniedError) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setCtaErr(e.message);
        setCta('error');
        setTimeout(() => setCta('idle'), 2000);
        return;
      }
      playError();
      setCtaErr(extractErrorMessage(e, t('send.failed')));
      setCta('error');
      setTimeout(() => setCta('idle'), 2000);
    }
  };

  const meta       = assetMeta(currency);

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Recipient field ── */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>{t('send.recipient') || 'Recipient'}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 18,
        borderWidth: 1, borderColor: picked ? p.accent : p.border,
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
          style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '500', paddingVertical: 16, marginLeft: 10, letterSpacing: 0 }}
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
            (() => {
              const off = looksOffPlatform(recipient);
              if (!off) {
                return (
                  <View style={{ padding: 14 }}>
                    <Text style={{ color: p.fgMuted, fontSize: 13 }}>{t('send.noMatches')}</Text>
                  </View>
                );
              }
              // Off-platform identifier → offer the claim link. This is the
              // headline path: type someone's email/phone, send anyway, the
              // recipient gets a magical one-tap claim URL.
              const amountNum = parseFloat(amount || '0');
              const ready = amountNum > 0 && amountNum <= balance;
              const createAndShare = async () => {
                if (!ready) {
                  Alert.alert(t('send.amountRequiredTitle') || 'Enter an amount first', t('send.amountRequiredBody') || 'Type how much you want to send, then we will generate a one-tap link the recipient can claim.');
                  return;
                }
                try {
                  haptics.light();
                  const link = await claimLinkService.create({
                    asset: currency,
                    amount: amountNum,
                    recipientEmail: off.kind === 'email' ? off.value : undefined,
                    recipientPhone: off.kind === 'phone' ? off.value : undefined,
                    note: note || undefined,
                  });
                  await Clipboard.setStringAsync(link.claimUrl ?? '');
                  haptics.success();
                  setQrUrl(link.claimUrl ?? null);
                  Alert.alert(
                    t('send.claimReadyTitle') || 'Claim link ready',
                    `${(t('send.claimReadyBody') || 'Funds reserved. Share this with')} ${off.value}.`,
                    [
                      { text: t('common.copyAgain') || 'Copy again', onPress: () => Clipboard.setStringAsync(link.claimUrl ?? '') },
                      {
                        text: t('common.share') || 'Share',
                        onPress: () =>
                          Share.share({
                            message: `${(t('send.claimShareIntro') || "I sent you")} ${amount} ${currency} on tazdan → ${link.claimUrl}`,
                          }),
                      },
                      {
                        text: 'Show QR',
                        onPress: () => setQrUrl(link.claimUrl ?? null),
                      },
                      { text: t('common.done') || 'Done', style: 'cancel' },
                    ],
                  );
                  // Clear the field so the next send is fresh.
                  setRecipient('');
                  setAmount('');
                } catch (e: any) {
                  haptics.error();
                  Alert.alert(t('common.error') || 'Error', e?.response?.data?.error ?? (t('send.claimFailed') || 'Could not create claim link'));
                }
              };
              return (
                <View style={{ padding: 14, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: p.fg,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="paper-plane" size={16} color={p.bg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                        {t('send.noAccountYet') || 'No tazdan account yet'}
                      </Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                        {t('send.claimExplain') || 'Send anyway via a claim link. The recipient gets a one-tap URL that credits their wallet — even if they have to sign up first.'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={createAndShare}
                    style={({ pressed }) => ({
                      height: 46, borderRadius: 23,
                      backgroundColor: ready ? p.ctaBg : p.bgRaised,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 8,
                      opacity: pressed ? 0.92 : 1,
                      borderWidth: ready ? 0 : 1,
                      borderColor: p.border,
                    })}
                  >
                    <Ionicons name="link-outline" size={14} color={ready ? p.ctaFg : p.fgMuted} />
                    <Text style={{ color: ready ? p.ctaFg : p.fgMuted, fontSize: 13, fontWeight: '700' }}>
                      {ready
                        ? `${(t('send.sendToOffPlatform') || 'Send via claim link')}`
                        : (t('send.enterAmountFirst') || 'Enter an amount to enable claim link')}
                    </Text>
                  </Pressable>
                </View>
              );
            })()
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
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: p.bgRaised,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: p.fg, fontWeight: '700', fontSize: 15 }}>
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

      {/* ── Currency — one swipeable field over ALL holdings ── */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>{t('send.currency').toUpperCase()}</Text>
      <View style={{ marginBottom: 20 }}>
        <CurrencyPicker
          items={pickerItems}
          value={currency}
          onChange={(c) => { setCurrency(c); setAmount(''); }}
          palette={p}
        />
      </View>

      {/* ── Big centered amount (matches the home balance treatment) ── */}
      <Pressable onPress={() => { haptics.selection(); setAmount(String(balance)); }} hitSlop={6}
        style={{ alignSelf: 'flex-end', marginBottom: 6 }}>
        <Text style={{ color: p.accentText, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{t('common.useMax').toUpperCase()}</Text>
      </Pressable>
      <View style={{ marginBottom: 8 }}>
        <AmountDisplay value={amount} symbol={currency} palette={p} tint={overspend ? p.redFg : undefined} maxSize={amountMaxSize} />
      </View>
      <Text style={{ color: overspend ? p.redFg : p.fgMuted, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: compact ? 10 : 16 }}>
        {overspend
          ? t('send.exceedsBalance')
          : `${t('common.available')}: ${balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${currency}`}
      </Text>

      {/* Optional note — plus expands in place above the keypad. */}
      {noteOpen ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.bgElev, borderRadius: 14,
          borderWidth: 1, borderColor: p.border,
          paddingHorizontal: 12, paddingVertical: 8, marginBottom: compact ? 8 : 12,
        }}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={p.fgMuted} />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('send.notePlaceholder')}
            placeholderTextColor={p.fgFaint}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={{ flex: 1, color: p.fg, fontSize: 14, marginLeft: 10, paddingVertical: 4 }}
          />
          <Pressable
            onPress={() => { haptics.selection(); setNoteOpen(false); if (!note.trim()) setNote(''); }}
            hitSlop={8}
            accessibilityLabel="Hide note"
            style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="remove" size={18} color={p.fg} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { haptics.selection(); setNoteOpen(true); }}
          hitSlop={8}
          accessibilityLabel="Add note"
          style={({ pressed }) => ({
            alignSelf: 'center',
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: pressed ? p.border : p.bgElev,
            borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: compact ? 8 : 12,
          })}
        >
          <Ionicons name={note.trim() ? 'chatbubble-ellipses' : 'add'} size={18} color={p.fg} />
        </Pressable>
      )}

      {/* Flexible spacer pushes the CTA + keypad to the bottom (no scroll). */}
      <View style={{ flex: 1, minHeight: 8 }} />

      {/* ── Numeric keypad — drives the amount ── */}
      <View style={{ marginBottom: 14 }}>
        <NumericKeypad value={amount} onChange={setAmount} palette={p} keyHeight={keypadHeight} fontSize={keypadFont} />
      </View>

      <SlideToConfirm
        label={valid ? (t('send.cta') || 'Slide to send') : (picked ? 'Enter amount' : 'Select recipient')}
        onConfirm={() => { if (valid && ctaState === 'idle') onSend(); }}
        enabled={valid && ctaState === 'idle'}
        status={ctaState}
        successLabel={t('send.sent') || 'Sent'}
        errorLabel={ctaError ?? t('send.failed')}
        accent={p.accent}
        accentFg={p.accentFg}
        trackBg={p.bgElev}
        trackFg={p.fg}
        border={p.border}
        greenBg={p.greenBg} greenFg={p.greenFg}
        redBg={p.redBg} redFg={p.redFg}
      />

      {/* ── QR Code Modal ── */}
      <Modal
        visible={!!qrUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setQrUrl(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setQrUrl(null)}
        >
          <View style={{ backgroundColor: p.bgElev, borderRadius: 24, padding: 28, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: p.border }}>
            <Text style={{ color: p.fg, fontSize: 17, fontWeight: '700' }}>
              Scan to claim
            </Text>
            {qrUrl && (
              <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 12 }}>
                <QRCode value={qrUrl} size={220} />
              </View>
            )}
            <Text style={{ color: p.fgMuted, fontSize: 12, textAlign: 'center', maxWidth: 220 }}>
              Any QR scanner or the tazdan app will open this claim link.
            </Text>
            <Pressable
              onPress={() => setQrUrl(null)}
              style={{ marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: p.bgRaised }}
            >
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default SendWidget;
