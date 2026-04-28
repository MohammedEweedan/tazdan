/**
 * Messages tab — real conversations from /api/messages/conversations.
 *
 *   Header:        title + total-unread pill + compose ("+")
 *   Search bar
 *   Filter chips:  All · Unread · Payments · Support
 *   Conversation rows: avatar, name, last-message preview, relative
 *                      time, unread badge.
 *
 * Live updates arrive via the websocket bridge mounted in the tabs
 * layout; this screen just consumes the React Query cache.
 */

import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useConversations, useHaptics } from '@/hooks';
import type { Conversation } from '@/types/messages';

type Filter = 'ALL' | 'UNREAD' | 'PAYMENTS' | 'SUPPORT';

const BRAND_BLUE = '#0057B8';

export default function Messages() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);

  const { data, isLoading, refetch } = useConversations();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery]   = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const conversations = useMemo<Conversation[]>(() => {
    let list = (data ?? []).slice();
    if (filter === 'UNREAD')   list = list.filter((c) => c.unread > 0);
    if (filter === 'PAYMENTS') list = list.filter((c) => c.lastMessage.type === 'PAYMENT');
    if (filter === 'SUPPORT')  list = list.filter((c) => c.partner.username === 'support');
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => {
        const name = `${c.partner.firstName ?? ''} ${c.partner.lastName ?? ''}`.toLowerCase();
        return name.includes(q)
          || (c.partner.username ?? '').toLowerCase().includes(q)
          || c.lastMessage.content.toLowerCase().includes(q);
      });
    }
    return list;
  }, [data, filter, query]);

  const totalUnread = (data ?? []).reduce((s, c) => s + c.unread, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    h.light();
    try { await refetch(); }
    finally { setRefreshing(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
              Messages
            </Text>
            {totalUnread > 0 && (
              <View style={{
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
                backgroundColor: BRAND_BLUE, minWidth: 22, alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                  {totalUnread}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            hitSlop={6}
            onPress={() => { h.light(); router.push('/messages/new'); }}
            accessibilityLabel="New conversation"
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="create-outline" size={17} color={p.fg} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={{
          marginHorizontal: 24, marginTop: 8,
          height: 44, borderRadius: 14,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 12, gap: 8,
        }}>
          <Ionicons name="search-outline" size={16} color={p.fgMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search conversations"
            placeholderTextColor={p.fgFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '500' }}
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={15} color={p.fgFaint} />
            </Pressable>
          )}
        </View>

        {/* Filter tabs */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 18,
            }}
          >
            {(['ALL', 'UNREAD', 'PAYMENTS', 'SUPPORT'] as Filter[]).map((f) => {
              const active = filter === f;

              return (
                <Pressable
                  key={f}
                  onPress={() => {
                    h.selection();
                    setFilter(f);
                  }}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.75 : 1,
                    paddingVertical: 2,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: active ? '800' : '600',
                      letterSpacing: 0.2,
                      color:
                        themeMode === 'dark'
                          ? active
                            ? '#FFFFFF'
                            : '#8B8B90'
                          : active
                            ? '#000000'
                            : '#666666',
                    }}
                  >
                    {f}
                  </Text>

                  {active && (
                    <View
                      style={{
                        marginTop: 6,
                        height: 2,
                        borderRadius: 2,
                        backgroundColor:
                          themeMode === 'dark' ? '#FFFFFF' : '#000000',
                      }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Conversation list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={p.fg}
              colors={[p.fg]}
              progressBackgroundColor={p.bgElev}
            />
          }
        >
          {isLoading ? (
            <Text style={{ color: p.fgMuted, textAlign: 'center', marginTop: 48, fontSize: 13 }}>
              Loading…
            </Text>
          ) : conversations.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 }}>
              <Ionicons name="chatbubbles-outline" size={36} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 12 }}>
                {query.trim() || filter !== 'ALL' ? 'No conversations match.' : 'No conversations yet.'}
              </Text>
              {!query.trim() && filter === 'ALL' && (
                <Pressable
                  onPress={() => { h.light(); router.push('/messages/new'); }}
                  style={{
                    marginTop: 16, paddingHorizontal: 16, paddingVertical: 10,
                    borderRadius: 22, backgroundColor: BRAND_BLUE,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    Start a chat
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            conversations.map((c) => (
              <Row
                key={c.partner.id}
                conv={c}
                palette={p}
                onPress={() => { h.selection(); router.push(`/messages/${c.partner.id}`); }}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Row ─── */
function Row({
  conv: c, palette: p, onPress,
}: {
  conv: Conversation;
  palette: Palette;
  onPress: () => void;
}) {
  const isSupport = c.partner.username === 'support' || c.partner.role === 'AGENT';
  const fullName = `${c.partner.firstName ?? ''} ${c.partner.lastName ?? ''}`.trim()
    || (c.partner.username ? `@${c.partner.username}` : 'Unknown');
  const previewLine = previewOf(c.lastMessage);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
        backgroundColor: pressed ? p.bgElev : 'transparent',
        gap: 14,
      })}
    >
      <View style={{
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: isSupport ? BRAND_BLUE : '#7c3aed',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {isSupport ? (
          <Ionicons name="headset" size={20} color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
            {(fullName[0] ?? '?').toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: p.fg, fontSize: 15, fontWeight: c.unread > 0 ? '800' : '700',
              letterSpacing: -0.2,
            }}
          >
            {fullName}
          </Text>
          {isSupport && (
            <View style={{
              paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5,
              backgroundColor: BRAND_BLUE,
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>STAFF</Text>
            </View>
          )}
          {c.partner.kycStatus === 'APPROVED' && !isSupport && (
            <Ionicons name="checkmark-circle" size={13} color={BRAND_BLUE} />
          )}
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>
            {relTime(c.lastMessage.createdAt)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <KindGlyph type={c.lastMessage.type} palette={p} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: c.unread > 0 ? p.fg : p.fgMuted,
              fontSize: 13, fontWeight: c.unread > 0 ? '600' : '500',
            }}
          >
            {previewLine}
          </Text>
          {c.unread > 0 && (
            <View style={{
              minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
              backgroundColor: BRAND_BLUE,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                {c.unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function KindGlyph({ type, palette: p }: { type: string; palette: Palette }) {
  const map: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
    PAYMENT:    { name: 'cash-outline',           color: '#10b981' },
    P2P_NOTE:   { name: 'swap-horizontal-outline', color: '#7c3aed' },
    SYSTEM:     { name: 'shield-outline',          color: p.fgMuted as string },
    ESCALATION: { name: 'alert-circle-outline',    color: '#f59e0b' },
    TEXT:       { name: 'chatbubble-outline',      color: p.fgMuted as string },
  };
  const cfg = map[type] ?? map.TEXT;
  return <Ionicons name={cfg.name} size={11} color={cfg.color} />;
}

function previewOf(m: { type: string; content: string; deletedAt: string | null; metadata: any }): string {
  if (m.deletedAt) return 'Message deleted';
  if (m.type === 'PAYMENT') {
    const amt = m.metadata?.amount;
    const cur = m.metadata?.currency;
    if (amt && cur) return `${formatAmount(amt)} ${cur}${m.content ? ` · ${m.content}` : ''}`;
    return 'Payment';
  }
  if (m.type === 'ESCALATION') return 'Escalation opened';
  if (m.type === 'SYSTEM')     return m.content;
  return m.content;
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(n);
}

/** Format an ISO timestamp as "5m" / "2h" / "Mon" / "Mar 4". */
function relTime(iso: string): string {
  const ms = Date.now() - +new Date(iso);
  const m = Math.round(ms / 60_000);
  if (m < 1)   return 'now';
  if (m < 60)  return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
