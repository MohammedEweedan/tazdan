'use client';

import { useState } from 'react';
import { Box, HStack, Input, Select, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, money, num, usd } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { BarList } from '@/components/cockpit/charts';
import { DataTable, ErrorBox, Grid, Notice, PageHeader, Panel, ReasonModal, Stat, StatusBadge } from '@/components/cockpit/ui';

export default function TreasuryPage() {
  const t = useT();
  const can = useCan();
  const { data, error, reload } = useApi<any>('/cockpit/treasury', undefined, { refreshMs: 60_000 });
  const [move, setMove] = useState<any>(null);
  const [direction, setDirection] = useState('PREFUND');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [allAlerts, setAllAlerts] = useState(false);
  const principal = useApi<any>('/cockpit/treasury/principal', undefined, { refreshMs: 60_000 });
  const [hedgeOpen, setHedgeOpen] = useState(false);
  const [hedge, setHedge] = useState({ asset: 'BTC', side: 'BUY', quantity: '', priceUsd: '', venue: '', reference: '' });
  const [limitFor, setLimitFor] = useState<string | null>(null);
  const [limitUsd, setLimitUsd] = useState('');
  const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedAlerts = [...(data?.alerts ?? [])].sort((a: any, b: any) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
  const totalUsd = (data?.byCurrency ?? []).reduce((n: number, c: any) => n + c.usd, 0);

  return (
    <Box>
      <PageHeader title={t('Treasury')} subtitle="Prefunded liquidity at payout partners and in the house wallet, earmarks for routed transfers, settlement obligations and alerts." />
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <Box display="grid" gap={4}>
          <Grid min="180px">
            <Stat label="Total pool liquidity" value={usd(totalUsd, true)} hint="USD at current rates" />
            <Stat label="Pools" value={num(data.positions.length)} hint={`${data.positions.filter((p: any) => Number(p.balance) > 0).length} funded`} />
            <Stat label="Open settlement obligations" value={num(data.settlements.length)} />
            <Stat label="Alerts" value={num(data.alerts.length)} hint={data.alerts.filter((a: any) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length ? 'includes high severity' : 'none high severity'} />
          </Grid>
          {data.alerts.length ? (
            <Panel title="Alerts" subtitle={Object.entries(data.alerts.reduce((m: Record<string, number>, a: any) => ({ ...m, [a.severity]: (m[a.severity] ?? 0) + 1 }), {})).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')} pad={false}
              actions={data.alerts.length > 5 ? <Text as="button" fontSize="12px" onClick={() => setAllAlerts((v) => !v)}>{allAlerts ? 'Show fewer' : `Show all ${data.alerts.length}`}</Text> : null}>
              <DataTable rows={sortedAlerts.slice(0, allAlerts ? undefined : 5).map((a: any, i: number) => ({ ...a, id: i }))} columns={[
                { key: 'severity', label: 'Severity', render: (a: any) => <StatusBadge value={a.severity} /> },
                { key: 'type', label: 'Type', render: (a: any) => a.type.replace(/_/g, ' ').toLowerCase() }, { key: 'message', label: 'Detail' },
              ]} />
            </Panel>
          ) : <Notice>No treasury alerts.</Notice>}
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            <Panel title="Liquidity by currency" subtitle="balance in USD">
              <BarList items={data.byCurrency.map((c: any) => ({ label: c.currency, value: c.usd, sub: `${money(c.available, c.currency)} available · ${money(c.pendingPayouts, c.currency)} pending payouts` }))} format={(n) => usd(n, true)} />
            </Panel>
            <Panel title="Settlement obligations" subtitle="post-funded partners, net per day" pad={false}>
              <DataTable rows={data.settlements} empty="No open obligations." columns={[
                { key: 'reference', label: 'Reference' }, { key: 'providerCode', label: 'Partner' },
                { key: 'amount', label: 'Amount', align: 'right', render: (s: any) => money(s.amount, s.currency) },
                { key: 'dueAt', label: 'Due', render: (s: any) => dateTime(s.dueAt) }, { key: 'status', label: 'Status', render: (s: any) => <StatusBadge value={s.status} /> },
              ]} />
            </Panel>
          </Box>
          <Panel title="Pools" pad={false}>
              <DataTable rows={data.positions} columns={[
                { key: 'code', label: 'Pool', render: (p: any) => <Box><Text fontWeight={600}>{p.code}</Text><Text fontSize="11px" opacity={0.7}>{p.entity} · {p.location}</Text></Box> },
                { key: 'balance', label: 'Balance', align: 'right', render: (p: any) => money(p.balance, p.currency) },
                { key: 'reserved', label: 'Reserved', align: 'right', render: (p: any) => money(p.reserved, p.currency) },
                { key: 'available', label: 'Available', align: 'right', render: (p: any) => money(p.available, p.currency) },
                { key: 'minimum', label: 'Min / target', align: 'right', render: (p: any) => `${num(p.minimum)} / ${num(p.target)}` },
                { key: 'utilisationPct', label: 'Utilised', align: 'right', render: (p: any) => `${p.utilisationPct}%` },
                { key: 'x', label: '', align: 'right', render: (p: any) => can('treasury.operate') ? <Text as="button" fontSize="12px" color="brand.500" onClick={() => setMove(p)}>Record movement</Text> : null },
              ]} />
            </Panel>
          <Panel title="Recent movements" subtitle="append-only; latest 50" pad={false}>
              <DataTable rows={data.movements} columns={[
                { key: 'createdAt', label: 'When', render: (m: any) => dateTime(m.createdAt) }, { key: 'pool', label: 'Pool', render: (m: any) => m.pool.code },
                { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', align: 'right', render: (m: any) => money(m.amount, m.pool.currency) },
                { key: 'note', label: 'Reference / note', render: (m: any) => <Text fontSize="12px" maxW="420px" noOfLines={1} title={m.note ?? m.reference ?? ''}>{m.reference ?? m.note ?? '—'}</Text> },
              ]} />
            </Panel>
          <Panel title="Principal crypto exposure" pad={false}
            subtitle={principal.data ? `${principal.data.mode === 'PRINCIPAL' ? 'No reachable exchange: customer orders fill against Tazdan' : 'Orders are placed on the exchange'} · total ${usd(Number(principal.data.totalExposureUsd))} of ${usd(Number(principal.data.totalLimitUsd))} limit` : undefined}
            actions={<HStack>
              {can('treasury.operate') ? <Text as="button" fontSize="12px" onClick={() => setHedgeOpen(true)}>Record hedge</Text> : null}
              {can('controls.operate') ? <Text as="button" fontSize="12px" onClick={() => { setLimitFor('TOTAL'); setLimitUsd(principal.data?.totalLimitUsd ?? ''); }}>Total limit</Text> : null}
            </HStack>}>
            <ErrorBox error={principal.error} onRetry={principal.reload} />
            <DataTable rows={(principal.data?.positions ?? []).map((r: any) => ({ ...r, id: r.asset }))} empty="No principal fills or hedges yet." columns={[
              { key: 'asset', label: 'Asset' },
              { key: 'customerNetBought', label: 'Customers net bought', align: 'right', render: (r: any) => num(Number(r.customerNetBought)) },
              { key: 'hedgedNet', label: 'Hedged', align: 'right', render: (r: any) => num(Number(r.hedgedNet)) },
              { key: 'position', label: 'Tazdan position', align: 'right', render: (r: any) => `${Number(r.position) < 0 ? 'short ' : Number(r.position) > 0 ? 'long ' : ''}${num(Math.abs(Number(r.position)))}` },
              { key: 'exposureUsd', label: 'Exposure', align: 'right', render: (r: any) => usd(Number(r.exposureUsd)) },
              { key: 'limitUsd', label: 'Limit', align: 'right', render: (r: any) => usd(Number(r.limitUsd)) },
              { key: 'state', label: '', render: (r: any) => <StatusBadge value={Number(r.exposureUsd) >= Number(r.limitUsd) ? 'PAUSED' : 'OK'} /> },
              { key: 'x', label: '', align: 'right', render: (r: any) => can('controls.operate') ? <Text as="button" fontSize="12px" onClick={() => { setLimitFor(r.asset); setLimitUsd(r.limitUsd); }}>Limit…</Text> : null },
            ]} />
            {principal.data?.hedges?.length ? (
              <Box borderTopWidth="1px">
                <DataTable rows={principal.data.hedges} columns={[
                  { key: 'createdAt', label: 'Hedged', render: (h: any) => dateTime(h.createdAt) },
                  { key: 'asset', label: 'Asset' }, { key: 'side', label: 'Side' },
                  { key: 'quantity', label: 'Quantity', align: 'right', render: (h: any) => num(Number(h.quantity)) },
                  { key: 'priceUsd', label: 'Price', align: 'right', render: (h: any) => usd(Number(h.priceUsd)) },
                  { key: 'venue', label: 'Venue' }, { key: 'reference', label: 'Reference', render: (h: any) => h.reference ?? '—' },
                ]} />
              </Box>
            ) : null}
          </Panel>
          <Panel title="Ledger positions" subtitle="TREASURY also holds principal collected from senders in the source currency until it is swept to partners, so it can exceed the pool balances above; integrity reconciliation compares only pool movements" pad={false}>
            <DataTable rows={data.ledgerPositions.map((l: any, i: number) => ({ ...l, id: i }))} columns={[
              { key: 'type', label: 'Account' }, { key: 'currency', label: 'Currency' },
              { key: 'balance', label: 'Balance', align: 'right', render: (l: any) => money(l.balance, l.currency) },
            ]} />
          </Panel>
        </Box>
      ) : null}
      <ReasonModal isOpen={hedgeOpen} onClose={() => setHedgeOpen(false)} title="Record a hedge" confirmLabel="Record"
        description={
          <Box display="grid" gap={2}>
            <Text fontSize="12px">Records a trade Tazdan placed on an exchange or OTC desk to offset the position above. Buying reduces a short position. Hedges cannot be edited afterwards.</Text>
            <HStack>
              <Input size="sm" placeholder="Asset (BTC)" value={hedge.asset} onChange={(e) => setHedge({ ...hedge, asset: e.target.value.toUpperCase() })} />
              <Select size="sm" value={hedge.side} onChange={(e) => setHedge({ ...hedge, side: e.target.value })}>
                <option value="BUY">Bought</option><option value="SELL">Sold</option>
              </Select>
            </HStack>
            <HStack>
              <Input size="sm" placeholder="Quantity" value={hedge.quantity} onChange={(e) => setHedge({ ...hedge, quantity: e.target.value })} />
              <Input size="sm" placeholder="Price (USD)" value={hedge.priceUsd} onChange={(e) => setHedge({ ...hedge, priceUsd: e.target.value })} />
            </HStack>
            <HStack>
              <Input size="sm" placeholder="Venue" value={hedge.venue} onChange={(e) => setHedge({ ...hedge, venue: e.target.value })} />
              <Input size="sm" placeholder="Venue order reference" value={hedge.reference} onChange={(e) => setHedge({ ...hedge, reference: e.target.value })} />
            </HStack>
          </Box>
        }
        onConfirm={async (note) => {
          await api('/cockpit/treasury/principal/hedges', { method: 'POST', body: { ...hedge, reference: hedge.reference || undefined, note } });
          setHedge({ asset: hedge.asset, side: 'BUY', quantity: '', priceUsd: '', venue: hedge.venue, reference: '' });
          await principal.reload();
        }} />
      <ReasonModal isOpen={Boolean(limitFor)} onClose={() => setLimitFor(null)} danger
        title={limitFor === 'TOTAL' ? 'Total principal exposure limit' : `Principal exposure limit · ${limitFor ?? ''}`} confirmLabel="Save limit"
        description={
          <Box display="grid" gap={2}>
            <Text fontSize="12px">Customer orders that would take Tazdan's unhedged position past this value (USD) are refused while no exchange is reachable. 0 stops principal fills.</Text>
            <Input size="sm" placeholder="Limit in USD" value={limitUsd} onChange={(e) => setLimitUsd(e.target.value)} />
          </Box>
        }
        onConfirm={async (reason) => {
          const n = Number(limitUsd);
          if (!Number.isFinite(n) || n < 0) throw new Error('Enter a limit of 0 or more');
          await api('/cockpit/treasury/principal/limits', { method: 'PUT', body: { asset: limitFor, limitUsd: n, reason } });
          await principal.reload();
        }} />
      <ReasonModal isOpen={Boolean(move)} onClose={() => setMove(null)} title={`Record movement · ${move?.code ?? ''}`} confirmLabel="Record"
        description={
          <Box display="grid" gap={2}>
            <Text fontSize="12px">Records money moved by treasury into or out of this pool and posts the matching ledger journal. Use the bank or partner reference.</Text>
            <HStack>
              <Select size="sm" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="PREFUND">Prefund (money sent to partner)</option>
                <option value="WITHDRAW">Withdraw (money returned)</option>
                <option value="ADJUST_IN">Statement adjustment +</option>
                <option value="ADJUST_OUT">Statement adjustment −</option>
              </Select>
              <Input size="sm" placeholder={`Amount ${move?.currency ?? ''}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </HStack>
            <Input size="sm" placeholder="Bank / partner reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Box>
        }
        onConfirm={async (note) => {
          await api('/cockpit/treasury/movements', { method: 'POST', body: { poolId: move.id, direction, amount, reference, note } });
          setAmount(''); setReference(''); await reload();
        }} />
    </Box>
  );
}
