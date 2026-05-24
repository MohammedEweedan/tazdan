/**
 * Groups list — multi-party chats with optional liquidity pools.
 *
 * Header has a "+ New group" button that navigates to /groups/new.
 * Each row shows: avatar, name, last message preview, pool balance
 * (when one exists), member count, unread badge.
 */

import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { brand, useTheme, useThemedPalette } from '@/store/themeStore';
import { useGroups, useGroupRealtime, useHaptics } from '@/hooks';
import { TopGradient } from '@/components/ui/ScreenShell';
import type { GroupChat } from '@/types/groups';

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function lastMessagePreview(g: GroupChat): string {
  const m = g.lastMessage;
  if (!m) return 'No messages yet';
  if (m.deletedAt) return 'Message deleted';
  switch (m.type) {
    case 'IMAGE':         return '📷 Photo';
    case 'POOL_CREATED':  return '💰 Pool created';
    case 'POOL_DEPOSIT':  return '💰 Deposit to pool';
    case 'POOL_WITHDRAW': return '💸 Withdraw from pool';
    case 'POOL_CLOSED':   return '✅ Pool closed';
    default:              return m.content || '—';
  }
}

export default function GroupsList() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;

  const { data, refetch } = useGroups();
  const [refreshing, setRefreshing] = useState(false);

  useGroupRealtime();

  const groups = data ?? [];
  const totalUnread = groups.reduce((s, g) => s + (g.unreadCount ?? 0), 0);

  const onRefresh = async () => {
    setRefreshing(true);
    h.light();
    try { await refetch(); }
    finally { setRefreshing(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 24, paddingTop: 18, paddingBottom: 12,
        }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="chevron-back" size={20} color={p.fg} />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}>
              Groups
            </Text>
            {totalUnread > 0 && (
              <View style={{
                minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7,
                backgroundColor: accent,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => { h.medium(); router.push('/groups/new'); }}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 19,
              overflow: 'hidden',
              opacity: pressed ? 0.85 : 1,
            })}
            accessibilityLabel="New group"
          >
            <LinearGradient
              colors={[brand.primaryDark, brand.deep]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.fg} />}
        >
          {groups.length === 0 ? (
            <View style={{ paddingTop: 80, paddingHorizontal: 32, alignItems: 'center' }}>
              <LinearGradient
                colors={[`${accent}66`, `${accent}1A`, `${accent}00`]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={{
                  width: 84, height: 84, borderRadius: 42,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: p.bg, borderWidth: 1, borderColor: `${accent}55`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="people" size={28} color={accent} />
                </View>
              </LinearGradient>
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', marginTop: 16, letterSpacing: -0.3 }}>
                No groups yet
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
                Start a group chat with friends, or create a shared{'\n'}liquidity pool to save toward something together.
              </Text>
              <Pressable
                onPress={() => { h.medium(); router.push('/groups/new'); }}
                style={({ pressed }) => ({
                  marginTop: 22,
                  borderRadius: 24, overflow: 'hidden',
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
                })}
              >
                <LinearGradient
                  colors={[brand.primaryDark, brand.deep]}
                  start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                  style={{ paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Create a group</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            groups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => { h.selection(); router.push(`/groups/${g.id}`); }}
                style={({ pressed }) => ({
                  paddingHorizontal: 20, paddingVertical: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: pressed ? p.bgElev : 'transparent',
                  borderBottomWidth: 1, borderBottomColor: p.border,
                })}
              >
                {/* Avatar */}
                <View style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: `${accent}1F`,
                  borderWidth: 1, borderColor: `${accent}44`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {g.avatarUrl ? null /* TODO image */ : (
                    <Ionicons name="people" size={22} color={accent} />
                  )}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                      {g.name}
                    </Text>
                    {g.pool && (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 3,
                        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                        backgroundColor: `${accent}1A`,
                        borderWidth: 1, borderColor: `${accent}33`,
                      }}>
                        <Ionicons name="cash-outline" size={9} color={accent} />
                        <Text style={{ color: accent, fontSize: 10, fontWeight: '700' }}>
                          ${Number(g.pool.totalBalanceUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
                    {lastMessagePreview(g)}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>
                    {g.lastMessage ? relTime(g.lastMessage.createdAt) : ''}
                  </Text>
                  {(g.unreadCount ?? 0) > 0 && (
                    <View style={{
                      minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
                      backgroundColor: accent,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>
                        {g.unreadCount! > 99 ? '99+' : g.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
