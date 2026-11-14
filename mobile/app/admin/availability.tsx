/**
 * Availability — hide or lock a feature, currency or pair for everyone or for
 * chosen customers (same rules and endpoints as the web cockpit).
 */
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, Switch, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  Btn, Empty, ErrorNote, Note, Pill, Row, SearchBox, Section, Segments, cockpitCall, dateTime, errMsg, personName,
  useCockpit, useCockpitRefresh, useStaff, type Tone,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';
import { api } from '@/lib/api';

type State = 'AVAILABLE' | 'LOCKED' | 'HIDDEN';
type Kind = 'FEATURE' | 'CURRENCY' | 'PAIR';
interface Rule {
  kind: Kind; key: string; state: State; allowUserIds: string[]; includeStaff: boolean; denyUserIds: string[];
  denyState: State; message: string | null; expiresAt: string | null;
}
interface Person { id: string; firstName: string; lastName: string; username: string | null }
interface Editing { kind: Kind; key: string; label: string; rule: Rule | null; holders?: number; held?: string }

const LABEL: Record<State, string> = { AVAILABLE: 'Available', LOCKED: 'Locked', HIDDEN: 'Hidden' };
const TONE: Record<State, Tone> = { AVAILABLE: 'ok', LOCKED: 'warn', HIDDEN: 'bad' };

function audience(rule: Rule | null, expired?: boolean): string {
  if (!rule || expired) return 'Available to everyone';
  const parts: string[] = [];
  if (rule.state !== 'AVAILABLE') {
    const except = [rule.allowUserIds.length ? `${rule.allowUserIds.length} customer${rule.allowUserIds.length === 1 ? '' : 's'}` : null, rule.includeStaff ? 'staff' : null].filter(Boolean);
    parts.push(`${LABEL[rule.state]} for everyone${except.length ? ` except ${except.join(' and ')}` : ''}`);
  } else parts.push('Available to everyone else');
  if (rule.denyUserIds.length) parts.push(`${LABEL[rule.denyState].toLowerCase()} for ${rule.denyUserIds.length}`);
  if (rule.expiresAt) parts.push(`until ${dateTime(rule.expiresAt)}`);
  return parts.join(' · ');
}

const stateOf = (rule: Rule | null, expired?: boolean): State => (!rule || expired ? 'AVAILABLE' : rule.state);

function CustomerPicker({ value, onChange, people, onPeople, exclude }: {
  value: string[]; onChange: (ids: string[]) => void; people: Record<string, Person>; onPeople: (rows: Person[]) => void; exclude: string[];
}) {
  const p = useThemedPalette();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const search = async () => {
    if (q.trim().length < 2) return;
    try {
      const { data } = await api.get('/cockpit/customers', { params: { q: q.trim(), limit: 8 } });
      const rows: Person[] = (data.items ?? []).filter((x: Person) => !value.includes(x.id) && !exclude.includes(x.id));
      setHits(rows); onPeople(rows); setErr(rows.length ? null : 'No matching customers');
    } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.map((id) => (
          <Pressable key={id} onPress={() => onChange(value.filter((x) => x !== id))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: p.pillBg }}>
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>{people[id] ? personName(people[id]) : id.slice(0, 10)}</Text>
            <Ionicons name="close" size={12} color={p.fgMuted} />
          </Pressable>
        ))}
        {!value.length ? <Text style={{ color: p.fgFaint, fontSize: 12 }}>No customers</Text> : null}
      </View>
      <SearchBox value={q} onChange={setQ} onSubmit={search} placeholder="Name, @username or customer ID" />
      {err ? <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: -6, marginBottom: 8 }}>{err}</Text> : null}
      {hits.map((h) => (
        <Pressable key={h.id} onPress={() => { onChange([...value, h.id]); setHits(hits.filter((x) => x.id !== h.id)); }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: p.border }}>
          <Text style={{ color: p.fg, fontSize: 13 }}>{personName(h)}</Text>
          <Ionicons name="add-circle" size={18} color={p.accent} />
        </Pressable>
      ))}
    </View>
  );
}

const ENDS = [
  { key: 'keep', label: 'Keep' }, { key: 'none', label: 'No end' }, { key: '1h', label: '1 hour' },
  { key: '1d', label: '1 day' }, { key: '7d', label: '1 week' }, { key: '30d', label: '30 days' },
] as const;
const END_MS: Record<string, number> = { '1h': 3600_000, '1d': 86400_000, '7d': 7 * 86400_000, '30d': 30 * 86400_000 };

