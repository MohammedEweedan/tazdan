/**
 * Two-Factor Authentication — /settings/2fa
 *
 * Enable:  fetch a TOTP secret + QR, user scans it, confirms with a 6-digit code.
 * Disable: requires the current TOTP code AND the account password (the server
 *          enforces both, so a stolen unlocked phone can't strip 2FA in one tap).
 * Reset:   disable then immediately re-enroll with a fresh secret — for moving
 *          2FA to a new device. Same password + code gate as disable.
 *
 * Locked out (lost authenticator, can't sign in)? That recovery has to happen
 * out of band — we surface a support route rather than a flow the API can't back.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View, TextInput as RNTextInput, Image, Linking } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useThemedPalette, useTheme, type Palette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import { authService } from '@/services';

type Phase = 'idle' | 'setup' | 'disable' | 'reset';

export default function TwoFactorScreen() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const h = useHaptics();
  const { user, updateUser } = useAuthStore();
  const enabled = !!user?.twoFactorEnabled;
  const accent = themeMode === 'mono' ? p.ctaBg : p.accent;
  const accentFg = themeMode === 'mono' ? p.ctaFg : p.accentFg;

  const [phase, setPhase] = useState<Phase>('idle');
  const [secret, setSecret] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setPhase('idle'); setCode(''); setPassword(''); setSecret(''); setQr(''); };

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await authService.enable2FA();
      setSecret(res.secret); setQr(res.qrCodeDataUrl); setCode(''); setPhase('setup');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Could not start 2FA setup.');
    } finally { setBusy(false); }
  };

  const confirmEnable = async () => {
    if (code.length < 6) return;
    setBusy(true);
    try {
      await authService.verify2FA(code);
      updateUser({ twoFactorEnabled: true } as any);
      h.success(); reset();
      Alert.alert('2FA enabled', 'Your account is now protected with two-factor authentication.');
    } catch (e: any) {
      h.error(); Alert.alert('Invalid code', e?.response?.data?.error ?? 'Try again.');
    } finally { setBusy(false); }
  };

  // Disable (and, for reset, immediately re-enroll). Both need code + password.
  const confirmDisable = async (thenReEnroll: boolean) => {
    if (code.length < 6 || password.length < 1) return;
    setBusy(true);
    try {
      await authService.disable2FA(code, password);
      updateUser({ twoFactorEnabled: false } as any);
      h.success();
      if (thenReEnroll) {
        setCode(''); setPassword('');
        await startSetup();      // jumps straight into a fresh enrollment
      } else {
        reset();
        Alert.alert('2FA disabled', 'Two-factor authentication has been turned off.');
      }
    } catch (e: any) {
      h.error();
      Alert.alert('Could not disable', e?.response?.data?.error ?? e?.response?.data?.message ?? 'Check your password and code.');
    } finally { setBusy(false); }
  };

  const CodeField = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      marginTop: 14, backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1.5,
      borderColor: code.length === 6 ? accent : p.border, paddingVertical: 14,
    }}>
      <RNTextInput
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" maxLength={6}
        placeholder="000000" placeholderTextColor={p.fgFaint}
        style={{ color: p.fg, fontSize: 28, fontWeight: '700', letterSpacing: 8, textAlign: 'center', minWidth: 200 }}
      />
    </View>
  );

  const PasswordField = (
    <View style={{
      marginTop: 12, backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1.5,
      borderColor: password ? accent : p.border, paddingHorizontal: 16, paddingVertical: 14,
    }}>
      <RNTextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry autoCapitalize="none" autoCorrect={false}
        placeholder="Account password" placeholderTextColor={p.fgFaint}
        style={{ color: p.fg, fontSize: 16, fontWeight: '500' }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={26} color={p.fg} /></Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '700' }}>Two-Factor Auth</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {/* Status card */}
          <View style={{ backgroundColor: p.bgElev, borderRadius: 18, borderWidth: 1, borderColor: p.border, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: enabled ? p.greenBg : p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={enabled ? 'shield-checkmark' : 'shield-outline'} size={24} color={enabled ? p.greenFg : p.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>{enabled ? 'Enabled' : 'Not enabled'}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }}>
                {enabled ? 'A code from your authenticator is required to sign in and confirm sensitive actions.' : 'Add a second layer of security with an authenticator app.'}
              </Text>
            </View>
          </View>

          {/* Idle actions */}
          {phase === 'idle' && (
            <View style={{ gap: 12, marginTop: 18 }}>
              {!enabled ? (
                <PrimaryBtn label={busy ? 'Please wait…' : 'Enable 2FA'} bg={accent} fg={accentFg}
                  onPress={() => { h.selection(); startSetup(); }} disabled={busy} />
              ) : (
                <>
                  {/* Reset = re-key to a new device. Leads (accent), since it's
                      the safe, common action; full disable is the destructive one. */}
                  <PrimaryBtn label="Reset 2FA (new device)" bg={accent} fg={accentFg}
                    onPress={() => { h.selection(); setPhase('reset'); }} />
                  <Pressable
                    onPress={() => { h.selection(); setPhase('disable'); }}
                    style={{ paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.redFg }}
                  >
                    <Text style={{ color: p.redFg, fontSize: 15, fontWeight: '700' }}>Disable 2FA</Text>
                  </Pressable>
                </>
              )}
              {/* Locked-out recovery — honest out-of-band route. */}
              <Pressable
                onPress={() => Linking.openURL('mailto:support@tazdan.com?subject=2FA%20recovery').catch(() => {})}
                style={{ alignItems: 'center', paddingTop: 6 }}
              >
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>Lost your authenticator? Contact support</Text>
              </Pressable>
            </View>
          )}

          {/* Setup / enable */}
          {phase === 'setup' && (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>1. Scan this QR in your authenticator</Text>
              {qr ? (
                <View style={{ alignItems: 'center', marginTop: 12 }}>
                  <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12 }}>
                    <Image source={{ uri: qr }} style={{ width: 180, height: 180 }} />
                  </View>
                </View>
              ) : null}
              <Pressable onPress={() => { Clipboard.setStringAsync(secret); h.selection(); }} style={{ marginTop: 12, padding: 12, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border }}>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>OR ENTER THIS KEY MANUALLY (tap to copy)</Text>
                <Text style={{ color: p.fg, fontSize: 13, fontFamily: 'monospace', marginTop: 4 }}>{secret}</Text>
              </Pressable>
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', marginTop: 18 }}>2. Enter the 6-digit code</Text>
              {CodeField}
              <PrimaryBtn label={busy ? 'Verifying…' : 'Confirm & enable'} bg={accent} fg={accentFg}
                disabled={busy || code.length !== 6} onPress={confirmEnable} style={{ marginTop: 16 }} />
              <CancelBtn p={p} onPress={reset} />
            </View>
          )}

          {/* Disable (and reset shares the same gate, then re-enrolls) */}
          {(phase === 'disable' || phase === 'reset') && (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
                {phase === 'reset' ? 'Verify it’s you to re-key 2FA' : 'Verify it’s you to disable 2FA'}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4 }}>
                Enter a current authenticator code and your account password.
              </Text>
              {CodeField}
              {PasswordField}
              <PrimaryBtn
                label={busy ? 'Please wait…' : phase === 'reset' ? 'Verify & re-enroll' : 'Disable 2FA'}
                bg={phase === 'reset' ? accent : p.redFg}
                fg={phase === 'reset' ? accentFg : '#fff'}
                disabled={busy || code.length !== 6 || password.length < 1}
                onPress={() => confirmDisable(phase === 'reset')}
                style={{ marginTop: 16 }}
              />
              <CancelBtn p={p} onPress={reset} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PrimaryBtn({ label, onPress, bg, fg, disabled, style }: {
  label: string; onPress: () => void; bg: string; fg: string; disabled?: boolean; style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[{
        paddingVertical: 15, borderRadius: 14, alignItems: 'center',
        backgroundColor: bg, opacity: disabled ? 0.5 : 1,
      }, style]}
    >
      <Text style={{ color: fg, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function CancelBtn({ p, onPress }: { p: Palette; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginTop: 10, alignItems: 'center' }}>
      <Text style={{ color: p.fgFaint, fontSize: 12 }}>Cancel</Text>
    </Pressable>
  );
}
