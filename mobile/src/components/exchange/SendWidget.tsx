/**
 * SendWidget — Send money to other users. Theme-aware widget for modal use.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';

import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useWallets, extractErrorMessage } from '@/hooks';
import { profileService, messageService } from '@/services';
import type { Currency } from '@/types';

const FIATS:  Currency[] = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'];
const CRYPTO: Currency[] = ['BTC', 'ETH', 'USDT', 'SOL'];

type Mode = 'FIAT' | 'CRYPTO';
type Profile = { id: string; username: string; firstName: string; lastName: string; avatarUrl?: string; kycTier?: string };

const ASSET_META: Record<string, { label: string; color: string; icon: string }> = {
  BTC:  { label: 'Bitcoin',   color: '#fb923c', icon: '₿' },
  ETH:  { label: 'Ethereum',  color: '#818cf8', icon: 'Ξ' },
  SOL:  { label: 'Solana',    color: '#a78bfa', icon: '◎' },
  USDT: { label: 'Tether',    color: '#4ade80', icon: '₮' },
  USD:  { label: 'US Dollar', color: '#60a5fa', icon: '$' },
  EUR:  { label: 'Euro',      color: '#60a5fa', icon: '€' },
  GBP:  { label: 'British Pound', color: '#7c3aed', icon: '£' },
  AED:  { label: 'UAE Dirham',    color: '#0f766e', icon: 'د' },
  SAR:  { label: 'Saudi Riyal',   color: '#15803d', icon: '﷼' },
  EGP:  { label: 'Egyptian Pound', color: '#dc2626', icon: '£' },
};

export function SendWidget() {
  const p = useThemedPalette();
  const haptics = useHaptics();
  const { data: wallets } = useWallets();

  const [mode, setMode] = useState<Mode>('FIAT');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [recipient, setRecipient] = useState('');
  const [picked, setPicked] = useState<Profile | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError, setCtaError] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(mode === 'FIAT' ? 'USD' : 'BTC');
    setAmount('');
  }, [mode]);

  const wallet = wallets?.find((w) => w.currency === currency);
  const balance = wallet ? Number(wallet.balance) : 0;
  const sendAmount = Number(amount || 0);
  const overspend = sendAmount > balance;

  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const trimmed = recipient.trim().replace(/^@/, '');
    const t = setTimeout(() => setDebounced(trimmed), 200);
    return () => clearTimeout(t);
  }, [recipient]);

  const { data: matches = [], isFetching: searching } = useQuery({
    queryKey: ['profile-search', debounced],
    queryFn:  () => profileService.search(debounced),
    enabled:  debounced.length >= 1 && !picked,
    staleTime: 30_000,
  });

  const validRecipient = !!picked || (recipient.trim().length >= 3 && /@?[a-z0-9._]+/i.test(recipient.trim()));
  const valid = validRecipient && sendAmount > 0 && !overspend;

  const onSend = async () => {
    if (!valid) return;
    setCtaState('loading');
    setCtaError(null);
    try {
      const receiverId = picked?.id;
      if (!receiverId) {
        throw new Error('Please select a recipient');
      }

      await messageService.transfer({
        receiverId,
        currency,
        amount: sendAmount,
        note: note || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCtaState('success');
      setAmount('');
      setNote('');
      setRecipient('');
      setPicked(null);
      setTimeout(() => setCtaState('idle'), 1500);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCtaError(extractErrorMessage(e, 'Send failed'));
      setCtaState('error');
      setTimeout(() => setCtaState('idle'), 1800);
    }
  };

  const currencies = mode === 'FIAT' ? FIATS : CRYPTO;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 550 }} keyboardShouldPersistTaps="handled">
      {/* Mode toggle */}
      <View style={{
        flexDirection: 'row', padding: 4, marginBottom: 16,
        borderRadius: 14, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, gap: 4,
      }}>
        {(['FIAT', 'CRYPTO'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => { haptics.selection(); setMode(m); }}
            style={{ flex: 1 }}
          >
            <View style={{
              paddingVertical: 10, borderRadius: 10, alignItems: 'center',
              backgroundColor: mode === m ? p.fg : 'transparent',
            }}>
              <Text style={{
                color: mode === m ? p.bg : p.fgMuted,
                fontSize: 12, fontWeight: '700', letterSpacing: 0.5,
              }}>
                {m === 'FIAT' ? 'SEND FIAT' : 'SEND CRYPTO'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Recipient row */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 4 }}>
        TO
      </Text>
      <View style={{
        marginTop: 8, height: 56, borderRadius: 16,
        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
      }}>
        <Ionicons name="search-outline" size={18} color={p.fgMuted} />
        <TextInput
          value={recipient}
          onChangeText={(t) => { setRecipient(t); setPicked(null); }}
          placeholder="@handle, email, or phone"
          placeholderTextColor={p.fgFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '500' }}
        />
      </View>

      {/* Type-ahead matches */}
      {recipient.trim().length >= 1 && !picked && (
        <View style={{
          marginTop: 8, backgroundColor: p.pillBg, borderRadius: 14, borderWidth: 1, borderColor: p.border,
        }}>
          {searching ? (
            <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={p.fgMuted} />
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>Searching…</Text>
            </View>
          ) : matches.length === 0 ? (
            <View style={{ padding: 14 }}>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
                No public matches. You can still send to the literal handle above.
              </Text>
            </View>
          ) : (
            matches.map((m: Profile, i: number) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  haptics.selection();
                  setPicked(m);
                  setRecipient(`@${m.username}`);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 12,
                  backgroundColor: pressed ? p.border : 'transparent',
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border,
                  borderRadius: i === 0 ? 14 : 0,
                })}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                    {m.firstName?.[0]?.toUpperCase() ?? m.username[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                    {m.firstName} {m.lastName}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 1 }}>
                    @{m.username}
                  </Text>
                </View>
                {m.kycTier && m.kycTier !== 'TIER_0' && (
                  <View style={{
                    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                    backgroundColor: p.greenBg,
                  }}>
                    <Text style={{ color: p.greenFg, fontSize: 9, fontWeight: '800' }}>
                      {m.kycTier.replace('_', ' ')}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* Picked badge */}
      {picked && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: p.greenBg,
        }}>
          <Ionicons name="checkmark-circle" size={16} color={p.greenFg} />
          <Text style={{ color: p.greenFg, fontSize: 12, fontWeight: '700', flex: 1 }}>
            Verified recipient · {picked.firstName} {picked.lastName}
          </Text>
          <Pressable onPress={() => { setPicked(null); setRecipient(''); }} hitSlop={8}>
            <Ionicons name="close" size={14} color={p.greenFg} />
          </Pressable>
        </View>
      )}

      {/* Currency picker */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 18 }}>
        FROM
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 4 }}
      >
        {currencies.map((c) => (
          <Pressable
            key={c}
            onPress={() => { haptics.selection(); setCurrency(c); setAmount(''); }}
            style={({ pressed }) => ({
              paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14,
              backgroundColor: currency === c ? p.fg : p.pillBg,
              borderWidth: 1, borderColor: currency === c ? p.fg : p.border,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: currency === c ? p.bg : p.fg, fontWeight: '700', fontSize: 12 }}>
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 8, marginLeft: 4 }}>
        Available: {balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} {currency}
      </Text>

      {/* Amount field */}
      <View style={{ marginTop: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
            AMOUNT
          </Text>
          <Pressable hitSlop={6} onPress={() => { haptics.selection(); setAmount(String(balance)); }}>
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>USE MAX</Text>
          </Pressable>
        </View>
        <View style={{
          marginTop: 10, height: 64, borderRadius: 16,
          backgroundColor: p.pillBg, borderWidth: 1.5, borderColor: overspend ? p.redFg : p.border,
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
        }}>
          <TextInput
            value={amount}
            onChangeText={(t) => {
              // Only allow numbers and single decimal point
              const filtered = t.replace(/[^0-9.]/g, '');
              const parts = filtered.split('.');
              const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered;
              setAmount(clean);
            }}
            placeholder="0.00"
            placeholderTextColor={p.fgFaint}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={{
              flex: 1, color: p.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'],
            }}
          />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>{currency}</Text>
        </View>
        {overspend && (
          <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600', marginTop: 8, marginLeft: 4 }}>
            Exceeds balance
          </Text>
        )}
      </View>

      {/* Note */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 18 }}>
        NOTE (OPTIONAL)
      </Text>
      <View style={{
        marginTop: 8, minHeight: 56, borderRadius: 16,
        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
        paddingHorizontal: 16, paddingVertical: 12,
      }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What's it for?"
          placeholderTextColor={p.fgFaint}
          style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}
        />
      </View>

      {/* Summary */}
      {valid && (
        <View style={{
          marginTop: 22, backgroundColor: p.pillBg, borderRadius: 14, borderWidth: 1, borderColor: p.border,
        }}>
          <View style={{ padding: 14, gap: 8 }}>
            <Row label="Recipient" value={picked ? `@${picked.username}` : recipient} palette={p} />
            <Row label="Amount" value={`${sendAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${currency}`} palette={p} />
            <Row label="Network" value={mode === 'CRYPTO' ? 'On-chain' : 'Internal · instant'} palette={p} />
            <Row label="Fee" value="Free" accent={p.greenFg} palette={p} />
          </View>
        </View>
      )}

      {/* CTA */}
      <View style={{ marginTop: 22 }}>
        <Pressable
          onPress={onSend}
          disabled={!valid || ctaState === 'loading'}
          style={({ pressed }) => ({
            height: 52, borderRadius: 14,
            backgroundColor: ctaState === 'success' ? p.greenFg : ctaState === 'error' ? p.redFg : p.ctaBg,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            opacity: pressed || (ctaState === 'loading') ? 0.85 : 1,
          })}
        >
          {ctaState === 'loading' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons 
                name={ctaState === 'success' ? 'checkmark' : ctaState === 'error' ? 'alert-circle' : 'paper-plane'} 
                size={18} 
                color="#fff" 
              />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                {ctaState === 'success'
                  ? 'Sent!'
                  : ctaState === 'error'
                  ? (ctaError ?? 'Send failed')
                  : `Send ${currency}`}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Success/Error message */}
      {(ctaState === 'success' || ctaState === 'error') && (
        <View style={{
          marginTop: 12, padding: 12, borderRadius: 12,
          backgroundColor: ctaState === 'success' ? p.greenBg : 'rgba(239,68,68,0.12)',
          flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <Ionicons 
            name={ctaState === 'success' ? 'checkmark-circle' : 'alert-circle'} 
            size={16} 
            color={ctaState === 'success' ? p.greenFg : p.redFg} 
          />
          <Text style={{ 
            color: ctaState === 'success' ? p.greenFg : p.redFg, 
            fontSize: 13, fontWeight: '600', flex: 1 
          }}>
            {ctaState === 'success' 
              ? `Successfully sent ${sendAmount > 0 ? sendAmount.toLocaleString('en-US', { maximumFractionDigits: 8 }) : ''} ${currency}`
              : (ctaError ?? 'Send failed')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function Row({
  label, value, accent, palette: p,
}: { label: string; value: string; accent?: string; palette: Palette }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <Text style={{ color: accent ?? p.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default SendWidget;
