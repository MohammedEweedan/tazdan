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

import { useState, useEffect } from 'react';
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
import { authService, profileService } from '@/services';
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
/**
 * Parse a `dd/mm/yyyy` string into a Date, rejecting impossible dates
 * (e.g. 31/02/2000). Returns null if the string is malformed or invalid.
 */
function parseDdMmYyyy(dob: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Reject roll-over (e.g. 31/02 → 03 March): the components must round-trip.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/** dd/mm/yyyy → YYYY-MM-DD for the API (which expects an ISO date). */
function ddMmYyyyToIso(dob: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dob);
  if (!m) return dob;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isAdultDateString(dob: string): boolean {
  const d = parseDdMmYyyy(dob);
  if (!d) return false;
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
  dateOfBirth: z.string().refine(isAdultDateString, 'You must be 18 or older (dd/mm/yyyy)'),
  password:  z.string().min(8, 'At least 8 characters'),
  username:  z.string().min(3, 'Handle is required (3+ chars)').regex(/^[a-z0-9._]+$/i, 'Handle: a-z 0-9 . _'),
  referralCode: z.string().optional(),
});
type StepOne = z.infer<typeof stepOneSchema>;

/* ── Emoji groups ────────────────────────────────── */

const EMOJI_GROUPS: Record<string, string[]> = {
  // Brand-first — the tazdan asterisk leads, on-identity for an avatar.
  Brand: [
    '✳️','✴️','❇️','✨','⭐','🌟','💠','🔷','🔹','🔵','💙','🩵',
  ],
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
    '🎯','🏴','🏁','⚔️','🛡️','🌍','☄️','🪐','🌊','💠','🔷','✳️',
  ],
  Nature: [
    '☀️','🌙','☁️','❄️','🌊','🌴','🌵','🌍','🌎','🌏','🪐','☄️',
    '⭐','✨','🌅','🏔️','🍂','🍁','🌸','🌹','🌺','🌻','🌼','🌿',
  ],
  // Comprehensive flag set — MENA-first, then major world flags. Deliberately
  // excludes the rainbow/pride flag per brand request.
  Flags: [
    '🇱🇾','🇵🇸','🇸🇦','🇦🇪','🇪🇬','🇹🇳','🇩🇿','🇲🇦','🇶🇦','🇰🇼',
    '🇧🇭','🇴🇲','🇯🇴','🇱🇧','🇮🇶','🇸🇾','🇾🇪','🇸🇩','🇲🇷','🇸🇴',
    '🇹🇷','🇮🇷','🇵🇰','🇮🇳','🇧🇩','🇮🇩','🇲🇾','🇳🇬','🇿🇦','🇪🇹',
    '🇬🇧','🇺🇸','🇨🇦','🇫🇷','🇩🇪','🇮🇹','🇪🇸','🇳🇱','🇸🇪','🇨🇭',
    '🇧🇷','🇲🇽','🇦🇷','🇯🇵','🇰🇷','🇨🇳','🇷🇺','🇦🇺','🇶🇦','🏴',
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
  // The REAL user the server created (correct id + @handle). We keep this so
  // that after email verification we authenticate with the actual account —
  // not a hand-built object missing the username (which clobbered the cached
  // profile and made the @handle vanish on reload).
  const [registeredUser, setRegisteredUser] = useState<import('@/types').User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [emojiCategory, setEmojiCategory] = useState(Object.keys(EMOJI_GROUPS)[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLegal, setShowLegal] = useState<null | 'terms' | 'privacy'>(null);

  const formOne = useForm<StepOne>({
    resolver: zodResolver(stepOneSchema),
    defaultValues: {
      firstName: '', lastName: '', email: '',
      country: 'LY', phone: '', dateOfBirth: '',
      password: '', username: '', referralCode: '',
    },
  });

  const selectedCountryCode = formOne.watch('country') || 'LY';
  const selectedCountry: Country = COUNTRY_BY_ISO[selectedCountryCode] ?? COUNTRY_BY_ISO['LY'];

  const usernameValue = formOne.watch('username') ?? '';
  const usernameFormatOk = usernameValue.length >= 3 && !/[^a-z0-9._]/i.test(usernameValue);

  // Real-time @handle availability. Handles are public (the /profile/:handle
  // route is a discovery endpoint), so checking them is NOT a user-enumeration
  // leak — unlike email/phone, which the server deliberately keeps opaque
  // (generic "already in use" error) to defeat credential-stuffing. We debounce
  // and treat a 404 as "available", a 200 as "taken".
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  useEffect(() => {
    if (!usernameFormatOk) { setHandleStatus('idle'); return; }
    let cancelled = false;
    setHandleStatus('checking');
    const t = setTimeout(async () => {
      try {
        await profileService.byHandle(usernameValue.toLowerCase());
        if (!cancelled) setHandleStatus('taken');      // profile found → taken
      } catch (e: any) {
        if (cancelled) return;
        // 404 → nobody has it → available. Other errors → don't block; treat as available.
        setHandleStatus('available');
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [usernameValue, usernameFormatOk]);

  const handleAvailable = usernameFormatOk && handleStatus === 'available';

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
        dateOfBirth: ddMmYyyyToIso(data.dateOfBirth), // dd/mm/yyyy → YYYY-MM-DD for the API
        username: data.username,
        avatarUrl: avatarUrl || undefined,
        referralCode: data.referralCode || undefined,
      }, { skipStateUpdate: true });
      setOne(data);
      setRegisteredUser(user);   // keep the real account (id + @handle)
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
      // Authenticate with the REAL server account (correct id + @handle), not
      // a fabricated object — that's what made the @handle disappear on reload.
      // Fall back to a soft object only if, somehow, we don't have it.
      if (registeredUser) {
        setAuthenticated({ ...registeredUser, emailVerified: true });
      } else if (one) {
        setAuthenticated({
          id: '', email: one.email, firstName: one.firstName, lastName: one.lastName,
          username: one.username, avatarUrl, referralCode: '', kycStatus: 'NOT_SUBMITTED', kycTier: 'TIER_0',
          twoFactorEnabled: false, emailVerified: true, createdAt: new Date().toISOString(),
        } as any);
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
                    backgroundColor: step >= n ? p.accent : p.border,
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
                  {/* Password sits with the credentials (email + password), not
                      buried at the end of the form. */}
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

                  {/* Date of birth — opens a wheel picker; must be 18+ (enforced
                      in the picker and again by the schema). */}
                  <Controller
                    control={formOne.control}
                    name="dateOfBirth"
                    render={({ field: { value } }) => {
                      const hasValue = !!value;
                      const underage = hasValue && !isAdultDateString(value);
                      return (
                        <>
                          <Pressable
                            onPress={() => { h.selection(); setShowDatePicker(true); }}
                            style={{
                              height: 60, borderRadius: 16, paddingHorizontal: 16,
                              backgroundColor: p.bgElev,
                              borderWidth: 1,
                              borderColor: (formOne.formState.errors.dateOfBirth || underage) ? p.redFg : (hasValue ? p.accent : p.border),
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ position: 'absolute', left: 16, top: 10, color: p.fgMuted, fontSize: 11, fontWeight: '500' }}>
                              Date of birth
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
                              <Ionicons name="calendar-outline" size={16} color={p.fgMuted} style={{ marginRight: 8 }} />
                              <Text style={{ color: hasValue ? p.fg : p.fgFaint, fontSize: 16, fontWeight: '500', flex: 1 }}>
                                {hasValue ? value : 'Select your date of birth'}
                              </Text>
                              <Ionicons name="chevron-down" size={18} color={p.fgMuted} />
                            </View>
                          </Pressable>
                          {(underage || formOne.formState.errors.dateOfBirth) && (
                            <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                              {underage ? 'You must be 18 or older to use tazdan.' : (formOne.formState.errors.dateOfBirth?.message as string)}
                            </Text>
                          )}
                        </>
                      );
                    }}
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
                        error={
                          formOne.formState.errors.username?.message ??
                          (usernameFormatOk && handleStatus === 'taken' ? 'That @handle is taken — try another.' : undefined)
                        }
                        palette={p}
                        right={
                          (value?.length ?? 0) >= 3 ? (
                            handleStatus === 'checking'
                              ? <ActivityIndicator size="small" color={p.fgMuted} />
                              : handleStatus === 'available'
                                ? <Ionicons name="checkmark-circle" size={18} color={p.greenFg} />
                                : handleStatus === 'taken'
                                  ? <Ionicons name="close-circle" size={18} color={p.redFg} />
                                  : undefined
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
                              backgroundColor: active ? p.accent : p.bgElev,
                              borderWidth: 1, borderColor: active ? p.accent : p.border,
                            }}
                          >
                            <Text style={{
                              color: active ? p.accentFg : p.fg,
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
                            backgroundColor: avatarUrl === emoji ? p.accentSoft : p.bgElev,
                            borderWidth: 1.5,
                            borderColor: avatarUrl === emoji ? p.accent : p.border,
                          }}
                        >
                          <Text style={{ fontSize: 22 }}>{emoji}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

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

                {/* Terms — the checkbox toggles consent; the two links open
                    readable modals so the user can actually read before agreeing. */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20 }}>
                  <Pressable
                    onPress={() => { h.selection(); setTermsAccepted((s) => !s); }}
                    hitSlop={8}
                    style={{
                      width: 22, height: 22, borderRadius: 6, marginTop: 1,
                      borderWidth: 1.5, borderColor: termsAccepted ? p.accent : p.border,
                      backgroundColor: termsAccepted ? p.accent : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {termsAccepted && <Ionicons name="checkmark" size={14} color={p.accentFg} />}
                  </Pressable>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 20 }}>
                    I agree to the{' '}
                    <Text
                      onPress={() => { h.selection(); setShowLegal('terms'); }}
                      style={{ color: p.accentText, fontWeight: '700' }}
                    >
                      Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text
                      onPress={() => { h.selection(); setShowLegal('privacy'); }}
                      style={{ color: p.accentText, fontWeight: '700' }}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </View>

                <PrimaryCTA
                  palette={p}
                  themeMode={themeMode}
                  label={submitting ? 'Creating account…' : 'Continue'}
                  onPress={formOne.handleSubmit((v) => { h.medium(); submitAccount(v); }, () => h.error())}
                  loading={submitting}
                  disabled={submitting || handleStatus === 'taken' || handleStatus === 'checking'}
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

      {/* Date-of-birth wheel picker (18+ enforced) */}
      <DatePickerModal
        visible={showDatePicker}
        palette={p}
        initial={formOne.getValues('dateOfBirth')}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(ddmmyyyy) => {
          formOne.setValue('dateOfBirth', ddmmyyyy, { shouldValidate: true });
          setShowDatePicker(false);
        }}
      />

      {/* Readable Terms / Privacy modal */}
      <LegalModal
        kind={showLegal}
        palette={p}
        onClose={() => setShowLegal(null)}
        onAgree={() => { setTermsAccepted(true); setShowLegal(null); }}
      />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Date-of-birth picker — self-contained scrollable day / month / year
   wheels (no native datetimepicker dependency). Enforces 18+: the year
   column only offers years that make the user at least 18.
   ════════════════════════════════════════════════════════════════════ */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ITEM_H = 44;

function DatePickerModal({
  visible, palette: p, initial, onClose, onConfirm,
}: {
  visible: boolean;
  palette: Palette;
  initial?: string;
  onClose: () => void;
  onConfirm: (ddmmyyyy: string) => void;
}) {
  const now = new Date();
  const maxYear = now.getFullYear() - 18;          // newest allowed birth year (turns 18 this year)
  const minYear = now.getFullYear() - 100;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i); // desc

  // Seed from the existing value (dd/mm/yyyy) or a sensible default (~25yo).
  const seed = parseDdMmYyyy(initial ?? '') ?? new Date(maxYear - 7, 0, 1);
  const [day, setDay]     = useState(seed.getDate());
  const [month, setMonth] = useState(seed.getMonth()); // 0-based
  const [year, setYear]   = useState(seed.getFullYear());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const safeDay = Math.min(day, daysInMonth);

  const Column = ({ data, selected, onSelect, width, fmt }: {
    data: number[]; selected: number; onSelect: (v: number) => void; width: number; fmt?: (v: number) => string;
  }) => (
    <ScrollView
      style={{ width, height: ITEM_H * 5 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
    >
      {data.map((v) => {
        const on = v === selected;
        return (
          <Pressable key={v} onPress={() => onSelect(v)} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{
              color: on ? p.accentText : p.fgMuted,
              fontSize: on ? 20 : 16,
              fontWeight: on ? '800' : '500',
              fontVariant: ['tabular-nums'],
            }}>
              {fmt ? fmt(v) : v}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28 }}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', paddingHorizontal: 20, paddingBottom: 4 }}>
            Date of birth
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, paddingHorizontal: 20, paddingBottom: 8 }}>
            You must be 18 or older to use tazdan.
          </Text>
          {/* Wheels with a centered selection band */}
          <View style={{ position: 'relative', flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 20 }}>
            <View pointerEvents="none" style={{
              position: 'absolute', left: 20, right: 20, top: ITEM_H * 2, height: ITEM_H,
              borderRadius: 12, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder,
            }} />
            <Column data={days} selected={safeDay} onSelect={setDay} width={64} />
            <Column data={MONTHS.map((_, i) => i)} selected={month} onSelect={setMonth} width={88} fmt={(i) => MONTHS[i]} />
            <Column data={years} selected={year} onSelect={setYear} width={88} />
          </View>
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Pressable
              onPress={() => {
                const dd = String(safeDay).padStart(2, '0');
                const mm = String(month + 1).padStart(2, '0');
                onConfirm(`${dd}/${mm}/${year}`);
              }}
              style={({ pressed }) => ({
                height: 54, borderRadius: 27, backgroundColor: p.accent,
                alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: p.accentFg, fontSize: 16, fontWeight: '700' }}>Confirm</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Legal modal — readable Terms / Privacy summary with an Agree button so
   the user can actually read before consenting.
   ════════════════════════════════════════════════════════════════════ */

function LegalModal({
  kind, palette: p, onClose, onAgree,
}: {
  kind: null | 'terms' | 'privacy';
  palette: Palette;
  onClose: () => void;
  onAgree: () => void;
}) {
  if (!kind) return null;
  const isTerms = kind === 'terms';
  const title = isTerms ? 'Terms of Service' : 'Privacy Policy';
  const url = isTerms ? 'https://tazdan.com/legal/terms' : 'https://tazdan.com/legal/privacy';
  const sections = isTerms ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingBottom: 24 }}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '700' }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={16} color={p.fg} />
            </Pressable>
          </View>
          <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            {sections.map((s) => (
              <View key={s.h} style={{ marginTop: 16 }}>
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>{s.h}</Text>
                <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 21 }}>{s.b}</Text>
              </View>
            ))}
            <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 18 }}>
              This is a summary. Read the full {title.toLowerCase()} at {url}.
            </Text>
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <Pressable
              onPress={onAgree}
              style={({ pressed }) => ({ height: 54, borderRadius: 27, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={{ color: p.accentFg, fontSize: 16, fontWeight: '700' }}>I've read & agree</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const TERMS_SECTIONS = [
  { h: '1. Who we are', b: 'tazdan provides a wallet, crypto buy/sell, transfers, a card, and P2P trading for the markets we serve. By creating an account you agree to these terms.' },
  { h: '2. Eligibility', b: 'You must be at least 18 and legally able to use financial services in your country. You agree to complete identity verification (KYC) where required.' },
  { h: '3. Your account', b: 'Keep your credentials safe. You are responsible for activity on your account. We may apply limits, request verification, or pause activity to protect you and the platform.' },
  { h: '4. Money & risk', b: 'Crypto prices move and can lose value. FX and parallel-market rates are shown transparently with a disclosed spread; you transact at the displayed rate at the time of the order.' },
  { h: '5. Fees', b: 'Applicable spreads and fees are shown before you confirm any transaction. You agree to the fees displayed at confirmation time.' },
  { h: '6. Prohibited use', b: 'No fraud, money laundering, sanctions evasion, or illegal activity. We may report and freeze activity as required by law.' },
  { h: '7. Changes', b: 'We may update these terms; continued use means you accept the changes. Material changes will be communicated in-app or by email.' },
];

const PRIVACY_SECTIONS = [
  { h: '1. What we collect', b: 'Account details (name, email, phone), identity documents for KYC, device info, and transaction history needed to operate a regulated money service.' },
  { h: '2. How we use it', b: 'To run your account, verify your identity, prevent fraud, meet legal/AML obligations, and improve the product. We do not sell your personal data.' },
  { h: '3. Who we share with', b: 'Trusted providers that power the app (identity verification, payments, custody, analytics) under strict agreements, and authorities where the law requires.' },
  { h: '4. Security', b: 'Funds sit on a conservation-checked ledger; custody keys are hardware-encrypted; sensitive actions require step-up verification. No system is perfect — keep your device and credentials secure.' },
  { h: '5. Your rights', b: 'You can access, correct, or request deletion of your data subject to legal retention requirements. Contact support to exercise these rights.' },
  { h: '6. Retention', b: 'We keep records as long as needed to provide the service and to satisfy financial-regulatory retention rules.' },
];

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
          borderColor: error ? p.redFg : focused ? p.accentText : p.border,
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
    if (ax.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection and try again.';
    return ax.response?.data?.error ?? ax.response?.data?.message ?? ax.message ?? 'Please try again.';
  }
  return 'Please try again.';
}
