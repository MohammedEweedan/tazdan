import { useThemedPalette } from '@/store/themeStore';
import { Stack } from 'expo-router';

export default function BusinessLayout() {
  const p = useThemedPalette();
  return (
    <Stack
      screenOptions={{
        headerShown:      false,
        contentStyle:     { backgroundColor: p.bg },
        animation:        'slide_from_right',
        gestureEnabled:   true,
      }}
    />
  );
}
