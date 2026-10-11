/**
 * Premium fintech button. Three visual variants, three sizes.
 *  - primary  : solid mono accent (white in dark, black in light) — reads as urgent
 *  - secondary: glassy 6% surface with hairline border
 *  - ghost    : transparent, mono.fg label
 *
 * Press ripple is implemented as an opacity scale dip via Reanimated, NOT
 * Pressable's `android_ripple` so behaviour is identical on iOS/Android/web.
 */

import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ui } from '@/theme';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks/useHaptics';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: 'light' | 'medium' | 'selection';
}

const sizeMap: Record<Size, { height: number; padX: number; font: number; radius: number }> = {
  sm: { height: 44, padX: 18, font: 14, radius: 22 },
  md: { height: 52, padX: 22, font: 15, radius: 26 },
  lg: { height: ui.button, padX: 24, font: 16, radius: 28 },
};

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, iconLeft, iconRight, fullWidth, style, haptic = 'light',
}: ButtonProps) {
  const h = useHaptics();
  const p = useThemedPalette();
  const press = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
    opacity: 1 - press.value * 0.06,
  }));

  const isDisabled = disabled || loading;
  const dims = sizeMap[size];

  const onIn  = () => { press.value = withTiming(1, { duration: 80 }); };
  const onOut = () => { press.value = withTiming(0, { duration: 140 }); };
  const onTap = () => {
    if (isDisabled) return;
    h[haptic]();
    onPress?.();
  };

  const inner = (
    <View
      style={{ minHeight: dims.height, paddingVertical: 12, paddingHorizontal: dims.padX, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? p.ctaFg : p.fg} />
      ) : (
        <>
          {iconLeft}
          <Text
            style={{
              fontSize: dims.font,
              letterSpacing: -0.2,
              fontWeight: '600',
              color: variant === 'primary' ? p.ctaFg : p.fg,
            }}
          >
            {label}
          </Text>
          {iconRight}
        </>
      )}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={onTap}
      disabled={isDisabled}
      style={[fullWidth && { alignSelf: 'stretch' }, style]}
    >
      <Animated.View
        style={[
          animStyle,
          {
            borderRadius: dims.radius,
            overflow: 'hidden',
            opacity: isDisabled ? 0.55 : 1,

          },
        ]}
      >
        {variant === 'primary' && (
          <View
            style={{
              backgroundColor: p.ctaBg,
              borderRadius: dims.radius,
            }}
          >
            {inner}
          </View>
        )}
        {variant === 'secondary' && (
          <View
            style={{
              backgroundColor: p.pillBg,
              borderColor: p.border,
              borderWidth: 1,
              borderRadius: dims.radius,
            }}
          >
            {inner}
          </View>
        )}
        {variant === 'ghost' && <View style={{ borderRadius: dims.radius }}>{inner}</View>}
      </Animated.View>
    </Pressable>
  );
}
