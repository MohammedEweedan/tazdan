'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { Box, Button, HStack, Link, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, dateTime, money, num } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Grid, JsonView, Notice, PageHeader, Pagination, Panel, ReasonModal, Stat, StatusBadge } from '@/components/cockpit/ui';

const EXCEPTION_STATUSES = ['', 'AMOUNT_MISMATCH', 'MISSING_INTERNAL', 'MISSING_EXTERNAL', 'STATUS_MISMATCH', 'FEE_MISMATCH', 'CURRENCY_MISMATCH', 'DUPLICATE', 'LATE_SETTLEMENT', 'PARTIAL', 'MATCHED'];

export default function ReconciliationPage() {
  const t = useT();
  const can = useCan();
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState('OPEN');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<any>('/cockpit/reconciliation', { status, resolution, page, limit: 25 });
  const providers = useApi<any>('/cockpit/providers');
  const [runSource, setRunSource] = useState<'LEDGER_INTEGRITY' | 'PROVIDER_STATEMENT' | null>(null);
  const [runProvider, setRunProvider] = useState('');
  const [resolve, setResolve] = useState<{ id: string; resolution: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const funds = useApi<any>('/cockpit/reconciliation/fund-integrity');
  const [fundOpen, setFundOpen] = useState<string | null>(null);
  const [ack, setAck] = useState<any | null>(null);

  const summary: any[] = data?.summary ?? [];
  const openCount = summary.filter((s) => s.status !== 'MATCHED' && s.resolution === 'OPEN').reduce((n, s) => n + s.count, 0);
  const matched = summary.filter((s) => s.status === 'MATCHED').reduce((n, s) => n + s.count, 0);
  const all = summary.reduce((n, s) => n + s.count, 0);
  const fundRows: any[] = (funds.data?.perCurrency ?? []).filter((c: any) => c.flows.length || Number(c.internalHeld) !== 0);
  const payoutProviders = (providers.data?.providers ?? []).filter((p: any) => ['PAYOUT', 'BANK', 'REMITTANCE'].includes(p.category));

  return (
    <Box>
      <PageHeader title={t('Reconciliation')} subtitle="Provider statements matched against internal payouts, and integrity checks of the ledger, wallet balances, treasury pools and clearing accounts."
        actions={can('recon.run') ? <>
          <Button size="sm" onClick={() => setRunSource('LEDGER_INTEGRITY')}>Run integrity check</Button>
          <Button size="sm" variant="outline" onClick={() => setRunSource('PROVIDER_STATEMENT')}>Reconcile provider</Button>
        </> : null} />
      {message ? <Box mb={3}><Notice>{message}</Notice></Box> : null}
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <Box display="grid" gap={4}>
          <Grid min="180px">
            <Stat label="Open exceptions" value={num(openCount)} hint={openCount ? 'need an owner' : 'none'} />
            <Stat label="Items checked (all runs)" value={num(all)} />
            <Stat label="Match rate" value={all ? `${((matched / all) * 100).toFixed(1)}%` : '—'} />
            <Stat label="Last run" value={data.runs[0] ? ago(data.runs[0].createdAt) : 'never'} hint={data.runs[0] ? `${data.runs[0].source.replace(/_/g, ' ').toLowerCase()} · ${dateTime(data.runs[0].createdAt)}` : undefined} />
          </Grid>
          <Panel title="Fund integrity" pad={false} actions={<Text fontSize="12px" opacity={0.7}>Every unit held traced to money that entered from outside</Text>}>
            <ErrorBox error={funds.error} onRetry={funds.reload} />
            <DataTable loading={funds.loading} rows={fundRows} empty="No ledger activity yet." onRowClick={(r: any) => setFundOpen(fundOpen === r.currency ? null : r.currency)} columns={[
              { key: 'currency', label: 'Currency' },
              { key: 'customerWallets', label: 'Customer wallets', align: 'right', render: (r: any) => money(r.customerWallets, r.currency) },
              { key: 'tazdanHeld', label: 'Held by Tazdan', align: 'right', render: (r: any) => money(r.tazdanHeld, r.currency) },
              { key: 'enteredOutside', label: 'Entered from outside', align: 'right', render: (r: any) => money(r.enteredOutside, r.currency) },
              { key: 'diff', label: 'Wallet drift', align: 'right', render: (r: any) => money(r.diff, r.currency) },
              { key: 'unbackedSinceBaseline', label: 'Unbacked (since baseline)', align: 'right', render: (r: any) => <Text title={`All time: ${r.unbacked}`}>{money(r.unbackedSinceBaseline, r.currency)}</Text> },
              { key: 'tradingPosition', label: 'Trading position', align: 'right', render: (r: any) => money(r.tradingPosition, r.currency) },
              { key: 'railExceptions', label: 'Record mismatches', align: 'right', render: (r: any) => num(r.railExceptions) },
              { key: 'ok', label: 'Status', render: (r: any) => <StatusBadge value={r.ok ? 'OK' : 'EXCEPTION'} /> },
              { key: 'x', label: '', align: 'right', render: (r: any) => can('adjustments.approve') && Number(r.unbackedSinceBaseline) !== 0 ? (
                <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setAck(r); }}>Acknowledge…</Button>
              ) : null },
            ]} />
            {fundOpen ? (() => {
              const r = fundRows.find((x) => x.currency === fundOpen);
              if (!r) return null;
              return (
                <Box p={3} borderTopWidth="1px">
                  <Text fontSize="12px" mb={2}>
                    {r.baseline ? `Baseline acknowledged ${dateTime(r.baseline.at)}: “${r.baseline.note}” (${money(r.baseline.amount, r.currency)})` : 'No baseline acknowledged yet. Investigate the unbacked flows below, then acknowledge them.'}
                  </Text>
                  <DataTable rows={r.flows} columns={[
                    { key: 'refType', label: 'Flow', render: (f: any) => f.refType.replace(/_/g, ' ') },
                    { key: 'class', label: 'Class', render: (f: any) => <StatusBadge value={f.class} /> },
                    { key: 'amount', label: 'Net inflow', align: 'right', render: (f: any) => money(f.amount, r.currency) },
                    { key: 'postings', label: 'Postings', align: 'right', render: (f: any) => num(f.postings) },
                  ]} />
                </Box>
              );
            })() : null}
          </Panel>
          <Panel title="Exceptions" pad={false} actions={
            <HStack>
              <Select size="xs" w="180px" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                {EXCEPTION_STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All exceptions'}</option>)}
              </Select>
              <Select size="xs" w="140px" value={resolution} onChange={(e) => { setResolution(e.target.value); setPage(1); }}>
                {['OPEN', 'RESOLVED', 'WRITTEN_OFF', 'ESCALATED', ''].map((s) => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'Any resolution'}</option>)}
              </Select>
            </HStack>
          }>
            <DataTable loading={loading} rows={data.items} empty="No exceptions match this filter." onRowClick={(r: any) => setOpen(open === r.id ? null : r.id)} columns={[
              { key: 'createdAt', label: 'Found', render: (r: any) => dateTime(r.createdAt) },
              { key: 'run', label: 'Source', render: (r: any) => `${r.run.source.replace(/_/g, ' ')}${r.run.providerCode ? ` · ${r.run.providerCode}` : ''}` },
              { key: 'status', label: 'Break', render: (r: any) => <StatusBadge value={r.status} /> },
              { key: 'internal', label: 'Internal', render: (r: any) => r.details?.transferId ? <Link as={NextLink} href={`/admin/remittance/${r.details.transferId}`} onClick={(e) => e.stopPropagation()}>{r.details.transferReference ?? r.details.transferId.slice(0, 8)}</Link> : r.internalType ? `${r.internalType.replace(/_/g, ' ').toLowerCase()} ${r.internalId?.slice(0, 8) ?? ''}` : '—' },
              { key: 'externalRef', label: 'External ref', render: (r: any) => r.externalRef ?? '—' },
              { key: 'internalAmount', label: 'Internal', align: 'right', render: (r: any) => r.internalAmount !== null ? money(r.internalAmount, r.currency ?? '') : '—' },
              { key: 'externalAmount', label: 'External', align: 'right', render: (r: any) => r.externalAmount !== null ? money(r.externalAmount, r.currency ?? '') : '—' },
              { key: 'resolution', label: 'Resolution', render: (r: any) => <StatusBadge value={r.resolution} /> },
              { key: 'x', label: '', align: 'right', render: (r: any) => can('recon.resolve') && r.resolution === 'OPEN' ? (
                <Box onClick={(e) => e.stopPropagation()}>
                  <Select size="xs" w="120px" value="" onChange={(e) => e.target.value && setResolve({ id: r.id, resolution: e.target.value })}>
                    <option value="">Resolve…</option><option value="RESOLVED">Resolved</option><option value="ESCALATED">Escalate</option><option value="WRITTEN_OFF">Write off</option>
                  </Select>
                </Box>
              ) : null },
            ]} />
            <Pagination page={page} total={data.total} limit={25} onPage={setPage} />
          </Panel>
          {open ? (
            <Panel title="Exception detail" actions={<Text as="button" fontSize="12px" onClick={() => setOpen(null)}>Close</Text>}>
              <JsonView value={data.items.find((i: any) => i.id === open) ?? null} />
            </Panel>
          ) : null}
          <Panel title="Runs" pad={false}>
            <DataTable rows={data.runs} columns={[
              { key: 'createdAt', label: 'Started', render: (r: any) => dateTime(r.createdAt) },
              { key: 'source', label: 'Source', render: (r: any) => r.source.replace(/_/g, ' ') },
              { key: 'providerCode', label: 'Provider', render: (r: any) => r.providerCode ?? '—' },
              { key: 'period', label: 'Period', render: (r: any) => r.periodStart ? `${dateTime(r.periodStart)} → ${dateTime(r.periodEnd)}` : '—' },
              { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
              { key: 'totals', label: 'Totals', render: (r: any) => r.totals ? <Text fontSize="12px">{Object.entries(r.totals).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k}: ${v}`).join(' · ')}</Text> : '—' },
              { key: 'startedById', label: 'By', render: (r: any) => r.startedById ? 'staff' : 'scheduler' },
            ]} />
          </Panel>
        </Box>
      ) : null}
      <ReasonModal isOpen={Boolean(runSource)} onClose={() => setRunSource(null)}
        title={runSource === 'LEDGER_INTEGRITY' ? 'Run ledger integrity check' : 'Reconcile a provider statement (last 48h)'} confirmLabel="Run"
        description={runSource === 'PROVIDER_STATEMENT' ? (
          <Box display="grid" gap={2}>
            <Text fontSize="12px">Pulls the provider’s statement for the last 48 hours and matches every line to an internal payout.</Text>
            <Select size="sm" value={runProvider} onChange={(e) => setRunProvider(e.target.value)}>
              <option value="">Choose provider…</option>
              {payoutProviders.map((p: any) => <option key={p.code} value={p.code}>{p.name} ({p.mode})</option>)}
            </Select>
          </Box>
        ) : <Text fontSize="12px">Checks ledger caches against entries, wallet balances against the ledger, treasury pools against their ledger accounts, clearing against in-flight transfers, and every deposit, withdrawal, on-chain, trade, treasury and payout posting against its record.</Text>}
        onConfirm={async (reason) => {
          if (runSource === 'PROVIDER_STATEMENT' && !runProvider) throw new Error('Choose a provider');
          const r = await api<any>('/cockpit/reconciliation/runs', { method: 'POST', body: runSource === 'PROVIDER_STATEMENT' ? { source: runSource, providerCode: runProvider, hours: 48, reason } : { source: runSource, reason } });
          const totals = r.run.totals ?? {};
          setMessage(`Run complete: ${Object.entries(totals).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k} ${v}`).join(', ') || 'no items'}.`);
          setPage(1); await Promise.all([reload(), funds.reload()]);
        }} />
      <ReasonModal isOpen={Boolean(ack)} onClose={() => setAck(null)} minLength={10}
        title={`Acknowledge unbacked ${ack?.currency ?? ''} history`} confirmLabel="Acknowledge"
        description={ack ? (
          <Box display="grid" gap={2}>
            <Text fontSize="12px">{money(ack.unbacked, ack.currency)} entered with no external record (opening balances backfilled from before the ledger, simulator seeds, onboarding credits, earlier reconciliations). Acknowledging records who investigated it and what they found.</Text>
            <Text fontSize="12px">No money moves. Any unbacked value after this point is reported as a breach.</Text>
          </Box>
        ) : null}
        onConfirm={async (note) => {
          const r = await api<any>('/cockpit/reconciliation/fund-integrity/baseline', { method: 'POST', body: { currency: ack.currency, note } });
          setMessage(`Acknowledged ${money(r.acknowledgedAmount, r.currency)} of historical unbacked value.`);
          await funds.reload();
        }} />
      <ReasonModal isOpen={Boolean(resolve)} onClose={() => setResolve(null)} danger={resolve?.resolution === 'WRITTEN_OFF'}
        title={`Mark exception ${resolve?.resolution.replace('_', ' ').toLowerCase()}`} confirmLabel="Save"
        description={resolve?.resolution === 'WRITTEN_OFF' ? <Text fontSize="12px">A write-off does not move money. Post a ledger adjustment through Approvals if the books need correcting.</Text> : null}
        onConfirm={async (note) => { await api(`/cockpit/reconciliation/items/${resolve!.id}/resolve`, { method: 'POST', body: { resolution: resolve!.resolution, note } }); await reload(); }} />
    </Box>
  );
}
