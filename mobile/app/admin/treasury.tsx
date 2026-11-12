/**
 * Treasury — prefunded liquidity, settlement obligations, alerts, pool
 * movements and thresholds, and principal crypto exposure with hedges and
 * limits.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, NoPermission, Pill, Row, Section, Stats, cockpitCall, dateTime, money, num,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const usd = (n: unknown) => `$${num(n, 0)}`;

export default function AdminTreasury() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const ok = can('treasury.read');
  const q = useCockpit<any>(ok ? '/cockpit/treasury' : null, undefined, { refreshMs: 60_000 });
  const principal = useCockpit<any>(ok ? '/cockpit/treasury/principal' : null, undefined, { refreshMs: 60_000 });
  const [move, setMove] = useState<any>(null);
  const [thresholds, setThresholds] = useState<any>(null);
  const [hedge, setHedge] = useState(false);
  const [limitFor, setLimitFor] = useState<{ asset: string; limitUsd: string } | null>(null);
  const d = q.data;
  const pr = principal.data;
  const totalUsd = (d?.byCurrency ?? []).reduce((n: number, c: any) => n + Number(c.usd ?? 0), 0);

  return (
    <AdminScreen title="Treasury" subtitle="Liquidity, settlement and exposure"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => { q.refetch(); principal.refetch(); }} tintColor={p.fg} />}>
      {!ok ? <NoPermission perm="treasury.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {d ? (
        <>
          <Stats items={[
            { label: 'Pool liquidity', value: usd(totalUsd) },
            { label: 'Pools funded', value: `${d.positions.filter((x: any) => Number(x.balance) > 0).length} / ${d.positions.length}` },
            { label: 'Open settlements', value: num(d.settlements.length) },
            { label: 'Alerts', value: num(d.alerts.length), tone: d.alerts.some((a: any) => ['CRITICAL', 'HIGH'].includes(a.severity)) ? 'bad' : undefined },
          ]} />
          {d.alerts.length ? (
            <Section title="Alerts">
              {d.alerts.slice(0, 10).map((a: any, i: number, all: any[]) => (
                <Row key={a.id ?? i} last={i === all.length - 1} title={a.type.replace(/_/g, ' ').toLowerCase()} subtitle={a.message} right={<Pill label={a.severity} />} />
              ))}
            </Section>
          ) : null}
          <Section title="Liquidity by currency">
            {d.byCurrency.map((c: any, i: number) => (
              <Row key={c.currency} last={i === d.byCurrency.length - 1} title={`${c.currency} · ${usd(c.usd)}`}
                subtitle={`${money(c.available, c.currency)} available · ${money(c.pendingPayouts, c.currency)} pending payouts`} />
            ))}
          </Section>
          <Section title="Pools">
            {d.positions.map((x: any, i: number) => (
              <Row key={x.id} last={i === d.positions.length - 1} title={`${x.code} · ${money(x.balance, x.currency)}`}
                subtitle={`${x.entity} · ${x.location} · reserved ${money(x.reserved, x.currency)} · available ${money(x.available, x.currency)}`}
                meta={`Min ${num(x.minimum)} / target ${num(x.target)} · ${x.utilisationPct}% utilised`}
                right={can('treasury.operate') ? (
                  <View style={{ gap: 6 }}>
                    <Btn small tone="ghost" label="Movement" onPress={() => setMove(x)} />
                    <Btn small tone="ghost" label="Limits" onPress={() => setThresholds(x)} />
                  </View>
                ) : undefined} />
            ))}
          </Section>
          <Section title="Settlement obligations" subtitle="Post-funded partners, net per day">
            {d.settlements.length ? d.settlements.map((s: any, i: number) => (
              <Row key={s.id ?? i} last={i === d.settlements.length - 1} title={`${s.reference} · ${s.providerCode}`} subtitle={money(s.amount, s.currency)} meta={`Due ${dateTime(s.dueAt)}`} right={<Pill label={s.status} />} />
            )) : <Empty text="No open obligations." />}
          </Section>
          <Section title="Recent movements" subtitle="Append-only">
            {d.movements.slice(0, 25).map((m: any, i: number, all: any[]) => (
              <Row key={m.id} last={i === all.length - 1} title={`${m.pool.code} · ${m.type}`} subtitle={money(m.amount, m.pool.currency)} meta={`${dateTime(m.createdAt)} · ${m.reference ?? m.note ?? ''}`} />
            ))}
          </Section>
        </>
      ) : q.isLoading ? <Empty loading text="" /> : null}

      <Section title="Principal crypto exposure"
        subtitle={pr ? `${pr.mode === 'PRINCIPAL' ? 'Customer orders fill against Tazdan' : 'Orders are placed on the exchange'} · ${usd(pr.totalExposureUsd)} of ${usd(pr.totalLimitUsd)}` : undefined}
        right={<View style={{ flexDirection: 'row', gap: 6 }}>
          {can('treasury.operate') ? <Btn small tone="ghost" label="Hedge" onPress={() => setHedge(true)} /> : null}
          {can('controls.operate') ? <Btn small tone="ghost" label="Total limit" onPress={() => setLimitFor({ asset: 'TOTAL', limitUsd: String(pr?.totalLimitUsd ?? '') })} /> : null}
        </View>}>
        {(pr?.positions ?? []).length ? pr.positions.map((r: any, i: number) => (
          <Row key={r.asset} last={i === pr.positions.length - 1} title={`${r.asset} · ${Number(r.position) < 0 ? 'short' : Number(r.position) > 0 ? 'long' : 'flat'} ${num(Math.abs(Number(r.position)), 6)}`}
            subtitle={`Customers net ${num(Number(r.customerNetBought), 6)} · hedged ${num(Number(r.hedgedNet), 6)}`}
            meta={`Exposure ${usd(r.exposureUsd)} of ${usd(r.limitUsd)}`}
            right={<View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Pill label={Number(r.exposureUsd) >= Number(r.limitUsd) ? 'PAUSED' : 'OK'} />
              {can('controls.operate') ? <Btn small tone="ghost" label="Limit" onPress={() => setLimitFor({ asset: r.asset, limitUsd: String(r.limitUsd) })} /> : null}
            </View>} />
        )) : <Empty loading={principal.isLoading} text="No principal fills or hedges yet." />}
      </Section>
      {(pr?.hedges ?? []).length ? (
        <Section title="Hedges">
          {pr.hedges.slice(0, 20).map((h: any, i: number, all: any[]) => (
            <Row key={h.id} last={i === all.length - 1} title={`${h.side} ${num(Number(h.quantity), 6)} ${h.asset} @ ${usd(h.priceUsd)}`} subtitle={`${h.venue}${h.reference ? ` · ${h.reference}` : ''}`} meta={dateTime(h.createdAt)} />
          ))}
        </Section>
      ) : null}
      {d?.ledgerPositions?.length ? (
        <Section title="Ledger positions" subtitle="Treasury also holds collected principal until it is swept to partners">
          {d.ledgerPositions.map((l: any, i: number) => (
            <Row key={i} last={i === d.ledgerPositions.length - 1} title={`${l.type} · ${l.currency}`} right={<Pill label={money(l.balance, l.currency)} tone="muted" />} />
          ))}
        </Section>
      ) : null}

      <ActionSheet visible={Boolean(move)} onClose={() => setMove(null)} title={`Record movement · ${move?.code ?? ''}`} confirmLabel="Record" reasonLabel="Note"
        fields={[
          { key: 'direction', label: 'Direction', type: 'select', options: [
            { value: 'PREFUND', label: 'Prefund' }, { value: 'WITHDRAW', label: 'Withdraw' },
            { value: 'ADJUST_IN', label: 'Adjust +' }, { value: 'ADJUST_OUT', label: 'Adjust −' },
          ] },
          { key: 'amount', label: `Amount (${move?.currency ?? ''})`, type: 'number', placeholder: '0.00' },
          { key: 'reference', label: 'Bank or statement reference', type: 'text', placeholder: 'At least 3 characters' },
        ]}
        onSubmit={async (v, note) => {
          await cockpitCall('/cockpit/treasury/movements', 'POST', { poolId: move.id, direction: v.direction, amount: String(v.amount).replace(',', '.'), reference: String(v.reference).trim(), note });
          await refresh();
        }} />
      <ActionSheet visible={Boolean(thresholds)} onClose={() => setThresholds(null)} title={`Thresholds · ${thresholds?.code ?? ''}`} confirmLabel="Save"
        fields={thresholds ? [
          { key: 'minimum', label: 'Minimum balance', type: 'number', initial: String(thresholds.minimum ?? 0) },
          { key: 'target', label: 'Target balance', type: 'number', initial: String(thresholds.target ?? 0) },
          { key: 'maxExposure', label: 'Maximum exposure', type: 'number', initial: String(thresholds.maxExposure ?? 0) },
        ] : []}
        onSubmit={async (v, reason) => {
          await cockpitCall(`/cockpit/treasury/pools/${thresholds.id}/thresholds`, 'PUT', { minimum: Number(v.minimum), target: Number(v.target), maxExposure: Number(v.maxExposure), reason });
          await refresh();
        }} />
      <ActionSheet visible={hedge} onClose={() => setHedge(false)} title="Record a hedge" confirmLabel="Record" reasonLabel="Note"
        fields={[
          { key: 'asset', label: 'Asset', type: 'text', placeholder: 'BTC' },
          { key: 'side', label: 'Side', type: 'select', options: [{ value: 'BUY', label: 'Bought' }, { value: 'SELL', label: 'Sold' }] },
          { key: 'quantity', label: 'Quantity', type: 'number' },
          { key: 'priceUsd', label: 'Price (USD)', type: 'number' },
          { key: 'venue', label: 'Venue', type: 'text' },
          { key: 'reference', label: 'Venue order reference', type: 'text', optional: true },
        ]}
        onSubmit={async (v, note) => {
          await cockpitCall('/cockpit/treasury/principal/hedges', 'POST', {
            asset: String(v.asset).toUpperCase().trim(), side: v.side, quantity: String(v.quantity), priceUsd: String(v.priceUsd),
            venue: String(v.venue).trim(), reference: String(v.reference ?? '').trim() || undefined, note,
          });
          await refresh();
        }} />
      <ActionSheet visible={Boolean(limitFor)} onClose={() => setLimitFor(null)} title={limitFor?.asset === 'TOTAL' ? 'Total exposure limit' : `Exposure limit · ${limitFor?.asset ?? ''}`} confirmLabel="Save limit"
        fields={[{ key: 'limitUsd', label: 'Limit in USD', type: 'number', initial: limitFor?.limitUsd }]}
        onSubmit={async (v, reason) => {
          const n = Number(String(v.limitUsd).replace(',', '.'));
          if (!Number.isFinite(n) || n < 0) throw new Error('Enter a limit in USD');
          await cockpitCall('/cockpit/treasury/principal/limits', 'PUT', { asset: limitFor!.asset, limitUsd: n, reason });
          await refresh();
        }} />
    </AdminScreen>
  );
}
