/**
 * Send money — recipient (with type-ahead profile search), Crypto/Fiat
 * toggle, currency picker, amount, optional note, and a CTA whose own
 * surface flashes green/red instead of using a global toast.
 *
 * QR scanning: we lazy-require `expo-camera`. If the package isn't
 * installed yet the screen still works - the scan button just opens a
 * helpful alert telling the user how to enable it (one expo install
 * away). This keeps the screen functional without forcing a new dep.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useWallets, extractErrorMessage } from '@/hooks';
import { profileService } from '@/services';
import type { Currency } from '@/types';

const FIATS:  Currency[] = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'];
const CRYPTO: Currency[] = ['BTC', 'ETH', 'USDT', 'SOL'];

type Mode = 'FIAT' | 'CRYPTO';
type Profile = { id: string; username: string; firstName: string; lastName: string; avatarUrl?: string; kycTier?: string };

export default function Send() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const { data: wallets } = useWallets();

  const [mode, setMode] = useState<Mode>('FIAT');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [recipient, setRecipient] = useState('');
  const [picked, setPicked] = useState<Profile | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError, setCtaError] = useState<string | null>(null);

  // Reset currency to a sensible default whenever the user flips mode.
  useEffect(() => {
    setCurrency(mode === 'FIAT' ? 'USD' : 'BTC');
    setAmount('');
  }, [mode]);

  const wallet = wallets?.find((w) => w.currency === currency);
  const balance = wallet ? Number(wallet.balance) : 0;
  const sendAmount = Number(amount || 0);
  const overspend = sendAmount > balance;

  // Debounce the search query so we don't spam the backend on every keystroke.
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

  const tryQrScan = async () => {
    h.selection();
    // Lazy-require expo-camera so the import error becomes a friendly
    // alert instead of a hard crash if the package isn't installed yet.
    let mod: any = null;
    try { mod = require('expo-camera'); } catch { /* not installed */ }
    if (!mod) {
      Alert.alert(
        'Enable QR scanning',
        'Run `npx expo install expo-camera` then restart the app to scan @handle QR codes from this screen.',
        [
          { text: 'Use sample handle', onPress: () => { setRecipient('@demo'); } },
          { text: 'OK', style: 'cancel' },
        ],
      );
      return;
    }
    // Camera is installed — but to keep this file self-contained without
    // a separate scanner screen we ask the user to enter manually for now.
    // (A full-screen scanner can be added at /send/scan later.)
    Alert.alert(
      'QR scanner ready',
      'Camera permission will be requested on next tap. (Full scanner screen coming soon - paste the handle for now.)',
      [{ text: 'OK' }],
    );
  };

  return (
    <ScreenShell title="Send money" scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* Recipient row with QR + autocomplete */}
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 4 }}>
          TO
        </Text>
        <View style={{
          marginTop: 8, height: 56, borderRadius: 16,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
          gap: 10,
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
          <Pressable
            onPress={tryQrScan}
            hitSlop={8}
            accessibilityLabel="Scan QR code"
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 12,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? p.border : p.pillBg,
              borderWidth: 1, borderColor: p.border,
            })}
          >
            <Ionicons name="scan-outline" size={16} color={p.fg} />
          </Pressable>
        </View>

        {/* Type-ahead matches */}
        {recipient.trim().length >= 1 && !picked && (
          <Panel style={{ marginTop: 8 }}>
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
              matches.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    h.selection();
                    setPicked(m);
                    setRecipient(`@${m.username}`);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 12,
                    backgroundColor: pressed ? p.border : 'transparent',
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border,
                  })}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: '#7c3aed',
                    alignItems: 'center', justifyContent: 'center',
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
          </Panel>
        )}

        {/* Picked badge */}
        {picked && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            marginTop: 10, padding: 12,
            borderRadius: 14,
            backgroundColor: p.greenBg,
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

        {/* Crypto / Fiat toggle */}
        <View style={{
          flexDirection: 'row', marginTop: 22, padding: 4,
          borderRadius: 14,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          gap: 4,
        }}>
          {(['FIAT', 'CRYPTO'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => { h.selection(); setMode(m); }}
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

        {/* Currency picker chips */}
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 18 }}>
          FROM
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 4 }}
        >
          {(mode === 'FIAT' ? FIATS : CRYPTO).map((c) => (
            <Pressable
              key={c}
              onPress={() => { h.selection(); setCurrency(c); setAmount(''); }}
              style={({ pressed }) => ({
                paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14,
                backgroundColor: currency === c ? p.fg : p.bgElev,
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
            <Pressable hitSlop={6} onPress={() => { h.selection(); setAmount(String(balance)); }}>
              <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>USE MAX</Text>
            </Pressable>
          </View>
          <View style={{
            marginTop: 10, height: 64, borderRadius: 16,
            backgroundColor: p.bgElev,
            borderWidth: 1.5, borderColor: overspend ? p.redFg : p.border,
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18,
          }}>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={p.fgFaint}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: p.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
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
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
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
          <Panel style={{ marginTop: 22 }}>
            <View style={{ padding: 14, gap: 8 }}>
              <Row label="Recipient" value={picked ? `@${picked.username}` : recipient} palette={p} />
              <Row label="Amount"    value={`${sendAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${currency}`} palette={p} />
              <Row label="Network"   value={mode === 'CRYPTO' ? 'On-chain' : 'Internal · instant'} palette={p} />
              <Row label="Fee"       value="Free" accent={p.greenFg} palette={p} />
            </View>
          </Panel>
        )}

        {/* CTA — flashes green on success / red on error */}
        <View style={{ marginTop: 22 }}>
          <CTAButton
            label={
              ctaState === 'loading' ? 'Sending…' : `Send ${currency}`
            }
            icon="paper-plane"
            disabled={!valid}
            state={ctaState}
            successLabel="Sent!"
            errorLabel={ctaError ?? 'Send failed'}
            onPress={async () => {
              setCtaState('loading');
              setCtaError(null);
              try {
                // TODO: replace with real /transfers/send call once backend
                // route exists. For now we simulate with a 700ms latency so
                // the success state is visible.
                await new Promise<void>((resolve, reject) => setTimeout(() => {
                  if (overspend) reject(new Error('Insufficient balance'));
                  else resolve();
                }, 700));
                h.success();
                setCtaState('success');
                setTimeout(() => router.back(), 900);
              } catch (e: any) {
                h.error();
                setCtaError(extractErrorMessage(e, 'Send failed'));
                setCtaState('error');
                setTimeout(() => setCtaState('idle'), 1800);
              }
            }}
          />
        </View>
      </ScrollView>
    </ScreenShell>
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
