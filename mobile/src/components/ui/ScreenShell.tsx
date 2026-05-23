/**
 * ScreenShell — shared wrapper for every full-page or modal screen.
 *  - Theme-aware background
 *  - Status bar that flips with theme
 *  - Header with back button and title
 *  - Optional right slot (e.g. icon button)
 *  - SafeAreaView edges
 */

import { ReactNode } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';

/**
 * Shared top-of-screen accent gradient — matches the one on the home tab.
 * Renders as an absolute overlay so it doesn't affect layout.
 * Consumed automatically by ScreenShell and GradientBackground.
 * Can also be used standalone in custom-layout screens.
 */
export function TopGradient({ height }: { height?: number }) {
  const themeMode = useTheme((s) => s.mode);
  const insets = useSafeAreaInsets();

  // Control height here ↓
  const h = height ?? (120 + insets.top); // was 340, much slimmer now

  return (
    <LinearGradient
      colors={
        themeMode === 'dark'
          ? [
              'rgba(34, 109, 255, 0.25)', // subtle white top
              'rgba(56, 121, 251, 0.10)', // soft grey middle
              'rgba(0,0,0,0)',          // fade to transparent
            ]
          : [
              'rgba(34, 109, 255, 0.25)', // subtle white top
              'rgba(56, 121, 251, 0.10)', // soft grey middle
              'rgba(0,0,0,0)',    // fade to transparent
            ]
      }
      locations={[0, 0.45, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: h, // <- main height control
        zIndex: 0,
      }}
      pointerEvents="none"
    />
  );
}

interface Props {
  title?: string;
  subtitle?: string;
  /** Show the back button (default true). */
  back?: boolean;
  /** Right-side accessory (e.g. a button). */
  right?: ReactNode;
  /** Wrap content in a vertical ScrollView (default true). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function ScreenShell({
  title, subtitle, back = true, right, scroll = true, contentStyle, children,
}: Props) {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);

  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? { showsVerticalScrollIndicator: false, contentContainerStyle: [{ paddingHorizontal: 24, paddingBottom: 64 }, contentStyle] }
    : { style: [{ flex: 1, paddingHorizontal: 24 }, contentStyle] };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <TopGradient />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10,
          gap: 12,
        }}>
          {back ? (
            <Pressable
              onPress={() => { h.selection(); router.back(); }}
              hitSlop={10}
              style={{
                width: 38, height: 38, borderRadius: 19,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.pillBg,
                borderWidth: 1, borderColor: p.border,
              }}
            >
              <Ionicons name="chevron-back" size={20} color={p.fg} />
            </Pressable>
          ) : <View style={{ width: 38 }} />}

          <View style={{ flex: 1 }}>
            {title && (
              <Text style={{ color: p.fg, fontSize: 17, fontWeight: '500', letterSpacing: -0.3 }} numberOfLines={1}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          {right ?? <View style={{ width: 38 }} />}
        </View>

        {/* @ts-ignore - dynamic ScrollView/View — props are conditionally typed */}
        <Body {...bodyProps}>{children}</Body>
      </SafeAreaView>
    </View>
  );
}

/**
 * Solid-fill primary CTA pill — theme-aware, high-contrast.
 *
 * Now supports four visual states the caller can flip between:
 *   - 'idle'    (default, brand colour)
 *   - 'loading' (dim + label override)
 *   - 'success' (green flash + check icon)
 *   - 'error'   (red flash + x icon)
 *
 * The button is the source of feedback - no global toast required.
 * Pass optional `successLabel` / `errorLabel` to override the text.
 */
export type CTAState = 'idle' | 'loading' | 'success' | 'error';

export function CTAButton({
  label, onPress, disabled, loading, icon,
  state, successLabel, errorLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  state?: CTAState;
  successLabel?: string;
  errorLabel?: string;
}) {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);

  const effective: CTAState = state ?? (loading ? 'loading' : 'idle');

  let bg = p.ctaBg;
  let fg = p.ctaFg;
  let displayLabel = label;
  let displayIcon = icon;

  if (effective === 'success') {
    bg = '#10b981';
    fg = '#ffffff';
    displayLabel = successLabel ?? 'Done';
    displayIcon = 'checkmark-circle';
  } else if (effective === 'error') {
    bg = '#ef4444';
    fg = '#ffffff';
    displayLabel = errorLabel ?? 'Try again';
    displayIcon = 'close-circle';
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || effective === 'loading' || effective === 'success'}
      style={({ pressed }) => ({
        height: 56,
        borderRadius: 28,
        backgroundColor: bg,
        opacity: disabled ? 0.4 : effective === 'loading' ? 0.7 : pressed ? 0.85 : 1,
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8,
        shadowColor: '#000',
        shadowOpacity: themeMode === 'light' ? 0.18 : 0,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 3,
      })}
    >
      {displayIcon && <Ionicons name={displayIcon} size={18} color={fg} />}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '500', letterSpacing: -0.1 }}>
        {displayLabel}
      </Text>
    </Pressable>
  );
}

/** Bordered secondary pill. */
export function SecondaryButton({
  label, onPress, icon,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 56,
        borderRadius: 28,
        backgroundColor: pressed ? p.bgElev : 'transparent',
        borderWidth: 1.5,
        borderColor: p.fg,
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8,
      })}
    >
      {icon && <Ionicons name={icon} size={18} color={p.fg} />}
      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

/** Translucent panel surface used for grouped rows. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useThemedPalette();
  return (
    <View style={[{
      backgroundColor: p.bgElev,
      borderRadius: 18,
      borderWidth: 1, borderColor: p.border,
      overflow: 'hidden',
    }, style]}>
      {children}
    </View>
  );
}

/** Single tappable row inside a Panel. */
export function PanelRow({
  icon, label, onPress, danger, last, right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
  right?: ReactNode;
}) {
  const p = useThemedPalette();
  const fg = danger ? p.redFg : p.fg;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 14,
        backgroundColor: pressed ? p.border : 'transparent',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: p.border,
      })}
    >
      <View style={{
        width: 32, height: 32, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: danger ? 'rgba(239,68,68,0.14)' : p.pillBg,
        marginRight: 12,
      }}>
        <Ionicons name={icon} size={16} color={fg} />
      </View>
      <Text style={{ color: fg, fontSize: 15, fontWeight: '500', flex: 1 }}>{label}</Text>
      {right ?? (!danger && <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />)}
    </Pressable>
  );
}
