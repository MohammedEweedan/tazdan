/**
 * Account statements — generate PDF for a month, year, or custom range,
 * optionally scoped to a single currency. Output is rendered locally
 * via expo-print and shared through the OS share sheet.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';
import { PressableScale, FadeIn } from '@/components/ui/Motion';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useHaptics, useWallets } from '@/hooks';
import { exportStatementPdf, fetchStatementJson, type StatementFilter, type StatementJson } from '@/services/statements';
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
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const { data: wallets } = useWallets();

  const [range, setRange]         = useState<Range>('ALL');
  const [monthIdx, setMonthIdx]   = useState<number>(0);
  const [currency, setCurrency]   = useState<Currency | 'ALL'>('ALL');
  const [busy, setBusy]           = useState(false);
  const [preview, setPreview]     = useState<StatementJson | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
      await exportStatementPdf(useFilter, { locale });
      h.success();
    } catch (e: any) {
      h.error();
      Alert.alert(
        t('statements.failed'),
        e?.response?.data?.error ?? e?.message ?? t('statements.tryAgain'),
      );
    } finally {
      setBusy(false);
    }
  };

  const activeFilter: StatementFilter =
    range === 'CUSTOM' && months[monthIdx]
      ? { from: months[monthIdx].from, to: months[monthIdx].to, ...(currency !== 'ALL' ? { currency } : {}) }
      : filter;

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    fetchStatementJson(activeFilter)
      .then((data) => { if (!cancelled) setPreview(data); })
      .catch(() => { if (!cancelled) setPreview(null); })
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, [activeFilter.from, activeFilter.to, activeFilter.currency, activeFilter.type]);

  return (
    <ScreenShell title={t('statements.title')} subtitle={t('statements.subtitle')}>
      <FadeIn>
        <View style={{
          marginTop: 8,
          padding: 18,
          borderRadius: 22,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          gap: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="reader-outline" size={22} color={p.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>{t('statements.center')}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                {preview ? t('statements.rowsReady', { count: preview.transactions.length }) : loadingPreview ? t('statements.preparing') : t('statements.choosePeriod')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Metric label={t('statements.transactions')} value={preview?.summary.totalTransactions ?? 0} palette={p} />
            <Metric label={t('statements.fees')} value={preview ? money(preview.summary.totalFees) : '—'} palette={p} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Metric label={t('statements.deposits')} value={preview ? money(preview.summary.totalDeposits) : '—'} palette={p} />
            <Metric label={t('statements.withdrawals')} value={preview ? money(preview.summary.totalWithdrawals) : '—'} palette={p} />
          </View>
        </View>

        <Section label={t('statements.period')} p={p}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([
              ['THIS_MONTH', t('statements.thisMonth')],
              ['LAST_MONTH', t('statements.lastMonth')],
              ['YTD',        t('statements.ytd')],
              ['LAST_YEAR',  t('statements.lastYear')],
              ['ALL',        t('statements.allTime')],
              ['CUSTOM',     t('statements.pickMonth')],
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
          <Section label={t('statements.month')} p={p}>
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

        <Section label={t('statements.currency')} p={p}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              onPress={() => { h.selection(); setCurrency('ALL'); }}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <View
                style={{
                  paddingHorizontal: 12, paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: currency === 'ALL' ? p.accent : p.bgElev,
                  borderWidth: 1, borderColor: currency === 'ALL' ? p.accent : p.border,
                }}
              >
                <Text style={{ color: currency === 'ALL' ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600' }}>
                  {t('statements.allCurrencies')}
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
                    backgroundColor: currency === c ? p.accent : p.bgElev,
                    borderColor: currency === c ? p.accent : p.border,
                  }}
                  codeStyle={{ color: currency === c ? p.accentFg : p.fg }}
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
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{t('statements.pdf')}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
              {t('statements.pdfDesc')}
            </Text>
          </View>
        </View>

        <Section label={t('statements.recentRows')} p={p}>
          <View style={{
            borderRadius: 18,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
            overflow: 'hidden',
          }}>
            {loadingPreview ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <LoadingPulse size={44} icon="reader-outline" />
              </View>
            ) : preview?.transactions?.length ? (
              preview.transactions.slice(0, 6).map((tx, idx) => (
                <PreviewRow key={tx.id} tx={tx} palette={p} t={t} borderTop={idx > 0} />
              ))
            ) : (
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', padding: 16 }}>
                {t('statements.noRows')}
              </Text>
            )}
          </View>
        </Section>

        <View style={{ marginTop: 22 }}>
          <CTAButton
            label={busy ? t('statements.generating') : t('statements.generate')}
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

function Metric({ label, value, palette: p }: { label: string; value: string | number; palette: ReturnType<typeof useThemedPalette> }) {
  return (
    <View style={{ flex: 1, borderRadius: 16, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, padding: 12 }}>
      <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>{label.toUpperCase()}</Text>
      <Text numberOfLines={1} style={{ color: p.fg, fontSize: 16, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function PreviewRow({ tx, palette: p, t, borderTop }: { tx: StatementJson['transactions'][number]; palette: ReturnType<typeof useThemedPalette>; t: ReturnType<typeof useT>; borderTop?: boolean }) {
  const amt = Number(tx.amount);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 14,
      borderTopWidth: borderTop ? 1 : 0, borderTopColor: p.border,
    }}>
      <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={amt >= 0 ? 'arrow-down-left-box' : 'arrow-up-right-box'} size={17} color={amt >= 0 ? p.greenFg : p.redFg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: p.fg, fontSize: 14, fontWeight: '800' }}>{tx.type.replace(/_/g, ' ')}</Text>
        <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
          {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {tx.reference ?? t('statements.noReference')}
        </Text>
      </View>
      <Text style={{ color: amt >= 0 ? p.greenFg : p.redFg, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
        {amt >= 0 ? '+' : ''}{Number(tx.amount).toLocaleString('en-US', { maximumFractionDigits: 8 })} {tx.currency}
      </Text>
    </View>
  );
}

function money(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
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
        backgroundColor: active ? p.accent : p.bgElev,
        borderWidth: 1, borderColor: active ? p.accent : p.border,
      }}
    >
      <Text style={{ color: active ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </PressableScale>
  );
}
