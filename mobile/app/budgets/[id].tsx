/**
 * Budget detail — big progress ring, contribute, auto-contribution toggle,
 * withdraw (enforces the lock: date block or step-up code), and close.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Animated, Easing, Modal, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ScreenShell, CTAButton, Panel, PanelRow } from '@/components/ui/ScreenShell';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useBudget, useCards, useHaptics } from '@/hooks';
import { budgetService, cardsService } from '@/services';
import type { CardEntity } from '@/types';
import { fiatSymbol } from '@/constants';
import { etaForContribution, humanizeDays, fmtGoalDate, freqAdverb, suggestPlan, type Frequency } from '@/utils/budgetMath';
import { ProgressRing } from './index';

export default function BudgetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const p = useThemedPalette();
  const h = useHaptics();
  const qc = useQueryClient();
  const { data: b } = useBudget(id);
  const { data: cards = [] } = useCards();

  const [amount, setAmount] = useState('');
  const [stepUp, setStepUp] = useState<null | { mode: 'withdraw' | 'close' | 'card'; amount?: number; cardId?: string }>(null);
  const [cardPicker, setCardPicker] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['budgets'] });
    qc.invalidateQueries({ queryKey: ['budget', id] });
    qc.invalidateQueries({ queryKey: ['wallets'] });
    qc.invalidateQueries({ queryKey: ['cards'] });
  };

  // Cards that can receive these funds (currency must match the budget).
  const eligibleCards = cards.filter((c) => c.currency === b?.currency && c.status !== 'CANCELLED');

  const fundCardMut = useMutation({
    mutationFn: (vars: { cardId: string; amount: number; code?: string }) =>
      cardsService.fundFromBudget(vars.cardId, { budgetId: id!, amount: vars.amount, stepUpCode: vars.code }),
    onSuccess: () => { h.success(); setStepUp(null); setCardPicker(false); invalidate(); Alert.alert('Loaded to card', 'The money is now available to spend on your card.'); },
    onError: (e: any, vars) => {
      // STEP_UP-locked budget → prompt for the 6-digit code, then retry.
      if (e?.response?.status === 401 && e?.response?.data?.requiresStepUp) {
        setCardPicker(false);
        setStepUp({ mode: 'card', cardId: vars.cardId, amount: vars.amount });
        return;
      }
      h.error();
      Alert.alert('Could not load card', e?.response?.data?.error ?? 'Try again');
    },
  });

  const loadOntoCard = (card: CardEntity) => {
    if (!b) return;
    h.medium();
    fundCardMut.mutate({ cardId: card.id, amount: Number(b.balance) });
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
  const completed = b.status === 'COMPLETED';

  // "Available to spend": funds are in the pot and not date-locked. (A STEP_UP
  // lock still lets you spend, just with a code — so it counts as available.)
  const spendable = saved > 0 && !b.dateLocked;

  // Projection toward the target — either at the current auto-save pace, or a
  // suggested plan if auto-save isn't on yet.
  const autoFreq = (b.autoFrequency ?? 'WEEKLY') as Frequency;
  const eta = target != null && remaining! > 0 && b.autoEnabled && Number(b.autoAmount) > 0
    ? etaForContribution(saved, target, Number(b.autoAmount), autoFreq)
    : null;
  const suggestion = target != null && remaining! > 0 && !b.autoEnabled
    ? suggestPlan(saved, target, b.targetDate ? new Date(b.targetDate) : null)
    : null;

  const doContribute = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    h.medium();
    contributeMut.mutate(amt);
  };

  return (
    <ScreenShell title={b.name} subtitle={b.emoji ? undefined : 'Budget'} keyboard>
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

      {/* Available-to-spend banner — animates in once funds are unlocked. */}
      {spendable && (
        <AvailableToSpendBanner
          palette={p} sym={sym} amount={saved} completed={completed}
          canCard={eligibleCards.length > 0}
          onSpend={() => { h.medium(); setCardPicker(true); }}
        />
      )}

      {/* Projection — time to reach the goal. */}
      {eta && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
          <Ionicons name="time-outline" size={18} color={p.accent} />
          <Text style={{ color: p.fg, fontSize: 13, flex: 1 }}>
            At {sym}{Number(b.autoAmount).toLocaleString()} {freqAdverb(autoFreq)}, you'll reach your goal in{' '}
            <Text style={{ fontWeight: '800' }}>{humanizeDays(eta.days)}</Text> ({fmtGoalDate(eta.date)}).
          </Text>
        </View>
      )}
      {suggestion && remaining != null && (
        <Pressable
          onPress={() => { h.selection(); router.push(`/budgets/new?editAuto=${b.id}` as any); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder }}
        >
          <Ionicons name="bulb-outline" size={18} color={p.accentText} />
          <Text style={{ color: p.fg, fontSize: 13, flex: 1 }}>
            Save <Text style={{ fontWeight: '800', color: p.accentText }}>{sym}{suggestion.perPeriod.toLocaleString()} {freqAdverb(suggestion.freq)}</Text>
            {b.targetDate ? ' to reach your goal by your target date.' : ` to reach ${sym}${target!.toLocaleString()} in about 6 months.`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
        </Pressable>
      )}

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
        {saved > 0 && !b.dateLocked && (
          <PanelRow
            icon="card-outline"
            label={eligibleCards.length > 0 ? 'Spend with card' : `Order a ${b.currency} card to spend`}
            onPress={() => {
              h.selection();
              if (eligibleCards.length > 0) setCardPicker(true);
              else router.push('/cards');
            }}
          />
        )}
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

      {/* Card picker — choose which card to load the budget onto. */}
      <Modal visible={cardPicker} transparent animationType="slide" onRequestClose={() => setCardPicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setCardPicker(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: p.border }} onPress={() => {}}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800' }}>Spend with card</Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
              Move {sym}{saved.toLocaleString()} onto a card to spend it.
            </Text>
            {eligibleCards.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => loadOntoCard(c)}
                disabled={fundCardMut.isPending}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 10, backgroundColor: pressed ? p.bgRaised : p.bgElev, borderWidth: 1, borderColor: p.border, opacity: fundCardMut.isPending ? 0.6 : 1 })}
              >
                <Ionicons name="card" size={22} color={p.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{c.nickname ?? `${c.tier} card`}</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12 }}>•••• {c.last4} · {c.currency}</Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={22} color={p.accent} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Step-up modal — shown when the server requires a code to unlock. */}
      <StepUpModal
        visible={!!stepUp}
        action="withdrawal"
        subtitle="Enter the code to unlock this budget."
        onCancel={() => setStepUp(null)}
        onSubmit={async (code) => {
          if (stepUp?.mode === 'withdraw') await withdrawMut.mutateAsync({ amount: stepUp.amount, code });
          else if (stepUp?.mode === 'close') await closeMut.mutateAsync(code);
          else if (stepUp?.mode === 'card' && stepUp.cardId && stepUp.amount) {
            await fundCardMut.mutateAsync({ cardId: stepUp.cardId, amount: stepUp.amount, code });
          }
        }}
      />
    </ScreenShell>
  );
}

/**
 * Animated "available to spend" banner. Springs in (scale + fade) and keeps a
 * soft pulsing glow so a newly-unlocked or completed budget feels celebratory.
 */
function AvailableToSpendBanner({
  palette: p, sym, amount, completed, canCard, onSpend,
}: {
  palette: Palette; sym: string; amount: number; completed: boolean; canCard: boolean; onSpend: () => void;
}) {
  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [appear, pulse]);

  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });

  return (
    <Animated.View style={{ opacity: appear, transform: [{ scale }], marginTop: 16 }}>
      <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: p.accentBorder, backgroundColor: p.accentSoft }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: p.accent, opacity: glow }} />
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={completed ? 'sparkles' : 'wallet'} size={22} color={p.accentFg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '800' }}>
              {completed ? '🎉 Goal reached!' : 'Available to spend'}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 1 }}>
              {sym}{amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ready{canCard ? ' — load it onto your card' : ''}.
            </Text>
          </View>
          <Pressable onPress={onSpend} style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: p.accent, opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: p.accentFg, fontSize: 13, fontWeight: '800' }}>{canCard ? 'Spend' : 'Get card'}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
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
