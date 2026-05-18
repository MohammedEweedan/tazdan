/**
 * Placeholder for screens not yet implemented at full quality.
 * Theme-aware. No NativeWind.
 */

import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { ScreenShell, Panel } from './ScreenShell';
import { useThemedPalette } from '@/store/themeStore';

interface Props {
  title: string;
  subtitle?: string;
  description?: string;
}

export function ScreenStub({ title, subtitle, description }: Props) {
  const p = useThemedPalette();
  return (
    <ScreenShell title={title} subtitle={subtitle} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <Panel style={{ padding: 24 }}>
        <Text style={{
          color: p.fg, fontSize: 24, fontWeight: '600',
          letterSpacing: -0.4, marginBottom: 8,
        }}>
          Coming soon
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 20 }}>
          {description ??
            "This screen's full implementation is on the roadmap. The route and stack are wired up so navigation flows correctly."}
        </Text>
      </Panel>
    </ScreenShell>
  );
}
