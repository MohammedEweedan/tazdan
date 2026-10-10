'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, HStack, Input, Select, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, num, usd } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, PageHeader, Pagination, Panel, StatusBadge } from '@/components/cockpit/ui';

export default function BusinessesPage() {
  const t = useT();
  const router = useRouter();
  const [kyb, setKyb] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<any>('/cockpit/businesses', { kyb, q, page, limit: 25 });

  return (
    <Box>
      <PageHeader title={t('Businesses')} subtitle="Business accounts, KYB verification, team, API keys, webhooks and payout activity." />
      <ErrorBox error={error} onRetry={reload} />
      <Panel title="Businesses" pad={false} actions={
        <HStack>
          <Input size="xs" w="200px" placeholder="Company or registration no." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select size="xs" w="150px" value={kyb} onChange={(e) => { setKyb(e.target.value); setPage(1); }}>
            <option value="">All KYB states</option>
            {['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
        </HStack>
      }>
        <DataTable loading={loading} rows={data?.items} empty="No business accounts." onRowClick={(b: any) => router.push(`/admin/businesses/${b.id}`)} columns={[
          { key: 'companyName', label: 'Business', render: (b: any) => <Box><Text fontWeight={600}>{b.tradingName ?? b.companyName}</Text><Text fontSize="11px" opacity={0.7}>{b.legalName ?? b.companyName} · {b.country}</Text></Box> },
          { key: 'kybStatus', label: 'KYB', render: (b: any) => <StatusBadge value={b.kybStatus} /> },
          { key: 'industry', label: 'Industry', render: (b: any) => b.industry ?? '—' },
          { key: 'monthlyVolumeUsd', label: 'Declared monthly volume', align: 'right', render: (b: any) => b.monthlyVolumeUsd ? usd(b.monthlyVolumeUsd, true) : '—' },
          { key: 'team', label: 'Team', align: 'right', render: (b: any) => num(b._count.team) },
          { key: 'apiKeys', label: 'API keys', align: 'right', render: (b: any) => num(b._count.apiKeys) },
          { key: 'payouts', label: 'Payouts', align: 'right', render: (b: any) => num(b._count.payouts) },
          { key: 'createdAt', label: 'Joined', render: (b: any) => ago(b.createdAt) },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
      </Panel>
    </Box>
  );
}
