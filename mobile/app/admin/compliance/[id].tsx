/**
 * One compliance case — the case, its subject and related transfer, the risk
 * decision behind it, the case file, and status/owner changes and notes.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, KV, Pill, Row, Section, cockpitCall, dateTime, money,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminComplianceCase() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const q = useCockpit<any>(id ? `/cockpit/compliance/cases/${id}` : null);
  const [move, setMove] = useState(false);
  const [note, setNote] = useState(false);
  const d = q.data;
  const k = d?.case;
  const staffName = (sid?: string | null) => {
    const s = d?.staff?.find((x: any) => x.id === sid);
    return s ? `${s.firstName} ${s.lastName}` : sid ? sid.slice(0, 8) : 'unassigned';
  };
  const manage = can('compliance.case.manage');

  return (
    <AdminScreen title={k ? k.reference : 'Case'} subtitle={k ? `${k.type.replace(/_/g, ' ')} · ${k.title}` : undefined}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {!k ? <Empty loading={q.isLoading} text="Case not found." /> : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <Pill label={k.status} /><Pill label={k.priority} />
            {manage && d.allowedNext.length ? <Btn small label="Move case" onPress={() => setMove(true)} /> : null}
            {manage && k.status !== 'CLOSED' ? <Btn small tone="ghost" label="Add note" onPress={() => setNote(true)} /> : null}
          </View>
          <Section title="Case">
            <KV items={[
              ['Opened', dateTime(k.createdAt)], ['SLA due', k.slaDueAt ? dateTime(k.slaDueAt) : '—'], ['Owner', staffName(k.assignedToId)],
              ['Opened by', k.openedById ? staffName(k.openedById) : 'system'], ['Closed', k.closedAt ? dateTime(k.closedAt) : '—'],
            ]} />
            {k.summary ? <Text style={{ color: p.fg, fontSize: 13, paddingVertical: 8 }}>{k.summary}</Text> : null}
            {k.resolution ? <Text style={{ color: p.fg, fontSize: 13, paddingVertical: 8 }}>Resolution: {k.resolution}</Text> : null}
          </Section>
          <Section title="Subject">
            {d.subject ? (
              <>
                <KV items={[
                  ['Customer', `${d.subject.firstName} ${d.subject.lastName}`], ['Email', d.subject.email], ['Country', d.subject.country ?? '—'],
                  ['KYC', `${d.subject.kycStatus} · ${d.subject.kycTier}`], ['Account', d.subject.status],
                ]} />
                <View style={{ paddingVertical: 8 }}><Btn small tone="ghost" label="Open customer" onPress={() => router.push(`/admin/customer/${d.subject.id}` as any)} /></View>
              </>
            ) : <Empty text="No customer linked." />}
          </Section>
          {d.related ? (
            <Section title="Related remittance">
              <Row last title={`${d.related.reference} · ${d.related.corridor.code}`}
                subtitle={`${money(d.related.totalDebit, d.related.sourceCurrency)} → ${d.related.beneficiary.fullName} (${d.related.beneficiary.country})`}
                meta={d.related.purpose} right={<Pill label={d.related.state} />} onPress={() => router.push(`/admin/remittance/${d.related.id}` as any)} />
            </Section>
          ) : null}
          {d.decision ? (
            <Section title="Risk decision that opened this case">
              <Row last title={`Score ${d.decision.score}`} subtitle={d.decision.explanation} meta={(d.decision.triggeredRules ?? []).join(', ')} right={<Pill label={d.decision.outcome} />} />
            </Section>
          ) : null}
          <Section title="Case file" subtitle="Notes, evidence and status changes, oldest first">
            {k.notes.length ? k.notes.map((n: any, i: number) => (
              <View key={n.id} style={{ paddingVertical: 10, borderBottomWidth: i === k.notes.length - 1 ? 0 : 1, borderBottomColor: p.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Pill label={n.kind} />
                  <Text style={{ color: p.fgMuted, fontSize: 11 }}>{dateTime(n.createdAt)} · {n.authorType === 'STAFF' ? staffName(n.authorId) : n.authorType}</Text>
                </View>
                <Text style={{ color: p.fg, fontSize: 13, lineHeight: 19 }} selectable>{n.body}</Text>
              </View>
            )) : <Empty text="No notes yet." />}
          </Section>
        </>
      )}
      <ActionSheet visible={move} onClose={() => setMove(false)} title="Move case" confirmLabel="Save" reasonLabel="Note"
        fields={d ? [
          { key: 'to', label: 'New status', type: 'select', options: d.allowedNext.map((s: string) => ({ value: s, label: s.replace(/_/g, ' ').toLowerCase() })) },
          { key: 'assignee', label: 'Owner', type: 'select', initial: k?.assignedToId ?? '', options: [{ value: '', label: 'Unassigned' }, ...d.staff.map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))] },
          { key: 'resolution', label: 'Resolution (when closing)', type: 'multiline', optional: true },
        ] : []}
        onSubmit={async (v, reason) => {
          await cockpitCall(`/cockpit/compliance/cases/${id}/transition`, 'POST', {
            to: v.to, note: reason, resolution: v.to === 'CLOSED' ? (String(v.resolution ?? '').trim() || undefined) : undefined, assignedToId: v.assignee || null,
          });
          await refresh();
        }} />
      <ActionSheet visible={note} onClose={() => setNote(false)} title="Add to the case file" confirmLabel="Add" reason={false}
        fields={[
          { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'NOTE', label: 'Note' }, { value: 'EVIDENCE', label: 'Evidence' }, { value: 'REQUEST_INFORMATION', label: 'Information request' }] },
          { key: 'body', label: 'Text', type: 'multiline' },
        ]}
        onSubmit={async (v) => { await cockpitCall(`/cockpit/compliance/cases/${id}/notes`, 'POST', { body: String(v.body).trim(), kind: v.kind }); await refresh(); }} />
    </AdminScreen>
  );
}
