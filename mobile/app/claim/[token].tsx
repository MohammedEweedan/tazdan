/**
 * Claim screen — subtle lottery ticket aesthetic.
 *
 * Universal URL: https://tazdan.com/claim/:token
 * Expo Router:  /claim/[token]
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TopGradient } from '@/components/ui/ScreenShell';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { useTransactionSound } from '@/hooks/useTransactionSound';
import { claimLinkService, type ClaimLinkPreview } from '@/services';
import { CoinIcon } from '@/components/ui/CoinIcon';

const { width: SCREEN_W } = Dimensions.get('window');
const TICKET_W = Math.min(SCREEN_W - 48, 380);
const LANDING_URL = 'https://tazdan.com';

type Phase = 'loading' | 'preview' | 'pin' | 'claiming' | 'claimed' | 'expired' | 'cancelled' | 'already_claimed' | 'not_found';

/** Resolve sender avatar: image URL, emoji, or initials fallback */
function senderAvatar(preview: ClaimLinkPreview): { kind: 'image'; uri: string } | { kind: 'emoji'; char: string } | { kind: 'initials'; char: string } {
  const url = preview.sender.avatarUrl?.trim();
  if (url && (/^https?:\/\//i.test(url) || url.startsWith('/'))) {
    return { kind: 'image', uri: url };
  }
  // Legacy: avatarUrl may hold an emoji
  if (url && url.length <= 4) {
    const stripped = url.replace(/[\uFE0E\uFE0F\u200D]/g, '');
    if (stripped.length > 0 && stripped.length <= 4) {
      let hasEmoji = false;
      for (const ch of stripped) {
        const cp = ch.codePointAt(0)!;
        if (cp < 0x20 || cp > 0x7E) { hasEmoji = true; break; }
      }
      if (hasEmoji) return { kind: 'emoji', char: url };
    }
  }
  return { kind: 'initials', char: (preview.sender.firstName?.[0] ?? '?').toUpperCase() };
}

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

/** Perforated edge dots (subtle ticket feel) */
function TicketEdge({ top = false }: { top?: boolean }) {
  const p = useThemedPalette();
  const dots = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    dots.push(
      <View
        key={i}
        style={{
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: p.bg,
        }}
      />
    );
  }
  return (
    <View
      style={{
        position: 'absolute',
        left: 0, right: 0,
        [top ? 'top' : 'bottom']: -3,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
      }}
    >
      {dots}
    </View>
  );
}

