/**
 * Approvals — maker-checker. A request runs only when a different
 * authorised staff member approves it.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, KV, Note, Pill, Row, Section, Segments, ago, cockpitCall, dateTime,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const STATUSES = ['PENDING', 'EXECUTED', 'REJECTED', 'FAILED', 'EXPIRED', ''] as const;

export default function AdminApprovals() {
  const p = useThemedPalette();
  const { me } = useStaff();
  const refresh = useCockpitRefresh();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('PENDING');
  const [selected, setSelected] = useState<any>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const q = useCockpit<any>('/cockpit/approvals', { status }, { refreshMs: 30_000 });
  const person = (id: string | null) => {
    const x = q.data?.people?.find((y: any) => y.id === id);
    return x ? `${x.firstName} ${x.lastName}` : id ? id.slice(0, 8) : '—';
  };

  return (
    <AdminScreen title="Approvals" subtitle="Maker-checker"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      <Segments value={status} onChange={setStatus} options={STATUSES.map((s) => ({ key: s, label: s ? s[0] + s.slice(1).toLowerCase() : 'All' }))} />
      <Section>
        {q.isLoading ? <Empty loading text="" /> : (q.data?.items ?? []).length ? (q.data.items as any[]).map((r, i, all) => (
          <Row key={r.id} last={i === all.length - 1} title={r.type} subtitle={r.reason} meta={`${ago(r.createdAt)} · by ${person(r.requestedById)}`}
            right={<Pill label={r.status} />} onPress={() => setSelected(r)} />
        )) : <Empty text="Nothing here." />}
      </Section>

      <BottomSheet visible={Boolean(selected) && !decision} onClose={() => setSelected(null)} title={selected ? `${selected.type}` : ''}
        footer={selected?.status === 'PENDING' && selected.requestedById !== me?.user.id ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
            <View style={{ flex: 1 }}><Btn tone="danger" label="Reject" onPress={() => setDecision('reject')} /></View>
            <View style={{ flex: 1 }}><Btn label="Approve & run" onPress={() => setDecision('approve')} /></View>
          </View>
        ) : undefined}>
        {selected ? (
          <View>
            <KV items={[
              ['Status', <Pill key="s" label={selected.status} />],
              ['Requested by', person(selected.requestedById)],
              ['Requested', dateTime(selected.createdAt)],
              ['Expires', dateTime(selected.expiresAt)],
              ...(selected.decidedById ? [['Decided by', `${person(selected.decidedById)} · ${dateTime(selected.decidedAt)}`] as [string, string]] : []),
              ...(selected.decisionNote ? [['Note', selected.decisionNote] as [string, string]] : []),
            ]} />
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 12 }}>Reason</Text>
            <Text style={{ color: p.fg, fontSize: 13, marginTop: 4 }}>{selected.reason}</Text>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 12 }}>Payload</Text>
            <Text selectable style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 16, marginTop: 4 }}>{JSON.stringify(selected.payload, null, 2)}</Text>
            {selected.result ? <>
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 12 }}>Result</Text>
              <Text selectable style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 16, marginTop: 4 }}>{JSON.stringify(selected.result, null, 2)}</Text>
            </> : null}
            {selected.status === 'PENDING' && selected.requestedById === me?.user.id
              ? <View style={{ marginTop: 12 }}><Note tone="warn">You made this request, so a different approver must decide it.</Note></View> : null}
          </View>
        ) : null}
      </BottomSheet>

      <ActionSheet visible={Boolean(decision)} onClose={() => setDecision(null)} danger={decision === 'reject'}
        title={decision === 'approve' ? 'Approve and run' : 'Reject request'} confirmLabel={decision === 'approve' ? 'Approve' : 'Reject'}
        reasonLabel="Note"
        description={decision === 'approve' ? 'The action runs immediately with you recorded as the approver.' : undefined}
        onSubmit={async (_v, note) => {
          const r = await cockpitCall<any>(`/cockpit/approvals/${selected.id}/decide`, 'POST', { approve: decision === 'approve', note });
          setSelected(r.approval);
          await refresh();
        }} />
    </AdminScreen>
  );
}
