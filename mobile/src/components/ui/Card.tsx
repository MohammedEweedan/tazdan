/**
 * Card — flat dark surface. No gradients, no glow. Pure minimal.
 * Kept under the same name so all consumers (Profile, Wallet, etc.) work.
 */

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
  children, onPress, style, padding = 16, radius = 20,
}: Props) {
  const Inner = (
    <View
      style={[
        {
          borderRadius: radius,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
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
    <Pressable onPress={onPress} hitSlop={4} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {Inner}
    </Pressable>
  );
}
