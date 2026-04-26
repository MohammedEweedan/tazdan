/**
 * Notifications inbox.
 *  - Tabs: All / Activity / Security / Promo
 *  - Each row shows tinted icon + title + body + relative time, unread dot
 *  - Tapping marks read; "Mark all read" header action
 */

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useHaptics } from '@/hooks';
import { formatRelativeTime } from '@/utils/format';

type Kind = 'ACTIVITY' | 'SECURITY' | 'PROMO';
interface Notif {
  id: string;
  kind: Kind;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

const now = Date.now();
const ago = (m: number) => new Date(now - m * 60_000).toISOString();

const SEED: Notif[] = [
  { id: 'n1', kind: 'ACTIVITY', icon: 'arrow-down', color: '#22c55e', title: 'Received +$1,114.20',  body: 'From @moe.ali · "for the dinner"',                  time: ago(2),    unread: true },
  { id: 'n2', kind: 'SECURITY', icon: 'shield-checkmark', color: '#4A8FE0', title: 'New sign-in',          body: 'iPhone 15 Pro · Riyadh, SA · 2FA verified',         time: ago(45),   unread: true },
  { id: 'n3', kind: 'ACTIVITY', icon: 'card', color: '#ef4444', title: 'Card spend $42.50',     body: 'Apple iCloud+ · Visa •• 1144',                       time: ago(120),  unread: false },
  { id: 'n4', kind: 'PROMO',    icon: 'gift', color: '#f59e0b', title: 'Earn 5% on USDT',       body: 'Limited time: 5% APY on idle USDT until April 30.',  time: ago(240),  unread: false },
  { id: 'n5', kind: 'ACTIVITY', icon: 'people', color: '#4A8FE0', title: 'P2P trade matched',   body: '@trader.uae will release 5,000 USDT once paid.',     time: ago(420),  unread: false },
  { id: 'n6', kind: 'SECURITY', icon: 'finger-print', color: '#22c55e', title: 'Biometric enabled',   body: 'Face ID is now your fastest way to log in.',     time: ago(1440), unread: false },
];

const TABS = ['All', 'Activity', 'Security', 'Promo'] as const;
type Tab = typeof TABS[number];

export default function Notifications() {
  const h = useHaptics();
  const [tab, setTab]   = useState<Tab>('All');
  const [items, setItems] = useState(SEED);
  const unread = items.filter((i) => i.unread).length;

  const filtered = items.filter((n) => {
    if (tab === 'All') return true;
    if (tab === 'Activity') return n.kind === 'ACTIVITY';
    if (tab === 'Security') return n.kind === 'SECURITY';
    return n.kind === 'PROMO';
  });

  const markAllRead = () => {
    h.success();
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader
          title="Notifications"
          subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
          showBack
          right={
            unread > 0 ? (
              <Pressable onPress={markAllRead} hitSlop={6}>
                <Text className="text-brand-400 text-xs font-bold">Mark read</Text>
              </Pressable>
            ) : null
          }
        />

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, gap: 8 }}
        >
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => { h.selection(); setTab(t); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: tab === t ? 'rgba(74,143,224,0.18)' : 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: tab === t ? '#4A8FE0' : 'rgba(255,255,255,0.08)',
              }}
            >
              <Text style={{ color: tab === t ? '#fff' : 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '700' }}>
                {t}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 60 }}>
          {filtered.length === 0 && (
            <View className="items-center py-16">
              <Ionicons name="checkmark-done-circle-outline" size={32} color="rgba(255,255,255,0.3)" />
              <Text className="text-ink-tertiary text-sm mt-3">Nothing here.</Text>
            </View>
          )}

          {filtered.map((n, i) => (
            <MotiView
              key={n.id}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 280, delay: 30 * i }}
            >
              <Pressable
                onPress={() => {
                  h.selection();
                  setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, unread: false } : x));
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  padding: 14, gap: 12,
                  borderRadius: 16,
                  backgroundColor: pressed
                    ? 'rgba(255,255,255,0.06)'
                    : n.unread
                      ? 'rgba(74,143,224,0.05)'
                      : 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: n.unread ? 'rgba(74,143,224,0.18)' : 'rgba(255,255,255,0.06)',
                  marginBottom: 10,
                })}
              >
                <View
                  style={{
                    width: 38, height: 38, borderRadius: 12,
                    backgroundColor: `${n.color}26`,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name={n.icon} size={17} color={n.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Text className="text-ink-primary text-sm font-bold" numberOfLines={1}>
                      {n.title}
                    </Text>
                    {n.unread && (
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4A8FE0' }} />
                    )}
                  </View>
                  <Text className="text-ink-secondary text-xs mt-1" numberOfLines={2}>{n.body}</Text>
                  <Text className="text-ink-tertiary text-xs mt-1.5">{formatRelativeTime(n.time)}</Text>
                </View>
              </Pressable>
            </MotiView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
