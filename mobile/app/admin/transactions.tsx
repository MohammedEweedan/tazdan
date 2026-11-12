/**
 * Transactions — every customer-visible money event. Open one for its ledger
 * journal, lifecycle and audit trail.
 */
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  Empty, ErrorNote, NoPermission, Pager, Pill, Row, SearchBox, Section, Segments, dateTime, money, shortId,
  useCockpit, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const TYPES = ['', 'DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'REFERRAL_BONUS', 'BUDGET_CONTRIBUTION', 'BUDGET_RELEASE'];
const CURRENCIES = ['', 'LYD', 'USD', 'USDT', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'TRY', 'TND', 'BTC', 'ETH', 'SOL'];

export default function AdminTransactions() {
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [currency, setCurrency] = useState('');
  const [page, setPage] = useState(1);
  const r = useCockpit<any>(can('transactions.read') ? '/cockpit/transactions' : null, { q, type, currency, page, limit: 30 });

  return (
    <AdminScreen title="Transactions" subtitle="Every money event"
      refreshControl={<RefreshControl refreshing={r.isFetching} onRefresh={() => r.refetch()} tintColor={p.fg} />}>
      {!can('transactions.read') ? <NoPermission perm="transactions.read" /> : null}
      <SearchBox value={text} onChange={setText} onSubmit={() => { setQ(text.trim()); setPage(1); }} placeholder="Reference, ID or customer" />
      <Segments value={type} onChange={(v) => { setType(v); setPage(1); }} options={TYPES.map((x) => ({ key: x, label: x ? x.replace(/_/g, ' ').toLowerCase() : 'All types' }))} />
      <Segments value={currency} onChange={(v) => { setCurrency(v); setPage(1); }} options={CURRENCIES.map((x) => ({ key: x, label: x || 'All currencies' }))} />
      <ErrorNote error={r.error} onRetry={() => r.refetch()} />
      <Section>
        {r.isLoading ? <Empty loading text="" /> : (r.data?.items ?? []).length ? (r.data.items as any[]).map((t, i, all) => (
          <Row key={t.id} last={i === all.length - 1} title={`${t.type.replace(/_/g, ' ')} · ${money(t.amount, t.currency)}`}
            subtitle={`${t.user ? `${t.user.firstName} ${t.user.lastName}` : shortId(t.userId)} · ${t.reference ?? shortId(t.id)}${Number(t.fee) ? ` · fee ${money(t.fee, t.currency)}` : ''}`}
            meta={dateTime(t.createdAt)} right={t.metadata?.status ? <Pill label={t.metadata.status} /> : undefined}
            onPress={() => router.push(`/admin/transaction/transaction/${t.id}` as any)} />
        )) : <Empty text="No transactions." />}
      </Section>
      <Pager page={page} total={r.data?.total} limit={30} onPage={setPage} />
    </AdminScreen>
  );
}
