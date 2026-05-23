/**
 * HomeHeader — avatar + handle on the left, two icon buttons on the right.
 * Brand-color ring on the avatar makes the user identity read as "yours"
 * before any text loads.
 */

import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { brand, type Palette, useTheme } from '@/store/themeStore';
import { useHaptics } from '@/hooks';

interface Props {
  palette: Palette;
  handle: string;
  initial: string;
  avatarEmoji?: string | null;
  isAdmin?: boolean;
  unreadCount?: number;
  onAvatarPress: () => void;
  onAdminPress?: () => void;
  onNotificationsPress: () => void;
  onMorePress: () => void;
}

export function HomeHeader({
  palette: p, handle, initial, avatarEmoji, isAdmin,
  unreadCount = 0,
  onAvatarPress, onAdminPress, onNotificationsPress, onMorePress,
}: Props) {
  const h = useHaptics();
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
      gap: 10,
    }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Pressable
          onPress={() => { h.selection(); onAvatarPress(); }}
          hitSlop={6}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 }}
        >
          <View style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: avatarEmoji ? p.bgElev : `${accent}28`,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: avatarEmoji ? p.border : accent,
            flexShrink: 0,
          }}>
            {avatarEmoji ? (
              <Text style={{ fontSize: 20 }}>{avatarEmoji}</Text>
            ) : (
              <Text style={{ color: accent, fontWeight: '700', fontSize: 16 }}>{initial}</Text>
            )}
          </View>
          <Text
            style={{
              color: p.fg,
              fontSize: handle.length <= 8 ? 17 : handle.length <= 14 ? 15 : handle.length <= 20 ? 13 : 11,
              fontWeight: '600',
              letterSpacing: -0.3,
              flexShrink: 1,
              minWidth: 0,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            @{handle}
          </Text>
        </Pressable>

        {isAdmin && onAdminPress && (
          <Pressable
            onPress={() => { h.selection(); onAdminPress(); }}
            hitSlop={6}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 4,
              borderRadius: 7,
              backgroundColor: `${accent}22`,
              borderWidth: 1, borderColor: `${accent}66`,
              opacity: pressed ? 0.7 : 1,
              flexShrink: 0,
            })}
          >
            <Ionicons name="shield-checkmark" size={11} color={accent} />
            <Text style={{ color: accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
              ADMIN
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
        <HeaderIconButton
          icon="notifications-outline"
          onPress={() => { h.selection(); onNotificationsPress(); }}
          palette={p}
          a11y="Notifications"
          badge={unreadCount}
        />
        <HeaderIconButton
          icon="ellipsis-horizontal"
          onPress={() => { h.selection(); onMorePress(); }}
          palette={p}
          a11y="More"
        />
      </View>
    </View>
  );
}

function HeaderIconButton({
  icon, onPress, palette: p, a11y, badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  palette: Palette;
  a11y: string;
  badge?: number;
}) {
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: pressed ? `${accent}1F` : p.bgElev,
        borderWidth: 1, borderColor: pressed ? `${accent}66` : p.border,
        alignItems: 'center', justifyContent: 'center',
      })}
    >
      <Ionicons name={icon} size={18} color={p.fg} />
      {badge !== undefined && badge > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -3, right: -3,
            minWidth: 18, height: 18, borderRadius: 9,
            backgroundColor: p.redFg,
            borderWidth: 2, borderColor: p.bg,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9.5, fontWeight: '700' }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
