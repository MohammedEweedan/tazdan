/**
 * Budget Wallets — list of the user's named savings goals.
 * Each card shows the emoji + name, a progress ring toward the target, the
 * saved amount, deadline, and a 🔒 when locked. Tap to open the detail.
 */

import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useBudgets, useHaptics } from '@/hooks';
import { fiatSymbol } from '@/constants';
import type { Budget } from '@/services';

export default function BudgetsList() {
  const router = useRouter();
  const p = useThemedPalette();
  const h = useHaptics();
  const { data: budgets = [], isLoading, refetch, isFetching } = useBudgets();

  return (
    <ScreenShell title="Budgets" scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={p.fg} />}
      >
        <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 18 }}>
          Set money aside for a goal — a trip, a gift, a rainy day. Save manually
          or on a schedule, and lock it until you're ready.
        </Text>

        {isLoading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <Ionicons name="wallet-outline" size={32} color={p.fgFaint} />
            <Text style={{ color: p.fgMuted, marginTop: 10, fontSize: 13 }}>Loading…</Text>
          </View>
        ) : budgets.length === 0 ? (
          <View style={{ paddingVertical: 50, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="flag-outline" size={28} color={p.accentText} />
            </View>
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginTop: 14 }}>No budgets yet</Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
              Create your first savings goal below.
            </Text>
          </View>
        ) : (
          budgets.map((b) => (
            <BudgetCard key={b.id} budget={b} palette={p} onPress={() => { h.selection(); router.push(`/budgets/${b.id}`); }} />
          ))
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8, backgroundColor: p.bg, borderTopWidth: 1, borderTopColor: p.border }}>
        <CTAButton label="New budget" icon="add" onPress={() => { h.medium(); router.push('/budgets/new'); }} />
      </View>
    </ScreenShell>
  );
}

function BudgetCard({ budget: b, palette: p, onPress }: { budget: Budget; palette: Palette; onPress: () => void }) {
  const sym = fiatSymbol(b.currency as any);
  const saved = Number(b.balance);
  const target = b.targetAmount != null ? Number(b.targetAmount) : null;
  const pct = b.progressPct != null ? Math.round(b.progressPct) : (target ? Math.min(100, Math.round((saved / target) * 100)) : 0);
  const completed = b.status === 'COMPLETED';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: pressed ? p.bgRaised : p.bgElev,
        borderWidth: 1, borderColor: p.border, borderRadius: 18,
        padding: 16, marginBottom: 12,
      })}
    >
      <ProgressRing pct={target ? pct : 100} size={56} palette={p} emoji={b.emoji ?? '🎯'} done={completed} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{b.name}</Text>
          {b.locked && <Ionicons name="lock-closed" size={13} color={p.fgMuted} />}
          {completed && <Ionicons name="checkmark-circle" size={14} color={p.greenFg} />}
        </View>
        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] }}>
          {sym}{saved.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          {target != null && <Text style={{ color: p.fgFaint }}> of {sym}{target.toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>}
        </Text>
        {b.targetDate && (
          <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 2 }}>by {new Date(b.targetDate).toLocaleDateString()}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
    </Pressable>
  );
}

/** Circular progress ring with the budget emoji in the centre. */
export function ProgressRing({ pct, size, palette: p, emoji, done }: { pct: number; size: number; palette: Palette; emoji: string; done?: boolean }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  const ringColor = done ? p.greenFg : p.accent;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={ringColor} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontSize: size * 0.4 }}>{emoji}</Text>
    </View>
  );
}
