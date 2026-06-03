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

type Tab = 'SESSIONS' | 'LOGINS' | 'API_KEYS';

export default function AdminSessions() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('SESSIONS');
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<any>(null);

  const q = useQuery({
    queryKey: ['admin-sessions', tab, page],
    queryFn: () => {
      if (tab === 'SESSIONS') return adminService.rawSessions({ page, limit: 30 });
      if (tab === 'LOGINS')   return adminService.rawLoginHistory({ page, limit: 30 });
      return adminService.rawApiKeys({ page, limit: 30 });
    },
    enabled: user?.role === 'ADMIN',
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => adminService.revokeSession(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sessions'] }); Alert.alert('Session revoked'); setDrill(null); },
    onError: () => Alert.alert('Failed'),
  });

  const items = q.data?.items ?? [];
  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={26} color={p.fg} /></Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600' }}>Sessions & Keys</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? 0}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 10 }}>
          {(['SESSIONS', 'LOGINS', 'API_KEYS'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => { setTab(t); setPage(1); }} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border, alignItems: 'center' }}>
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 10, fontWeight: '600' }}>{t.replace('_', ' ')}</Text>
              </Pressable>
            );
          })}
        </View>

        {q.isLoading ? <LoadingPulse fullscreen icon="key-outline" label="Loading…" /> : (
          <ScrollView refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {items.map((row) => (
              <Pressable key={row.id} onPress={() => setDrill(row)} style={({ pressed }) => ({ backgroundColor: p.bgElev, borderWidth: 1, borderColor: row.revokedAt ? 'rgba(239,68,68,0.3)' : p.border, borderRadius: 12, padding: 14, marginBottom: 8, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {tab === 'LOGINS' ? `${row.ip ?? '?'} · ${row.success ? '✓' : '✗'}` : tab === 'API_KEYS' ? `${row.label ?? ''}` : (row.userAgent ?? '').slice(0, 40)}
                  </Text>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(row.createdAt)}</Text>
                </View>
                {tab === 'SESSIONS' && !row.revokedAt && (
                  <Pressable onPress={() => revokeMut.mutate(row.id)} style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.15)' }}>
                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>Revoke</Text>
                  </Pressable>
                )}
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
