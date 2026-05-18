/**
 * Smoothly counts from previous → next on every value change.
 * Mirrors the "balance ticks up" feel of Revolut/Cash App.
 */

import { useEffect } from 'react';
import { type TextStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimText = Animated.createAnimatedComponent(Text);

interface Props {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  style?: TextStyle;
  className?: string;
}

export function AnimatedNumber({
  value, decimals = 2, prefix = '', suffix = '', duration = 700, style, className,
}: Props) {
  const sv = useSharedValue(value);

  useEffect(() => {
    sv.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, duration, sv]);

  const animProps = useAnimatedProps(() => {
    'worklet';
    const formatted = sv.value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return { text: `${prefix}${formatted}${suffix}` } as never;
  });

  return (
    <AnimText
      animatedProps={animProps}
      className={className}
      style={style}
    >
      {`${prefix}${value.toFixed(decimals)}${suffix}`}
    </AnimText>
  );
}
