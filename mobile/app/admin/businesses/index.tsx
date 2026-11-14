/**
 * Businesses — business accounts and KYB state.
 */
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  Empty, ErrorNote, NoPermission, Pager, Pill, Row, SearchBox, Section, Segments, ago, num, useCockpit, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminBusinesses() {
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [kyb, setKyb] = useState('');
  const [page, setPage] = useState(1);
  const r = useCockpit<any>(can('businesses.read') ? '/cockpit/businesses' : null, { kyb, q, page, limit: 25 });

  return (
    <AdminScreen title="Businesses" subtitle="Business accounts and KYB"
      refreshControl={<RefreshControl refreshing={r.isFetching} onRefresh={() => r.refetch()} tintColor={p.fg} />}>
      {!can('businesses.read') ? <NoPermission perm="businesses.read" /> : null}
      <SearchBox value={text} onChange={setText} onSubmit={() => { setQ(text.trim()); setPage(1); }} placeholder="Company name" />
      <Segments value={kyb} onChange={(v) => { setKyb(v); setPage(1); }} options={['', 'PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED'].map((s) => ({ key: s, label: s ? s.replace('_', ' ').toLowerCase() : 'All KYB states' }))} />
      <ErrorNote error={r.error} onRetry={() => r.refetch()} />
      <Section>
        {(r.data?.items ?? []).length ? (r.data.items as any[]).map((b, i, all) => (
          <Row key={b.id} last={i === all.length - 1} title={b.tradingName ?? b.companyName} subtitle={`${b.legalName ?? b.companyName} · ${b.industry ?? '—'}`}
            meta={`${num(b._count.team)} team · ${num(b._count.apiKeys)} API keys · ${num(b._count.payouts)} payouts · joined ${ago(b.createdAt)}`}
            right={<Pill label={b.kybStatus} />} onPress={() => router.push(`/admin/businesses/${b.id}` as any)} />
        )) : <Empty loading={r.isLoading} text="No business accounts." />}
      </Section>
      <Pager page={page} total={r.data?.total} limit={25} onPage={setPage} />
    </AdminScreen>
  );
}
