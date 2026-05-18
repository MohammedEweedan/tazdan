/**
 * Admin Support — find any user, DM them directly, jump into
 * existing threads. Combines a global user search with the admin's
 * own conversation queue (which surfaces every escalation thread
 * they were pulled into).
 */

import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useConversations } from '@/hooks';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { formatRelativeTime } from '@/utils/format';
import { TopGradient } from '@/components/ui/ScreenShell';

export default function AdminSupport() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'CONVERSATIONS' | 'USERS'>('CONVERSATIONS');

  const convQ = useConversations();
  const usersQ = useQuery({
    queryKey: ['admin-user-search', search],
    queryFn: () => adminService.users({ search, limit: 30 }),
    enabled: isAdmin && tab === 'USERS' && search.length >= 2,
  });

  const conversations = convQ.data ?? [];
  const filteredConvs = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c: any) => {
      const p1 = (c.partner?.username ?? '').toLowerCase();
      const p2 = ((c.partner?.firstName ?? '') + ' ' + (c.partner?.lastName ?? '')).toLowerCase();
      const p3 = (c.lastMessage?.content ?? '').toLowerCase();
      return p1.includes(q) || p2.includes(q) || p3.includes(q);
    });
  }, [conversations, search]);

  if (!isAdmin) {
    return <DeniedView p={p} themeMode={themeMode} onBack={() => router.back()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>Support Chats</Text>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
              {conversations.length} ACTIVE
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: p.bgElev, borderRadius: 14,
            borderWidth: 1, borderColor: p.border,
            paddingHorizontal: 14, height: 46,
          }}>
            <Ionicons name="search" size={17} color={p.fgFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={tab === 'CONVERSATIONS' ? 'Search conversations…' : 'Search users by email or name…'}
              placeholderTextColor={p.fgFaint}
              autoCapitalize="none"
              style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '600' }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={p.fgFaint} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: 24, paddingHorizontal: 20, marginTop: 16, borderBottomWidth: 1, borderBottomColor: p.border }}>
          {(['CONVERSATIONS', 'USERS'] as const).map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={{ paddingBottom: 10 }}>
                <Text style={{ color: on ? p.fg : p.fgMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.4 }}>
                  {t}
                </Text>
                {on && <View style={{ marginTop: 6, height: 2, backgroundColor: p.fg, borderRadius: 1 }} />}
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={convQ.isFetching} onRefresh={convQ.refetch} tintColor={p.fg} />}
        >
          {tab === 'CONVERSATIONS' ? (
            convQ.isLoading ? (
              <View style={{ paddingTop: 80, alignItems: 'center' }}>
                <LoadingPulse size={56} icon="chatbubble-ellipses-outline" label="Loading threads…" />
              </View>
            ) : filteredConvs.length === 0 ? (
              <EmptyState p={p} icon="chatbubbles-outline" text={search ? 'No matches' : 'No active conversations'} />
            ) : (
              filteredConvs.map((c: any) => (
                <ConversationRow
                  key={c.partner?.id ?? c.partnerId}
                  partner={c.partner}
                  last={c.lastMessage}
                  unread={c.unread}
                  p={p}
                  onPress={() => router.push(`/messages/${c.partner?.id ?? c.partnerId}` as any)}
                />
              ))
            )
          ) : (
            search.length < 2 ? (
              <EmptyState p={p} icon="search-outline" text="Type at least 2 characters" />
            ) : usersQ.isLoading ? (
              <View style={{ paddingTop: 60, alignItems: 'center' }}>
                <LoadingPulse size={48} icon="person-outline" />
              </View>
            ) : (usersQ.data?.users ?? []).length === 0 ? (
              <EmptyState p={p} icon="person-outline" text="No users match" />
            ) : (
              (usersQ.data?.users ?? []).map((u: any) => (
                <Pressable
                  key={u.id}
                  onPress={() => router.push(`/messages/${u.id}` as any)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: 14, marginBottom: 8,
                    backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: p.fg, fontWeight: '600', fontSize: 14 }}>
                      {(u.firstName?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                      {u.firstName} {u.lastName}{u.username ? ` · @${u.username}` : ''}
                    </Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12 }}>{u.email}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {u.kycStatus === 'APPROVED' && (
                      <Ionicons name="shield-checkmark" size={14} color={p.greenFg} />
                    )}
                    <Ionicons name="chatbubble-outline" size={16} color={p.fgMuted} />
                  </View>
                </Pressable>
              ))
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ConversationRow({ partner, last, unread, p, onPress }: any) {
  const initial = (partner?.firstName?.[0] ?? partner?.username?.[0] ?? '?').toUpperCase();
  const escalation = last?.type === 'ESCALATION' || last?.metadata?.escalationId;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 14, borderRadius: 14, marginBottom: 8,
        backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: p.fg, fontWeight: '600', fontSize: 14 }}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            {partner?.firstName} {partner?.lastName}
            {partner?.username && <Text style={{ color: p.fgFaint, fontWeight: '500' }}> @{partner.username}</Text>}
          </Text>
          {escalation && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(239,68,68,0.15)' }}>
              <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '600', letterSpacing: 0.4 }}>ESC</Text>
            </View>
          )}
        </View>
        <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {last?.content ?? '—'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10 }}>{last && formatRelativeTime(last.createdAt)}</Text>
        {unread > 0 && (
          <View style={{ minWidth: 20, paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{unread}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function EmptyState({ p, icon, text }: { p: any; icon: any; text: string }) {
  return (
    <View style={{ paddingVertical: 56, alignItems: 'center' }}>
      <Ionicons name={icon} size={42} color={p.fgFaint} />
      <Text style={{ color: p.fgMuted, marginTop: 10, fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

function DeniedView({ p, themeMode, onBack }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Ionicons name="lock-closed-outline" size={48} color={p.fgFaint} />
      <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 14 }}>Admin access only</Text>
      <Pressable onPress={onBack} style={{ marginTop: 24, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
        <Text style={{ color: p.fg, fontWeight: '700' }}>Back</Text>
      </Pressable>
    </View>
  );
}
