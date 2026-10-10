import { StackHeader } from '@/components/ui/ScreenHeader';
/**
 * Admin P2P — listings, trades, disputes with moderation actions.
 */
import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
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

import { BottomSheet } from '@/components/ui/BottomSheet';
type Tab = 'TRADES' | 'LISTINGS' | 'DISPUTES';

export default function AdminP2P() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('TRADES');
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<any>(null);
  const [resolution, setResolution] = useState('');

  const q = useQuery({
    queryKey: ['admin-p2p', tab, page],
    queryFn: () => {
      if (tab === 'TRADES')    return adminService.rawP2PTrades({ page, limit: 30 });
      if (tab === 'LISTINGS')  return adminService.rawP2PListings({ page, limit: 30 });
      return adminService.rawP2PDisputes({ page, limit: 30 });
    },
    enabled: user?.role === 'ADMIN',
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, resolution, outcome }: { id: string; resolution: string; outcome: 'BUYER' | 'SELLER' }) =>
      adminService.resolveP2PDispute(id, { resolution, outcome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-p2p'] });
      Alert.alert('Dispute resolved');
      setDrill(null);
      setResolution('');
    },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not resolve dispute'),
  });

  const items = q.data?.items ?? [];

  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <StackHeader title="P2P Admin" right={<><Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? 0}</Text></>} />

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
          {(['TRADES', 'LISTINGS', 'DISPUTES'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => { setTab(t); setPage(1); }} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border, alignItems: 'center' }}>
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600' }}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        {q.isLoading ? <LoadingPulse fullscreen icon="swap-horizontal-outline" label="Loading P2P…" /> : (
          <ScrollView refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {items.map((row) => (
              <Pressable key={row.id} onPress={() => setDrill(row)} style={({ pressed }) => ({ backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 12, padding: 14, marginBottom: 8, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>
                    {row.amount ?? ''} {row.currency ?? row.baseCurrency ?? ''} · {row.status ?? ''}
                  </Text>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(row.createdAt)}</Text>
                </View>
                {row.reason && <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 4 }}>{row.reason}</Text>}
              </Pressable>
            ))}
            {items.length === 0 && !q.isLoading && <Text style={{ color: p.fgMuted, textAlign: 'center', marginTop: 60 }}>No records</Text>}
          </ScrollView>
        )}
      </SafeAreaView>

      <BottomSheet visible={!!drill} onClose={() => setDrill(null)} title="Details" scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
              <Text style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 }}>{JSON.stringify(drill, null, 2)}</Text>
              {tab === 'DISPUTES' && drill?.status !== 'RESOLVED' && (
                <View style={{ marginTop: 20 }}>
                  <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>RESOLUTION NOTES *</Text>
                  <View style={{ backgroundColor: p.bg, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 12 }}>
                    <TextInput
                      value={resolution}
                      onChangeText={setResolution}
                      placeholder="Describe how this dispute was resolved…"
                      placeholderTextColor={p.fgFaint}
                      multiline
                      numberOfLines={3}
                      style={{ color: p.fg, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
                    />
                  </View>
                  {/* The decision moves the escrow, so the admin picks who it is decided for. */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {([
                      { outcome: 'BUYER' as const, label: 'Release to buyer', body: 'The escrowed crypto is released to the buyer and the trade completes.' },
                      { outcome: 'SELLER' as const, label: 'Refund seller', body: 'The escrowed crypto returns to the seller and the trade is cancelled.' },
                    ]).map((o, i) => {
                      const ready = resolution.trim().length >= 5 && !resolveMut.isPending;
                      return (
                        <Pressable
                          key={o.outcome}
                          disabled={!ready}
                          onPress={() => Alert.alert(o.label, `${o.body} This cannot be undone.`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: o.label, style: 'destructive', onPress: () => resolveMut.mutate({ id: drill.id, resolution: resolution.trim(), outcome: o.outcome }) },
                          ])}
                          style={{
                            flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: i === 0 && ready ? p.accent : 'transparent',
                            borderWidth: 1, borderColor: ready ? p.accent : p.border, opacity: ready ? 1 : 0.6,
                          }}
                        >
                          <Text style={{ color: i === 0 && ready ? p.accentFg : ready ? p.accent : p.fgFaint, fontWeight: '600', fontSize: 13 }}>
                            {resolveMut.isPending ? 'Resolving…' : o.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 8 }}>Notes need at least 5 characters and are recorded in the audit trail.</Text>
                </View>
              )}
            </ScrollView>
          </BottomSheet>
    </View>
  );
}
