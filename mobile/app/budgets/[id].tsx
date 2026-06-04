/**
 * Budget detail — big progress ring, contribute, auto-contribution toggle,
 * withdraw (enforces the lock: date block or step-up code), and close.
 */

import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ScreenShell, CTAButton, Panel, PanelRow } from '@/components/ui/ScreenShell';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { useThemedPalette } from '@/store/themeStore';
import { useBudget, useHaptics } from '@/hooks';
import { budgetService } from '@/services';
import { fiatSymbol } from '@/constants';
import { ProgressRing } from './index';

export default function BudgetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = useThemedPalette();
  const h = useHaptics();
  const qc = useQueryClient();
  const { data: b } = useBudget(id);

  const [amount, setAmount] = useState('');
  const [stepUp, setStepUp] = useState<null | { mode: 'withdraw' | 'close'; amount?: number }>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['budgets'] });
    qc.invalidateQueries({ queryKey: ['budget', id] });
    qc.invalidateQueries({ queryKey: ['wallets'] });
  };

  const contributeMut = useMutation({
    mutationFn: (amt: number) => budgetService.contribute(id!, amt),
    onSuccess: () => { h.success(); setAmount(''); invalidate(); },
    onError: (e: any) => { h.error(); Alert.alert('Could not save', e?.response?.data?.error ?? 'Try again'); },
  });

  const withdrawMut = useMutation({
    mutationFn: (vars: { amount?: number; code?: string }) => budgetService.withdraw(id!, vars.amount, vars.code),
    onSuccess: () => { h.success(); setStepUp(null); invalidate(); },
    onError: (e: any) => {
      // 401 { requiresStepUp } → prompt for the code, then retry.
      if (e?.response?.status === 401 && e?.response?.data?.requiresStepUp) {
        setStepUp({ mode: 'withdraw' });
        return;
      }
      h.error();
      Alert.alert('Could not withdraw', e?.response?.data?.error ?? 'Try again');
    },
  });

  const closeMut = useMutation({
    mutationFn: (code?: string) => budgetService.close(id!, code),
    onSuccess: () => { h.success(); qc.invalidateQueries({ queryKey: ['budgets'] }); qc.invalidateQueries({ queryKey: ['wallets'] }); router.back(); },
    onError: (e: any) => {
      if (e?.response?.status === 401 && e?.response?.data?.requiresStepUp) { setStepUp({ mode: 'close' }); return; }
      h.error();
      Alert.alert('Could not close', e?.response?.data?.error ?? 'Try again');
    },
  });

  if (!b) {
    return <ScreenShell title="Budget"><Text style={{ color: p.fgMuted, marginTop: 24 }}>Loading…</Text></ScreenShell>;
  }

  const sym = fiatSymbol(b.currency as any);
  const saved = Number(b.balance);
  const target = b.targetAmount != null ? Number(b.targetAmount) : null;
  const pct = b.progressPct != null ? Math.round(b.progressPct) : (target ? Math.min(100, Math.round((saved / target) * 100)) : 0);
  const remaining = target != null ? Math.max(0, target - saved) : null;

  const doContribute = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    h.medium();
    contributeMut.mutate(amt);
  };

  return (
    <ScreenShell title={b.name} subtitle={b.emoji ? undefined : 'Budget'}>
      {/* Progress hero */}
      <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
        <ProgressRing pct={target ? pct : 100} size={132} palette={p} emoji={b.emoji ?? '🎯'} done={b.status === 'COMPLETED'} />
        <Text style={{ color: p.fg, fontSize: 30, fontWeight: '800', marginTop: 16, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
          {sym}{saved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        {target != null && (
          <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 4 }}>
            {pct}% of {sym}{target.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            {remaining != null && remaining > 0 && ` · ${sym}${remaining.toLocaleString('en-US', { maximumFractionDigits: 0 })} to go`}
          </Text>
        )}
        {b.targetDate && (
          <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 4 }}>Target date {new Date(b.targetDate).toLocaleDateString()}</Text>
        )}
        {b.locked && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder }}>
            <Ionicons name="lock-closed" size={12} color={p.accentText} />
            <Text style={{ color: p.accentText, fontSize: 11, fontWeight: '700' }}>
              {b.dateLocked ? `Locked until ${new Date(b.unlockDate!).toLocaleDateString()}` : 'Requires verification to withdraw'}
            </Text>
          </View>
        )}
      </View>

      {/* Add money */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 }}>ADD MONEY</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1.5, borderColor: Number(amount) > 0 ? p.accent : p.border, paddingHorizontal: 16 }}>
        <Text style={{ color: p.fgMuted, fontSize: 22, fontWeight: '600', marginRight: 6 }}>{sym}</Text>
        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
          placeholder="0.00" placeholderTextColor={p.fgFaint}
          keyboardType="decimal-pad"
          style={{ flex: 1, color: p.fg, fontSize: 28, fontWeight: '700', paddingVertical: 16, fontVariant: ['tabular-nums'] }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {[10, 25, 50, 100].map((v) => (
          <Pressable key={v} onPress={() => { h.selection(); setAmount(String(v)); }} style={({ pressed }) => ({ flex: 1, paddingVertical: 9, borderRadius: 11, backgroundColor: pressed ? p.border : p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center' })}>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{sym}{v}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 14 }}>
        <CTAButton
          label={contributeMut.isPending ? 'Saving…' : `Save ${amount ? `${sym}${amount}` : ''}`.trim()}
          icon="add-circle"
          disabled={!amount || Number(amount) <= 0 || contributeMut.isPending}
          onPress={doContribute}
        />
      </View>

      {/* Auto-contribution */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 }}>AUTOMATIC</Text>
      <Panel>
        <PanelRow
          icon="repeat"
          label={b.autoEnabled ? `Auto-saving ${sym}${Number(b.autoAmount ?? 0).toLocaleString()} ${freqLabel(b.autoFrequency)}` : 'Set up auto-saving'}
          onPress={() => { h.selection(); router.push(`/budgets/new?editAuto=${b.id}` as any); }}
          right={
            <Pressable
              onPress={() => budgetService.setAuto(b.id, !b.autoEnabled).then(invalidate)}
              hitSlop={8}
              style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: b.autoEnabled ? p.accent : p.border, justifyContent: 'center' }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: b.autoEnabled ? 'flex-end' : 'flex-start' }} />
            </Pressable>
          }
          last
        />
      </Panel>

      {/* Withdraw / close */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 }}>MANAGE</Text>
      <Panel>
        <PanelRow
          icon="arrow-down-circle-outline"
          label={saved > 0 ? `Withdraw to spendable` : 'Nothing to withdraw'}
          onPress={() => {
            if (saved <= 0) return;
            if (b.dateLocked) { Alert.alert('Locked', `This budget is locked until ${new Date(b.unlockDate!).toLocaleDateString()}.`); return; }
            Alert.alert('Withdraw all?', `Move ${sym}${saved.toLocaleString()} back to your spendable ${b.currency} balance?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Withdraw', onPress: () => withdrawMut.mutate({}) },
            ]);
          }}
        />
        <PanelRow
          icon="trash-outline"
          label="Close budget"
          danger
          onPress={() => Alert.alert('Close budget?', 'This releases any remaining funds and removes the goal.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Close', style: 'destructive', onPress: () => closeMut.mutate(undefined) },
          ])}
          last
        />
      </Panel>

      {/* Step-up modal — shown when the server requires a code to unlock. */}
      <StepUpModal
        visible={!!stepUp}
        action="withdrawal"
        subtitle="Enter the code to unlock this budget."
        onCancel={() => setStepUp(null)}
        onSubmit={async (code) => {
          if (stepUp?.mode === 'withdraw') await withdrawMut.mutateAsync({ amount: stepUp.amount, code });
          else if (stepUp?.mode === 'close') await closeMut.mutateAsync(code);
        }}
      />
    </ScreenShell>
  );
}

function freqLabel(f?: string | null): string {
  switch (f) {
    case 'DAILY': return 'daily';
    case 'WEEKLY': return 'weekly';
    case 'BIWEEKLY': return 'every 2 weeks';
    case 'MONTHLY': return 'monthly';
    default: return '';
  }
}
