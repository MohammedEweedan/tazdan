/**
 * Admin Settings — every PlatformSetting key/value. Inline editable.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
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

  type SettingRow = { key: string; value: string; description?: string | null };
  const [meta, setMeta] = useState<Record<string, { description?: string | null }>>({});

  const q = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings');
      return data as { settings: SettingRow[] };
    },
    enabled: user?.role === 'ADMIN',
  });

  useEffect(() => {
    // The API returns an array of { key, value, description } rows.
    const rows = q.data?.settings;
    if (Array.isArray(rows)) {
      const flat: Record<string, string> = {};
      const m: Record<string, { description?: string | null }> = {};
      for (const row of rows) {
        flat[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
        m[row.key] = { description: row.description };
      }
      setDraft(flat);
      setMeta(m);
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
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
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
            ) : keys.map((k) => {
              const raw = draft[k] ?? '';
              const isBool = raw === 'true' || raw === 'false';
              const isNumeric = raw.trim() !== '' && !isNaN(Number(raw));
              // Percentage-style settings (stored as a fraction) get a helper hint.
              const pctHint = /pct|percent|spread/i.test(k) && isNumeric
                ? `${(Number(raw) * 100).toFixed(2)}%`
                : null;
              const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <View key={k} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{label}</Text>
                    {pctHint && <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700' }}>{pctHint}</Text>}
                    {isBool && (
                      <Switch
                        value={raw === 'true'}
                        onValueChange={(on) => setDraft({ ...draft, [k]: on ? 'true' : 'false' })}
                        trackColor={{ true: p.fg, false: p.border }}
                      />
                    )}
                  </View>
                  {meta[k]?.description ? (
                    <Text style={{ color: p.fgMuted, fontSize: 11, marginBottom: 6 }}>{meta[k]?.description}</Text>
                  ) : null}
                  {!isBool && (
                    <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 44, justifyContent: 'center' }}>
                      <TextInput
                        value={raw}
                        onChangeText={(v) => setDraft({ ...draft, [k]: v })}
                        keyboardType={isNumeric ? 'decimal-pad' : 'default'}
                        style={{ color: p.fg, fontSize: 14 }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
