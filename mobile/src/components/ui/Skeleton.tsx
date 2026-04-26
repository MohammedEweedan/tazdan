import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { DimensionValue } from 'react-native';

interface Props { width?: DimensionValue; height?: number; radius?: number; }

export function Skeleton({ width = '100%', height = 16, radius = 8 }: Props) {
  const v = useSharedValue(0.5);
  useEffect(() => { v.value = withRepeat(withTiming(1, { duration: 900 }), -1, true); }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View style={[
      style,
      { width, height, borderRadius: radius, backgroundColor: 'rgba(255,255,255,0.07)' },
    ]} />
  );
}

export function SkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Skeleton width={40} height={40} radius={20} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={13} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={70} height={14} />
    </View>
  );
}
