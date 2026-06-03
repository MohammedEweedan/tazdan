/**
 * Password reset — two phases in one screen:
 *
 *   Phase 1 "request": enter email → server sends a reset email with a link
 *            containing a high-entropy token (it always returns success, even
 *            for unknown emails, to avoid user enumeration).
 *   Phase 2 "reset":   paste the token (or the whole reset link — we extract
 *            the token=… param) + choose a new password → POST /reset-password.
 *
 * Matches the auth visual language (login/register): theme + i18n aware,
 * blue accent CTA, floating-label fields. No mocks — hits the real endpoints
 * (authService.forgotPassword / resetPassword).
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { authService } from '@/services';
import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { TopGradient } from '@/components/ui/ScreenShell';

type Phase = 'request' | 'sent' | 'reset' | 'done';

/** Pull the token out of a pasted reset URL, or return the input as-is. */
function extractToken(raw: string): string {
  const m = /[?&]token=([^&\s]+)/.exec(raw.trim());
  return (m ? m[1] : raw).trim();
}

export default function ResetPassword() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);

  const [phase, setPhase] = useState<Phase>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const accent = themeMode === 'mono' ? p.ctaBg : p.accent;
  const accentFg = themeMode === 'mono' ? p.ctaFg : p.accentFg;

  const requestReset = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t('reset.invalidEmail')); return; }
    setSubmitting(true);
    try {
      h.medium();
      await authService.forgotPassword(email.trim().toLowerCase());
      h.success();
      setPhase('sent');
    } catch (e: any) {
      // The endpoint is intentionally non-revealing; only network errors surface.
      setError(e?.message ?? t('reset.requestFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async () => {
    setError('');
    const tok = extractToken(token);
    if (tok.length < 10) { setError(t('reset.invalidToken')); return; }
    if (password.length < 8) { setError(t('reset.weakPassword')); return; }
    setSubmitting(true);
    try {
      h.medium();
      await authService.resetPassword(tok, password);
      h.success();
      setPhase('done');
    } catch (e: any) {
      h.error();
      setError(e?.response?.data?.message ?? e?.message ?? t('reset.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <TopGradient />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable
            onPress={() => { h.selection(); router.back(); }}
            hitSlop={10}
            style={{
              width: 38, height: 38, borderRadius: 19, marginTop: 4,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
            }}
          >
            <Ionicons name="chevron-back" size={20} color={p.fg} />
          </Pressable>

          {/* Heading */}
          <Text style={{ color: p.fg, fontSize: 32, fontWeight: '600', letterSpacing: -1.1, marginTop: 28 }}>
            {phase === 'done' ? t('reset.doneTitle')
              : phase === 'reset' ? t('reset.newPasswordTitle')
              : t('reset.title')}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
            {phase === 'request' ? t('reset.subtitle')
              : phase === 'sent' ? t('reset.sentSubtitle')
              : phase === 'reset' ? t('reset.newPasswordSubtitle')
              : t('reset.doneSubtitle')}
          </Text>

          {/* ── PHASE: request ── */}
          {phase === 'request' && (
            <View style={{ marginTop: 28, gap: 12 }}>
              <Field label={t('reset.emailLabel')} value={email} onChangeText={(v) => setEmail(v.replace(/\s/g, ''))}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} palette={p} />
              {!!error && <ErrorText p={p} msg={error} />}
              <PrimaryButton label={t('reset.sendLink')} loading={submitting} onPress={requestReset} bg={accent} fg={accentFg} />
            </View>
          )}

          {/* ── PHASE: sent (confirmation) ── */}
          {phase === 'sent' && (
            <View style={{ marginTop: 28, gap: 16 }}>
              <View style={{
                alignSelf: 'flex-start', width: 56, height: 56, borderRadius: 28,
                backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="mail-outline" size={26} color={p.accentText} />
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 21 }}>
                {t('reset.sentBody')}
              </Text>
              <PrimaryButton label={t('reset.enterToken')} onPress={() => { h.selection(); setError(''); setPhase('reset'); }} bg={accent} fg={accentFg} />
              <Pressable onPress={() => { h.selection(); setPhase('request'); }} hitSlop={6} style={{ alignSelf: 'center' }}>
                <Text style={{ color: p.accentText, fontSize: 14, fontWeight: '700' }}>{t('reset.resend')}</Text>
              </Pressable>
            </View>
          )}

          {/* ── PHASE: reset (code + new password) ── */}
          {phase === 'reset' && (
            <View style={{ marginTop: 28, gap: 12 }}>
              {/* 6-digit code from the email. Pasting the whole web link also
                  works — extractToken() pulls the token out on submit. */}
              <Field label={t('reset.tokenLabel')} value={token}
                onChangeText={(v) => setToken(/^\d*$/.test(v) ? v.slice(0, 6) : v)}
                keyboardType="default" autoCapitalize="none" autoCorrect={false} palette={p} />
              <Field label={t('reset.newPasswordLabel')} value={password} onChangeText={setPassword}
                secureTextEntry={!showPw} autoCapitalize="none" autoCorrect={false} palette={p}
                right={
                  <Pressable hitSlop={8} onPress={() => { h.selection(); setShowPw((s) => !s); }}>
                    <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={p.fgMuted} />
                  </Pressable>
                } />
              {!!error && <ErrorText p={p} msg={error} />}
              <PrimaryButton label={t('reset.setPassword')} loading={submitting} onPress={submitReset} bg={accent} fg={accentFg} />
            </View>
          )}

          {/* ── PHASE: done ── */}
          {phase === 'done' && (
            <View style={{ marginTop: 28, gap: 18 }}>
              <View style={{
                alignSelf: 'flex-start', width: 56, height: 56, borderRadius: 28,
                backgroundColor: p.greenBg, alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="checkmark-circle" size={30} color={p.greenFg} />
              </View>
              <PrimaryButton label={t('reset.backToLogin')} onPress={() => router.replace('/login')} bg={accent} fg={accentFg} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ErrorText({ p, msg }: { p: Palette; msg: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name="alert-circle" size={15} color={p.redFg} />
      <Text style={{ color: p.redFg, fontSize: 13, fontWeight: '600', flex: 1 }}>{msg}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress, loading, bg, fg }: {
  label: string; onPress: () => void; loading?: boolean; bg: string; fg: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        marginTop: 8, height: 56, borderRadius: 28, backgroundColor: bg,
        opacity: loading ? 0.7 : pressed ? 0.85 : 1,
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
      })}
    >
      {loading && <ActivityIndicator size="small" color={fg} />}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 }}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label, value, onChangeText, right, palette: p, ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  right?: React.ReactNode;
  palette: Palette;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{
      height: 60, borderRadius: 16, paddingHorizontal: 16,
      paddingTop: value || focused ? 18 : 0,
      backgroundColor: p.bgElev, borderWidth: 1,
      borderColor: focused ? p.accentText : p.border, justifyContent: 'center',
    }}>
      <Text style={{
        position: 'absolute', left: 16, top: value || focused ? 10 : 20,
        color: p.fgMuted, fontSize: value || focused ? 11 : 15, fontWeight: '500',
      }}>
        {label}
      </Text>
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={p.fg}
        placeholderTextColor={p.fgFaint}
        style={{ color: p.fg, fontSize: 16, fontWeight: '500' }}
      />
      {right && (
        <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
          {right}
        </View>
      )}
    </View>
  );
}
