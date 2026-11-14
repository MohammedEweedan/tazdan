/**
 * Support desk — the same data as the web cockpit's Support desk page (/cockpit/support).
 */
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import { AutoView } from '@/components/admin/AutoView';
import { Empty, ErrorNote, NoPermission, useCockpit, useStaff } from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminSupportDesk() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const q = useCockpit<any>(can('support.read') ? '/cockpit/support' : null, undefined, { refreshMs: 60_000 });
  return (
    <AdminScreen title="Support desk" subtitle="Open tickets and customer context"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!can('support.read') ? <NoPermission perm="support.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {q.data ? <AutoView data={q.data} /> : <Empty loading={q.isLoading} text="No data." />}
    </AdminScreen>
  );
}
