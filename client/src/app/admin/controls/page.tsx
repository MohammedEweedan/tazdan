'use client';

import { useState } from 'react';
import { Box, Button, Flex, HStack, Input, Select, Switch, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, dateTime } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, PageHeader, Panel, ReasonModal, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

const FEATURE_LABELS: Record<string, string> = {
  withdrawals: 'Withdrawals (fiat and crypto requests)',
  deposits: 'Deposits',
  transfers: 'Internal transfers, chat payments, claim links, referral payouts',
  fx: 'FX conversions (wallet swap)',
  remittance: 'International remittance',
  p2p: 'P2P marketplace (new listings and trades)',
  cards: 'Card issuing and funding',
  blockchain: 'On-chain withdrawals',
  business_payouts: 'Business bulk payouts',
};

export default function ControlsPage() {
  const t = useT();
  const can = useCan();
  const c = useCockpitColors();
  const { data, error, loading, reload } = useApi<any>('/cockpit/controls');
  const [pending, setPending] = useState<{ scope: string; key: string; blocked: boolean; label: string } | null>(null);
  const [scope, setScope] = useState('CORRIDOR');
  const [key, setKey] = useState('');

  return (
    <Box>
      <PageHeader title={t('Controls')} subtitle="Emergency kill switches. A switch stops NEW activity in its scope; cancellations, refunds and releases always stay available so customer money is never stranded." />
      <ErrorBox error={error} onRetry={reload} />
      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Platform features">
          <Box display="grid" gap={1}>
            {(data?.features ?? []).map((f: any) => (
              <Flex key={f.feature} justify="space-between" align="center" py={2} borderBottom="1px solid" borderColor={c.border}>
                <Box>
                  <Text fontSize="13px" fontWeight={600}>{FEATURE_LABELS[f.feature] ?? f.feature}</Text>
                  <Text fontSize="11px" color={c.muted}>{f.blocked ? `Paused ${ago(f.updatedAt)} — ${f.reason}${f.expiresAt ? ` · until ${dateTime(f.expiresAt)}` : ''}` : 'Running'}</Text>
                </Box>
                <HStack>
                  <StatusBadge value={f.blocked ? 'BLOCKED' : 'ACTIVE'} />
                  <Switch isChecked={!f.blocked} isDisabled={!can('controls.operate')} colorScheme="brand"
                    onChange={() => setPending({ scope: 'FEATURE', key: f.feature, blocked: !f.blocked, label: FEATURE_LABELS[f.feature] ?? f.feature })} />
                </HStack>
              </Flex>
            ))}
          </Box>
        </Panel>
        <Panel title="Scoped switch" subtitle="Pause one corridor, provider, customer or wallet">
          <Box display="grid" gap={3}>
            <HStack>
              <Select size="sm" w="250px" flexShrink={0} value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="CORRIDOR">Corridor (e.g. LY-GB)</option>
                <option value="PROVIDER">Provider code</option>
                <option value="USER">Customer ID</option>
                <option value="WALLET">Wallet (customerId:CURRENCY)</option>
              </Select>
              <Input size="sm" value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="Key" />
            </HStack>
            <HStack>
              <Button size="sm" colorScheme="red" variant="outline" isDisabled={!key || !can('controls.operate')} onClick={() => setPending({ scope, key, blocked: true, label: `${scope} ${key}` })}>Block</Button>
              <Button size="sm" variant="outline" isDisabled={!key || !can('controls.operate')} onClick={() => setPending({ scope, key, blocked: false, label: `${scope} ${key}` })}>Unblock</Button>
            </HStack>
            <DataTable rows={(data?.switches ?? []).filter((s: any) => s.scope !== 'FEATURE')} empty="No scoped switches." columns={[
              { key: 'scope', label: 'Scope' }, { key: 'key', label: 'Key' },
              { key: 'blocked', label: 'State', render: (r: any) => <StatusBadge value={r.blocked ? 'BLOCKED' : 'ACTIVE'} /> },
              { key: 'reason', label: 'Reason', render: (r: any) => <Text noOfLines={1} maxW="200px">{r.reason}</Text> },
            ]} />
          </Box>
        </Panel>
      </Box>
      <Box mt={4}>
        <Panel title="Change history" subtitle="append-only — actor, reason, previous and new state" pad={false}>
          <DataTable loading={loading} rows={data?.events} empty="No changes yet." columns={[
            { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
            { key: 'scope', label: 'Scope' }, { key: 'key', label: 'Key' },
            { key: 'change', label: 'Change', render: (r: any) => `${r.previousBlocked === null ? 'new' : r.previousBlocked ? 'blocked' : 'active'} → ${r.newBlocked ? 'blocked' : 'active'}` },
            { key: 'actorId', label: 'Actor', render: (r: any) => r.actorId.slice(0, 8) },
            { key: 'reason', label: 'Reason' },
          ]} />
        </Panel>
      </Box>
      <ReasonModal isOpen={Boolean(pending)} onClose={() => setPending(null)} danger={pending?.blocked}
        title={pending?.blocked ? `Pause: ${pending?.label}` : `Resume: ${pending?.label}`} confirmLabel={pending?.blocked ? 'Pause' : 'Resume'}
        onConfirm={async (reason) => {
          if (!pending) return;
          await api('/cockpit/controls', { method: 'POST', body: { scope: pending.scope, key: pending.key, blocked: pending.blocked, reason } });
          await reload();
        }} />
    </Box>
  );
}
