/**
 * LYDT supervision (sandbox) — reserve report, CBL reserve statements and
 * holder freezes: the central bank's powers in the LYDT proposal.
 */
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, KV, NoPermission, Note, Row, Section, cockpitCall, dateTime, money, shortId,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminLydt() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const q = useCockpit<any>(can('treasury.read') ? '/cockpit/lydt' : null);
  const [attest, setAttest] = useState(false);
  const [freeze, setFreeze] = useState<{ userId?: string; unfreeze?: boolean } | null>(null);
  const r = q.data?.reserves;

  return (
    <AdminScreen title="LYDT supervision" subtitle="Dinar token sandbox"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!can('treasury.read') ? <NoPermission perm="treasury.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      <Note tone="warn">Sandbox only. LYDT must not go public without Central Bank of Libya authorisation.</Note>
      {r ? (
        <Section title="Reserve report" subtitle={r.peg}>
          <KV items={[
            ['Supply', money(r.supply, 'LYDT')], ['Reserve ledger', money(r.reserveLedger, 'LYD')],
            ['Attested reserve', r.attestation ? money(r.attestation.balance, 'LYD') : 'none'],
            ['Statement', r.attestation ? `${r.attestation.reference} · ${dateTime(r.attestation.statementDate)}` : '—'],
            ['Statement fresh', r.attestation ? (r.attestation.fresh ? 'Yes' : 'No — issuance paused') : '—'],
          ]} />
        </Section>
      ) : <Empty loading={q.isLoading} text="No reserve report." />}
      {can('treasury.operate') ? <Btn label="Record a reserve statement" onPress={() => setAttest(true)} /> : null}
      <Section title="Reserve statements">
        {(q.data?.attestations ?? []).length ? q.data.attestations.map((a: any, i: number, all: any[]) => (
          <Row key={a.id} last={i === all.length - 1} title={money(a.balance, 'LYD')} subtitle={a.reference} meta={`Statement ${dateTime(a.statementDate)} · recorded ${dateTime(a.createdAt)}`} />
        )) : <Empty text="No statements yet." />}
      </Section>
      <Section title="Frozen holders" right={can('customers.freeze') ? <Btn small tone="ghost" label="Freeze holder" onPress={() => setFreeze({})} /> : null}>
        {(q.data?.frozen ?? []).length ? q.data.frozen.map((f: any, i: number, all: any[]) => (
          <Row key={f.id ?? f.userId} last={i === all.length - 1} title={shortId(f.userId)} subtitle={f.reason ?? ''} meta={dateTime(f.createdAt)}
            right={can('customers.freeze') ? <Btn small tone="ghost" label="Unfreeze" onPress={() => setFreeze({ userId: f.userId, unfreeze: true })} /> : undefined} />
        )) : <Empty text="No frozen holders." />}
      </Section>
      <ActionSheet visible={attest} onClose={() => setAttest(false)} title="Reserve statement" confirmLabel="Record" reason={false}
        description="The attested dinar balance held for LYDT, from the bank's statement. Issuance stops when the statement is older than allowed."
        fields={[
          { key: 'balance', label: 'Attested balance (LYD)', type: 'number' },
          { key: 'reference', label: 'Statement reference', type: 'text' },
          { key: 'date', label: 'Statement date (YYYY-MM-DD)', type: 'text', initial: new Date().toISOString().slice(0, 10) },
        ]}
        onSubmit={async (v) => {
          const d = new Date(`${v.date}T00:00:00Z`);
          await cockpitCall('/cockpit/lydt/attestations', 'POST', { balance: Number(String(v.balance).replace(',', '.')), reference: String(v.reference).trim(), statementDate: d.toISOString() });
          await refresh();
        }} />
      <ActionSheet visible={Boolean(freeze)} onClose={() => setFreeze(null)} danger={!freeze?.unfreeze} title={freeze?.unfreeze ? 'Unfreeze holder' : 'Freeze holder'} confirmLabel={freeze?.unfreeze ? 'Unfreeze' : 'Freeze'}
        fields={freeze?.userId ? [] : [{ key: 'userId', label: 'Customer ID', type: 'text' }]}
        onSubmit={async (v, reason) => {
          const id = freeze?.userId ?? String(v.userId).trim();
          await cockpitCall(`/cockpit/lydt/holders/${id}/${freeze?.unfreeze ? 'unfreeze' : 'freeze'}`, 'POST', { reason });
          await refresh();
        }} />
    </AdminScreen>
  );
}
