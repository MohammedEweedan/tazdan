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
import { useShallow } from 'zustand/shallow';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useConversations, useHaptics } from '@/hooks';
import { useChatPrefs } from '@/store/chatPrefsStore';
import type { Conversation } from '@/types/messages';
import { TopGradient } from '@/components/ui/ScreenShell';

type Filter = 'ALL' | 'UNREAD' | 'PAYMENTS' | 'SUPPORT';

const BRAND_BLUE = '#737373'; // mono accent neutral

export default function Messages() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const t = useT();

  const { data, isLoading, refetch } = useConversations();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery]   = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Pinned + contacts from the client-persisted chat prefs store.
  // Pin state participates in the sort below so pinned chats float
  // to the top regardless of `lastMessage.createdAt`.
  const pinnedSet  = useChatPrefs((s) => s.pinnedPartners);
  const togglePin  = useChatPrefs((s) => s.togglePin);
  const contacts   = useChatPrefs(useShallow((s) => s.contactList()));
  const addContact = useChatPrefs((s) => s.addContact);

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
    // Pinned chats float to the top, retaining their relative recency
    // order.  Everything else keeps the original API order (which is
    // already recency-sorted server-side).
    list.sort((a, b) => {
      const ap = pinnedSet.has(a.partner.id) ? 1 : 0;
      const bp = pinnedSet.has(b.partner.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return +new Date(b.lastMessage.createdAt) - +new Date(a.lastMessage.createdAt);
    });
    return list;
  }, [data, filter, query, pinnedSet]);

  const onLongPressConv = (c: Conversation) => {
    h.medium();
    const isPinned   = pinnedSet.has(c.partner.id);
    const isContact  = contacts.some((k) => k.id === c.partner.id);
    const pinLabel   = isPinned    ? t('chat.unpin')         : t('chat.pin');
    const contactLbl = isContact   ? t('chat.removeContact') : t('chat.addContact');
    const opts = [pinLabel, contactLbl, t('common.cancel') || 'Cancel'];
    const run = async (idx: number) => {
      if (idx === 0) {
        await togglePin(c.partner.id);
      } else if (idx === 1) {
        if (isContact) {
          await useChatPrefs.getState().removeContact(c.partner.id);
        } else {
          await addContact({
            id: c.partner.id,
            handle: c.partner.username ?? undefined,
            name: `${c.partner.firstName ?? ''} ${c.partner.lastName ?? ''}`.trim() || undefined,
            avatarUrl: c.partner.avatarUrl ?? null,
            addedAt: Date.now(),
          });
        }
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: opts.length - 1 },
        run,
      );
    } else {
      Alert.alert(
        c.partner.firstName ?? '',
        undefined,
        [
          { text: pinLabel, onPress: () => run(0) },
          { text: contactLbl, onPress: () => run(1) },
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        ],
      );
    }
  };

  const totalUnread = (data ?? []).reduce((s, c) => s + c.unread, 0);

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
          paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }}>
              {t('messages.title')}
            </Text>
            {totalUnread > 0 && (
              <View style={{
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
                backgroundColor: BRAND_BLUE, minWidth: 22, alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
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
            placeholder={t('messages.search')}
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
            {(() => {
              const filterLabel: Record<Filter, string> = {
                ALL: t('messages.filter.all'),
                UNREAD: t('messages.filter.unread'),
                PAYMENTS: t('messages.filter.payments'),
                SUPPORT: t('messages.filter.support'),
              };
              return (['ALL', 'UNREAD', 'PAYMENTS', 'SUPPORT'] as Filter[]).map((f) => {
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
                    {filterLabel[f]}
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
            });
            })()}
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
              {t('messages.loading')}
            </Text>
          ) : conversations.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 }}>
              <Ionicons name="chatbubbles-outline" size={36} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 12 }}>
                {query.trim() || filter !== 'ALL' ? t('messages.noMatch') : t('messages.empty')}
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
                    {t('messages.startChat')}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              {/* Contacts strip — visible only when at least one
                  contact exists, and only on the "ALL" filter so it
                  doesn't fight with Unread/Payments/Support. */}
              {filter === 'ALL' && contacts.length > 0 && !query.trim() && (
                <View style={{ paddingTop: 6, paddingBottom: 6 }}>
                  <Text style={{
                    color: p.fgFaint, fontSize: 10, fontWeight: '700',
                    letterSpacing: 0.8, paddingHorizontal: 24, marginBottom: 8,
                  }}>
                    {(t('chat.contacts') || 'CONTACTS').toUpperCase()}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 18, gap: 14 }}
                  >
                    {contacts.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => { h.selection(); router.push(`/messages/${c.id}`); }}
                        style={({ pressed }) => ({
                          alignItems: 'center', gap: 6, width: 64,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View style={{
                          width: 52, height: 52, borderRadius: 26,
                          backgroundColor: '#7c3aed',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          {c.avatarUrl
                            ? <Text style={{ fontSize: 24 }}>{c.avatarUrl}</Text>
                            : <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                                {(c.name?.[0] ?? c.handle?.[0] ?? '?').toUpperCase()}
                              </Text>
                          }
                        </View>
                        <Text numberOfLines={1} style={{
                          color: p.fg, fontSize: 11, fontWeight: '600',
                          maxWidth: 64,
                        }}>
                          {c.name ?? (c.handle ? `@${c.handle}` : '—')}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={{ height: 1, backgroundColor: p.border, marginTop: 12, marginHorizontal: 24 }} />
                </View>
              )}

              {conversations.map((c) => (
                <Row
                  key={c.partner.id}
                  conv={c}
                  palette={p}
                  pinned={pinnedSet.has(c.partner.id)}
                  onPress={() => { h.selection(); router.push(`/messages/${c.partner.id}`); }}
                  onLongPress={() => onLongPressConv(c)}
                  translate={t}
                />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Row ─── */
function Row({
  conv: c, palette: p, pinned, onPress, onLongPress, translate: t,
}: {
  conv: Conversation;
  palette: Palette;
  pinned?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  translate: (k: string) => string;
}) {
  const isSupport = c.partner.username === 'support' || c.partner.role === 'AGENT';
  const fullName = `${c.partner.firstName ?? ''} ${c.partner.lastName ?? ''}`.trim()
    || (c.partner.username ? `@${c.partner.username}` : 'Unknown');
  const previewLine = previewOf(c.lastMessage, t);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
        // Subtle wash on pinned rows so the user can scan which chats
        // they've pinned without staring at a tiny corner icon.
        backgroundColor: pressed
          ? p.bgElev
          : (pinned ? p.pillBg : 'transparent'),
        gap: 14,
      })}
    >
      <View style={{
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: isSupport ? BRAND_BLUE : (c.partner.avatarUrl ? p.bgElev : '#7c3aed'),
        alignItems: 'center', justifyContent: 'center',
        borderWidth: !isSupport && c.partner.avatarUrl ? 1 : 0,
        borderColor: p.border,
      }}>
        {isSupport ? (
          <Ionicons name="headset" size={20} color="#fff" />
        ) : c.partner.avatarUrl ? (
          <Text style={{ fontSize: 22 }}>{c.partner.avatarUrl}</Text>
        ) : (
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>
            {(fullName[0] ?? '?').toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {pinned && (
            <Ionicons name="pin" size={11} color={p.fgMuted} style={{ transform: [{ rotate: '35deg' }] }} />
          )}
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
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>STAFF</Text>
            </View>
          )}
          {c.partner.kycStatus === 'APPROVED' && !isSupport && (
            <Ionicons name="checkmark-circle" size={13} color={BRAND_BLUE} />
          )}
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>
            {relTime(c.lastMessage.createdAt, t)}
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
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
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

function previewOf(m: { type: string; content: string; deletedAt: string | null; metadata: any }, t: (k: string) => string): string {
  if (m.deletedAt) return t('messages.preview.deleted');
  if (m.type === 'PAYMENT') {
    const amt = m.metadata?.amount;
    const cur = m.metadata?.currency;
    if (amt && cur) return `${formatAmount(amt)} ${cur}${m.content ? ` · ${m.content}` : ''}`;
    return t('messages.preview.payment');
  }
  if (m.type === 'ESCALATION') return t('messages.preview.escalation');
  if (m.type === 'SYSTEM')     return m.content;
  return m.content;
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(n);
}

/** Format an ISO timestamp as "5m" / "2h" / "Mon" / "Mar 4". */
function relTime(iso: string, t: (k: string) => string): string {
  const ms = Date.now() - +new Date(iso);
  const m = Math.round(ms / 60_000);
  if (m < 1)   return t('messages.relTime.now');
  if (m < 60)  return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24)  return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7)   return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
