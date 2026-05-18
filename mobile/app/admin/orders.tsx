/**
 * Admin Orders — every BUY/SELL order placed on the platform.
 */
import { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { formatRelativeTime } from '@/utils/format';
import { TopGradient } from '@/components/ui/ScreenShell';

type Filter = 'ALL' | 'BUY' | 'SELL' | 'PENDING' | 'COMPLETED';

export default function AdminOrders() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [drill, setDrill] = useState<any>(null);

  const q = useQuery({
    queryKey: ['admin-orders', filter],
    queryFn: async () => {
      const params: any = { page: 1, limit: 100 };
      if (filter === 'BUY' || filter === 'SELL') params.type = filter;
      if (filter === 'PENDING' || filter === 'COMPLETED') params.status = filter;
      const { data } = await api.get('/admin/orders', { params });
      return data as { orders: any[]; total: number };
    },
    enabled: user?.role === 'ADMIN',
    refetchInterval: 20_000,
  });

  const items = q.data?.orders ?? [];
  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600' }}>Orders</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? 0}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 10, paddingVertical: 2 }}>
          {(['ALL', 'BUY', 'SELL', 'PENDING', 'COMPLETED'] as Filter[]).map((f) => {
            const on = filter === f;
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}>
                <Text style={{ color: on ? p.bg : p.fg, fontSize: 11, fontWeight: '600' }}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {q.isLoading ? (
          <LoadingPulse fullscreen icon="cube-outline" label="Loading orders…" />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
            refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
          >
            {items.length === 0 ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <Ionicons name="cube-outline" size={42} color={p.fgFaint} />
                <Text style={{ color: p.fgMuted, marginTop: 10 }}>No orders</Text>
              </View>
            ) : items.map((o: any) => (
              <Pressable key={o.id} onPress={() => setDrill(o)} style={({ pressed }) => ({ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 8, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: o.type === 'BUY' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
                      <Text style={{ color: o.type === 'BUY' ? '#22c55e' : '#ef4444', fontSize: 10, fontWeight: '700' }}>{o.type}</Text>
                    </View>
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{o.baseCurrency}/{o.quoteCurrency}</Text>
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(o.createdAt)}</Text>
                </View>
                <Text style={{ color: p.fgMuted, fontSize: 12 }}>
                  {Number(o.baseAmount ?? 0).toLocaleString()} {o.baseCurrency} · {o.status}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={!!drill} transparent animationType="slide" onRequestClose={() => setDrill(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setDrill(null)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '75%', backgroundColor: p.bgElev, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} onStartShouldSetResponder={() => true}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border, alignSelf: 'center', marginTop: 10, marginBottom: 12 }} />
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 }}>{JSON.stringify(drill, null, 2)}</Text>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
