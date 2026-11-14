/**
 * Remittance — corridors, the compliance review queue, payout providers and
 * transfers (last 30 days), with corridor status and pricing controls.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, NoPermission, Note, Pager, Pill, Row, SearchBox, Section, Segments, Stats, ago, cockpitCall, money, num,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const STATES = ['', 'MANUAL_REVIEW', 'PAYOUT_PENDING', 'RECONCILIATION_PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'REJECTED', 'DISPUTED'];
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export default function AdminRemittance() {
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const ok = can('remittance.read');
  const overview = useCockpit<any>(ok ? '/cockpit/remittance' : null, { days: 30 }, { refreshMs: 60_000 });
  const [state, setState] = useState('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useCockpit<any>(ok ? '/cockpit/remittance/transfers' : null, { state, q, page, limit: 25 });
  const [status, setStatus] = useState<any>(null);
  const [pricing, setPricing] = useState<any>(null);
  const o = overview.data;
  const total = o ? Object.values<number>(o.states).reduce((a, b) => a + b, 0) : 0;

  return (
    <AdminScreen title="Remittance" subtitle="Cross-border transfers"
      refreshControl={<RefreshControl refreshing={overview.isFetching || list.isFetching} onRefresh={() => { overview.refetch(); list.refetch(); }} tintColor={p.fg} />}>
      {!ok ? <NoPermission perm="remittance.read" /> : null}
      <ErrorNote error={overview.error} onRetry={() => overview.refetch()} />
      {o && o.corridors.every((c: any) => c.status !== 'LIVE') ? <Note tone="warn">No corridor is LIVE. Every corridor runs against sandbox payout rails until a payout partner is activated.</Note> : null}
      {o ? (
        <>
          <Stats items={[
            { label: 'Transfers (30d)', value: num(total) },
            { label: 'In manual review', value: num(o.states.MANUAL_REVIEW ?? 0), tone: (o.states.MANUAL_REVIEW ?? 0) ? 'warn' : undefined },
            { label: 'Payouts in flight', value: num((o.states.PAYOUT_PENDING ?? 0) + (o.states.SETTLED ?? 0)) },
            { label: 'Completed', value: num(o.states.COMPLETED ?? 0) },
            { label: 'Failed / disputed', value: num(o.failures), tone: o.failures ? 'bad' : undefined },
            { label: 'Refunded', value: num(o.states.REFUNDED ?? 0) },
          ]} />
          {o.reviews.length ? (
            <Section title="Compliance review queue" subtitle="Funds are held in clearing until a decision">
              {o.reviews.map((r: any, i: number) => (
                <Row key={r.id} last={i === o.reviews.length - 1} title={`${r.reference} · ${r.corridor.code}`}
                  subtitle={`${r.user.firstName} ${r.user.lastName} · ${money(r.totalDebit, r.sourceCurrency)} · risk ${r.riskScore ?? '—'}`}
                  meta={`Waiting ${ago(r.createdAt)}`} onPress={() => router.push(`/admin/remittance/${r.id}` as any)} />
              ))}
            </Section>
          ) : null}
          <Section title="Corridors" subtitle="Status, pricing and 30-day activity">
            {o.corridors.map((c: any, i: number) => (
              <Row key={c.code} last={i === o.corridors.length - 1} title={`${c.code} · ${c.name}`}
                subtitle={`${c.feeFixed} ${c.sourceCurrency} + ${pct(c.feePercent)} · FX margin ${pct(c.spreadPercent)} · ${num(c.minAmount)}–${num(c.maxAmount)} ${c.destCurrency}`}
                meta={`${c.transfers} transfers · $${num(c.volumeUsd)} volume`}
                right={<View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Pill label={c.status} />
                  {can('remittance.configure') ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Btn small tone="ghost" label="Status" onPress={() => setStatus(c)} />
                      <Btn small tone="ghost" label="Pricing" onPress={() => setPricing(c)} />
                    </View>
                  ) : null}
                </View>} />
            ))}
          </Section>
          {o.providers?.length ? (
            <Section title="Payout providers (30d)">
              {o.providers.map((x: any, i: number) => (
                <Row key={x.providerCode} last={i === o.providers.length - 1} title={x.providerCode}
                  subtitle={`${x.payouts} payouts · ${x.paid} paid · ${x.failed} failed · ${x.inFlight} in flight`}
                  meta={`Success ${x.successRate === null ? '—' : `${(x.successRate * 100).toFixed(1)}%`} · avg ${x.avgDeliveryMinutes === null ? '—' : `${Math.round(x.avgDeliveryMinutes)} min`}`} />
              ))}
            </Section>
          ) : null}
        </>
      ) : overview.isLoading ? <Empty loading text="" /> : null}

      <SearchBox value={text} onChange={setText} onSubmit={() => { setQ(text.trim()); setPage(1); }} placeholder="Reference, sender or beneficiary" />
      <Segments value={state} onChange={(v) => { setState(v); setPage(1); }} options={STATES.map((s) => ({ key: s, label: s ? s.replace(/_/g, ' ').toLowerCase() : 'All states' }))} />
      <Section title="Transfers">
        {(list.data?.items ?? []).length ? (list.data.items as any[]).map((r, i, all) => (
          <Row key={r.id} last={i === all.length - 1} title={`${r.reference} · ${r.corridor.code}`}
            subtitle={`${r.user.firstName} ${r.user.lastName} → ${r.beneficiary.fullName} (${r.beneficiary.country})`}
            meta={`${money(r.totalDebit, r.sourceCurrency)} → ${money(r.receiveAmount, r.destCurrency)} · ${r.providerCode ?? '—'} · ${ago(r.createdAt)}`}
            right={<Pill label={r.state} />} onPress={() => router.push(`/admin/remittance/${r.id}` as any)} />
        )) : <Empty loading={list.isLoading} text="No transfers." />}
      </Section>
      <Pager page={page} total={list.data?.total} limit={25} onPage={setPage} />

      <ActionSheet visible={Boolean(status)} onClose={() => setStatus(null)} title={`Corridor ${status?.code}`} confirmLabel="Change status" danger
        fields={[{ key: 'status', label: 'New status', type: 'select', options: ['LIVE', 'SANDBOX_ONLY', 'PAUSED', 'DISABLED'].filter((s) => s !== status?.status).map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) }]}
        onSubmit={async (v, reason) => { await cockpitCall(`/cockpit/remittance/corridors/${status.code}/status`, 'PUT', { status: v.status, reason }); await refresh(); }} />
      <ActionSheet visible={Boolean(pricing)} onClose={() => setPricing(null)} title={`Pricing · ${pricing?.code}`} confirmLabel="Save pricing"
        description="Fee percent and FX margin are fractions: 0.015 = 1.5%. Leave a field as is to keep it."
        fields={pricing ? [
          { key: 'feeFixed', label: `Fixed fee (${pricing.sourceCurrency})`, type: 'number', initial: String(pricing.feeFixed) },
          { key: 'feePercent', label: 'Fee percent (fraction, max 0.1)', type: 'number', initial: String(pricing.feePercent) },
          { key: 'spreadPercent', label: 'FX margin (fraction, max 0.1)', type: 'number', initial: String(pricing.spreadPercent) },
          { key: 'minAmount', label: `Minimum (${pricing.destCurrency})`, type: 'number', initial: String(pricing.minAmount) },
          { key: 'maxAmount', label: `Maximum (${pricing.destCurrency})`, type: 'number', initial: String(pricing.maxAmount) },
        ] : []}
        onSubmit={async (v, reason) => {
          const n = (k: string) => Number(String(v[k]).replace(',', '.'));
          await cockpitCall(`/cockpit/remittance/corridors/${pricing.code}/pricing`, 'PUT', {
            feeFixed: n('feeFixed'), feePercent: n('feePercent'), spreadPercent: n('spreadPercent'), minAmount: n('minAmount'), maxAmount: n('maxAmount'), reason,
          });
          await refresh();
        }} />
    </AdminScreen>
  );
}
