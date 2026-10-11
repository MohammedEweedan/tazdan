'use client';

import { useState } from 'react';
import { Box, Button, HStack, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, dateTime } from '@/lib/cockpit/format';
import { useStaff } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, JsonView, PageHeader, Panel, ReasonModal, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

export default function ApprovalsPage() {
  const t = useT();
  const me = useStaff();
  const c = useCockpitColors();
  const [status, setStatus] = useState('PENDING');
  const [selected, setSelected] = useState<any>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const { data, error, loading, reload } = useApi<any>('/cockpit/approvals', { status }, { refreshMs: 30_000 });
  const person = (id: string | null) => {
    const p = data?.people?.find((x: any) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : id ? id.slice(0, 8) : '—';
  };

  return (
    <Box>
      <PageHeader title={t('Approvals')} subtitle="Maker-checker. A request is executed only when a different authorised staff member approves it." actions={
        <Select size="sm" w="170px" value={status} onChange={(e) => { setStatus(e.target.value); setSelected(null); }}>
          {['PENDING', 'EXECUTED', 'REJECTED', 'FAILED', 'EXPIRED', ''].map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
        </Select>
      } />
      <ErrorBox error={error} onRetry={reload} />
      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1.4fr 1fr' }} gap={4}>
        <Panel pad={false}>
          <DataTable loading={loading} rows={data?.items} onRowClick={setSelected} empty="Nothing waiting for approval." columns={[
            { key: 'createdAt', label: 'Requested', render: (r: any) => ago(r.createdAt) },
            { key: 'type', label: 'Type' },
            { key: 'requestedById', label: 'Maker', render: (r: any) => person(r.requestedById) },
            { key: 'reason', label: 'Reason', render: (r: any) => <Text noOfLines={1} maxW="260px">{r.reason}</Text> },
            { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
          ]} />
        </Panel>
        <Panel title={selected ? `${selected.type} · ${selected.id.slice(0, 10)}` : 'Select a request'}>
          {selected ? (
            <Box display="grid" gap={3}>
              <Text fontSize="13px"><b>Reason:</b> {selected.reason}</Text>
              <Text fontSize="12px" color={c.muted}>Requested by {person(selected.requestedById)} · {dateTime(selected.createdAt)} · expires {dateTime(selected.expiresAt)}</Text>
              {selected.decidedById ? <Text fontSize="12px" color={c.muted}>Decided by {person(selected.decidedById)} · {dateTime(selected.decidedAt)}{selected.decisionNote ? ` · “${selected.decisionNote}”` : ''}</Text> : null}
              <Text fontSize="12px" fontWeight={600}>Payload</Text>
              <JsonView value={selected.payload} />
              {selected.result ? <><Text fontSize="12px" fontWeight={600}>Result</Text><JsonView value={selected.result} /></> : null}
              {selected.status === 'PENDING' ? (
                selected.requestedById === me?.user.id
                  ? <Text fontSize="12px" color={c.muted}>You made this request, so a different approver must decide it.</Text>
                  : <HStack><Button size="sm" colorScheme="brand" onClick={() => setDecision('approve')}>{t('Approve')} & execute</Button><Button size="sm" variant="outline" onClick={() => setDecision('reject')}>{t('Reject')}</Button></HStack>
              ) : null}
            </Box>
          ) : <Text fontSize="sm" color={c.muted}>Pick a request to see its payload and decide it.</Text>}
        </Panel>
      </Box>
      <ReasonModal isOpen={Boolean(decision)} onClose={() => setDecision(null)} danger={decision === 'reject'}
        title={decision === 'approve' ? 'Approve and execute' : 'Reject request'} confirmLabel={decision === 'approve' ? 'Approve' : 'Reject'}
        description={decision === 'approve' ? <Text>The action runs immediately with you recorded as the approver.</Text> : null}
        onConfirm={async (note) => {
          const r = await api<any>(`/cockpit/approvals/${selected.id}/decide`, { method: 'POST', body: { approve: decision === 'approve', note } });
          setSelected(r.approval);
          await reload();
        }} />
    </Box>
  );
}
