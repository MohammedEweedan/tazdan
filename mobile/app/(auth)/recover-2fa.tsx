/**
 * 2FA recovery — for users locked out because they lost their authenticator.
 *
 *   Phase 1 "request": enter email → server emails a 6-digit recovery code
 *            (only if an account with 2FA exists; response is non-revealing).
 *   Phase 2 "verify":  code + phone (used at registration) + date of birth →
 *            server disables 2FA so the user can sign in with email + password.
 *
 * Identity is proven by THREE factors (email inbox + phone + DOB), so a single
 * compromised channel isn't enough to strip 2FA. Reachable from the login 2FA
 * modal ("Lost your authenticator?").
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

type Phase = 'request' | 'verify' | 'done';

/** dd/mm/yyyy → YYYY-MM-DD for the API. */
function toIso(dob: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : dob;
}

export default function Recover2FA() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);

  const [phase, setPhase] = useState<Phase>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const accent = themeMode === 'mono' ? p.ctaBg : p.accent;
  const accentFg = themeMode === 'mono' ? p.ctaFg : p.accentFg;

  const request = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t('recover.invalidEmail')); return; }
    setSubmitting(true);
    try {
      h.medium();
      await authService.request2FARecovery(email.trim().toLowerCase());
      h.success();
      setPhase('verify');
    } catch (e: any) {
      setError(e?.message ?? t('recover.requestFailed'));
    } finally { setSubmitting(false); }
  };

  const verify = async () => {
    setError('');
    if (code.length !== 6) { setError(t('recover.invalidCode')); return; }
    if (phone.replace(/\D/g, '').length < 4) { setError(t('recover.invalidPhone')); return; }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) { setError(t('recover.invalidDob')); return; }
    setSubmitting(true);
    try {
      h.medium();
      await authService.verify2FARecovery({
        email: email.trim().toLowerCase(),
        code,
        phone: phone.replace(/\D/g, ''),
        dateOfBirth: toIso(dob),
      });
      h.success();
      setPhase('done');
    } catch (e: any) {
      h.error();
      setError(e?.response?.data?.message ?? e?.response?.data?.error ?? t('recover.failed'));
    } finally { setSubmitting(false); }
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

          <Text style={{ color: p.fg, fontSize: 32, fontWeight: '600', letterSpacing: -1.1, marginTop: 28 }}>
            {phase === 'done' ? t('recover.doneTitle') : t('recover.title')}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
            {phase === 'request' ? t('recover.subtitle')
              : phase === 'verify' ? t('recover.verifySubtitle')
              : t('recover.doneSubtitle')}
          </Text>

          {phase === 'request' && (
            <View style={{ marginTop: 28, gap: 12 }}>
              <Field label={t('recover.emailLabel')} value={email} onChangeText={(v) => setEmail(v.replace(/\s/g, ''))}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} palette={p} />
              {!!error && <ErrorText p={p} msg={error} />}
              <PrimaryButton label={t('recover.sendCode')} loading={submitting} onPress={request} bg={accent} fg={accentFg} />
            </View>
          )}

          {phase === 'verify' && (
            <View style={{ marginTop: 28, gap: 12 }}>
              <Field label={t('recover.codeLabel')} value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad" palette={p} />
              <Field label={t('recover.phoneLabel')} value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ''))}
                keyboardType="phone-pad" palette={p} />
              <Field label={t('recover.dobLabel')} value={dob}
                onChangeText={(v) => {
                  const d = v.replace(/\D/g, '').slice(0, 8);
                  let out = d;
                  if (d.length > 2) out = `${d.slice(0, 2)}/${d.slice(2)}`;
                  if (d.length > 4) out = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
                  setDob(out);
                }}
                keyboardType="number-pad" palette={p} />
              {!!error && <ErrorText p={p} msg={error} />}
              <PrimaryButton label={t('recover.removeTwoFA')} loading={submitting} onPress={verify} bg={accent} fg={accentFg} />
            </View>
          )}

          {phase === 'done' && (
            <View style={{ marginTop: 28, gap: 18 }}>
              <View style={{
                alignSelf: 'flex-start', width: 56, height: 56, borderRadius: 28,
                backgroundColor: p.greenBg, alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="lock-open" size={28} color={p.greenFg} />
              </View>
              <PrimaryButton label={t('recover.backToLogin')} onPress={() => router.replace('/login')} bg={accent} fg={accentFg} />
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
  label, value, onChangeText, palette: p, ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  palette: Palette;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
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
    </View>
  );
}
