/**
 * Trusted Devices — /settings/devices
 *
 * Shows the devices that have been verified (passed step-up) plus active
 * sessions, and lets the user "forget" a device (forces full verification
 * next time) or revoke a session (force sign-out).
 */
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { securityService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { ScreenShell, SectionLabel } from '@/components/ui/ScreenShell';
import { useT } from '@/store/i18nStore';

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function deviceIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'mobile':  return 'phone-portrait-outline';
    case 'tablet':  return 'tablet-portrait-outline';
    case 'desktop': return 'desktop-outline';
    default:        return 'globe-outline';
  }
}

/** One labelled metadata line (icon + text) inside a session card. */
function DetailLine({ icon, text, p }: { icon: keyof typeof Ionicons.glyphMap; text: string; p: ReturnType<typeof useThemedPalette> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={12} color={p.fgFaint} />
      <Text style={{ color: p.fgMuted, fontSize: 12 }} numberOfLines={1}>{text}</Text>
    </View>
  );
}

export default function TrustedDevicesScreen() {
  const p = useThemedPalette();
  const t = useT();
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

  const confirmSignOut = (id: string, label: string) =>
    Alert.alert('Sign out device?', `This will end the session on ${label}. It will need to sign in again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => revoke.mutate(id) },
    ]);

  const loading = devicesQ.isLoading || sessionsQ.isLoading;

  // Pull-to-refresh spinner, separate from background refetches.
  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    try { await Promise.all([devicesQ.refetch(), sessionsQ.refetch()]); } finally { setPulling(false); }
  };

  return (
    <ScreenShell title={t('settings.trustedDevices')} onRefresh={onRefresh} refreshing={pulling}>
      {loading ? (
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <LoadingPulse icon="phone-portrait-outline" label="Loading devices…" />
        </View>
      ) : (
        <>
      {/* Trusted devices */}
      <SectionLabel first>{t('settings.trustedDevices')}</SectionLabel>
      <Text style={{ color: p.fgMuted, fontSize: 12, marginBottom: 12 }}>
        Devices you've verified. On these, Face ID confirms purchases — no code needed. Forget one to require full verification again.
      </Text>
      <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
        {(devicesQ.data?.devices ?? []).length === 0 ? (
          <View style={{ padding: 18, alignItems: 'center' }}>
            <Text style={{ color: p.fgMuted, fontSize: 13 }}>No trusted devices yet.</Text>
          </View>
        ) : devicesQ.data!.devices.map((d, i, arr) => (
          <View key={d.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: p.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={deviceIcon(d.deviceType)} size={20} color={p.greenFg} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{d.label}</Text>
                {d.current && (
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.greenFg }}>
                    <Text style={{ color: p.greenFg, fontSize: 10, fontWeight: '700' }}>This device</Text>
                  </View>
                )}
              </View>
              {d.os && d.os !== 'Unknown' && <DetailLine icon="hardware-chip-outline" text={d.os} p={p} />}
              {d.location && <DetailLine icon="location-outline" text={d.location} p={p} />}
              {d.ipAddress && <DetailLine icon="wifi-outline" text={d.ipAddress} p={p} />}
              <DetailLine icon="time-outline" text={`Last used ${timeAgo(d.lastSeenAt)}`} p={p} />
            </View>
            <Pressable onPress={() => confirmForget(d.id, d.label)} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.redFg }}>
              <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '700' }}>Forget</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Active sessions */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <SectionLabel>Active sessions</SectionLabel>
        {(sessionsQ.data?.sessions ?? []).length > 1 && (
          <Pressable onPress={() => revokeAll.mutate()} hitSlop={8} style={{ marginBottom: 8, marginRight: 4 }}>
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
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: p.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={deviceIcon(s.deviceType)} size={20} color={s.current ? p.greenFg : p.fgMuted} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              {/* Device name + OS, with a "This device" badge for the current session */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>
                  {s.deviceName}{s.browser ? ` · ${s.browser}` : ''}
                </Text>
                {s.current && (
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.greenFg }}>
                    <Text style={{ color: p.greenFg, fontSize: 10, fontWeight: '700' }}>This device</Text>
                  </View>
                )}
              </View>
              {/* OS / software */}
              {s.os && s.os !== 'Unknown' && (
                <DetailLine icon="hardware-chip-outline" text={s.os} p={p} />
              )}
              {/* Location: City, Country */}
              <DetailLine icon="location-outline" text={s.location ?? 'Location unavailable'} p={p} />
              {/* IP address */}
              <DetailLine icon="wifi-outline" text={s.ipAddress || 'Unknown IP'} p={p} />
              {/* Last login / active */}
              <DetailLine icon="time-outline" text={`Last login ${timeAgo(s.lastActiveAt ?? s.createdAt)}`} p={p} />
            </View>
            {s.current ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                <Ionicons name="checkmark-circle" size={18} color={p.greenFg} />
              </View>
            ) : (
              <Pressable
                onPress={() => confirmSignOut(s.id, `${s.deviceName}${s.location ? ` (${s.location})` : ''}`)}
                hitSlop={8}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.redFg }}
              >
                <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '700' }}>Sign out</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
        </>
      )}
    </ScreenShell>
  );
}
