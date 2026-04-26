/**
 * Placeholder for screens not yet implemented at full quality. Renders a
 * consistent header + a "Coming soon" panel so navigation flows still work
 * end-to-end during development.
 */

import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from './GradientBackground';
import { ScreenHeader } from './ScreenHeader';
import { Card } from './Card';

interface Props {
  title: string;
  subtitle?: string;
  description?: string;
}

export function ScreenStub({ title, subtitle, description }: Props) {
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title={title} subtitle={subtitle} showBack />
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <Card padding={24}>
            <Text className="text-ink-primary text-2xl font-bold mb-2" style={{ letterSpacing: -0.4 }}>
              Coming soon
            </Text>
            <Text className="text-ink-secondary text-sm leading-5">
              {description ??
                "This screen's full premium implementation is on the roadmap. The route and stack are wired up so the rest of the app navigates correctly."}
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
