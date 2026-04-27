/**
 * Register — multi-step sign-up.
 *
 *   Step 1 · Name + email + password
 *   Step 2 · Phone + country
 *   Step 3 · Pick @handle
 *
 * Theme-aware. i18n-aware. No NativeWind classes — every style is inline so
 * the layout works the same on RN-Web and on real iOS / Android devices.
 * Mirrors the visual language of `login.tsx`.
 */

import { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useI18n, LOCALE_META } from '@/store/i18nStore';

/* ── Schemas ─────────────────────────────────────── */

const stepOneSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName:  z.string().min(1, 'Required'),
  email:     z.string().email('Enter a valid email'),
  password:  z.string().min(8, 'At least 8 characters'),
});
type StepOne = z.infer<typeof stepOneSchema>;

const stepTwoSchema = z.object({
  phone:   z.string().min(6, 'Required'),
  country: z.string().length(2, 'ISO-2 country code'),
});
type StepTwo = z.infer<typeof stepTwoSchema>;

/* ── Component ────────────────────────────────────── */

export default function Register() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const locale = useI18n((s) => s.locale);
  const cycleLocale = useI18n((s) => s.cycle);
  const register = useAuthStore((s) => s.register);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [one, setOne] = useState<StepOne | null>(null);
  const [, setTwo] = useState<StepTwo | null>(null);
  const [handle, setHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const formOne = useForm<StepOne>({
    resolver: zodResolver(stepOneSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });
  const formTwo = useForm<StepTwo>({
    resolver: zodResolver(stepTwoSchema),
    defaultValues: { phone: '', country: 'AE' },
  });

  const handleAvailable = handle.length >= 3 && !/[^a-z0-9._]/i.test(handle);

  const submitAll = async () => {
    if (!one || !handleAvailable) return;
    try {
      setSubmitting(true);
      h.medium();
      await register({
        email: one.email.trim().toLowerCase(),
        password: one.password,
        firstName: one.firstName.trim(),
        lastName: one.lastName.trim(),
        username: handle,        // becomes the public @handle, profile is public by default
      });
      h.success();
      // AuthGate redirects to /
    } catch (e) {
      h.error();
      Alert.alert('Sign up failed', extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => {
    h.selection();
    if (step === 1) router.back();
    else setStep((step - 1) as 1 | 2);
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
              paddingTop: 4, marginBottom: 18,
            }}>
              <Pressable
                onPress={back}
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

            {/* ── Step indicator ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 }}>
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  style={{
                    height: 6,
                    flex: step === n ? 2 : 1,
                    borderRadius: 3,
                    backgroundColor: step >= n ? p.fg : p.border,
                  }}
                />
              ))}
              <Text style={{
                color: p.fgMuted, fontSize: 11, fontWeight: '700',
                letterSpacing: 0.6, marginLeft: 6,
              }}>
                {step}/3
              </Text>
            </View>

            {/* ── Steps ─────────────────────────────────── */}
            {step === 1 && (
              <View>
                <Text style={{ color: p.fg, fontSize: 30, fontWeight: '800', letterSpacing: -1 }}>
                  Create your account
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
                  All money. One place. Trade across 120+ markets in seconds.
                </Text>

                <View style={{ marginTop: 26, gap: 12 }}>
                  <Controller
                    control={formOne.control}
                    name="firstName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="First name"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="words"
                        error={formOne.formState.errors.firstName?.message}
                        palette={p}
                      />
                    )}
                  />
                  <Controller
                    control={formOne.control}
                    name="lastName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="Last name"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="words"
                        error={formOne.formState.errors.lastName?.message}
                        palette={p}
                      />
                    )}
                  />
                  <Controller
                    control={formOne.control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="Email"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        error={formOne.formState.errors.email?.message}
                        palette={p}
                      />
                    )}
                  />
                  <Controller
                    control={formOne.control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="Password"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        secureTextEntry={!showPw}
                        autoCapitalize="none"
                        autoCorrect={false}
                        error={formOne.formState.errors.password?.message}
                        palette={p}
                        right={
                          <Pressable hitSlop={8} onPress={() => { h.selection(); setShowPw((s) => !s); }}>
                            <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={p.fgMuted} />
                          </Pressable>
                        }
                      />
                    )}
                  />
                </View>

                <PrimaryCTA
                  palette={p}
                  themeMode={themeMode}
                  label="Continue"
                  onPress={formOne.handleSubmit((v) => { h.medium(); setOne(v); setStep(2); }, () => h.error())}
                />
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={{ color: p.fg, fontSize: 30, fontWeight: '800', letterSpacing: -1 }}>
                  A bit about you
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
                  We need this to comply with local regulations.
                </Text>

                <View style={{ marginTop: 26, gap: 12 }}>
                  <Controller
                    control={formTwo.control}
                    name="phone"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="Phone number"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="phone-pad"
                        error={formTwo.formState.errors.phone?.message}
                        palette={p}
                      />
                    )}
                  />
                  <Controller
                    control={formTwo.control}
                    name="country"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="Country (ISO-2 e.g. AE)"
                        value={value}
                        onChangeText={(t) => onChange(t.toUpperCase())}
                        onBlur={onBlur}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        error={formTwo.formState.errors.country?.message}
                        palette={p}
                      />
                    )}
                  />
                </View>

                <PrimaryCTA
                  palette={p}
                  themeMode={themeMode}
                  label="Continue"
                  onPress={formTwo.handleSubmit((v) => { h.medium(); setTwo(v); setStep(3); }, () => h.error())}
                />
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={{ color: p.fg, fontSize: 30, fontWeight: '800', letterSpacing: -1 }}>
                  Pick your @handle
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
                  Friends will pay you with this. Letters, numbers, dot, underscore.
                </Text>

                <View style={{ marginTop: 26 }}>
                  <Field
                    label="Handle"
                    value={handle}
                    onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    palette={p}
                    right={
                      handle.length >= 3 ? (
                        <Ionicons
                          name={handleAvailable ? 'checkmark-circle' : 'close-circle'}
                          size={18}
                          color={handleAvailable ? p.greenFg : p.redFg}
                        />
                      ) : undefined
                    }
                  />
                </View>

                <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 10, marginLeft: 4 }}>
                  Preview:{' '}
                  <Text style={{ color: p.fg, fontWeight: '800' }}>@{handle || 'yourname'}</Text>
                </Text>

                <PrimaryCTA
                  palette={p}
                  themeMode={themeMode}
                  label={submitting ? 'Creating account…' : 'Finish'}
                  onPress={submitAll}
                  loading={submitting}
                  disabled={!handleAvailable || submitting}
                />
              </View>
            )}

            {/* Footer — always visible */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              marginTop: 28, paddingBottom: 8,
            }}>
              <Text style={{ color: p.fgMuted, fontSize: 14 }}>Have an account? </Text>
              <Pressable onPress={() => router.replace('/login')} hitSlop={6}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '800' }}>Log in</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ── Reusable themed CTA ─────────────────────────── */
function PrimaryCTA({
  palette: p, themeMode, label, onPress, loading, disabled,
}: {
  palette: Palette;
  themeMode: 'dark' | 'light';
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        marginTop: 28,
        height: 58, minHeight: 58,
        borderRadius: 29,
        backgroundColor: p.ctaBg,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 4,
      })}
    >
      {loading && <ActivityIndicator size="small" color={p.ctaFg} />}
      {!loading && <Ionicons name="arrow-forward" size={18} color={p.ctaFg} />}
      <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Floating-label field (matches login.tsx) ──── */
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
    const ax = e as { response?: { data?: { error?: string; message?: string } }; message?: string; code?: string };
    if (ax.code === 'ERR_NETWORK') return 'Cannot reach the server. Make sure the backend is running on port 5001 and your phone is on the same network.';
    return ax.response?.data?.error ?? ax.response?.data?.message ?? ax.message ?? 'Please try again.';
  }
  return 'Please try again.';
}
