'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { Box, Button, HStack, Link, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { dateTime, money, shortId } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { LedgerGroups, Timeline } from '@/components/cockpit/detail';
import { DataTable, ErrorBox, JsonView, KV, Loading, Mono, Notice, PageHeader, Panel, ReasonModal, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

export default function RemittanceDetail() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const c = useCockpitColors();
  const { data, error, loading, reload } = useApi<any>(`/cockpit/remittance/transfers/${id}`);
  const [action, setAction] = useState<'approve' | 'reject' | 'retry' | 'refund' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (loading && !data) return <Loading lines={10} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;
  const t = data.transfer;
  const sandbox = t.corridor.status !== 'LIVE';
  const paid = ['PAID', 'RECONCILIATION_PENDING', 'RECONCILED', 'COMPLETED'].includes(t.state);

  return (
    <Box>
      <PageHeader
        title={`Remittance ${t.reference}`}
        subtitle={<HStack spacing={2} flexWrap="wrap"><StatusBadge value={t.state} /><Text>{t.corridor.name}</Text><Text>· {money(t.totalDebit, t.sourceCurrency)} → {money(t.receiveAmount, t.destCurrency)}</Text></HStack>}
        actions={
          <>
            {t.state === 'MANUAL_REVIEW' && can('compliance.decide') ? <><Button size="sm" colorScheme="brand" onClick={() => setAction('approve')}>Approve</Button><Button size="sm" variant="outline" colorScheme="red" onClick={() => setAction('reject')}>Reject & refund</Button></> : null}
            {t.state === 'FAILED' && can('remittance.operate') ? <Button size="sm" onClick={() => setAction('retry')}>Retry payout</Button> : null}
            {can('remittance.operate') && !['REFUNDED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING'].includes(t.state) ? <Button size="sm" variant="outline" onClick={() => setAction('refund')}>{paid ? 'Request goodwill refund' : 'Refund'}</Button> : null}
            <Link as={NextLink} href={`/admin/customers/${t.user.id}`} fontSize="sm">Sender 360 →</Link>
          </>
        }
      />
      {sandbox ? <Box mb={3}><Notice tone="warning">SANDBOX corridor — the payout rail is simulated; no real money left the platform.</Notice></Box> : null}
      {message ? <Box mb={3}><Notice>{message}</Notice></Box> : null}

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Quote & amounts" subtitle="immutable price record">
          <KV items={[
            ['Customer paid', money(t.totalDebit, t.sourceCurrency)], ['Principal', money(t.sendAmount, t.sourceCurrency)], ['Fee', money(t.feeAmount, t.sourceCurrency)],
            ['Base rate', `1 ${t.sourceCurrency} = ${Number(t.baseRate).toFixed(6)} ${t.destCurrency}`], ['Customer rate', `1 ${t.sourceCurrency} = ${Number(t.customerRate).toFixed(6)} ${t.destCurrency}`],
            ['Recipient gets', money(t.receiveAmount, t.destCurrency)], ['Rate source', t.quote.rateSource], ['Quote expiry', dateTime(t.quote.expiresAt)],
            ['Purpose', t.purpose], ['Source of funds', t.sourceOfFunds ?? '—'], ['Risk', `${t.riskScore ?? '—'} · ${t.riskOutcome ?? '—'}`], ['Correlation ID', <Mono key="c" copy={t.correlationId}>{shortId(t.correlationId, 16)}</Mono>],
          ]} />
        </Panel>
        <Panel title="Parties">
          <KV items={[
            ['Sender', `${t.user.firstName} ${t.user.lastName} (${t.user.country ?? '—'}, ${t.user.kycTier})`], ['Beneficiary', t.beneficiary.fullName],
            ['Relationship', t.beneficiary.relationship ?? '—'], ['Country', t.beneficiary.country], ['Payout method', t.beneficiary.payoutMethod],
            ['Bank / account', t.beneficiary.iban ?? [t.beneficiary.sortCode, t.beneficiary.accountNumber].filter(Boolean).join(' ') ?? '—'],
            ['Screening', <StatusBadge key="s" value={t.beneficiary.screeningStatus} />], ['Rail', t.providerCode ?? '—'], ['Provider ref', t.providerRef ? <Mono key="p" copy={t.providerRef}>{shortId(t.providerRef, 24)}</Mono> : '—'],
          ]} />
        </Panel>
      </Box>

      <Box mt={4} display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Lifecycle (state machine)"><Timeline items={data.transitions} /></Panel>
        <Panel title="Route decision" subtitle="every rail evaluated, with the reason" pad={false}>
          <DataTable rows={t.routes} columns={[
            { key: 'providerCode', label: 'Rail', render: (r: any) => <HStack><Text fontWeight={r.selected ? 700 : 400}>{r.providerCode}</Text>{r.selected ? <StatusBadge value="ROUTED" /> : null}</HStack> },
            { key: 'eligible', label: 'Eligible', render: (r: any) => <StatusBadge value={r.eligible ? 'OK' : 'BLOCKED'} /> },
            { key: 'score', label: 'Score', align: 'right', render: (r: any) => r.eligible ? Number(r.score).toFixed(3) : '—' },
            { key: 'estimatedDeliveryMins', label: 'ETA', align: 'right', render: (r: any) => `${r.estimatedDeliveryMins} min` },
            { key: 'reason', label: 'Reason', render: (r: any) => <Text fontSize="12px" maxW="260px">{r.reason}</Text> },
          ]} />
        </Panel>
      </Box>

      <Box mt={4}><Panel title="Ledger journals" subtitle="funding → payout (or refund); customer, settlement and corporate legs"><LedgerGroups groups={data.ledgerGroups.map((g: any) => ({ ...g, entries: g.entries.map((e: any) => ({ ...e, fundClass: ({ USER: 'CUSTOMER', REMITTANCE_CLEARING: 'CUSTOMER', SYSTEM_ESCROW: 'CUSTOMER', PLATFORM: 'CORPORATE' } as any)[e.account.type] ?? 'SETTLEMENT' })) }))} /></Panel></Box>

      <Box mt={4} display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Payout attempts" pad={false}>
          <DataTable rows={t.payouts} empty="No payout submitted yet." columns={[
            { key: 'attempt', label: '#' }, { key: 'providerCode', label: 'Rail' },
            { key: 'status', label: 'Status', render: (p: any) => <StatusBadge value={p.status} /> },
            { key: 'submittedAt', label: 'Submitted', render: (p: any) => dateTime(p.submittedAt) },
            { key: 'paidAt', label: 'Paid', render: (p: any) => dateTime(p.paidAt) },
            { key: 'failureReason', label: 'Failure', render: (p: any) => p.failureReason ?? '—' },
          ]} />
        </Panel>
        <Panel title="Risk decision" pad={false}>
          <DataTable rows={data.risk} columns={[
            { key: 'outcome', label: 'Outcome', render: (r: any) => <StatusBadge value={r.outcome} /> },
            { key: 'score', label: 'Score', align: 'right' },
            { key: 'triggeredRules', label: 'Rules', render: (r: any) => r.triggeredRules.join(', ') || '—' },
            { key: 'explanation', label: 'Why', render: (r: any) => <Text fontSize="12px" maxW="320px">{r.explanation}</Text> },
          ]} />
        </Panel>
        <Panel title="Treasury movements" pad={false}>
          <DataTable rows={data.treasury} empty="No liquidity reserved." columns={[
            { key: 'createdAt', label: 'When', render: (m: any) => dateTime(m.createdAt) }, { key: 'pool', label: 'Pool', render: (m: any) => m.pool.code },
            { key: 'type', label: 'Movement' }, { key: 'amount', label: 'Amount', align: 'right', render: (m: any) => money(m.amount, t.destCurrency) },
          ]} />
        </Panel>
        <Panel title="Provider calls" pad={false}>
          <DataTable rows={data.providerCalls} empty="No provider calls." columns={[
            { key: 'createdAt', label: 'When', render: (p: any) => dateTime(p.createdAt) }, { key: 'operation', label: 'Op' },
            { key: 'success', label: 'Result', render: (p: any) => <StatusBadge value={p.success ? 'OK' : 'FAILED'} /> },
            { key: 'latencyMs', label: 'ms', align: 'right' }, { key: 'errorCode', label: 'Error', render: (p: any) => p.errorCode ?? '—' },
          ]} />
        </Panel>
      </Box>
      <Box mt={4} display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Reconciliation" pad={false}>
          <DataTable rows={data.reconciliation} empty="Not reconciled yet." columns={[
            { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'status', label: 'Result', render: (r: any) => <StatusBadge value={r.status} /> },
            { key: 'resolution', label: 'Resolution', render: (r: any) => <StatusBadge value={r.resolution} /> },
          ]} />
        </Panel>
        <Panel title="Audit & cases">
          <DataTable rows={[...data.audit.map((a: any) => ({ id: a.id, when: a.createdAt, what: a.action, why: a.newValues?._reason })), ...data.cases.map((cs: any) => ({ id: cs.id, when: cs.createdAt, what: `Case ${cs.reference} (${cs.status})`, why: cs.title }))]} empty="No privileged actions." columns={[
            { key: 'when', label: 'When', render: (r: any) => dateTime(r.when) }, { key: 'what', label: 'What' }, { key: 'why', label: 'Why', render: (r: any) => r.why ?? '—' },
          ]} />
        </Panel>
      </Box>
      <Box mt={4}><Panel title="Raw record"><JsonView value={{ ...t, routes: undefined, payouts: undefined }} /></Panel></Box>

      <ReasonModal isOpen={Boolean(action)} onClose={() => setAction(null)} danger={action === 'reject' || action === 'refund'}
        title={{ approve: 'Approve transfer', reject: 'Reject and refund', retry: 'Retry payout on a new route', refund: paid ? 'Request goodwill refund (needs a second approver)' : 'Refund to customer' }[action ?? 'approve']}
        minLength={action === 'refund' ? 10 : 5}
        confirmLabel={{ approve: 'Approve', reject: 'Reject', retry: 'Retry', refund: paid ? 'Request approval' : 'Refund' }[action ?? 'approve']}
        onConfirm={async (reason) => {
          if (action === 'approve' || action === 'reject') await api(`/cockpit/remittance/transfers/${id}/review`, { method: 'POST', body: { approve: action === 'approve', note: reason } });
          else if (action === 'retry') await api(`/cockpit/remittance/transfers/${id}/retry`, { method: 'POST', body: { note: reason } });
          else if (action === 'refund') {
            const r = await api<any>(`/cockpit/remittance/transfers/${id}/refund`, { method: 'POST', body: { reason } });
            setMessage(r.pendingApproval ? r.message : 'Refunded to the customer.');
          }
          await reload();
        }} />
      <Text mt={6} fontSize="11px" color={c.faint}>Every action here writes a lifecycle transition and an audit record with your identity and reason.</Text>
    </Box>
  );
}
