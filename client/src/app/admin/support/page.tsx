'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { Box, Button, HStack, Link, Select, Text, Textarea } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, dateTime, money } from '@/lib/cockpit/format';
import { useCan, useStaff } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, KV, Loading, Notice, PageHeader, Panel, ReasonModal, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

export default function SupportPage() {
  const t = useT();
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi<any>('/cockpit/support', { status }, { refreshMs: 30_000 });
  const [selected, setSelected] = useState<any>(null);

  return (
    <Box>
      <PageHeader title={t('Support')} subtitle="Escalations from customers, with everything about the customer an agent needs in one place." />
      <ErrorBox error={error} onRetry={reload} />
      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: selected ? '1fr 1.25fr' : '1fr' }} gap={4} alignItems="start">
        <Panel title="Escalations" pad={false} actions={
          <Select size="xs" w="150px" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Open & assigned</option><option value="OPEN">Open</option><option value="ASSIGNED">Assigned</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option>
          </Select>
        }>
          <DataTable loading={loading} rows={data?.tickets} empty="No escalations waiting." onRowClick={(r: any) => setSelected(r)} columns={[
            { key: 'createdAt', label: 'Waiting', render: (r: any) => ago(r.createdAt) },
            { key: 'raisedBy', label: 'Customer', render: (r: any) => `${r.raisedBy.firstName} ${r.raisedBy.lastName}` },
            { key: 'reason', label: 'Reason', render: (r: any) => <Text fontSize="13px" maxW="280px" fontWeight={selected?.id === r.id ? 700 : 400}>{r.reason}</Text> },
            { key: 'tradeId', label: 'Context', render: (r: any) => r.tradeId ? 'P2P trade' : 'General' },
            { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
            { key: 'assignedAgent', label: 'Agent', render: (r: any) => r.assignedAgent ? r.assignedAgent.firstName : '—' },
          ]} />
        </Panel>
        {selected ? <CustomerContext ticket={selected} onClose={() => setSelected(null)} onChanged={async () => { await reload(); }} /> : null}
      </Box>
    </Box>
  );
}

