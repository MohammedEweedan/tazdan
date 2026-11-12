'use client';

import { useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, Flex, HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter,
  ModalHeader, ModalOverlay, Select, Tab, TabList, TabPanel, TabPanels, Tabs, Tag, TagCloseButton, TagLabel,
  Text, Textarea, Wrap,
} from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Notice, PageHeader, Panel, useCockpitColors } from '@/components/cockpit/ui';

type State = 'AVAILABLE' | 'LOCKED' | 'HIDDEN';
type Kind = 'FEATURE' | 'CURRENCY' | 'PAIR';
interface Rule {
  kind: Kind; key: string; state: State; allowUserIds: string[]; includeStaff: boolean; denyUserIds: string[];
  denyState: State; message: string | null; reason: string; setById: string; expiresAt: string | null; updatedAt: string;
}
interface Person { id: string; firstName: string; lastName: string; username: string | null; email?: string; role?: string }
interface Editing { kind: Kind; key: string; label: string; rule: Rule | null; holders?: number; held?: string }

const STATE_LABEL: Record<State, string> = { AVAILABLE: 'Available', LOCKED: 'Locked', HIDDEN: 'Hidden' };
const STATE_HELP: Record<State, string> = {
  AVAILABLE: 'Shown and usable.',
  LOCKED: 'Shown with a lock. New activity is refused.',
  HIDDEN: 'Removed from the apps. New activity is refused.',
};

/** ISO time → the value a datetime-local input expects, in the viewer's time zone. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const personName = (p?: Person) => (p ? `${p.firstName} ${p.lastName}${p.username ? ` · @${p.username}` : ''}` : '');

/** One line that says who gets what. */
function audience(rule: Rule | null, expired = false): string {
  if (!rule || expired) return 'Available to everyone';
  const parts: string[] = [];
  if (rule.state !== 'AVAILABLE') {
    const except = [rule.allowUserIds.length ? `${rule.allowUserIds.length} customer${rule.allowUserIds.length === 1 ? '' : 's'}` : null, rule.includeStaff ? 'staff' : null].filter(Boolean);
    parts.push(`${STATE_LABEL[rule.state]} for everyone${except.length ? ` except ${except.join(' and ')}` : ''}`);
  } else {
    parts.push('Available to everyone else');
  }
  if (rule.denyUserIds.length) parts.push(`${STATE_LABEL[rule.denyState].toLowerCase()} for ${rule.denyUserIds.length} customer${rule.denyUserIds.length === 1 ? '' : 's'}`);
  if (rule.expiresAt) parts.push(`until ${dateTime(rule.expiresAt)}`);
  return parts.join(' · ');
}

function StateBadge({ rule, expired }: { rule: Rule | null; expired?: boolean }) {
  const c = useCockpitColors();
  const state: State = !rule || expired ? 'AVAILABLE' : rule.state;
  const partial = Boolean(rule && !expired && (rule.denyUserIds.length || rule.allowUserIds.length || rule.includeStaff));
  const color = state === 'AVAILABLE' ? c.good : state === 'LOCKED' ? c.serious : c.critical;
  return (
    <HStack spacing={1}>
      <Box px={2} py="2px" borderRadius="md" fontSize="11px" fontWeight={700} color={color} border="1px solid" borderColor={color}>
        {STATE_LABEL[state]}
      </Box>
      {partial ? <Text fontSize="11px" color={c.muted}>+ exceptions</Text> : null}
    </HStack>
  );
}

