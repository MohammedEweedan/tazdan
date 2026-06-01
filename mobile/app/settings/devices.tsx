/**
 * Trusted Devices — /settings/devices
 *
 * Shows the devices that have been verified (passed step-up) plus active
 * sessions, and lets the user "forget" a device (forces full verification
 * next time) or revoke a session (force sign-out).
 */
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { securityService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function parseUA(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/mac/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  return 'Web';
}

export default function TrustedDevicesScreen() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const h = useHaptics();
  const qc = useQueryClient();

  const devicesQ = useQuery({ queryKey: ['sec-devices'], queryFn: () => securityService.devices() });
  const sessionsQ = useQuery({ queryKey: ['sec-sessions'], queryFn: () => securityService.sessions() });

  const forget = useMutation({
    mutationFn: (id: string) => securityService.forgetDevice(id),
    onSuccess: () => { h.success(); qc.invalidateQueries({ queryKey: ['sec-devices'] }); },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not remove device'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => securityService.revokeSession(id),
    onSuccess: () => { h.success(); qc.invalidateQueries({ queryKey: ['sec-sessions'] }); },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not sign out'),
  });
  const revokeAll = useMutation({
    mutationFn: () => securityService.revokeAllSessions(),
    onSuccess: () => { h.success(); qc.invalidateQueries({ queryKey: ['sec-sessions'] }); Alert.alert('Done', 'Signed out of all other sessions.'); },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not sign out'),
  });

  const confirmForget = (id: string, label: string) =>
    Alert.alert('Forget device?', `${label} will need full verification (code) next time it's used.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget', style: 'destructive', onPress: () => forget.mutate(id) },
    ]);

  const loading = devicesQ.isLoading || sessionsQ.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={26} color={p.fg} /></Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '700' }}>Trusted Devices</Text>
        </View>

        {loading ? (
          <LoadingPulse fullscreen icon="phone-portrait-outline" label="Loading devices…" />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
            refreshControl={<RefreshControl refreshing={devicesQ.isFetching || sessionsQ.isFetching} onRefresh={() => { devicesQ.refetch(); sessionsQ.refetch(); }} tintColor={p.fg} />}
          >
            {/* Trusted devices */}
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>TRUSTED DEVICES</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, marginBottom: 12 }}>
              Devices you've verified. On these, Face ID confirms purchases — no code needed. Forget one to require full verification again.
            </Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
              {(devicesQ.data?.devices ?? []).length === 0 ? (
                <View style={{ padding: 18, alignItems: 'center' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 13 }}>No trusted devices yet.</Text>
                </View>
              ) : devicesQ.data!.devices.map((d, i, arr) => (
                <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: p.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={p.greenFg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{d.label || 'Verified device'}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>Last used {timeAgo(d.lastSeenAt)}</Text>
                  </View>
                  <Pressable onPress={() => confirmForget(d.id, d.label || 'This device')} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.redFg }}>
                    <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '700' }}>Forget</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Active sessions */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }}>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>ACTIVE SESSIONS</Text>
              {(sessionsQ.data?.sessions ?? []).length > 1 && (
                <Pressable onPress={() => revokeAll.mutate()} hitSlop={8}>
                  <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '700' }}>Sign out all others</Text>
                </Pressable>
              )}
            </View>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
              {(sessionsQ.data?.sessions ?? []).length === 0 ? (
                <View style={{ padding: 18, alignItems: 'center' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 13 }}>No active sessions.</Text>
                </View>
              ) : sessionsQ.data!.sessions.map((s, i, arr) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: p.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="globe-outline" size={20} color={p.fgMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{parseUA(s.userAgent)}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>{s.ipAddress || 'Unknown IP'} · {timeAgo(s.createdAt)}</Text>
                  </View>
                  <Pressable onPress={() => revoke.mutate(s.id)} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.border }}>
                    <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>Sign out</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
