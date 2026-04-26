/**
 * Root layout. Sits above every route and provides:
 *   - SafeAreaProvider
 *   - GestureHandlerRootView (required by Reanimated/Gesture Handler)
 *   - React Query client
 *   - Auth bootstrap (hydrate from SecureStore)
 *   - Auth-gated redirect: unauthenticated → (auth), authenticated → (tabs)
 *   - StatusBar set to light (dark mode app)
 */

import '../global.css';

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SystemUI from 'expo-system-ui';

import { queryClient } from '@/lib/queryClient';
import { setUnauthorizedHandler } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

SystemUI.setBackgroundColorAsync('#030818').catch(() => {});

function AuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isHydrating, hydrate, logout } = useAuthStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  // Wire 401 handler — when axios gives up, force a logout + redirect
  useEffect(() => { setUnauthorizedHandler(() => { logout(); }); }, [logout]);

  useEffect(() => {
    if (isHydrating) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const atRoot = (segments as string[]).length === 0;
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/onboarding');
    } else if (isAuthenticated && (inAuthGroup || (!inTabsGroup && atRoot))) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isHydrating, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#030818' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGate />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: '#030818' },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)"  options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)"  options={{ animation: 'fade' }} />
            <Stack.Screen name="buy"           options={{ presentation: 'modal' }} />
            <Stack.Screen name="sell"          options={{ presentation: 'modal' }} />
            <Stack.Screen name="send"          options={{ presentation: 'modal' }} />
            <Stack.Screen name="receive"       options={{ presentation: 'modal' }} />
            <Stack.Screen name="transfer"      options={{ presentation: 'modal' }} />
            <Stack.Screen name="topup"         options={{ presentation: 'modal' }} />
            <Stack.Screen name="cards"         />
            <Stack.Screen name="history"       />
            <Stack.Screen name="settings"      />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="referral"      />
            <Stack.Screen name="chat/[id]"     />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
