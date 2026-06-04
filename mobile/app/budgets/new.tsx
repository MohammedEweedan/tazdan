/**
 * Create a budget — name, emoji, currency, target (amount + date), lock type,
 * and optional auto-contribution.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useWallets } from '@/hooks';
import { budgetService, type BudgetLockType } from '@/services';
import { fiatSymbol } from '@/constants';
import {
  etaForContribution, requiredPerPeriod, suggestPlan,
  humanizeDays, fmtGoalDate, freqAdverb,
} from '@/utils/budgetMath';

const EMOJIS = ['🎯','🏖️','✈️','🏠','🚗','💍','🎓','🎁','💻','🩺','🐶','⛰️','🍼','💰'];
const FIATS = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'];
type Freq = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** dd/mm/yyyy → Date (or null if incomplete/invalid). */
function parseDdmmyyyy(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

export default function NewBudget() {
  const router = useRouter();
  const p = useThemedPalette();
  const h = useHaptics();
  const qc = useQueryClient();
  const { data: wallets = [] } = useWallets();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [currency, setCurrency] = useState('EUR');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState(''); // dd/mm/yyyy
  const [lock, setLock] = useState<BudgetLockType>('NONE');
  const [unlockDate, setUnlockDate] = useState('');
  const [autoOn, setAutoOn] = useState(false);
  const [autoAmount, setAutoAmount] = useState('');
  const [autoFreq, setAutoFreq] = useState<Freq>('WEEKLY');

  const sym = fiatSymbol(currency as any);

  const createMut = useMutation({
    mutationFn: () => budgetService.create({
      name: name.trim(),
      emoji,
      currency,
      targetAmount: target ? Number(target) : undefined,
      targetDate: targetDate ? toIso(targetDate) : undefined,
      lockType: lock,
      unlockDate: (lock === 'DATE' || lock === 'DATE_AND_STEP_UP') && unlockDate ? toIso(unlockDate) : undefined,
      auto: autoOn && autoAmount ? { amount: Number(autoAmount), frequency: autoFreq, sourceCurrency: currency } : undefined,
    }),
    onSuccess: (b) => { h.success(); qc.invalidateQueries({ queryKey: ['budgets'] }); router.replace(`/budgets/${b.id}`); },
    onError: (e: any) => { h.error(); Alert.alert('Could not create', e?.response?.data?.error ?? 'Try again'); },
  });

  const needsUnlock = lock === 'DATE' || lock === 'DATE_AND_STEP_UP';
  const valid = name.trim().length > 0 && (!needsUnlock || /^\d{2}\/\d{2}\/\d{4}$/.test(unlockDate)) && (!autoOn || Number(autoAmount) > 0);

  // ── Live projection: time-to-goal, required pace, suggested plan ──
  const targetNum = Number(target) || 0;
  const goalDate = useMemo(() => parseDdmmyyyy(targetDate), [targetDate]);
  const eta = useMemo(
    () => (targetNum > 0 && autoOn && Number(autoAmount) > 0
      ? etaForContribution(0, targetNum, Number(autoAmount), autoFreq)
      : null),
    [targetNum, autoOn, autoAmount, autoFreq],
  );
  const needPace = useMemo(
    () => (targetNum > 0 && goalDate ? requiredPerPeriod(0, targetNum, autoFreq, goalDate) : null),
    [targetNum, goalDate, autoFreq],
  );
  const suggestion = useMemo(
    () => (targetNum > 0 ? suggestPlan(0, targetNum, goalDate) : null),
    [targetNum, goalDate],
  );
  const applySuggestion = () => {
    if (!suggestion) return;
    h.selection();
    setAutoOn(true);
    setAutoAmount(String(suggestion.perPeriod));
    setAutoFreq(suggestion.freq);
  };

  return (
    <ScreenShell title="New budget" keyboard>
      {/* Emoji + name */}
      <Text style={label(p)}>NAME</Text>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Pressable onPress={() => { const i = EMOJIS.indexOf(emoji); setEmoji(EMOJIS[(i + 1) % EMOJIS.length]); h.selection(); }}
          style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28 }}>{emoji}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextInput value={name} onChangeText={setName} placeholder="Madrid 2026" placeholderTextColor={p.fgFaint}
            style={{ color: p.fg, fontSize: 18, fontWeight: '700', backgroundColor: p.bgElev, borderWidth: 1, borderColor: name ? p.accent : p.border, borderRadius: 14, paddingHorizontal: 16, height: 56 }} />
        </View>
      </View>
      {/* Emoji strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
        {EMOJIS.map((e) => (
          <Pressable key={e} onPress={() => { setEmoji(e); h.selection(); }} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: emoji === e ? p.accentSoft : p.bgElev, borderWidth: 1, borderColor: emoji === e ? p.accent : p.border }}>
            <Text style={{ fontSize: 20 }}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Currency */}
      <Text style={label(p)}>CURRENCY</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FIATS.map((c) => (
          <Chip key={c} label={c} active={currency === c} palette={p} onPress={() => { setCurrency(c); h.selection(); }} />
        ))}
      </View>

      {/* Target */}
      <Text style={label(p)}>GOAL (OPTIONAL)</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14 }}>
          <Text style={{ color: p.fgMuted, fontSize: 18, marginRight: 4 }}>{sym}</Text>
          <TextInput value={target} onChangeText={(v) => setTarget(v.replace(/[^0-9.]/g, ''))} placeholder="2500" placeholderTextColor={p.fgFaint} keyboardType="decimal-pad"
            style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '600', height: 52 }} />
        </View>
        <DateField value={targetDate} onChange={setTargetDate} placeholder="by dd/mm/yyyy" palette={p} />
      </View>

      {/* Suggested plan — appears once a goal amount is entered. */}
      {suggestion && (
        <Pressable
          onPress={applySuggestion}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder }}
        >
          <Ionicons name="bulb-outline" size={20} color={p.accentText} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '700' }}>
              Save {sym}{suggestion.perPeriod.toLocaleString()} {freqAdverb(suggestion.freq)}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>
              {goalDate ? `Hits ${sym}${targetNum.toLocaleString()} by your date` : `Reaches ${sym}${targetNum.toLocaleString()} in about 6 months`} · tap to use
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={20} color={p.accentText} />
        </Pressable>
      )}

      {/* Projection — time to reach the goal at the chosen pace. */}
      {(eta || needPace) && (
        <View style={{ marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, gap: 8 }}>
          {eta && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="time-outline" size={18} color={p.accent} />
              <Text style={{ color: p.fg, fontSize: 13, flex: 1 }}>
                At {sym}{Number(autoAmount).toLocaleString()} {freqAdverb(autoFreq)}, you'll reach {sym}{targetNum.toLocaleString()} in{' '}
                <Text style={{ fontWeight: '800' }}>{humanizeDays(eta.days)}</Text> ({fmtGoalDate(eta.date)}).
              </Text>
            </View>
          )}
          {needPace != null && needPace > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="calendar-outline" size={18} color={p.accent} />
              <Text style={{ color: p.fg, fontSize: 13, flex: 1 }}>
                To hit your date, save about{' '}
                <Text style={{ fontWeight: '800' }}>{sym}{Math.ceil(needPace).toLocaleString()} {freqAdverb(autoFreq)}</Text>.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Lock */}
      <Text style={label(p)}>LOCK</Text>
      <View style={{ gap: 8 }}>
        {([
          ['NONE', 'No lock', 'Withdraw anytime'],
          ['DATE', 'Until a date', 'Locked until the unlock date'],
          ['STEP_UP', 'Require a code', '2FA / email code to withdraw'],
          ['DATE_AND_STEP_UP', 'Date + code', 'Both conditions'],
        ] as const).map(([key, title, desc]) => (
          <Pressable key={key} onPress={() => { setLock(key); h.selection(); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: lock === key ? p.accentSoft : p.bgElev, borderWidth: 1.5, borderColor: lock === key ? p.accent : p.border }}>
            <Ionicons name={lock === key ? 'radio-button-on' : 'radio-button-off'} size={20} color={lock === key ? p.accentText : p.fgMuted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{title}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 12 }}>{desc}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      {needsUnlock && (
        <View style={{ marginTop: 10 }}>
          <DateField value={unlockDate} onChange={setUnlockDate} placeholder="unlock on dd/mm/yyyy" palette={p} full />
        </View>
      )}

      {/* Auto-contribution */}
      <Pressable onPress={() => { setAutoOn((v) => !v); h.selection(); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
        <View>
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Auto-save</Text>
          <Text style={{ color: p.fgMuted, fontSize: 12 }}>Add a set amount on a schedule</Text>
        </View>
        <View style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: autoOn ? p.accent : p.border, justifyContent: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: autoOn ? 'flex-end' : 'flex-start' }} />
        </View>
      </Pressable>
      {autoOn && (
        <View style={{ marginTop: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14 }}>
            <Text style={{ color: p.fgMuted, fontSize: 18, marginRight: 4 }}>{sym}</Text>
            <TextInput value={autoAmount} onChangeText={(v) => setAutoAmount(v.replace(/[^0-9.]/g, ''))} placeholder="50" placeholderTextColor={p.fgFaint} keyboardType="decimal-pad"
              style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '600', height: 52 }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as Freq[]).map((f) => (
              <Chip key={f} label={f.charAt(0) + f.slice(1).toLowerCase()} active={autoFreq === f} palette={p} onPress={() => { setAutoFreq(f); h.selection(); }} />
            ))}
          </View>
        </View>
      )}

      <View style={{ marginTop: 24, marginBottom: 8 }}>
        <CTAButton label={createMut.isPending ? 'Creating…' : 'Create budget'} icon="checkmark-circle" disabled={!valid || createMut.isPending} onPress={() => createMut.mutate()} />
      </View>
    </ScreenShell>
  );
}