export default function ClaimScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const { playSuccess: playApplePay } = useTransactionSound();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const themeMode = useTheme((s) => s.mode);
  const isDark = themeMode === 'dark';

  const [phase, setPhase] = useState<Phase>('loading');
  const [preview, setPreview] = useState<ClaimLinkPreview | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

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
        else                                  setPhase('preview');
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
      playApplePay('transfer');
      setPhase('claimed');
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Could not claim';
      setError(msg);
      h.error();
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
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <TopGradient />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
          <Text style={{ color: p.fg, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
            {t('claim.title') || 'Claim'}
          </Text>
          <Pressable
            onPress={() => router.replace('/(tabs)' as any)}
            hitSlop={10}
            accessibilityLabel={t('common.close') || 'Close'}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? p.border : p.bgElev,
              borderWidth: 1, borderColor: p.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="close" size={18} color={p.fg} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {phase === 'loading' && (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={p.fg} />
              <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 14, fontWeight: '500' }}>
                {t('claim.loading') || 'Opening your claim…'}
              </Text>
            </View>
          )}

          {(phase === 'preview' || phase === 'pin' || phase === 'claiming') && preview && (
            <Animated.View entering={FadeIn.duration(280)} style={{ width: TICKET_W, alignItems: 'center' }}>
              {/* ── Ticket card ── */}
              <View
                style={{
                  width: TICKET_W,
                  backgroundColor: p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  borderRadius: 16,
                  paddingTop: 18,
                  paddingBottom: 18,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <TicketEdge top />
                <TicketEdge />

                {/* Dashed divider line (perforation feel) */}
                <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
                  <View style={{ borderStyle: 'dashed', borderWidth: 0.8, borderColor: p.border, borderRadius: 1 }} />
                </View>

                {/* Centered content */}
                <View style={{ alignItems: 'center', paddingHorizontal: 20, gap: 14 }}>
                  {/* Small label */}
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
                    {t('claim.youReceived') || 'You received'}
                  </Text>

                  {/* Big amount */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <CoinIcon symbol={preview.asset} size={44} />
                    <Text
                      style={{
                        color: p.fg, fontSize: 44, fontWeight: '800',
                        letterSpacing: -1.5,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {preview.amount}
                    </Text>
                  </View>
                  <Text style={{ color: p.fgMuted, fontSize: 16, fontWeight: '600', letterSpacing: 0.5 }}>
                    {preview.asset}
                  </Text>

                  {/* Sender */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {(() => {
                      const av = senderAvatar(preview);
                      return (
                        <View
                          style={{
                            width: 26, height: 26, borderRadius: 13,
                            backgroundColor: 'transparent',
                            alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {av.kind === 'image' ? (
                            <Image source={{ uri: av.uri }} style={{ width: 26, height: 26 }} />
                          ) : av.kind === 'emoji' ? (
                            <Text style={{ fontSize: 14 }}>{av.char}</Text>
                          ) : (
                            <Text style={{ color: p.ctaFg, fontWeight: '500', fontSize: 13 }}>{av.char}</Text>
                          )}
                        </View>
                      );
                    })()}
                    <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>
                      {t('claim.from') || 'from'} {preview.sender.handle ? `@${preview.sender.handle}` : (preview.sender.firstName || 'someone')}
                    </Text>
                  </View>
                </View>

                {/* Dashed divider */}
                <View style={{ paddingHorizontal: 20, marginTop: 18, marginBottom: 14 }}>
                  <View style={{ borderStyle: 'dashed', borderWidth: 0.8, borderColor: p.border, borderRadius: 1 }} />
                </View>

                {/* Meta row */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, paddingHorizontal: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: p.bgRaised, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 }}>
                    <Ionicons name="time-outline" size={12} color={p.fgMuted} />
                    <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>
                      {formatTimeLeft(preview.expiresAt)}
                    </Text>
                  </View>
                  {preview.hasPin && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: p.bgRaised, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 }}>
                      <Ionicons name="lock-closed" size={12} color={p.fgMuted} />
                      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>
                        {t('claim.pinRequired') || 'PIN required'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* ── Optional note ── */}
              {preview.note ? (
                <Animated.View
                  entering={FadeIn.delay(200).duration(300)}
                  style={{
                    marginTop: 14,
                    width: TICKET_W,
                    padding: 18,
                    backgroundColor: p.bgElev,
                    borderWidth: 1, borderColor: p.border,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {t('claim.note') || 'Note'}
                  </Text>
                  <Text style={{ color: p.fg, fontSize: 14, marginTop: 6, lineHeight: 21 }}>
                    {preview.note}
                  </Text>
                </Animated.View>
              ) : null}

              {/* ── PIN input ── */}
              {phase === 'pin' && (
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={{ marginTop: 18, gap: 8, width: TICKET_W, alignItems: 'center' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
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
                      width: 160, height: 48,
                      borderRadius: 14,
                      backgroundColor: p.bgElev,
                      borderWidth: 1, borderColor: p.border,
                      color: p.fg, fontSize: 20, fontWeight: '700',
                      textAlign: 'center', letterSpacing: 12,
                      fontVariant: ['tabular-nums'],
                    }}
                  />
                </Animated.View>
              )}

              {/* Error */}
              {error ? (
                <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 14, width: TICKET_W, alignItems: 'center' }}>
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: p.redBg, borderRadius: 12 }}>
                    <Text style={{ color: p.redFg, fontSize: 13, textAlign: 'center', fontWeight: '600' }}>
                      {error}
                    </Text>
                  </View>
                </Animated.View>
              ) : null}

              {/* ── CTA ── */}
              <View style={{ marginTop: 28, width: TICKET_W }}>
                <Pressable
                  onPress={doClaim}
                  disabled={phase === 'claiming' || (phase === 'pin' && pin.length < 4)}
                  style={({ pressed }) => ({
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: isDark ? '#ffffff' : '#111111',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                    opacity: (phase === 'pin' && pin.length < 4) ? 0.45 : pressed ? 0.92 : 1,
                    shadowColor: isDark ? '#ffffff' : '#000000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.14,
                    shadowRadius: 14,
                    elevation: 4,
                  })}
                >
                  {phase === 'claiming' ? (
                    <ActivityIndicator color={isDark ? '#111111' : '#ffffff'} />
                  ) : (
                    <>
                      <Ionicons name="arrow-down-circle" size={20} color={isDark ? '#111111' : '#ffffff'} />
                      <Text style={{ color: isDark ? '#111111' : '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }}>
                        {isAuthenticated
                          ? `${t('claim.cta') || 'Claim'} ${preview.amount} ${preview.asset}`
                          : (t('claim.signInToClaim') || 'Sign in to claim')}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={{ color: p.fgFaint, fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 16 }}>
                {t('claim.fineprint') || 'Funds settle instantly. Claim links cannot be claimed twice.'}
              </Text>

              {/* ── What is tazdan? ── */}
              <Pressable
                onPress={() => Linking.openURL(LANDING_URL)}
                style={({ pressed }) => ({
                  marginTop: 10,
                  alignSelf: 'center',
                  paddingHorizontal: 16, paddingVertical: 8,
                  borderRadius: 100,
                  backgroundColor: pressed ? p.bgRaised : 'transparent',
                  borderWidth: 1, borderColor: p.border,
                })}
              >
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
                  {t('claim.whatIstazdan') || 'What is tazdan?'}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* ── Claimed ── */}
          {phase === 'claimed' && preview && (
            <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center', justifyContent: 'center', width: TICKET_W }}>
              <View
                style={{
                  width: TICKET_W,
                  backgroundColor: p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  borderRadius: 16,
                  paddingTop: 36, paddingBottom: 28,
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <TicketEdge top />
                <TicketEdge />

                <View
                  style={{
                    width: 64, height: 64, borderRadius: 32,
                    backgroundColor: p.greenBg,
                    borderWidth: 1, borderColor: p.greenFg,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 18,
                  }}
                >
                  <Ionicons name="checkmark" size={32} color={p.greenFg} />
                </View>
                <Text style={{ color: p.fg, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                  {(t('claim.success') || 'Claimed!')}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  {`${preview.amount} ${preview.asset} ${(t('claim.successBody') || 'is now in your tazdan wallet.')}`}
                </Text>
              </View>

              <Pressable
                onPress={() => router.replace('/(tabs)/wallet' as any)}
                style={({ pressed }) => ({
                  marginTop: 24,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: isDark ? '#ffffff' : '#111111',
                  paddingHorizontal: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                  opacity: pressed ? 0.92 : 1,
                  shadowColor: isDark ? '#ffffff' : '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 10,
                  elevation: 3,
                })}
              >
                <Text style={{ color: isDark ? '#111111' : '#ffffff', fontSize: 15, fontWeight: '700' }}>
                  {t('claim.openWallet') || 'Open my wallet'}
                </Text>
                <Ionicons name="arrow-forward" size={15} color={isDark ? '#111111' : '#ffffff'} />
              </Pressable>
            </Animated.View>
          )}

          {/* ── Error states ── */}
          {(phase === 'expired' || phase === 'cancelled' || phase === 'already_claimed' || phase === 'not_found') && (
            <Animated.View entering={FadeIn.duration(240)} style={{ alignItems: 'center', justifyContent: 'center', width: TICKET_W }}>
              <View
                style={{
                  width: TICKET_W,
                  backgroundColor: p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  borderRadius: 16,
                  paddingTop: 36, paddingBottom: 28,
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <TicketEdge top />
                <TicketEdge />

                <View
                  style={{
                    width: 64, height: 64, borderRadius: 32,
                    backgroundColor: p.bgRaised,
                    borderWidth: 1, borderColor: p.border,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 18,
                  }}
                >
                  <Ionicons
                    name={
                      phase === 'already_claimed' ? 'checkmark-circle-outline'
                      : phase === 'cancelled'      ? 'close-circle-outline'
                      : 'time-outline'
                    }
                    size={28} color={p.fgMuted}
                  />
                </View>
                <Text style={{ color: p.fg, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' }}>
                  {phase === 'expired'         && (t('claim.expiredTitle')      || 'This claim has expired')}
                  {phase === 'cancelled'       && (t('claim.cancelledTitle')    || 'This claim was cancelled')}
                  {phase === 'already_claimed' && (t('claim.alreadyTitle')      || 'Already claimed')}
                  {phase === 'not_found'       && (t('claim.notFoundTitle')     || 'Claim link not found')}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 }}>
                  {phase === 'expired'         && (t('claim.expiredBody')        || 'The funds have been returned to the sender. Ask them to send a fresh link.')}
                  {phase === 'cancelled'       && (t('claim.cancelledBody')      || 'The sender pulled this claim back before you could open it.')}
                  {phase === 'already_claimed' && (t('claim.alreadyBody')        || 'These funds have already landed in another tazdan wallet.')}
                  {phase === 'not_found'       && (t('claim.notFoundBody')       || 'The link may be malformed. Double-check the URL from your email.')}
                </Text>
              </View>

              <Pressable
                onPress={() => router.replace('/(tabs)' as any)}
                style={({ pressed }) => ({
                  marginTop: 24,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: pressed ? p.bgRaised : p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  paddingHorizontal: 24,
                  alignItems: 'center', justifyContent: 'center',
                })}
              >
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                  {t('common.gotIt') || 'Got it'}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
