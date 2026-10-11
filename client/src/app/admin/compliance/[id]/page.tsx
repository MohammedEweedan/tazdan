'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { Box, Button, HStack, Link, Select, Text, Textarea } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { dateTime, money } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, KV, Loading, PageHeader, Panel, ReasonModal, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const c = useCockpitColors();
  const { data, error, loading, reload } = useApi<any>(`/cockpit/compliance/cases/${id}`);
  const [to, setTo] = useState<string | null>(null);
  const [assignee, setAssignee] = useState('');
  const [resolution, setResolution] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('NOTE');
  const [busy, setBusy] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const ai = useApi<any>(can('ai.use') ? '/cockpit/ai/status' : null);
  const [aiDraft, setAiDraft] = useState<{ id: string; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  if (loading && !data) return <Loading lines={10} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;
  const k = data.case;
  const staffName = (sid: string | null) => {
    if (!sid) return '—';
    const p = data.staff.find((s: any) => s.id === sid);
    return p ? `${p.firstName} ${p.lastName}` : sid.slice(0, 8);
  };
  const manage = can('compliance.case.manage');

  return (
    <Box>
      <PageHeader title={`Case ${k.reference}`}
        subtitle={<HStack spacing={2} flexWrap="wrap"><StatusBadge value={k.status} /><StatusBadge value={k.priority} /><Text>{k.type.replace(/_/g, ' ')}</Text><Text>· {k.title}</Text></HStack>}
        actions={manage && data.allowedNext.length ? (
          <Select size="sm" w="200px" value="" onChange={(e) => { if (e.target.value) { setTo(e.target.value); setAssignee(k.assignedToId ?? ''); setResolution(''); } }}>
            <option value="">Move case to…</option>
            {data.allowedNext.map((s: string) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </Select>
        ) : null} />

      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Case">
          <KV items={[
            ['Opened', dateTime(k.createdAt)], ['SLA due', k.slaDueAt ? dateTime(k.slaDueAt) : '—'], ['Owner', staffName(k.assignedToId)],
            ['Opened by', k.openedById ? staffName(k.openedById) : 'system'], ['Subject', k.subjectType ? `${k.subjectType} ${k.subjectId?.slice(0, 8) ?? ''}` : '—'],
            ['Closed', k.closedAt ? dateTime(k.closedAt) : '—'],
          ]} />
          {k.summary ? <Text mt={3} fontSize="13px" whiteSpace="pre-wrap">{k.summary}</Text> : null}
          {k.resolution ? <Box mt={3}><Text fontSize="11px" color={c.muted}>Resolution</Text><Text fontSize="13px" whiteSpace="pre-wrap">{k.resolution}</Text></Box> : null}
        </Panel>
        <Panel title="Subject">
          {data.subject ? (
            <KV items={[
              ['Customer', <Link key="u" as={NextLink} href={`/admin/customers/${data.subject.id}`}>{data.subject.firstName} {data.subject.lastName}</Link>],
              ['Email', data.subject.email], ['Country', data.subject.country ?? '—'], ['KYC', `${data.subject.kycStatus} · ${data.subject.kycTier}`],
              ['Account', <StatusBadge key="s" value={data.subject.status} />], ['Customer since', dateTime(data.subject.createdAt)],
            ]} />
          ) : <Text fontSize="sm" color={c.muted}>No customer linked.</Text>}
          {data.related ? (
            <Box mt={4}>
              <Text fontSize="11px" color={c.muted} mb={1}>Related remittance</Text>
              <KV items={[
                ['Reference', <Link key="r" as={NextLink} href={`/admin/remittance/${data.related.id}`}>{data.related.reference}</Link>],
                ['State', <StatusBadge key="st" value={data.related.state} />], ['Corridor', data.related.corridor.code],
                ['Amount', money(data.related.totalDebit, data.related.sourceCurrency)], ['Beneficiary', `${data.related.beneficiary.fullName} (${data.related.beneficiary.country})`],
                ['Purpose', data.related.purpose],
              ]} />
            </Box>
          ) : null}
        </Panel>
      </Box>

      {data.decision ? (
        <Box mt={4}>
          <Panel title="Risk decision that opened this case" pad={false}>
            <DataTable rows={[data.decision]} columns={[
              { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
              { key: 'outcome', label: 'Outcome', render: (r: any) => <StatusBadge value={r.outcome} /> },
              { key: 'score', label: 'Score', align: 'right' },
              { key: 'triggeredRules', label: 'Rules', render: (r: any) => r.triggeredRules.join(', ') || '—' },
              { key: 'explanation', label: 'Explanation', render: (r: any) => <Text fontSize="12px" maxW="480px">{r.explanation}</Text> },
            ]} />
          </Panel>
        </Box>
      ) : null}

      {can('ai.use') && ai.data?.enabled && ai.data.level === 'ASSIST' && k.status !== 'CLOSED' ? (
        <Box mt={4}>
          <Panel title="AI case summary" subtitle="a draft from the case record; nothing is added until you accept it"
            actions={!aiDraft ? <Button size="sm" variant="outline" isLoading={aiBusy} onClick={async () => {
              setAiBusy(true); setAiErr(null);
              try { const r = await api<any>(`/cockpit/ai/cases/${id}/summary`, { method: 'POST' }); setAiDraft({ id: r.interactionId, text: r.text }); }
              catch (e: any) { setAiErr(e?.message ?? 'Could not draft'); } finally { setAiBusy(false); }
            }}>Draft summary</Button> : null}>
            {aiErr ? <Text color="red.400" fontSize="sm">{aiErr}</Text> : null}
            {aiDraft ? (
              <Box>
                <Textarea size="sm" rows={12} value={aiDraft.text} onChange={(e) => setAiDraft({ ...aiDraft, text: e.target.value })} />
                <HStack mt={2} justify="flex-end">
                  <Button size="sm" variant="ghost" onClick={async () => { await api(`/cockpit/ai/interactions/${aiDraft.id}/decision`, { method: 'POST', body: { accept: false, note: 'Discarded by officer' } }).catch(() => undefined); setAiDraft(null); }}>Discard</Button>
                  {manage ? <Button size="sm" colorScheme="brand" isLoading={aiBusy} onClick={async () => {
                    setAiBusy(true); setAiErr(null);
                    try { await api(`/cockpit/ai/interactions/${aiDraft.id}/decision`, { method: 'POST', body: { accept: true, finalText: aiDraft.text } }); setAiDraft(null); await reload(); }
                    catch (e: any) { setAiErr(e?.message ?? 'Could not save'); } finally { setAiBusy(false); }
                  }}>Add to case file</Button> : null}
                </HStack>
              </Box>
            ) : !aiErr ? <Text fontSize="sm" color={c.muted}>Drafts the facts, risk indicators, gaps and a suggested next step from this case record.</Text> : null}
          </Panel>
        </Box>
      ) : null}

      <Box mt={4}>
        <Panel title="Case file" subtitle="notes, evidence and every status change, oldest first">
          <Box display="grid" gap={3}>
            {k.notes.length ? k.notes.map((n: any) => (
              <Box key={n.id} borderLeft="2px solid" borderColor={n.kind === 'ESCALATION' ? c.serious : n.authorType === 'AI' ? c.accent : c.border} pl={3}>
                <HStack spacing={2} mb={0.5}>
                  <Text fontSize="11px" color={c.muted}>{dateTime(n.createdAt)}</Text>
                  <Text fontSize="11px" color={c.muted}>· {n.authorType === 'STAFF' ? staffName(n.authorId) : n.authorType}</Text>
                  <StatusBadge value={n.kind} />
                </HStack>
                <Text fontSize="13px" whiteSpace="pre-wrap">{n.body}</Text>
              </Box>
            )) : <Text fontSize="sm" color={c.muted}>No notes yet.</Text>}
          </Box>
          {manage && k.status !== 'CLOSED' ? (
            <Box mt={4} borderTop="1px solid" borderColor={c.border} pt={3}>
              <Textarea size="sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note or evidence summary…" />
              {noteErr ? <Text color="red.400" fontSize="sm" mt={1}>{noteErr}</Text> : null}
              <HStack mt={2} justify="flex-end">
                <Select size="sm" w="210px" value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="NOTE">Note</option><option value="EVIDENCE">Evidence</option><option value="REQUEST_INFORMATION">Information request</option>
                </Select>
                <Button size="sm" colorScheme="brand" isLoading={busy} isDisabled={note.trim().length < 2}
                  onClick={async () => {
                    setBusy(true); setNoteErr(null);
                    try { await api(`/cockpit/compliance/cases/${id}/notes`, { method: 'POST', body: { body: note, kind } }); setNote(''); await reload(); }
                    catch (e: any) { setNoteErr(e?.message ?? 'Could not save'); } finally { setBusy(false); }
                  }}>Add to case file</Button>
              </HStack>
            </Box>
          ) : null}
        </Panel>
      </Box>

      <ReasonModal isOpen={Boolean(to)} onClose={() => setTo(null)} danger={to === 'CLOSED'} title={`Move case to ${to?.replace(/_/g, ' ')}`} confirmLabel="Move"
        description={
          <Box display="grid" gap={2}>
            <Text fontSize="12px">Owner</Text>
            <Select size="sm" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {data.staff.map((s: any) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
            </Select>
            {to === 'CLOSED' ? (
              <>
                <Text fontSize="12px">Resolution (required to close — what was found and what was done)</Text>
                <Textarea size="sm" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} />
              </>
            ) : null}
          </Box>
        }
        onConfirm={async (reason) => {
          if (to === 'CLOSED' && resolution.trim().length < 5) throw new Error('Write a resolution before closing');
          await api(`/cockpit/compliance/cases/${id}/transition`, { method: 'POST', body: { to, note: reason, resolution: to === 'CLOSED' ? resolution : undefined, assignedToId: assignee || null } });
          await reload();
        }} />
    </Box>
  );
}
