/**
 * Audit — every privileged action: who, what, when, where, why, before and
 * after. Records are append-only at the database level.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  Empty, ErrorNote, KV, NoPermission, Pager, Row, SearchBox, Section, Segments, dateTime, shortId,
  useCockpit, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminAudit() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const r = useCockpit<any>(can('audit.read') ? '/cockpit/audit' : null, { q, action, page, limit: 30 });
  const actor = (id: string | null) => {
    const a = r.data?.actors?.find((x: any) => x.id === id);
    return a ? `${a.firstName} ${a.lastName}` : id ? shortId(id) : 'system';
  };
  const actions: any[] = r.data?.actions ?? [];

  return (
    <AdminScreen title="Audit" subtitle="Append-only record of staff actions"
      refreshControl={<RefreshControl refreshing={r.isFetching} onRefresh={() => r.refetch()} tintColor={p.fg} />}>
      {!can('audit.read') ? <NoPermission perm="audit.read" /> : null}
      <SearchBox value={text} onChange={setText} onSubmit={() => { setQ(text.trim()); setPage(1); }} placeholder="Entity ID, staff ID, IP or action" />
      {actions.length ? (
        <Segments value={action} onChange={(v) => { setAction(v); setPage(1); }}
          options={[{ key: '', label: 'All actions' }, ...actions.slice(0, 30).map((a) => ({ key: a.action, label: `${a.action} (${a.count})` }))]} />
      ) : null}
      <ErrorNote error={r.error} onRetry={() => r.refetch()} />
      <Section>
        {r.isLoading ? <Empty loading text="" /> : (r.data?.items ?? []).length ? (r.data.items as any[]).map((x, i, all) => (
          <Row key={x.id} last={i === all.length - 1} title={x.action} subtitle={`${x.entity} ${shortId(x.entityId)}${x.newValues?._reason ? ` — ${x.newValues._reason}` : ''}`}
            meta={`${dateTime(x.createdAt)} · ${actor(x.userId)} · ${x.ipAddress ?? 'no IP'}`} onPress={() => setSelected(x)} />
        )) : <Empty text="No records." />}
      </Section>
      <Pager page={page} total={r.data?.total} limit={30} onPage={setPage} />

      <BottomSheet visible={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.action ?? ''}>
        {selected ? (
          <View>
            <KV items={[
              ['Who', actor(selected.userId)], ['When', dateTime(selected.createdAt)], ['Where', selected.ipAddress ?? '—'],
              ['Entity', selected.entity], ['Entity ID', selected.entityId ?? '—'],
            ]} />
            <Text style={{ color: p.fg, fontWeight: '700', fontSize: 13, marginTop: 12 }}>Before</Text>
            <Text selectable style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 16 }}>{JSON.stringify(selected.oldValues, null, 2) ?? '—'}</Text>
            <Text style={{ color: p.fg, fontWeight: '700', fontSize: 13, marginTop: 12 }}>After</Text>
            <Text selectable style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 16 }}>{JSON.stringify(selected.newValues, null, 2) ?? '—'}</Text>
            {selected.userAgent ? <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 10 }}>{selected.userAgent}</Text> : null}
          </View>
        ) : null}
      </BottomSheet>
    </AdminScreen>
  );
}
