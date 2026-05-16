/**
 * Login — minimal, theme + i18n aware. Real auth (no mocks).
 * Layout is tight (no dead space) and every button is visibly styled
 * in BOTH dark and light themes — no white-on-white invisibility.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';

import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';

const schema = z.object({
  // Can be email or handle (username)
  email:    z.string().min(1, 'Email or handle is required'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const locale = useI18n((s) => s.locale);
  const cycleLocale = useI18n((s) => s.cycle);
  const login = useAuthStore((s) => s.login);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const triggerBiometricLogin = useAuthStore((s) => s.triggerBiometricLogin);

  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  // 2FA flow — server returns { requires2FA: true } on the first POST when
  // the account has TOTP enabled. We show a code modal and replay the
  // login with the same credentials + code.
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]).then(([hw, enrolled]) => setBioAvailable(hw && enrolled));
  }, []);

  const { control, handleSubmit, formState: { errors }, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // Pre-fill the demo account so the user can tap straight through.
  const fillDemo = () => {
    h.selection();
    setValue('email', 'rayan@promrkts.app');
    setValue('password', 'Demo123!');
  };

  const onSubmit = async (values: FormValues) => {
    const email = values.email.trim().toLowerCase();
    const password = values.password;
    try {
      setSubmitting(true);
      const result = await login(email, password);
      if (result && 'requires2FA' in result) {
        setPendingCreds({ email, password });
        setTwoFACode('');
        setTwoFAOpen(true);
        h.light();
        return;
      }
      h.success();
      // AuthGate will redirect to "/" automatically
    } catch (e: unknown) {
      h.error();
      Alert.alert(t('login.failed'), extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submit2FA = async () => {
    if (!pendingCreds || twoFACode.length < 6) return;
    try {
      setSubmitting(true);
      const result = await login(pendingCreds.email, pendingCreds.password, twoFACode);
      if (result && 'requires2FA' in result) {
        h.error();
        Alert.alert(t('login.failed'), 'Invalid code. Try again.');
        return;
      }
      setTwoFAOpen(false);
      setPendingCreds(null);
      h.success();
    } catch (e: unknown) {
      h.error();
      Alert.alert(t('login.failed'), extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Top bar ── */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 4, marginBottom: 24,
            }}>
              <Pressable
                onPress={() => {
                  h.selection();
                  if (router.canGoBack()) router.back();
                  else router.replace('/(auth)/onboarding');
                }}
                hitSlop={12}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: p.pillBg,
                  borderWidth: 1, borderColor: p.border,
                }}
              >
                <Ionicons name="chevron-back" size={20} color={p.fg} />
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Pressable
                  onPress={() => { h.selection(); cycleLocale(); }}
                  hitSlop={6}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 10, height: 34, borderRadius: 17,
                    backgroundColor: p.pillBg,
                    borderWidth: 1, borderColor: p.border,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{LOCALE_META[locale].flag}</Text>
                  <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
                    {locale.toUpperCase()}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { h.selection(); toggleTheme(); }}
                  hitSlop={6}
                  style={{
                    width: 34, height: 34, borderRadius: 17,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: p.pillBg,
                    borderWidth: 1, borderColor: p.border,
                  }}
                >
                  <Ionicons
                    name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
                    size={16}
                    color={p.fg}
                  />
                </Pressable>
                <Image
                  source={require('../../assets/icon-color.png')}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Heading */}
            <Text style={{ color: p.fg, fontSize: 34, fontWeight: '800', letterSpacing: -1.1 }}>
              {t('login.title')}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
              {t('login.subtitle')}
            </Text>

            {/* Form */}
            <View style={{ marginTop: 28, gap: 12 }}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Email or @handle"
                    value={value}
                    onChangeText={(v) => onChange(v.replace(/\s/g, ''))}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={errors.email?.message}
                    palette={p}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label={t('login.password')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={errors.password?.message}
                    palette={p}
                    right={
                      <Pressable hitSlop={8} onPress={() => { h.selection(); setShowPw((s) => !s); }}>
                        <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={p.fgMuted} />
                      </Pressable>
                    }
                  />
                )}
              />
              <Pressable
                hitSlop={6}
                style={{ alignSelf: 'flex-end', marginTop: 2 }}
                onPress={() => Alert.alert('Forgot password?', 'Password reset is coming soon. Contact support@promrkts.app for now.')}
              >
                <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>
                  {t('login.forgot')}
                </Text>
              </Pressable>
            </View>

            {/* PRIMARY CTA — explicit, high-contrast, can't-miss-it.
                Always visible because the parent ScrollView grows to
                fill the screen and the button has a hard min-height. */}
            <Pressable
              onPress={() => { h.medium(); handleSubmit(onSubmit, () => h.error())(); }}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={t('login.cta')}
              style={({ pressed }) => ({
                marginTop: 28,
                height: 58,
                minHeight: 58,
                borderRadius: 29,
                backgroundColor: p.ctaBg,
                opacity: submitting ? 0.7 : pressed ? 0.85 : 1,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row',
                gap: 10,
                shadowColor: '#000',
                shadowOpacity: 0.22,
                shadowOffset: { width: 0, height: 6 },
                shadowRadius: 14,
                elevation: 4,
              })}
            >
              {submitting && <ActivityIndicator size="small" color={p.ctaFg} />}
              <Ionicons name="arrow-forward" size={18} color={p.ctaFg} />
              <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>
                {submitting ? t('login.loading') : t('login.cta')}
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
              <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>
                {t('login.or').toUpperCase()}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
            </View>

            {/* Apple SSO — bordered, clearly a button */}
            <Pressable
              onPress={() => {
                h.light();
                Alert.alert('Apple Sign-In', 'Apple Sign-In is coming soon. Use email + password for now.');
              }}
              style={({ pressed }) => ({
                marginTop: 18,
                height: 56,
                borderRadius: 28,
                backgroundColor: pressed ? p.bgElev : p.bg,
                borderWidth: 1.5,
                borderColor: p.fg,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 8,
              })}
            >
              <Ionicons name="logo-apple" size={20} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                {t('login.apple')}
              </Text>
            </Pressable>

            {/* Face ID — shown only when biometric is enrolled and was previously enabled */}
            {bioAvailable && biometricEnabled && (
              <Pressable
                onPress={async () => {
                  h.medium();
                  setBioLoading(true);
                  try {
                    const ok = await triggerBiometricLogin();
                    if (!ok) Alert.alert('Face ID failed', 'Could not authenticate. Try your password.');
                  } finally {
                    setBioLoading(false);
                  }
                }}
                disabled={bioLoading}
                style={({ pressed }) => ({
                  marginTop: 12,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: pressed ? p.bgElev : p.pillBg,
                  borderWidth: 1,
                  borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                  opacity: bioLoading ? 0.7 : 1,
                })}
              >
                {bioLoading
                  ? <ActivityIndicator size="small" color={p.fg} />
                  : <Ionicons name="finger-print-outline" size={20} color={p.fg} />
                }
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                  {t('login.biometric')}
                </Text>
              </Pressable>
            )}

            {/* Demo helper — one tap to fill credentials */}
            <Pressable
              onPress={fillDemo}
              hitSlop={8}
              style={{
                marginTop: 18,
                alignSelf: 'center',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: p.border,
                backgroundColor: p.pillBg,
              }}
            >
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
                USE DEMO ACCOUNT
              </Text>
            </Pressable>

            {/* Footer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingBottom: 8 }}>
              <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('login.newTo')}</Text>
              <Pressable onPress={() => { h.selection(); router.push('/register'); }} hitSlop={6}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '800' }}>{t('login.create')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* 2FA prompt — opens when the server signals requires2FA on /auth/login */}
      <Modal
        visible={twoFAOpen}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!submitting) { setTwoFAOpen(false); setPendingCreds(null); } }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{ backgroundColor: p.bg, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: p.border }}>
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>
              Two-factor code
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>
              Open your authenticator app and enter the 6-digit code.
            </Text>
            <TextInput
              value={twoFACode}
              onChangeText={(v) => setTwoFACode(v.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              autoFocus
              maxLength={8}
              placeholder="123456"
              placeholderTextColor={p.fgFaint}
              style={{
                height: 56,
                borderRadius: 14,
                paddingHorizontal: 16,
                backgroundColor: p.bgElev,
                borderWidth: 1,
                borderColor: p.border,
                color: p.fg,
                fontSize: 22,
                fontWeight: '700',
                letterSpacing: 4,
                textAlign: 'center',
                marginBottom: 18,
                fontVariant: ['tabular-nums'],
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => { if (!submitting) { setTwoFAOpen(false); setPendingCreds(null); } }}
                style={{
                  flex: 1, height: 50, borderRadius: 25,
                  borderWidth: 1, borderColor: p.border, backgroundColor: p.pillBg,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit2FA}
                disabled={submitting || twoFACode.length < 6}
                style={{
                  flex: 1, height: 50, borderRadius: 25,
                  backgroundColor: p.ctaBg,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                  opacity: submitting || twoFACode.length < 6 ? 0.6 : 1,
                }}
              >
                {submitting && <ActivityIndicator size="small" color={p.ctaFg} />}
                <Text style={{ color: p.ctaFg, fontSize: 14, fontWeight: '800' }}>Verify</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ── Field ── */
function Field({
  label, value, onChangeText, onBlur, error, right, palette: p, ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onBlur?: () => void;
  error?: string;
  right?: React.ReactNode;
  palette: Palette;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View
        style={{
          height: 60,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingTop: value || focused ? 18 : 0,
          backgroundColor: p.bgElev,
          borderWidth: 1,
          borderColor: error ? p.redFg : focused ? p.fg : p.border,
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            position: 'absolute',
            left: 16,
            top: value || focused ? 10 : 20,
            color: p.fgMuted,
            fontSize: value || focused ? 11 : 15,
            fontWeight: '500',
          }}
        >
          {label}
        </Text>
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
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
      {error && (
        <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600', marginTop: 6, marginLeft: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
}

function extractErrorMessage(e: unknown): string {
  if (typeof e === 'object' && e !== null) {
    const ax = e as {
      response?: { status?: number; data?: { error?: string; message?: string } };
      message?: string;
      code?: string;
    };
    if (ax.code === 'ERR_NETWORK') {
      return 'Cannot reach the server. Check your connection.';
    }
    // The server returns 429 with a friendly message when an account is
    // locked out after too many failed attempts. Pass it through verbatim.
    if (ax.response?.status === 429) {
      return ax.response.data?.error ?? 'Too many attempts. Try again later.';
    }
    return ax.response?.data?.error ?? ax.response?.data?.message ?? ax.message ?? 'Please try again.';
  }
  return 'Please try again.';
}