function Editor({ editing, people, onClose }: { editing: Editing; people: Record<string, Person>; onClose: () => void }) {
  const p = useThemedPalette();
  const refresh = useCockpitRefresh();
  const rule = editing.rule;
  const [state, setState] = useState<State>(rule?.state ?? 'AVAILABLE');
  const [allow, setAllow] = useState<string[]>(rule?.allowUserIds ?? []);
  const [deny, setDeny] = useState<string[]>(rule?.denyUserIds ?? []);
  const [denyState, setDenyState] = useState<State>(rule?.denyState ?? 'LOCKED');
  const [staff, setStaff] = useState(rule?.includeStaff ?? false);
  const [message, setMessage] = useState(rule?.message ?? '');
  const [end, setEnd] = useState<string>(rule?.expiresAt ? 'keep' : 'none');
  const [reason, setReason] = useState('');
  const [known, setKnown] = useState(people);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const addPeople = (rows: Person[]) => setKnown((k) => ({ ...k, ...Object.fromEntries(rows.map((x) => [x.id, x])) }));
  const restricting = state !== 'AVAILABLE' || deny.length > 0;

  const save = async (reset: boolean) => {
    setBusy(true); setErr(null);
    try {
      const expiresAt = end === 'keep' ? rule?.expiresAt ?? null : end === 'none' ? null : new Date(Date.now() + END_MS[end]).toISOString();
      await cockpitCall('/cockpit/availability', 'PUT', reset
        ? { kind: editing.kind, key: editing.key, state: 'AVAILABLE', reason: reason.trim() }
        : {
          kind: editing.kind, key: editing.key, state, allowUserIds: state === 'AVAILABLE' ? [] : allow,
          includeStaff: state === 'AVAILABLE' ? false : staff, denyUserIds: deny, denyState,
          message: message.trim() || null, expiresAt, reason: reason.trim(),
        });
      await refresh();
      onClose();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const label = (t: string) => <Text style={{ color: p.fg, fontSize: 12.5, fontWeight: '800', marginBottom: 6, marginTop: 4 }}>{t}</Text>;
  return (
    <BottomSheet visible onClose={() => { if (!busy) onClose(); }} title={editing.label}
      footer={
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
          {rule ? <View style={{ flex: 1 }}><Btn tone="ghost" label="Back to normal" disabled={busy || reason.trim().length < 5} onPress={() => save(true)} /></View> : null}
          <View style={{ flex: 1 }}><Btn label={busy ? 'Saving…' : 'Save'} disabled={busy || reason.trim().length < 5} onPress={() => save(false)} /></View>
        </View>
      }>
      {label('For everyone')}
      <Segments value={state} onChange={setState} options={(['AVAILABLE', 'LOCKED', 'HIDDEN'] as State[]).map((s) => ({ key: s, label: LABEL[s] }))} />
      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: -6, marginBottom: 12 }}>
        {state === 'AVAILABLE' ? 'Shown and usable.' : state === 'LOCKED' ? 'Shown with a lock. New activity is refused.' : 'Removed from the apps. New activity is refused.'}
      </Text>

      {state !== 'AVAILABLE' ? (
        <View style={{ marginBottom: 10 }}>
          {label('Always available for')}
          <CustomerPicker value={allow} onChange={setAllow} people={known} onPeople={addPeople} exclude={deny} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: p.fg, fontSize: 13 }}>All staff accounts</Text>
            <Switch value={staff} onValueChange={setStaff} />
          </View>
        </View>
      ) : null}

      {label('Always restricted for')}
      <Segments value={denyState} onChange={setDenyState} options={[{ key: 'LOCKED', label: 'They see it locked' }, { key: 'HIDDEN', label: 'They don\'t see it' }]} />
      <CustomerPicker value={deny} onChange={setDeny} people={known} onPeople={addPeople} exclude={allow} />

      {restricting ? (
        <>
          {label('Message customers see (optional)')}
          <TextInput value={message} onChangeText={setMessage} maxLength={140} placeholder="Coming soon" placeholderTextColor={p.fgFaint}
            style={{ color: p.fg, fontSize: 14, backgroundColor: p.bg, borderRadius: 10, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 }} />
          {label(rule?.expiresAt ? `Ends (now ${dateTime(rule.expiresAt)})` : 'Ends')}
          <Segments value={end} onChange={setEnd} options={ENDS.filter((e) => e.key !== 'keep' || rule?.expiresAt).map((e) => ({ key: e.key, label: e.label }))} />
        </>
      ) : null}

      {editing.kind === 'CURRENCY' && restricting && (editing.holders ?? 0) > 0 ? (
        <Note tone="warn">{`${editing.holders} customer${editing.holders === 1 ? '' : 's'} hold ${editing.key} (${editing.held} in total). Restricted customers still see their balance but can't convert, send or withdraw it until this changes. Cancellations and refunds still work.`}</Note>
      ) : null}

      {label('Reason (recorded in the audit trail)')}
      <TextInput value={reason} onChangeText={setReason} multiline placeholder="At least 5 characters" placeholderTextColor={p.fgFaint}
        style={{ color: p.fg, fontSize: 14, backgroundColor: p.bg, borderRadius: 10, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, paddingVertical: 10, minHeight: 64, textAlignVertical: 'top' }} />
      {err ? <Text style={{ color: p.redFg, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
    </BottomSheet>
  );
}

function Preview({ people }: { people: Record<string, Person> }) {
  const p = useThemedPalette();
  const [id, setId] = useState<string[]>([]);
  const [known, setKnown] = useState(people);
  const q = useCockpit<any>(id[0] ? `/cockpit/availability/preview/${id[0]}` : null);
  const list = (o?: Record<string, any>) => Object.entries(o ?? {}).filter(([, v]) => v.state !== 'AVAILABLE').map(([k, v]) => `${k} (${LABEL[v.state as State].toLowerCase()})`).join(', ') || 'none';
  return (
    <Section title="See as a customer" subtitle="What one customer's app shows right now">
      <View style={{ paddingVertical: 8 }}>
        <CustomerPicker value={id} onChange={(v) => setId(v.slice(-1))} people={known} exclude={[]}
          onPeople={(rows) => setKnown((k) => ({ ...k, ...Object.fromEntries(rows.map((x) => [x.id, x])) }))} />
        <ErrorNote error={q.error} />
        {q.data ? (
          <View style={{ gap: 4, marginTop: 4 }}>
            <Text style={{ color: p.fg, fontSize: 12.5 }}>Features: {list(q.data.availability.features)}</Text>
            <Text style={{ color: p.fg, fontSize: 12.5 }}>Currencies: {list(q.data.availability.currencies)}</Text>
            <Text style={{ color: p.fg, fontSize: 12.5 }}>Pairs: {list(q.data.availability.pairs)}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12 }}>App switches off: {Object.entries<boolean>(q.data.features).filter(([, on]) => !on).map(([k]) => k).join(', ') || 'none'}</Text>
          </View>
        ) : null}
      </View>
    </Section>
  );
}

