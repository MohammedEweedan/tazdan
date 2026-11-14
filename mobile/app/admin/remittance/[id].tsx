/**
 * One remittance — quote, parties, lifecycle, route decision, journals and
 * payout attempts, with review, retry and refund controls.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, KV, LedgerGroups, Note, Pill, Row, Section, Timeline, cockpitCall, dateTime, money,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

type Action = 'approve' | 'reject' | 'retry' | 'refund' | null;
const CLOSED = ['REFUNDED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING'];

export default function AdminRemittanceTransfer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const q = useCockpit<any>(id ? `/cockpit/remittance/transfers/${id}` : null);
  const [action, setAction] = useState<Action>(null);
  const [result, setResult] = useState<string | null>(null);
  const d = q.data;
  const t = d?.transfer;
  const paid = t && ['COMPLETED', 'PAID_OUT'].includes(t.state);

  return (
    <AdminScreen title={t ? `Remittance ${t.reference}` : 'Remittance'} subtitle={t ? `${t.corridor.name}` : undefined}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {result ? <Note tone="ok">{result}</Note> : null}
      {!t ? <Empty loading={q.isLoading} text="Transfer not found." /> : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <Pill label={t.state} />
            {t.state === 'MANUAL_REVIEW' && can('compliance.decide') ? <>
              <Btn small label="Approve" onPress={() => setAction('approve')} />
              <Btn small tone="danger" label="Reject" onPress={() => setAction('reject')} />
            </> : null}
            {t.state === 'FAILED' && can('remittance.operate') ? <Btn small tone="ghost" label="Retry payout" onPress={() => setAction('retry')} /> : null}
            {can('remittance.operate') && !CLOSED.includes(t.state) ? <Btn small tone="ghost" label={paid ? 'Request goodwill refund' : 'Refund'} onPress={() => setAction('refund')} /> : null}
          </View>
          <Section title="Quote & amounts" subtitle="Immutable price record">
            <KV items={[
              ['Sent', money(t.sendAmount, t.sourceCurrency)], ['Fee', money(t.feeAmount, t.sourceCurrency)],
              ['Total debit', money(t.totalDebit, t.sourceCurrency)], ['Customer rate', String(t.customerRate)], ['Base rate', String(t.baseRate)],
              ['Paid out', money(t.receiveAmount, t.destCurrency)], ['Rail', t.providerCode ?? '—'], ['Created', dateTime(t.createdAt)],
            ]} />
          </Section>
          <Section title="Parties">
            <KV items={[
              ['Sender', `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.trim() || '—'],
              ['Beneficiary', `${t.beneficiary?.fullName ?? '—'} · ${t.beneficiary?.country ?? ''}`],
              ['Payout method', t.beneficiary?.payoutMethod ?? '—'],
            ]} />
            {t.userId ? <View style={{ paddingVertical: 8 }}><Btn small tone="ghost" label="Open sender" onPress={() => router.push(`/admin/customer/${t.userId}` as any)} /></View> : null}
          </Section>
          <Section title="Lifecycle"><Timeline items={d.transitions} /></Section>
          <Section title="Route decision" subtitle="Every rail evaluated, with the reason">
            {(t.routes ?? []).length ? t.routes.map((r: any, i: number, all: any[]) => (
              <Row key={r.id ?? r.providerCode} last={i === all.length - 1} title={`${r.providerCode}${r.selected ? ' · routed' : ''}`} subtitle={r.reason}
                meta={`${r.eligible ? `score ${Number(r.score).toFixed(3)}` : 'not eligible'} · ETA ${r.estimatedDeliveryMins} min`} right={<Pill label={r.eligible ? 'OK' : 'BLOCKED'} />} />
            )) : <Empty text="No route decision recorded." />}
          </Section>
          <Section title="Payout attempts">
            {(t.payouts ?? []).length ? t.payouts.map((x: any, i: number) => (
              <Row key={x.id ?? i} last={i === t.payouts.length - 1} title={`#${x.attempt} · ${x.providerCode}`} subtitle={x.failureReason ?? ''}
                meta={`Submitted ${dateTime(x.submittedAt)} · paid ${dateTime(x.paidAt)}`} right={<Pill label={x.status} />} />
            )) : <Empty text="No payout attempts." />}
          </Section>
          <Section title="Ledger journals"><LedgerGroups groups={d.ledgerGroups} /></Section>
          <Section title="Risk decision">
            {(d.risk ?? []).length ? d.risk.map((r: any, i: number) => (
              <Row key={r.id ?? i} last={i === d.risk.length - 1} title={`Score ${r.score}`} subtitle={r.explanation} meta={r.triggeredRules.join(', ') || '—'} right={<Pill label={r.outcome} />} />
            )) : <Empty text="No risk decision." />}
          </Section>
          <Section title="Audit & cases">
            {[...d.audit.map((a: any) => ({ id: a.id, when: a.createdAt, what: a.action, why: a.newValues?._reason })), ...d.cases.map((c: any) => ({ id: c.id, when: c.createdAt, what: `Case ${c.reference} · ${c.status}`, why: c.title }))].map((x, i, all) => (
              <Row key={x.id} last={i === all.length - 1} title={x.what} subtitle={x.why ?? ''} meta={dateTime(x.when)} />
            ))}
            {!d.audit.length && !d.cases.length ? <Empty text="Nothing recorded." /> : null}
          </Section>
        </>
      )}
      <ActionSheet visible={Boolean(action)} onClose={() => setAction(null)} danger={action === 'reject' || action === 'refund'}
        title={action === 'approve' ? 'Approve transfer' : action === 'reject' ? 'Reject transfer' : action === 'retry' ? 'Retry payout' : paid ? 'Request goodwill refund' : 'Refund transfer'}
        confirmLabel={action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : action === 'retry' ? 'Retry' : 'Refund'}
        reasonLabel={action === 'refund' ? 'Reason (at least 10 characters)' : 'Note'}
        description={action === 'refund' ? (paid ? 'The payout already completed, so this needs a second approver.' : 'Refunds above the approval threshold go to Approvals for a second person.') : undefined}
        onSubmit={async (_v, reason) => {
          if (action === 'approve' || action === 'reject') await cockpitCall(`/cockpit/remittance/transfers/${id}/review`, 'POST', { approve: action === 'approve', note: reason });
          else if (action === 'retry') await cockpitCall(`/cockpit/remittance/transfers/${id}/retry`, 'POST', { note: reason });
          else {
            const r = await cockpitCall<any>(`/cockpit/remittance/transfers/${id}/refund`, 'POST', { reason });
            setResult(r?.approval ? 'Refund sent to Approvals for a second approver.' : 'Refund recorded.');
          }
          await refresh();
        }} />
    </AdminScreen>
  );
}
