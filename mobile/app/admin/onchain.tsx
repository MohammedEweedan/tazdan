import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { formatRelativeTime } from '@/utils/format';
import { TopGradient } from '@/components/ui/ScreenShell';

export default function AdminOnchain() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<any>(null);

  const q = useQuery({
    queryKey: ['admin-onchain', page],
    queryFn: () => adminService.rawOnchain({ page, limit: 30 }),
    enabled: user?.role === 'ADMIN',
  });

  const markSentMut = useMutation({
    mutationFn: (id: string) => adminService.markOnChainSent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-onchain'] });
      Alert.alert('Marked as sent');
      setDrill(null);
    },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not update'),
  });

  const items = q.data?.items ?? [];
  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={26} color={p.fg} /></Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600' }}>On-Chain Txns</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? 0}</Text>
        </View>

        {q.isLoading ? <LoadingPulse fullscreen icon="git-branch-outline" label="Loading on-chain…" /> : (
          <ScrollView refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {items.map((row) => (
              <Pressable key={row.id} onPress={() => setDrill(row)} style={({ pressed }) => ({ backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 12, padding: 14, marginBottom: 8, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{row.type ?? ''} · {row.status ?? ''}</Text>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(row.createdAt)}</Text>
                </View>
                <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 3 }} numberOfLines={1}>{row.txHash ?? '—'}</Text>
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
              {drill?.status && drill.status !== 'SENT' && drill.status !== 'CONFIRMED' && (
                <Pressable
                  onPress={() => markSentMut.mutate(drill.id)}
                  disabled={markSentMut.isPending}
                  style={{ marginTop: 20, height: 48, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {markSentMut.isPending ? 'Updating…' : 'Mark as Sent'}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
