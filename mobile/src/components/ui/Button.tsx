/**
 * Premium fintech button. Three visual variants, three sizes.
 *  - primary  : luxury blue gradient (#226dff → #1a52cc) with subtle inner sheen
 *  - secondary: glassy white-on-dark (8% white) with hairline border
 *  - ghost    : transparent, brand-coloured label
 *
 * Press ripple is implemented as an opacity scale dip via Reanimated, NOT
 * Pressable's `android_ripple` so behaviour is identical on iOS/Android/web.
 */

import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { gradients, shadows } from '@/theme';
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
  sm: { height: 40, padX: 16, font: 14, radius: 12 },
  md: { height: 52, padX: 20, font: 15, radius: 16 },
  lg: { height: 60, padX: 24, font: 17, radius: 20 },
};

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, iconLeft, iconRight, fullWidth, style, haptic = 'light',
}: ButtonProps) {
  const h = useHaptics();
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
      className="flex-row items-center justify-center"
      style={{ height: dims.height, paddingHorizontal: dims.padX, gap: 8 }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#226dff'} />
      ) : (
        <>
          {iconLeft}
          <Text
            className={
              variant === 'primary'   ? 'text-white font-bold'
              : variant === 'secondary' ? 'text-ink-primary font-semibold'
              : 'text-brand-400 font-semibold'
            }
            style={{ fontSize: dims.font, letterSpacing: -0.2 }}
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
            ...(variant === 'primary' ? shadows.card : {}),
          },
        ]}
      >
        {variant === 'primary' && (
          <LinearGradient
            colors={[...gradients.brand]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: dims.radius }}
          >
            {/* inner sheen */}
            <LinearGradient
              colors={[...gradients.cardSheen]}
              style={{ position: 'absolute', inset: 0 } as ViewStyle}
              pointerEvents="none"
            />
            {inner}
          </LinearGradient>
        )}
        {variant === 'secondary' && (
          <View
            className="bg-white/[0.06] border border-white/[0.08]"
            style={{ borderRadius: dims.radius }}
          >
            {inner}
          </View>
        )}
        {variant === 'ghost' && <View style={{ borderRadius: dims.radius }}>{inner}</View>}
      </Animated.View>
    </Pressable>
  );
}