function CustomerPicker({ value, onChange, people, onPeople, exclude }: {
  value: string[]; onChange: (ids: string[]) => void; people: Record<string, Person>;
  onPeople: (p: Person[]) => void; exclude: string[];
}) {
  const c = useCockpitColors();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await api<any>('/cockpit/customers', { query: { q: q.trim(), limit: 8 } });
      const rows: Person[] = (r.items ?? []).filter((p: Person) => !value.includes(p.id) && !exclude.includes(p.id));
      setHits(rows);
      onPeople(rows);
    } finally { setBusy(false); }
  };
  return (
    <Box>
      <Wrap mb={2}>
        {value.map((id) => (
          <Tag key={id} size="md" borderRadius="full" variant="subtle" colorScheme="brand">
            <TagLabel>{personName(people[id]) || id.slice(0, 10)}</TagLabel>
            <TagCloseButton onClick={() => onChange(value.filter((x) => x !== id))} />
          </Tag>
        ))}
        {!value.length ? <Text fontSize="12px" color={c.muted}>No customers</Text> : null}
      </Wrap>
      <HStack>
        <Input size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, @username, email or customer ID"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} />
        <Button size="sm" variant="outline" onClick={search} isLoading={busy}>Search</Button>
      </HStack>
      {hits.length ? (
        <Box mt={2} border="1px solid" borderColor={c.border} borderRadius="md">
          {hits.map((p) => (
            <Flex key={p.id} px={3} py={2} justify="space-between" align="center" borderBottom="1px solid" borderColor={c.border} _last={{ borderBottom: 0 }}>
              <Text fontSize="13px">{personName(p)}</Text>
              <Button size="xs" onClick={() => { onChange([...value, p.id]); setHits(hits.filter((h) => h.id !== p.id)); }}>Add</Button>
            </Flex>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function RuleEditor({ editing, people, onClose, onSaved }: {
  editing: Editing | null; people: Record<string, Person>; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const c = useCockpitColors();
  const t = useT();
  const rule = editing?.rule ?? null;
  const [state, setState] = useState<State>(rule?.state ?? 'AVAILABLE');
  const [allow, setAllow] = useState<string[]>(rule?.allowUserIds ?? []);
  const [deny, setDeny] = useState<string[]>(rule?.denyUserIds ?? []);
  const [denyState, setDenyState] = useState<State>(rule?.denyState ?? 'LOCKED');
  const [includeStaff, setIncludeStaff] = useState(rule?.includeStaff ?? false);
  const [message, setMessage] = useState(rule?.message ?? '');
  const [until, setUntil] = useState(rule?.expiresAt ? toLocalInput(rule.expiresAt) : '');
  const [reason, setReason] = useState('');
  const [known, setKnown] = useState<Record<string, Person>>(people);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const addPeople = (rows: Person[]) => setKnown((k) => ({ ...k, ...Object.fromEntries(rows.map((p) => [p.id, p])) }));

  const save = async (reset = false) => {
    if (!editing) return;
    setBusy(true); setErr(null);
    try {
      await api('/cockpit/availability', {
        method: 'PUT',
        body: reset
          ? { kind: editing.kind, key: editing.key, state: 'AVAILABLE', reason: reason.trim() }
          : {
            kind: editing.kind, key: editing.key, state, allowUserIds: state === 'AVAILABLE' ? [] : allow,
            includeStaff: state === 'AVAILABLE' ? false : includeStaff, denyUserIds: deny, denyState,
            message: message.trim() || null, expiresAt: until ? new Date(until).toISOString() : null, reason: reason.trim(),
          },
      });
      await onSaved();
      onClose();
    } catch (e: any) { setErr(e?.message ?? 'Save failed'); } finally { setBusy(false); }
  };

  const restricting = state !== 'AVAILABLE' || deny.length > 0;
  return (
    <Modal isOpen={Boolean(editing)} onClose={() => { if (!busy) onClose(); }} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">{editing?.label}</ModalHeader>
        <ModalCloseButton isDisabled={busy} />
        <ModalBody>
          <Text fontSize="xs" fontWeight={700} mb={2}>For everyone</Text>
          <HStack spacing={2} mb={1}>
            {(['AVAILABLE', 'LOCKED', 'HIDDEN'] as State[]).map((s) => (
              <Button key={s} size="sm" flex={1} variant={state === s ? 'solid' : 'outline'} colorScheme={state === s ? (s === 'AVAILABLE' ? 'green' : s === 'LOCKED' ? 'orange' : 'red') : undefined}
                onClick={() => setState(s)}>{STATE_LABEL[s]}</Button>
            ))}
          </HStack>
          <Text fontSize="12px" color={c.muted} mb={4}>{STATE_HELP[state]}</Text>

          {state !== 'AVAILABLE' ? (
            <Box mb={4}>
              <Text fontSize="xs" fontWeight={700} mb={1}>Always available for</Text>
              <Text fontSize="12px" color={c.muted} mb={2}>Pilot customers and testers. They get the item as normal.</Text>
              <CustomerPicker value={allow} onChange={setAllow} people={known} onPeople={addPeople} exclude={deny} />
              <Checkbox mt={2} isChecked={includeStaff} onChange={(e) => setIncludeStaff(e.target.checked)}>
                <Text fontSize="13px">All staff accounts</Text>
              </Checkbox>
            </Box>
          ) : null}

          <Box mb={4}>
            <Text fontSize="xs" fontWeight={700} mb={1}>Always restricted for</Text>
            <HStack mb={2}>
              <Text fontSize="12px" color={c.muted}>These customers get</Text>
              <Select size="xs" w="110px" value={denyState} onChange={(e) => setDenyState(e.target.value as State)}>
                <option value="LOCKED">Locked</option>
                <option value="HIDDEN">Hidden</option>
              </Select>
              <Text fontSize="12px" color={c.muted}>whatever everyone else gets.</Text>
            </HStack>
            <CustomerPicker value={deny} onChange={setDeny} people={known} onPeople={addPeople} exclude={allow} />
          </Box>

          {restricting ? (
            <Box display="grid" gridTemplateColumns={{ base: '1fr', md: '1fr 200px' }} gap={3} mb={4}>
              <Box>
                <Text fontSize="xs" fontWeight={700} mb={1}>Message customers see <Text as="span" fontWeight={400} color={c.muted}>(optional)</Text></Text>
                <Input size="sm" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Coming soon" />
              </Box>
              <Box>
                <Text fontSize="xs" fontWeight={700} mb={1}>Ends <Text as="span" fontWeight={400} color={c.muted}>(optional)</Text></Text>
                <Input size="sm" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
              </Box>
            </Box>
          ) : null}

          {editing?.kind === 'CURRENCY' && restricting && (editing.holders ?? 0) > 0 ? (
            <Box mb={4}>
              <Notice tone="warning">
                {editing.holders} customer{editing.holders === 1 ? '' : 's'} hold {editing.key} ({editing.held} in total). Restricted customers still see their balance but can&apos;t convert, send or withdraw it until this changes. Cancellations and refunds still work.
              </Notice>
            </Box>
          ) : null}

          <Text fontSize="xs" fontWeight={700} mb={1}>{t('Reason')} <Text as="span" fontWeight={400} color={c.muted}>(recorded in the audit trail)</Text></Text>
          <Textarea size="sm" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="At least 5 characters" />
          {err ? <Text color="red.400" fontSize="sm" mt={2}>{err}</Text> : null}
        </ModalBody>
        <ModalFooter gap={2}>
          {rule ? <Button variant="ghost" mr="auto" isDisabled={reason.trim().length < 5 || busy} onClick={() => save(true)}>Back to normal</Button> : null}
          <Button variant="ghost" onClick={onClose} isDisabled={busy}>{t('Cancel')}</Button>
          <Button colorScheme="brand" isLoading={busy} isDisabled={reason.trim().length < 5} onClick={() => save(false)}>Save</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function Preview({ people }: { people: Record<string, Person> }) {
  const c = useCockpitColors();
  const [id, setId] = useState<string[]>([]);
  const [known, setKnown] = useState(people);
  const { data, error, loading } = useApi<any>(id[0] ? `/cockpit/availability/preview/${id[0]}` : null);
  const closed = data ? Object.entries<any>(data.availability.features).filter(([, v]) => v.state !== 'AVAILABLE') : [];
  return (
    <Panel title="See as a customer" subtitle="What one customer's app shows right now, with every rule applied">
      <CustomerPicker value={id} onChange={(v) => setId(v.slice(-1))} people={known} exclude={[]}
        onPeople={(rows) => setKnown((k) => ({ ...k, ...Object.fromEntries(rows.map((p) => [p.id, p])) }))} />
      <ErrorBox error={error} />
      {loading ? <Text fontSize="13px" color={c.muted} mt={3}>Loading…</Text> : null}
      {data ? (
        <Box mt={3} fontSize="13px">
          <Text fontWeight={600} mb={1}>Features restricted: {closed.length ? closed.map(([k, v]) => `${k} (${STATE_LABEL[v.state as State].toLowerCase()})`).join(', ') : 'none'}</Text>
          <Text mb={1}>Currencies restricted: {Object.keys(data.availability.currencies).length ? Object.entries<any>(data.availability.currencies).map(([k, v]) => `${k} (${STATE_LABEL[v.state as State].toLowerCase()})`).join(', ') : 'none'}</Text>
          <Text mb={1}>Pairs restricted: {Object.keys(data.availability.pairs).length ? Object.entries<any>(data.availability.pairs).map(([k, v]) => `${k} (${STATE_LABEL[v.state as State].toLowerCase()})`).join(', ') : 'none'}</Text>
          <Text color={c.muted}>App switches off: {Object.entries<boolean>(data.features).filter(([, on]) => !on).map(([k]) => k).join(', ') || 'none'}</Text>
        </Box>
      ) : null}
    </Panel>
  );
}

export default function AvailabilityPage() {
  const t = useT();
  const can = useCan();
  const c = useCockpitColors();
  const { data, error, loading, reload } = useApi<any>('/cockpit/availability');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pairA, setPairA] = useState('BTC');
  const [pairB, setPairB] = useState('LYD');
  const people = useMemo<Record<string, Person>>(() => Object.fromEntries((data?.people ?? []).map((p: Person) => [p.id, p])), [data]);
  const editable = can('availability.manage');
  const codes: string[] = (data?.currencies ?? []).map((x: any) => x.code);

  const editButton = (e: Editing) => (
    <Button size="xs" variant="outline" isDisabled={!editable} onClick={() => setEditing(e)}>Edit</Button>
  );
  const groups = useMemo(() => {
    const out: Record<string, any[]> = {};
    for (const f of data?.features ?? []) (out[f.group] ??= []).push(f);
    return out;
  }, [data]);

  return (
    <Box>
      <PageHeader title={t('Availability')} subtitle="Hide or lock a feature, currency or pair — for everyone or for chosen customers. Kill switches and the launch scope still apply on top, so a rule can never open anything they close." />
      <ErrorBox error={error} onRetry={reload} />
      {!editable && data ? <Box mb={4}><Notice>You can view availability. Changing it needs the availability.manage permission.</Notice></Box> : null}
      <Tabs colorScheme="brand" size="sm" isLazy>
        <TabList mb={4}>
          <Tab>Features</Tab>
          <Tab>Currencies</Tab>
          <Tab>Pairs</Tab>
          <Tab>History</Tab>
        </TabList>
        <TabPanels>
          <TabPanel p={0}>
            <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
              {Object.entries(groups).map(([group, items]) => (
                <Panel key={group} title={group}>
                  {items.map((f: any) => (
                    <Flex key={f.key} justify="space-between" align="center" gap={3} py={2} borderBottom="1px solid" borderColor={c.border}>
                      <Box minW={0}>
                        <Text fontSize="13px" fontWeight={600}>{f.label}</Text>
                        <Text fontSize="11px" color={c.muted}>{f.description}</Text>
                        <Text fontSize="11px" color={c.muted}>{audience(f.rule, f.expired)}{f.rule?.message && !f.expired ? ` · “${f.rule.message}”` : ''}</Text>
                      </Box>
                      <HStack flexShrink={0}>
                        <StateBadge rule={f.rule} expired={f.expired} />
                        {editButton({ kind: 'FEATURE', key: f.key, label: f.label, rule: f.expired ? null : f.rule })}
                      </HStack>
                    </Flex>
                  ))}
                </Panel>
              ))}
            </Box>
          </TabPanel>

          <TabPanel p={0}>
            <Panel pad={false}>
              <DataTable loading={loading} rows={data?.currencies} empty="No currencies." columns={[
                { key: 'code', label: 'Currency', render: (r: any) => <Text fontWeight={700}>{r.code}</Text> },
                { key: 'type', label: 'Type', render: (r: any) => (r.type === 'crypto' ? 'Crypto' : 'Fiat') },
                { key: 'holders', label: 'Holders', render: (r: any) => `${r.holders} · ${r.held}` },
                { key: 'state', label: 'State', render: (r: any) => <StateBadge rule={r.rule} expired={r.expired} /> },
                { key: 'audience', label: 'Who', render: (r: any) => <Text fontSize="12px" noOfLines={2} maxW="320px">{audience(r.rule, r.expired)}</Text> },
                { key: 'edit', label: '', render: (r: any) => editButton({ kind: 'CURRENCY', key: r.code, label: `${r.code} currency`, rule: r.expired ? null : r.rule, holders: r.holders, held: r.held }) },
              ]} />
            </Panel>
          </TabPanel>

          <TabPanel p={0}>
            <Panel title="Restrict a pair" subtitle="Applies in both directions — BTC/LYD also covers LYD to BTC — on conversions, crypto orders, P2P, recurring buys and card top-ups.">
              <HStack mb={4} flexWrap="wrap">
                <Select size="sm" w="120px" value={pairA} onChange={(e) => setPairA(e.target.value)}>{codes.map((x) => <option key={x}>{x}</option>)}</Select>
                <Text>/</Text>
                <Select size="sm" w="120px" value={pairB} onChange={(e) => setPairB(e.target.value)}>{codes.map((x) => <option key={x}>{x}</option>)}</Select>
                <Button size="sm" colorScheme="brand" isDisabled={!editable || pairA === pairB}
                  onClick={() => {
                    const existing = (data?.pairs ?? []).find((p: any) => p.key === `${pairA}/${pairB}` || p.key === `${pairB}/${pairA}`);
                    setEditing({ kind: 'PAIR', key: existing?.key ?? `${pairA}/${pairB}`, label: `${existing?.key ?? `${pairA}/${pairB}`} pair`, rule: existing && !existing.expired ? existing.rule : null });
                  }}>Set up</Button>
              </HStack>
              <DataTable rows={data?.pairs} empty="No pair rules. Every pair the platform supports is available." columns={[
                { key: 'key', label: 'Pair', render: (r: any) => <Text fontWeight={700}>{r.key}</Text> },
                { key: 'state', label: 'State', render: (r: any) => <StateBadge rule={r.rule} expired={r.expired} /> },
                { key: 'audience', label: 'Who', render: (r: any) => <Text fontSize="12px">{audience(r.rule, r.expired)}</Text> },
                { key: 'edit', label: '', render: (r: any) => editButton({ kind: 'PAIR', key: r.key, label: `${r.key} pair`, rule: r.expired ? null : r.rule }) },
              ]} />
            </Panel>
          </TabPanel>

          <TabPanel p={0}>
            <Panel title="Change history" subtitle="append-only — actor, reason, before and after" pad={false}>
              <DataTable loading={loading} rows={data?.history} empty="No changes yet." columns={[
                { key: 'at', label: 'When', render: (r: any) => dateTime(r.at) },
                { key: 'item', label: 'Item' },
                { key: 'action', label: 'Change', render: (r: any) => (r.action === 'AVAILABILITY_RESET' ? 'Back to normal' : STATE_LABEL[(r.after?.state ?? 'AVAILABLE') as State]) },
                { key: 'actorId', label: 'By', render: (r: any) => personName(people[r.actorId]) || String(r.actorId ?? '').slice(0, 8) },
                { key: 'reason', label: 'Reason', render: (r: any) => <Text noOfLines={2} maxW="360px">{r.after?._reason ?? ''}</Text> },
              ]} />
            </Panel>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <Box mt={4}><Preview people={people} /></Box>
      {editing ? <RuleEditor key={`${editing.kind}:${editing.key}`} editing={editing} people={people} onClose={() => setEditing(null)} onSaved={reload} /> : null}
    </Box>
  );
}
