/**
 * Notifications inbox — real API-driven.
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useNotifications, useMarkRead, useMarkAllRead } from '@/hooks';
import { formatRelativeTime } from '@/utils/format';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  info:          'information-circle-outline',
  deposit:       'arrow-down-circle',
  withdraw:      'arrow-up-circle',
  transfer:      'swap-horizontal',
  trade:         'cash-outline',
  payment:       'wallet-outline',
  kyc:           'shield-checkmark',
  referral:      'gift-outline',
  message:       'chatbubble-outline',
  p2p:           'people-outline',
  support:       'headset-outline',
};

export default function Notifications() {
  const h = useHaptics();
  const p = useThemedPalette();
  const router = useRouter();

  const { data, isLoading, error, refetch } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handlePress = (n: any) => {
    h.selection();
    if (!n.isRead) markRead.mutate(n.id);
    // Route based on notification type/metadata
    const meta = n.metadata ?? {};
    if (meta.tradeId)        router.push(`/p2p/trades`);
    else if (meta.messageId) router.push(`/messages/${meta.senderId}`);
    else if (meta.currency)  router.push(`/asset/${meta.currency}`);
    else if (n.type === 'kyc') router.push('/profile');
  };

  return (
    <ScreenShell
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      right={unreadCount > 0 ? (
        <Pressable
          hitSlop={6}
          onPress={() => { h.selection(); markAll.mutate(); }}
          style={{ paddingHorizontal: 10, paddingVertical: 8 }}
          disabled={markAll.isPending}
        >
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>
            {markAll.isPending ? 'Marking…' : 'Mark all read'}
          </Text>
        </Pressable>
      ) : undefined}
    >
      {isLoading && (
        <View style={{ padding: 48, alignItems: 'center' }}>
          <LoadingPulse size={56} icon="notifications-outline" />
        </View>
      )}

      {error && (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Ionicons name="warning-outline" size={28} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 10, textAlign: 'center' }}>
            Couldn't load notifications.{'\n'}Pull to retry.
          </Text>
        </View>
      )}

      {!isLoading && !error && (
        <Panel style={{ marginTop: 12 }}>
          {notifications.map((n: any, i: number) => {
            const icon = ICON_MAP[n.type] ?? ICON_MAP.info;
            return (
              <Pressable
                key={n.id}
                onPress={() => handlePress(n)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'flex-start',
                  padding: 14,
                  backgroundColor: pressed ? p.border : 'transparent',
                  borderBottomWidth: i === notifications.length - 1 ? 0 : 1,
                  borderBottomColor: p.border,
                  gap: 12,
                })}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 12,
                  backgroundColor: !n.isRead ? p.greenBg : p.pillBg,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: p.border,
                }}>
                  <Ionicons name={icon} size={17} color={!n.isRead ? p.greenFg : p.fgMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{n.title}</Text>
                    {!n.isRead && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.greenFg }} />
                    )}
                  </View>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 2 }}>
                    {n.message}
                  </Text>
                  <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500', marginTop: 4 }}>
                    {formatRelativeTime(n.createdAt)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {notifications.length === 0 && (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Ionicons name="notifications-off-outline" size={28} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 10 }}>
                You're all caught up.
              </Text>
            </View>
          )}
        </Panel>
      )}
    </ScreenShell>
  );
}
