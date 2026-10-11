'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { Box, Button, HStack, Link, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { ago, dateTime, money, usd } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, KV, Loading, PageHeader, Panel, ReasonModal, StatusBadge } from '@/components/cockpit/ui';

export default function BusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const { data, error, loading, reload } = useApi<any>(`/cockpit/businesses/${id}`);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [batchAction, setBatchAction] = useState<{ id: string; reference: string; approve: boolean } | null>(null);
  if (loading && !data) return <Loading lines={10} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;
  const b = data.business;

  return (
    <Box>
      <PageHeader title={b.tradingName ?? b.companyName} subtitle={<><StatusBadge value={b.kybStatus} /> <Text as="span" ml={2}>{b.legalName ?? b.companyName} · {b.country}</Text></>}
        actions={can('businesses.kyb.review') && b.kybStatus !== 'APPROVED' ? <>
          <Button size="sm" colorScheme="brand" onClick={() => setDecision('APPROVED')}>Approve KYB</Button>
          {b.kybStatus !== 'REJECTED' ? <Button size="sm" variant="outline" colorScheme="red" onClick={() => setDecision('REJECTED')}>Reject</Button> : null}
        </> : can('businesses.kyb.review') ? <Button size="sm" variant="outline" colorScheme="red" onClick={() => setDecision('REJECTED')}>Revoke verification</Button> : null} />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Company">
          <KV items={[
            ['Registration no.', b.registrationNo ?? '—'], ['Tax ID', b.taxId ?? '—'], ['Industry', b.industry ?? '—'], ['Employees', b.employeeCount ?? '—'],
            ['Website', b.website ?? '—'], ['Declared monthly volume', b.monthlyVolumeUsd ? usd(b.monthlyVolumeUsd, true) : '—'],
            ['Billing email', b.billingEmail ?? '—'], ['Support email', b.supportEmail ?? '—'],
            ['Payout approval threshold', b.approvalThresholdUsd ? usd(b.approvalThresholdUsd) : 'not set'], ['Use case', b.useCase ?? '—'],
          ]} />
        </Panel>
        <Panel title="Owner & verification">
          <KV items={[
            ['Owner', <Link key="o" as={NextLink} href={`/admin/customers/${b.user.id}`}>{b.user.firstName} {b.user.lastName}</Link>], ['Email', b.user.email],
            ['Account', <StatusBadge key="a" value={b.user.status} />], ['Owner KYC', <StatusBadge key="k" value={b.user.kycStatus} />],
            ['KYB reviewed', b.kybReviewedAt ? dateTime(b.kybReviewedAt) : '—'], ['KYB notes', b.kybNotes ?? '—'],
          ]} />
          <Text mt={3} fontSize="11px" color="gray.500">Wallets</Text>
          <Box display="flex" gap={3} flexWrap="wrap" mt={1}>
            {data.wallets.filter((w: any) => Number(w.balance) > 0 || Number(w.frozen) > 0).map((w: any) => (
              <Text key={w.id} fontSize="13px">{money(w.balance, w.currency)}{Number(w.frozen) > 0 ? ` (${money(w.frozen, w.currency)} held)` : ''}</Text>
            ))}
            {!data.wallets.some((w: any) => Number(w.balance) > 0) ? <Text fontSize="13px">No balances.</Text> : null}
          </Box>
        </Panel>
      </Box>

      <Box mt={4} display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Team" pad={false}>
          <DataTable rows={b.team} empty="No team members." columns={[
            { key: 'email', label: 'Member' }, { key: 'role', label: 'Role' }, { key: 'status', label: 'Status', render: (m: any) => <StatusBadge value={m.status} /> },
            { key: 'joinedAt', label: 'Joined', render: (m: any) => m.joinedAt ? ago(m.joinedAt) : 'invited' },
          ]} />
        </Panel>
        <Panel title="API keys" subtitle="prefix only; secrets are never shown" pad={false}>
          <DataTable rows={b.apiKeys} empty="No API keys." columns={[
            { key: 'name', label: 'Name' }, { key: 'prefix', label: 'Prefix', render: (k: any) => <Text fontFamily="mono" fontSize="12px">{k.prefix}…</Text> },
            { key: 'permissions', label: 'Scopes', render: (k: any) => k.permissions.join(', ') },
            { key: 'isActive', label: 'Status', render: (k: any) => <StatusBadge value={k.isActive ? 'ACTIVE' : 'DISABLED'} /> },
            { key: 'lastUsedAt', label: 'Last used', render: (k: any) => k.lastUsedAt ? ago(k.lastUsedAt) : 'never' },
            { key: 'usageCount', label: 'Calls', align: 'right' },
          ]} />
        </Panel>
        <Panel title="Webhooks" pad={false}>
          <DataTable rows={b.webhooks} empty="No webhook endpoints." columns={[
            { key: 'url', label: 'Endpoint', render: (w: any) => <Text fontSize="12px" wordBreak="break-all">{w.url}</Text> },
            { key: 'events', label: 'Events', render: (w: any) => w.events.join(', ') },
            { key: 'status', label: 'Status', render: (w: any) => <StatusBadge value={w.status} /> },
          ]} />
        </Panel>
      </Box>

      <Box mt={4}>
        <Panel title="Payout batches" subtitle="batches held for compliance review can be released or rejected here" pad={false}>
          <DataTable rows={b.payoutBatches} empty="No batches." columns={[
            { key: 'createdAt', label: 'Created', render: (r: any) => dateTime(r.createdAt) }, { key: 'reference', label: 'Reference' },
            { key: 'count', label: 'Payments', align: 'right' }, { key: 'totalAmount', label: 'Total', align: 'right', render: (r: any) => money(r.totalAmount, r.currency) },
            { key: 'source', label: 'Source', render: (r: any) => r.source ?? 'APP' },
            { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
            { key: 'risk', label: 'Risk', render: (r: any) => {
              const flagged = (r.payouts ?? []).filter((p: any) => p.riskOutcome && p.riskOutcome !== 'APPROVE');
              return flagged.length ? <Text fontSize="12px">{flagged.map((p: any) => `${p.reference} ${p.riskOutcome}`).join(', ')}</Text> : '—';
            } },
            { key: 'x', label: '', align: 'right', render: (r: any) => r.status === 'COMPLIANCE_REVIEW' && can('compliance.decide') ? (
              <HStack justify="flex-end">
                <Button size="xs" colorScheme="brand" onClick={() => setBatchAction({ id: r.id, reference: r.reference, approve: true })}>Release</Button>
                <Button size="xs" variant="outline" colorScheme="red" onClick={() => setBatchAction({ id: r.id, reference: r.reference, approve: false })}>Reject</Button>
              </HStack>
            ) : null },
          ]} />
        </Panel>
      </Box>

      <Box mt={4}>
        <Panel title="Recent payouts" pad={false}>
          <DataTable rows={b.payouts} empty="No payouts." columns={[
            { key: 'createdAt', label: 'Created', render: (r: any) => dateTime(r.createdAt) }, { key: 'reference', label: 'Reference' },
            { key: 'recipient', label: 'Recipient', render: (r: any) => r.recipientHandle ?? r.recipientEmail ?? r.recipientUserId?.slice(0, 8) ?? '—' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => money(r.amount, r.currency) },
            { key: 'feeAmount', label: 'Fee', align: 'right', render: (r: any) => money(r.feeAmount, r.currency) },
            { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
            { key: 'failureReason', label: 'Failure', render: (r: any) => r.failureReason ?? '—' },
          ]} />
        </Panel>
      </Box>

      <Box mt={4} display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Compliance cases" pad={false}>
          <DataTable rows={data.cases} empty="No cases." columns={[
            { key: 'reference', label: 'Case', render: (r: any) => <Link as={NextLink} href={`/admin/compliance/${r.id}`}>{r.reference}</Link> },
            { key: 'type', label: 'Type' }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
          ]} />
        </Panel>
        <Panel title="Audit trail" pad={false}>
          <DataTable rows={data.audit} empty="No privileged actions." columns={[
            { key: 'createdAt', label: 'When', render: (a: any) => dateTime(a.createdAt) }, { key: 'action', label: 'Action' },
            { key: 'reason', label: 'Reason', render: (a: any) => a.newValues?._reason ?? '—' },
          ]} />
        </Panel>
      </Box>

      <ReasonModal isOpen={Boolean(decision)} onClose={() => setDecision(null)} danger={decision === 'REJECTED'}
        title={decision === 'APPROVED' ? 'Approve business verification' : 'Reject business verification'} confirmLabel={decision === 'APPROVED' ? 'Approve' : 'Reject'}
        description={<Text fontSize="12px">{decision === 'APPROVED' ? 'Confirm you have checked the registration documents, ownership and the owner’s identity.' : 'The business owner is notified with your note as the reason.'}</Text>}
        onConfirm={async (note) => { await api(`/cockpit/businesses/${id}/kyb`, { method: 'POST', body: { decision, note } }); await reload(); }} />
      <ReasonModal isOpen={Boolean(batchAction)} onClose={() => setBatchAction(null)} danger={batchAction?.approve === false}
        title={batchAction?.approve ? `Release batch ${batchAction?.reference}` : `Reject batch ${batchAction?.reference}`} confirmLabel={batchAction?.approve ? 'Release and pay' : 'Reject'}
        description={<Text fontSize="12px">{batchAction?.approve ? 'Payable lines execute immediately. Lines the risk engine blocked stay failed.' : 'Reserved funds return to the business. The business sees a neutral “cannot be processed” message — never the screening detail.'}</Text>}
        onConfirm={async (note) => { await api(`/cockpit/businesses/batches/${batchAction!.id}/review`, { method: 'POST', body: { approve: batchAction!.approve, note } }); await reload(); }} />
    </Box>
  );
}
