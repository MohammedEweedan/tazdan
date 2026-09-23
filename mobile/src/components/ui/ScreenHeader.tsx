/**
 * Screen headers — the one place header layout, control sizes and type are
 * defined, so every screen in the app reads the same.
 *
 *  - StackHeader       pushed screens: back button, title (+ subtitle), actions.
 *                      ScreenShell renders it; custom-layout screens can too.
 *  - TabHeader         tab roots: larger title, optional count badge, actions.
 *  - HeaderIconButton  the round 44pt control for a header action.
 *  - HeaderTextButton  the pill control for a header action with a label.
 *
 * Put only HeaderIconButton / HeaderTextButton in a header's `right` slot so
 * every action has the same size, shape and press feedback.
 */
import { ui } from '@/theme';
import { useT } from '@/store/i18nStore';
import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks/useHaptics';

export const HEADER = {
  /** Horizontal gutter shared by headers and screen bodies. */
  gutter: ui.gutter,
  /** Size of every round header control (back, icon actions). */
  control: ui.control,
  padTop: 14,
  padBottom: 14,
} as const;

/** Height of a header row, excluding the safe-area inset. */
export const HEADER_ROW_HEIGHT = HEADER.padTop + HEADER.control + HEADER.padBottom;

type IconName = keyof typeof Ionicons.glyphMap;

export function HeaderIconButton({
  icon, onPress, label, variant = 'default', badge, disabled,
}: {
  icon: IconName;
  onPress: () => void;
  /** Spoken by screen readers — required because the button has no text. */
  label: string;
  /** `primary` is for the screen's main create/add action. */
  variant?: 'default' | 'primary';
  badge?: number;
  disabled?: boolean;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={() => { h.selection(); onPress(); }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: HEADER.control, height: HEADER.control, borderRadius: HEADER.control / 2,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? p.ctaBg : p.bgElev,
        borderWidth: primary ? 0 : 1, borderColor: p.border,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={primary ? p.ctaFg : p.fg} />
      {!!badge && badge > 0 && (
        <View style={{
          position: 'absolute', top: -3, right: -3,
          minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: p.accent, borderWidth: 2, borderColor: p.bg,
        }}>
          <Text style={{ color: p.accentFg, fontSize: 10, fontWeight: '700' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function HeaderTextButton({
  label, onPress, icon, disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  return (
    <Pressable
      onPress={() => { h.selection(); onPress(); }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        height: HEADER.control, borderRadius: HEADER.control / 2, paddingHorizontal: 14,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {icon && <Ionicons name={icon} size={15} color={p.fg} />}
      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/**
 * Round back control. Falls back to the home tab when there is no history.
 * Modal-style screens pass `icon="close"`; multi-step screens pass `onPress`
 * to step back within the flow instead of leaving it.
 */
export function HeaderBackButton({ onPress, icon = 'chevron-back' }: {
  onPress?: () => void;
  icon?: 'chevron-back' | 'close';
} = {}) {
  const router = useRouter();
  const t = useT();
  return (
    <HeaderIconButton
      icon={icon}
      label={t(icon === 'close' ? 'common.close' : 'common.back')}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)))}
    />
  );
}

function Actions({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{children}</View>;
}

/** Header for pushed screens. Title sits next to the back button. */
export function StackHeader({
  title, subtitle, back = true, right, onBack, backIcon,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  /** Override the back action (e.g. step back inside a multi-step flow). */
  onBack?: () => void;
  /** `close` for screens presented as modals. */
  backIcon?: 'chevron-back' | 'close';
}) {
  const p = useThemedPalette();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: HEADER.gutter, paddingTop: HEADER.padTop, paddingBottom: HEADER.padBottom,
    }}>
      {back ? <HeaderBackButton onPress={onBack} icon={backIcon} /> : null}
      <View style={{ flex: 1, minHeight: HEADER.control, justifyContent: 'center' }}>
        {!!title && (
          <Text
            accessibilityRole="header"
            style={{ color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Actions>{right}</Actions>
    </View>
  );
}

/** Header for tab roots. Larger title, optional count badge. */
export function TabHeader({
  title, count, right,
}: {
  title: string;
  /** Small accent badge after the title (e.g. unread count). Hidden at 0. */
  count?: number;
  right?: ReactNode;
}) {
  const p = useThemedPalette();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      paddingHorizontal: HEADER.gutter, paddingTop: HEADER.padTop, paddingBottom: HEADER.padBottom,
      minHeight: HEADER_ROW_HEIGHT,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Text
          accessibilityRole="header"
          style={{ color: p.fg, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!count && count > 0 && (
          <View style={{
            paddingHorizontal: 7, height: 20, borderRadius: 10, minWidth: 22,
            alignItems: 'center', justifyContent: 'center', backgroundColor: p.accent,
          }}>
            <Text style={{ color: p.accentFg, fontSize: 11, fontWeight: '700' }}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </View>
      <Actions>{right}</Actions>
    </View>
  );
}
