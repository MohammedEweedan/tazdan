/**
 * ScreenShell — shared wrapper for every full-page or modal screen.
 *  - Theme-aware background
 *  - Status bar that flips with theme
 *  - Header with back button and title
 *  - Optional right slot (e.g. icon button)
 *  - SafeAreaView edges
 */

import { ui } from '@/theme';
import { useT } from '@/store/i18nStore';
import { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { HEADER, HEADER_ROW_HEIGHT, StackHeader } from './ScreenHeader';

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
        themeMode === 'mono'
          ? // Flat, subtle grey — no gradient (and no blue) in monochrome mode.
            ['rgba(26,26,26,0.6)', 'rgba(26,26,26,0.2)', 'rgba(0,0,0,0)']
          : themeMode === 'dark'
          ? [
              // Soft brand-blue mist over the top, fading to nothing. Low
              // alpha so it reads as a tint on the dark bg, never a fill.
              'rgba(99, 161, 219, 0.10)',  // #63a1db whisper at top
              'rgba(99, 161, 219, 0.03)',  // thinning out
              'rgba(10, 10, 11, 0)',       // fade to transparent
            ]
          : [
              // Light mode — an even fainter blue haze on the paper bg.
              'rgba(79, 139, 196, 0.07)',  // deepened blue, low alpha
              'rgba(79, 139, 196, 0.02)',
              'rgba(250, 250, 247, 0)',    // fade to transparent
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

/**
 * Sticky top-of-screen region. Stack from bottom to top:
 *
 *   1. BlurView      — frosts any content the user scrolls under it,
 *                      so the title/back button never appear to share
 *                      pixels with a row that's slid up behind them.
 *   2. TopGradient   — the existing brand mist over the blur.
 *   3. <children>    — the actual back button, title, right slot, etc.
 *
 * Rendered with absolute positioning so it floats above the ScrollView
 * — that's what makes it "sticky." The shell pads the scroll content
 * down by the bar's measured height so the first row isn't hidden
 * underneath it on first paint.
 *
 * Why expo-blur instead of just a solid colour: on iOS the standard
 * frosted-glass look is what users expect from a sticky nav bar; a
 * flat background reads as a banner stuck on. Android falls back to
 * a translucent solid (BlurView is no-op on most Android versions).
 */
export function StickyTopBar({
  children,
  /** Override the blur tint manually (defaults to the active theme). */
  tint,
  /** Hide the hairline rule under the bar (useful when the page
   *  itself owns a heading row immediately below the bar and the
   *  extra divider reads as visual noise). */
  hairline = true,
}: {
  children?: ReactNode;
  tint?: 'light' | 'dark';
  hairline?: boolean;
}) {
  const themeMode = useTheme((s) => s.mode);
  const p         = useThemedPalette();
  const insets    = useSafeAreaInsets();
  const effectiveTint = tint ?? (themeMode === 'light' ? 'light' : 'dark');

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 10,
      }}
    >
      {/* Frost — iOS gets a real blur, Android gets a soft translucent
          fallback so the header still has presence over scrolling
          content. */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 0}
        tint={effectiveTint}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: Platform.OS === 'ios'
            ? 'transparent'
            : p.bg,
        }}
      />
      <TopGradient />
      {/* Pad the safe-area top so content sits below the notch. */}
      <View style={{ paddingTop: insets.top }}>
        {children}
      </View>
      {/* Hairline under the bar — separates it from the scrolling
          body.  Skipped when a caller passes `hairline={false}` (eg.
          the home tab, where the gradient already fades smoothly
          into the avatar/handle row beneath). */}
      {hairline && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height: 1,
            backgroundColor: p.border,
          }}
        />
      )}
    </View>
  );
}

interface Props {
  title?: string;
  subtitle?: string;
  /** Show the back button (default true). */
  back?: boolean;
  onBack?: () => void;
  backIcon?: 'chevron-back' | 'close';
  /** Right-side accessory (e.g. a button). */
  right?: ReactNode;
  /** Wrap content in a vertical ScrollView (default true). */
  scroll?: boolean;
  /** Opt-in keyboard handling for form screens — lifts content above the
   *  keyboard and keeps the bottom inputs/CTA reachable. Default false so
   *  existing screens are unaffected. */
  keyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pull-to-refresh (scroll mode only). */
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}

