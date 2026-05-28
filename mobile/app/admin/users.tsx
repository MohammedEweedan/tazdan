/**
 * Admin Users — searchable user directory with:
 *  - freeze / unfreeze controls
 *  - KYC override (approve / reject)
 *  - Manual wallet credit
 *  - Change status (ACTIVE / SUSPENDED / BANNED)
 *  - Direct DM
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
import { TopGradient } from '@/components/ui/ScreenShell';

type Filter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_KYC';
type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';
type ModalKind = 'freeze' | 'kyc' | 'credit' | 'status' | null;

const CURRENCIES = ['USD', 'USDT', 'BTC', 'ETH', 'EUR', 'GBP'];

function kycColor(s: string | undefined) {
  if (s === 'APPROVED') return '#22c55e';
  if (s === 'REJECTED') return '#ef4444';
  if (s === 'PENDING')  return '#f59e0b';
  return '#6b7280';
}
function kycBg(s: string | undefined) {
  if (s === 'APPROVED') return 'rgba(34,197,94,0.12)';
  if (s === 'REJECTED') return 'rgba(239,68,68,0.12)';
  if (s === 'PENDING')  return 'rgba(245,158,11,0.12)';
  return 'rgba(107,114,128,0.12)';
}

export default function AdminUsers() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  // Active action target
  const [actionUser, setActionUser] = useState<any | null>(null);
  const [modalKind, setModalKind] = useState<ModalKind>(null);

  // Freeze sheet
  const [freezeReason, setFreezeReason] = useState('');

  // KYC sheet
  const [kycAction, setKycAction] = useState<'approve' | 'reject'>('approve');
  const [kycReason, setKycReason] = useState('');

  // Credit sheet
  const [creditCurrency, setCreditCurrency] = useState('USDT');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');

  // Status sheet
  const [newStatus, setNewStatus] = useState<UserStatus>('ACTIVE');

  const params = (() => {
    const out: any = { limit: 100 };
    if (search) out.search = search;
    if (filter === 'ACTIVE')      out.status = 'ACTIVE';
    if (filter === 'SUSPENDED')   out.status = 'SUSPENDED';
    if (filter === 'PENDING_KYC') out.kycStatus = 'PENDING';
    return out;
  })();

  const q = useQuery({
    queryKey: ['admin-users', search, filter],
    queryFn: () => adminService.users(params),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const openModal = (u: any, kind: ModalKind) => {
    setActionUser(u);
    setModalKind(kind);
    setFreezeReason('');
    setKycAction('approve');
    setKycReason('');
    setCreditCurrency('USDT');
    setCreditAmount('');
    setCreditNote('');
    setNewStatus(u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED');
  };

  const closeModal = () => { setActionUser(null); setModalKind(null); };

  const freezeMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => adminService.freezeUser(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Freeze failed', e?.response?.data?.error ?? 'Try again'),
  });

  const unfreezeMut = useMutation({
    mutationFn: (id: string) => adminService.unfreezeUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (e: any) => Alert.alert('Unfreeze failed', e?.response?.data?.error ?? 'Try again'),
  });

  const kycMut = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      action === 'approve'
        ? adminService.approveKYC(id)
        : adminService.rejectKYC(id, reason ?? 'Admin override'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); closeModal(); },
    onError: (e: any) => Alert.alert('KYC action failed', e?.response?.data?.error ?? 'Try again'),
  });

  const creditMut = useMutation({
    mutationFn: ({ userId, currency, amount, note }: { userId: string; currency: string; amount: number; note?: string }) =>
      adminService.manualCredit({ userId, currency, amount, note }),
    onSuccess: (res: any) => {
      Alert.alert('Credit applied', `${res.amount} ${res.currency} credited. Ref: ${res.reference}`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      closeModal();
    },
    onError: (e: any) => Alert.alert('Credit failed', e?.response?.data?.error ?? 'Try again'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => adminService.updateUserStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Status update failed', e?.response?.data?.error ?? 'Try again'),
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>Users</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? users.length}</Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 44 }}>
            <Ionicons name="search" size={15} color={p.fgFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Email, name, or username"
              placeholderTextColor={p.fgFaint}
              autoCapitalize="none"
              style={{ flex: 1, color: p.fg, fontSize: 13, fontWeight: '600' }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <Ionicons name="close-circle" size={15} color={p.fgFaint} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginTop: 10, paddingVertical: 4 }}>
          {(['ALL', 'ACTIVE', 'SUSPENDED', 'PENDING_KYC'] as Filter[]).map((f) => {
            const on = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}
              >
                <Text style={{ color: on ? p.bg : p.fg, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>{f.replace('_', ' ')}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
        >
          {q.isLoading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}><LoadingPulse size={56} icon="people-outline" label="Loading users…" /></View>
          ) : users.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={42} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10 }}>No users match</Text>
            </View>
          ) : (
            users.map((u: any) => (
              <UserCard
                key={u.id}
                u={u}
                p={p}
                onMessage={() => router.push(`/messages/${u.id}` as any)}
                onFreeze={() => openModal(u, 'freeze')}
                onUnfreeze={() => Alert.alert('Unfreeze user?', `Restore ${u.email} to ACTIVE? Their wallets will be unlocked.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unfreeze', onPress: () => unfreezeMut.mutate(u.id) },
                ])}
                onKyc={() => openModal(u, 'kyc')}
                onCredit={() => openModal(u, 'credit')}
                onStatus={() => openModal(u, 'status')}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── FREEZE MODAL ─────────────────────────────── */}
      <Modal visible={modalKind === 'freeze'} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 6 }}>
              Freeze {actionUser?.email}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 16 }}>
              Suspends the account and locks all wallet balances.
            </Text>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>REASON (sent to user)</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 18 }}>
              <TextInput
                value={freezeReason}
                onChangeText={setFreezeReason}
                placeholder="e.g. Suspicious activity pending review"
                placeholderTextColor={p.fgFaint}
                multiline
                numberOfLines={3}
                style={{ color: p.fg, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={closeModal} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => actionUser && freezeMut.mutate({ id: actionUser.id, reason: freezeReason.trim() || undefined })}
                disabled={freezeMut.isPending}
                style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{freezeMut.isPending ? 'Freezing…' : 'Freeze'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── KYC OVERRIDE MODAL ───────────────────────── */}
      <Modal visible={modalKind === 'kyc'} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 14 }}>KYC Override — {actionUser?.email}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {(['approve', 'reject'] as const).map((a) => {
                const on = kycAction === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setKycAction(a)}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center',
                      backgroundColor: on ? (a === 'approve' ? '#22c55e' : '#ef4444') : p.bgElev,
                      borderWidth: 1,
                      borderColor: on ? (a === 'approve' ? '#22c55e' : '#ef4444') : p.border,
                    }}
                  >
                    <Text style={{ color: on ? '#fff' : p.fgMuted, fontSize: 13, fontWeight: '600' }}>
                      {a === 'approve' ? 'Approve KYC' : 'Reject KYC'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {kycAction === 'reject' && (
              <>
                <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>REASON</Text>
                <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 16 }}>
                  <TextInput
                    value={kycReason}
                    onChangeText={setKycReason}
                    placeholder="Reason for rejection"
                    placeholderTextColor={p.fgFaint}
                    multiline
                    numberOfLines={3}
                    style={{ color: p.fg, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
                  />
                </View>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={closeModal} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={kycMut.isPending || (kycAction === 'reject' && !kycReason.trim())}
                onPress={() => actionUser && kycMut.mutate({ id: actionUser.id, action: kycAction, reason: kycReason.trim() || undefined })}
                style={{
                  flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: kycAction === 'approve' ? '#22c55e' : '#ef4444',
                  opacity: kycMut.isPending ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{kycMut.isPending ? 'Processing…' : 'Confirm'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CREDIT WALLET MODAL ──────────────────────── */}
      <Modal visible={modalKind === 'credit'} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 14 }}>Credit Wallet — {actionUser?.email}</Text>

            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>CURRENCY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
              {CURRENCIES.map((c) => {
                const on = creditCurrency === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCreditCurrency(c)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}
                  >
                    <Text style={{ color: on ? p.bg : p.fg, fontSize: 12, fontWeight: '600' }}>{c}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>AMOUNT</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 46, justifyContent: 'center', marginBottom: 14 }}>
              <TextInput
                value={creditAmount}
                onChangeText={setCreditAmount}
                placeholder="0.00"
                placeholderTextColor={p.fgFaint}
                keyboardType="decimal-pad"
                style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}
              />
            </View>

            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>NOTE (optional)</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 46, justifyContent: 'center', marginBottom: 18 }}>
              <TextInput
                value={creditNote}
                onChangeText={setCreditNote}
                placeholder="e.g. Compensation for service issue"
                placeholderTextColor={p.fgFaint}
                style={{ color: p.fg, fontSize: 13 }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={closeModal} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={creditMut.isPending || !creditAmount || parseFloat(creditAmount) <= 0}
                onPress={() => {
                  const amt = parseFloat(creditAmount);
                  if (!amt || amt <= 0) { Alert.alert('Invalid amount'); return; }
                  actionUser && creditMut.mutate({ userId: actionUser.id, currency: creditCurrency, amount: amt, note: creditNote.trim() || undefined });
                }}
                style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', opacity: creditMut.isPending ? 0.6 : 1 }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {creditMut.isPending ? 'Crediting…' : `Credit ${creditCurrency}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CHANGE STATUS MODAL ──────────────────────── */}
      <Modal visible={modalKind === 'status'} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 6 }}>Change Status</Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 16 }}>{actionUser?.email}</Text>
            {(['ACTIVE', 'SUSPENDED', 'BANNED'] as UserStatus[]).map((s) => {
              const on = newStatus === s;
              const col = s === 'ACTIVE' ? '#22c55e' : s === 'SUSPENDED' ? '#f59e0b' : '#ef4444';
              return (
                <Pressable
                  key={s}
                  onPress={() => setNewStatus(s)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingVertical: 14, paddingHorizontal: 14,
                    borderRadius: 12, marginBottom: 8,
                    backgroundColor: on ? `${col}18` : p.bgElev,
                    borderWidth: 1, borderColor: on ? col : p.border,
                  }}
                >
                  <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: on ? col : p.border, backgroundColor: on ? col : 'transparent' }} />
                  <Text style={{ color: on ? col : p.fg, fontSize: 14, fontWeight: '600' }}>{s}</Text>
                </Pressable>
              );
            })}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable onPress={closeModal} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={statusMut.isPending}
                onPress={() => actionUser && statusMut.mutate({ id: actionUser.id, status: newStatus })}
                style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.fg, alignItems: 'center', justifyContent: 'center', opacity: statusMut.isPending ? 0.6 : 1 }}
              >
                <Text style={{ color: p.bg, fontWeight: '600' }}>{statusMut.isPending ? 'Updating…' : 'Apply'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function UserCard({ u, p, onMessage, onFreeze, onUnfreeze, onKyc, onCredit, onStatus }: {
  u: any;
  p: any;
  onMessage: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onKyc: () => void;
  onCredit: () => void;
  onStatus: () => void;
}) {
  const frozen = u.status === 'SUSPENDED' || u.status === 'BANNED';
  return (
    <View style={{
      backgroundColor: p.bgElev, borderRadius: 14,
      borderWidth: 1, borderColor: frozen ? 'rgba(239,68,68,0.30)' : p.border,
      padding: 14, marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center', borderWidth: frozen ? 1 : 0, borderColor: '#ef4444' }}>
          <Text style={{ color: p.fg, fontWeight: '600', fontSize: 15 }}>{(u.firstName?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {u.firstName} {u.lastName}{u.username ? ` · @${u.username}` : ''}
            </Text>
            {frozen && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(239,68,68,0.15)' }}>
                <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>FROZEN</Text>
              </View>
            )}
            {u.role === 'ADMIN' && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(74,143,224,0.15)' }}>
                <Text style={{ color: '#A3A3A3', fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>ADMIN</Text>
              </View>
            )}
          </View>
          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{u.email}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {/* KYC badge */}
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: kycBg(u.kycStatus) }}>
              <Text style={{ color: kycColor(u.kycStatus), fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>KYC {u.kycStatus ?? 'NONE'}</Text>
            </View>
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: u.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : p.pillBg }}>
              <Text style={{ color: u.status === 'ACTIVE' ? '#22c55e' : p.fgFaint, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>{u.status ?? 'ACTIVE'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Row 1: Message + Freeze/Unfreeze */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable onPress={onMessage} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
          <Ionicons name="chatbubble-outline" size={13} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>Message</Text>
        </Pressable>
        {frozen ? (
          <Pressable onPress={onUnfreeze} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            <Ionicons name="play-circle-outline" size={13} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Unfreeze</Text>
          </Pressable>
        ) : u.role !== 'ADMIN' ? (
          <Pressable onPress={onFreeze} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            <Ionicons name="snow-outline" size={13} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Freeze</Text>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      {/* Row 2: KYC Override + Credit Wallet */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable onPress={onKyc} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
          <Ionicons name="shield-checkmark-outline" size={13} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>KYC</Text>
        </Pressable>
        <Pressable onPress={onCredit} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
          <Ionicons name="wallet-outline" size={13} color="#22c55e" />
          <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '600' }}>Credit</Text>
        </Pressable>
        <Pressable onPress={onStatus} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
          <Ionicons name="options-outline" size={13} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>Status</Text>
        </Pressable>
      </View>
    </View>
  );
}
