'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, HStack, Input, Select } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, money, shortId } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, Mono, PageHeader, Pagination, Panel, StatusBadge } from '@/components/cockpit/ui';

const TYPES = ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'REFERRAL_BONUS', 'BUDGET_CONTRIBUTION', 'BUDGET_RELEASE'];
const CURRENCIES = ['USD', 'USDT', 'LYD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'TRY', 'TND', 'BTC', 'ETH', 'SOL'];

export default function TransactionsPage() {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [currency, setCurrency] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<any>('/cockpit/transactions', { q, type, currency, from, to, page, limit: 50 });

  return (
    <Box>
      <PageHeader title={t('Transactions')} subtitle="Every customer-visible money event. Open one for its ledger journal, lifecycle and audit trail." />
      <HStack mb={3} spacing={2} flexWrap="wrap">
        <Input size="sm" maxW="240px" placeholder="Reference or description" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select size="sm" maxW="180px" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>{TYPES.map((x) => <option key={x}>{x}</option>)}
        </Select>
        <Select size="sm" maxW="130px" value={currency} onChange={(e) => { setCurrency(e.target.value); setPage(1); }}>
          <option value="">All currencies</option>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}
        </Select>
        <Input size="sm" type="date" maxW="160px" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From" />
        <Input size="sm" type="date" maxW="160px" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To" />
      </HStack>
      <ErrorBox error={error} onRetry={reload} />
      <Panel pad={false}>
        <DataTable loading={loading} rows={data?.items} onRowClick={(r: any) => router.push(`/admin/transactions/transaction/${r.id}`)} columns={[
          { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
          { key: 'user', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName} ${r.user.lastName}` : shortId(r.userId) },
          { key: 'type', label: 'Type' },
          { key: 'amount', label: t('Amount'), align: 'right', render: (r: any) => money(r.amount, r.currency) },
          { key: 'fee', label: 'Fee', align: 'right', render: (r: any) => Number(r.fee) ? money(r.fee, r.currency) : '—' },
          { key: 'status', label: t('Status'), render: (r: any) => r.metadata?.status ? <StatusBadge value={r.metadata.status} /> : '—' },
          { key: 'reference', label: 'Reference', render: (r: any) => <Mono>{r.reference ?? shortId(r.id)}</Mono> },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={50} onPage={setPage} /> : null}
      </Panel>
    </Box>
  );
}
