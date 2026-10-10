'use client';

/** Shared investigation views: lifecycle timeline and double-entry journal. */
import { Box, HStack, Text } from '@chakra-ui/react';
import { dateTime, money, shortId } from '@/lib/cockpit/format';
import { DataTable, Mono, StatusBadge, useCockpitColors } from './ui';

export function Timeline({ items }: { items: Array<{ id: string; fromState: string | null; toState: string; createdAt: string; actorType: string; actorId: string | null; reason: string | null; provider?: string | null }> }) {
  const c = useCockpitColors();
  if (!items?.length) return <Text fontSize="sm" color={c.muted}>No lifecycle transitions recorded for this object (objects created before Oct 2026 have no lifecycle log).</Text>;
  return (
    <Box position="relative" ps={5}>
      <Box position="absolute" insetInlineStart="7px" top={1} bottom={1} w="2px" bg={c.border} />
      {items.map((t) => (
        <Box key={t.id} position="relative" mb={3}>
          <Box position="absolute" insetInlineStart="-17px" top="5px" w="10px" h="10px" borderRadius="full" bg={c.accent} border="2px solid" borderColor={c.surface} />
          <HStack spacing={2} flexWrap="wrap">
            {t.fromState ? <><StatusBadge value={t.fromState} /><Text fontSize="xs" color={c.faint}>→</Text></> : null}
            <StatusBadge value={t.toState} />
            <Text fontSize="xs" color={c.muted}>{dateTime(t.createdAt)} · {t.actorType}{t.actorId ? ` ${shortId(t.actorId)}` : ''}{t.provider ? ` · ${t.provider}` : ''}</Text>
          </HStack>
          {t.reason ? <Text fontSize="12px" color={c.text} mt={1}>{t.reason}</Text> : null}
        </Box>
      ))}
    </Box>
  );
}

export function LedgerGroups({ groups }: { groups: any[] }) {
  const c = useCockpitColors();
  if (!groups?.length) return <Text fontSize="sm" color={c.muted}>No ledger journal posted for this object.</Text>;
  return (
    <Box display="grid" gap={3}>
      {groups.map((g) => {
        const sums: Record<string, number> = {};
        for (const e of g.entries) sums[e.currency] = (sums[e.currency] ?? 0) + Number(e.amount);
        const balanced = Object.values(sums).every((v) => Math.abs(v) < 1e-9);
        return (
          <Box key={g.groupId} border="1px solid" borderColor={c.border} borderRadius="8px" overflow="hidden">
            <HStack justify="space-between" px={3} py={2} bg={c.surface2}>
              <HStack spacing={2}><Mono>{g.refType}</Mono><Text fontSize="11px" color={c.muted}>{g.groupId} · {dateTime(g.createdAt)}</Text></HStack>
              <StatusBadge value={balanced ? 'BALANCED' : 'UNBALANCED'} />
            </HStack>
            <DataTable rows={g.entries} columns={[
              { key: 'account', label: 'Account', render: (e: any) => `${e.account.type}${e.account.userId ? ` · ${shortId(e.account.userId)}` : ''}` },
              { key: 'fundClass', label: 'Fund class' },
              { key: 'debit', label: 'Debit', align: 'right', render: (e: any) => Number(e.amount) < 0 ? money(Math.abs(Number(e.amount)), e.currency) : '' },
              { key: 'credit', label: 'Credit', align: 'right', render: (e: any) => Number(e.amount) > 0 ? money(e.amount, e.currency) : '' },
              { key: 'memo', label: 'Memo', render: (e: any) => e.memo ?? '—' },
            ]} />
          </Box>
        );
      })}
    </Box>
  );
}

