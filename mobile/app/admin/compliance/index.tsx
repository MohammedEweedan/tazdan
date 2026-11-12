/**
 * Compliance — cases, sanctions screening review, risk rules and watchlists.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, NoPermission, Note, Pager, Pill, Row, SearchBox, Section, Segments, Stats, ago, cockpitCall, dateTime, num,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const TYPES = ['', 'KYC', 'KYB', 'AML', 'SANCTIONS', 'PEP', 'FRAUD', 'SOURCE_OF_FUNDS', 'SOURCE_OF_WEALTH', 'TRAVEL_RULE', 'OTHER'];
const ACTIONS = ['APPROVE', 'REVIEW', 'REJECT', 'FREEZE', 'REQUEST_INFORMATION', 'CHALLENGE', 'DELAY', 'BLOCK'];
type Tab = 'cases' | 'screening' | 'rules' | 'watchlists';

export default function AdminCompliance() {
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const ok = can('compliance.read');
  const [tab, setTab] = useState<Tab>('cases');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const cases = useCockpit<any>(ok ? '/cockpit/compliance' : null, { status, type, assigned: mine ? 'me' : '', page, limit: 25 }, { refreshMs: 60_000 });
  const rules = useCockpit<any>(ok && tab === 'rules' ? '/cockpit/compliance/rules' : null);
  const [wq, setWq] = useState('');
  const [wSearch, setWSearch] = useState('');
  const watch = useCockpit<any>(ok && tab === 'watchlists' ? '/cockpit/compliance/watchlist' : null, { q: wSearch, page: 1, limit: 30 });
  const [review, setReview] = useState<{ id: string; status: 'FALSE_POSITIVE' | 'CONFIRMED_MATCH' } | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [refreshLists, setRefreshLists] = useState(false);
  const d = cases.data;
  const hits: any[] = d?.screeningHits ?? [];

  return (
    <AdminScreen title="Compliance" subtitle="Cases, screening, rules and watchlists"
      refreshControl={<RefreshControl refreshing={cases.isFetching} onRefresh={() => { cases.refetch(); rules.refetch(); watch.refetch(); }} tintColor={p.fg} />}>
      {!ok ? <NoPermission perm="compliance.read" /> : null}
      <ErrorNote error={cases.error} onRetry={() => cases.refetch()} />
      <Segments value={tab} onChange={setTab} options={[
        { key: 'cases', label: 'Cases' }, { key: 'screening', label: `Screening${hits.length ? ` (${hits.length})` : ''}` },
        { key: 'rules', label: 'Rules' }, { key: 'watchlists', label: 'Watchlists' },
      ]} />

      {tab === 'cases' ? (
        <>
          {d ? (
            <Stats items={[
              { label: 'Open cases', value: num(Object.values<number>(d.byType ?? {}).reduce((a, b) => a + b, 0)) },
              { label: 'Older than 7 days', value: num(d.ageing?.['>7d'] ?? 0), tone: (d.ageing?.['>7d'] ?? 0) ? 'warn' : undefined },
            ]} />
          ) : null}
          <Segments value={type} onChange={(v) => { setType(v); setPage(1); }} options={TYPES.map((s) => ({ key: s, label: s ? s.replace(/_/g, ' ') : 'All types' }))} />
          <Segments value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ key: '', label: 'All open' }, ...(d?.statuses ?? []).map((s: string) => ({ key: s, label: s.replace(/_/g, ' ').toLowerCase() }))]} />
          <Segments value={mine ? 'me' : 'all'} onChange={(v) => { setMine(v === 'me'); setPage(1); }} options={[{ key: 'all', label: 'Everyone\'s' }, { key: 'me', label: 'Assigned to me' }]} />
          <Section>
            {(d?.cases ?? []).length ? (d.cases as any[]).map((c, i, all) => (
              <Row key={c.id} last={i === all.length - 1} title={`${c.reference} · ${c.type.replace(/_/g, ' ')}`} subtitle={c.title}
                meta={`Opened ${ago(c.createdAt)}${c.slaDueAt ? ` · SLA ${dateTime(c.slaDueAt)}${new Date(c.slaDueAt) < new Date() ? ' (overdue)' : ''}` : ''} · ${c.assignedToId ? c.assignedToId.slice(0, 8) : 'unassigned'}`}
                right={<View style={{ alignItems: 'flex-end', gap: 4 }}><Pill label={c.status} /><Pill label={c.priority} /></View>}
                onPress={() => router.push(`/admin/compliance/${c.id}` as any)} />
            )) : <Empty loading={cases.isLoading} text="No cases match." />}
          </Section>
          <Pager page={page} total={d?.total} limit={25} onPage={setPage} />
          {d?.highRiskUsers?.length ? (
            <Section title="Highest-risk customers (30d)">
              {d.highRiskUsers.map((r: any, i: number) => (
                <Row key={`${r.userId}${i}`} last={i === d.highRiskUsers.length - 1} title={r.userId ? r.userId.slice(0, 8) : '—'} subtitle={`Score ${r.score}`}
                  right={<Pill label={r.outcome} />} onPress={r.userId ? () => router.push(`/admin/customer/${r.userId}` as any) : undefined} />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}

      {tab === 'screening' ? (
        <Section title="Potential matches awaiting review">
          {hits.length ? hits.map((r, i) => (
            <Row key={r.id} last={i === hits.length - 1} title={`${r.subjectType} ${r.subjectId.slice(0, 8)}`}
              subtitle={(Array.isArray(r.matches) ? r.matches : []).slice(0, 3).map((m: any) => `${m.matchedName ?? '—'} · ${m.listName} · ${typeof m.score === 'number' ? m.score.toFixed(2) : m.score}`).join('\n')}
              meta={`${dateTime(r.screenedAt)} · ${r.listsChecked.join(', ') || '—'}`}
              right={can('compliance.decide') ? (
                <View style={{ gap: 6 }}>
                  <Btn small tone="ghost" label="False positive" onPress={() => setReview({ id: r.id, status: 'FALSE_POSITIVE' })} />
                  <Btn small tone="danger" label="Confirm" onPress={() => setReview({ id: r.id, status: 'CONFIRMED_MATCH' })} />
                </View>
              ) : undefined} />
          )) : <Empty text="No unreviewed screening hits." />}
        </Section>
      ) : null}

      {tab === 'rules' ? (
        <Section title="Risk rules" subtitle="Evaluated on every remittance, withdrawal and transfer; versioned and audited">
          {(rules.data?.rules ?? []).length ? (rules.data.rules as any[]).map((r, i, all) => (
            <Row key={r.code} last={i === all.length - 1} title={`${r.name} · v${r.version}`} subtitle={r.description}
              meta={`${r.code} · ${r.category} · score ${r.score} · fired ${num(r.fired30d)} in 30d`}
              right={<View style={{ alignItems: 'flex-end', gap: 4 }}><Pill label={r.enabled ? 'ENABLED' : 'DISABLED'} /><Pill label={r.action} tone="muted" /></View>}
              onPress={can('rules.manage') ? () => setEdit(r) : undefined} />
          )) : <Empty loading={rules.isLoading} text="No rules." />}
        </Section>
      ) : null}

      {tab === 'watchlists' ? (
        <>
          {watch.data && !watch.data.lists.length ? <Note tone="warn">No watchlist is loaded. Screening reports no coverage and routes those transfers to review. Refresh the official lists.</Note> : null}
          {can('watchlist.manage') ? <View style={{ marginBottom: 12 }}><Btn label="Refresh official lists" onPress={() => setRefreshLists(true)} /></View> : null}
          <Section title="Official lists" subtitle="Downloaded from the publishers and refreshed daily">
            {(watch.data?.official ?? []).filter((l: any) => l.automatic).map((l: any, i: number, all: any[]) => (
              <Row key={l.list} last={i === all.length - 1} title={`${l.list} · ${num(l.activeEntries)} entries`}
                subtitle={l.last ? `Last refresh ${dateTime(l.last.syncedAt)}${l.last.ok ? ` · +${l.last.added} / ${l.last.updated} changed / −${l.last.removed}` : ''}` : 'Never refreshed'}
                right={<Pill label={!l.last ? 'PENDING' : l.last.ok ? 'OK' : 'FAILED'} />} />
            ))}
          </Section>
          <SearchBox value={wq} onChange={setWq} onSubmit={() => setWSearch(wq.trim())} placeholder="Name or wallet address" />
          <Section title="Entries">
            {(watch.data?.entries ?? watch.data?.items ?? []).length ? (watch.data.entries ?? watch.data.items).map((e: any, i: number, all: any[]) => (
              <Row key={e.id} last={i === all.length - 1} title={e.name ?? e.fullName ?? e.walletAddress ?? '—'} subtitle={`${e.listName ?? e.source ?? ''}${e.entityType ? ` · ${e.entityType}` : ''}`} />
            )) : <Empty loading={watch.isLoading} text="No entries." />}
          </Section>
        </>
      ) : null}

      <ActionSheet visible={Boolean(review)} onClose={() => setReview(null)} danger={review?.status === 'CONFIRMED_MATCH'}
        title={review?.status === 'CONFIRMED_MATCH' ? 'Confirm sanctions match' : 'Mark as false positive'} confirmLabel={review?.status === 'CONFIRMED_MATCH' ? 'Confirm match' : 'False positive'}
        reasonLabel="Note" description={review?.status === 'CONFIRMED_MATCH' ? 'A confirmed match blocks the subject and opens a case.' : 'The matcher remembers this so the same pairing is not raised again.'}
        onSubmit={async (_v, note) => { await cockpitCall(`/cockpit/compliance/screening/${review!.id}/review`, 'POST', { status: review!.status, note }); await refresh(); }} />
      <ActionSheet visible={Boolean(edit)} onClose={() => setEdit(null)} title={edit ? `Edit ${edit.name}` : ''} confirmLabel="Save rule" reasonLabel="Reason (at least 10 characters)"
        fields={edit ? [
          { key: 'enabled', label: 'Enabled', type: 'toggle', initial: edit.enabled },
          { key: 'action', label: 'Action when it fires', type: 'select', initial: edit.action, options: ACTIONS.map((a) => ({ value: a, label: a.replace(/_/g, ' ').toLowerCase() })) },
          { key: 'score', label: 'Score (0–100)', type: 'number', initial: String(edit.score) },
          { key: 'params', label: 'Parameters (JSON)', type: 'multiline', initial: JSON.stringify(edit.params ?? {}, null, 2) },
        ] : []}
        onSubmit={async (v, reason) => {
          if (reason.length < 10) throw new Error('Write at least 10 characters');
          let params: Record<string, unknown>;
          try { params = JSON.parse(String(v.params || '{}')); } catch { throw new Error('Parameters are not valid JSON'); }
          await cockpitCall(`/cockpit/compliance/rules/${edit.code}`, 'PUT', { enabled: v.enabled, action: v.action, score: Math.round(Number(v.score)), params, reason });
          await refresh();
        }} />
      <ActionSheet visible={refreshLists} onClose={() => setRefreshLists(false)} title="Refresh official sanctions lists" confirmLabel="Refresh"
        description="Downloads the UN, OFAC and UK lists now. It can take a minute."
        onSubmit={async (_v, reason) => { await cockpitCall('/cockpit/compliance/watchlist/refresh', 'POST', { reason }); await refresh(); }} />
    </AdminScreen>
  );
}
