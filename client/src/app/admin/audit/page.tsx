'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, HStack, Input, Select, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, shortId } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, JsonView, Mono, PageHeader, Pagination, Panel, useCockpitColors } from '@/components/cockpit/ui';

function AuditView() {
  const t = useT();
  const c = useCockpitColors();
  const params = useSearchParams();
  const [q, setQ] = useState(params?.get('q') ?? '');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const { data, error, loading, reload } = useApi<any>('/cockpit/audit', { q, action, from, to, page, limit: 50 });
  const actor = (id: string | null) => {
    const a = data?.actors?.find((x: any) => x.id === id);
    return a ? `${a.firstName} ${a.lastName}` : id ? shortId(id) : 'system';
  };

  return (
    <Box>
      <PageHeader title={t('Audit')} subtitle="Every privileged action: who, what, when, where (IP), why (reason), before and after. Records are append-only at the database level." />
      <HStack mb={3} spacing={2} flexWrap="wrap">
        <Input size="sm" maxW="280px" placeholder="Entity ID, staff ID, IP or action" value={q} onChange={(e) => { setQ(e.target.value.trim()); setPage(1); }} />
        <Select size="sm" maxW="240px" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>
          {(data?.actions ?? []).map((a: any) => <option key={a.action} value={a.action}>{a.action} ({a.count})</option>)}
        </Select>
        <Input size="sm" type="date" maxW="160px" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From" />
        <Input size="sm" type="date" maxW="160px" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To" />
      </HStack>
      <ErrorBox error={error} onRetry={reload} />
      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1.5fr 1fr' }} gap={4}>
        <Panel pad={false}>
          <DataTable loading={loading} rows={data?.items} onRowClick={setSelected} columns={[
            { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
            { key: 'userId', label: 'Who', render: (r: any) => actor(r.userId) },
            { key: 'action', label: 'What', render: (r: any) => <Mono>{r.action}</Mono> },
            { key: 'entity', label: 'Entity', render: (r: any) => `${r.entity} ${shortId(r.entityId)}` },
            { key: 'reason', label: 'Why', render: (r: any) => <Text noOfLines={1} maxW="220px">{r.newValues?._reason ?? '—'}</Text> },
            { key: 'ipAddress', label: 'Where' },
          ]} />
          {data ? <Pagination page={page} total={data.total} limit={50} onPage={setPage} /> : null}
        </Panel>
        <Panel title={selected ? selected.action : 'Select a record'}>
          {selected ? (
            <Box display="grid" gap={3}>
              <Text fontSize="12px" color={c.muted}>{actor(selected.userId)} · {dateTime(selected.createdAt)} · {selected.ipAddress ?? 'no IP'}</Text>
              <Text fontSize="12px">{selected.entity} <Mono copy={selected.entityId ?? ''}>{selected.entityId ?? '—'}</Mono></Text>
              <Text fontSize="12px" fontWeight={600}>Before</Text><JsonView value={selected.oldValues} />
              <Text fontSize="12px" fontWeight={600}>After</Text><JsonView value={selected.newValues} />
              {selected.userAgent ? <Text fontSize="11px" color={c.faint}>{selected.userAgent}</Text> : null}
            </Box>
          ) : <Text fontSize="sm" color={c.muted}>Pick a record to see the full before/after state.</Text>}
        </Panel>
      </Box>
    </Box>
  );
}

export default function AuditPage() {
  return <Suspense fallback={null}><AuditView /></Suspense>;
}
