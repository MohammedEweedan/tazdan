/**
 * Register — multi-step sign-up.
 *
 *   Step 1 · Account details (name, email, phone, @handle, avatar, password, referral)
 *   Step 2 · Email verification (6-digit code)
 *   Step 3 · KYC documents
 *   Step 4 · All set
 *
 * Theme-aware. i18n-aware. No NativeWind classes — every style is inline so
 * the layout works the same on RN-Web and on real iOS / Android devices.
 * Mirrors the visual language of `login.tsx` and the web client register page.
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services';
import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette, type Palette, type ThemeMode } from '@/store/themeStore';
import { useI18n, LOCALE_META } from '@/store/i18nStore';
import { COUNTRIES, COUNTRY_BY_ISO, type Country } from '@/data/countries';
import { Modal, FlatList } from 'react-native';
import { TopGradient } from '@/components/ui/ScreenShell';

/* ── Schemas ─────────────────────────────────────── */

/**
 * 18+ check — server enforces this too, but we mirror it here for fast
 * client-side feedback.
 */
function isAdultDateString(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return d.getTime() <= cutoff.getTime();
}

const stepOneSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName:  z.string().min(1, 'Required'),
  email:     z.string().email('Enter a valid email'),
  country:   z.string().length(2, 'Select your country'),
  phone:     z.string().regex(/^\d{4,20}$/, 'Enter a valid phone number'),
  dateOfBirth: z.string().refine(isAdultDateString, 'You must be 18 or older (YYYY-MM-DD)'),
  password:  z.string().min(8, 'At least 8 characters'),
  username:  z.string().min(3, 'Handle is required (3+ chars)').regex(/^[a-z0-9._]+$/i, 'Handle: a-z 0-9 . _'),
  referralCode: z.string().optional(),
});
type StepOne = z.infer<typeof stepOneSchema>;

/* ── Emoji groups ────────────────────────────────── */

