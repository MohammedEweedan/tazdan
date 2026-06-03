/**
 * Admin Escalations — list of all support escalations raised from
 * P2P trades or direct user reports. Admins can assign themselves,
 * post resolution notes, jump into the linked thread, or freeze the
 * trade. Mirrors Binance's dispute console.
 */

import { useMemo, useState } from 'react';
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

type Status = 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'CLOSED';

export default function AdminEscalations() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [filter, setFilter] = useState<Status | 'ALL'>('OPEN');
  const [resolving, setResolving] = useState<any | null>(null);
  const [note, setNote] = useState('');

  const q = useQuery<{ escalations: any[]; summary: any }>({
    queryKey: ['admin-escalations', filter],
    queryFn: async () => {
      const { data } = await (await import('@/lib/api')).api.get('/admin/escalations', {
        params: filter === 'ALL' ? {} : { status: filter },
      });
      return data;
    },
    enabled: isAdmin,
    refetchInterval: 20_000,
  });

  const assignMut = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await (await import('@/lib/api')).api.put(`/admin/escalations/${id}/assign`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-escalations'] }),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote: string }) =>
      adminService.resolveEscalation(id, { resolutionNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-escalations'] });
      setResolving(null);
      setNote('');
    },
  });

  const escalations = q.data?.escalations ?? [];
  const summary = q.data?.summary ?? { open: 0, assigned: 0, resolved: 0 };

  if (!isAdmin) {
    return <DeniedView p={p} themeMode={themeMode} onBack={() => router.back()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>Escalations</Text>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
              {summary.open} OPEN · {summary.assigned} ASSIGNED · {summary.resolved} RESOLVED
            </Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}
        >
          {(['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED', 'ALL'] as const).map((s) => {
            const on = filter === s;
            return (
              <Pressable
                key={s}
                onPress={() => setFilter(s)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                  backgroundColor: on ? p.accent : p.pillBg,
                  borderWidth: 1, borderColor: on ? p.accent : p.border,
                }}
              >
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600' }}>{s}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={p.fg} />}
        >
          {q.isLoading && !q.data ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <LoadingPulse size={56} icon="warning-outline" label="Loading escalations…" />
            </View>
          ) : escalations.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10, fontSize: 14, fontWeight: '600' }}>
                No {filter !== 'ALL' ? filter.toLowerCase() : ''} escalations
              </Text>
            </View>
          ) : (
            escalations.map((e: any) => (
              <EscalationCard
                key={e.id}
                escalation={e}
                p={p}
                meId={user?.id}
                onAssign={() => assignMut.mutate(e.id)}
                onResolve={() => setResolving(e)}
                onView={() => router.push(`/messages/${e.raisedById}` as any)}
              />
            ))
          )}
        </ScrollView>

        {/* Resolve modal */}
        <Modal visible={!!resolving} animationType="slide" transparent onRequestClose={() => setResolving(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
              <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 6 }}>
                Resolve Escalation
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 16 }}>
                {resolving?.reason}
              </Text>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>
                RESOLUTION NOTE
              </Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 18 }}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Outcome, refund, fault…"
                  placeholderTextColor={p.fgFaint}
                  multiline
                  numberOfLines={4}
                  style={{ color: p.fg, fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setResolving(null)}
                  style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => resolveMut.mutate({ id: resolving.id, resolutionNote: note.trim() || 'Resolved' })}
                  disabled={resolveMut.isPending}
                  style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.ctaBg, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: p.ctaFg, fontWeight: '600' }}>
                    {resolveMut.isPending ? 'Resolving…' : 'Resolve'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function EscalationCard({ escalation: e, p, meId, onAssign, onResolve, onView }: any) {
  const status = e.status as Status;
  const isMine = e.assignedAgentId === meId;
  const isOpen = status === 'OPEN';
  const isResolved = status === 'RESOLVED' || status === 'CLOSED';

  const statusColors: Record<string, { bg: string; fg: string }> = {
    OPEN:     { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
    ASSIGNED: { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b' },
    RESOLVED: { bg: 'rgba(34,197,94,0.15)',  fg: '#22c55e' },
    CLOSED:   { bg: p.pillBg,                fg: p.fgMuted },
  };
  const sc = statusColors[status] ?? statusColors.CLOSED;

  return (
    <View style={{
      backgroundColor: p.bgElev,
      borderRadius: 14, borderWidth: 1, borderColor: p.border,
      padding: 14, marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: sc.bg }}>
          <Text style={{ color: sc.fg, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 }}>{status}</Text>
        </View>
        {e.tradeId && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: p.pillBg }}>
            <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.4 }}>P2P TRADE</Text>
          </View>
        )}
        <Text style={{ color: p.fgFaint, fontSize: 11, marginLeft: 'auto' }}>
          {formatRelativeTime(e.createdAt)}
        </Text>
      </View>

      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
        {e.reason}
      </Text>
      {!!e.details && (
        <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 8 }} numberOfLines={3}>
          {e.details}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: p.border }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '600', letterSpacing: 0.6 }}>RAISED BY</Text>
          <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
            {e.raisedBy?.firstName ?? '—'} {e.raisedBy?.lastName ?? ''}
          </Text>
          <Text style={{ color: p.fgFaint, fontSize: 11 }}>{e.raisedBy?.email}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '600', letterSpacing: 0.6 }}>COUNTERPARTY</Text>
          <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
            {e.counterparty?.firstName ?? '—'} {e.counterparty?.lastName ?? ''}
          </Text>
          <Text style={{ color: p.fgFaint, fontSize: 11 }}>{e.counterparty?.email}</Text>
        </View>
      </View>

      {!!e.trade && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: p.bg, borderWidth: 1, borderColor: p.border }}>
          <Ionicons name="swap-horizontal-outline" size={16} color={p.fgMuted} />
          <Text style={{ flex: 1, color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
            {(e.trade.baseAsset ?? e.trade.currency)} ↔ {(e.trade.fiatAsset ?? e.trade.fiatCurrency)} · {e.trade.amount} · status {e.trade.status}
          </Text>
        </View>
      )}

      {!isResolved && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable
            onPress={onView}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center' }}
          >
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>View Thread</Text>
          </Pressable>
          {status === 'OPEN' && (
            <Pressable
              onPress={onAssign}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.bg, borderWidth: 1, borderColor: p.border, alignItems: 'center' }}
            >
              <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>{isMine ? 'Assigned to me' : 'Assign to me'}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onResolve}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Resolve</Text>
          </Pressable>
        </View>
      )}

      {isResolved && e.resolutionNote && (
        <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.20)' }}>
          <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>RESOLVED</Text>
          <Text style={{ color: p.fg, fontSize: 13, marginTop: 4 }}>{e.resolutionNote}</Text>
        </View>
      )}
    </View>
  );
}

function DeniedView({ p, themeMode, onBack }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <Ionicons name="lock-closed-outline" size={48} color={p.fgFaint} />
      <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 14 }}>Admin access only</Text>
      <Pressable onPress={onBack} style={{ marginTop: 24, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
        <Text style={{ color: p.fg, fontWeight: '700' }}>Back</Text>
      </Pressable>
    </View>
  );
}
