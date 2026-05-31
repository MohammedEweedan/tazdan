/**
 * Admin Fee Ledger — every fee the platform has collected, grouped
 * by currency with USD totals, and filterable by source.
 */

import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { formatRelativeTime } from '@/utils/format';
import { TopGradient } from '@/components/ui/ScreenShell';

type Source = 'ALL' | 'order' | 'crypto_order' | 'withdrawal' | 'p2p_trade';

const SOURCE_LABEL: Record<Source, string> = {
  ALL: 'ALL',
  order: 'ORDERS',
  crypto_order: 'CRYPTO',
  withdrawal: 'WITHDRAW',
  p2p_trade: 'P2P',
};

export default function AdminFees() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [source, setSource] = useState<Source>('ALL');

  const q = useQuery({
    queryKey: ['admin-fees', source],
    queryFn: () => adminService.platformFees({ source: source === 'ALL' ? undefined : source, limit: 200 }),
    enabled: isAdmin,
    refetchInterval: 15_000,
  });

  if (!isAdmin) {
    return <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
      <TopGradient /><Text style={{ color: p.fg }}>Admin only</Text></View>;
  }

  const fees = q.data?.items ?? [];
  const totals: any[] = q.data?.totalsByCurrency ?? [];
  const totalUsd = totals.reduce((s, t) => s + Number(t._sum?.amountUsd ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>Fee Ledger</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={p.fg} />}
        >
          {/* Big total */}
          <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 18, marginBottom: 14 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6 }}>TOTAL COMMISSIONS</Text>
            <Text style={{ color: p.fg, fontSize: 36, fontWeight: '600', letterSpacing: -1, marginTop: 4, fontVariant: ['tabular-nums'] }}>
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {totals.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {totals.map((t: any) => (
                  <View key={t.currency} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: p.bg, borderWidth: 1, borderColor: p.border }}>
                    <Text style={{ color: p.fg, fontSize: 11, fontWeight: '600' }}>
                      {Number(t._sum?.amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} {t.currency}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Source filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {(['ALL', 'order', 'crypto_order', 'withdrawal', 'p2p_trade'] as Source[]).map((s) => {
              const on = source === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSource(s)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}
                >
                  <Text style={{ color: on ? p.bg : p.fg, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>{SOURCE_LABEL[s]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {q.isLoading ? (
            <View style={{ paddingTop: 60, alignItems: 'center' }}><LoadingPulse size={56} icon="cash-outline" label="Loading fees…" /></View>
          ) : fees.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="cash-outline" size={42} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10 }}>No fees collected yet</Text>
              <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 }}>
                Run the backfill on the dashboard to import existing transactions.
              </Text>
            </View>
          ) : (
            fees.map((f: any) => (
              <View key={f.id} style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(34,197,94,0.15)' }}>
                    <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 }}>{f.source.toUpperCase()}</Text>
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 10 }}>{formatRelativeTime(f.createdAt)}</Text>
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600', marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>
                    +{Number(f.amount).toLocaleString('en-US', { maximumFractionDigits: 8 })} {f.currency}
                  </Text>
                </View>
                <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 6 }} numberOfLines={1}>{f.description ?? '—'}</Text>
                <Text style={{ color: p.fgFaint, fontSize: 10, marginTop: 2 }}>≈ ${Number(f.amountUsd).toFixed(2)} USD</Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
