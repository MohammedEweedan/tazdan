/**
 * FX — effective customer rates, the live feed underneath them, override
 * history and conversion activity. Overrides go to Approvals (maker-checker).
 */
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, NoPermission, Note, Pill, Row, Section, cockpitCall, dateTime, money,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const PAIRS = ['USD/LYD', 'EUR/LYD', 'GBP/LYD', 'EGP/LYD', 'TRY/LYD', 'AED/LYD', 'TND/LYD', 'SAR/LYD'];
const f4 = (v: unknown) => Number(v).toFixed(4);

export default function AdminFx() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const ok = can('fx.read');
  const q = useCockpit<any>(ok ? '/cockpit/fx' : null, undefined, { refreshMs: 60_000 });
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const d = q.data;

  return (
    <AdminScreen title="FX" subtitle="Rates, feed and overrides"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!ok ? <NoPermission perm="fx.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {done ? <Note tone="ok">{done}</Note> : null}
      {can('fx.override') ? <Btn label="Request an FX override" onPress={() => setOpen(true)} /> : null}
      <Note>Buy / sell = what a customer pays / receives per 1 unit of base. LYD prices come from the market maker around the Fulus rate.</Note>
      {d ? (
        <>
          <Section title="Rates">
            {d.rates.map((r: any, i: number) => (
              <Row key={r.pair} last={i === d.rates.length - 1} title={`${r.pair} · ${r.effective ? `${f4(r.effective.buyPrice)} / ${f4(r.effective.sellPrice)}` : 'unavailable'}`}
                subtitle={`Source ${r.effective?.source ?? '—'} · feed ${r.live ? `${f4(r.live.buyPrice)} / ${f4(r.live.sellPrice)}` : 'none'}`}
                meta={r.override ? `Override: ${r.override.reason ?? '—'}${r.override.expiresAt ? ` · until ${dateTime(r.override.expiresAt)}` : ''}` : undefined}
                right={r.override ? <Pill label={r.override.expired ? 'EXPIRED' : 'ACTIVE'} /> : undefined} />
            ))}
          </Section>
          <Section title="Activity (30 days)">
            {[
              ...d.quotes.map((x: any) => ({ id: `q${x.sourceCurrency}${x.destCurrency}`, title: `Remittance quotes ${x.sourceCurrency}→${x.destCurrency}`, sub: `${x._count} · ${money(x._sum.sendAmount, x.sourceCurrency)}` })),
              ...d.conversions.map((x: any) => ({ id: `c${x.currency}`, title: `Wallet conversions from ${x.currency}`, sub: `${x._count} · ${money(Math.abs(Number(x._sum.amount)), x.currency)}` })),
              ...d.remittanceRevenue30d.map((x: any) => ({ id: `r${x.currency}`, title: `Remittance revenue · ${x.currency}`, sub: money(x.amount, x.currency) })),
            ].map((x, i, all) => <Row key={x.id} last={i === all.length - 1} title={x.title} subtitle={x.sub} />)}
            {!d.quotes.length && !d.conversions.length ? <Empty text="No FX activity in 30 days." /> : null}
          </Section>
          <Section title="Override history">
            {d.overrides.length ? d.overrides.map((a: any, i: number) => (
              <Row key={a.id} last={i === d.overrides.length - 1} title={`${a.action} · ${a.newValues?.pair ?? ''} ${a.newValues?.buyPrice ?? ''}/${a.newValues?.sellPrice ?? ''}`}
                subtitle={a.newValues?._reason ?? ''} meta={`${dateTime(a.createdAt)} · ${a.userId?.slice(0, 8) ?? '—'}`} />
            )) : <Empty text="No overrides recorded." />}
          </Section>
        </>
      ) : q.isLoading ? <Empty loading text="" /> : null}

      <ActionSheet visible={open} onClose={() => setOpen(false)} title="Request FX override" confirmLabel="Send for approval" reasonLabel="Reason (at least 10 characters)"
        description="A second authorised person must approve it in Approvals before it applies."
        fields={[
          { key: 'pair', label: 'Pair', type: 'select', options: PAIRS.map((x) => ({ value: x, label: x })) },
          { key: 'buy', label: 'Buy price (customer pays)', type: 'number' },
          { key: 'sell', label: 'Sell price (customer receives)', type: 'number' },
          { key: 'mins', label: 'Expires in minutes (5–1440)', type: 'number', initial: '60' },
        ]}
        onSubmit={async (v, reason) => {
          if (reason.length < 10) throw new Error('Write at least 10 characters');
          const [base, quote] = String(v.pair).split('/');
          await cockpitCall('/cockpit/fx/overrides', 'POST', {
            base, quote, buyPrice: Number(String(v.buy).replace(',', '.')), sellPrice: Number(String(v.sell).replace(',', '.')),
            expiresInMinutes: Math.round(Number(v.mins)), reason,
          });
          setDone('Override sent to Approvals.');
          await refresh();
        }} />
    </AdminScreen>
  );
}
