'use client';

import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { Box, HStack, Link, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { dateTime, money, shortId } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, JsonView, KV, Loading, Mono, PageHeader, Panel, StatusBadge } from '@/components/cockpit/ui';
import { LedgerGroups, Timeline } from '@/components/cockpit/detail';

export default function TransactionDetail() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const { data, error, loading, reload } = useApi<any>(`/cockpit/transactions/${kind}/${id}`);
  if (loading && !data) return <Loading lines={10} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;
  const r = data.record;
  const owner = r.user?.id ?? r.userId ?? r.senderId ?? r.sellerId;
  const amount = r.amount ?? r.cryptoAmount ?? r.quotedTotal;
  const currency = r.currency ?? r.asset ?? r.baseAsset;

  return (
    <Box>
      <PageHeader
        title={`${kind.replace('_', ' ')} ${r.reference ?? shortId(r.id, 12)}`}
        subtitle={<HStack spacing={2}>{r.status ? <StatusBadge value={r.status} /> : r.metadata?.status ? <StatusBadge value={r.metadata.status} /> : null}<Text>{amount ? money(amount, currency) : ''}</Text></HStack>}
        actions={owner ? <Link as={NextLink} href={`/admin/customers/${owner}`} fontSize="sm">Open customer →</Link> : null}
      />
      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Record">
          <KV items={Object.entries(r).filter(([k, v]) => typeof v !== 'object' || v === null).slice(0, 24).map(([k, v]) => [k, String(v ?? '—')])} />
        </Panel>
        <Panel title="Lifecycle"><Timeline items={data.transitions} /></Panel>
      </Box>
      <Box mt={4}><Panel title="Double-entry journal" subtitle="every group must sum to zero per currency (also enforced by the database at commit)"><LedgerGroups groups={data.ledgerGroups} /></Panel></Box>
      <Box mt={4} display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Audit trail" pad={false}>
          <DataTable rows={data.audit} empty="No privileged actions on this object." columns={[
            { key: 'createdAt', label: 'When', render: (a: any) => dateTime(a.createdAt) },
            { key: 'action', label: 'Action' },
            { key: 'userId', label: 'Staff', render: (a: any) => <Mono>{shortId(a.userId)}</Mono> },
            { key: 'reason', label: 'Reason', render: (a: any) => a.newValues?._reason ?? '—' },
          ]} />
        </Panel>
        <Panel title="Raw record"><JsonView value={r} /></Panel>
      </Box>
    </Box>
  );
}
