'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, HStack, Input, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, money, shortId, usd } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, Grid, Mono, PageHeader, Pagination, Panel, Stat, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

function LedgerView() {
  const t = useT();
  const c = useCockpitColors();
  const params = useSearchParams();
  const [userId, setUserId] = useState(params?.get('userId') ?? '');
  const [refId, setRefId] = useState('');
  const [page, setPage] = useState(1);
  const summary = useApi<any>('/cockpit/ledger/summary');
  const entries = useApi<any>('/cockpit/ledger/entries', { userId, refId, page, limit: 50 });

  const byClass = (cls: string) => (summary.data?.accounts ?? []).filter((a: any) => a.fundClass === cls).reduce((n: number, a: any) => n + a.usd, 0);
  const unbalanced = (summary.data?.conservation ?? []).filter((x: any) => !x.balanced);

  return (
    <Box>
      <PageHeader title={t('Ledger')} subtitle="Double-entry ledger. Posted entries are immutable (database-enforced); corrections are new reversing journals." />
      <ErrorBox error={summary.error} onRetry={summary.reload} />
      {summary.data ? (
        <Grid min="200px">
          <Stat label={t('Customer funds')} value={usd(byClass('CUSTOMER'), true)} hint="USER, escrow, remittance clearing" />
          <Stat label={t('Settlement & treasury funds')} value={usd(byClass('SETTLEMENT'), true)} hint="signed rail positions" />
          <Stat label={t('Corporate funds')} value={usd(byClass('CORPORATE'), true)} hint="PLATFORM revenue" />
          <Stat label="Global conservation" value={unbalanced.length ? `${unbalanced.length} breaks` : 'Balanced'} hint={unbalanced.length ? unbalanced.map((u: any) => u.currency).join(', ') : 'every currency sums to zero'} />
        </Grid>
      ) : null}
      <Box mt={4} display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1.4fr' }} gap={4}>
        <Panel title="Positions by account type" pad={false}>
          <DataTable loading={summary.loading} rows={summary.data?.accounts?.map((a: any) => ({ ...a, id: `${a.type}:${a.currency}` }))} columns={[
            { key: 'fundClass', label: 'Fund class' },
            { key: 'type', label: 'Account type' },
            { key: 'balance', label: 'Balance', align: 'right', render: (a: any) => money(a.balance, a.currency) },
            { key: 'usd', label: 'USD', align: 'right', render: (a: any) => usd(a.usd) },
            { key: 'accounts', label: 'Accounts', align: 'right' },
          ]} />
        </Panel>
        <Panel title="Entries" pad={false} actions={
          <HStack>
            <Input size="xs" placeholder="Customer ID" value={userId} onChange={(e) => { setUserId(e.target.value.trim()); setPage(1); }} w="200px" />
            <Input size="xs" placeholder="Reference ID" value={refId} onChange={(e) => { setRefId(e.target.value.trim()); setPage(1); }} w="160px" />
          </HStack>
        }>
          <ErrorBox error={entries.error} />
          <DataTable loading={entries.loading} rows={entries.data?.items} columns={[
            { key: 'createdAt', label: 'When', render: (e: any) => dateTime(e.createdAt) },
            { key: 'refType', label: 'Journal', render: (e: any) => <Mono>{e.refType}</Mono> },
            { key: 'account', label: 'Account', render: (e: any) => `${e.account.type}${e.account.userId ? ` · ${shortId(e.account.userId)}` : ''}` },
            { key: 'amount', label: 'Amount', align: 'right', render: (e: any) => <Text color={Number(e.amount) < 0 ? c.muted : c.text}>{money(e.amount, e.currency)}</Text> },
            { key: 'refId', label: 'Ref', render: (e: any) => <Mono copy={e.refId ?? ''}>{shortId(e.refId, 12)}</Mono> },
          ]} />
          {entries.data ? <Pagination page={page} total={entries.data.total} limit={50} onPage={setPage} /> : null}
        </Panel>
      </Box>
      {unbalanced.length ? <Box mt={4}><Panel title="Conservation breaks"><DataTable rows={unbalanced.map((u: any) => ({ ...u, id: u.currency }))} columns={[{ key: 'currency', label: 'Currency' }, { key: 'sum', label: 'Sum of all entries', align: 'right' }, { key: 'b', label: 'State', render: () => <StatusBadge value="FAILED" /> }]} /></Panel></Box> : null}
    </Box>
  );
}

export default function LedgerPage() {
  return <Suspense fallback={null}><LedgerView /></Suspense>;
}
