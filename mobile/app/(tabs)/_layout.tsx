/**
 * Tab bar — minimal, theme-aware, icon-only.
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useThemedPalette } from '@/store/themeStore';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index:   'home',
  wallet:  'wallet',
  p2p:     'swap-horizontal',
  profile: 'person',
};

export default function TabsLayout() {
  const p = useThemedPalette();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   p.fg,
        tabBarInactiveTintColor: p.fgFaint,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 82 : 64,
          paddingTop: 12,
          backgroundColor: p.bg,
          borderTopColor: p.border,
          borderTopWidth: 1,
        },
        tabBarIcon: ({ color, focused }) => {
          const base = ICONS[route.name];
          const name = (focused ? base : (`${base}-outline` as keyof typeof Ionicons.glyphMap));
          return <Ionicons name={name} size={24} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home' }} />
      <Tabs.Screen name="wallet"  options={{ title: 'Wallet' }} />
      <Tabs.Screen name="p2p"     options={{ title: 'P2P' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
