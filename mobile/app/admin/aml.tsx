import { StackHeader } from '@/components/ui/ScreenHeader';
/**
 * Admin AML — open / reviewing / escalated flags with resolution action.
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
type Filter = 'ALL' | 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'ESCALATED';

export default function AdminAML() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [resolving, setResolving] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [newStatus, setNewStatus] = useState<'RESOLVED' | 'ESCALATED' | 'REVIEWING'>('RESOLVED');

  const q = useQuery({
    queryKey: ['admin-aml', filter],
    queryFn: () => adminService.amlFlags(filter === 'ALL' ? {} : { status: filter }),
    enabled: user?.role === 'ADMIN',
    refetchInterval: 30_000,
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: string; resolution: string }) =>
      adminService.resolveAMLFlag(id, { status, resolution }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-aml'] });
      setResolving(null);
      setResolutionNote('');
      Alert.alert('Flag updated');
    },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not update'),
  });

  const flags = q.data?.flags ?? [];
  const summary = q.data?.summary ?? {};
  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <StackHeader title="AML Flags" />

        {/* Summary chips */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            ['Open', summary.open ?? 0, '#f59e0b'],
            ['Reviewing', summary.reviewing ?? 0, '#63a1db'],
            ['Escalated', summary.escalated ?? 0, '#a855f7'],
            ['Critical', summary.critical ?? 0, '#ef4444'],
          ].map(([label, val, col]) => (
            <View key={label as string} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
              <Text style={{ color: col as string, fontSize: 10, fontWeight: '700' }}>{label}</Text>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{val as number}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 10 }}>
          {(['ALL', 'OPEN', 'REVIEWING', 'RESOLVED', 'ESCALATED'] as Filter[]).map((f) => {
            const on = filter === f;
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.accent : p.pillBg, borderWidth: 1, borderColor: on ? p.accent : p.border }}>
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 11, fontWeight: '600' }}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {q.isLoading ? (
          <LoadingPulse fullscreen icon="shield-outline" label="Loading flags…" />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
            refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
          >
            {flags.length === 0 ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <Ionicons name="checkmark-done-circle-outline" size={42} color="#22c55e" />
                <Text style={{ color: p.fgMuted, marginTop: 10 }}>No flags match</Text>
              </View>
            ) : flags.map((f: any) => (
              <View key={f.id} style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: f.severity === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)' }}>
                      <Text style={{ color: f.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b', fontSize: 10, fontWeight: '700' }}>{f.severity ?? 'NORMAL'}</Text>
                    </View>
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{f.ruleName ?? f.type ?? 'Flag'}</Text>
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(f.createdAt)}</Text>
                </View>
                {f.reason && <Text style={{ color: p.fgMuted, fontSize: 12, marginBottom: 8 }}>{f.reason}</Text>}
                {f.status !== 'RESOLVED' && (
                  <Pressable
                    onPress={() => { setResolving(f); setResolutionNote(''); setNewStatus('RESOLVED'); }}
                    style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.fg }}
                  >
                    <Text style={{ color: p.bg, fontSize: 12, fontWeight: '700' }}>Resolve</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      <BottomSheet visible={!!resolving} onClose={() => setResolving(null)} title={"Resolve flag"}>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>NEW STATUS</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {(['RESOLVED', 'ESCALATED', 'REVIEWING'] as const).map((s) => {
                const on = newStatus === s;
                return (
                  <Pressable key={s} onPress={() => setNewStatus(s)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border, alignItems: 'center' }}>
                    <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 11, fontWeight: '700' }}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>RESOLUTION NOTES *</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 18 }}>
              <TextInput
                value={resolutionNote}
                onChangeText={setResolutionNote}
                placeholder="Explain how this flag was resolved…"
                placeholderTextColor={p.fgFaint}
                multiline
                numberOfLines={3}
                style={{ color: p.fg, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => setResolving(null)} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => resolving && resolutionNote.trim() && resolveMut.mutate({ id: resolving.id, status: newStatus, resolution: resolutionNote.trim() })}
                disabled={!resolutionNote.trim() || resolveMut.isPending}
                style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: resolutionNote.trim() ? '#22c55e' : p.pillBg, alignItems: 'center', justifyContent: 'center', opacity: resolutionNote.trim() ? 1 : 0.6 }}
              >
                <Text style={{ color: resolutionNote.trim() ? '#fff' : p.fgFaint, fontWeight: '700' }}>
                  {resolveMut.isPending ? 'Updating…' : 'Submit'}
                </Text>
              </Pressable>
            </View>
          </BottomSheet>
    </View>
  );
}
