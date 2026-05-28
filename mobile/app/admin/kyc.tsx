/**
 * Admin KYC — full status management with filter tabs, document viewer,
 * approve/reject/revoke actions and manual override sheet.
 *
 * Server returns { users, total, page, totalPages } — not pendingKyc.
 */

import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
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

type KycStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_FILTERS: KycStatus[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

function statusColor(s: string) {
  if (s === 'APPROVED') return '#22c55e';
  if (s === 'REJECTED') return '#ef4444';
  if (s === 'PENDING')  return '#f59e0b';
  return '#6b7280';
}

function statusBg(s: string) {
  if (s === 'APPROVED') return 'rgba(34,197,94,0.12)';
  if (s === 'REJECTED') return 'rgba(239,68,68,0.12)';
  if (s === 'PENDING')  return 'rgba(245,158,11,0.12)';
  return 'rgba(107,114,128,0.12)';
}

export default function AdminKYC() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [filter, setFilter] = useState<KycStatus>('ALL');

  // Reject / revoke sheet
  const [rejectTarget, setRejectTarget] = useState<{ user: any; mode: 'reject' | 'revoke' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Document viewer sheet
  const [docsTarget, setDocsTarget] = useState<any | null>(null);

  // Manual override sheet
  const [overrideTarget, setOverrideTarget] = useState<any | null>(null);
  const [overrideAction, setOverrideAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [overrideReason, setOverrideReason] = useState('');

  const queryKey = ['admin-kyc', filter];

  const q = useQuery({
    queryKey,
    queryFn: () => adminService.kyc(filter === 'ALL' ? {} : { status: filter }),
    enabled: isAdmin,
    refetchInterval: 20_000,
  });

  const approveMut = useMutation({
    mutationFn: (userId: string) => adminService.approveKYC(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-kyc'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminService.rejectKYC(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-kyc'] });
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Failed'),
  });

  const overrideMut = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      action === 'APPROVED'
        ? adminService.approveKYC(id)
        : adminService.rejectKYC(id, reason ?? 'Manual override'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-kyc'] });
      setOverrideTarget(null);
      setOverrideReason('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Failed'),
  });

  const users: any[] = q.data?.users ?? [];

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <TopGradient />
        <Text style={{ color: p.fg }}>Admin only</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>KYC Reviews</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? users.length}</Text>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 10, paddingVertical: 2 }}>
          {STATUS_FILTERS.map((f) => {
            const on = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}
              >
                <Text style={{ color: on ? p.bg : p.fg, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
        >
          {q.isLoading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <LoadingPulse size={56} icon="document-text-outline" label="Loading KYC queue…" />
            </View>
          ) : users.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10 }}>No users match this filter</Text>
            </View>
          ) : (
            users.map((u: any) => (
              <KycCard
                key={u.id}
                u={u}
                p={p}
                onApprove={() => Alert.alert('Approve KYC?', `Approve for ${u.email}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Approve', onPress: () => approveMut.mutate(u.id) },
                ])}
                onReject={() => { setRejectTarget({ user: u, mode: 'reject' }); setRejectReason(''); }}
                onRevoke={() => { setRejectTarget({ user: u, mode: 'revoke' }); setRejectReason(''); }}
                onViewDocs={() => setDocsTarget(u)}
                onOverride={() => { setOverrideTarget(u); setOverrideAction('APPROVED'); setOverrideReason(''); }}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Reject / Revoke sheet */}
      <Modal visible={!!rejectTarget} transparent animationType="slide" onRequestClose={() => setRejectTarget(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 6 }}>
              {rejectTarget?.mode === 'revoke' ? 'Revoke KYC Approval' : 'Reject KYC'}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 14 }}>
              {rejectTarget?.mode === 'revoke'
                ? `This will move ${rejectTarget?.user?.email} back to REJECTED.`
                : `Provide a reason that will be sent to ${rejectTarget?.user?.email}.`}
            </Text>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>REASON</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 18 }}>
              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="e.g. Document blurry, information mismatch"
                placeholderTextColor={p.fgFaint}
                multiline
                numberOfLines={3}
                style={{ color: p.fg, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setRejectTarget(null)}
                style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!rejectReason.trim() || rejectMut.isPending}
                onPress={() => rejectTarget && rejectMut.mutate({ id: rejectTarget.user.id, reason: rejectReason.trim() })}
                style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: rejectReason.trim() ? '#ef4444' : p.bgElev, alignItems: 'center', justifyContent: 'center', opacity: rejectReason.trim() ? 1 : 0.5 }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {rejectMut.isPending ? 'Processing…' : rejectTarget?.mode === 'revoke' ? 'Revoke' : 'Reject'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Document viewer */}
      <Modal visible={!!docsTarget} transparent animationType="slide" onRequestClose={() => setDocsTarget(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '75%' }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 14 }}>
              Documents — {docsTarget?.firstName} {docsTarget?.lastName}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(!docsTarget?.kycDocuments || docsTarget.kycDocuments.length === 0) ? (
                <Text style={{ color: p.fgMuted, textAlign: 'center', paddingVertical: 20 }}>No documents uploaded</Text>
              ) : (
                docsTarget.kycDocuments.map((doc: any, i: number) => (
                  <Pressable
                    key={doc.id ?? i}
                    onPress={() => doc.url && Linking.openURL(doc.url)}
                    style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <Ionicons name="document-text-outline" size={20} color={p.fgMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{doc.type ?? doc.documentType ?? 'Document'}</Text>
                      {doc.url && <Text style={{ color: '#A3A3A3', fontSize: 11, marginTop: 2 }} numberOfLines={1}>{doc.url}</Text>}
                      {doc.status && (
                        <View style={{ marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: statusBg(doc.status) }}>
                          <Text style={{ color: statusColor(doc.status), fontSize: 9, fontWeight: '700' }}>{doc.status}</Text>
                        </View>
                      )}
                    </View>
                    {doc.url && <Ionicons name="open-outline" size={14} color={p.fgFaint} />}
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable
              onPress={() => setDocsTarget(null)}
              style={{ marginTop: 14, height: 48, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: p.fg, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Manual override sheet */}
      <Modal visible={!!overrideTarget} transparent animationType="slide" onRequestClose={() => setOverrideTarget(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 14 }}>Manual KYC Override</Text>

            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>ACTION</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {(['APPROVED', 'REJECTED'] as const).map((a) => {
                const on = overrideAction === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setOverrideAction(a)}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
                      backgroundColor: on
                        ? (a === 'APPROVED' ? '#22c55e' : '#ef4444')
                        : p.bgElev,
                      borderWidth: 1,
                      borderColor: on
                        ? (a === 'APPROVED' ? '#22c55e' : '#ef4444')
                        : p.border,
                    }}
                  >
                    <Text style={{ color: on ? '#fff' : p.fgMuted, fontSize: 13, fontWeight: '600' }}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>

            {overrideAction === 'REJECTED' && (
              <>
                <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>REASON</Text>
                <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 16 }}>
                  <TextInput
                    value={overrideReason}
                    onChangeText={setOverrideReason}
                    placeholder="Reason for override rejection"
                    placeholderTextColor={p.fgFaint}
                    multiline
                    numberOfLines={3}
                    style={{ color: p.fg, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
                  />
                </View>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setOverrideTarget(null)}
                style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={overrideMut.isPending || (overrideAction === 'REJECTED' && !overrideReason.trim())}
                onPress={() => overrideTarget && overrideMut.mutate({ id: overrideTarget.id, action: overrideAction, reason: overrideReason.trim() || undefined })}
                style={{
                  flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: overrideAction === 'APPROVED' ? '#22c55e' : '#ef4444',
                  opacity: overrideMut.isPending ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {overrideMut.isPending ? 'Processing…' : 'Confirm Override'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function KycCard({ u, p, onApprove, onReject, onRevoke, onViewDocs, onOverride }: {
  u: any;
  p: any;
  onApprove: () => void;
  onReject: () => void;
  onRevoke: () => void;
  onViewDocs: () => void;
  onOverride: () => void;
}) {
  const ks = u.kycStatus ?? 'PENDING';
  const docCount = u.kycDocuments?.length ?? 0;

  return (
    <View style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 10 }}>
      {/* User info row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: p.fg, fontWeight: '600', fontSize: 14 }}>
            {(u.firstName?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {u.firstName} {u.lastName}
            </Text>
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: statusBg(ks) }}>
              <Text style={{ color: statusColor(ks), fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>{ks}</Text>
            </View>
          </View>
          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{u.email}</Text>
          <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 2 }}>
            {docCount} document{docCount !== 1 ? 's' : ''} · {formatRelativeTime(u.createdAt)}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={{ marginTop: 12, gap: 8 }}>
        {/* Row 1: primary actions based on status */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(ks === 'PENDING' || ks === 'REJECTED') && (
            <Pressable
              onPress={onApprove}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Approve</Text>
            </Pressable>
          )}
          {ks === 'PENDING' && (
            <Pressable
              onPress={onReject}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', alignItems: 'center' }}
            >
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Reject</Text>
            </Pressable>
          )}
          {ks === 'APPROVED' && (
            <Pressable
              onPress={onRevoke}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', alignItems: 'center' }}
            >
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Revoke</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onViewDocs}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
          >
            <Ionicons name="documents-outline" size={12} color={p.fg} />
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>View docs</Text>
          </Pressable>
        </View>
        {/* Row 2: override */}
        <Pressable
          onPress={onOverride}
          style={{ paddingVertical: 9, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
        >
          <Ionicons name="shield-outline" size={12} color={p.fgMuted} />
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>Manual Override</Text>
        </Pressable>
      </View>
    </View>
  );
}
