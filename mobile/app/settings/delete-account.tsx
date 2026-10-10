/**
 * Delete account — in-app account deletion (App Store 5.1.1(v), Google Play).
 *
 * Shows what must be settled first (balances, anything in progress), explains
 * what is kept and for how long, then closes the account after a security
 * code. The server refuses while anything is outstanding and always requires
 * the code, so this screen only guides; it never decides.
 */
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, extractErrorMessage } from '@/hooks';
import { isStepUpChallengeError } from '@/lib/stepUpErrors';
import { accountService, type ClosureBlocker } from '@/services';

export default function DeleteAccountScreen() {
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const q = useQuery({ queryKey: ['account-closure'], queryFn: accountService.closure });
  const blockers = q.data?.blockers ?? [];
  const canClose = Boolean(q.data?.canClose) && typed.trim().toUpperCase() === 'CLOSE';

  const label = (b: ClosureBlocker) => {
    const key = `account.delete.b.${b.code}`;
    const text = t(key, b.params);
    return text === key ? b.message : text;
  };

  const submit = async (stepUpCode?: string) => {
    setBusy(true);
    try {
      await accountService.close({ reason: reason.trim() || undefined, stepUpCode });
      setStepUpOpen(false);
      h.success();
      Alert.alert(t('account.delete.done'));
      await logout();
      router.replace('/(auth)/welcome-back');
    } catch (e: any) {
      if (isStepUpChallengeError(e) && !stepUpCode) { setStepUpOpen(true); return; }
      if (stepUpCode) throw e; // the code modal shows a wrong-code error
      h.error();
      void q.refetch();
      Alert.alert(t('account.delete.failed'), extractErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    h.warning();
    Alert.alert(t('account.delete.confirmTitle'), t('account.delete.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.delete.button'), style: 'destructive', onPress: () => { void submit(); } },
    ]);
  };

  return (
    <ScreenShell title={t('account.delete.title')} keyboard onRefresh={() => { void q.refetch(); }} refreshing={q.isRefetching}>
      <Panel>
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: p.fg, fontSize: 14, lineHeight: 20 }}>{t('account.delete.intro')}</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19 }}>{t('account.delete.records', { years: q.data?.retentionYears ?? 5 })}</Text>
        </View>
      </Panel>

      <View style={{ height: 14 }} />
      <Panel>
        <View style={{ padding: 16, gap: 10 }}>
          {q.isLoading ? (
            <Text style={{ color: p.fgMuted, fontSize: 13 }}>…</Text>
          ) : blockers.length ? (
            <>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{t('account.delete.blockersTitle')}</Text>
              {blockers.map((b, i) => (
                <View key={`${b.code}-${i}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Ionicons name="alert-circle-outline" size={16} color={p.amberFg} style={{ marginTop: 2 }} />
                  <Text style={{ color: p.fg, fontSize: 13, flex: 1, lineHeight: 19 }}>{label(b)}</Text>
                </View>
              ))}
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle-outline" size={16} color={p.greenFg} />
              <Text style={{ color: p.fg, fontSize: 13, flex: 1 }}>{t('account.delete.ready')}</Text>
            </View>
          )}
        </View>
      </Panel>

      {q.data?.canClose ? (
        <>
          <View style={{ height: 14 }} />
          <Panel>
            <View style={{ padding: 16, gap: 12 }}>
              <Text style={{ color: p.fgMuted, fontSize: 12 }}>{t('account.delete.reason')}</Text>
              <TextInput
                value={reason} onChangeText={setReason} maxLength={500} multiline
                style={{ color: p.fg, fontSize: 14, minHeight: 60, borderWidth: 1, borderColor: p.border, borderRadius: 10, padding: 10 }}
              />
              <Text style={{ color: p.fgMuted, fontSize: 12 }}>{t('account.delete.typeToConfirm')}</Text>
              <TextInput
                value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false}
                style={{ color: p.fg, fontSize: 16, fontWeight: '700', letterSpacing: 2, borderWidth: 1, borderColor: p.border, borderRadius: 10, padding: 10 }}
              />
            </View>
          </Panel>
          <View style={{ height: 18 }} />
          <CTAButton label={t('account.delete.button')} icon="trash-outline" onPress={confirm} disabled={!canClose || busy} loading={busy} />
        </>
      ) : null}

      <StepUpModal
        visible={stepUpOpen}
        action="account_close"
        subtitle={t('account.delete.title')}
        onSubmit={(code) => submit(code)}
        onCancel={() => setStepUpOpen(false)}
      />
    </ScreenShell>
  );
}
