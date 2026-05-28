/**
 * Claim screen — the headline feature.
 *
 * Universal URL: https://Fortuni.com/claim/:token
 * Expo Router:  /claim/[token]
 *
 * Flow:
 *  1. PUBLIC preview — we fetch /claim-links/by-token/:token WITHOUT
 *     auth. This works even on cold-tap from an email when the user
 *     hasn't signed in (or has never used the app).
 *  2. Reveal animation — a sealed envelope (mono icon) bursts open into
 *     the amount + asset, framed by the sender's name/avatar. The first
 *     impression is what makes this magical, not the network call.
 *  3. Big CTA — "Claim {amount}". If unauthed, route to sign-up /
 *     sign-in with `?next=/claim/{token}`. If authed, POST the claim
 *     endpoint and animate the amount into the user's balance.
 *  4. After-state — confetti tick + receipt, with a "Open my wallet"
 *     CTA. Failure states (expired / already claimed / wrong PIN) get
 *     specific copy, not a generic error.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { claimLinkService, type ClaimLinkPreview } from '@/services';
import { CoinIcon } from '@/components/ui/CoinIcon';

type Phase = 'loading' | 'preview' | 'pin' | 'claiming' | 'claimed' | 'expired' | 'cancelled' | 'already_claimed' | 'not_found';

function formatTimeLeft(expiresAt?: string): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days  = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0)  return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function ClaimScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [phase, setPhase] = useState<Phase>('loading');
  const [preview, setPreview] = useState<ClaimLinkPreview | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Reveal animation shared values ──────────────────────────────
  const envelope = useSharedValue(1);   // 1 = sealed, 0 = open
  const amountY  = useSharedValue(40);
  const amountO  = useSharedValue(0);
  const senderO  = useSharedValue(0);
  const glow     = useSharedValue(0);

  const envelopeStyle = useAnimatedStyle(() => ({
    opacity: envelope.value,
    transform: [
      { scale: 0.8 + envelope.value * 0.2 },
      { rotate: `${(1 - envelope.value) * -8}deg` },
    ],
  }));
  const amountStyle = useAnimatedStyle(() => ({
    opacity: amountO.value,
    transform: [{ translateY: amountY.value }, { scale: 0.94 + amountO.value * 0.06 }],
  }));
  const senderStyle = useAnimatedStyle(() => ({
    opacity: senderO.value,
    transform: [{ translateY: (1 - senderO.value) * 10 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.8 + glow.value * 0.5 }],
  }));

  function playReveal() {
    h.success();
    envelope.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
    amountY.value  = withDelay(220, withSpring(0, { damping: 14, stiffness: 180 }));
    amountO.value  = withDelay(220, withTiming(1, { duration: 500 }));
    senderO.value  = withDelay(420, withTiming(1, { duration: 400 }));
    glow.value     = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, true,
    );
  }

  /* ── Load preview ──────────────────────────────────────────── */
  useEffect(() => {
    if (!token) { setPhase('not_found'); return; }
    let cancelled = false;
    claimLinkService.previewByToken(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        if      (data.status === 'EXPIRED')   setPhase('expired');
        else if (data.status === 'CANCELLED') setPhase('cancelled');
        else if (data.status === 'CLAIMED')   setPhase('already_claimed');
        else                                  { setPhase('preview'); playReveal(); }
      })
      .catch((e: any) => {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 404) setPhase('not_found');
        else                { setError(e?.response?.data?.error ?? 'Could not load this link'); setPhase('not_found'); }
      });
    return () => { cancelled = true; };
  }, [token]);

  /* ── Claim handler ─────────────────────────────────────────── */
  async function doClaim() {
    if (!preview) return;
    if (!isAuthenticated) {
      // Take the user through sign-up / sign-in, return to this screen.
      router.push({ pathname: '/(auth)/login', params: { next: `/claim/${token}` } } as any);
      return;
    }
    if (preview.hasPin && phase !== 'pin') { setPhase('pin'); return; }

    h.light();
    setPhase('claiming');
    setError(null);
    try {
      await claimLinkService.claimByToken(token!, preview.hasPin ? pin : undefined);
      h.success();
      setPhase('claimed');
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Could not claim';
      setError(msg);
      h.error();
      // Specific error mapping so the UI never shows a raw 500.
      if (/expired/i.test(msg))            setPhase('expired');
      else if (/cancelled/i.test(msg))     setPhase('cancelled');
      else if (/already claimed/i.test(msg) || /claimed/i.test(msg)) setPhase('already_claimed');
      else if (preview.hasPin)             setPhase('pin');
      else                                 setPhase('preview');
    }
  }

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Close button */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, paddingTop: 8 }}>
          <Pressable
            onPress={() => router.replace('/(tabs)' as any)}
            hitSlop={10}
            accessibilityLabel={t('common.close') || 'Close'}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? p.bgRaised : p.bgElev,
              borderWidth: 1, borderColor: p.border,
            })}
          >
            <Ionicons name="close" size={18} color={p.fg} />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
          {phase === 'loading' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={p.fg} />
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 12 }}>
                {t('claim.loading') || 'Opening your claim…'}
              </Text>
            </View>
          )}

          {(phase === 'preview' || phase === 'pin' || phase === 'claiming') && preview && (
            <View style={{ flex: 1 }}>
              {/* ── Sealed envelope (fades out) ── */}
              <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 24, height: 130 }}>
                {/* Soft halo */}
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      width: 220, height: 220, borderRadius: 110,
                      backgroundColor: p.fg,
                      opacity: 0.06,
                    },
                    glowStyle,
                  ]}
                />
                <Animated.View style={[envelopeStyle, { position: 'absolute' }]}>
                  <Ionicons name="mail" size={84} color={p.fg} />
                </Animated.View>
                {/* Sparkle dots that ride along the reveal */}
                <Animated.View
                  entering={FadeIn.delay(350).duration(400)}
                  style={{ flexDirection: 'row', gap: 6, position: 'absolute', top: 4 }}
                >
                  <Ionicons name="sparkles" size={14} color={p.fg} />
                  <Ionicons name="sparkles" size={10} color={p.fgMuted} />
                </Animated.View>
              </View>

              {/* ── Big amount + asset ── */}
              <Animated.View style={[amountStyle, { alignItems: 'center', marginTop: 20 }]}>
                <Text
                  style={{
                    color: p.fgMuted, fontSize: 12, fontWeight: '700',
                    letterSpacing: 1.6, textTransform: 'uppercase',
                  }}
                >
                  {t('claim.youReceived') || 'You received'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                  <CoinIcon symbol={preview.asset} size={36} />
                  <Text
                    style={{
                      color: p.fg, fontSize: 56, fontWeight: '800',
                      letterSpacing: -2,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {preview.amount}
                  </Text>
                </View>
                <Text style={{ color: p.fgMuted, fontSize: 18, fontWeight: '600', marginTop: 4, letterSpacing: 1.2 }}>
                  {preview.asset}
                </Text>
              </Animated.View>

              {/* ── Sender chip ── */}
              <Animated.View
                style={[
                  senderStyle,
                  {
                    marginTop: 28,
                    alignSelf: 'center',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: p.bgElev,
                    borderColor: p.border, borderWidth: 1,
                    paddingLeft: 6, paddingRight: 14,
                    paddingVertical: 6,
                    borderRadius: 100,
                  },
                ]}
              >
                <View
                  style={{
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: p.bgRaised,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: p.border,
                  }}
                >
                  <Text style={{ color: p.fg, fontWeight: '700', fontSize: 12 }}>
                    {(preview.sender.firstName?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>
                  {(t('claim.from') || 'from')} {preview.sender.handle ? `@${preview.sender.handle}` : (preview.sender.firstName || 'someone')}
                </Text>
              </Animated.View>

              {/* ── Optional note ── */}
              {preview.note ? (
                <Animated.View
                  entering={FadeIn.delay(700).duration(400)}
                  style={{
                    marginTop: 16, marginHorizontal: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    backgroundColor: p.bgElev, borderColor: p.border, borderWidth: 1,
                    borderRadius: 16,
                  }}
                >
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {t('claim.note') || 'Note'}
                  </Text>
                  <Text style={{ color: p.fg, fontSize: 14, marginTop: 4, lineHeight: 20 }}>
                    “{preview.note}”
                  </Text>
                </Animated.View>
              ) : null}

              {/* ── Time-left + secured indicator ── */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={12} color={p.fgMuted} />
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>
                    {formatTimeLeft(preview.expiresAt)}
                  </Text>
                </View>
                {preview.hasPin && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="lock-closed" size={12} color={p.fgMuted} />
                    <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>
                      {t('claim.pinRequired') || 'PIN required'}
                    </Text>
                  </View>
                )}
              </View>

              {/* ── PIN input (when applicable) ── */}
              {phase === 'pin' && (
                <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={{ marginTop: 22 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
                    {t('claim.enterPin') || 'Enter the PIN the sender gave you'}
                  </Text>
                  <TextInput
                    value={pin}
                    onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 8))}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={8}
                    autoFocus
                    placeholder="••••"
                    placeholderTextColor={p.fgFaint}
                    style={{
                      alignSelf: 'center',
                      width: 200, height: 56,
                      borderRadius: 16,
                      backgroundColor: p.bgElev,
                      borderWidth: 1, borderColor: p.border,
                      color: p.fg, fontSize: 24, fontWeight: '700',
                      textAlign: 'center', letterSpacing: 16,
                      fontVariant: ['tabular-nums'],
                    }}
                  />
                </Animated.View>
              )}

              {error ? (
                <Text style={{ color: p.redFg, fontSize: 13, textAlign: 'center', marginTop: 14 }}>
                  {error}
                </Text>
              ) : null}

              {/* ── CTA ── */}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={doClaim}
                disabled={phase === 'claiming' || (phase === 'pin' && pin.length < 4)}
                style={({ pressed }) => ({
                  marginBottom: 14, marginTop: 24,
                  height: 60, borderRadius: 30,
                  backgroundColor: p.ctaBg,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 10,
                  opacity: (phase === 'pin' && pin.length < 4) ? 0.5 : pressed ? 0.92 : 1,
                  shadowColor: '#000',
                  shadowOpacity: 0.18,
                  shadowOffset: { width: 0, height: 6 },
                  shadowRadius: 16,
                  elevation: 6,
                })}
              >
                {phase === 'claiming' ? (
                  <ActivityIndicator color={p.ctaFg} />
                ) : (
                  <>
                    <Ionicons name="arrow-down-circle" size={20} color={p.ctaFg} />
                    <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>
                      {isAuthenticated
                        ? `${t('claim.cta') || 'Claim'} ${preview.amount} ${preview.asset}`
                        : (t('claim.signInToClaim') || 'Sign in to claim')}
                    </Text>
                  </>
                )}
              </Pressable>
              <Text style={{ color: p.fgFaint, fontSize: 11, textAlign: 'center', marginBottom: 8 }}>
                {t('claim.fineprint') || 'Funds settle instantly. Claim links cannot be claimed twice.'}
              </Text>
            </View>
          )}

          {/* ── Final states ────────────────────────────────────── */}
          {phase === 'claimed' && preview && (
            <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 100, height: 100, borderRadius: 50,
                  backgroundColor: p.greenBg, borderWidth: 2, borderColor: p.greenFg,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 24,
                }}
              >
                <Ionicons name="checkmark" size={56} color={p.greenFg} />
              </View>
              <Text style={{ color: p.fg, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 }}>
                {(t('claim.success') || 'Claimed!')}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500', marginTop: 8, textAlign: 'center' }}>
                {`${preview.amount} ${preview.asset} ${(t('claim.successBody') || 'is now in your Fortuni wallet.')}`}
              </Text>
              <Pressable
                onPress={() => router.replace('/(tabs)/wallet' as any)}
                style={({ pressed }) => ({
                  marginTop: 40,
                  paddingHorizontal: 28, height: 52, borderRadius: 26,
                  backgroundColor: p.ctaBg,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '800' }}>
                  {t('claim.openWallet') || 'Open my wallet'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={p.ctaFg} />
              </Pressable>
            </Animated.View>
          )}

          {(phase === 'expired' || phase === 'cancelled' || phase === 'already_claimed' || phase === 'not_found') && (
            <Animated.View entering={FadeIn.duration(240)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 96, height: 96, borderRadius: 48,
                  backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                }}
              >
                <Ionicons
                  name={
                    phase === 'already_claimed' ? 'checkmark-circle-outline'
                    : phase === 'cancelled'      ? 'close-circle-outline'
                    : 'time-outline'
                  }
                  size={48} color={p.fgMuted}
                />
              </View>
              <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' }}>
                {phase === 'expired'         && (t('claim.expiredTitle')      || 'This claim has expired')}
                {phase === 'cancelled'       && (t('claim.cancelledTitle')    || 'This claim was cancelled')}
                {phase === 'already_claimed' && (t('claim.alreadyTitle')      || 'Already claimed')}
                {phase === 'not_found'       && (t('claim.notFoundTitle')     || 'Claim link not found')}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 }}>
                {phase === 'expired'         && (t('claim.expiredBody')        || 'The funds have been returned to the sender. Ask them to send a fresh link.')}
                {phase === 'cancelled'       && (t('claim.cancelledBody')      || 'The sender pulled this claim back before you could open it.')}
                {phase === 'already_claimed' && (t('claim.alreadyBody')        || 'These funds have already landed in another Fortuni wallet.')}
                {phase === 'not_found'       && (t('claim.notFoundBody')       || 'The link may be malformed. Double-check the URL from your email.')}
              </Text>
              <Pressable
                onPress={() => router.replace('/(tabs)' as any)}
                style={({ pressed }) => ({
                  marginTop: 36,
                  paddingHorizontal: 26, height: 48, borderRadius: 24,
                  backgroundColor: pressed ? p.bgRaised : p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                })}
              >
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                  {t('common.gotIt') || 'Got it'}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
