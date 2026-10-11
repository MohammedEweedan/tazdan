'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { Box, Button, HStack, Link, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, money } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Mono, Notice, PageHeader, Pagination, Panel, ReasonModal, StatusBadge } from '@/components/cockpit/ui';

export default function WithdrawalsQueue() {
  const t = useT();
  const can = useCan();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ kind: 'process' | 'reject'; row: any } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi<any>('/admin/withdrawals', { status, page, limit: 25 }, { refreshMs: 30_000 });

  return (
    <Box>
      <PageHeader title={t('Withdrawals')} subtitle="Funds are reserved when requested. Approving pays out and posts the ledger journal; large withdrawals need more than one approver." actions={
        <Select size="sm" w="200px" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      } />
      {message ? <Box mb={3}><Notice>{message}</Notice></Box> : null}
      <ErrorBox error={error} onRetry={reload} />
      <Panel pad={false}>
        <DataTable loading={loading} rows={data?.withdrawals} columns={[
          { key: 'createdAt', label: 'Requested', render: (r: any) => dateTime(r.createdAt) },
          { key: 'user', label: 'Customer', render: (r: any) => <Link as={NextLink} href={`/admin/customers/${r.user?.id}`}>{r.user?.firstName} {r.user?.lastName}</Link> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => money(r.amount, r.currency) },
          { key: 'fee', label: 'Fee', align: 'right', render: (r: any) => money(r.fee, r.currency) },
          { key: 'dest', label: 'Destination', render: (r: any) => r.walletAddress ? <Mono copy={r.walletAddress}>{r.network} {r.walletAddress.slice(0, 10)}…</Mono> : <Box><Text>{r.accountName ?? '—'}</Text><Text fontSize="11px" opacity={0.7}>{r.bankName} {r.accountNumber}</Text></Box> },
          { key: 'reference', label: 'Reference', render: (r: any) => <Link as={NextLink} href={`/admin/transactions/withdrawal/${r.id}`}><Mono>{r.reference}</Mono></Link> },
          { key: 'risk', label: 'Risk', render: (r: any) => typeof r.adminNotes === 'string' && r.adminNotes.startsWith('Risk review')
            ? <Box maxW="240px"><StatusBadge value="REVIEW" /><Text fontSize="11px" mt={1} noOfLines={3} title={r.adminNotes}>{r.adminNotes.replace(/^Risk review /, '')}</Text></Box> : '—' },
          { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
          { key: 'x', label: '', align: 'right', render: (r: any) => (r.status === 'PENDING' && can('withdrawals.approve')) ? (
            <HStack justify="flex-end"><Button size="xs" colorScheme="brand" onClick={() => setAction({ kind: 'process', row: r })}>Approve</Button><Button size="xs" variant="outline" onClick={() => setAction({ kind: 'reject', row: r })}>Reject</Button></HStack>
          ) : null },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
      </Panel>
      <ReasonModal isOpen={Boolean(action)} onClose={() => setAction(null)} danger={action?.kind === 'reject'}
        title={action?.kind === 'process' ? `Approve withdrawal ${action?.row.reference}` : `Reject withdrawal ${action?.row.reference}`}
        confirmLabel={action?.kind === 'process' ? 'Approve payout' : 'Reject and release funds'}
        description={action ? <Text>{money(action.row.amount, action.row.currency)} (net {money(action.row.netAmount, action.row.currency)}). {action.kind === 'process' ? 'Only approve after the payout has been sent from the platform account, or will be in this batch.' : 'The reserved funds return to the customer.'}</Text> : null}
        onConfirm={async (reason) => {
          if (!action) return;
          if (action.kind === 'process') {
            const r = await api<any>(`/admin/withdrawals/${action.row.id}/process`, { method: 'PUT', body: { notes: reason } });
            setMessage(r.pending ? r.message : `Withdrawal ${action.row.reference} approved and settled.`);
          } else {
            await api(`/admin/withdrawals/${action.row.id}/reject`, { method: 'PUT', body: { reason } });
            setMessage(`Withdrawal ${action.row.reference} rejected; funds released.`);
          }
          await reload();
        }} />
    </Box>
  );
}
