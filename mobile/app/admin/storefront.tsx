/**
 * Merchant storefront — till plaque orders (confirm, produce, ship, deliver)
 * and merchant posts on public business profiles (take down / restore).
 * Same endpoints and rules as the web cockpit; every action is audited.
 */
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { AdminScreen, AdminTabs } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, Pill, Section, Segments, cockpitCall, dateTime, useCockpit, useCockpitRefresh, useStaff, type Tone,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

type PlaqueStatus = 'REQUESTED' | 'IN_PRODUCTION' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
interface Biz { id: string; companyName: string; tradingName: string | null }
interface Plaque {
  id: string; quantity: number; size: string; locale: string; tillId: string | null; status: PlaqueStatus; statusNote: string | null;
  shippingName: string; shippingPhone: string; shippingAddress: string; shippingCity: string; notes: string | null; createdAt: string; business: Biz;
}
interface Post { id: string; kind: string; title: string; body: string; published: boolean; hiddenByStaff: boolean; startsAt: string | null; endsAt: string | null; createdAt: string; business: Biz }

const NEXT: Record<PlaqueStatus, PlaqueStatus[]> = {
  REQUESTED: ['IN_PRODUCTION', 'CANCELLED'], IN_PRODUCTION: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED'], DELIVERED: [], CANCELLED: [],
};
const LABEL: Record<PlaqueStatus, string> = { REQUESTED: 'Requested', IN_PRODUCTION: 'In production', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
const TONE: Record<PlaqueStatus, Tone> = { REQUESTED: 'warn', IN_PRODUCTION: 'info', SHIPPED: 'info', DELIVERED: 'ok', CANCELLED: 'muted' };
const SIZE: Record<string, string> = { A6: 'Counter card (A6)', A5: 'Wall sign (A5)', STAND: 'Desk stand' };
const bizName = (b: Biz) => b.tradingName || b.companyName;

export default function AdminStorefront() {
  const [tab, setTab] = useState<'plaques' | 'posts'>('plaques');
  return (
    <AdminScreen title="Merchant storefront" subtitle="Plaque orders and business posts" scroll={false}>
      <AdminTabs tabs={[{ key: 'plaques', label: 'Plaque orders' }, { key: 'posts', label: 'Posts' }]} value={tab} onChange={setTab} />
      {tab === 'plaques' ? <Plaques /> : <Posts />}
    </AdminScreen>
  );
}

function Plaques() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const [status, setStatus] = useState<'' | PlaqueStatus>('REQUESTED');
  const q = useCockpit<{ items: Plaque[] }>('/cockpit/plaque-orders', { status });
  const [move, setMove] = useState<{ order: Plaque; to: PlaqueStatus } | null>(null);
  const write = can('businesses.kyb.review');
  const items = q.data?.items ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Segments value={status} onChange={setStatus}
          options={[{ key: 'REQUESTED', label: 'New' }, { key: 'IN_PRODUCTION', label: 'Making' }, { key: 'SHIPPED', label: 'Shipped' }, { key: '', label: 'All' }]} />
      </View>
      <View style={{ flex: 1 }}>
        <ScrollList refreshing={q.isFetching} onRefresh={() => q.refetch()}>
          {q.error ? <ErrorNote error={q.error} onRetry={() => q.refetch()} /> : null}
          {!items.length ? <Empty text="No plaque orders" loading={q.isLoading} /> : null}
          {items.map((o) => (
            <Section key={o.id} title={bizName(o.business)} subtitle={dateTime(o.createdAt)} right={<Pill label={LABEL[o.status]} tone={TONE[o.status]} />}>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{o.quantity} × {SIZE[o.size] ?? o.size} · {o.locale.toUpperCase()}{o.tillId ? ' · till code' : ''}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 6 }}>{o.shippingName} · {o.shippingPhone}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 13 }}>{o.shippingAddress}, {o.shippingCity}</Text>
              {o.notes ? <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4 }}>“{o.notes}”</Text> : null}
              {o.statusNote ? <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 6 }}>{o.statusNote}</Text> : null}
              {write && NEXT[o.status].length ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {NEXT[o.status].map((to) => (
                    <View key={to} style={{ flex: 1 }}>
                      <Btn small label={to === 'CANCELLED' ? 'Cancel' : LABEL[to]} tone={to === 'CANCELLED' ? 'danger' : 'primary'} onPress={() => setMove({ order: o, to })} />
                    </View>
                  ))}
                </View>
              ) : null}
            </Section>
          ))}
        </ScrollList>
      </View>
      <ActionSheet visible={!!move} onClose={() => setMove(null)} danger={move?.to === 'CANCELLED'}
        title={move ? `${LABEL[move.to]}: ${bizName(move.order.business)}` : ''}
        description="The business sees this note with the status, e.g. the price agreed or the courier tracking number."
        reasonLabel="Note for the business" confirmLabel={move ? LABEL[move.to] : 'Confirm'}
        onSubmit={async (_v, note) => {
          if (!move) return;
          await cockpitCall(`/cockpit/plaque-orders/${move.order.id}/status`, 'POST', { status: move.to, note });
          refresh();
        }} />
    </View>
  );
}

