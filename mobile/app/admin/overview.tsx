/**
 * Overview — the same data as the web cockpit's Overview page (/cockpit/overview).
 */
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import { AutoView } from '@/components/admin/AutoView';
import { Empty, ErrorNote, NoPermission, Segments, useCockpit, useStaff } from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminOverview() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'quarter' | 'year'>('30d');
  const q = useCockpit<any>(can('cockpit.view') ? '/cockpit/overview' : null, { period }, { refreshMs: 60_000 });
  return (
    <AdminScreen title="Overview" subtitle="Business at a glance"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!can('cockpit.view') ? <NoPermission perm="cockpit.view" /> : null}
      <Segments value={period} onChange={setPeriod} options={[
        { key: 'today', label: 'Today' }, { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }, { key: 'quarter', label: 'Quarter' }, { key: 'year', label: 'Year' },
      ]} />
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {q.data ? <AutoView data={q.data} /> : <Empty loading={q.isLoading} text="No data." />}
    </AdminScreen>
  );
}
