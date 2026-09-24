import { StackHeader } from '@/components/ui/ScreenHeader';
/**
 * Admin Messages — in-app messages and reports queue.
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

import { BottomSheet } from '@/components/ui/BottomSheet';
type Tab = 'MESSAGES' | 'REPORTS';

export default function AdminMessages() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('MESSAGES');
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<any>(null);

  const q = useQuery({
    queryKey: ['admin-messages', tab, page],
    queryFn: () => tab === 'MESSAGES' ? adminService.rawMessages({ page, limit: 30 }) : adminService.rawMessageReports({ page, limit: 30 }),
    enabled: user?.role === 'ADMIN',
  });

  const items = q.data?.items ?? [];
  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <StackHeader title="Messages" right={<><Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? 0}</Text></>} />

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
          {(['MESSAGES', 'REPORTS'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => { setTab(t); setPage(1); }} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border, alignItems: 'center' }}>
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600' }}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        {q.isLoading ? <LoadingPulse fullscreen icon="chatbubbles-outline" label="Loading messages…" /> : (
          <ScrollView refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {items.map((row) => (
              <Pressable key={row.id} onPress={() => setDrill(row)} style={({ pressed }) => ({ backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 12, padding: 14, marginBottom: 8, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {tab === 'MESSAGES' ? (row.content ?? '').slice(0, 70) : `${row.reason ?? ''} · ${row.status ?? ''}`}
                  </Text>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(row.createdAt)}</Text>
                </View>
                {tab === 'MESSAGES' && <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 3 }}>{row.type ?? 'TEXT'}</Text>}
              </Pressable>
            ))}
            {items.length === 0 && !q.isLoading && <Text style={{ color: p.fgMuted, textAlign: 'center', marginTop: 60 }}>No records</Text>}
          </ScrollView>
        )}
      </SafeAreaView>

      <BottomSheet visible={!!drill} onClose={() => setDrill(null)} title="Details" scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
              <Text style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 }}>{JSON.stringify(drill, null, 2)}</Text>
            </ScrollView>
          </BottomSheet>
    </View>
  );
}
