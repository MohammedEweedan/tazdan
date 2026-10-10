'use client';

import { useState } from 'react';
import { Box, HStack, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, dateTime, num } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Grid, ModeBadge, Notice, PageHeader, Pagination, Panel, ReasonModal, Stat, StatusBadge } from '@/components/cockpit/ui';

export default function ProvidersPage() {
  const t = useT();
  const can = useCan();
  const { data, error, reload } = useApi<any>('/cockpit/providers', undefined, { refreshMs: 30_000 });
  const [change, setChange] = useState<{ code: string; name: string; status: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const calls = useApi<any>(selected ? `/cockpit/providers/${selected}/calls` : null, { page, limit: 25 });
  const rows: any[] = data?.providers ?? [];
  const production = rows.filter((p) => p.mode === 'PRODUCTION' && p.status === 'ENABLED').length;

  return (
    <Box>
      <PageHeader title={t('Providers')} subtitle="Every external dependency, its mode, health, circuit breaker and 24-hour call record. Mock and sandbox adapters are refused in production." />
      {data && production === 0 ? (
        <Box mb={4}><Notice tone="warning">No production payout or banking partner is enabled. Sandbox rails exercise the full flow; real partner contracts and credentials are required before go-live (external provider activation required).</Notice></Box>
      ) : null}
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <Box display="grid" gap={4}>
          <Grid min="180px">
            <Stat label="Providers" value={num(rows.length)} />
            <Stat label="Enabled" value={num(rows.filter((p) => p.status === 'ENABLED').length)} />
            <Stat label="Production mode" value={num(rows.filter((p) => p.mode === 'PRODUCTION').length)} />
            <Stat label="Circuit open" value={num(rows.filter((p) => p.circuitOpen).length)} />
            <Stat label="Calls (24h)" value={num(rows.reduce((n, p) => n + p.calls24h, 0))} />
          </Grid>
          <Panel title="Provider registry" subtitle="click a row for its call log" pad={false}>
            <DataTable rows={rows.map((p) => ({ ...p, id: p.code }))} onRowClick={(p: any) => { setSelected(p.code); setPage(1); }} columns={[
              { key: 'code', label: 'Provider', render: (p: any) => <Box><Text fontWeight={600}>{p.name}</Text><Text fontSize="11px" opacity={0.7}>{p.code} · {p.category}</Text></Box> },
              { key: 'mode', label: 'Mode', render: (p: any) => <ModeBadge mode={p.mode} /> },
              { key: 'status', label: 'Status', render: (p: any) => <HStack><StatusBadge value={p.status} />{p.circuitOpen ? <StatusBadge value="BLOCKED" /> : null}</HStack> },
              { key: 'health', label: 'Last health check', render: (p: any) => p.lastHealthAt ? <Box><StatusBadge value={p.lastHealthOk ? 'OK' : 'FAILED'} /><Text fontSize="11px" opacity={0.7}>{ago(p.lastHealthAt)}{p.lastLatencyMs !== null ? ` · ${p.lastLatencyMs} ms` : ''}</Text></Box> : <Text fontSize="12px" opacity={0.7}>never</Text> },
              { key: 'coverage', label: 'Coverage', render: (p: any) => <Text fontSize="12px" maxW="220px">{[(p.countries ?? []).join(' '), (p.currencies ?? []).join(' ')].filter(Boolean).join(' · ') || '—'}</Text> },
              { key: 'calls24h', label: 'Calls 24h', align: 'right', render: (p: any) => num(p.calls24h) },
              { key: 'errorRate24h', label: 'Errors', align: 'right', render: (p: any) => p.errorRate24h === null ? '—' : `${(p.errorRate24h * 100).toFixed(1)}%` },
              { key: 'avgLatencyMs', label: 'Avg ms', align: 'right', render: (p: any) => p.calls24h ? num(p.avgLatencyMs) : '—' },
              { key: 'successRate30d', label: 'Payout success 30d', align: 'right', render: (p: any) => p.successRate30d === null ? '—' : `${(p.successRate30d * 100).toFixed(1)}%` },
              { key: 'x', label: '', align: 'right', render: (p: any) => can('providers.control') ? (
                <Box onClick={(e) => e.stopPropagation()}>
                  <Select size="xs" w="130px" value="" onChange={(e) => e.target.value && setChange({ code: p.code, name: p.name, status: e.target.value })}>
                    <option value="">Set status…</option>
                    {['ENABLED', 'MAINTENANCE', 'DISABLED'].filter((s) => s !== p.status).map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Box>
              ) : null },
            ]} />
          </Panel>
          {selected ? (
            <Panel title={`Call log · ${selected}`} subtitle="request/response metadata; secrets and account numbers are never stored" pad={false}
              actions={<Text as="button" fontSize="12px" onClick={() => setSelected(null)}>Close</Text>}>
              <ErrorBox error={calls.error} />
              <DataTable loading={calls.loading} rows={calls.data?.items} empty="No calls recorded." columns={[
                { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
                { key: 'operation', label: 'Operation' },
                { key: 'success', label: 'Result', render: (r: any) => <StatusBadge value={r.success ? 'OK' : 'FAILED'} /> },
                { key: 'entity', label: 'Entity', render: (r: any) => r.entityType ? `${r.entityType} ${r.entityId?.slice(0, 8) ?? ''}` : '—' },
                { key: 'latencyMs', label: 'ms', align: 'right' },
                { key: 'errorCode', label: 'Error', render: (r: any) => r.errorCode ?? '—' },
                { key: 'correlationId', label: 'Correlation', render: (r: any) => <Text fontSize="11px" fontFamily="mono">{r.correlationId?.slice(0, 12) ?? '—'}</Text> },
              ]} />
              {calls.data ? <Pagination page={page} total={calls.data.total} limit={25} onPage={setPage} /> : null}
            </Panel>
          ) : null}
        </Box>
      ) : null}
      <ReasonModal isOpen={Boolean(change)} onClose={() => setChange(null)} danger={change?.status !== 'ENABLED'}
        title={`Set ${change?.name} to ${change?.status}`} confirmLabel="Change status"
        description={change?.status === 'ENABLED' ? <Text fontSize="12px">Sandbox and mock adapters cannot be enabled when the server runs in production.</Text> : <Text fontSize="12px">Routing stops sending new transfers to this provider immediately. In-flight payouts continue to be tracked.</Text>}
        onConfirm={async (reason) => { await api(`/cockpit/providers/${change!.code}/status`, { method: 'PUT', body: { status: change!.status, reason } }); await reload(); }} />
    </Box>
  );
}
