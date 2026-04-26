/**
 * Boot screen. Shown briefly while the auth store hydrates from SecureStore.
 * The redirect happens in `_layout.tsx::AuthGate` once hydration completes.
 */

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing, withRepeat,
} from 'react-native-reanimated';
import { gradients } from '@/theme';
import { APP } from '@/constants';

export default function Splash() {
  const fade  = useSharedValue(0);
  const lift  = useSharedValue(20);
  const pulse = useSharedValue(1);

  useEffect(() => {
    fade.value  = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    lift.value  = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
    pulse.value = withRepeat(withDelay(400, withTiming(1.06, { duration: 1400 })), -1, true);
  }, [fade, lift, pulse]);

  const wordmark = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: lift.value }],
  }));
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[...gradients.surface]}
        style={{ position: 'absolute', inset: 0 } as never}
      />
      <Animated.View
        style={[orb, {
          position: 'absolute', top: '32%', left: '50%',
          marginLeft: -110, width: 220, height: 220, borderRadius: 220,
          backgroundColor: '#0057B8', opacity: 0.4,
        }]}
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
        <Animated.View style={wordmark}>
          <Text style={{ color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -1.5 }}>
            {APP.name.toLowerCase()}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 6, letterSpacing: 0.4 }}>
            {APP.tagline}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
