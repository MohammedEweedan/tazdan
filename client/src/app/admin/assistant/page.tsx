'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, HStack, Select, Text, Textarea, Wrap, WrapItem } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, JsonView, Notice, PageHeader, Pagination, Panel, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

interface Turn { role: 'user' | 'assistant'; content: string; toolCalls?: Array<{ name: string; isError: boolean }>; model?: string; error?: boolean }

const SUGGESTIONS = [
  'Give me today’s operating picture — anything that needs attention?',
  'Which remittances are waiting in compliance review, and why?',
  'Are any treasury pools below their minimum?',
  'Summarise the open reconciliation exceptions.',
];

/** Light formatting for assistant text: paragraphs, bullet lines and **bold**. */
function Formatted({ text }: { text: string }) {
  return (
    <Box fontSize="14px" lineHeight="1.6">
      {text.split(/\n{2,}/).map((para, i) => (
        <Box key={i} mb={2}>
          {para.split('\n').map((line, j) => {
            const bullet = /^\s*([-*•]|\d+\.)\s+/.test(line);
            const parts = line.replace(/^\s*[-*•]\s+/, '').split(/(\*\*[^*]+\*\*)/g);
            return (
              <Text key={j} pl={bullet ? 4 : 0} position="relative">
                {bullet && /^\s*[-*•]/.test(line) ? <Box as="span" position="absolute" left={1}>•</Box> : null}
                {parts.map((p, k) => (p.startsWith('**') && p.endsWith('**') ? <b key={k}>{p.slice(2, -2)}</b> : <span key={k}>{p}</span>))}
              </Text>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

export default function AssistantPage() {
  const t = useT();
  const c = useCockpitColors();
  const status = useApi<any>('/cockpit/ai/status');
  const [tab, setTab] = useState<'chat' | 'log'>('chat');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, busy]);

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    const history = turns.filter((x) => !x.error).map(({ role, content }) => ({ role, content }));
    setTurns((p) => [...p, { role: 'user', content: text }]);
    setQ(''); setBusy(true);
    try {
      const r = await api<any>('/cockpit/ai/ask', { method: 'POST', body: { question: text, history } });
      setTurns((p) => [...p, { role: 'assistant', content: r.answer || '(no answer)', toolCalls: r.toolCalls, model: r.model }]);
    } catch (e: any) {
      setTurns((p) => [...p, { role: 'assistant', content: e?.message ?? 'The assistant could not answer.', error: true }]);
    } finally { setBusy(false); }
  };

  const s = status.data;
  return (
    <Box>
      <PageHeader title={t('Assistant')} subtitle="Ask about live platform data. The assistant reads only what your role can see, cannot change anything, and every question is logged."
        actions={<HStack>{(['chat', 'log'] as const).map((x) => <Button key={x} size="sm" variant={tab === x ? 'solid' : 'ghost'} colorScheme={tab === x ? 'brand' : undefined} onClick={() => setTab(x)}>{x === 'chat' ? 'Ask' : 'AI activity log'}</Button>)}</HStack>} />
      <ErrorBox error={status.error} onRetry={status.reload} />
      {s && !s.enabled ? (
        <Box mb={4}><Notice tone="warning">{!s.configured ? 'The assistant is not configured on this server: set ANTHROPIC_API_KEY (and, in production, AI_LEVEL after a data-processing agreement is in place).' : 'The assistant is switched off (AI_LEVEL=OFF).'}</Notice></Box>
      ) : null}
      {tab === 'chat' ? (
        <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 300px' }} gap={4} alignItems="start">
          <Panel title="Conversation" subtitle={s ? `${s.model} · level ${s.level}` : undefined}>
            <Box minH="320px" maxH="60vh" overflowY="auto" display="grid" gap={3} pr={1}>
              {!turns.length ? (
                <Box>
                  <Text fontSize="sm" color={c.muted} mb={2}>Try one of these:</Text>
                  <Wrap>{SUGGESTIONS.map((x) => <WrapItem key={x}><Button size="sm" variant="outline" whiteSpace="normal" textAlign="left" h="auto" py={2} onClick={() => send(x)} isDisabled={!s?.enabled}>{x}</Button></WrapItem>)}</Wrap>
                </Box>
              ) : null}
              {turns.map((turn, i) => (
                <Box key={i} justifySelf={turn.role === 'user' ? 'end' : 'stretch'} maxW={turn.role === 'user' ? '80%' : '100%'}
                  bg={turn.role === 'user' ? c.accentSoft : c.surface2} border="1px solid" borderColor={turn.error ? c.critical : c.border} borderRadius="10px" px={3} py={2}>
                  {turn.role === 'user' ? <Text fontSize="14px" whiteSpace="pre-wrap">{turn.content}</Text> : <Formatted text={turn.content} />}
                  {turn.toolCalls?.length ? (
                    <Text mt={1} fontSize="11px" color={c.faint}>Looked up: {turn.toolCalls.map((tc) => `${tc.name.replace(/_/g, ' ')}${tc.isError ? ' (not available)' : ''}`).join(', ')}{turn.model ? ` · ${turn.model}` : ''}</Text>
                  ) : null}
                </Box>
              ))}
              {busy ? <Text fontSize="sm" color={c.muted}>Looking that up…</Text> : null}
              <div ref={end} />
            </Box>
            <Box mt={3} borderTop="1px solid" borderColor={c.border} pt={3}>
              <Textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} placeholder="Ask about customers, transfers, treasury, compliance, reconciliation…" isDisabled={!s?.enabled}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(q); } }} />
              <HStack justify="space-between" mt={2}>
                <Text fontSize="11px" color={c.faint}>Answers come only from tool results; check the linked records before acting.</Text>
                <HStack>
                  {turns.length ? <Button size="sm" variant="ghost" onClick={() => setTurns([])}>New conversation</Button> : null}
                  <Button size="sm" colorScheme="brand" onClick={() => send(q)} isLoading={busy} isDisabled={!s?.enabled || q.trim().length < 3}>Ask</Button>
                </HStack>
              </HStack>
            </Box>
          </Panel>
          <Panel title="What it can read" subtitle="based on your role">
            {s?.tools?.length ? (
              <Box display="grid" gap={2}>{s.tools.map((tool: any) => (
                <Box key={tool.name}><Text fontSize="12px" fontWeight={600}>{tool.name.replace(/_/g, ' ')}</Text><Text fontSize="11px" color={c.muted} noOfLines={3}>{tool.description}</Text></Box>
              ))}</Box>
            ) : <Text fontSize="sm" color={c.muted}>No data tools are available to your role.</Text>}
          </Panel>
        </Box>
      ) : <AiLog />}
    </Box>
  );
}

function AiLog() {
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi<any>('/cockpit/ai/interactions', { kind, page, limit: 25 });
  const name = (id: string | null) => {
    if (!id) return '—';
    const p = data?.people?.find((x: any) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : id.slice(0, 8);
  };
  return (
    <Box display="grid" gap={4}>
      <ErrorBox error={error} onRetry={reload} />
      <Panel title="AI activity" subtitle="every question, the data it read, and what happened to each draft" pad={false}
        actions={<Select size="xs" w="170px" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}><option value="">All kinds</option><option value="ASSISTANT_QUERY">Questions</option><option value="CASE_SUMMARY">Case summaries</option><option value="SUPPORT_REPLY">Support drafts</option></Select>}>
        <DataTable loading={loading} rows={data?.items} empty="No AI activity yet." onRowClick={(r: any) => setOpen(open === r.id ? null : r.id)} columns={[
          { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
          { key: 'kind', label: 'Kind', render: (r: any) => r.kind.replace(/_/g, ' ').toLowerCase() },
          { key: 'operatorId', label: 'Operator', render: (r: any) => name(r.operatorId) },
          { key: 'input', label: 'Request', render: (r: any) => <Text fontSize="12px" maxW="360px" noOfLines={2}>{r.input?.question ?? r.input?.instruction ?? '—'}</Text> },
          { key: 'refs', label: 'Data read', render: (r: any) => <Text fontSize="12px">{(r.references?.toolCalls ?? []).map((c: any) => c.name).join(', ') || (r.references?.caseId ? 'case file' : r.references?.escalationId ? 'support context' : '—')}</Text> },
          { key: 'approvalStatus', label: 'Draft', render: (r: any) => r.approvalStatus === 'NOT_REQUIRED' ? '—' : <StatusBadge value={r.approvalStatus} /> },
          { key: 'outcome', label: 'Outcome', render: (r: any) => r.outcome ?? '—' },
          { key: 'approvedById', label: 'Decided by', render: (r: any) => name(r.approvedById) },
        ]} />
        {data ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
      </Panel>
      {open ? <Panel title="Record" actions={<Text as="button" fontSize="12px" onClick={() => setOpen(null)}>Close</Text>}><JsonView value={data?.items?.find((i: any) => i.id === open)} /></Panel> : null}
    </Box>
  );
}
