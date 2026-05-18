/**
 * Notifications inbox.
 * Tapping an announcement opens a full-screen banner modal.
 * Tapping other notifications routes to the relevant screen.
 */

import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useNotifications, useMarkRead, useMarkAllRead } from '@/hooks';
import { formatRelativeTime } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnnouncementOptInButton } from '@/components/ui/AnnouncementBanner';
import { APP } from '@/constants';

function resolveMediaUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const apiBase = APP.apiBaseUrl.replace(/\/api\/?$/, '');
  if (raw.startsWith('/')) return `${apiBase}${raw}`;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(raw)) {
    const tail = raw.replace(/^https?:\/\/[^/]+/, '');
    return `${apiBase}${tail}`;
  }
  return raw;
}

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
  announcement:  'megaphone-outline',
};

function AnnouncementModal({ notification, onClose }: { notification: any; onClose: () => void }) {
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: p.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingBottom: insets.bottom + 16,
          maxHeight: '85%',
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 24 }}>
            {/* Media */}
            {notification.mediaUrl && notification.mediaType !== 'none' && resolveMediaUrl(notification.mediaUrl) && (
              <Image
                source={{ uri: resolveMediaUrl(notification.mediaUrl) }}
                style={{
                  width: '100%', aspectRatio: 16 / 9,
                  borderRadius: 16, marginBottom: 20,
                }}
                resizeMode="cover"
              />
            )}

            {/* Icon + type */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: p.ctaBg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="megaphone" size={16} color={p.ctaFg} />
              </View>
              <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Announcement
              </Text>
            </View>

            {/* Title */}
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 8 }}>
              {notification.title}
            </Text>

            {/* Subtitle */}
            {notification.subtitle && (
              <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>
                {notification.subtitle}
              </Text>
            )}

            {/* Body */}
            <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 22 }}>
              {notification.description ?? notification.message}
            </Text>

            {/* Timestamp */}
            <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 16 }}>
              {formatRelativeTime(notification.createdAt)}
            </Text>
          </ScrollView>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginHorizontal: 24, marginTop: 4,
              height: 50, borderRadius: 14,
              backgroundColor: p.ctaBg,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '700' }}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function Notifications() {
  const h = useHaptics();
  const p = useThemedPalette();
  const router = useRouter();

  const { data, isLoading, error } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const [expandedNotif, setExpandedNotif] = useState<any | null>(null);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handlePress = (n: any) => {
    h.selection();
    if (!n.isRead) markRead.mutate(n.id);

    // Announcements open the full modal regardless of read state
    if (n.type === 'announcement') {
      setExpandedNotif(n);
      return;
    }

    // Route based on notification type/metadata
    const meta = n.metadata ?? {};
    if (meta.tradeId)        router.push('/p2p/trades');
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
            const isAnnouncement = n.type === 'announcement';
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
                  backgroundColor: !n.isRead ? p.greenBg : (isAnnouncement ? `${p.ctaBg}20` : p.pillBg),
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: p.border,
                }}>
                  <Ionicons
                    name={icon}
                    size={17}
                    color={!n.isRead ? p.greenFg : (isAnnouncement ? p.ctaBg : p.fgMuted)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {!n.isRead && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.greenFg, flexShrink: 0 }} />
                    )}
                  </View>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 2 }} numberOfLines={2}>
                    {n.message}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500' }}>
                      {formatRelativeTime(n.createdAt)}
                    </Text>
                    {isAnnouncement && (
                      <Text style={{ color: p.ctaBg, fontSize: 11, fontWeight: '600' }}>
                        Tap to read →
                      </Text>
                    )}
                  </View>
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

      {/* Re-enable announcements if user opted out */}
      <AnnouncementOptInButton />

      {expandedNotif && (
        <AnnouncementModal
          notification={expandedNotif}
          onClose={() => setExpandedNotif(null)}
        />
      )}
    </ScreenShell>
  );
}
