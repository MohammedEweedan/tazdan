'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { Box, Button, HStack, Link, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, money } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Mono, PageHeader, Pagination, Panel, ReasonModal, StatusBadge } from '@/components/cockpit/ui';

export default function DepositsQueue() {
  const t = useT();
  const can = useCan();
  const [status, setStatus] = useState('WAITING_CONFIRMATION');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ kind: 'confirm' | 'reject'; row: any } | null>(null);
  const { data, error, loading, reload } = useApi<any>('/admin/deposits', { status, page, limit: 25 }, { refreshMs: 30_000 });

  return (
    <Box>
      <PageHeader title={t('Deposits')} subtitle="Bank-transfer deposits. Confirm only after the funds are visible on the platform bank statement." actions={
        <Select size="sm" w="220px" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {['WAITING_CONFIRMATION', 'PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </Select>
      } />
      <ErrorBox error={error} onRetry={reload} />
      <Panel pad={false}>
        <DataTable loading={loading} rows={data?.deposits} columns={[
          { key: 'createdAt', label: 'Submitted', render: (r: any) => dateTime(r.createdAt) },
          { key: 'user', label: 'Customer', render: (r: any) => <Link as={NextLink} href={`/admin/customers/${r.user?.id}`}>{r.user?.firstName} {r.user?.lastName}</Link> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => money(r.amount, r.currency) },
          { key: 'sender', label: 'Sender / bank', render: (r: any) => <Box><Text>{r.senderName ?? '—'}</Text><Text fontSize="11px" opacity={0.7}>{r.bankName ?? ''} {r.accountNumber ?? ''}</Text></Box> },
          { key: 'reference', label: 'Reference', render: (r: any) => <Link as={NextLink} href={`/admin/transactions/deposit/${r.id}`}><Mono>{r.reference}</Mono></Link> },
          { key: 'proof', label: 'Proof', render: (r: any) => r.proofImageUrl ? 'attached' : '—' },
          { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
          { key: 'x', label: '', align: 'right', render: (r: any) => (['WAITING_CONFIRMATION', 'PENDING'].includes(r.status) && can('deposits.confirm')) ? (
            <HStack justify="flex-end"><Button size="xs" colorScheme="brand" onClick={() => setAction({ kind: 'confirm', row: r })}>Confirm</Button><Button size="xs" variant="outline" onClick={() => setAction({ kind: 'reject', row: r })}>Reject</Button></HStack>
          ) : null },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
      </Panel>
      <ReasonModal isOpen={Boolean(action)} onClose={() => setAction(null)} danger={action?.kind === 'reject'}
        title={action?.kind === 'confirm' ? `Confirm deposit ${action?.row.reference}` : `Reject deposit ${action?.row.reference}`}
        confirmLabel={action?.kind === 'confirm' ? 'Credit customer' : 'Reject'}
        description={action ? <Text>{money(action.row.amount, action.row.currency)} for {action.row.user?.firstName} {action.row.user?.lastName}. {action.kind === 'confirm' ? 'The customer is credited and a balanced ledger journal (on-ramp → customer) is posted.' : 'Nothing is credited.'}</Text> : null}
        onConfirm={async (reason) => {
          if (!action) return;
          if (action.kind === 'confirm') await api(`/admin/deposits/${action.row.id}/confirm`, { method: 'PUT', body: { notes: reason } });
          else await api(`/admin/deposits/${action.row.id}/reject`, { method: 'PUT', body: { reason } });
          await reload();
        }} />
    </Box>
  );
}
