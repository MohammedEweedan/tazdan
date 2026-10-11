'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, Button, HStack, Input, Link, Select, Switch, Text, Textarea } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, dateTime, num } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { BarList } from '@/components/cockpit/charts';
import { DataTable, ErrorBox, Grid, Notice, PageHeader, Pagination, Panel, ReasonModal, Stat, StatusBadge } from '@/components/cockpit/ui';

const TABS = ['Cases', 'Screening', 'Rules', 'Watchlists'] as const;

export default function CompliancePage() {
  const t = useT();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Cases');
  return (
    <Box>
      <PageHeader title={t('Compliance')} subtitle="Case management, sanctions screening review, the risk rules the engine applies, and the watchlists it screens against." />
      <HStack mb={4} spacing={1} flexWrap="wrap">
        {TABS.map((x) => <Button key={x} size="sm" variant={tab === x ? 'solid' : 'ghost'} colorScheme={tab === x ? 'brand' : undefined} onClick={() => setTab(x)}>{x}</Button>)}
      </HStack>
      {tab === 'Cases' ? <Cases /> : tab === 'Screening' ? <Screening /> : tab === 'Rules' ? <Rules /> : <Watchlists />}
    </Box>
  );
}

function Cases() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<any>('/cockpit/compliance', { status, type, assigned: mine ? 'me' : '', page, limit: 25 }, { refreshMs: 60_000 });
  const q = data?.queues;
  return (
    <Box display="grid" gap={4}>
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <>
          <Grid min="160px">
            <Stat label="Open cases" value={num(data.total)} />
            <Stat label="Past SLA" value={num(q.overdueCases)} hint={q.overdueCases ? 'needs attention' : 'none'} />
            <Stat label="Screening hits to review" value={num(q.screeningHits)} />
            <Stat label="KYC queue" value={<Link as={NextLink} href="/admin/queues/kyc">{num(q.kyc)}</Link>} />
            <Stat label="KYB queue" value={<Link as={NextLink} href="/admin/businesses">{num(q.kyb)}</Link>} />
            <Stat label="Open AML flags" value={num(q.aml)} />
          </Grid>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr 1fr' }} gap={4}>
            <Panel title="Open cases by type"><BarList items={Object.entries(data.byType as Record<string, number>).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v }))} /></Panel>
            <Panel title="Case age"><BarList items={['<1d', '1-3d', '3-7d', '>7d'].map((k) => ({ label: k, value: data.ageing[k] ?? 0 }))} /></Panel>
            <Panel title="Highest-risk customers (30d)" pad={false}>
              <DataTable rows={data.highRiskUsers} empty="No customer scored 50 or more." columns={[
                { key: 'userId', label: 'Customer', render: (r: any) => r.userId ? <Link as={NextLink} href={`/admin/customers/${r.userId}`}>{r.userId.slice(0, 8)}</Link> : '—' },
                { key: 'score', label: 'Score', align: 'right' },
                { key: 'outcome', label: 'Outcome', render: (r: any) => <StatusBadge value={r.outcome} /> },
              ]} />
            </Panel>
          </Box>
        </>
      ) : null}
      <Panel title="Cases" pad={false} actions={
        <HStack>
          <HStack spacing={1}><Switch size="sm" isChecked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1); }} /><Text fontSize="12px">Mine</Text></HStack>
          <Select size="xs" w="150px" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            {['', 'KYC', 'KYB', 'AML', 'SANCTIONS', 'PEP', 'FRAUD', 'SOURCE_OF_FUNDS', 'SOURCE_OF_WEALTH', 'TRAVEL_RULE', 'OTHER'].map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All types'}</option>)}
          </Select>
          <Select size="xs" w="170px" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All open</option>
            {(data?.statuses ?? []).map((s: string) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </Select>
        </HStack>
      }>
        <DataTable loading={loading} rows={data?.cases} empty="No cases match." onRowClick={(r: any) => router.push(`/admin/compliance/${r.id}`)} columns={[
          { key: 'reference', label: 'Case', render: (r: any) => <Box><Text fontWeight={600}>{r.reference}</Text><Text fontSize="11px" opacity={0.7}>{r.type.replace(/_/g, ' ')}</Text></Box> },
          { key: 'title', label: 'Title', render: (r: any) => <Text fontSize="13px" maxW="360px">{r.title}</Text> },
          { key: 'priority', label: 'Priority', render: (r: any) => <StatusBadge value={r.priority} /> },
          { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
          { key: 'createdAt', label: 'Opened', render: (r: any) => ago(r.createdAt) },
          { key: 'slaDueAt', label: 'SLA', render: (r: any) => r.slaDueAt ? <Text color={new Date(r.slaDueAt) < new Date() ? 'red.400' : undefined}>{dateTime(r.slaDueAt)}</Text> : '—' },
          { key: 'assignedToId', label: 'Owner', render: (r: any) => r.assignedToId ? r.assignedToId.slice(0, 8) : 'unassigned' },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
      </Panel>
    </Box>
  );
}

function Screening() {
  const can = useCan();
  const { data, error, reload } = useApi<any>('/cockpit/compliance');
  const [review, setReview] = useState<{ id: string; status: 'FALSE_POSITIVE' | 'CONFIRMED_MATCH' } | null>(null);
  const hits: any[] = data?.screeningHits ?? [];
  return (
    <Box display="grid" gap={4}>
      <ErrorBox error={error} onRetry={reload} />
      <Notice>Potential matches hold the related transfer or beneficiary until reviewed. A confirmed match blocks the beneficiary; a false positive clears it. Both are audited.</Notice>
      <Panel title="Potential matches awaiting review" pad={false}>
        <DataTable rows={hits} empty="No unreviewed screening hits." columns={[
          { key: 'screenedAt', label: 'Screened', render: (r: any) => dateTime(r.screenedAt) },
          { key: 'subjectType', label: 'Subject', render: (r: any) => `${r.subjectType} ${r.subjectId.slice(0, 8)}` },
          { key: 'matches', label: 'Best matches', render: (r: any) => (
            <Box>{(Array.isArray(r.matches) ? r.matches : []).slice(0, 3).map((m: any, i: number) => (
              <Text key={i} fontSize="12px">{m.matchedName ?? '—'} · {m.listName} · score {typeof m.score === 'number' ? m.score.toFixed(2) : m.score}</Text>
            ))}</Box>
          ) },
          { key: 'listsChecked', label: 'Lists', render: (r: any) => r.listsChecked.join(', ') || '—' },
          { key: 'x', label: '', align: 'right', render: (r: any) => can('compliance.decide') ? (
            <HStack justify="flex-end">
              <Button size="xs" variant="outline" onClick={() => setReview({ id: r.id, status: 'FALSE_POSITIVE' })}>False positive</Button>
              <Button size="xs" colorScheme="red" variant="outline" onClick={() => setReview({ id: r.id, status: 'CONFIRMED_MATCH' })}>Confirm match</Button>
            </HStack>
          ) : null },
        ]} />
      </Panel>
      <ReasonModal isOpen={Boolean(review)} onClose={() => setReview(null)} danger={review?.status === 'CONFIRMED_MATCH'}
        title={review?.status === 'CONFIRMED_MATCH' ? 'Confirm sanctions / watchlist match' : 'Mark as false positive'} confirmLabel="Save decision"
        description={review?.status === 'CONFIRMED_MATCH' ? <Text fontSize="12px">The beneficiary is blocked. Follow your reporting obligations; this tool does not file reports to authorities.</Text> : null}
        onConfirm={async (note) => { await api(`/cockpit/compliance/screening/${review!.id}/review`, { method: 'POST', body: { status: review!.status, note } }); await reload(); }} />
    </Box>
  );
}

function Rules() {
  const can = useCan();
  const { data, error, reload } = useApi<any>('/cockpit/compliance/rules');
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<{ enabled: boolean; action: string; score: string; params: string }>({ enabled: true, action: 'REVIEW', score: '0', params: '{}' });
  const open = (r: any) => { setEdit(r); setForm({ enabled: r.enabled, action: r.action, score: String(r.score), params: JSON.stringify(r.params, null, 2) }); };
  return (
    <Box display="grid" gap={4}>
      <ErrorBox error={error} onRetry={reload} />
      <Panel title="Risk rules" subtitle="evaluated on every remittance, withdrawal and transfer; every change is versioned and audited" pad={false}>
        <DataTable rows={data?.rules} columns={[
          { key: 'code', label: 'Rule', render: (r: any) => <Box><Text fontWeight={600}>{r.name}</Text><Text fontSize="11px" opacity={0.7}>{r.code} · v{r.version}</Text></Box> },
          { key: 'category', label: 'Category' },
          { key: 'description', label: 'What it does', render: (r: any) => <Text fontSize="12px" maxW="360px">{r.description}</Text> },
          { key: 'action', label: 'Action', render: (r: any) => <StatusBadge value={r.action} /> },
          { key: 'score', label: 'Score', align: 'right' },
          { key: 'enabled', label: 'Enabled', render: (r: any) => <StatusBadge value={r.enabled ? 'ENABLED' : 'DISABLED'} /> },
          { key: 'fired30d', label: 'Fired 30d', align: 'right', render: (r: any) => num(r.fired30d) },
          { key: 'x', label: '', align: 'right', render: (r: any) => can('rules.manage') ? <Button size="xs" variant="ghost" onClick={() => open(r)}>Edit</Button> : null },
        ]} />
      </Panel>
      <ReasonModal isOpen={Boolean(edit)} onClose={() => setEdit(null)} minLength={10} title={`Edit rule ${edit?.code ?? ''}`} confirmLabel="Save new version"
        description={
          <Box display="grid" gap={2}>
            <HStack><Switch isChecked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /><Text fontSize="12px">Enabled</Text></HStack>
            <HStack>
              <Select size="sm" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                {['APPROVE', 'REVIEW', 'REJECT', 'FREEZE', 'REQUEST_INFORMATION', 'CHALLENGE', 'DELAY', 'BLOCK'].map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </Select>
              <Input size="sm" w="100px" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="Score" />
            </HStack>
            <Text fontSize="12px">Parameters (JSON)</Text>
            <Textarea size="sm" fontFamily="mono" rows={6} value={form.params} onChange={(e) => setForm({ ...form, params: e.target.value })} />
          </Box>
        }
        onConfirm={async (reason) => {
          let params: unknown;
          try { params = JSON.parse(form.params); } catch { throw new Error('Parameters are not valid JSON'); }
          await api(`/cockpit/compliance/rules/${edit.code}`, { method: 'PUT', body: { enabled: form.enabled, action: form.action, score: Number(form.score), params, reason } });
          await reload();
        }} />
    </Box>
  );
}

function Watchlists() {
  const can = useCan();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<any>('/cockpit/compliance/watchlist', { q, page, limit: 50 });
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [refreshOpen, setRefreshOpen] = useState(false);
  // While a refresh runs, poll so the status updates when it finishes.
  useEffect(() => {
    if (!data?.refreshing) return;
    const id = setInterval(() => { void reload(); }, 5000);
    return () => clearInterval(id);
  }, [data?.refreshing, reload]);
  return (
    <Box display="grid" gap={4}>
      <ErrorBox error={error} onRetry={reload} />
      {message ? <Notice>{message}</Notice> : null}
      {data && !data.lists.length ? (
        <Notice tone="warning">No watchlist is loaded. Screening runs but reports NO COVERAGE, and the engine routes those transfers to review. Refresh the official lists below (UN, OFAC, UK), import another export, or subscribe a screening provider — the platform never invents list data.</Notice>
      ) : null}
      <Panel title="Official lists" subtitle="Downloaded from the publishers and refreshed daily" pad={false}
        actions={can('watchlist.manage') ? <Button size="xs" isLoading={data?.refreshing} onClick={() => setRefreshOpen(true)}>Refresh now</Button> : null}>
        <DataTable rows={(data?.official ?? []).filter((l: any) => l.automatic).map((l: any) => ({ ...l, id: l.list }))} columns={[
          { key: 'list', label: 'List' },
          { key: 'activeEntries', label: 'Active entries', align: 'right', render: (l: any) => num(l.activeEntries) },
          { key: 'byType', label: 'Of which', render: (l: any) => <Text fontSize="12px">{Object.entries(l.byType).map(([k, v]) => `${num(v)} ${k.toLowerCase()}`).join(' · ') || '—'}</Text> },
          { key: 'last', label: 'Last refresh', render: (l: any) => l.last ? `${dateTime(l.last.syncedAt)}${l.last.ok ? ` · +${l.last.added} / ${l.last.updated} changed / −${l.last.removed}` : ''}` : 'never' },
          { key: 'status', label: 'Status', render: (l: any) => <Box><StatusBadge value={!l.last ? 'PENDING' : l.last.ok ? 'OK' : 'FAILED'} />{l.last && !l.last.ok ? <Text fontSize="11px" maxW="320px" mt={1}>{l.last.error}{l.last.lastGood ? ` (last good ${dateTime(l.last.lastGood.syncedAt)})` : ''}</Text> : null}</Box> },
        ]} />
      </Panel>
      <Panel title="Loaded lists" pad={false} actions={can('watchlist.manage') ? <Button size="xs" onClick={() => setImporting(true)}>Import list export</Button> : null}>
        <DataTable rows={data?.lists.map((l: any) => ({ ...l, id: `${l.listName}${l.source}` }))} empty="No lists loaded." columns={[
          { key: 'listName', label: 'List' }, { key: 'source', label: 'Source' },
          { key: 'entries', label: 'Active entries', align: 'right', render: (l: any) => num(l.entries) },
          { key: 'lastImported', label: 'Last import', render: (l: any) => dateTime(l.lastImported) },
        ]} />
      </Panel>
      <Panel title="Entries" pad={false} actions={<Input size="xs" w="220px" placeholder="Name or wallet address" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}>
        <DataTable loading={loading} rows={data?.items} columns={[
          { key: 'listName', label: 'List' }, { key: 'entityType', label: 'Type' },
          { key: 'name', label: 'Name / address', render: (e: any) => e.name ?? e.walletAddress ?? e.identifier ?? '—' },
          { key: 'aliases', label: 'Aliases', render: (e: any) => <Text fontSize="12px" maxW="260px">{e.aliases.join('; ') || '—'}</Text> },
          { key: 'country', label: 'Country', render: (e: any) => e.country ?? '—' },
          { key: 'dateOfBirth', label: 'DOB', render: (e: any) => e.dateOfBirth ?? '—' },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={50} onPage={setPage} /> : null}
      </Panel>
      <ReasonModal isOpen={refreshOpen} onClose={() => setRefreshOpen(false)} title="Refresh official sanctions lists" confirmLabel="Refresh" minLength={3}
        description={<Text fontSize="12px">Downloads the UN, OFAC SDN and UK lists from their publishers and updates the entries in place. It takes about a minute; a download much smaller than the loaded list is rejected rather than shrinking coverage.</Text>}
        onConfirm={async (reason) => {
          const r = await api<any>('/cockpit/compliance/watchlist/refresh', { method: 'POST', body: { reason } });
          setMessage(r.started ? 'Refresh started. Status updates here when it finishes.' : r.message);
          await reload();
        }} />
      <ReasonModal isOpen={importing} onClose={() => setImporting(false)} title="Import watchlist entries" confirmLabel="Import" minLength={3}
        description={
          <Box display="grid" gap={2}>
            <Text fontSize="12px">Paste CSV with a header row: <code>listName,entityType,name,aliases,country,dateOfBirth,walletAddress,identifier</code>. Separate aliases with “;”. entityType is PERSON, ORGANISATION, WALLET, BANK or COUNTRY. Use the reason box for the source (e.g. “OFAC SDN export 2026-10-01”).</Text>
            <Textarea size="sm" fontFamily="mono" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} />
          </Box>
        }
        onConfirm={async (source) => {
          const rows = parseCsv(csv);
          if (!rows.length) throw new Error('No rows found');
          const r = await api<any>('/cockpit/compliance/watchlist/import', { method: 'POST', body: { source, rows } });
          setMessage(`Imported ${r.created} entr${r.created === 1 ? 'y' : 'ies'}${r.skipped ? `, skipped ${r.skipped}` : ''}.`);
          setCsv(''); await reload();
        }} />
    </Box>
  );
}

/** Minimal CSV reader (quoted fields supported) for the watchlist import. */
function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = split(l);
    const row: Record<string, any> = {};
    head.forEach((h, i) => { if (cells[i]) row[h] = cells[i]; });
    if (row.aliases) row.aliases = String(row.aliases).split(';').map((s: string) => s.trim()).filter(Boolean);
    if (row.country) row.country = String(row.country).toUpperCase().slice(0, 2);
    return row;
  }).filter((r) => r.listName && r.entityType);
}
