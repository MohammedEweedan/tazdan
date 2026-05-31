/**
 * StepUpModal — 6-digit confirmation for high-value / new-device actions.
 *
 * The server requires a code for any withdrawal/buy/sell/transfer ≥ $1000 or
 * from an unrecognized device. Flow:
 *   1. Open the modal with the action → it requests ONE code (email or TOTP).
 *   2. User enters the 6 digits.
 *   3. onSubmit(code) re-runs the action with `stepUpCode`; on success the
 *      caller closes the modal. On a bad code the server 401s and we show it.
 *
 * Theme-aware, keyboard-avoiding, monochrome-safe.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View, TextInput as RNTextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useThemedPalette } from '@/store/themeStore';
import { securityService } from '@/services';

interface Props {
  visible: boolean;
  action: 'withdrawal' | 'buy' | 'sell' | 'transfer';
  /** Called with the 6-digit code. Throw to surface an error (e.g. bad code). */
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
  /** Optional context line, e.g. "Sending $1,500 to Sara". */
  subtitle?: string;
}

export function StepUpModal({ visible, action, onSubmit, onCancel, subtitle }: Props) {
  const p = useThemedPalette();
  const [code, setCode] = useState('');
  const [method, setMethod] = useState<'email' | 'totp' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const inputRef = useRef<RNTextInput>(null);

  // The action's first attempt already 401'd and issued+emailed a code, so we
  // DON'T request again on open (that caused a second email). We just resolve
  // the delivery method to prompt correctly, and focus the input. The explicit
  // "Resend" button is the only path that asks for a new code.
  useEffect(() => {
    if (!visible) { setCode(''); setError(null); setMethod(null); return; }
    let cancelled = false;
    setRequesting(true);
    securityService.startStepUp(action) // idempotent within cooldown — reuses the existing code, no 2nd email
      .then((r) => { if (!cancelled) setMethod(r.method); })
      .catch(() => { if (!cancelled) setMethod('email'); })
      .finally(() => { if (!cancelled) { setRequesting(false); setTimeout(() => inputRef.current?.focus(), 250); } });
    return () => { cancelled = true; };
  }, [visible, action]);

  const submit = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setBusy(true); setError(null);
    try {
      await onSubmit(code);
      // Caller closes on success.
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Invalid code');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const title = method === 'totp' ? 'Enter your authenticator code' : 'Enter your security code';
  const blurb = method === 'totp'
    ? 'Open your authenticator app and enter the current 6-digit code.'
    : 'We emailed you a 6-digit code. It expires in 10 minutes.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} onPress={onCancel}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: p.bgElev, borderRadius: 22, borderWidth: 1, borderColor: p.border, padding: 22 }}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark" size={24} color={p.accent} />
              </View>
            </View>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
            {subtitle ? <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>{subtitle}</Text> : null}
            <Text style={{ color: p.fgFaint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              {requesting ? 'Sending your code…' : blurb}
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              marginTop: 18, marginBottom: 6,
              backgroundColor: p.bg, borderRadius: 14, borderWidth: 1.5,
              borderColor: error ? p.redFg : code.length === 6 ? p.accent : p.border,
              paddingVertical: 14,
            }}>
              <RNTextInput
                ref={inputRef}
                value={code}
                onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={p.fgFaint}
                style={{ color: p.fg, fontSize: 30, fontWeight: '700', letterSpacing: 10, textAlign: 'center', minWidth: 220 }}
              />
            </View>

            {error ? (
              <Text style={{ color: p.redFg, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{error}</Text>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={busy || code.length !== 6}
              style={{ marginTop: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: code.length === 6 && !busy ? p.ctaBg : p.pillBg, alignItems: 'center' }}
            >
              <Text style={{ color: code.length === 6 && !busy ? p.ctaFg : p.fgMuted, fontSize: 15, fontWeight: '700' }}>
                {busy ? 'Confirming…' : 'Confirm'}
              </Text>
            </Pressable>

            {method === 'email' && !requesting ? (
              <Pressable onPress={() => securityService.startStepUp(action).catch(() => {})} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: p.fgMuted, fontSize: 12 }}>Didn't get it? Resend code</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onCancel} style={{ marginTop: 10, alignItems: 'center' }}>
              <Text style={{ color: p.fgFaint, fontSize: 12 }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
