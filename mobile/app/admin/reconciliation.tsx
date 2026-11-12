/**
 * Reconciliation — provider statements against internal payouts, ledger
 * integrity runs, exceptions and fund integrity per currency.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, JsonSheet, NoPermission, Pager, Pill, Row, Section, Segments, Stats, ago, cockpitCall, dateTime, money, num,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const BREAKS = ['', 'AMOUNT_MISMATCH', 'MISSING_INTERNAL', 'MISSING_EXTERNAL', 'STATUS_MISMATCH', 'FEE_MISMATCH', 'CURRENCY_MISMATCH', 'DUPLICATE', 'LATE_SETTLEMENT', 'PARTIAL', 'MATCHED'];

export default function AdminReconciliation() {
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const ok = can('recon.read');
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState('OPEN');
  const [page, setPage] = useState(1);
  const q = useCockpit<any>(ok ? '/cockpit/reconciliation' : null, { status, resolution, page, limit: 25 });
  const funds = useCockpit<any>(ok ? '/cockpit/reconciliation/fund-integrity' : null);
  const providers = useCockpit<any>(ok ? '/cockpit/providers' : null);
  const [run, setRun] = useState<'LEDGER_INTEGRITY' | 'PROVIDER_STATEMENT' | null>(null);
  const [ack, setAck] = useState<any>(null);
  const [resolve, setResolve] = useState<any>(null);
  const [raw, setRaw] = useState<any>(null);
  const summary: any[] = q.data?.summary ?? [];
  const openCount = summary.filter((s) => s.status !== 'MATCHED' && s.resolution === 'OPEN').reduce((n, s) => n + s.count, 0);
  const matched = summary.filter((s) => s.status === 'MATCHED').reduce((n, s) => n + s.count, 0);
  const all = summary.reduce((n, s) => n + s.count, 0);
  const fundRows: any[] = (funds.data?.perCurrency ?? []).filter((c: any) => c.flows.length || Number(c.internalHeld) !== 0);
  const payoutProviders = (providers.data?.providers ?? []).filter((x: any) => ['PAYOUT', 'BANK', 'REMITTANCE'].includes(x.category));

  return (
    <AdminScreen title="Reconciliation" subtitle="Statements, integrity and exceptions"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => { q.refetch(); funds.refetch(); }} tintColor={p.fg} />}>
      {!ok ? <NoPermission perm="recon.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {can('recon.run') ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={{ flex: 1 }}><Btn label="Integrity check" onPress={() => setRun('LEDGER_INTEGRITY')} /></View>
          <View style={{ flex: 1 }}><Btn tone="ghost" label="Reconcile provider" onPress={() => setRun('PROVIDER_STATEMENT')} /></View>
        </View>
      ) : null}
      {q.data ? (
        <Stats items={[
          { label: 'Open exceptions', value: num(openCount), tone: openCount ? 'warn' : 'ok' },
          { label: 'Items checked', value: num(all) },
          { label: 'Match rate', value: all ? `${((matched / all) * 100).toFixed(1)}%` : '—' },
          { label: 'Last run', value: q.data.runs[0] ? ago(q.data.runs[0].createdAt) : 'never' },
        ]} />
      ) : null}

      <Section title="Fund integrity" subtitle="Every unit held traced to money that entered from outside">
        {fundRows.length ? fundRows.map((r, i) => (
          <Row key={r.currency} last={i === fundRows.length - 1} title={`${r.currency} · wallets ${money(r.customerWallets, r.currency)}`}
            subtitle={`Held ${money(r.tazdanHeld, r.currency)} · entered ${money(r.enteredOutside, r.currency)} · drift ${money(r.diff, r.currency)}`}
            meta={`Unbacked since baseline ${money(r.unbackedSinceBaseline, r.currency)} · ${num(r.railExceptions)} record mismatches`}
            right={<View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Pill label={r.ok ? 'OK' : 'EXCEPTION'} tone={r.ok ? 'ok' : 'bad'} />
              {can('adjustments.approve') && Number(r.unbackedSinceBaseline) !== 0 ? <Btn small tone="ghost" label="Acknowledge" onPress={() => setAck(r)} /> : null}
            </View>} />
        )) : <Empty loading={funds.isLoading} text="No ledger activity yet." />}
      </Section>

      <Segments value={resolution} onChange={(v) => { setResolution(v); setPage(1); }} options={['OPEN', 'RESOLVED', 'WRITTEN_OFF', 'ESCALATED', ''].map((s) => ({ key: s, label: s ? s.replace('_', ' ').toLowerCase() : 'Any resolution' }))} />
      <Segments value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={BREAKS.map((s) => ({ key: s, label: s ? s.replace(/_/g, ' ').toLowerCase() : 'All breaks' }))} />
      <Section title="Exceptions">
        {(q.data?.items ?? []).length ? (q.data.items as any[]).map((r, i, list) => (
          <Row key={r.id} last={i === list.length - 1} title={`${r.status.replace(/_/g, ' ')} · ${r.run.source.replace(/_/g, ' ').toLowerCase()}${r.run.providerCode ? ` · ${r.run.providerCode}` : ''}`}
            subtitle={`Internal ${r.internalAmount !== null ? money(r.internalAmount, r.currency ?? '') : '—'} · external ${r.externalAmount !== null ? money(r.externalAmount, r.currency ?? '') : '—'}${r.externalRef ? ` · ${r.externalRef}` : ''}`}
            meta={dateTime(r.createdAt)}
            right={<View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Pill label={r.resolution} />
              {can('recon.resolve') && r.resolution === 'OPEN' ? <Btn small tone="ghost" label="Resolve" onPress={() => setResolve(r)} /> : null}
            </View>}
            onPress={() => (r.details?.transferId ? router.push(`/admin/remittance/${r.details.transferId}` as any) : setRaw(r))} />
        )) : <Empty loading={q.isLoading} text="No exceptions match this filter." />}
      </Section>
      <Pager page={page} total={q.data?.total} limit={25} onPage={setPage} />

      <Section title="Runs">
        {(q.data?.runs ?? []).slice(0, 15).map((r: any, i: number, list: any[]) => (
          <Row key={r.id} last={i === list.length - 1} title={`${r.source.replace(/_/g, ' ').toLowerCase()}${r.providerCode ? ` · ${r.providerCode}` : ''}`}
            subtitle={r.totals ? Object.entries(r.totals).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k} ${v}`).join(' · ') : ''}
            meta={dateTime(r.createdAt)} right={<Pill label={r.status} />} />
        ))}
      </Section>

      <ActionSheet visible={Boolean(run)} onClose={() => setRun(null)} title={run === 'LEDGER_INTEGRITY' ? 'Run ledger integrity check' : 'Reconcile a provider (last 48h)'} confirmLabel="Run"
        reason={false}
        fields={run === 'PROVIDER_STATEMENT' ? [{ key: 'provider', label: 'Provider', type: 'select', options: payoutProviders.map((x: any) => ({ value: x.code, label: x.name ?? x.code })) }] : []}
        onSubmit={async (v) => {
          if (run === 'PROVIDER_STATEMENT' && !v.provider) throw new Error('Choose a provider');
          await cockpitCall('/cockpit/reconciliation/runs', 'POST', run === 'PROVIDER_STATEMENT' ? { source: run, providerCode: v.provider, hours: 48 } : { source: run });
          await refresh();
        }} />
      <ActionSheet visible={Boolean(ack)} onClose={() => setAck(null)} title={`Acknowledge unbacked ${ack?.currency ?? ''} history`} confirmLabel="Acknowledge" danger
        reasonLabel="Note (at least 10 characters)"
        description="Sets a baseline so only new unbacked movement raises an alert. It does not create money or fix balances — investigate the history first."
        onSubmit={async (_v, note) => {
          if (note.length < 10) throw new Error('Write at least 10 characters');
          await cockpitCall('/cockpit/reconciliation/fund-integrity/baseline', 'POST', { currency: ack.currency, note });
          await refresh();
        }} />
      <ActionSheet visible={Boolean(resolve)} onClose={() => setResolve(null)} title="Resolve exception" confirmLabel="Save" reasonLabel="Note"
        fields={[{ key: 'resolution', label: 'Resolution', type: 'select', options: [
          { value: 'RESOLVED', label: 'Resolved' }, { value: 'ESCALATED', label: 'Escalate' }, { value: 'WRITTEN_OFF', label: 'Write off' },
        ] }]}
        onSubmit={async (v, note) => { await cockpitCall(`/cockpit/reconciliation/items/${resolve.id}/resolve`, 'POST', { resolution: v.resolution, note }); await refresh(); }} />
      <JsonSheet value={raw} onClose={() => setRaw(null)} title="Exception detail" />
    </AdminScreen>
  );
}
