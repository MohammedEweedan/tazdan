/** The original drifting crypto wall, using bundled assets so first launch is complete offline. */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CoinIcon } from './CoinIcon';
import { useThemedPalette } from '@/store/themeStore';

const ROWS = [
  ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP'],
  ['USDC', 'LINK', 'ADA', 'DOGE', 'BTC', 'ETH'],
  ['SOL', 'LTC', 'BNB', 'USDT', 'DOT', 'LINK'],
  ['ETH', 'XRP', 'BTC', 'ADA', 'USDC', 'SOL'],
];
const STEP = 86;

function CoinRow({ coins, reverse, index }: { coins: string[]; reverse: boolean; index: number }) {
  const p = useThemedPalette();
  const reduce = useReducedMotion();
  const distance = coins.length * STEP;
  const x = useSharedValue(-distance);
  useEffect(() => {
    x.value = -distance;
    if (!reduce) x.value = withRepeat(withTiming(reverse ? 0 : -distance * 2, { duration: 44000 + index * 4000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [distance, index, reduce, reverse, x]);
  const movement = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View style={[{ flexDirection: 'row', marginBottom: 12 }, movement]}>
      {[...coins, ...coins, ...coins].map((symbol, i) => (
        <View key={`${symbol}-${i}`} style={[styles.tile, { backgroundColor: p.bgElev, borderColor: p.border }]}>
          <CoinIcon symbol={symbol} size={45} />
        </View>
      ))}
    </Animated.View>
  );
}

export const OnboardingHero = memo(function OnboardingHero({ bg }: { bg: string }) {
  return (
    <View style={styles.root} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.wall}>
        {ROWS.map((coins, index) => <CoinRow key={index} coins={coins} index={index} reverse={index % 2 === 1} />)}
      </View>
      <LinearGradient colors={[bg, `${bg}00`, `${bg}00`, bg]} locations={[0, 0.15, 0.78, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  wall: { width: '160%', alignSelf: 'center', transform: [{ rotate: '-14deg' }, { skewX: '-8deg' }] },
  tile: { width: 72, height: 72, marginRight: STEP - 72, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
