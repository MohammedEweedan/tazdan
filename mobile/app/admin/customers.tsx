/**
 * Customers (360) — search every customer and open the full profile with
 * freeze, restriction, session and case controls.
 */
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  Empty, ErrorNote, NoPermission, Pager, Pill, Row, SearchBox, Section, Segments, ago, useCockpit, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminCustomers() {
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const r = useCockpit<any>(can('customers.read') ? '/cockpit/customers' : null, { q, status, page, limit: 30 });

  return (
    <AdminScreen title="Customers" subtitle="Customer 360"
      refreshControl={<RefreshControl refreshing={r.isFetching} onRefresh={() => r.refetch()} tintColor={p.fg} />}>
      {!can('customers.read') ? <NoPermission perm="customers.read" /> : null}
      <SearchBox value={text} onChange={setText} onSubmit={() => { setQ(text.trim()); setPage(1); }} placeholder="Name, @username, email, phone or ID" />
      <Segments value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
        { key: '', label: 'All' }, { key: 'ACTIVE', label: 'Active' }, { key: 'SUSPENDED', label: 'Suspended' }, { key: 'FROZEN', label: 'Frozen' },
      ]} />
      <ErrorNote error={r.error} onRetry={() => r.refetch()} />
      <Section>
        {r.isLoading ? <Empty loading text="" /> : (r.data?.items ?? []).length ? (r.data.items as any[]).map((u, i, all) => (
          <Row key={u.id} last={i === all.length - 1} title={`${u.firstName} ${u.lastName}`}
            subtitle={`@${u.username ?? '—'} · ${u.email}${u.phone ? ` · ${u.phone}` : ''}`}
            meta={`${u.kycTier} · ${u.accountType} · ${u.country ?? '—'} · seen ${ago(u.lastLoginAt)}`}
            right={<Pill label={u.status} />} onPress={() => router.push(`/admin/customer/${u.id}` as any)} />
        )) : <Empty text="No customers match." />}
      </Section>
      <Pager page={page} total={r.data?.total} limit={30} onPage={setPage} />
    </AdminScreen>
  );
}
