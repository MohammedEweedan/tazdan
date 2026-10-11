'use client';

import { useState } from 'react';
import { Box, HStack, Select, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { num, usd } from '@/lib/cockpit/format';
import { LineChart } from '@/components/cockpit/charts';
import { DataTable, ErrorBox, Notice, PageHeader, Panel, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

export default function ForecastsPage() {
  const t = useT();
  const c = useCockpitColors();
  const [history, setHistory] = useState(120);
  const [horizon, setHorizon] = useState(30);
  const { data, error, reload } = useApi<any>('/cockpit/forecasts', { days: history, horizon });

  return (
    <Box>
      <PageHeader title={t('Forecasts')} subtitle="Short-range projections from this platform's own recorded history, with an 80% range. These are planning aids, not predictions."
        actions={
          <HStack>
            <Select size="sm" w="175px" value={history} onChange={(e) => setHistory(Number(e.target.value))}>{[60, 120, 180, 365].map((n) => <option key={n} value={n}>{n} days history</option>)}</Select>
            <Select size="sm" w="165px" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>{[7, 14, 30, 60, 90].map((n) => <option key={n} value={n}>{n}-day horizon</option>)}</Select>
          </HStack>
        } />
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <Box display="grid" gap={4}>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            {data.metrics.map((m: any) => <MetricForecast key={m.key} m={m} color={c.series1} />)}
          </Box>
          <Panel title="Treasury cover" subtitle={`days each pool lasts at the 30-day average payout rate; need over the next ${data.horizonDays} days`} pad={false}>
            <DataTable rows={data.liquidity.map((l: any) => ({ ...l, id: l.pool }))} columns={[
              { key: 'pool', label: 'Pool' }, { key: 'currency', label: 'Currency' },
              { key: 'available', label: 'Available', align: 'right', render: (l: any) => num(l.available) },
              { key: 'avgDailyPayout', label: 'Avg daily payout', align: 'right', render: (l: any) => num(l.avgDailyPayout) },
              { key: 'daysOfCover', label: 'Days of cover', align: 'right', render: (l: any) => l.daysOfCover === null ? 'no payouts yet' : num(l.daysOfCover) },
              { key: 'neededForHorizon', label: `Need (${data.horizonDays}d)`, align: 'right', render: (l: any) => num(l.neededForHorizon) },
              { key: 'shortfall', label: 'Shortfall', align: 'right', render: (l: any) => l.shortfall > 0 ? <HStack justify="flex-end"><StatusBadge value="HIGH" /><Text>{num(l.shortfall)}</Text></HStack> : '—' },
            ]} />
          </Panel>
        </Box>
      ) : null}
    </Box>
  );
}

function MetricForecast({ m, color }: { m: any; color: string }) {
  const fmt = m.unit === 'USD' ? (n: number) => usd(n, true) : (n: number) => num(Math.round(n * 10) / 10);
  // One x-axis: history days carry `actual`, forecast days carry `forecast`
  // and the band; the last history day is repeated as the forecast's start so
  // the two lines join.
  // Too little activity → show the recorded history only; a fan drawn from
  // one or two active days would look like information when it is not.
  const usable = !m.insufficientHistory && m.nonZeroDays >= 7 && m.forecast.length > 0;
  const forecast = usable ? m.forecast : [];
  const last = m.history[m.history.length - 1];
  const rows = [
    ...m.history.map((h: any) => ({ day: h.day, actual: h.value, forecast: null, low: null, high: null })),
    ...forecast.map((f: any) => ({ day: f.day, actual: null, forecast: f.value, low: f.low, high: f.high })),
  ];
  if (last && forecast.length) { const i = m.history.length - 1; rows[i] = { ...rows[i], forecast: last.value, low: last.value, high: last.value }; }
  const totalNext = forecast.reduce((a: number, f: any) => a + f.value, 0);
  const totalPrev = m.history.slice(-m.horizonDays).reduce((a: number, h: any) => a + h.value, 0);

  return (
    <Panel title={m.label} subtitle={usable ? `next ${m.horizonDays} days: ${fmt(totalNext)} (previous ${m.horizonDays}: ${fmt(totalPrev)})` : `recorded history only · last ${m.horizonDays} days: ${fmt(totalPrev)}`}>
      {!usable ? (
        <Box mb={2}><Notice tone="warning">{m.nonZeroDays} day{m.nonZeroDays === 1 ? '' : 's'} with activity in this window. A forecast needs at least 7, so none is shown yet.</Notice></Box>
      ) : null}
      <LineChart data={rows} xKey="day" format={fmt} height={200}
        series={usable ? [{ key: 'actual', label: 'Recorded', color }, { key: 'forecast', label: 'Forecast', color, dashed: true }] : [{ key: 'actual', label: 'Recorded', color }]}
        band={usable ? { lowKey: 'low', highKey: 'high', color, label: '80% range' } : undefined}
        markerIndex={usable ? m.history.length - 1 : undefined} markerLabel="today" />
      {usable ? <Text mt={2} fontSize="11px" opacity={0.7}>{m.method}{m.alpha ? ` (α ${m.alpha}, β ${m.beta})` : ''}. {m.assumptions[1]}</Text> : null}
    </Panel>
  );
}