function Posts() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const [filter, setFilter] = useState<'' | '0' | '1'>('0');
  const q = useCockpit<{ items: Post[] }>('/cockpit/business-posts', { hidden: filter });
  const [target, setTarget] = useState<Post | null>(null);
  const write = can('businesses.kyb.review');
  const now = Date.now();
  const items = q.data?.items ?? [];
  const state = (x: Post): [string, Tone] => x.hiddenByStaff ? ['Taken down', 'bad'] : !x.published ? ['Draft', 'muted']
    : x.endsAt && new Date(x.endsAt).getTime() < now ? ['Ended', 'muted'] : x.startsAt && new Date(x.startsAt).getTime() > now ? ['Scheduled', 'info'] : ['Live', 'ok'];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Segments value={filter} onChange={setFilter} options={[{ key: '0', label: 'Visible' }, { key: '1', label: 'Taken down' }, { key: '', label: 'All' }]} />
      </View>
      <View style={{ flex: 1 }}>
        <ScrollList refreshing={q.isFetching} onRefresh={() => q.refetch()}>
          {q.error ? <ErrorNote error={q.error} onRetry={() => q.refetch()} /> : null}
          {!items.length ? <Empty text="No posts" loading={q.isLoading} /> : null}
          {items.map((x) => {
            const [label, tone] = state(x);
            return (
              <Section key={x.id} title={bizName(x.business)} subtitle={`${x.kind} · ${dateTime(x.createdAt)}`} right={<Pill label={label} tone={tone} />}>
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{x.title}</Text>
                <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>{x.body}</Text>
                {write ? (
                  <View style={{ marginTop: 12 }}>
                    <Btn small label={x.hiddenByStaff ? 'Restore' : 'Take down'} tone={x.hiddenByStaff ? 'primary' : 'danger'} onPress={() => setTarget(x)} />
                  </View>
                ) : null}
              </Section>
            );
          })}
        </ScrollList>
      </View>
      <ActionSheet visible={!!target} onClose={() => setTarget(null)} danger={!target?.hiddenByStaff}
        title={target ? `${target.hiddenByStaff ? 'Restore' : 'Take down'}: ${target.title}` : ''}
        description={target?.hiddenByStaff ? 'The post shows on the business profile again.' : 'The post disappears from the public profile. The business sees “Hidden by tazdan”.'}
        confirmLabel={target?.hiddenByStaff ? 'Restore' : 'Take down'}
        onSubmit={async (_v, reason) => {
          if (!target) return;
          await cockpitCall(`/cockpit/business-posts/${target.id}/visibility`, 'POST', { hidden: !target.hiddenByStaff, reason });
          refresh();
        }} />
    </View>
  );
}

function ScrollList({ children, refreshing, onRefresh }: { children: React.ReactNode; refreshing: boolean; onRefresh: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {children}
    </ScrollView>
  );
}
