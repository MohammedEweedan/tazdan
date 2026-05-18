/**
 * Account statements — generate PDF for a month, year, or custom range,
 * optionally scoped to a single currency. Output is rendered locally
 * via expo-print and shared through the OS share sheet.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';
import { PressableScale, FadeIn } from '@/components/ui/Motion';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useWallets } from '@/hooks';
import { exportStatementPdf, type StatementFilter } from '@/services/statements';
import type { Currency } from '@/types';

type Range = 'THIS_MONTH' | 'LAST_MONTH' | 'YTD' | 'LAST_YEAR' | 'ALL' | 'CUSTOM';

interface MonthOption { label: string; from: string; to: string; }

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeToDates(r: Range, custom?: { from?: string; to?: string }): { from?: string; to?: string } {
  const now = new Date();
  switch (r) {
    case 'THIS_MONTH': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: ymd(from), to: ymd(now) };
    }
    case 'LAST_MONTH': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: ymd(from), to: ymd(to) };
    }
    case 'YTD': {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: ymd(from), to: ymd(now) };
    }
    case 'LAST_YEAR': {
      const from = new Date(now.getFullYear() - 1, 0, 1);
      const to   = new Date(now.getFullYear() - 1, 11, 31);
      return { from: ymd(from), to: ymd(to) };
    }
    case 'CUSTOM':
      return { from: custom?.from, to: custom?.to };
    case 'ALL':
    default:
      return {};
  }
}

/** Build the 12 most recent month options the user can pick. */
function recentMonths(): MonthOption[] {
  const out: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const to   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    out.push({
      label: ref.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      from: ymd(from),
      to: ymd(to),
    });
  }
  return out;
}

export default function Statements() {
  const p = useThemedPalette();
  const h = useHaptics();
  const { data: wallets } = useWallets();

  const [range, setRange]         = useState<Range>('THIS_MONTH');
  const [monthIdx, setMonthIdx]   = useState<number>(0);
  const [currency, setCurrency]   = useState<Currency | 'ALL'>('ALL');
  const [busy, setBusy]           = useState(false);

  const months = useMemo(() => recentMonths(), []);
  const holdingCurrencies = useMemo<Currency[]>(() => {
    const list = (wallets ?? [])
      .filter((w) => Number(w.balance) > 0)
      .map((w) => w.currency as Currency);
    return Array.from(new Set(list));
  }, [wallets]);

  const filter: StatementFilter = useMemo(() => {
    const base = range === 'CUSTOM' ? rangeToDates('CUSTOM') : rangeToDates(range);
    return {
      ...base,
      ...(currency !== 'ALL' ? { currency } : {}),
    };
  }, [range, currency]);

  const onGenerate = async () => {
    try {
      setBusy(true);
      h.medium();
      const useFilter: StatementFilter =
        range === 'CUSTOM' && months[monthIdx]
          ? { from: months[monthIdx].from, to: months[monthIdx].to, ...(currency !== 'ALL' ? { currency } : {}) }
          : filter;
      await exportStatementPdf(useFilter);
      h.success();
    } catch (e: any) {
      h.error();
      Alert.alert(
        'Statement failed',
        e?.response?.data?.error ?? e?.message ?? 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell title="Statements" subtitle="Download PDF for tax, audit, or your records">
      <FadeIn>
        <Section label="PERIOD" p={p}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([
              ['THIS_MONTH', 'This month'],
              ['LAST_MONTH', 'Last month'],
              ['YTD',        'Year to date'],
              ['LAST_YEAR',  'Last year'],
              ['ALL',        'All time'],
              ['CUSTOM',     'Pick month'],
            ] as Array<[Range, string]>).map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                active={range === key}
                onPress={() => { h.selection(); setRange(key); }}
                palette={p}
              />
            ))}
          </View>
        </Section>

        {range === 'CUSTOM' && (
          <Section label="MONTH" p={p}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {months.map((m, i) => (
                <Chip
                  key={m.label}
                  label={m.label}
                  active={monthIdx === i}
                  onPress={() => { h.selection(); setMonthIdx(i); }}
                  palette={p}
                />
              ))}
            </ScrollView>
          </Section>
        )}

        <Section label="CURRENCY" p={p}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              onPress={() => { h.selection(); setCurrency('ALL'); }}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <View
                style={{
                  paddingHorizontal: 12, paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: currency === 'ALL' ? p.fg : p.bgElev,
                  borderWidth: 1, borderColor: currency === 'ALL' ? p.fg : p.border,
                }}
              >
                <Text style={{ color: currency === 'ALL' ? p.bg : p.fg, fontSize: 12, fontWeight: '600' }}>
                  All currencies
                </Text>
              </View>
            </Pressable>
            {holdingCurrencies.map((c) => (
              <Pressable
                key={c}
                onPress={() => { h.selection(); setCurrency(c); }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <CurrencyBadge
                  code={c}
                  variant="chip"
                  size="md"
                  style={{
                    backgroundColor: currency === c ? p.fg : p.bgElev,
                    borderColor: currency === c ? p.fg : p.border,
                  }}
                  codeStyle={{ color: currency === c ? p.bg : p.fg }}
                />
              </Pressable>
            ))}
          </View>
        </Section>

        <View
          style={{
            marginTop: 24,
            padding: 14,
            borderRadius: 14,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
        >
          <View
            style={{
              width: 40, height: 40, borderRadius: 12,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: p.pillBg,
            }}
          >
            <Ionicons name="document-text" size={20} color={p.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>PDF · A4 portrait</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
              Account summary · balances · full transaction ledger
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <CTAButton
            label={busy ? 'Generating…' : 'Generate PDF statement'}
            icon={busy ? 'hourglass' : 'download'}
            loading={busy}
            onPress={onGenerate}
          />
        </View>
        {busy && (
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <LoadingPulse size={48} icon="document-text-outline" />
          </View>
        )}
      </FadeIn>
    </ScreenShell>
  );
}

function Section({ label, p, children }: { label: string; p: ReturnType<typeof useThemedPalette>; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text
        style={{
          color: p.fgMuted, fontSize: 11, fontWeight: '600',
          letterSpacing: 0.8, marginBottom: 10,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Chip({
  label, active, onPress, palette: p,
}: { label: string; active: boolean; onPress: () => void; palette: ReturnType<typeof useThemedPalette> }) {
  return (
    <PressableScale
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? p.fg : p.bgElev,
        borderWidth: 1, borderColor: active ? p.fg : p.border,
      }}
    >
      <Text style={{ color: active ? p.bg : p.fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </PressableScale>
  );
}
