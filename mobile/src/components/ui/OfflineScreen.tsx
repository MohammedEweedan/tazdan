/**
 * Full-screen "you're offline" state.
 *
 * Shown whenever connectivity drops (see `useConnectivity` + `OfflineGate` in
 * the root layout). It deliberately replaces the app surface so a real user
 * NEVER sees a stale or fabricated balance behind it — when we can't reach
 * Tazdan, we say so plainly instead of guessing.
 *
 * Motion is pure Reanimated (already a project dep): a slow breathing halo of
 * concentric rings around a wifi-off glyph, plus a gentle icon pulse. Fully
 * theme-aware (dark / light / mono).
 */
import { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { PressableScale } from '@/components/ui/Motion';

/** One expanding/fading ring in the breathing halo. */
function Ring({ delay, color }: { delay: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(0, { duration: delay }),               // stagger start
        withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(t.value, [0, 1], [0.6, 2.1]) }],
    opacity: interpolate(t.value, [0, 0.15, 1], [0, 0.35, 0]),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: 120, height: 120, borderRadius: 60,
          borderWidth: 1.5, borderColor: color,
        },
        style,
      ]}
    />
  );
}

export function OfflineScreen({
  reconnecting = false,
  onRetry,
}: {
  reconnecting?: boolean;
  onRetry?: () => void;
}) {
  const p = useThemedPalette();
  const t = useT();
  const insets = useSafeAreaInsets();

  // Gentle pulse on the central glyph.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.96, 1.04]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.85, 1]),
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      style={{
        flex: 1,
        backgroundColor: p.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 36,
        paddingBottom: insets.bottom + 24,
      }}
    >
      {/* Halo + glyph */}
      <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 36 }}>
        <Ring delay={0}    color={p.fgFaint} />
        <Ring delay={870}  color={p.fgFaint} />
        <Ring delay={1740} color={p.fgFaint} />
        <Animated.View
          style={[
            {
              width: 92, height: 92, borderRadius: 46,
              backgroundColor: p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            },
            glyphStyle,
          ]}
        >
          <Ionicons name="cloud-offline-outline" size={40} color={p.fg} />
        </Animated.View>
      </View>

      <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' }}>
        {t('connection.offlineTitle')}
      </Text>
      <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '500', textAlign: 'center', marginTop: 10, lineHeight: 21 }}>
        {t('connection.offlineBody')}
      </Text>
      <Text style={{ color: p.fgFaint, fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
        {t('connection.offlineHint')}
      </Text>

      {onRetry && (
        <PressableScale onPress={onRetry} style={{ marginTop: 30 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            height: 48, paddingHorizontal: 26, borderRadius: 24,
            backgroundColor: p.ctaBg,
          }}>
            <Ionicons
              name={reconnecting ? 'sync-outline' : 'refresh-outline'}
              size={17}
              color={p.ctaFg}
            />
            <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '700' }}>
              {reconnecting ? t('connection.reconnecting') : t('connection.reconnect')}
            </Text>
          </View>
        </PressableScale>
      )}
    </Animated.View>
  );
}
