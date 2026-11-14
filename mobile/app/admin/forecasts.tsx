/**
 * Forecasts — the same data as the web cockpit's Forecasts page (/cockpit/forecasts).
 */
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import { AutoView } from '@/components/admin/AutoView';
import { Empty, ErrorNote, NoPermission, useCockpit, useStaff } from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminForecasts() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const q = useCockpit<any>(can('forecast.read') ? '/cockpit/forecasts' : null, undefined, { refreshMs: 60_000 });
  return (
    <AdminScreen title="Forecasts" subtitle="Liquidity and volume projections"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!can('forecast.read') ? <NoPermission perm="forecast.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {q.data ? <AutoView data={q.data} /> : <Empty loading={q.isLoading} text="No data." />}
    </AdminScreen>
  );
}
