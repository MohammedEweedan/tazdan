/**
 * ScreenShell — shared wrapper for every full-page or modal screen.
 *  - Theme-aware background
 *  - Status bar that flips with theme
 *  - Header with back button and title
 *  - Optional right slot (e.g. icon button)
 *  - SafeAreaView edges
 */

import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';

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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 24, paddingTop: 4, paddingBottom: 8,
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
              <Text style={{ color: p.fg, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>
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

/** Solid-fill primary CTA pill — theme-aware, high-contrast. */
export function CTAButton({
  label, onPress, disabled, loading, icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        height: 56,
        borderRadius: 28,
        backgroundColor: p.ctaBg,
        opacity: disabled ? 0.4 : loading ? 0.7 : pressed ? 0.85 : 1,
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8,
        shadowColor: '#000',
        shadowOpacity: themeMode === 'light' ? 0.18 : 0,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 3,
      })}
    >
      {icon && <Ionicons name={icon} size={18} color={p.ctaFg} />}
      <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }}>
        {label}
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
      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{label}</Text>
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
      <Text style={{ color: fg, fontSize: 15, fontWeight: '600', flex: 1 }}>{label}</Text>
      {right ?? (!danger && <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />)}
    </Pressable>
  );
}
