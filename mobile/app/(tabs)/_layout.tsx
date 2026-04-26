/**
 * Tab bar — 4 tabs (Home / Wallet / P2P / Profile). Custom dark glass surface,
 * brand-blue active tint, hairline top border. iOS-style centered icons.
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index:   'home',
  wallet:  'wallet',
  p2p:     'swap-horizontal',
  profile: 'person',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   '#4A8FE0',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.40)',
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: {
          position: 'absolute',
          height: Platform.OS === 'ios' ? 86 : 72,
          paddingTop: 8,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#070d22',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={{ flex: 1, backgroundColor: 'rgba(7,13,34,0.72)' }} />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#070d22' }} />
          ),
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline` as never} size={22} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home' }} />
      <Tabs.Screen name="wallet"  options={{ title: 'Wallet' }} />
      <Tabs.Screen name="p2p"     options={{ title: 'P2P' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