export function ScreenShell({
  title, subtitle, back = true, onBack, backIcon, right, scroll = true, keyboard = false, contentStyle,
  onRefresh, refreshing = false, children,
}: Props) {
  const p         = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const insets    = useSafeAreaInsets();

  // Height of the sticky bar. The body starts below it so the first row
  // isn't hidden under the bar on first paint.
  const stickyH = insets.top + HEADER_ROW_HEIGHT;

  // With pull-to-refresh on iOS the offset is a content inset rather than
  // padding, so the spinner appears below the frosted bar instead of behind it.
  const insetForRefresh = scroll && !!onRefresh && Platform.OS === 'ios';

  // In keyboard mode pad the bottom generously so the last field/CTA clears
  // the on-screen keyboard even before the KeyboardAvoidingView lifts.
  const bottomPad = keyboard ? insets.bottom + 120 : 64;
  const bodyPadStyle = scroll
    ? { paddingTop: insetForRefresh ? 0 : stickyH, paddingHorizontal: HEADER.gutter, paddingBottom: bottomPad }
    : { paddingTop: stickyH, paddingHorizontal: HEADER.gutter, flex: 1 };
  const bodyProps = scroll
    ? {
        showsVerticalScrollIndicator: false,
        style: { flex: 1 },
        contentContainerStyle: [bodyPadStyle, contentStyle],
        ...(keyboard ? { keyboardShouldPersistTaps: 'handled' as const, keyboardDismissMode: 'interactive' as const } : {}),
        ...(insetForRefresh ? {
          contentInset: { top: stickyH },
          contentOffset: { x: 0, y: -stickyH },
          scrollIndicatorInsets: { top: stickyH },
          automaticallyAdjustContentInsets: false,
        } : {}),
        ...(onRefresh ? {
          refreshControl: (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={p.fgMuted}
              colors={[p.accent]}
              progressViewOffset={stickyH}
            />
          ),
        } : {}),
      }
    : { style: [bodyPadStyle, contentStyle] };

  const header = <StackHeader title={title} subtitle={subtitle} back={back} onBack={onBack} backIcon={backIcon} right={right} />;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />

      {/* Scrollable body — under the sticky bar in the stacking
          order. Content scrolls behind the frosted nav. In keyboard
          mode the whole body is wrapped in a KeyboardAvoidingView so
          the bottom inputs/CTA stay visible above the keyboard. */}
      {keyboard ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {scroll ? <ScrollView {...bodyProps}>{children}</ScrollView> : <View {...bodyProps}>{children}</View>}
        </KeyboardAvoidingView>
      ) : scroll ? (
        <ScrollView {...bodyProps}>{children}</ScrollView>
      ) : (
        <View {...bodyProps}>{children}</View>
      )}

      {/* The sticky bar floats on top — gradient + blur + header
          composited as a single layer the scroll content slides
          under. */}
      <StickyTopBar>{header}</StickyTopBar>
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

  const t = useT();
  const effective: CTAState = state ?? (loading ? 'loading' : 'idle');

  let bg = p.ctaBg;
  let fg = p.ctaFg;
  let displayLabel = label;
  let displayIcon = icon;

  if (effective === 'success') {
    bg = p.greenBg;
    fg = p.greenFg;
    displayLabel = successLabel ?? t('common.done');
    displayIcon = 'checkmark-circle';
  } else if (effective === 'error') {
    bg = p.redBg;
    fg = p.redFg;
    displayLabel = errorLabel ?? t('common.retry');
    displayIcon = 'close-circle';
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || effective === 'loading' || effective === 'success'}
      accessibilityRole="button"
      accessibilityLabel={displayLabel}
      accessibilityState={{ disabled: !!disabled || effective === 'loading' || effective === 'success', busy: effective === 'loading' }}
      style={({ pressed }) => ({
        alignSelf: 'stretch',
        width: '100%',
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
      {effective === 'loading' ? <ActivityIndicator color={fg} /> : displayIcon && <Ionicons name={displayIcon} size={18} color={fg} />}
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
        alignSelf: 'stretch',
        width: '100%',
        height: 56,
        borderRadius: 28,
        backgroundColor: pressed ? p.bgElev : 'transparent',
        borderWidth: 1,
        borderColor: p.border,
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
      borderRadius: ui.cardRadius,
      borderWidth: 1, borderColor: p.border,
      overflow: 'hidden',
    }, style]}>
      {children}
    </View>
  );
}

/** Single tappable row inside a Panel. */
export function PanelRow({
  icon, label, description, value, onPress, danger, last, right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Current value shown on the right, before the chevron (e.g. "On"). */
  value?: string;
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
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 18, paddingVertical: 16,
        backgroundColor: pressed ? p.border : 'transparent',
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: p.border,
      })}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: danger ? p.redBg : p.pillBg,
        marginRight: 12,
      }}>
        <Ionicons name={icon} size={16} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: fg, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {!!description && (
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '400', marginTop: 2 }}>{description}</Text>
        )}
      </View>
      {!!value && (
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500', marginLeft: 8, marginRight: 6 }}>{value}</Text>
      )}
      {right ?? (!danger && <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />)}
    </Pressable>
  );
}

/** Uppercase caption above a Panel. `first` tightens the gap under the header. */
export function SectionLabel({ children, first }: { children: string; first?: boolean }) {
  const p = useThemedPalette();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginTop: first ? 12 : 28, marginBottom: 8, marginLeft: 4,
      }}
    >
      {children}
    </Text>
  );
}

/** Row with a switch inside a Panel — same layout and colours everywhere. */
export function ToggleRow({
  icon, label, description, value, onValueChange, disabled, last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const p = useThemedPalette();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 18, paddingVertical: 16,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border,
      opacity: disabled ? 0.6 : 1,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: p.pillBg, marginRight: 12,
      }}>
        <Ionicons name={icon} size={16} color={p.fg} />
      </View>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {!!description && (
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '400', marginTop: 2 }}>{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: p.border, true: p.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={p.border}
      />
    </View>
  );
}
