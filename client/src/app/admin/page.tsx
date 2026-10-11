'use client';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { Box, Button, ButtonGroup, Flex, HStack, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { money, num, usd } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, Grid, Loading, PageHeader, Panel, Stat, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';
import { BarList, LineChart } from '@/components/cockpit/charts';

const PERIODS = [
  { key: 'today', label: 'Today', days: 7 },
  { key: '7d', label: '7 days', days: 14 },
  { key: '30d', label: '30 days', days: 60 },
  { key: 'quarter', label: 'Quarter', days: 180 },
  { key: 'year', label: 'Year', days: 365 },
];

export default function OverviewPage() {
  const t = useT();
  const c = useCockpitColors();
  const [period, setPeriod] = useState('30d');
  const p = PERIODS.find((x) => x.key === period)!;
  const { data, error, loading, reload } = useApi<any>('/cockpit/overview', { period }, { refreshMs: 60_000 });
  const series = useApi<any>('/cockpit/overview/series', { days: p.days });

  // Current window vs the equal window before it, aligned day-by-day.
  const chart = useMemo(() => {
    const rows: any[] = series.data?.series ?? [];
    const half = Math.floor(rows.length / 2);
    const prev = rows.slice(0, half);
    const cur = rows.slice(rows.length - half);
    return cur.map((r, i) => ({ day: r.day, volume: r.volumeUsd, previous: prev[i]?.volumeUsd ?? 0, fees: r.feesUsd }));
  }, [series.data]);

  const products = data ? [
    ['Deposits', data.volume.current.deposits],
    ['Withdrawals', data.volume.current.withdrawals],
    ['Internal transfers', data.volume.current.transfers],
    ['Remittance', data.volume.current.remittance],
    ['Exchange (crypto)', data.volume.current.exchange],
    ['FX conversions', data.volume.current.fx],
    ['P2P', data.volume.current.p2p],
  ].map(([label, v]: any) => ({ label, value: v.usd, sub: `${num(v.count)} txns` })) : [];

  const queues = data ? [
    { label: 'Deposits awaiting confirmation', value: data.queues.depositsAwaiting, href: '/admin/queues/deposits' },
    { label: 'Withdrawals awaiting approval', value: data.queues.withdrawalsPending, href: '/admin/queues/withdrawals' },
    { label: 'KYC reviews', value: data.queues.kycPending, href: '/admin/queues/kyc' },
    { label: 'Maker-checker approvals', value: data.queues.approvalsPending, href: '/admin/approvals' },
    { label: 'Remittances in manual review', value: data.queues.remittanceManualReview, href: '/admin/remittance' },
    { label: 'Open compliance cases', value: data.queues.casesOpen, href: '/admin/compliance' },
    { label: 'Open AML flags', value: data.queues.amlOpen, href: '/admin/compliance' },
    { label: 'Reconciliation exceptions', value: data.queues.reconciliationExceptions, href: '/admin/reconciliation' },
    { label: 'Support escalations', value: data.queues.escalationsOpen, href: '/admin/support' },
  ] : [];

  return (
    <Box>
      <PageHeader
        title={t('Overview')}
        subtitle={data ? `Live platform data · ${new Date(data.window.from).toLocaleDateString('en-GB')} – ${new Date(data.window.to).toLocaleDateString('en-GB')} · ${t('vs previous period')}` : 'Live platform data'}
        actions={
          <ButtonGroup size="xs" isAttached variant="outline">
            {PERIODS.map((x) => (
              <Button key={x.key} onClick={() => setPeriod(x.key)} colorScheme={period === x.key ? 'brand' : undefined} variant={period === x.key ? 'solid' : 'outline'}>{t(x.label)}</Button>
            ))}
          </ButtonGroup>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {!data && loading ? <Loading lines={8} /> : null}
      {data ? (
        <Box display="grid" gap={4}>
          <Grid min="190px">
            <Stat label={t('Total customers')} value={num(data.customers.total)} hint={`${num(data.customers.verified)} verified · ${num(data.customers.business)} business`} />
            <Stat label={t('Active customers')} value={num(data.customers.active)} delta={data.customers.activeChangePct} />
            <Stat label="New customers" value={num(data.customers.new)} delta={data.customers.newChangePct} />
            <Stat label={t('Volume')} value={usd(data.volume.current.total, true)} delta={data.volume.totalChangePct} />
            <Stat label={t('Revenue')} value={usd(data.revenue.current.totalUsd, true)} delta={data.revenue.changePct} />
            <Stat label="Take rate" value={`${data.revenue.takeRatePct.toFixed(2)}%`} hint="revenue ÷ volume" />
            <Stat label={t('Customer balances')} value={usd(data.customerBalancesUsd, true)} hint="all wallets, USD at current rates" />
          </Grid>

          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={4}>
            <Panel title="Daily volume (USD)" subtitle={`${series.data?.valuation ?? 'USD at current rates'} · deposits, withdrawals, transfers, remittance`}>
              {series.loading && !series.data ? <Loading /> : (
                <LineChart data={chart} xKey="day" area format={(n) => usd(n, true)}
                  series={[{ key: 'volume', label: 'This period', color: c.series1 }, { key: 'previous', label: 'Previous period', color: c.seriesPrev, dashed: true }]} />
              )}
            </Panel>
            <Panel title="Volume by product" subtitle="this period, USD">
              <BarList items={products} format={(n) => usd(n, true)} />
            </Panel>
          </Box>

          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            <Panel title="Daily fee revenue (USD)">
              {series.loading && !series.data ? <Loading /> : (
                <LineChart data={chart} xKey="day" format={(n) => usd(n, true)} series={[{ key: 'fees', label: 'Fees', color: c.series1 }]} />
              )}
            </Panel>
            <Panel title="Funds segregation" subtitle="ledger balances by fund class, USD at current rates">
              <Box display="grid" gap={3}>
                {([
                  ['CUSTOMER', t('Customer funds'), 'Owed to customers: balances, escrow, remittances in transit'],
                  ['SETTLEMENT', t('Settlement & treasury funds'), 'Rails, partners, prefunding, suspense, adjustments (net, signed)'],
                  ['CORPORATE', t('Corporate funds'), 'Tazdan revenue'],
                ] as const).map(([k, label, note]) => (
                  <Flex key={k} justify="space-between" align="baseline" borderBottom="1px solid" borderColor={c.border} pb={2}>
                    <Box><Text fontSize="13px" fontWeight={600}>{label}</Text><Text fontSize="11px" color={c.muted}>{note}</Text></Box>
                    <Text fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{usd(data.funds.usdByClass[k] ?? 0)}</Text>
                  </Flex>
                ))}
                <Text fontSize="11px" color={c.faint}>System rail accounts are signed (money entering the books shows as negative on its source rail). Customer and corporate totals are what is owed.</Text>
              </Box>
            </Panel>
          </Box>

          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            <Panel title={t('Work queues')}>
              <Box display="grid" gap={1}>
                {queues.map((q) => (
                  <Flex key={q.label} as={NextLink} href={q.href} justify="space-between" py={1.5} px={2} borderRadius="6px" _hover={{ bg: c.surface2 }}>
                    <Text fontSize="13px">{q.label}</Text>
                    <Text fontSize="13px" fontWeight={700} color={q.value > 0 ? c.text : c.faint}>{num(q.value)}</Text>
                  </Flex>
                ))}
              </Box>
            </Panel>
            <Panel title="Risk & platform status">
              <Box display="grid" gap={2.5}>
                <Flex justify="space-between"><Text fontSize="13px">Trading / conversions</Text><StatusBadge value={data.risk.tradingHalted ? 'BLOCKED' : 'ACTIVE'} /></Flex>
                <Flex justify="space-between"><Text fontSize="13px">Active kill switches</Text><Text fontSize="13px" fontWeight={700}>{num(data.risk.activeControls)}</Text></Flex>
                <Flex justify="space-between"><Text fontSize="13px">Providers</Text>
                  <HStack spacing={2}>{Object.entries(data.providers).map(([s, n]: any) => <HStack key={s} spacing={1}><StatusBadge value={s} /><Text fontSize="12px">{n}</Text></HStack>)}{!Object.keys(data.providers).length ? <Text fontSize="12px" color={c.faint}>none registered</Text> : null}</HStack>
                </Flex>
                <Flex justify="space-between"><Text fontSize="13px">Failed sign-ins (period)</Text><Text fontSize="13px" fontWeight={700}>{num(data.security.failedLogins)}</Text></Flex>
                <Flex justify="space-between"><Text fontSize="13px">Access denied events (period)</Text><Text fontSize="13px" fontWeight={700}>{num(data.security.accessDenied)}</Text></Flex>
              </Box>
            </Panel>
          </Box>

          <Panel title="Customer balances by currency" subtitle="excludes internal platform and support accounts" pad={false}>
            <DataTable rows={data.balances} columns={[
              { key: 'currency', label: t('Currency') },
              { key: 'balance', label: 'Balance', align: 'right', render: (r: any) => money(r.balance, r.currency) },
              { key: 'held', label: 'Held / reserved', align: 'right', render: (r: any) => money(r.held, r.currency) },
              { key: 'available', label: 'Available', align: 'right', render: (r: any) => money(r.available, r.currency) },
              { key: 'usd', label: 'USD', align: 'right', render: (r: any) => usd(r.usd) },
            ]} />
          </Panel>
        </Box>
      ) : null}
    </Box>
  );
}
