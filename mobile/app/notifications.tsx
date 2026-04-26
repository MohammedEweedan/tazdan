/**
 * Notifications inbox — theme-aware.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';

interface Notification {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

const SEED: Notification[] = [
  { id: '1', icon: 'arrow-down-circle', title: 'Deposit received',  body: '+$500.00 added to your USD balance.',  time: '2m',  unread: true },
  { id: '2', icon: 'shield-checkmark',  title: 'KYC approved',      body: 'Tier 2 limits unlocked.',              time: '1h',  unread: true },
  { id: '3', icon: 'cash-outline',      title: 'Sale executed',     body: 'Sold 0.05 BTC at $103,420.18.',         time: '3h',  unread: false },
  { id: '4', icon: 'gift-outline',      title: 'Referral bonus',    body: '@alice joined — +$10 credited.',        time: '1d',  unread: false },
];

export default function Notifications() {
  const h = useHaptics();
  const p = useThemedPalette();
  const [items, setItems] = useState(SEED);

  const unreadCount = items.filter((n) => n.unread).length;

  return (
    <ScreenShell
      title="Notifications"
      subtitle={unreadCount ? `${unreadCount} unread` : 'All caught up'}
      right={unreadCount > 0 ? (
        <Pressable
          hitSlop={6}
          onPress={() => { h.selection(); setItems((xs) => xs.map((n) => ({ ...n, unread: false }))); }}
          style={{ paddingHorizontal: 10, paddingVertical: 8 }}
        >
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>Mark all read</Text>
        </Pressable>
      ) : undefined}
    >
      <Panel style={{ marginTop: 12 }}>
        {items.map((n, i) => (
          <Pressable
            key={n.id}
            onPress={() => {
              h.selection();
              setItems((xs) => xs.map((x) => x.id === n.id ? { ...x, unread: false } : x));
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'flex-start',
              padding: 14,
              backgroundColor: pressed ? p.border : 'transparent',
              borderBottomWidth: i === items.length - 1 ? 0 : 1,
              borderBottomColor: p.border,
              gap: 12,
            })}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: n.unread ? p.greenBg : p.pillBg,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: p.border,
            }}>
              <Ionicons name={n.icon} size={17} color={n.unread ? p.greenFg : p.fgMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{n.title}</Text>
                {n.unread && (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.greenFg }} />
                )}
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 2 }}>
                {n.body}
              </Text>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500', marginTop: 4 }}>
                {n.time}
              </Text>
            </View>
          </Pressable>
        ))}
        {items.length === 0 && (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={28} color={p.fgFaint} />
            <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 10 }}>
              You're all caught up.
            </Text>
          </View>
        )}
      </Panel>
    </ScreenShell>
  );
}
