/**
 * App-wide background. Deep navy gradient + 2 soft radial glows in the
 * brand-blue palette to give a "premium night-mode" feel like Revolut /
 * Cash App. Mounted once in the root layout so it persists across navigations.
 */

import { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '@/theme';

interface Props {
  children: ReactNode;
  /** Show the soft top-right + bottom-left brand glows. Default true. */
  glow?: boolean;
}

export function GradientBackground({ children, glow = true }: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: '#030818' }}>
      <LinearGradient
        colors={[...gradients.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', inset: 0 } as ViewStyle}
      />
      {glow && (
        <>
          {/* Top-right brand halo */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -120, right: -120,
              width: 360, height: 360,
              borderRadius: 360,
              backgroundColor: '#0057B8',
              opacity: 0.32,
              transform: [{ scale: 1 }],
            }}
          />
          {/* Bottom-left soft glow */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -160, left: -80,
              width: 320, height: 320,
              borderRadius: 320,
              backgroundColor: '#4A8FE0',
              opacity: 0.18,
            }}
          />
        </>
      )}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
