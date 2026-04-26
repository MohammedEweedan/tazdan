/**
 * 3-page onboarding carousel. Premium reveal animation per slide using Moti.
 * Bottom CTA changes to "Get Started" on the last slide.
 */

import { useState, useRef } from 'react';
import { Dimensions, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { Button } from '@/components/ui/Button';
import { gradients } from '@/theme';
import { useHaptics } from '@/hooks/useHaptics';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SLIDES: Slide[] = [
  {
    id: 's1',
    eyebrow: 'CRYPTO + FIAT',
    title: 'One wallet for everything you spend.',
    body: 'BTC, ETH, USDT, EUR, AED, SAR — held side by side. Convert, send and spend in seconds.',
    icon: 'wallet',
  },
  {
    id: 's2',
    eyebrow: 'BUY · SELL · TRADE',
    title: 'Markets that move at your speed.',
    body: 'Live Binance prices, premium charts, and 0.1% fees. Trade or schedule recurring buys.',
    icon: 'trending-up',
  },
  {
    id: 's3',
    eyebrow: 'GLOBAL P2P',
    title: 'Send to anyone. Anywhere.',
    body: 'Pay friends with @handles, swap fiat over P2P with verified traders in 120+ countries.',
    icon: 'globe',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const h = useHaptics();
  const [page, setPage] = useState(0);
  const flatRef = useRef<FlatList<Slide>>(null);

  const last = page === SLIDES.length - 1;

  const next = () => {
    h.light();
    if (last) router.push('/(auth)/login');
    else flatRef.current?.scrollToIndex({ index: page + 1, animated: true });
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="px-5 pt-3 flex-row justify-end">
          <Pressable
            hitSlop={12}
            onPress={() => { h.selection(); router.push('/(auth)/login'); }}
            className="px-3 py-2"
          >
            <Text className="text-ink-tertiary text-sm font-semibold">Skip</Text>
          </Pressable>
        </View>

        <FlatList
          ref={flatRef}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          renderItem={({ item, index }) => (
            <View style={{ width: SCREEN_W, paddingHorizontal: 28, justifyContent: 'center' }}>
              <MotiView
                from={{ opacity: 0, translateY: 30, scale: 0.92 }}
                animate={page === index ? { opacity: 1, translateY: 0, scale: 1 } : { opacity: 0.4, translateY: 10, scale: 0.96 }}
                transition={{ type: 'timing', duration: 480 }}
              >
                <LinearGradient
                  colors={[...gradients.brand]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    width: 96, height: 96, borderRadius: 28,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 32,
                    shadowColor: '#0057B8', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 16 },
                  }}
                >
                  <Ionicons name={item.icon} size={42} color="#fff" />
                </LinearGradient>

                <Text style={{ color: '#4A8FE0', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 }}>
                  {item.eyebrow}
                </Text>
                <Text className="text-ink-primary mt-3" style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.8, lineHeight: 40 }}>
                  {item.title}
                </Text>
                <Text className="text-ink-secondary mt-4" style={{ fontSize: 15, lineHeight: 22 }}>
                  {item.body}
                </Text>
              </MotiView>
            </View>
          )}
        />

        <View className="px-7 pb-2">
          <View className="flex-row justify-center mb-7" style={{ gap: 6 }}>
            {SLIDES.map((s, i) => (
              <View
                key={s.id}
                style={{
                  height: 6, borderRadius: 3,
                  width: i === page ? 26 : 6,
                  backgroundColor: i === page ? '#4A8FE0' : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </View>
          <Button
            label={last ? 'Get started' : 'Continue'}
            size="lg"
            fullWidth
            onPress={next}
            iconRight={<Ionicons name="arrow-forward" size={18} color="#fff" />}
          />
          <View className="flex-row items-center justify-center mt-4">
            <Text className="text-ink-tertiary text-sm">Already have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={6}>
              <Text className="text-brand-400 text-sm font-bold">Log in</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
