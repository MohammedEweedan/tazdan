/**
 * Glass-style card. Used for stat panels, list rows, sheets.
 */

import { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, shadows } from '@/theme';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** Soft brand glow under the card. */
  glow?: boolean;
  /** Solid surface vs translucent glass. */
  variant?: 'glass' | 'solid';
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
}

export function Card({
  children, onPress, glow, variant = 'glass', style, padding = 16, radius = 20,
}: Props) {
  const Inner = (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          backgroundColor: variant === 'solid' ? '#0c1430' : 'rgba(255,255,255,0.04)',
          padding,
          ...(glow ? shadows.card : {}),
        },
        style,
      ]}
    >
      {variant === 'glass' && (
        <LinearGradient
          colors={[...gradients.glass]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', inset: 0 } as ViewStyle}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );

  if (!onPress) return Inner;
  return (
    <Pressable onPress={onPress} hitSlop={4} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      {Inner}
    </Pressable>
  );
}
