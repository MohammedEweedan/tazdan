'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, HStack, Input, Select } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, PageHeader, Pagination, Panel, StatusBadge } from '@/components/cockpit/ui';

export default function CustomersPage() {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kyc, setKyc] = useState('');
  const [accountType, setAccountType] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<any>('/cockpit/customers', { q, status, kyc, accountType, page, limit: 25 });

  return (
    <Box>
      <PageHeader title={t('Customers')} subtitle="Every customer account. Open one for the full 360° profile." />
      <HStack mb={3} spacing={2} flexWrap="wrap">
        <Input size="sm" maxW="320px" placeholder="Name, email, @handle, phone or ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select size="sm" maxW="170px" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option>
          {['ACTIVE', 'PENDING', 'SUSPENDED', 'BANNED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select size="sm" maxW="170px" value={kyc} onChange={(e) => { setKyc(e.target.value); setPage(1); }}>
          <option value="">Any KYC</option>
          {['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select size="sm" maxW="170px" value={accountType} onChange={(e) => { setAccountType(e.target.value); setPage(1); }}>
          <option value="">Personal & business</option>
          <option value="PERSONAL">Personal</option>
          <option value="BUSINESS">Business</option>
        </Select>
      </HStack>
      <ErrorBox error={error} onRetry={reload} />
      <Panel pad={false}>
        <DataTable loading={loading} rows={data?.items} onRowClick={(r: any) => router.push(`/admin/customers/${r.id}`)} columns={[
          { key: 'name', label: 'Customer', render: (r: any) => <Box><Box fontWeight={600}>{r.firstName} {r.lastName}</Box><Box fontSize="12px" opacity={0.7}>@{r.username ?? '—'} · {r.email}</Box></Box> },
          { key: 'country', label: 'Country' },
          { key: 'accountType', label: 'Type' },
          { key: 'kycStatus', label: 'KYC', render: (r: any) => <HStack spacing={1}><StatusBadge value={r.kycStatus} /><Box fontSize="11px" opacity={0.7}>{r.kycTier}</Box></HStack> },
          { key: 'status', label: t('Status'), render: (r: any) => <StatusBadge value={r.status} /> },
          { key: 'lastLoginAt', label: 'Last sign-in', render: (r: any) => ago(r.lastLoginAt) },
          { key: 'createdAt', label: 'Joined', render: (r: any) => new Date(r.createdAt).toLocaleDateString('en-GB') },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
      </Panel>
    </Box>
  );
}
