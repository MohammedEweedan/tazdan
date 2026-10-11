'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { Box, Button, HStack, Link, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { dateTime } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, PageHeader, Pagination, Panel, ReasonModal, StatusBadge } from '@/components/cockpit/ui';

export default function KycQueue() {
  const can = useCan();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [tier, setTier] = useState('TIER_1');
  const [action, setAction] = useState<{ kind: 'approve' | 'reject'; row: any } | null>(null);
  const { data, error, loading, reload } = useApi<any>('/admin/kyc', { status, page, limit: 25 });

  return (
    <Box>
      <PageHeader title="KYC reviews" subtitle="Identity verification (manual review). The approved tier sets the customer's transaction limits." actions={
        <Select size="sm" w="180px" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {['PENDING', 'APPROVED', 'REJECTED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      } />
      <ErrorBox error={error} onRetry={reload} />
      <Panel pad={false}>
        <DataTable loading={loading} rows={data?.users} columns={[
          { key: 'name', label: 'Customer', render: (r: any) => <Link as={NextLink} href={`/admin/customers/${r.id}`}>{r.firstName} {r.lastName}</Link> },
          { key: 'email', label: 'Email' },
          { key: 'docs', label: 'Documents', render: (r: any) => `${r.kycDocuments?.length ?? 0} · ${(r.kycDocuments ?? []).map((d: any) => d.documentType).join(', ')}` },
          { key: 'createdAt', label: 'Account created', render: (r: any) => dateTime(r.createdAt) },
          { key: 'kycStatus', label: 'Status', render: (r: any) => <StatusBadge value={r.kycStatus} /> },
          { key: 'x', label: '', align: 'right', render: (r: any) => (r.kycStatus === 'PENDING' && can('customers.kyc.review')) ? (
            <HStack justify="flex-end"><Button size="xs" colorScheme="brand" onClick={() => setAction({ kind: 'approve', row: r })}>Approve</Button><Button size="xs" variant="outline" onClick={() => setAction({ kind: 'reject', row: r })}>Reject</Button></HStack>
          ) : null },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
      </Panel>
      <ReasonModal isOpen={Boolean(action)} onClose={() => setAction(null)} danger={action?.kind === 'reject'}
        title={action?.kind === 'approve' ? 'Approve identity verification' : 'Reject identity verification'}
        confirmLabel={action?.kind === 'approve' ? `Approve as ${tier.replace('_', ' ')}` : 'Reject'}
        description={action?.kind === 'approve' ? (
          <Box><Text mb={2}>Choose the tier the evidence supports:</Text>
            <Select size="sm" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="TIER_1">Tier 1 — identity document</option>
              <option value="TIER_2">Tier 2 — identity + proof of address</option>
              <option value="TIER_3">Tier 3 — enhanced (source of funds reviewed)</option>
            </Select></Box>
        ) : <Text>The customer is told the reason and returns to Tier 0 limits.</Text>}
        onConfirm={async (reason) => {
          if (!action) return;
          if (action.kind === 'approve') await api(`/admin/kyc/${action.row.id}/approve`, { method: 'PUT', body: { tier, note: reason } });
          else await api(`/admin/kyc/${action.row.id}/reject`, { method: 'PUT', body: { reason } });
          await reload();
        }} />
    </Box>
  );
}
