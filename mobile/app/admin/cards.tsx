import { StackHeader } from '@/components/ui/ScreenHeader';
/**
 * Admin Cards — issued cards and card transaction ledger.
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
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { formatRelativeTime } from '@/utils/format';
import { TopGradient } from '@/components/ui/ScreenShell';

type Tab = 'CARDS' | 'TRANSACTIONS';

export default function AdminCards() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('CARDS');
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<any>(null);

  const q = useQuery({
    queryKey: ['admin-cards', tab, page],
    queryFn: () => tab === 'CARDS' ? adminService.rawCards({ page, limit: 30 }) : adminService.rawCardTransactions({ page, limit: 30 }),
    enabled: user?.role === 'ADMIN',
  });

  const items = q.data?.items ?? [];
  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <StackHeader title="Cards" right={<><Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? 0}</Text></>} />

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
          {(['CARDS', 'TRANSACTIONS'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => { setTab(t); setPage(1); }} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border, alignItems: 'center' }}>
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600' }}>{t.replace('_', ' ')}</Text>
              </Pressable>
            );
          })}
        </View>

        {q.isLoading ? <LoadingPulse fullscreen icon="card-outline" label="Loading cards…" /> : (
          <ScrollView refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {items.map((row) => (
              <Pressable key={row.id} onPress={() => setDrill(row)} style={({ pressed }) => ({ backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 12, padding: 14, marginBottom: 8, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>
                    {tab === 'CARDS' ? `${row.label ?? ''} · ${row.status ?? ''}` : `${row.type ?? ''} · ${row.amount ?? ''} ${row.currency ?? ''}`}
                  </Text>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(row.createdAt)}</Text>
                </View>
                <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 3 }}>{row.id?.slice(0, 16)}</Text>
              </Pressable>
            ))}
            {items.length === 0 && !q.isLoading && <Text style={{ color: p.fgMuted, textAlign: 'center', marginTop: 60 }}>No records</Text>}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={!!drill} transparent animationType="slide" onRequestClose={() => setDrill(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setDrill(null)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '70%', backgroundColor: p.bgElev, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} onStartShouldSetResponder={() => true}>
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
