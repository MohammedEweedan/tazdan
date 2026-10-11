'use client';

import { Box, Flex, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, num } from '@/lib/cockpit/format';
import { LineChart } from '@/components/cockpit/charts';
import { DataTable, ErrorBox, Grid, Loading, PageHeader, Panel, Stat, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

export default function SystemPage() {
  const t = useT();
  const c = useCockpitColors();
  const { data, error, loading, reload } = useApi<any>('/cockpit/system', undefined, { refreshMs: 20_000 });
  const history = (data?.history ?? []).filter((h: any) => h.totals).map((h: any) => ({ at: new Date(h.at).toISOString().slice(0, 16).replace('T', ' '), p95: h.totals.p95, p50: h.totals.p50 }));

  return (
    <Box>
      <PageHeader title={t('System health')} subtitle="Measured in this API process (refreshes every 20s). History is sampled every 5 minutes." />
      <ErrorBox error={error} onRetry={reload} />
      {!data && loading ? <Loading lines={8} /> : null}
      {data ? (
        <Box display="grid" gap={4}>
          <Grid min="180px">
            <Stat label="Overall" value={<StatusBadge value={data.status === 'ok' ? 'OK' : 'DEGRADED'} />} hint={`${data.environment} · v${data.version}${data.commit ? ` · ${data.commit.slice(0, 7)}` : ''}`} />
            <Stat label="API p50 / p95 / p99" value={`${data.api.totals.p50} / ${data.api.totals.p95} / ${data.api.totals.p99} ms`} hint={`last ${data.api.windowMinutes} min`} />
            <Stat label="Throughput" value={`${data.api.totals.perMinute}/min`} hint={`${num(data.api.totals.requests)} requests`} />
            <Stat label="5xx error rate" value={`${(data.api.totals.errorRate * 100).toFixed(2)}%`} />
            <Stat label="Database" value={data.database.ok ? `${data.database.latencyMs} ms` : 'DOWN'} hint={data.database.connections !== undefined ? `${data.database.connections}/${data.database.maxConnections} connections · ${data.database.sizeMb} MB` : undefined} />
            <Stat label="Redis" value={data.redis.ok ? `${data.redis.latencyMs} ms` : data.redis.configured ? 'DOWN' : 'Not configured'} />
            <Stat label="Event-loop lag p99" value={`${data.api.eventLoopLagMs.p99} ms`} hint={`max ${data.api.eventLoopLagMs.max} ms`} />
            <Stat label="Process memory" value={`${data.api.process.rssMb} MB`} hint={`heap ${data.api.process.heapUsedMb} MB · up ${Math.round(data.api.process.uptimeSeconds / 3600)}h`} />
          </Grid>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            <Panel title="Latency history (ms)">
              {history.length ? <LineChart data={history} xKey="at" format={(n) => `${Math.round(n)}`}
                series={[{ key: 'p95', label: 'p95', color: c.series1 }, { key: 'p50', label: 'p50', color: c.seriesPrev, dashed: true }]} />
                : <Text fontSize="sm" color={c.muted}>No samples yet — the first snapshot is written five minutes after start-up.</Text>}
            </Panel>
            <Panel title="Platform checks">
              <Box display="grid" gap={2}>
                <Flex justify="space-between"><Text fontSize="13px">Trading / conversions</Text><StatusBadge value={data.tradingHalted ? 'BLOCKED' : 'ACTIVE'} /></Flex>
                <Flex justify="space-between"><Text fontSize="13px">Last reconciliation run</Text><Text fontSize="13px">{data.reconciliation ? `${dateTime(data.reconciliation.lastRunAt)} · ${data.reconciliation.status}` : 'none yet'}</Text></Flex>
                <Flex justify="space-between"><Text fontSize="13px">Rejected webhooks (24h)</Text><Text fontSize="13px" fontWeight={700}>{num(data.webhookRejects24h)}</Text></Flex>
                <Text fontSize="12px" fontWeight={600} mt={2}>Provider calls (last hour)</Text>
                <DataTable rows={data.providerCalls.map((p: any) => ({ ...p, id: p.provider }))} empty="No provider calls in the last hour." columns={[
                  { key: 'provider', label: 'Provider' }, { key: 'callsLastHour', label: 'Calls', align: 'right' }, { key: 'avgLatencyMs', label: 'Avg ms', align: 'right' },
                ]} />
              </Box>
            </Panel>
          </Box>
          <Panel title="Endpoints (last 15 minutes)" pad={false}>
            <DataTable rows={data.api.groups.map((g: any) => ({ ...g, id: g.group }))} empty="No traffic recorded yet." columns={[
              { key: 'group', label: 'Route' },
              { key: 'count', label: 'Requests', align: 'right' },
              { key: 'perMinute', label: '/min', align: 'right' },
              { key: 'p50', label: 'p50 ms', align: 'right' },
              { key: 'p95', label: 'p95 ms', align: 'right' },
              { key: 'p99', label: 'p99 ms', align: 'right' },
              { key: 'errorRate', label: '5xx', align: 'right', render: (g: any) => `${(g.errorRate * 100).toFixed(1)}%` },
              { key: 'clientErrorRate', label: '4xx', align: 'right', render: (g: any) => `${(g.clientErrorRate * 100).toFixed(1)}%` },
            ]} />
          </Panel>
          <Panel title="Largest tables" pad={false}>
            <DataTable rows={data.largestTables.map((x: any) => ({ ...x, id: x.table }))} columns={[{ key: 'table', label: 'Table' }, { key: 'rows', label: 'Live rows', align: 'right', render: (r: any) => num(r.rows) }]} />
          </Panel>
        </Box>
      ) : null}
    </Box>
  );
}
