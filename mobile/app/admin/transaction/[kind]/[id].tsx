/**
 * One money object (transaction, deposit, withdrawal, transfer, P2P trade,
 * claim link…) — record, lifecycle, double-entry journal and audit trail.
 */
import { RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  Empty, ErrorNote, KV, LedgerGroups, Row, Section, Timeline, dateTime, money, shortId, useCockpit,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminTransactionDetail() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const p = useThemedPalette();
  const q = useCockpit<any>(kind && id ? `/cockpit/transactions/${kind}/${id}` : null);
  const r = q.data?.record;
  const amount = r?.amount ?? r?.cryptoAmount ?? r?.sendAmount;
  const currency = r?.currency ?? r?.asset ?? r?.baseAsset ?? r?.sourceCurrency;

  return (
    <AdminScreen title={`${String(kind ?? '').replace(/_/g, ' ')} ${r?.reference ?? shortId(id)}`} subtitle={amount ? money(amount, currency) : undefined}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {!r ? <Empty loading={q.isLoading} text="Not found." /> : (
        <>
          <Section title="Record">
            <KV items={[
              ['Status', r.status ?? r.metadata?.status ?? '—'], ['Customer', shortId(r.userId ?? r.senderId ?? r.buyerId)],
              ['Created', dateTime(r.createdAt)], ['ID', r.id],
            ]} />
          </Section>
          <Section title="Lifecycle"><Timeline items={q.data.transitions} /></Section>
          <Section title="Double-entry journal" subtitle="Every group must sum to zero per currency"><LedgerGroups groups={q.data.ledgerGroups} /></Section>
          <Section title="Audit trail">
            {q.data.audit.length ? q.data.audit.map((a: any, i: number) => (
              <Row key={a.id} last={i === q.data.audit.length - 1} title={a.action} subtitle={a.newValues?._reason ?? ''} meta={`${dateTime(a.createdAt)} · ${shortId(a.userId)}`} />
            )) : <Empty text="No privileged actions on this object." />}
          </Section>
          <Section title="Raw record">
            <Text selectable style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 16, paddingVertical: 8 }}>{JSON.stringify(r, null, 2)}</Text>
          </Section>
        </>
      )}
    </AdminScreen>
  );
}