function CustomerContext({ ticket, onClose, onChanged }: { ticket: any; onClose: () => void; onChanged: () => Promise<void> }) {
  const c = useCockpitColors();
  const can = useCan();
  const staff = useStaff();
  const { data, error, loading, reload } = useApi<any>(`/cockpit/support/customers/${ticket.raisedById}`);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const ai = useApi<any>(can('ai.use') ? '/cockpit/ai/status' : null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const open = ticket.status === 'OPEN' || ticket.status === 'ASSIGNED';

  return (
    <Panel title={`${ticket.raisedBy.firstName} ${ticket.raisedBy.lastName}`} subtitle={ticket.reason}
      actions={<HStack>
        {can('support.reply') && open && ticket.assignedAgentId !== staff?.user.id ? <Button size="xs" variant="outline" onClick={async () => { await api(`/admin/escalations/${ticket.id}/assign`, { method: 'PUT' }); await onChanged(); }}>Assign to me</Button> : null}
        {can('support.reply') && open ? <Button size="xs" colorScheme="brand" onClick={() => setResolving(true)}>Resolve</Button> : null}
        <Text as="button" fontSize="12px" onClick={onClose}>Close</Text>
      </HStack>}>
      {ticket.details ? <Box mb={3}><Notice>{ticket.details}</Notice></Box> : null}
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading lines={6} /> : data ? (
        <Box display="grid" gap={4}>
          <KV items={[
            ['Profile', <Link key="p" as={NextLink} href={`/admin/customers/${data.user.id}`}>Customer 360 →</Link>],
            ['Account', <StatusBadge key="s" value={data.user.status} />], ['KYC', `${data.user.kycStatus} · ${data.user.kycTier}`],
            ['Country', data.user.country ?? '—'], ['Customer since', dateTime(data.user.createdAt)], ['Previous escalations', String(data.tickets.length)],
          ]} />
          {data.problems.failedRemittances.length || data.problems.kyc.some((k: any) => k.status === 'REJECTED') ? (
            <Box>
              <Text fontSize="12px" fontWeight={600} mb={1}>Likely causes</Text>
              <Box display="grid" gap={1}>
                {data.problems.failedRemittances.map((r: any) => (
                  <Text key={r.id} fontSize="12px"><Link as={NextLink} href={`/admin/remittance/${r.id}`}>{r.reference}</Link> · <StatusBadge value={r.state} /> · {money(r.totalDebit, r.sourceCurrency)}{r.failureReason ? ` — ${r.failureReason}` : ''}</Text>
                ))}
                {data.problems.kyc.filter((k: any) => k.status === 'REJECTED').map((k: any, i: number) => (
                  <Text key={i} fontSize="12px">KYC {k.documentType} rejected{k.rejectionReason ? `: ${k.rejectionReason}` : ''}</Text>
                ))}
              </Box>
            </Box>
          ) : null}
          <Box display="grid" gridTemplateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
            <MiniList title="Remittances" rows={data.recent.remittances.map((r: any) => ({ id: r.id, href: `/admin/remittance/${r.id}`, left: r.reference, status: r.state, right: money(r.sendAmount, r.sourceCurrency) }))} />
            <MiniList title="Withdrawals" rows={data.recent.withdrawals.map((r: any) => ({ id: r.id, href: `/admin/transactions/withdrawal/${r.id}`, left: r.reference, status: r.status, right: money(r.amount, r.currency) }))} />
            <MiniList title="Deposits" rows={data.recent.deposits.map((r: any) => ({ id: r.id, href: `/admin/transactions/deposit/${r.id}`, left: r.reference, status: r.status, right: money(r.amount, r.currency) }))} />
            <MiniList title="Refunds" rows={data.problems.refunds.map((r: any) => ({ id: r.id, left: r.reason ?? 'refund', status: r.status, right: money(r.amount, r.currency) }))} />
          </Box>
          <Box>
            <Text fontSize="12px" fontWeight={600} mb={1}>Support conversation</Text>
            <Box maxH="300px" overflowY="auto" border="1px solid" borderColor={c.border} borderRadius="8px" p={2} display="grid" gap={1.5}>
              {data.messages.length ? data.messages.map((m: any) => {
                const fromCustomer = m.senderId === data.user.id;
                return (
                  <Box key={m.id} justifySelf={fromCustomer ? 'start' : 'end'} maxW="85%" bg={fromCustomer ? c.surface2 : c.accentSoft} borderRadius="8px" px={2.5} py={1.5}>
                    <Text fontSize="13px" whiteSpace="pre-wrap">{m.content}</Text>
                    <Text fontSize="10px" color={c.faint}>{dateTime(m.createdAt)}{m.type === 'SYSTEM' ? ' · system' : ''}</Text>
                  </Box>
                );
              }) : <Text fontSize="12px" color={c.muted} p={2}>No messages with support yet.</Text>}
            </Box>
            {can('support.reply') ? (
              <Box mt={2}>
                <Textarea size="sm" rows={draftId ? 6 : 3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as Tazdan Support…" />
                {draftId ? <Text fontSize="11px" color={c.faint} mt={1}>AI draft — check every fact before sending. It never mentions compliance or fraud checks.</Text> : null}
                {err ? <Text color="red.400" fontSize="sm">{err}</Text> : null}
                <HStack justify="flex-end" mt={1}>
                  {can('ai.use') && ai.data?.enabled && ai.data.level === 'ASSIST' ? (
                    <Button size="sm" variant="ghost" isLoading={drafting} onClick={async () => {
                      setDrafting(true); setErr(null);
                      try {
                        if (draftId) await api(`/cockpit/ai/interactions/${draftId}/decision`, { method: 'POST', body: { accept: false, note: 'Replaced by a new draft' } }).catch(() => undefined);
                        const r = await api<any>(`/cockpit/ai/support/${ticket.id}/draft`, { method: 'POST' });
                        setReply(r.text); setDraftId(r.interactionId);
                      } catch (e: any) { setErr(e?.message ?? 'Could not draft'); } finally { setDrafting(false); }
                    }}>{draftId ? 'Redraft with AI' : 'Draft with AI'}</Button>
                  ) : null}
                  <Button size="sm" colorScheme="brand" isLoading={busy} isDisabled={!reply.trim()}
                    onClick={async () => {
                      setBusy(true); setErr(null);
                      try {
                        await api('/admin/support/reply', { method: 'POST', body: { userId: data.user.id, content: reply.trim(), escalationId: ticket.id, tradeId: ticket.tradeId ?? undefined } });
                        // Record what happened to the AI draft: sent as drafted or edited.
                        if (draftId) { await api(`/cockpit/ai/interactions/${draftId}/decision`, { method: 'POST', body: { accept: true, finalText: reply.trim() } }).catch(() => undefined); setDraftId(null); }
                        setReply(''); await reload();
                      } catch (e: any) { setErr(e?.message ?? 'Could not send'); } finally { setBusy(false); }
                    }}>Send</Button>
                </HStack>
              </Box>
            ) : null}
          </Box>
        </Box>
      ) : null}
      <ReasonModal isOpen={resolving} onClose={() => setResolving(false)} title="Resolve escalation" confirmLabel="Resolve"
        description={<Text fontSize="12px">The resolution note is sent to the customer{ticket.tradeId ? ' and the other trade participant' : ''} as a system message.</Text>}
        onConfirm={async (note) => { await api(`/admin/escalations/${ticket.id}/resolve`, { method: 'PUT', body: { resolutionNote: note } }); await onChanged(); onClose(); }} />
    </Panel>
  );
}

function MiniList({ title, rows }: { title: string; rows: Array<{ id: string; href?: string; left: string; status: string; right: string }> }) {
  const c = useCockpitColors();
  return (
    <Box border="1px solid" borderColor={c.border} borderRadius="8px" p={2}>
      <Text fontSize="11px" color={c.muted} mb={1}>{title}</Text>
      {rows.length ? rows.slice(0, 5).map((r) => (
        <HStack key={r.id} justify="space-between" py={0.5} spacing={2}>
          <Text fontSize="12px" noOfLines={1}>{r.href ? <Link as={NextLink} href={r.href}>{r.left}</Link> : r.left}</Text>
          <HStack spacing={2}><StatusBadge value={r.status} /><Text fontSize="12px" whiteSpace="nowrap">{r.right}</Text></HStack>
        </HStack>
      )) : <Text fontSize="12px" color={c.faint}>None</Text>}
    </Box>
  );
}
