/**
 * Root layout — SafeAreaProvider, GestureHandler, React Query, auth bootstrap.
 */

import { useEffect, useState } from 'react';
import { AppState, Image, I18nManager, Dimensions, StyleSheet, useColorScheme } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SystemUI from 'expo-system-ui';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ShaderLines } from '@/components/ui/ShaderLines';
import {
  useFonts,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import {
  Cairo_300Light,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';

import { queryClient } from '@/lib/queryClient';
import { setUnauthorizedHandler } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useChatPrefs } from '@/store/chatPrefsStore';
import { authService } from '@/services';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS, STRIPE } from '@/constants';
import { StripeProvider } from '@/lib/stripeShim';
import { usePushDeepLink } from '@/lib/pushNotifications';

// Match the dark palette bg exactly so the system chrome (keyboard toolbar,
// nav bar on Android) never flashes a different shade of black.
SystemUI.setBackgroundColorAsync('#0A0A0B').catch(() => {});

// Force LTR everywhere
try { I18nManager.allowRTL(false); I18nManager.forceRTL(false); } catch { /* noop */ }

function AuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isHydrating, hydrate, logout, lastUser, updateUser, user, needsViewSelection } = useAuthStore();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);
  // Pull persisted chat prefs (pins, contacts, read-receipts) once
  // per cold start so the conversation list paints in the user's
  // preferred order on first render.
  const hydrateChatPrefs = useChatPrefs((s) => s.hydrate);
  useEffect(() => { hydrateChatPrefs(); }, [hydrateChatPrefs]);
  useEffect(() => { setUnauthorizedHandler(() => { logout(); }); }, [logout]);
  useEffect(() => {
    secureStore.get(STORAGE_KEYS.onboarded).then((v) => setHasOnboarded(!!v));
  }, []);

  // Re-fetch /me whenever the app comes back to the foreground so the
  // handle, avatar, and other profile fields are always fresh — no reload needed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isAuthenticated) {
        authService.me().then((user) => updateUser(user)).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, updateUser]);

  useEffect(() => {
    if (isHydrating || hasOnboarded === null) return;
    const inAuthGroup       = segments[0] === '(auth)';
    const inRoleSelect      = segments[0] === 'role-select';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace(hasOnboarded ? (lastUser ? '/(auth)/welcome-back' : '/(auth)/login') : '/(auth)/onboarding');
    } else if (isAuthenticated && inAuthGroup) {
      // Just authenticated — admins get the role chooser, everyone else goes home.
      if (user?.role === 'ADMIN' && needsViewSelection) {
        router.replace('/role-select' as any);
      } else {
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && needsViewSelection && !inRoleSelect && user?.role === 'ADMIN') {
      router.replace('/role-select' as any);
    }
  }, [isAuthenticated, isHydrating, segments, router, hasOnboarded, user?.role, needsViewSelection]);

  return null;
}

const { height: SH } = Dimensions.get('screen');

function SplashOverlay() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const [show, setShow] = useState(true);
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  const scanY = useSharedValue(0);

  useEffect(() => {
    scanY.value = withRepeat(
      withTiming(SH, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, []);

  useEffect(() => {
    if (!isHydrating) {
      const t = setTimeout(() => setShow(false), 900);
      return () => clearTimeout(t);
    }
  }, [isHydrating]);

  const scanStyle = useAnimatedStyle(() => {
    const progress = scanY.value / SH;
    const opacity = progress < 0.1 ? progress / 0.1 * 0.7
                  : progress > 0.9 ? (1 - progress) / 0.1 * 0.7
                  : 0.7;
    return {
      transform: [{ translateY: scanY.value - SH * 0.5 }],
      opacity,
    };
  });

  if (!show) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(700)}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      {/* Base — inverts with system colour scheme */}
      <LinearGradient
        colors={dark ? ['#000000', '#0A0A0B', '#000000'] : ['#FFFFFF', '#FAFAF7', '#FFFFFF']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* WebGL shader lines — exact port of the web ShaderAnimation */}
      <ShaderLines />

      {/* Moving scan beam */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: SH * 0.5,
            height: SH * 0.5,
          },
          scanStyle,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.08)', 'transparent']}
          locations={[0, 0.3, 0.5, 0.7, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* Logo */}
      <Animated.View
        entering={FadeIn.duration(600).delay(100)}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
        pointerEvents="none"
      >
        <Image
          source={dark ? require('../assets/icon-white.png') : require('../assets/icon-black.png')}
          style={{ width: 160, height: 64 }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
    Cairo_300Light,
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
  });

  // Listen for push taps and route to the relevant receipt screen.
  usePushDeepLink();

  // Block rendering until custom fonts are ready so no FOUT on first frame.
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0B' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StripeProvider
            publishableKey={STRIPE.publishableKey}
            merchantIdentifier={STRIPE.merchantIdentifier}
            urlScheme="promrkts"
          >
          <StatusBar style="light" />
          <AuthGate />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#0A0A0B' },
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="role-select" options={{ animation: 'fade' }} />
            <Stack.Screen name="buy"      options={{ presentation: 'modal' }} />
            <Stack.Screen name="sell"     options={{ presentation: 'modal' }} />
            <Stack.Screen name="send"     options={{ presentation: 'modal' }} />
            <Stack.Screen name="receive"  options={{ presentation: 'modal' }} />
            <Stack.Screen name="transfer" options={{ presentation: 'modal' }} />
            <Stack.Screen name="topup"    options={{ presentation: 'modal' }} />
          </Stack>
          <SplashGate />
          </StripeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function SplashGate() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  if (!isHydrating) return null;
  return <SplashOverlay />;
}
