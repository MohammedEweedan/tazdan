/**
 * Root layout — SafeAreaProvider, GestureHandler, React Query, auth bootstrap.
 */

import { useEffect, useState } from 'react';
import { AppState, Image } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SystemUI from 'expo-system-ui';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { queryClient } from '@/lib/queryClient';
import { setUnauthorizedHandler } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';

// Match the dark palette bg exactly so the system chrome (keyboard toolbar,
// nav bar on Android) never flashes a different shade of black.
SystemUI.setBackgroundColorAsync('#141518').catch(() => {});

function AuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isHydrating, hydrate, logout, lastUser, updateUser, user, needsViewSelection } = useAuthStore();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);
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

function SplashOverlay() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!isHydrating) {
      const t = setTimeout(() => setShow(false), 900);
      return () => clearTimeout(t);
    }
  }, [isHydrating]);

  if (!show) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(600)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}
    >
      <LinearGradient
        colors={['#ffffff', '#9ca3af', '#000000']}
        locations={[0, 0.5, 1]}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View entering={FadeIn.duration(500)}>
          <Image
            source={require('../assets/icon-color.png')}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#141518' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGate />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#141518' },
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
