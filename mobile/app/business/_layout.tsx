import { Stack } from 'expo-router';
import { useTheme } from '@/store/themeStore';
import { palettes } from '@/store/themeStore';

export default function BusinessLayout() {
  const mode = useTheme((s) => s.mode);
  const p = palettes[mode];
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
