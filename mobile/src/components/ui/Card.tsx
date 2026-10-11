/**
 * Card — flat dark surface. No gradients, no glow. Pure minimal.
 * Kept under the same name so all consumers (Profile, Wallet, etc.) work.
 */

import { useThemedPalette } from '@/store/themeStore';
import { ui } from '@/theme';
import { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** ignored — kept for prop compat */
  glow?: boolean;
  variant?: 'glass' | 'solid';
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
}

export function Card({
  children, onPress, style, padding = 16, radius = ui.cardRadius,
}: Props) {
  const p = useThemedPalette();
  const Inner = (
    <View
      style={[
        {
          borderRadius: radius,
          backgroundColor: p.bgElev,
          borderWidth: 1,
          borderColor: p.border,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return Inner;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={4} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {Inner}
    </Pressable>
  );
}