export default function AdminAvailability() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const q = useCockpit<any>('/cockpit/availability');
  const [tab, setTab] = useState<'features' | 'currencies' | 'pairs' | 'history'>('features');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pairA, setPairA] = useState('BTC');
  const [pairB, setPairB] = useState('LYD');
  const people = useMemo<Record<string, Person>>(() => Object.fromEntries((q.data?.people ?? []).map((x: Person) => [x.id, x])), [q.data]);
  const editable = can('availability.manage');
  const open = (e: Editing) => { if (editable) setEditing(e); };
  const groups = useMemo(() => {
    const out: Record<string, any[]> = {};
    for (const f of q.data?.features ?? []) (out[f.group] ??= []).push(f);
    return out;
  }, [q.data]);
  const codes: string[] = (q.data?.currencies ?? []).map((c: any) => c.code);

  return (
    <AdminScreen title="Availability" subtitle="Hide or lock features, currencies and pairs"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      <Note>Rules only narrow access. Kill switches and the launch scope still apply on top, so a rule can't open anything they close.</Note>
      {!editable && q.data ? <Note tone="warn">You can view availability. Changing it needs the availability.manage permission.</Note> : null}
      <Segments value={tab} onChange={setTab} options={[
        { key: 'features', label: 'Features' }, { key: 'currencies', label: 'Currencies' }, { key: 'pairs', label: 'Pairs' }, { key: 'history', label: 'History' },
      ]} />

      {q.isLoading ? <Empty loading text="" /> : null}

      {tab === 'features' ? Object.entries(groups).map(([group, items]) => (
        <Section key={group} title={group}>
          {items.map((f: any, i: number) => (
            <Row key={f.key} last={i === items.length - 1} title={f.label} subtitle={audience(f.rule, f.expired)}
              meta={f.rule?.message && !f.expired ? `“${f.rule.message}”` : f.description}
              right={<Pill label={LABEL[stateOf(f.rule, f.expired)]} tone={TONE[stateOf(f.rule, f.expired)]} />}
              onPress={editable ? () => open({ kind: 'FEATURE', key: f.key, label: f.label, rule: f.expired ? null : f.rule }) : undefined} />
          ))}
        </Section>
      )) : null}

      {tab === 'currencies' ? (
        <Section>
          {(q.data?.currencies ?? []).map((c: any, i: number, all: any[]) => (
            <Row key={c.code} last={i === all.length - 1} title={`${c.code} · ${c.type === 'crypto' ? 'Crypto' : 'Fiat'}`}
              subtitle={audience(c.rule, c.expired)} meta={`${c.holders} holder${c.holders === 1 ? '' : 's'} · ${c.held}`}
              right={<Pill label={LABEL[stateOf(c.rule, c.expired)]} tone={TONE[stateOf(c.rule, c.expired)]} />}
              onPress={editable ? () => open({ kind: 'CURRENCY', key: c.code, label: `${c.code} currency`, rule: c.expired ? null : c.rule, holders: c.holders, held: c.held }) : undefined} />
          ))}
        </Section>
      ) : null}

      {tab === 'pairs' ? (
        <>
          <Section title="Restrict a pair" subtitle="Both directions: BTC/LYD also covers LYD to BTC">
            <View style={{ paddingVertical: 8 }}>
              <Text style={{ color: p.fgMuted, fontSize: 12, marginBottom: 6 }}>First currency</Text>
              <Segments value={pairA} onChange={setPairA} options={codes.map((c) => ({ key: c, label: c }))} />
              <Text style={{ color: p.fgMuted, fontSize: 12, marginBottom: 6 }}>Second currency</Text>
              <Segments value={pairB} onChange={setPairB} options={codes.map((c) => ({ key: c, label: c }))} />
              <Btn label={`Set up ${pairA}/${pairB}`} disabled={!editable || pairA === pairB} onPress={() => {
                const existing = (q.data?.pairs ?? []).find((x: any) => x.key === `${pairA}/${pairB}` || x.key === `${pairB}/${pairA}`);
                const key = existing?.key ?? `${pairA}/${pairB}`;
                open({ kind: 'PAIR', key, label: `${key} pair`, rule: existing && !existing.expired ? existing.rule : null });
              }} />
            </View>
          </Section>
          <Section title="Pair rules">
            {(q.data?.pairs ?? []).length ? (q.data.pairs as any[]).map((x, i, all) => (
              <Row key={x.key} last={i === all.length - 1} title={x.key} subtitle={audience(x.rule, x.expired)}
                right={<Pill label={LABEL[stateOf(x.rule, x.expired)]} tone={TONE[stateOf(x.rule, x.expired)]} />}
                onPress={editable ? () => open({ kind: 'PAIR', key: x.key, label: `${x.key} pair`, rule: x.expired ? null : x.rule }) : undefined} />
            )) : <Empty text="No pair rules. Every supported pair is available." />}
          </Section>
        </>
      ) : null}

      {tab === 'history' ? (
        <Section title="Change history" subtitle="Append-only, with actor and reason">
          {(q.data?.history ?? []).length ? (q.data.history as any[]).map((h, i, all) => (
            <Row key={h.id} last={i === all.length - 1} title={`${h.item} → ${h.action === 'AVAILABILITY_RESET' ? 'back to normal' : LABEL[(h.after?.state ?? 'AVAILABLE') as State]}`}
              subtitle={h.after?._reason ?? ''} meta={`${dateTime(h.at)} · ${personName(people[h.actorId])}`} />
          )) : <Empty text="No changes yet." />}
        </Section>
      ) : null}

      <Preview people={people} />
      {editing ? <Editor key={`${editing.kind}:${editing.key}`} editing={editing} people={people} onClose={() => setEditing(null)} /> : null}
    </AdminScreen>
  );
}
