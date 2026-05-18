/**
 * Admin Withdrawals queue — review pending withdrawals, mark them
 * processed (after the off-ramp settles) or reject with a reason.
 */

import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { formatRelativeTime } from '@/utils/format';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { TopGradient } from '@/components/ui/ScreenShell';

export default function AdminWithdrawals() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [filter, setFilter] = useState<'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'>('PENDING');
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: ['admin-withdrawals', filter],
    queryFn: () => adminService.withdrawals({ status: filter }),
    enabled: isAdmin,
    refetchInterval: 15_000,
  });

  const processMut = useMutation({
    mutationFn: adminService.processWithdrawal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-withdrawals'] }),
    onError: (e: any) => Alert.alert('Process failed', e?.response?.data?.error ?? 'Try again'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminService.rejectWithdrawal(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setRejecting(null);
      setReason('');
    },
  });

  const withdrawals = q.data?.withdrawals ?? [];

  if (!isAdmin) {
    return <DeniedView p={p} themeMode={themeMode} onBack={() => router.back()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>Withdrawal Queue</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{withdrawals.length}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'] as const).map((s) => {
            const on = filter === s;
            return (
              <Pressable key={s} onPress={() => setFilter(s)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}>
                <Text style={{ color: on ? p.bg : p.fg, fontSize: 12, fontWeight: '600' }}>{s}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={p.fg} />}>
          {q.isLoading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <LoadingPulse size={56} icon="arrow-up-circle-outline" label="Loading withdrawals…" />
            </View>
          ) : withdrawals.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="file-tray-outline" size={42} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10, fontSize: 13 }}>No {filter.toLowerCase()} withdrawals</Text>
            </View>
          ) : (
            withdrawals.map((w: any) => (
              <View key={w.id} style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: p.pillBg }}>
                    <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '600' }}>{w.paymentMethod ?? w.network ?? w.currency}</Text>
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(w.createdAt)}</Text>
                  <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>
                    {Number(w.amount).toLocaleString('en-US', { maximumFractionDigits: 8 })} {w.currency}
                  </Text>
                </View>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', marginTop: 8 }}>
                  {w.user?.firstName} {w.user?.lastName}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 12 }}>{w.user?.email}</Text>
                {w.walletAddress && (
                  <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                    To: {w.walletAddress} ({w.network})
                  </Text>
                )}
                {w.bankName && (
                  <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                    Bank: {w.bankName} · {w.accountNumber}
                  </Text>
                )}
                {filter === 'PENDING' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Pressable
                      onPress={() => Alert.alert('Process withdrawal?', `Mark ${w.amount} ${w.currency} as processed for ${w.user?.email}?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Process', onPress: () => processMut.mutate(w.id) },
                      ])}
                      style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Mark Processed</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setRejecting(w); setReason(''); }}
                      style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)' }}
                    >
                      <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>Reject</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>

        <Modal visible={!!rejecting} transparent animationType="slide" onRequestClose={() => setRejecting(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
              <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 14 }}>Reject Withdrawal</Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 18 }}>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason (the user will see this)"
                  placeholderTextColor={p.fgFaint}
                  multiline
                  numberOfLines={3}
                  style={{ color: p.fg, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => setRejecting(null)} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => rejecting && reason.trim() && rejectMut.mutate({ id: rejecting.id, reason: reason.trim() })}
                  disabled={!reason.trim() || rejectMut.isPending}
                  style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: reason.trim() ? '#ef4444' : p.bgElev, alignItems: 'center', justifyContent: 'center', opacity: reason.trim() ? 1 : 0.6 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{rejectMut.isPending ? 'Rejecting…' : 'Reject'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function DeniedView({ p, themeMode, onBack }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Ionicons name="lock-closed-outline" size={48} color={p.fgFaint} />
      <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 14 }}>Admin only</Text>
      <Pressable onPress={onBack} style={{ marginTop: 24, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
        <Text style={{ color: p.fg, fontWeight: '700' }}>Back</Text>
      </Pressable>
    </View>
  );
}
