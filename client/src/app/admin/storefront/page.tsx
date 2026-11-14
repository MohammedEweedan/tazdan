'use client';

/**
 * Merchant storefront: till plaque orders (confirm, produce, ship, deliver)
 * and merchant posts on public business profiles (take down / restore).
 * Every action needs a note and is audited.
 */
import { useState } from 'react';
import { Box, Button, HStack, Select, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { dateTime } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, PageHeader, Panel, ReasonModal, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

type PlaqueStatus = 'REQUESTED' | 'IN_PRODUCTION' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
interface Biz { id: string; companyName: string; tradingName: string | null; userId: string }
interface Plaque {
  id: string; quantity: number; size: string; locale: string; tillId: string | null; status: PlaqueStatus; statusNote: string | null;
  shippingName: string; shippingPhone: string; shippingAddress: string; shippingCity: string; notes: string | null; createdAt: string; business: Biz;
}
interface Post { id: string; kind: string; title: string; body: string; published: boolean; hiddenByStaff: boolean; startsAt: string | null; endsAt: string | null; createdAt: string; business: Biz }

const NEXT: Record<PlaqueStatus, PlaqueStatus[]> = {
  REQUESTED: ['IN_PRODUCTION', 'CANCELLED'], IN_PRODUCTION: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED'], DELIVERED: [], CANCELLED: [],
};
const LABEL: Record<PlaqueStatus, string> = { REQUESTED: 'Requested', IN_PRODUCTION: 'In production', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
const SIZE: Record<string, string> = { A6: 'Counter card (A6)', A5: 'Wall sign (A5)', STAND: 'Desk stand' };
const bizName = (b: Biz) => b.tradingName || b.companyName;

export default function StorefrontPage() {
  return (
    <Box>
      <PageHeader title="Merchant storefront" subtitle="Till plaque orders and posts on public business profiles" />
      <Tabs variant="soft-rounded" size="sm" isLazy>
        <TabList mb={4}><Tab>Plaque orders</Tab><Tab>Merchant posts</Tab></TabList>
        <TabPanels>
          <TabPanel p={0}><Plaques /></TabPanel>
          <TabPanel p={0}><Posts /></TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

function Plaques() {
  const c = useCockpitColors();
  const can = useCan();
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi<{ items: Plaque[] }>('/cockpit/plaque-orders', status ? { status } : undefined);
  const [move, setMove] = useState<{ order: Plaque; to: PlaqueStatus } | null>(null);
  const write = can('businesses.kyb.review');

  return (
    <Panel title="Plaque orders" subtitle="Call the business to confirm price and delivery before production."
      actions={(
        <Select size="sm" w="200px" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {(Object.keys(LABEL) as PlaqueStatus[]).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </Select>
      )} pad={false}>
      {error ? <Box p={4}><ErrorBox error={error} onRetry={reload} /></Box> : (
        <DataTable<Plaque> loading={loading} rows={data?.items} empty="No plaque orders"
          columns={[
            { key: 'createdAt', label: 'Ordered', render: (o) => dateTime(o.createdAt), width: '140px' },
            { key: 'business', label: 'Business', render: (o) => <Text fontWeight={600}>{bizName(o.business)}</Text> },
            { key: 'what', label: 'Order', render: (o) => `${o.quantity} × ${SIZE[o.size] ?? o.size} · ${o.locale.toUpperCase()}${o.tillId ? ' · till code' : ''}` },
            { key: 'ship', label: 'Deliver to', render: (o) => (
              <Box fontSize="12px">
                <Text>{o.shippingName} · {o.shippingPhone}</Text>
                <Text color={c.muted}>{o.shippingAddress}, {o.shippingCity}</Text>
                {o.notes ? <Text color={c.muted}>“{o.notes}”</Text> : null}
              </Box>
            ) },
            { key: 'status', label: 'Status', render: (o) => (
              <Box><StatusBadge value={o.status} />{o.statusNote ? <Text fontSize="11px" color={c.muted} mt={1}>{o.statusNote}</Text> : null}</Box>
            ) },
            { key: 'act', label: '', align: 'right', render: (o) => write ? (
              <HStack justify="flex-end" spacing={2}>
                {NEXT[o.status].map((to) => (
                  <Button key={to} size="xs" variant={to === 'CANCELLED' ? 'ghost' : 'outline'} colorScheme={to === 'CANCELLED' ? 'red' : undefined}
                    onClick={() => setMove({ order: o, to })}>{to === 'CANCELLED' ? 'Cancel' : LABEL[to]}</Button>
                ))}
              </HStack>
            ) : null },
          ]} />
      )}
      <ReasonModal isOpen={!!move} onClose={() => setMove(null)} minLength={3} danger={move?.to === 'CANCELLED'}
        title={move ? `${LABEL[move.to]}: ${bizName(move.order.business)}` : ''}
        description="The business sees this note with the status, e.g. the price agreed or the courier tracking number."
        confirmLabel={move ? LABEL[move.to] : undefined}
        onConfirm={async (note) => {
          if (!move) return;
          await api(`/cockpit/plaque-orders/${move.order.id}/status`, { method: 'POST', body: { status: move.to, note } });
          setMove(null);
          reload();
        }} />
    </Panel>
  );
}

function Posts() {
  const c = useCockpitColors();
  const can = useCan();
  const [filter, setFilter] = useState('');
  const { data, error, loading, reload } = useApi<{ items: Post[] }>('/cockpit/business-posts', filter ? { hidden: filter } : undefined);
  const [target, setTarget] = useState<Post | null>(null);
  const write = can('businesses.kyb.review');
  const now = Date.now();

  const state = (p: Post) => p.hiddenByStaff ? 'Taken down' : !p.published ? 'Draft'
    : p.endsAt && new Date(p.endsAt).getTime() < now ? 'Ended' : p.startsAt && new Date(p.startsAt).getTime() > now ? 'Scheduled' : 'Live';

  return (
    <Panel title="Merchant posts" subtitle="Offers, deals and news shown to customers. Take down anything misleading or against policy."
      actions={(
        <Select size="sm" w="180px" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All posts</option>
          <option value="0">Visible</option>
          <option value="1">Taken down</option>
        </Select>
      )} pad={false}>
      {error ? <Box p={4}><ErrorBox error={error} onRetry={reload} /></Box> : (
        <DataTable<Post> loading={loading} rows={data?.items} empty="No posts"
          columns={[
            { key: 'createdAt', label: 'Posted', render: (p) => dateTime(p.createdAt), width: '140px' },
            { key: 'business', label: 'Business', render: (p) => <Text fontWeight={600}>{bizName(p.business)}</Text> },
            { key: 'post', label: 'Post', render: (p) => (
              <Box maxW="460px">
                <Text fontSize="11px" fontWeight={700} color={c.muted}>{p.kind}</Text>
                <Text fontWeight={600}>{p.title}</Text>
                <Text fontSize="12px" color={c.muted} noOfLines={3}>{p.body}</Text>
              </Box>
            ) },
            { key: 'state', label: 'State', render: (p) => <StatusBadge value={state(p)} /> },
            { key: 'act', label: '', align: 'right', render: (p) => write ? (
              <Button size="xs" variant="outline" colorScheme={p.hiddenByStaff ? undefined : 'red'} onClick={() => setTarget(p)}>
                {p.hiddenByStaff ? 'Restore' : 'Take down'}
              </Button>
            ) : null },
          ]} />
      )}
      <ReasonModal isOpen={!!target} onClose={() => setTarget(null)} danger={!target?.hiddenByStaff}
        title={target ? `${target.hiddenByStaff ? 'Restore' : 'Take down'}: ${target.title}` : ''}
        description={target?.hiddenByStaff ? 'The post shows on the business profile again.' : 'The post disappears from the public profile. The business sees “Hidden by tazdan”.'}
        confirmLabel={target?.hiddenByStaff ? 'Restore' : 'Take down'}
        onConfirm={async (reason) => {
          if (!target) return;
          await api(`/cockpit/business-posts/${target.id}/visibility`, { method: 'POST', body: { hidden: !target.hiddenByStaff, reason } });
          setTarget(null);
          reload();
        }} />
    </Panel>
  );
}
