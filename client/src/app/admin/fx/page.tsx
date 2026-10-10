'use client';

import { useState } from 'react';
import { Box, Button, HStack, Input, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, money } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { LineChart } from '@/components/cockpit/charts';
import { DataTable, ErrorBox, Notice, PageHeader, Panel, ReasonModal, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

export default function FxPage() {
  const t = useT();
  const c = useCockpitColors();
  const can = useCan();
  const { data, error, reload } = useApi<any>('/cockpit/fx', undefined, { refreshMs: 60_000 });
  const [open, setOpen] = useState(false);
  const [pair, setPair] = useState('USD/LYD');
  const [buy, setBuy] = useState('');
  const [sell, setSell] = useState('');
  const [mins, setMins] = useState('120');
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Box>
      <PageHeader title={t('FX')} subtitle="Effective customer rates, the live provider feed underneath them, treasury overrides and conversion activity."
        actions={can('fx.override') ? <Button size="sm" onClick={() => setOpen(true)}>Request override</Button> : null} />
      {message ? <Box mb={3}><Notice>{message}</Notice></Box> : null}
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <Box display="grid" gap={4}>
          <Panel title="Rates" subtitle="buy / sell = what a customer pays / receives per 1 unit of base" pad={false}>
            <DataTable rows={data.rates.map((r: any) => ({ ...r, id: r.pair }))} columns={[
              { key: 'pair', label: 'Pair' },
              { key: 'effective', label: 'Effective buy / sell', align: 'right', render: (r: any) => r.effective ? `${Number(r.effective.buyPrice).toFixed(4)} / ${Number(r.effective.sellPrice).toFixed(4)}` : 'unavailable' },
              { key: 'source', label: 'Source', render: (r: any) => r.effective?.source ?? '—' },
              { key: 'live', label: 'Live feed buy / sell', align: 'right', render: (r: any) => r.live ? `${Number(r.live.buyPrice).toFixed(4)} / ${Number(r.live.sellPrice).toFixed(4)}` : 'no feed' },
              { key: 'override', label: 'Override', render: (r: any) => r.override ? <Box><StatusBadge value={r.override.expired ? 'EXPIRED' : 'ACTIVE'} /><Text fontSize="11px">{r.override.reason ?? '—'}{r.override.expiresAt ? ` · ${r.override.expired ? 'lapsed' : 'until'} ${dateTime(r.override.expiresAt)}` : ''}</Text></Box> : '—' },
            ]} />
          </Panel>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1.4fr 1fr' }} gap={4}>
            <Panel title="USD/LYD effective rate (7 days)">
              <LineChart zeroBased={false} data={data.history.map((h: any) => ({ at: new Date(h.at).toISOString().slice(0, 16).replace('T', ' '), price: h.price }))} xKey="at" format={(n) => n.toFixed(3)} series={[{ key: 'price', label: 'USD/LYD', color: c.series1 }]} />
            </Panel>
            <Panel title="Activity (30 days)" pad={false}>
              <DataTable rows={[
                ...data.quotes.map((q: any) => ({ id: `q${q.sourceCurrency}${q.destCurrency}`, kind: `Remittance quotes ${q.sourceCurrency}→${q.destCurrency}`, count: q._count, amount: money(q._sum.sendAmount, q.sourceCurrency) })),
                ...data.conversions.map((x: any) => ({ id: `c${x.currency}`, kind: `Wallet conversions from ${x.currency}`, count: x._count, amount: money(Math.abs(Number(x._sum.amount)), x.currency) })),
                ...data.remittanceRevenue30d.map((r: any) => ({ id: `r${r.currency}`, kind: `Remittance revenue (fee + FX margin) · ${r.currency}`, count: '', amount: money(r.amount, r.currency) })),
              ]} empty="No FX activity in 30 days." columns={[{ key: 'kind', label: 'Item' }, { key: 'count', label: 'Count', align: 'right' }, { key: 'amount', label: 'Amount', align: 'right' }]} />
            </Panel>
          </Box>
          <Panel title="Override history" pad={false}>
            <DataTable rows={data.overrides} empty="No overrides recorded." columns={[
              { key: 'createdAt', label: 'When', render: (a: any) => dateTime(a.createdAt) }, { key: 'action', label: 'Action' },
              { key: 'pair', label: 'Pair / rate', render: (a: any) => a.newValues ? `${a.newValues.pair ?? ''} ${a.newValues.buyPrice ?? ''}/${a.newValues.sellPrice ?? ''}` : '—' },
              { key: 'reason', label: 'Reason', render: (a: any) => a.newValues?._reason ?? '—' },
              { key: 'userId', label: 'By', render: (a: any) => a.userId?.slice(0, 8) ?? '—' },
            ]} />
          </Panel>
        </Box>
      ) : null}
      <ReasonModal isOpen={open} onClose={() => setOpen(false)} title="Request treasury FX override" confirmLabel="Send for approval" minLength={10}
        description={
          <Box display="grid" gap={2}>
            <Text fontSize="12px">A second authorised person must approve before it applies. It lapses automatically at expiry.</Text>
            <HStack>
              <Select size="sm" value={pair} onChange={(e) => setPair(e.target.value)}>{['USD/LYD', 'EUR/LYD', 'GBP/LYD', 'EGP/LYD', 'TRY/LYD', 'AED/LYD', 'TND/LYD', 'SAR/LYD'].map((p) => <option key={p}>{p}</option>)}</Select>
              <Input size="sm" placeholder="Buy" value={buy} onChange={(e) => setBuy(e.target.value)} />
              <Input size="sm" placeholder="Sell" value={sell} onChange={(e) => setSell(e.target.value)} />
            </HStack>
            <HStack><Text fontSize="12px">Expires after</Text><Input size="sm" w="100px" value={mins} onChange={(e) => setMins(e.target.value)} /><Text fontSize="12px">minutes (5–1440)</Text></HStack>
          </Box>
        }
        onConfirm={async (reason) => {
          const [base, quote] = pair.split('/');
          const r = await api<any>('/cockpit/fx/overrides', { method: 'POST', body: { base, quote, buyPrice: Number(buy), sellPrice: Number(sell), expiresInMinutes: Number(mins), reason } });
          setMessage(`Override request ${r.approvalId} sent to the approvals queue.`);
        }} />
    </Box>
  );
}
