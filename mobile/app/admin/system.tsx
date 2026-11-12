/**
 * System health — the same data as the web cockpit's System health page (/cockpit/system).
 */
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import { AutoView } from '@/components/admin/AutoView';
import { Empty, ErrorNote, NoPermission, useCockpit, useStaff } from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminSystem() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const q = useCockpit<any>(can('system.read') ? '/cockpit/system' : null, undefined, { refreshMs: 60_000 });
  return (
    <AdminScreen title="System health" subtitle="Dependencies, jobs and readiness"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!can('system.read') ? <NoPermission perm="system.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {q.data ? <AutoView data={q.data} /> : <Empty loading={q.isLoading} text="No data." />}
    </AdminScreen>
  );
}
