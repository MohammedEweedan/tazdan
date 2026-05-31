/**
 * Two-Factor Authentication setup screen — /settings/2fa
 *
 * Enable: fetch a TOTP secret + QR from the server, user scans it into their
 * authenticator, then confirms with a 6-digit code. Disable: confirm with a
 * current code. Uses the existing authService 2FA endpoints.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View, TextInput as RNTextInput, Image } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import { authService } from '@/services';

export default function TwoFactorScreen() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const h = useHaptics();
  const { user, updateUser } = useAuthStore();
  const enabled = !!user?.twoFactorEnabled;

  const [phase, setPhase] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [secret, setSecret] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

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
      h.success(); setPhase('idle'); setCode('');
      Alert.alert('2FA enabled', 'Your account is now protected with two-factor authentication.');
    } catch (e: any) {
      h.error(); Alert.alert('Invalid code', e?.response?.data?.error ?? 'Try again.');
    } finally { setBusy(false); }
  };

  const confirmDisable = async () => {
    if (code.length < 6) return;
    setBusy(true);
    try {
      await authService.disable2FA(code);
      updateUser({ twoFactorEnabled: false } as any);
      h.success(); setPhase('idle'); setCode('');
    } catch (e: any) {
      h.error(); Alert.alert('Invalid code', e?.response?.data?.error ?? 'Try again.');
    } finally { setBusy(false); }
  };

  const Field = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      marginTop: 18, backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1.5,
      borderColor: code.length === 6 ? p.accent : p.border, paddingVertical: 14,
    }}>
      <RNTextInput
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" maxLength={6}
        placeholder="000000" placeholderTextColor={p.fgFaint}
        autoFocus
        style={{ color: p.fg, fontSize: 28, fontWeight: '700', letterSpacing: 8, textAlign: 'center', minWidth: 200 }}
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

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {/* Status card */}
          <View style={{ backgroundColor: p.bgElev, borderRadius: 18, borderWidth: 1, borderColor: p.border, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: enabled ? p.greenBg : p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={enabled ? 'shield-checkmark' : 'shield-outline'} size={24} color={enabled ? p.greenFg : p.fgMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>{enabled ? 'Enabled' : 'Not enabled'}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }}>
                {enabled ? 'A code from your authenticator is required to sign in and confirm sensitive actions.' : 'Add a second layer of security with an authenticator app.'}
              </Text>
            </View>
          </View>

          {phase === 'idle' && (
            <Pressable
              onPress={() => { h.selection(); enabled ? setPhase('disable') : startSetup(); }}
              disabled={busy}
              style={{ marginTop: 18, paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: enabled ? p.bgElev : p.ctaBg, borderWidth: enabled ? 1 : 0, borderColor: p.redFg }}
            >
              <Text style={{ color: enabled ? p.redFg : p.ctaFg, fontSize: 15, fontWeight: '700' }}>
                {busy ? 'Please wait…' : enabled ? 'Disable 2FA' : 'Enable 2FA'}
              </Text>
            </Pressable>
          )}

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
              {Field}
              <Pressable onPress={confirmEnable} disabled={busy || code.length !== 6} style={{ marginTop: 16, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: code.length === 6 && !busy ? p.ctaBg : p.pillBg }}>
                <Text style={{ color: code.length === 6 && !busy ? p.ctaFg : p.fgMuted, fontSize: 15, fontWeight: '700' }}>{busy ? 'Verifying…' : 'Confirm & enable'}</Text>
              </Pressable>
              <Pressable onPress={() => { setPhase('idle'); setCode(''); }} style={{ marginTop: 10, alignItems: 'center' }}><Text style={{ color: p.fgFaint, fontSize: 12 }}>Cancel</Text></Pressable>
            </View>
          )}

          {phase === 'disable' && (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>Enter a current authenticator code to disable</Text>
              {Field}
              <Pressable onPress={confirmDisable} disabled={busy || code.length !== 6} style={{ marginTop: 16, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: code.length === 6 && !busy ? p.redFg : p.pillBg }}>
                <Text style={{ color: code.length === 6 && !busy ? '#fff' : p.fgMuted, fontSize: 15, fontWeight: '700' }}>{busy ? 'Disabling…' : 'Disable 2FA'}</Text>
              </Pressable>
              <Pressable onPress={() => { setPhase('idle'); setCode(''); }} style={{ marginTop: 10, alignItems: 'center' }}><Text style={{ color: p.fgFaint, fontSize: 12 }}>Cancel</Text></Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
