/**
 * Admin Users — searchable user directory with freeze/unfreeze
 * controls, KYC status, and direct DM. Freezing a user marks their
 * account SUSPENDED and locks every wallet's full balance as frozen
 * so they can't withdraw or trade until unfrozen.
 */

import { useState } from 'react';
import {
  Alert, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';

type Filter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_KYC';

export default function AdminUsers() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [freezing, setFreezing] = useState<any | null>(null);
  const [reason, setReason] = useState('');

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

  const freezeMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => adminService.freezeUser(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setFreezing(null); setReason(''); },
    onError: (e: any) => Alert.alert('Freeze failed', e?.response?.data?.error ?? 'Try again'),
  });
  const unfreezeMut = useMutation({
    mutationFn: (id: string) => adminService.unfreezeUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users = q.data?.users ?? [];

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
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>Users</Text>
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
                <Text style={{ color: on ? p.bg : p.fg, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>{f.replace('_', ' ')}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={p.fg} />}>
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
                onFreeze={() => { setFreezing(u); setReason(''); }}
                onUnfreeze={() => Alert.alert('Unfreeze user?', `Restore ${u.email} to ACTIVE? Their wallets will be unlocked.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unfreeze', onPress: () => unfreezeMut.mutate(u.id) },
                ])}
              />
            ))
          )}
        </ScrollView>

        {/* Freeze modal */}
        <Modal visible={!!freezing} transparent animationType="slide" onRequestClose={() => setFreezing(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
              <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>
                Freeze {freezing?.email}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 16 }}>
                Suspends the account and locks all wallet balances. The user gets a notification.
              </Text>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 }}>REASON (sent to user)</Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 18 }}>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Suspicious activity pending review"
                  placeholderTextColor={p.fgFaint}
                  multiline numberOfLines={3}
                  style={{ color: p.fg, fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => setFreezing(null)} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => freezing && freezeMut.mutate({ id: freezing.id, reason: reason.trim() || undefined })}
                  disabled={freezeMut.isPending}
                  style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{freezeMut.isPending ? 'Freezing…' : 'Freeze'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function UserCard({ u, p, onMessage, onFreeze, onUnfreeze }: any) {
  const frozen = u.status === 'SUSPENDED' || u.status === 'BANNED';
  return (
    <View style={{
      backgroundColor: p.bgElev, borderRadius: 14,
      borderWidth: 1, borderColor: frozen ? 'rgba(239,68,68,0.30)' : p.border,
      padding: 14, marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center', borderWidth: frozen ? 1 : 0, borderColor: '#ef4444' }}>
          <Text style={{ color: p.fg, fontWeight: '800', fontSize: 15 }}>{(u.firstName?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {u.firstName} {u.lastName}{u.username ? ` · @${u.username}` : ''}
            </Text>
            {frozen && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(239,68,68,0.15)' }}>
                <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>FROZEN</Text>
              </View>
            )}
            {u.role === 'ADMIN' && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(74,143,224,0.15)' }}>
                <Text style={{ color: '#4a8fe0', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>ADMIN</Text>
              </View>
            )}
          </View>
          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{u.email}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            <Mini label={`KYC ${u.kycStatus ?? '—'}`} active={u.kycStatus === 'APPROVED'} p={p} />
            <Mini label={`STATUS ${u.status ?? 'ACTIVE'}`} active={u.status === 'ACTIVE'} p={p} />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable onPress={onMessage} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
          <Ionicons name="chatbubble-outline" size={13} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>Message</Text>
        </Pressable>
        {frozen ? (
          <Pressable onPress={onUnfreeze} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            <Ionicons name="play-circle-outline" size={13} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Unfreeze</Text>
          </Pressable>
        ) : u.role !== 'ADMIN' ? (
          <Pressable onPress={onFreeze} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
            <Ionicons name="snow-outline" size={13} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>Freeze</Text>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
    </View>
  );
}

function Mini({ label, active, p }: { label: string; active: boolean; p: any }) {
  return (
    <View style={{
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
      backgroundColor: active ? 'rgba(34,197,94,0.12)' : p.pillBg,
    }}>
      <Text style={{ color: active ? '#22c55e' : p.fgFaint, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}
