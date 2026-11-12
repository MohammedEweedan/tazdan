/**
 * Kill switches — stop NEW activity in one scope. Cancellations, refunds and
 * releases always stay available, so customer money is never stranded.
 */
import { useState } from 'react';
import { RefreshControl, Switch, View } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, Note, Pill, Row, Section, ago, cockpitCall, dateTime, shortId,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const FEATURE_LABELS: Record<string, string> = {
  withdrawals: 'Withdrawals (fiat and crypto)',
  deposits: 'Deposits',
  transfers: 'Transfers, chat payments, claim links, referral payouts',
  fx: 'FX conversions and crypto orders',
  remittance: 'International remittance',
  p2p: 'P2P marketplace',
  cards: 'Card issuing and funding',
  blockchain: 'On-chain withdrawals',
  business_payouts: 'Business bulk payouts',
  lydt: 'LYDT issue and transfer',
};

export default function AdminControls() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const q = useCockpit<any>('/cockpit/controls');
  const [pending, setPending] = useState<{ scope: string; key: string; blocked: boolean; label: string } | null>(null);
  const [scoped, setScoped] = useState(false);
  const operate = can('controls.operate');

  return (
    <AdminScreen title="Kill switches" subtitle="Stop new activity in one scope"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      <Note>A switch stops NEW activity. Cancellations, refunds and releases always stay available, so customer money is never stranded.</Note>

      <Section title="Platform features">
        {q.isLoading ? <Empty loading text="" /> : (q.data?.features ?? []).map((f: any, i: number, all: any[]) => (
          <Row key={f.feature} last={i === all.length - 1} title={FEATURE_LABELS[f.feature] ?? f.feature}
            subtitle={f.blocked ? `Paused ${ago(f.updatedAt)} — ${f.reason}${f.expiresAt ? ` · until ${dateTime(f.expiresAt)}` : ''}` : 'Running'}
            right={<Switch value={!f.blocked} disabled={!operate}
              onValueChange={() => setPending({ scope: 'FEATURE', key: f.feature, blocked: !f.blocked, label: FEATURE_LABELS[f.feature] ?? f.feature })} />} />
        ))}
      </Section>

      <Section title="Scoped switches" subtitle="One corridor, provider, customer or wallet"
        right={operate ? <Btn small label="Add" icon="add" onPress={() => setScoped(true)} /> : null}>
        {(q.data?.switches ?? []).filter((s: any) => s.scope !== 'FEATURE').length ? (q.data.switches as any[]).filter((s) => s.scope !== 'FEATURE').map((s, i, all) => (
          <Row key={s.id} last={i === all.length - 1} title={`${s.scope} · ${s.key}`} subtitle={s.reason}
            right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pill label={s.blocked ? 'BLOCKED' : 'ACTIVE'} />
              {operate ? <Btn small tone="ghost" label={s.blocked ? 'Unblock' : 'Block'} onPress={() => setPending({ scope: s.scope, key: s.key, blocked: !s.blocked, label: `${s.scope} ${s.key}` })} /> : null}
            </View>} />
        )) : <Empty text="No scoped switches." />}
      </Section>

      <Section title="Change history" subtitle="Append-only — actor, reason, previous and new state">
        {(q.data?.events ?? []).length ? (q.data.events as any[]).slice(0, 50).map((e, i, all) => (
          <Row key={e.id} last={i === all.length - 1} title={`${e.scope} ${e.key}: ${e.previousBlocked === null ? 'new' : e.previousBlocked ? 'blocked' : 'active'} → ${e.newBlocked ? 'blocked' : 'active'}`}
            subtitle={e.reason} meta={`${dateTime(e.createdAt)} · ${shortId(e.actorId)}`} />
        )) : <Empty text="No changes yet." />}
      </Section>

      <ActionSheet visible={Boolean(pending)} onClose={() => setPending(null)} danger={pending?.blocked}
        title={pending?.blocked ? `Pause: ${pending?.label}` : `Resume: ${pending?.label}`} confirmLabel={pending?.blocked ? 'Pause' : 'Resume'}
        onSubmit={async (_v, reason) => {
          await cockpitCall('/cockpit/controls', 'POST', { scope: pending!.scope, key: pending!.key, blocked: pending!.blocked, reason });
          await refresh();
        }} />

      <ActionSheet visible={scoped} onClose={() => setScoped(false)} danger title="Block a scope" confirmLabel="Block"
        fields={[
          { key: 'scope', label: 'Scope', type: 'select', options: [
            { value: 'CORRIDOR', label: 'Corridor' }, { value: 'PROVIDER', label: 'Provider' },
            { value: 'USER', label: 'Customer' }, { value: 'WALLET', label: 'Wallet' },
          ] },
          { key: 'key', label: 'Key', type: 'text', placeholder: 'LY-GB · provider code · customer ID · customerId:LYD' },
        ]}
        onSubmit={async (v, reason) => {
          await cockpitCall('/cockpit/controls', 'POST', { scope: v.scope, key: String(v.key).trim(), blocked: true, reason });
          await refresh();
        }} />
    </AdminScreen>
  );
}
