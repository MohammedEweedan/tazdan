/**
 * Root layout. Sits above every route and provides:
 *   - SafeAreaProvider
 *   - GestureHandlerRootView (required by Reanimated/Gesture Handler)
 *   - React Query client
 *   - Auth bootstrap (hydrate from SecureStore)
 *   - Auth-gated redirect: unauthenticated → /onboarding, authenticated → / (tabs home)
 *   - Splash video while hydration is in flight (NO collision with /(tabs)/index)
 */

// NativeWind globals were removed — see babel.config.js for the rationale.
// import '../global.css';

import { useEffect } from 'react';
import { Image, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SystemUI from 'expo-system-ui';

import { queryClient } from '@/lib/queryClient';
import { setUnauthorizedHandler } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { LoopVideo } from '@/components/ui/LoopVideo';

SystemUI.setBackgroundColorAsync('#000000').catch(() => {});

function AuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isHydrating, hydrate, logout } = useAuthStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => { setUnauthorizedHandler(() => { logout(); }); }, [logout]);

  useEffect(() => {
    if (isHydrating) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      // Logged out → bounce to onboarding.
      router.replace('/onboarding');
    } else if (isAuthenticated && inAuthGroup) {
      // Logged in but still on login/register/onboarding → bounce home.
      // IMPORTANT: do NOT redirect for any other non-tab route, or modal
      // screens like /buy, /sell, /send, /receive, /topup, /cards, /p2p/[id]
      // get killed the instant they open.
      router.replace('/');
    }
  }, [isAuthenticated, isHydrating, segments, router]);

  return null;
}

/** Full-screen splash with looping WebHeader.mp4 + brand icon. Shown only
 *  while the auth store is hydrating from SecureStore on cold start. */
function SplashOverlay() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 1000 }}>
      <LoopVideo
        source={require('../assets/WebHeader.mp4')}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        opacity={0.7}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={require('../assets/icon-color.png')}
          style={{ width: 80, height: 80 }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGate />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: '#000' },
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="buy"      options={{ presentation: 'modal' }} />
            <Stack.Screen name="sell"     options={{ presentation: 'modal' }} />
            <Stack.Screen name="send"     options={{ presentation: 'modal' }} />
            <Stack.Screen name="receive"  options={{ presentation: 'modal' }} />
            <Stack.Screen name="transfer" options={{ presentation: 'modal' }} />
            <Stack.Screen name="topup"    options={{ presentation: 'modal' }} />
            {/* Other routes (cards, history, settings, notifications, referral,
                chat/[id]) are auto-discovered from the `app/` folder. Declaring
                them explicitly here was throwing "No route named X exists in
                nested children" warnings on web. */}
          </Stack>
          <SplashGate />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Render the splash overlay only while auth is hydrating. Once hydration
 *  completes the AuthGate redirect kicks in and the overlay unmounts. */
function SplashGate() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  if (!isHydrating) return null;
  return <SplashOverlay />;
}