function label(p: Palette) {
  return { color: p.fgMuted, fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6, marginTop: 20, marginBottom: 8 };
}

function Chip({ label, active, palette: p, onPress }: { label: string; active: boolean; palette: Palette; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: active ? p.accent : p.bgElev, borderWidth: 1, borderColor: active ? p.accent : p.border }}>
      <Text style={{ color: active ? p.accentFg : p.fg, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function DateField({ value, onChange, placeholder, palette: p, full }: { value: string; onChange: (v: string) => void; placeholder: string; palette: Palette; full?: boolean }) {
  return (
    <View style={{ flex: full ? undefined : 1, flexDirection: 'row', alignItems: 'center', backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: value ? p.accent : p.border, paddingHorizontal: 14, height: 52 }}>
      <Ionicons name="calendar-outline" size={16} color={p.fgMuted} style={{ marginRight: 6 }} />
      <TextInput
        value={value}
        onChangeText={(t) => {
          const d = t.replace(/\D/g, '').slice(0, 8);
          let out = d;
          if (d.length > 2) out = `${d.slice(0, 2)}/${d.slice(2)}`;
          if (d.length > 4) out = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
          onChange(out);
        }}
        placeholder={placeholder} placeholderTextColor={p.fgFaint} keyboardType="number-pad"
        style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '600' }}
      />
    </View>
  );
}

/** dd/mm/yyyy → ISO datetime string. */
function toIso(ddmmyyyy: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  if (!m) return new Date().toISOString();
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z`).toISOString();
}
