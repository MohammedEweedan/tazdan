import { ReactNode } from 'react';
import { View } from 'react-native';
import { useThemedPalette } from '@/store/themeStore';
import { TopGradient } from './ScreenShell';

interface Props {
  children: ReactNode;
  glow?: boolean; // kept for prop compat
}

export function GradientBackground({ children }: Props) {
  const p = useThemedPalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      {children}
    </View>
  );
}
