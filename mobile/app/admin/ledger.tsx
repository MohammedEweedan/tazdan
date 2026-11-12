/**
 * Ledger — the same data as the web cockpit's Ledger page (/cockpit/ledger/summary).
 */
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import { AutoView } from '@/components/admin/AutoView';
import { Empty, ErrorNote, NoPermission, useCockpit, useStaff } from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminLedger() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const q = useCockpit<any>(can('ledger.read') ? '/cockpit/ledger/summary' : null, undefined, { refreshMs: 60_000 });
  return (
    <AdminScreen title="Ledger" subtitle="Double-entry balances by account"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!can('ledger.read') ? <NoPermission perm="ledger.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {q.data ? <AutoView data={q.data} /> : <Empty loading={q.isLoading} text="No data." />}
    </AdminScreen>
  );
}
