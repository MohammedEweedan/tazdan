/**
 * Admin Deposits queue — review pending fiat / crypto deposits and
 * confirm or reject them. Confirmations credit the user's wallet
 * server-side; rejections capture a reason that's emailed back.
 */

import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatRelativeTime } from '@/utils/format';

import { useThemedPalette } from '@/store/themeStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { AdminScreen, AdminTabs } from '@/components/admin/AdminScreen';

type DepFilter = 'WAITING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED';

export default function AdminDeposits() {
  const p = useThemedPalette();
  const qc = useQueryClient();

  // Deposits awaiting review are created server-side as WAITING_CONFIRMATION
  // (see deposit.controller). The queue's "Awaiting" tab must query THAT status
  // — filtering by PENDING showed an empty queue while real deposits piled up.
  const [filter, setFilter] = useState<DepFilter>('WAITING_CONFIRMATION');
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: ['admin-deposits', filter],
    queryFn: () => adminService.deposits({ status: filter }),
    refetchInterval: 15_000,
  });

  const confirmMut = useMutation({
    mutationFn: adminService.confirmDeposit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-deposits'] }),
    onError: (e: any) => Alert.alert('Confirm failed', e?.response?.data?.error ?? 'Try again'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminService.rejectDeposit(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-deposits'] });
      setRejecting(null);
      setReason('');
    },
  });

  const deposits = q.data?.deposits ?? [];

  return (
    <AdminScreen
      title="Deposit Queue"
      subtitle={`${deposits.length} ${filter === 'WAITING_CONFIRMATION' ? 'awaiting' : filter.toLowerCase()}`}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={p.fg} />}
    >
      <AdminTabs<DepFilter>
        value={filter}
        onChange={setFilter}
        tabs={[
          { key: 'WAITING_CONFIRMATION', label: 'Awaiting', count: filter === 'WAITING_CONFIRMATION' ? deposits.length : undefined },
          { key: 'CONFIRMED', label: 'Confirmed' },
          { key: 'REJECTED', label: 'Rejected' },
        ]}
      />

      {(() => (
        <>
          {q.isLoading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <LoadingPulse size={56} icon="arrow-down-circle-outline" label="Loading deposits…" />
            </View>
          ) : deposits.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="file-tray-outline" size={42} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10, fontSize: 13 }}>
                No {filter === 'WAITING_CONFIRMATION' ? 'awaiting' : filter.toLowerCase()} deposits
              </Text>
            </View>
          ) : (
            deposits.map((d: any) => (
              <View key={d.id} style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: p.pillBg }}>
                    <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '600' }}>{d.paymentMethod ?? d.currency}</Text>
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(d.createdAt)}</Text>
                  <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>
                    {Number(d.amount).toLocaleString('en-US', { maximumFractionDigits: 8 })} {d.currency}
                  </Text>
                </View>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', marginTop: 8 }}>
                  {d.user?.firstName} {d.user?.lastName}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 12 }}>{d.user?.email}</Text>
                {d.reference && (
                  <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 4 }}>Ref: {d.reference}</Text>
                )}
                {filter === 'WAITING_CONFIRMATION' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Pressable
                      onPress={() => Alert.alert('Confirm deposit?', `Credit ${d.user?.email}'s wallet with ${d.amount} ${d.currency}?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Confirm', onPress: () => confirmMut.mutate(d.id) },
                      ])}
                      style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Confirm</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setRejecting(d); setReason(''); }}
                      style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)' }}
                    >
                      <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>Reject</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </>
      ))()}

      <Modal visible={!!rejecting} transparent animationType="slide" onRequestClose={() => setRejecting(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
              <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 14 }}>Reject Deposit</Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 18 }}>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason (visible to user)"
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
    </AdminScreen>
  );
}
