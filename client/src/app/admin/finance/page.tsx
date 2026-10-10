'use client';

import { useState } from 'react';
import { Box, Select, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { money, num, usd } from '@/lib/cockpit/format';
import { BarList, LineChart } from '@/components/cockpit/charts';
import { DataTable, ErrorBox, Grid, PageHeader, Panel, Stat, useCockpitColors } from '@/components/cockpit/ui';

const entries = (o: Record<string, number> | undefined) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]);

export default function FinancePage() {
  const t = useT();
  const c = useCockpitColors();
  const [days, setDays] = useState(90);
  const { data, error, reload } = useApi<any>('/cockpit/finance', { days });

  return (
    <Box>
      <PageHeader title={t('Finance')} subtitle="Volume, revenue, estimated provider costs and margin from recorded activity. Every figure comes from the ledger or transaction tables."
        actions={<Select size="sm" w="140px" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[30, 90, 180, 365].map((n) => <option key={n} value={n}>Last {n} days</option>)}</Select>} />
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <Box display="grid" gap={4}>
          <Grid min="170px">
            <Stat label="Gross volume" value={usd(data.gtvUsd, true)} hint={`${data.days} days`} />
            <Stat label="Revenue" value={usd(data.revenueUsd)} />
            <Stat label="Est. provider costs" value={usd(data.providerCostsUsd)} />
            <Stat label="Est. gross margin" value={usd(data.estimatedGrossMarginUsd)} />
            <Stat label="Take rate" value={`${data.takeRatePct.toFixed(2)}%`} hint="revenue ÷ volume" />
            <Stat label="Business customers" value={num(data.businessCustomers)} />
          </Grid>
          <Panel title="Daily volume (USD)">
            <LineChart data={data.dailyVolume} xKey="day" area format={(n) => usd(n, true)} series={[{ key: 'usd', label: 'Volume', color: c.series1 }]} />
          </Panel>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            <Panel title="Revenue by source"><BarList items={entries(data.revenueByProduct).map(([k, v]) => ({ label: k, value: v }))} format={(n) => usd(n)} /></Panel>
            <Panel title="Volume by product"><BarList items={entries(data.volumeByProduct).map(([k, v]) => ({ label: k, value: v }))} format={(n) => usd(n, true)} /></Panel>
            <Panel title="Volume by currency"><BarList items={entries(data.volumeByCurrency).map(([k, v]) => ({ label: k, value: v }))} format={(n) => usd(n, true)} /></Panel>
            <Panel title="Remittance volume by corridor"><BarList items={entries(data.volumeByCorridor).map(([k, v]) => ({ label: k, value: v }))} format={(n) => usd(n, true)} /></Panel>
          </Box>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            <Panel title="Estimated provider costs" subtitle="from configured rail terms" pad={false}>
              <DataTable rows={entries(data.providerCostsByProvider).map(([k, v]) => ({ id: k, provider: k, usd: v }))} empty="No paid payouts in this period." columns={[
                { key: 'provider', label: 'Provider' }, { key: 'usd', label: 'Cost', align: 'right', render: (r: any) => usd(r.usd) },
              ]} />
            </Panel>
            <Panel title="Ledger revenue postings by month" subtitle="credits to the platform account, native currency" pad={false}>
              <DataTable rows={data.ledgerRevenueByType.map((r: any, i: number) => ({ ...r, id: i }))} empty="No platform revenue postings." columns={[
                { key: 'month', label: 'Month', render: (r: any) => new Date(r.month).toISOString().slice(0, 7) },
                { key: 'refType', label: 'Source', render: (r: any) => r.refType.replace(/_/g, ' ') },
                { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => money(r.amount, r.currency) },
              ]} />
            </Panel>
          </Box>
          <Panel title="How these numbers are built">
            <Box as="ul" pl={5} fontSize="13px">{data.notes.map((n: string) => <Text as="li" key={n}>{n}</Text>)}</Box>
          </Panel>
        </Box>
      ) : null}
    </Box>
  );
}
