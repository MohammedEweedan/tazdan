/**
 * Root layout — SafeAreaProvider, GestureHandler, React Query, auth bootstrap.
 */

import { useEffect, useState, useCallback } from 'react';
import { AppState, Image, I18nManager, Dimensions, StyleSheet, useColorScheme, Pressable, View } from 'react-native';
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
import { useConnectivity } from '@/hooks/useConnectivity';
import { OfflineScreen } from '@/components/ui/OfflineScreen';
import { setUnauthorizedHandler } from '@/lib/api';
import { initObservability } from '@/lib/observability';
import { useAuthStore } from '@/store/authStore';
import { useChatPrefs } from '@/store/chatPrefsStore';
import { authService } from '@/services';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS, STRIPE } from '@/constants';
import { StripeProvider } from '@/lib/stripeShim';
import { usePushDeepLink, registerPushToken } from '@/lib/pushNotifications';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Match the dark palette bg exactly so the system chrome (keyboard toolbar,
// nav bar on Android) never flashes a different shade of black.
SystemUI.setBackgroundColorAsync('#16181C').catch(() => {});

// Force LTR everywhere
try { I18nManager.allowRTL(false); I18nManager.forceRTL(false); } catch { /* noop */ }

function AuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isHydrating, hydrate, logout, lastUser, updateUser, user, needsViewSelection } = useAuthStore();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => { initObservability(); }, []);
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

  // Register the device's Expo push token once per authenticated session.
  // Transactional pushes (deposit confirmed, transfer received, P2P trade
  // updates) are the strongest re-engagement surface a fintech has — the
  // server-side pipeline and the tap deep-linking below were already built,
  // but nothing ever registered the token, so no device received them.
  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken().catch(() => { /* non-fatal; retried next session */ });
    }
  }, [isAuthenticated]);

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
      router.replace(lastUser ? '/(auth)/welcome-back' : hasOnboarded ? '/(auth)/login' : '/(auth)/onboarding');
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
  }, [isAuthenticated, isHydrating, segments, router, hasOnboarded, lastUser, user?.role, needsViewSelection]);

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
        colors={dark ? ['#121418', '#16181C', '#121418'] : ['#FFFFFF', '#FAFAF7', '#FFFFFF']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* WebGL shader lines — exact port of the web ShaderAnimation */}
      <ShaderLines />
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#16181C' }}>
      <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StripeProvider
            publishableKey={STRIPE.publishableKey}
            merchantIdentifier={STRIPE.merchantIdentifier}
            urlScheme="tazdan"
          >
          <StatusBar style="light" />
          <AuthGate />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#16181C' },
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
          <OfflineGate />
          </StripeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

function SplashGate() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  if (!isHydrating) return null;
  return <SplashOverlay />;
}

/**
 * Covers the whole app with the offline screen whenever connectivity drops,
 * so no stale or fabricated balance is ever visible behind it. Sits above the
 * navigator (absolute fill) and disappears the instant we're back online.
 */
function OfflineGate() {
  const { isOnline, refresh } = useConnectivity();
  const [reconnecting, setReconnecting] = useState(false);
  if (isOnline) return null;
  const onRetry = async () => {
    setReconnecting(true);
    try { await refresh(); } finally { setReconnecting(false); }
  };
  return (
    <Animated.View
      style={StyleSheet.absoluteFillObject}
      // Keep above the navigator; tappable so Retry works.
      pointerEvents="auto"
    >
      <OfflineScreen reconnecting={reconnecting} onRetry={onRetry} />
    </Animated.View>
  );
}
