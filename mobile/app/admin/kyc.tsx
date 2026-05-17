/**
 * Admin KYC queue — review pending identity verifications, approve
 * or reject with a reason. Server hooks updates the user's
 * kycStatus + kycTier and emits notifications.
 */

import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
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

export default function AdminKYC() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: ['admin-kyc'],
    queryFn: () => adminService.kyc(),
    enabled: isAdmin,
    refetchInterval: 20_000,
  });

  const approveMut = useMutation({
    mutationFn: adminService.approveKYC,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-kyc'] }),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminService.rejectKYC(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-kyc'] });
      setRejecting(null);
      setReason('');
    },
  });

  const pending = q.data?.pendingKyc ?? [];

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: p.fg }}>Admin only</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>KYC Reviews</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{pending.length}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={p.fg} />}>
          {q.isLoading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <LoadingPulse size={56} icon="document-text-outline" label="Loading KYC queue…" />
            </View>
          ) : pending.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10 }}>Inbox zero on KYC reviews</Text>
            </View>
          ) : (
            pending.map((u: any) => (
              <View key={u.id} style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: p.fg, fontWeight: '800', fontSize: 14 }}>
                      {(u.firstName?.[0] ?? u.email?.[0]).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{u.firstName} {u.lastName}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12 }}>{u.email}</Text>
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(u.createdAt ?? Date.now())}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => Alert.alert('Approve KYC?', `Approve identity verification for ${u.email}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Approve', onPress: () => approveMut.mutate(u.id) },
                    ])}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Approve</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setRejecting(u); setReason(''); }}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)' }}
                  >
                    <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 13 }}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <Modal visible={!!rejecting} transparent animationType="slide" onRequestClose={() => setRejecting(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
              <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', marginBottom: 14 }}>Reject KYC</Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 18 }}>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason (e.g. document blurry, mismatch)"
                  placeholderTextColor={p.fgFaint}
                  multiline numberOfLines={3}
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
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{rejectMut.isPending ? 'Rejecting…' : 'Reject'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
