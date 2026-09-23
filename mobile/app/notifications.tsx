/**
 * Notifications inbox.
 * Tapping an announcement opens a full-screen banner modal.
 * Tapping other notifications routes to the relevant screen.
 */

import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenShell, Panel, SectionLabel } from '@/components/ui/ScreenShell';
import { HeaderTextButton } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
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
  const t = useT();
  const insets = useSafeAreaInsets();
  const media = notification.mediaType !== 'none' ? resolveMediaUrl(notification.mediaUrl) : undefined;

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
            {media && (
              <Image
                source={{ uri: media }}
                style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, marginBottom: 20 }}
                resizeMode="cover"
              />
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: p.accentSoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="megaphone" size={16} color={p.accentText} />
              </View>
              <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {t('notifications.announcement')}
              </Text>
            </View>

            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', lineHeight: 28, marginBottom: 8 }}>
              {notification.title}
            </Text>
            {notification.subtitle && (
              <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>
                {notification.subtitle}
              </Text>
            )}
            <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 22 }}>
              {notification.description ?? notification.message}
            </Text>
            <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 16 }}>
              {formatRelativeTime(notification.createdAt)}
            </Text>
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginHorizontal: 24, marginTop: 4,
              height: 52, borderRadius: 26,
              backgroundColor: p.ctaBg,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '600' }}>{t('notifications.gotIt')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type DayGroup = 'today' | 'yesterday' | 'earlier';

/** Split notifications (already newest-first) into Today / Yesterday / Earlier. */
function groupByDay(items: any[]): { key: DayGroup; items: any[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = today.getTime() - 24 * 60 * 60 * 1000;
  const groups: Record<DayGroup, any[]> = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const at = new Date(n.createdAt).getTime();
    groups[at >= today.getTime() ? 'today' : at >= yesterday ? 'yesterday' : 'earlier'].push(n);
  }
  return (['today', 'yesterday', 'earlier'] as const)
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, items: groups[key] }));
}

function NotificationRow({ n, last, onPress }: { n: any; last: boolean; onPress: () => void }) {
  const p = useThemedPalette();
  const t = useT();
  const unread = !n.isRead;
  const isAnnouncement = n.type === 'announcement';
  const highlight = unread || isAnnouncement;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.title}. ${n.message}`}
      accessibilityState={{ selected: unread }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        padding: 14,
        backgroundColor: pressed ? p.border : 'transparent',
        borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border,
      })}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: highlight ? p.accentSoft : p.pillBg,
      }}>
        <Ionicons name={ICON_MAP[n.type] ?? ICON_MAP.info} size={17} color={highlight ? p.accentText : p.fgMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: unread ? '600' : '500' }} numberOfLines={1}>
            {n.title}
          </Text>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500' }}>
            {formatRelativeTime(n.createdAt)}
          </Text>
        </View>
        <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 18, marginTop: 2 }} numberOfLines={2}>
          {n.message}
        </Text>
        {isAnnouncement && (
          <Text style={{ color: p.accentText, fontSize: 12, fontWeight: '600', marginTop: 6 }}>
            {t('notifications.readMore')}
          </Text>
        )}
      </View>
      {unread && (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.accent, marginTop: 5 }} />
      )}
    </Pressable>
  );
}

export default function Notifications() {
  const h = useHaptics();
  const t = useT();
  const router = useRouter();

  const { data, isLoading, error, refetch } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const [expandedNotif, setExpandedNotif] = useState<any | null>(null);
  // Pull-to-refresh spinner. Tracked locally because the list also refetches
  // in the background every 15s, which must not show a spinner.
  const [pulling, setPulling] = useState(false);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const groups = useMemo(() => groupByDay(notifications), [notifications]);

  const onRefresh = async () => {
    setPulling(true);
    try { await refetch(); } finally { setPulling(false); }
  };

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
      title={t('notifications.title')}
      subtitle={unreadCount > 0 ? t('notifications.unread', { count: unreadCount }) : t('notifications.allCaughtUp')}
      right={unreadCount > 0 ? (
        <HeaderTextButton
          icon="checkmark-done"
          label={t('notifications.markAllRead')}
          onPress={() => markAll.mutate()}
          disabled={markAll.isPending}
        />
      ) : undefined}
      onRefresh={onRefresh}
      refreshing={pulling}
    >
      {isLoading ? (
        <View style={{ padding: 48, alignItems: 'center' }}>
          <LoadingPulse size={56} icon="notifications-outline" />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t('notifications.errorTitle')}
          message={t('notifications.errorBody')}
          actionLabel={t('common.retry')}
          onAction={() => { refetch(); }}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title={t('notifications.emptyTitle')}
          message={t('notifications.emptyBody')}
        />
      ) : (
        groups.map((group, gi) => (
          <View key={group.key}>
            <SectionLabel first={gi === 0}>{t(`notifications.${group.key}`)}</SectionLabel>
            <Panel>
              {group.items.map((n, i) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  last={i === group.items.length - 1}
                  onPress={() => handlePress(n)}
                />
              ))}
            </Panel>
          </View>
        ))
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