const EMOJI_GROUPS: Record<string, string[]> = {
  Cool: [
    '🔥','⚡','💀','☠️','👑','😈','😎','🫡','💯','🚀','🎯','🥷',
    '🦾','🔒','💸','🏴','⭐','✨','🌙','☄️','🪐','⚔️','🛡️','🏁',
  ],
  Animals: [
    '🦁','🐺','🦅','🦊','🐆','🐅','🦈','🐊','🐍','🦂','🕷','🐉',
    '🐎','🦌','🦍','🐘','🦏','🦓','🐪','🦜','🐬','🐳','👽','🦇',
  ],
  Faces: [
    '😎','😈','🤠','🫡','🥶','🥷','😏','😤','🤝','🫶','🖤','❤️',
    '💙','💚','💜','🤍','🩶','💛','🧠','👀','🫥','🫠','🤫','🧿',
  ],
  Symbols: [
    '👑','💎','💸','💯','🔒','⚡','🔥','⭐','✨','☠️','💀','🚀',
    '🎯','🏴','🏁','⚔️','🛡️','📿','🧿','🪬','🌍','☄️','🪐','🌊',
  ],
  Nature: [
    '☀️','🌙','☁️','❄️','🌊','🌴','🌵','🌍','🌎','🌏','🪐','☄️',
    '⭐','✨','🌊','🌴','🍂','🍁','🌸','🌹','🌺','🌻','🌼','🌿',
  ],
  Faith: [
    '📿','☪️','🕋','🤲','🙏','🧿','🪬','🕊️','🤍','🌙','⭐','☀️',
  ],
  Flags: [
    '🇱🇾','🇵🇸','🇸🇦','🇦🇪','🇪🇬','🇹🇳','🇩🇿','🇲🇦','🇹🇷','🇮🇹',
  ],
};

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
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [one, setOne] = useState<StepOne | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [emojiCategory, setEmojiCategory] = useState(Object.keys(EMOJI_GROUPS)[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const formOne = useForm<StepOne>({
    resolver: zodResolver(stepOneSchema),
    defaultValues: {
      firstName: '', lastName: '', email: '',
      country: '', phone: '', dateOfBirth: '',
      password: '', username: '', referralCode: '',
    },
  });

  const selectedCountryCode = formOne.watch('country') || 'LY';
  const selectedCountry: Country = COUNTRY_BY_ISO[selectedCountryCode] ?? COUNTRY_BY_ISO['LY'];

  const handleAvailable = (formOne.watch('username')?.length ?? 0) >= 3 && !/[^a-z0-9._]/i.test(formOne.watch('username') ?? '');

  const submitAccount = async (data: StepOne) => {
    setError('');
    if (!termsAccepted) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    if (!data.country || !COUNTRY_BY_ISO[data.country]) {
      setError('Please select your country.');
      return;
    }
    setSubmitting(true);
    try {
      h.medium();
      const { user } = await register({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        country: data.country,
        phoneCountryCode: COUNTRY_BY_ISO[data.country].dialCode,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth, // YYYY-MM-DD
        username: data.username,
        avatarUrl: avatarUrl || undefined,
        referralCode: data.referralCode || undefined,
      }, { skipStateUpdate: true });
      setOne(data);
      h.success();
      setStep(2);
    } catch (e: any) {
      h.error();
      setError(extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerification = async () => {
    setError('');
    if (verificationCode.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      await authService.verifyEmailCode(verificationCode);
      h.success();
      // Mark user as authenticated so AuthGate doesn't bounce them
      if (one) {
        setAuthenticated({
          id: '', email: one.email, firstName: one.firstName, lastName: one.lastName,
          avatarUrl, referralCode: '', kycStatus: 'NOT_SUBMITTED', kycTier: 'TIER_0',
          twoFactorEnabled: false, emailVerified: true, createdAt: new Date().toISOString(),
        });
      }
      setStep(3);
    } catch (e: any) {
      h.error();
      setError(extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    setError('');
    setSubmitting(true);
    try {
      await authService.resendVerification();
      setError('A new code has been sent to your email.');
    } catch (e: any) {
      setError(extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => {
    h.selection();
    setError('');
    if (step === 1) router.back();
    else setStep(((step - 1) as 1 | 2 | 3) as 1 | 2 | 3 | 4);
  };

  const skipKyc = () => setStep(4);
  const finishKyc = () => setStep(4);
  const goToDashboard = () => router.replace('/');
  const goVerifyPhone = () => router.push('/(auth)/verify-phone' as any);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
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
              {[1, 2, 3, 4].map((n) => (
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
                {step}/4
              </Text>
            </View>

            {/* ── Error banner ── */}
            {error !== '' && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                padding: 12, marginBottom: 16,
                backgroundColor: p.redFg + '14',
                borderWidth: 1, borderColor: p.redFg + '33',
                borderRadius: 12,
              }}>
                <Ionicons name="alert-circle" size={16} color={p.redFg} />
                <Text style={{ color: p.redFg, fontSize: 13, fontWeight: '600', flex: 1 }}>
                  {error}
                </Text>
              </View>
            )}

            {/* ── Steps ─────────────────────────────────── */}

            {step === 1 && (
              <View>
                <Text style={{ color: p.fg, fontSize: 30, fontWeight: '600', letterSpacing: -1 }}>
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
                  {/* Country selector — opens a modal list. Drives phone dial code. */}
                  <Controller
                    control={formOne.control}
                    name="country"
                    render={({ field: { value } }) => {
                      const c = COUNTRY_BY_ISO[value];
                      return (
                        <Pressable
                          onPress={() => { h.selection(); setShowCountryPicker(true); }}
                          style={{
                            height: 60,
                            borderRadius: 16,
                            paddingHorizontal: 16,
                            backgroundColor: p.bgElev,
                            borderWidth: 1,
                            borderColor: formOne.formState.errors.country ? p.redFg : p.border,
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{
                            position: 'absolute', left: 16, top: 10,
                            color: p.fgMuted, fontSize: 11, fontWeight: '500',
                          }}>
                            Country
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                            <Text style={{ fontSize: 18, marginRight: 8 }}>
                              {c?.flag ?? '🌐'}
                            </Text>
                            <Text style={{ color: c ? p.fg : p.fgFaint, fontSize: 16, fontWeight: '500', flex: 1 }}>
                              {c ? `${c.name}  +${c.dialCode}` : 'Select your country'}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color={p.fgMuted} />
                          </View>
                        </Pressable>
                      );
                    }}
                  />

                  {/* Phone with country dial-code prefix. */}
                  <Controller
                    control={formOne.control}
                    name="phone"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <View style={{
                        height: 60,
                        borderRadius: 16,
                        paddingHorizontal: 16,
                        backgroundColor: p.bgElev,
                        borderWidth: 1,
                        borderColor: formOne.formState.errors.phone ? p.redFg : p.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}>
                        <Text style={{
                          position: 'absolute', left: 16, top: 10,
                          color: p.fgMuted, fontSize: 11, fontWeight: '500',
                        }}>
                          Phone number
                        </Text>
                        <Text style={{
                          color: p.fgMuted, fontSize: 16, fontWeight: '600',
                          marginTop: 14, marginRight: 6,
                        }}>
                          +{selectedCountry.dialCode}
                        </Text>
                        <TextInput
                          value={value}
                          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
                          onBlur={onBlur}
                          keyboardType="phone-pad"
                          autoCorrect={false}
                          selectionColor={p.fg}
                          placeholderTextColor={p.fgFaint}
                          style={{
                            color: p.fg, fontSize: 16, fontWeight: '500',
                            flex: 1, marginTop: 14,
                          }}
                        />
                      </View>
                    )}
                  />
                  {formOne.formState.errors.phone && (
                    <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                      {formOne.formState.errors.phone.message as string}
                    </Text>
                  )}

                  {/* Date of birth (YYYY-MM-DD; manual entry to avoid native date-picker dep). */}
                  <Controller
                    control={formOne.control}
                    name="dateOfBirth"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="Date of birth (YYYY-MM-DD)"
                        value={value || ''}
                        onChangeText={(t) => {
                          // Auto-insert dashes for friendlier typing.
                          const digits = t.replace(/\D/g, '').slice(0, 8);
                          let out = digits;
                          if (digits.length > 4) out = `${digits.slice(0, 4)}-${digits.slice(4)}`;
                          if (digits.length > 6) out = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
                          onChange(out);
                        }}
                        onBlur={onBlur}
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        autoCorrect={false}
                        error={formOne.formState.errors.dateOfBirth?.message}
                        palette={p}
                      />
                    )}
                  />
                  <Controller
                    control={formOne.control}
                    name="username"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="@handle"
                        value={value || ''}
                        onChangeText={(t) => onChange(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                        onBlur={onBlur}
                        autoCapitalize="none"
                        autoCorrect={false}
                        error={formOne.formState.errors.username?.message}
                        palette={p}
                        right={
                          (value?.length ?? 0) >= 3 ? (
                            <Ionicons
                              name={handleAvailable ? 'checkmark-circle' : 'close-circle'}
                              size={18}
                              color={handleAvailable ? p.greenFg : p.redFg}
                            />
                          ) : undefined
                        }
                      />
                    )}
                  />

                  {/* Avatar picker */}
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
                      Choose an avatar
                    </Text>
                    {/* Category pills */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {Object.keys(EMOJI_GROUPS).map((cat) => {
                        const active = emojiCategory === cat;
                        return (
                          <Pressable
                            key={cat}
                            onPress={() => setEmojiCategory(cat)}
                            style={{
                              paddingHorizontal: 14, paddingVertical: 8,
                              borderRadius: 999,
                              backgroundColor: active ? p.fg : p.bgElev,
                              borderWidth: 1, borderColor: active ? p.fg : p.border,
                            }}
                          >
                            <Text style={{
                              color: active ? (themeMode !== 'light' ? '#0f172a' : '#fff') : p.fg,
                              fontSize: 12, fontWeight: '700',
                            }}>
                              {cat}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    {/* Emoji grid */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {EMOJI_GROUPS[emojiCategory].map((emoji) => (
                        <Pressable
                          key={emoji}
                          onPress={() => { h.selection(); setAvatarUrl(emoji); }}
                          style={{
                            width: 46, height: 46, borderRadius: 12,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: avatarUrl === emoji ? p.fg : p.bgElev,
                            borderWidth: 1.5,
                            borderColor: avatarUrl === emoji ? p.fg : p.border,
                          }}
                        >
                          <Text style={{ fontSize: 22 }}>{emoji}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

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
                  <Controller
                    control={formOne.control}
                    name="referralCode"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Field
                        label="Referral code (optional)"
                        value={value || ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="none"
                        autoCorrect={false}
                        palette={p}
                      />
                    )}
                  />
                </View>

                {/* Terms checkbox */}
                <Pressable
                  onPress={() => { h.selection(); setTermsAccepted((s) => !s); }}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20 }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 6,
                    borderWidth: 1.5, borderColor: termsAccepted ? p.fg : p.border,
                    backgroundColor: termsAccepted ? p.fg : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {termsAccepted && <Ionicons name="checkmark" size={14} color={themeMode !== 'light' ? '#0f172a' : '#fff'} />}
                  </View>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 20 }}>
                    I agree to the Terms of Service and Privacy Policy.
                  </Text>
                </Pressable>

                <PrimaryCTA
                  palette={p}
                  themeMode={themeMode}
                  label={submitting ? 'Creating account…' : 'Continue'}
                  onPress={formOne.handleSubmit((v) => { h.medium(); submitAccount(v); }, () => h.error())}
                  loading={submitting}
                />
              </View>
            )}

            {/* ── Step 2 · Email verification ── */}
            {step === 2 && (
              <View>
                <Text style={{ color: p.fg, fontSize: 30, fontWeight: '600', letterSpacing: -1 }}>
                  Verify your email
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
                  Enter the 6-digit code we sent to{' '}
                  <Text style={{ color: p.fg, fontWeight: '600' }}>{one?.email}</Text>
                </Text>

                <View style={{ marginTop: 26 }}>
                  <Field
                    label="6-digit code"
                    value={verificationCode}
                    onChangeText={(t) => setVerificationCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    palette={p}
                  />
                </View>

                <PrimaryCTA
                  palette={p}
                  themeMode={themeMode}
                  label={submitting ? 'Verifying…' : 'Verify'}
                  onPress={submitVerification}
                  loading={submitting}
                />

                <Pressable onPress={resendCode} style={{ alignSelf: 'center', marginTop: 14 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>
                    Didn't receive it? Resend →
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ── Step 3 · KYC ── */}
            {step === 3 && (
              <View>
                <Text style={{ color: p.fg, fontSize: 30, fontWeight: '600', letterSpacing: -1 }}>
                  Verify your identity
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
                  Required for trading, card issuance and withdrawals. Upload ID + selfie to complete KYC.
                </Text>

                <View style={{ marginTop: 26, gap: 12 }}>
                  {[
                    { icon: 'card', label: 'ID Front', hint: 'Passport, national ID or driver\'s license' },
                    { icon: 'image', label: 'ID Back', hint: 'Back side of the same document' },
                    { icon: 'camera', label: 'Selfie with ID', hint: 'Hold your ID next to your face, good lighting' },
                  ].map((doc) => (
                    <View key={doc.label} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 14, borderRadius: 16,
                      backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                    }}>
                      <View style={{
                        width: 40, height: 40, borderRadius: 12,
                        backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name={doc.icon as any} size={18} color={p.fgMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{doc.label}</Text>
                        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>{doc.hint}</Text>
                      </View>
                      <Ionicons name="cloud-upload-outline" size={18} color={p.fgMuted} />
                    </View>
                  ))}
                </View>

                <PrimaryCTA
                  palette={p}
                  themeMode={themeMode}
                  label="Submit for review"
                  onPress={finishKyc}
                />

                <Pressable onPress={skipKyc} style={{ alignSelf: 'center', marginTop: 14 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>
                    Skip for now →
                  </Text>
                </Pressable>
              </View>
            )}

            {/* ── Step 4 · All set ── */}
            {step === 4 && (
              <View style={{ alignItems: 'center', paddingTop: 24, gap: 20 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: p.pillBg, borderWidth: 1.5, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="checkmark-circle" size={36} color={p.fg} />
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: p.fg, fontSize: 28, fontWeight: '600', letterSpacing: -0.8 }}>
                    You're all set.
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center', maxWidth: 340 }}>
                    Your KYC is being reviewed. You'll get a notification once it's approved — usually within a few hours.
                  </Text>
                </View>
                <PrimaryCTA
                  palette={p}
                  themeMode={themeMode}
                  label="Verify phone number"
                  onPress={goVerifyPhone}
                />
                <Pressable
                  onPress={goToDashboard}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 4 })}
                >
                  <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>
                    Skip for now
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Footer — always visible */}
            {step === 1 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                marginTop: 28, paddingBottom: 8,
              }}>
                <Text style={{ color: p.fgMuted, fontSize: 14 }}>Have an account? </Text>
                <Pressable onPress={() => router.replace('/login')} hitSlop={6}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>Log in</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Country picker modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <Pressable
          onPress={() => setShowCountryPicker(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: p.bg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              maxHeight: '80%', paddingTop: 12,
            }}
          >
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <Text style={{
              color: p.fg, fontSize: 18, fontWeight: '600',
              paddingHorizontal: 20, paddingVertical: 12,
            }}>
              Select your country
            </Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = selectedCountryCode === item.code;
                return (
                  <Pressable
                    onPress={() => {
                      h.selection();
                      formOne.setValue('country', item.code, { shouldValidate: true });
                      setShowCountryPicker(false);
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 20, paddingVertical: 14,
                      backgroundColor: active ? p.pillBg : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 22, marginRight: 14 }}>{item.flag}</Text>
                    <Text style={{ color: p.fg, fontSize: 16, fontWeight: '500', flex: 1 }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600' }}>
                      +{item.dialCode}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark" size={18} color={p.fg} style={{ marginLeft: 10 }} />
                    )}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── Reusable themed CTA ─────────────────────────── */
function PrimaryCTA({
  palette: p, themeMode, label, onPress, loading, disabled,
}: {
  palette: Palette;
  themeMode: ThemeMode;
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
        alignSelf: 'stretch',
        width: '100%',
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
      <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 }}>
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
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad' | 'number-pad';
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
