import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';

import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { LocalePickerModal } from '@/components/ui/LocalePickerModal';

function extractErrorMessage(e: unknown): string {
  if (typeof e === 'object' && e !== null) {
    const ax = e as { response?: { data?: { error?: string; message?: string } }; message?: string; code?: string };
    if (ax.code === 'ERR_NETWORK') return 'Cannot reach the server. Make sure the backend is running and your phone is on the same network.';
    return ax.response?.data?.error ?? ax.response?.data?.message ?? ax.message ?? 'Please try again.';
  }
  return 'Please try again.';
}

export default function WelcomeBack() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const t = useT();
  const lastUser = useAuthStore((s) => s.lastUser);
  const login = useAuthStore((s) => s.login);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const triggerBiometricLogin = useAuthStore((s) => s.triggerBiometricLogin);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);

  useEffect(() => {
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]).then(([hardware, enrolled]) => setBioAvailable(hardware && enrolled)).catch(() => setBioAvailable(false));
  }, []);

  useEffect(() => {
    if (!lastUser) router.replace('/(auth)/login');
  }, [lastUser, router]);

  if (!lastUser) return null;

  const handle = lastUser.username ?? lastUser.email.split('@')[0] ?? 'there';
  const fullName = `${lastUser.firstName ?? ''} ${lastUser.lastName ?? ''}`.trim() || `@${handle}`;
  const initial = (lastUser.firstName?.[0] ?? lastUser.email?.[0] ?? 'P').toUpperCase();

  const submitPassword = async () => {
    if (!password) {
      h.error();
      Alert.alert(t('common.password'), t('auth.loginHint'));
      return;
    }
    try {
      setSubmitting(true);
      await login(lastUser.email.trim().toLowerCase(), password);
      h.success();
    } catch (e) {
      h.error();
      Alert.alert(t('login.failed'), extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitBiometric = async (label: string) => {
    h.medium();
    setBioLoading(true);
    try {
      const ok = await triggerBiometricLogin();
      if (!ok) Alert.alert(`${label} failed`, t('auth.biometricFailed'));
    } catch (e: any) {
      h.error();
      if (e?.code === 'SESSION_EXPIRED') {
        Alert.alert(t('auth.sessionExpired'), t('auth.sessionExpiredDesc'));
      } else {
        Alert.alert(`${label} failed`, t('auth.biometricFailed'));
      }
    } finally {
      setBioLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Globe button top-right */}
          <Pressable
            onPress={() => { h.selection(); setLangPickerVisible(true); }}
            hitSlop={12}
            style={{ position: 'absolute', top: 16, right: 20, zIndex: 10, padding: 6 }}
          >
            <Ionicons name="globe-outline" size={22} color={p.fgMuted} />
          </Pressable>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32, justifyContent: 'center' }}
          >
            <View style={{ alignItems: 'center' }}>
              <Image source={require('../../assets/icon-color.png')} style={{ width: 54, height: 54 }} resizeMode="contain" />
              <View style={{
                marginTop: 28, width: 104, height: 104, borderRadius: 52,
                backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {lastUser.avatarUrl ? (
                  <Text style={{ fontSize: 44 }}>{lastUser.avatarUrl}</Text>
                ) : (
                  <Text style={{ color: p.fg, fontSize: 38, fontWeight: '800' }}>{initial}</Text>
                )}
              </View>
              <Text style={{ color: p.fg, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 22, textAlign: 'center' }}>
                {t('auth.welcomeBack', { handle })}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>
                {fullName}
              </Text>
              <Text style={{ color: p.fgFaint, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                {t('auth.loginHint')}
              </Text>
            </View>

            <View style={{ marginTop: 34 }}>
              <View style={{
                height: 60, borderRadius: 16, paddingHorizontal: 16,
                backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                justifyContent: 'center',
              }}>
                <Text style={{
                  position: 'absolute', left: 16,
                  top: password ? 10 : 20,
                  color: p.fgMuted, fontSize: password ? 11 : 15, fontWeight: '500',
                }}>
                  {t('common.password')}
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={submitPassword}
                  selectionColor={p.fg}
                  style={{ color: p.fg, fontSize: 16, fontWeight: '500', paddingTop: password ? 16 : 0, paddingRight: 34 }}
                />
                <Pressable
                  onPress={() => { h.selection(); setShowPassword((s) => !s); }}
                  hitSlop={8}
                  style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={p.fgMuted} />
                </Pressable>
              </View>

              <Pressable
                onPress={submitPassword}
                disabled={submitting}
                style={({ pressed }) => ({
                  marginTop: 18, height: 58, borderRadius: 29,
                  backgroundColor: p.ctaBg,
                  opacity: submitting ? 0.7 : pressed ? 0.85 : 1,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 10,
                })}
              >
                {submitting && <ActivityIndicator size="small" color={p.ctaFg} />}
                <Ionicons name="lock-open-outline" size={18} color={p.ctaFg} />
                <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '800' }}>
                  {t('auth.loginWithPassword')}
                </Text>
              </Pressable>

              {bioAvailable && biometricEnabled && (
                <Pressable
                  onPress={() => submitBiometric('Face ID')}
                  disabled={bioLoading}
                  style={({ pressed }) => ({
                    marginTop: 12, height: 56, borderRadius: 28,
                    backgroundColor: pressed ? p.bgElev : p.pillBg,
                    borderWidth: 1, borderColor: p.border,
                    alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row', gap: 8,
                    opacity: bioLoading ? 0.7 : 1,
                  })}
                >
                  {bioLoading
                    ? <ActivityIndicator size="small" color={p.fg} />
                    : <Ionicons name="finger-print-outline" size={20} color={p.fg} />}
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                    {t('auth.loginWithFaceId')}
                  </Text>
                </Pressable>
              )}

              {lastUser.passkeyEnabled && (
                <Pressable
                  onPress={() => submitBiometric('Passkey')}
                  disabled={bioLoading}
                  style={({ pressed }) => ({
                    marginTop: 12, height: 56, borderRadius: 28,
                    backgroundColor: pressed ? p.bgElev : p.pillBg,
                    borderWidth: 1, borderColor: p.border,
                    alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row', gap: 8,
                    opacity: bioLoading ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="key-outline" size={20} color={p.fg} />
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                    {t('auth.loginWithPasskey')}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => { h.selection(); router.replace('/(auth)/login'); }}
                hitSlop={8}
                style={{ alignSelf: 'center', marginTop: 22, paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>
                  {t('auth.differentAccount')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <LocalePickerModal visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />
    </View>
  );
}
