/**
 * Admin WhatsApp — message log, stats, and compose pane.
 */
import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { formatRelativeTime } from '@/utils/format';
import { TopGradient } from '@/components/ui/ScreenShell';

export default function AdminWhatsApp() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [compose, setCompose] = useState(false);
  const [toPhone, setToPhone] = useState('');
  const [msgBody, setMsgBody] = useState('');

  const q = useQuery({
    queryKey: ['admin-whatsapp', page, direction],
    queryFn: () => adminService.rawWhatsApp({ page, limit: 30, ...(direction !== 'ALL' ? { direction } : {}) }),
    enabled: user?.role === 'ADMIN',
  });
  const statsQ = useQuery({
    queryKey: ['admin-whatsapp-stats'],
    queryFn: () => adminService.whatsappStats(),
    enabled: user?.role === 'ADMIN',
  });

  const sendMut = useMutation({
    mutationFn: () => adminService.sendWhatsApp({ phoneNumber: toPhone, message: msgBody }),
    onSuccess: () => { Alert.alert('Sent'); setCompose(false); setToPhone(''); setMsgBody(''); q.refetch(); },
    onError: (e: any) => Alert.alert('Send failed', e?.response?.data?.error ?? e?.message),
  });

  const messages = (q.data as any)?.messages ?? [];
  const stats = statsQ.data as any;
  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={26} color={p.fg} /></Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600' }}>WhatsApp</Text>
          <Pressable onPress={() => setCompose(true)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: '#25d366' }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>+ Send</Text>
          </Pressable>
        </View>

        {/* Stats strip */}
        {stats && (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 }}>
            {[
              { label: '24h In',  value: stats.period24h?.inbound ?? 0 },
              { label: '24h Out', value: stats.period24h?.outbound ?? 0 },
              { label: '30d Total', value: stats.period30d?.total ?? 0 },
            ].map((s) => (
              <View key={s.label} style={{ flex: 1, backgroundColor: p.bgElev, borderRadius: 10, borderWidth: 1, borderColor: p.border, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>{s.label.toUpperCase()}</Text>
                <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 2 }}>{s.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Direction filter */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
          {(['ALL', 'IN', 'OUT'] as const).map((d) => {
            const on = direction === d;
            return (
              <Pressable key={d} onPress={() => { setDirection(d); setPage(1); }} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border, alignItems: 'center' }}>
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600' }}>{d}</Text>
              </Pressable>
            );
          })}
        </View>

        {q.isLoading ? <LoadingPulse fullscreen icon="logo-whatsapp" label="Loading messages…" /> : (
          <ScrollView refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {messages.map((row: any) => (
              <View key={row.id} style={{ backgroundColor: p.bgElev, borderWidth: 1, borderColor: row.direction === 'IN' ? 'rgba(37,211,102,0.3)' : p.border, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.direction === 'IN' ? '#25d366' : '#63a1db' }} />
                    <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '600' }}>{row.direction} · +{row.phoneNumber}</Text>
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 10 }}>{formatRelativeTime(row.createdAt)}</Text>
                </View>
                <Text style={{ color: p.fg, fontSize: 13 }} numberOfLines={3}>{row.message}</Text>
                {row.status && row.status !== 'SENT' && (
                  <Text style={{ color: row.status === 'FAILED' ? '#ef4444' : p.fgMuted, fontSize: 10, fontWeight: '700', marginTop: 4 }}>{row.status}</Text>
                )}
              </View>
            ))}
            {messages.length === 0 && !q.isLoading && <Text style={{ color: p.fgMuted, textAlign: 'center', marginTop: 60 }}>No messages</Text>}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Compose modal */}
      <Modal visible={compose} transparent animationType="slide" onRequestClose={() => setCompose(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setCompose(false)}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: p.bgElev, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }} onStartShouldSetResponder={() => true}>
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600', marginBottom: 16 }}>Send WhatsApp</Text>
            <TextInput value={toPhone} onChangeText={setToPhone} placeholder="+2189xxxxxxx" placeholderTextColor={p.fgFaint} keyboardType="phone-pad" style={{ backgroundColor: p.bg, borderWidth: 1, borderColor: p.border, borderRadius: 10, color: p.fg, padding: 12, fontSize: 15, marginBottom: 12 }} />
            <TextInput value={msgBody} onChangeText={setMsgBody} placeholder="Message…" placeholderTextColor={p.fgFaint} multiline numberOfLines={4} style={{ backgroundColor: p.bg, borderWidth: 1, borderColor: p.border, borderRadius: 10, color: p.fg, padding: 12, fontSize: 15, marginBottom: 16, minHeight: 80, textAlignVertical: 'top' }} />
            <Pressable onPress={() => sendMut.mutate()} disabled={sendMut.isPending || !toPhone || !msgBody} style={{ height: 50, borderRadius: 12, backgroundColor: '#25d366', alignItems: 'center', justifyContent: 'center', opacity: (!toPhone || !msgBody) ? 0.5 : 1 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{sendMut.isPending ? 'Sending…' : 'Send'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
