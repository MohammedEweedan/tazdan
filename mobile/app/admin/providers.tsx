/**
 * Providers — every external dependency: mode, health, circuit breaker,
 * 24-hour calls, and status control (enabled, maintenance, disabled).
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, NoPermission, Pill, Row, Section, Stats, ago, cockpitCall, dateTime, num,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminProviders() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const ok = can('providers.read');
  const q = useCockpit<any>(ok ? '/cockpit/providers' : null, undefined, { refreshMs: 30_000 });
  const [selected, setSelected] = useState<string | null>(null);
  const calls = useCockpit<any>(selected ? `/cockpit/providers/${selected}/calls` : null, { page: 1, limit: 30 });
  const [change, setChange] = useState<any>(null);
  const rows: any[] = q.data?.providers ?? [];

  return (
    <AdminScreen title="Providers" subtitle="External dependencies"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!ok ? <NoPermission perm="providers.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {rows.length ? (
        <Stats items={[
          { label: 'Production & enabled', value: num(rows.filter((x) => x.mode === 'PRODUCTION' && x.status === 'ENABLED').length) },
          { label: 'Circuit open', value: num(rows.filter((x) => x.circuitOpen).length), tone: rows.some((x) => x.circuitOpen) ? 'bad' : undefined },
        ]} />
      ) : null}
      <Section>
        {rows.length ? rows.map((x, i) => (
          <Row key={x.code} last={i === rows.length - 1} title={`${x.name} · ${x.mode}`}
            subtitle={`${x.code} · ${x.category} · ${num(x.calls24h)} calls · ${x.errorRate24h === null ? '—' : `${(x.errorRate24h * 100).toFixed(1)}% errors`}${x.calls24h ? ` · ${num(x.avgLatencyMs)} ms` : ''}`}
            meta={x.lastHealthAt ? `Health ${x.lastHealthOk ? 'OK' : 'FAILED'} ${ago(x.lastHealthAt)}` : 'No health check yet'}
            right={<View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Pill label={x.circuitOpen ? 'BLOCKED' : x.status} />
              {can('providers.control') ? <Btn small tone="ghost" label="Status" onPress={() => setChange(x)} /> : null}
            </View>}
            onPress={() => setSelected(x.code)} />
        )) : <Empty loading={q.isLoading} text="No providers registered." />}
      </Section>

      <BottomSheet visible={Boolean(selected)} onClose={() => setSelected(null)} title={`Call log · ${selected ?? ''}`} subtitle="Secrets and account numbers are never stored">
        {(calls.data?.items ?? []).length ? (calls.data.items as any[]).map((c, i, all) => (
          <Row key={c.id} last={i === all.length - 1} title={`${c.operation} · ${c.latencyMs ?? '—'} ms`}
            subtitle={`${c.entityType ? `${c.entityType} ${c.entityId?.slice(0, 8) ?? ''}` : '—'}${c.errorCode ? ` · ${c.errorCode}` : ''}`}
            meta={dateTime(c.createdAt)} right={<Pill label={c.success ? 'OK' : 'FAILED'} />} />
        )) : <Empty loading={calls.isLoading} text="No calls recorded." />}
      </BottomSheet>

      <ActionSheet visible={Boolean(change)} onClose={() => setChange(null)} danger title={`Status · ${change?.name ?? ''}`} confirmLabel="Change status"
        fields={[{ key: 'status', label: 'New status', type: 'select', options: ['ENABLED', 'MAINTENANCE', 'DISABLED'].filter((s) => s !== change?.status).map((s) => ({ value: s, label: s.toLowerCase() })) }]}
        description="Disabled or maintenance providers get no new traffic. In production, mock and sandbox adapters are always refused."
        onSubmit={async (v, reason) => { await cockpitCall(`/cockpit/providers/${change.code}/status`, 'PUT', { status: v.status, reason }); await refresh(); }} />
    </AdminScreen>
  );
}
