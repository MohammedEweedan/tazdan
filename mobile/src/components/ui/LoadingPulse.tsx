/**
 * LoadingPulse — sleek loading indicator with a rotating
 * light → grey → dark conic-style gradient ring around a centered
 * icon. Theme-aware: the icon picks up palette.fg, and the gradient
 * shifts from the user's selected mode (dark / light) so it reads
 * on either background.
 *
 * Usage:
 *   <LoadingPulse />                   // 56px, default 'wallet' icon
 *   <LoadingPulse size={80} icon="cash-outline" />
 *   <LoadingPulse fullscreen />        // centered overlay
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemedPalette } from '@/store/themeStore';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

type Props = {
  size?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  fullscreen?: boolean;
  /** Color of the centered icon. Defaults to palette.fg. */
  iconColor?: string;
  style?: ViewStyle;
};

export function LoadingPulse({
  size = 56,
  icon = 'wallet',
  label,
  fullscreen = false,
  iconColor,
  style,
}: Props) {
  const p = useThemedPalette();
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    return () => rotate.stopAnimation();
  }, [rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Detect dark/light by sampling the bg — works whether themeMode is
  // set or not (it's available from the store too, but this is robust).
  const isDark = p.bg.startsWith('#0') || p.bg.startsWith('#1') || p.bg.startsWith('#2');

  // Gradient stops: light → grey → dark. Reversed on light theme so the
  // contrast against the surface is consistent.
  const stops = isDark
    ? [
        { offset: '0%',   color: '#f5f5f7', opacity: 1 },
        { offset: '50%',  color: '#7a7a82', opacity: 1 },
        { offset: '100%', color: '#1c1d22', opacity: 1 },
      ]
    : [
        { offset: '0%',   color: '#141518', opacity: 1 },
        { offset: '50%',  color: '#7a7a82', opacity: 1 },
        { offset: '100%', color: '#f5f5f7', opacity: 1 },
      ];

  const stroke = Math.max(3, size * 0.08);
  const radius = (size - stroke) / 2;
  const inner = size - stroke * 2;
  const ring = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Rotating gradient ring */}
      <AnimatedSvg
        width={size}
        height={size}
        style={{
          position: 'absolute',
          transform: [{ rotate: spin }],
        }}
      >
        <Defs>
          <SvgLinearGradient id="lp-grad" x1="0" y1="0" x2="1" y2="1">
            {stops.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#lp-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={`${radius * Math.PI * 1.3} ${radius * Math.PI * 0.7}`}
        />
      </AnimatedSvg>
      {/* Solid centre disc with the icon */}
      <View
        style={{
          width: inner, height: inner, borderRadius: inner / 2,
          backgroundColor: p.bgElev,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: p.border,
        }}
      >
        <Ionicons name={icon} size={Math.round(inner * 0.42)} color={iconColor ?? p.fg} />
      </View>
    </View>
  );

  if (fullscreen) {
    return (
      <View
        style={[
          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg, gap: 14 },
          style,
        ]}
      >
        {ring}
        {label && (
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 }}>
            {label}
          </Text>
        )}
      </View>
    );
  }

  if (label) {
    return (
      <View style={[{ alignItems: 'center', justifyContent: 'center', gap: 10 }, style]}>
        {ring}
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      </View>
    );
  }

  return <View style={style}>{ring}</View>;
}

export default LoadingPulse;
