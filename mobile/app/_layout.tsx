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
import { LaunchSplash, SPLASH_NAVY } from '@/components/ui/LaunchSplash';
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

import { useTheme, useThemedPalette } from '@/store/themeStore';
import { queryClient } from '@/lib/queryClient';
import { useConnectivity } from '@/hooks/useConnectivity';
import { OfflineScreen } from '@/components/ui/OfflineScreen';
import { setUnauthorizedHandler } from '@/lib/api';
import { initObservability } from '@/lib/observability';
import { useAuthStore } from '@/store/authStore';
import { useChatPrefs } from '@/store/chatPrefsStore';
import { useI18n } from '@/store/i18nStore';
import { authService } from '@/services';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS, STRIPE } from '@/constants';
import { StripeProvider } from '@/lib/stripeShim';
import { usePushDeepLink, registerPushToken } from '@/lib/pushNotifications';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AvailabilityGate } from '@/components/ui/AvailabilityGate';

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
  // Re-registered when the language changes so pushes arrive in it.
  const locale = useI18n((s) => s.locale);
  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken(locale).catch(() => { /* non-fatal; retried next session */ });
    }
  }, [isAuthenticated, locale]);

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


export default function RootLayout() {
  const p = useThemedPalette();
  const mode = useTheme((s) => s.mode);
  useEffect(() => { SystemUI.setBackgroundColorAsync(p.bg).catch(() => {}); }, [p.bg]);
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

  // Block rendering until custom fonts are ready so no FOUT on first frame —
  // same navy as the native launch screen, so there is no flash.
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: SPLASH_NAVY }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.bg }}>
      <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StripeProvider
            publishableKey={STRIPE.publishableKey}
            merchantIdentifier={STRIPE.merchantIdentifier}
            urlScheme="tazdan"
          >
          <StatusBar style={mode === "light" ? "dark" : "light"} />
          <AuthGate />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: p.bg },
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="role-select" options={{ animation: 'fade' }} />
            {/* Money moves are full pages (pushed, swipe-back), never sheets. */}
            <Stack.Screen name="buy"      options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="sell"     options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="send"     options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="pay/[payee]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="lydt/convert" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="receive"  options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="transfer" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="topup"    options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="withdraw" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="recurring" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <AvailabilityGate />
          <SplashGate />
          <OfflineGate />
          </StripeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

/** Animated ن launch mark until auth state has loaded (see LaunchSplash). */
function SplashGate() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return <LaunchSplash ready={!isHydrating} onGone={() => setGone(true)} />;
}

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
