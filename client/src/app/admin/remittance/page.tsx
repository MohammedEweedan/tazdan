'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, Button, HStack, Input, Link, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, money, num, usd } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Grid, Mono, Notice, PageHeader, Pagination, Panel, ReasonModal, Stat, StatusBadge } from '@/components/cockpit/ui';

const STATES = ['', 'MANUAL_REVIEW', 'PAYOUT_PENDING', 'RECONCILIATION_PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'REJECTED', 'DISPUTED'];

export default function RemittancePage() {
  const t = useT();
  const can = useCan();
  const router = useRouter();
  const overview = useApi<any>('/cockpit/remittance', { days: 30 }, { refreshMs: 60_000 });
  const [state, setState] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useApi<any>('/cockpit/remittance/transfers', { state, q, page, limit: 25 });
  const [corridorAction, setCorridorAction] = useState<{ code: string; status: string } | null>(null);
  const o = overview.data;
  const total = o ? Object.values(o.states as Record<string, number>).reduce((a, b) => a + b, 0) : 0;

  return (
    <Box>
      <PageHeader title={t('Remittance')} subtitle="Cross-border transfers: corridors, compliance review, routing, payouts, refunds and provider performance (last 30 days)." />
      {o && o.corridors.every((c: any) => c.status !== 'LIVE') ? (
        <Box mb={4}><Notice tone="warning">No corridor is LIVE. All corridors run against SANDBOX payout rails — internal implementation complete, external payout-partner activation required before real money can move.</Notice></Box>
      ) : null}
      <ErrorBox error={overview.error} onRetry={overview.reload} />
      {o ? (
        <Box display="grid" gap={4}>
          <Grid min="180px">
            <Stat label="Transfers (30d)" value={num(total)} />
            <Stat label="In manual review" value={num(o.states.MANUAL_REVIEW ?? 0)} />
            <Stat label="Payouts in flight" value={num((o.states.PAYOUT_PENDING ?? 0) + (o.states.SETTLED ?? 0))} />
            <Stat label="Completed" value={num(o.states.COMPLETED ?? 0)} />
            <Stat label="Failed / disputed / refunding" value={num(o.failures)} />
            <Stat label="Refunded" value={num(o.states.REFUNDED ?? 0)} />
          </Grid>

          {o.reviews.length ? (
            <Panel title="Compliance review queue" subtitle="Funds are held in clearing until a decision" pad={false}>
              <DataTable rows={o.reviews} onRowClick={(r: any) => router.push(`/admin/remittance/${r.id}`)} columns={[
                { key: 'createdAt', label: 'Waiting', render: (r: any) => ago(r.createdAt) },
                { key: 'reference', label: 'Reference', render: (r: any) => <Mono>{r.reference}</Mono> },
                { key: 'user', label: 'Sender', render: (r: any) => `${r.user.firstName} ${r.user.lastName}` },
                { key: 'corridor', label: 'Corridor', render: (r: any) => r.corridor.code },
                { key: 'send', label: 'Amount', align: 'right', render: (r: any) => money(r.totalDebit, r.sourceCurrency) },
                { key: 'riskScore', label: 'Risk', align: 'right', render: (r: any) => r.riskScore ?? '—' },
              ]} />
            </Panel>
          ) : null}

          <Panel title="Corridors" subtitle="status, pricing and 30-day activity" pad={false}>
            <DataTable rows={o.corridors.map((c: any) => ({ ...c, id: c.code }))} columns={[
              { key: 'code', label: 'Corridor', render: (c: any) => <Box><Text fontWeight={600}>{c.code}</Text><Text fontSize="11px" opacity={0.7}>{c.name}</Text></Box> },
              { key: 'status', label: 'Status', render: (c: any) => <StatusBadge value={c.status} /> },
              { key: 'pricing', label: 'Pricing', render: (c: any) => `${c.feeFixed} ${c.sourceCurrency} + ${(c.feePercent * 100).toFixed(2)}% · FX margin ${(c.spreadPercent * 100).toFixed(2)}%` },
              { key: 'limits', label: 'Limits', render: (c: any) => `${num(c.minAmount)}–${num(c.maxAmount)} ${c.destCurrency}` },
              { key: 'transfers', label: 'Transfers', align: 'right' },
              { key: 'volumeUsd', label: 'Volume', align: 'right', render: (c: any) => usd(c.volumeUsd, true) },
              { key: 'feesUsd', label: 'Fees', align: 'right', render: (c: any) => usd(c.feesUsd) },
              { key: 'x', label: '', align: 'right', render: (c: any) => can('remittance.configure') ? (
                <Select size="xs" w="130px" value="" onChange={(e) => e.target.value && setCorridorAction({ code: c.code, status: e.target.value })}>
                  <option value="">Change status…</option>
                  {['LIVE', 'SANDBOX_ONLY', 'PAUSED', 'DISABLED'].filter((s) => s !== c.status).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
              ) : null },
            ]} />
          </Panel>

          <Panel title="Payout providers (30d)" pad={false}>
            <DataTable rows={o.providers.map((p: any) => ({ ...p, id: p.providerCode }))} empty="No payouts yet." columns={[
              { key: 'providerCode', label: 'Provider', render: (p: any) => <Link as={NextLink} href="/admin/providers">{p.providerCode}</Link> },
              { key: 'payouts', label: 'Payouts', align: 'right' },
              { key: 'paid', label: 'Paid', align: 'right' },
              { key: 'failed', label: 'Failed / returned', align: 'right' },
              { key: 'inFlight', label: 'In flight', align: 'right' },
              { key: 'successRate', label: 'Success', align: 'right', render: (p: any) => p.successRate === null ? '—' : `${(p.successRate * 100).toFixed(1)}%` },
              { key: 'avgDeliveryMinutes', label: 'Avg delivery', align: 'right', render: (p: any) => p.avgDeliveryMinutes === null ? '—' : `${Math.round(p.avgDeliveryMinutes)} min` },
            ]} />
          </Panel>
        </Box>
      ) : null}

      <Box mt={4}>
        <Panel title="Transfers" pad={false} actions={
          <HStack>
            <Input size="xs" w="180px" placeholder="Reference / provider ref" value={q} onChange={(e) => { setQ(e.target.value.trim()); setPage(1); }} />
            <Select size="xs" w="190px" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
              {STATES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All states'}</option>)}
            </Select>
          </HStack>
        }>
          <ErrorBox error={list.error} />
          <DataTable loading={list.loading} rows={list.data?.items} onRowClick={(r: any) => router.push(`/admin/remittance/${r.id}`)} columns={[
            { key: 'createdAt', label: 'Created', render: (r: any) => ago(r.createdAt) },
            { key: 'reference', label: 'Reference', render: (r: any) => <Mono>{r.reference}</Mono> },
            { key: 'corridor', label: 'Corridor', render: (r: any) => r.corridor.code },
            { key: 'user', label: 'Sender', render: (r: any) => `${r.user.firstName} ${r.user.lastName}` },
            { key: 'beneficiary', label: 'Beneficiary', render: (r: any) => `${r.beneficiary.fullName} · ${r.beneficiary.country}` },
            { key: 'send', label: 'Sent', align: 'right', render: (r: any) => money(r.totalDebit, r.sourceCurrency) },
            { key: 'receive', label: 'Paid out', align: 'right', render: (r: any) => money(r.receiveAmount, r.destCurrency) },
            { key: 'providerCode', label: 'Rail', render: (r: any) => r.providerCode ?? '—' },
            { key: 'state', label: 'State', render: (r: any) => <StatusBadge value={r.state} /> },
          ]} />
          {list.data ? <Pagination page={page} total={list.data.total} limit={25} onPage={setPage} /> : null}
        </Panel>
      </Box>

      <ReasonModal isOpen={Boolean(corridorAction)} onClose={() => setCorridorAction(null)} danger={corridorAction?.status !== 'LIVE'}
        title={`Set ${corridorAction?.code} to ${corridorAction?.status?.replace('_', ' ')}`} confirmLabel="Change status"
        description={corridorAction?.status === 'LIVE' ? <Text>Going LIVE is refused unless an enabled production payout partner serves this corridor.</Text> : null}
        onConfirm={async (reason) => { await api(`/cockpit/remittance/corridors/${corridorAction!.code}/status`, { method: 'PUT', body: { status: corridorAction!.status, reason } }); await overview.reload(); }} />
    </Box>
  );
}
