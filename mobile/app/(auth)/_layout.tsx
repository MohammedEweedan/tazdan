import { useThemedPalette } from '@/store/themeStore';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  const p = useThemedPalette();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: p.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="welcome-back" options={{ animation: 'fade' }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="recover-2fa" />
      <Stack.Screen name="kyc" />
    </Stack>
  );
}
