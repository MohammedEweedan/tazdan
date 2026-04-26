/**
 * App background — pure black. No gradients, no orbs. Same name kept for
 * backwards compat with all the screens that import it.
 */

import { ReactNode } from 'react';
import { View } from 'react-native';

interface Props {
  children: ReactNode;
  glow?: boolean; // ignored — kept for prop compat
}

export function GradientBackground({ children }: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {children}
    </View>
  );
}
