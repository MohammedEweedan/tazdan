/**
 * Phone verification screen — sent via WhatsApp or SMS using Twilio Verify.
 * Reached after registration (optional skip) or from profile settings.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { api } from '@/lib/api';
import { TopGradient } from '@/components/ui/ScreenShell';

const RESEND_SECONDS = 60;

export default function VerifyPhoneScreen() {
  const p = useThemedPalette();
  const { mode: themeMode } = useTheme();
  const h = useHaptics();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();

  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCountdown() {
    setCountdown(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function sendCode() {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/phone/start', { channel });
      h.success();
      setSent(true);
      startCountdown();
    } catch (e: any) {
      h.error();
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  }

  async function submitCode() {
    if (code.length < 4) { setError('Enter the code you received.'); return; }
    setError('');
    setLoading(true);
    Keyboard.dismiss();
    try {
      await api.post('/auth/phone/verify', { code });
      h.success();
      setSuccess(true);
    } catch (e: any) {
      h.error();
      setError(e?.response?.data?.error ?? e?.message ?? 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function finish() {
    const returnTo = params.returnTo ?? '/';
    router.replace(returnTo as any);
  }

  const isDark = themeMode === 'dark';

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: p.pillBg, borderWidth: 1.5, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Ionicons name="checkmark-circle" size={44} color={p.fg} />
          </View>
          <Text style={{ color: p.fg, fontSize: 26, fontWeight: '600', letterSpacing: -0.6, marginBottom: 10 }}>
            Phone Verified
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
            Your phone number is confirmed. You can now receive alerts and OTPs.
          </Text>
          <Pressable
            onPress={finish}
            style={({ pressed }) => ({
              height: 54, borderRadius: 27, backgroundColor: p.fg,
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 48, opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: p.bg, fontSize: 16, fontWeight: '700' }}>Continue</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
            <Pressable
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
              hitSlop={12}
              style={({ pressed }) => ({
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: pressed ? p.pillBg : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Ionicons name="arrow-back" size={22} color={p.fg} />
            </Pressable>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 24 }}>

            {/* Icon */}
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: p.pillBg, borderWidth: 1.5, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Ionicons name="phone-portrait-outline" size={30} color={p.fg} />
            </View>

            <Text style={{ color: p.fg, fontSize: 28, fontWeight: '600', letterSpacing: -0.8, marginBottom: 8 }}>
              {sent ? 'Enter your code' : 'Verify your phone'}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 15, lineHeight: 22, marginBottom: 32 }}>
              {sent
                ? `We sent a 6-digit code via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}. Enter it below.`
                : "Choose how you'd like to receive your verification code."}
            </Text>

            {!sent && (
              <>
                {/* Channel picker */}
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                  Send via
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
                  {(['whatsapp', 'sms'] as const).map((ch) => (
                    <Pressable
                      key={ch}
                      onPress={() => { h.selection(); setChannel(ch); }}
                      style={{
                        flex: 1, height: 52, borderRadius: 14,
                        borderWidth: channel === ch ? 2 : 1,
                        borderColor: channel === ch ? p.fg : p.border,
                        backgroundColor: channel === ch ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent',
                        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
                      }}
                    >
                      <Ionicons
                        name={ch === 'whatsapp' ? 'logo-whatsapp' : 'chatbubble-ellipses-outline'}
                        size={18}
                        color={channel === ch ? p.fg : p.fgMuted}
                      />
                      <Text style={{ color: channel === ch ? p.fg : p.fgMuted, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' }}>
                        {ch === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {error ? (
                  <Text style={{ color: p.redFg, fontSize: 13, fontWeight: '600', marginBottom: 16 }}>{error}</Text>
                ) : null}

                <Pressable
                  onPress={() => { h.medium(); sendCode(); }}
                  disabled={loading}
                  style={({ pressed }) => ({
                    height: 56, borderRadius: 28, backgroundColor: p.fg,
                    alignItems: 'center', justifyContent: 'center',
                    opacity: loading || pressed ? 0.7 : 1,
                  })}
                >
                  {loading
                    ? <ActivityIndicator color={p.bg} />
                    : <Text style={{ color: p.bg, fontSize: 16, fontWeight: '700' }}>Send Code</Text>}
                </Pressable>

                <Pressable
                  onPress={finish}
                  style={({ pressed }) => ({
                    height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 14,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>Skip for now</Text>
                </Pressable>
              </>
            )}

            {sent && (
              <>
                {/* OTP input */}
                <TextInput
                  value={code}
                  onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 8)); setError(''); }}
                  keyboardType="number-pad"
                  maxLength={8}
                  placeholder="------"
                  placeholderTextColor={p.fgFaint}
                  style={{
                    height: 64, borderRadius: 16, borderWidth: 1.5, borderColor: error ? p.redFg : p.border,
                    backgroundColor: p.bgElev, color: p.fg, fontSize: 28, fontWeight: '700',
                    textAlign: 'center', letterSpacing: 8, marginBottom: 8,
                  }}
                />

                {error ? (
                  <Text style={{ color: p.redFg, fontSize: 13, fontWeight: '600', marginBottom: 12 }}>{error}</Text>
                ) : <View style={{ height: 20 }} />}

                <Pressable
                  onPress={() => { h.medium(); submitCode(); }}
                  disabled={loading || code.length < 4}
                  style={({ pressed }) => ({
                    height: 56, borderRadius: 28, backgroundColor: p.fg,
                    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                    opacity: loading || pressed || code.length < 4 ? 0.6 : 1,
                  })}
                >
                  {loading
                    ? <ActivityIndicator color={p.bg} />
                    : <Text style={{ color: p.bg, fontSize: 16, fontWeight: '700' }}>Verify</Text>}
                </Pressable>

                {/* Resend */}
                <Pressable
                  onPress={() => { h.selection(); if (countdown === 0) sendCode(); }}
                  disabled={countdown > 0 || loading}
                  style={({ pressed }) => ({ alignItems: 'center', opacity: countdown > 0 ? 0.5 : pressed ? 0.7 : 1 })}
                >
                  <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>
                    {countdown > 0 ? `Resend in ${countdown}s` : "Didn't receive it? Resend"}
                  </Text>
                </Pressable>

                {/* Change channel */}
                <Pressable
                  onPress={() => { h.selection(); setSent(false); setCode(''); setError(''); }}
                  style={({ pressed }) => ({ alignItems: 'center', marginTop: 10, opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ color: p.fgMuted, fontSize: 13 }}>
                    Change method ({channel === 'whatsapp' ? 'WhatsApp' : 'SMS'})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={finish}
                  style={({ pressed }) => ({ alignItems: 'center', marginTop: 12, opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ color: p.fgFaint, fontSize: 13 }}>Skip for now</Text>
                </Pressable>
              </>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
