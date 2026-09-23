import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useThemedPalette } from '@/store/themeStore';
interface Props { width?: DimensionValue; height?: number; radius?: number; }
export function Skeleton({ width = '100%', height = 16, radius = 8 }: Props) {
  const p = useThemedPalette();
  const reduce = useReducedMotion();
  const v = useSharedValue(0.6);
  useEffect(() => {
    if (!reduce) v.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
    return () => cancelAnimation(v);
  }, [reduce, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[style, { width, height, borderRadius: radius, backgroundColor: p.pillBg }]} />;
}
export function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }}>
      <Skeleton width={40} height={40} radius={20} />
      <View style={{ flex: 1, gap: 6 }}><Skeleton width="60%" height={13} /><Skeleton width="35%" height={11} /></View>
      <Skeleton width={70} height={14} />
    </View>
  );
}
