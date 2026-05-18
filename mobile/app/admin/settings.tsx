/**
 * Admin Settings — every PlatformSetting key/value. Inline editable.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { TopGradient } from '@/components/ui/ScreenShell';

export default function AdminSettings() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const q = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings');
      return data as { settings: Record<string, any> };
    },
    enabled: user?.role === 'ADMIN',
  });

  useEffect(() => {
    if (q.data?.settings) {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(q.data.settings)) {
        flat[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      setDraft(flat);
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      // Re-cast strings into native JSON when applicable
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(draft)) {
        if (v === 'true' || v === 'false') out[k] = v === 'true';
        else if (!isNaN(Number(v)) && v.trim() !== '') out[k] = Number(v);
        else out[k] = v;
      }
      const { data } = await api.put('/admin/settings', { settings: out });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      Alert.alert('Saved', 'Platform settings updated.');
    },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not save'),
  });

  if (user?.role !== 'ADMIN') return null;

  const keys = Object.keys(draft).sort();

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600' }}>Platform Settings</Text>
          <Pressable
            onPress={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: p.fg }}
          >
            <Text style={{ color: p.bg, fontSize: 12, fontWeight: '700' }}>
              {saveMut.isPending ? 'Saving…' : 'Save All'}
            </Text>
          </Pressable>
        </View>

        {q.isLoading ? (
          <LoadingPulse fullscreen icon="settings-outline" label="Loading settings…" />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
            refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
          >
            {keys.length === 0 ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <Ionicons name="settings-outline" size={42} color={p.fgFaint} />
                <Text style={{ color: p.fgMuted, marginTop: 10 }}>No settings configured</Text>
              </View>
            ) : keys.map((k) => (
              <View key={k} style={{ marginBottom: 12 }}>
                <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{k}</Text>
                <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 44, justifyContent: 'center' }}>
                  <TextInput
                    value={draft[k] ?? ''}
                    onChangeText={(v) => setDraft({ ...draft, [k]: v })}
                    style={{ color: p.fg, fontSize: 13, fontFamily: 'monospace' }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
