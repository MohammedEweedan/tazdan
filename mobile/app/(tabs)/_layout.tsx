/**
 * Tab bar — premium fintech layout with a centered floating Home
 * action button.
 *
 * Order (left → right):
 *    Messages · Wallet · [ Home FAB ] · P2P · Profile
 *
 * The Home tab uses a custom `tabBarButton` so its hit-target sits
 * higher than the bar (a 56px brand-blue circle that "floats" above the
 * tab strip). The other four tabs use the default Ionicons rendering
 * with a small focused-state indicator dot for parity with iOS / banking
 * apps like Revolut and Monzo.
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, View } from 'react-native';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useMessageRealtime } from '@/hooks';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index:    'home',
  wallet:   'wallet',
  p2p:      'swap-horizontal',
  profile:  'person',
  messages: 'chatbubble-ellipses',
};

const BRAND_BLUE = '#4a8fe0';
const FAB_SIZE = 56;

export default function TabsLayout() {
  const p = useThemedPalette();
  const barHeight = Platform.OS === 'ios' ? 82 : 68;

  // Mount the messaging websocket bridge for the entire authenticated
  // tab tree so push events arrive whether the user is on Messages,
  // Home, or anywhere else inside the tabs stack.
  const userId = useAuthStore((s) => s.user?.id);
  useMessageRealtime(userId);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   p.fg,
        tabBarInactiveTintColor: p.fgFaint,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: barHeight,
          paddingTop: 12,
          backgroundColor: p.bg,
          borderTopColor: p.border,
          borderTopWidth: 1,
          // Allow the FAB to overflow above the bar.
          overflow: 'visible',
        },
      }}
    >
      {/*
       * Tab order: messages, wallet, [HOME FAB], p2p, profile.
       * Note that expo-router renders tabs in declaration order, so the
       * left-most tab here is the left-most icon on screen. `index` is
       * declared third (the middle slot) and uses a custom tabBarButton
       * to render the elevated FAB.
       */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => <BarIcon name={ICONS.messages} focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, focused }) => <BarIcon name={ICONS.wallet} focused={focused} color={color} />,
        }}
      />

      {/* HOME — center floating action */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // Hide the default icon; the custom button below renders it.
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Home"
              onPress={props.onPress as any}
              onLongPress={props.onLongPress as any}
              style={{
                flex: 1,
                // Pull the button up so the circle floats above the bar.
                marginTop: -FAB_SIZE / 4 - 2,
                alignItems: 'center', justifyContent: 'flex-start',
              }}
            >
              <View style={{
                width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
                backgroundColor: BRAND_BLUE,
                alignItems: 'center', justifyContent: 'center',
                // Soft elevation so it looks lifted above the tab strip.
                shadowColor: BRAND_BLUE,
                shadowOpacity: 0.45,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
                // Subtle ring matches the app's panel border styling.
                borderWidth: 3,
                borderColor: p.bg,
              }}>
                <Ionicons name="home" size={24} color="#fff" />
              </View>
            </Pressable>
          ),
        }}
      />

      <Tabs.Screen
        name="p2p"
        options={{
          title: 'P2P',
          tabBarIcon: ({ color, focused }) => <BarIcon name={ICONS.p2p} focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <BarIcon name={ICONS.profile} focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}

/**
 * Standard tab icon. Renders the filled glyph when focused, outlined
 * otherwise, plus a small dot underneath the active tab so the user
 * always knows where they are on the bar.
 */
function BarIcon({
  name, focused, color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
}) {
  const iconName = (focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap));
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Ionicons name={iconName} size={24} color={color} />
      <View style={{
        width: focused ? 5 : 0, height: focused ? 5 : 0, borderRadius: 3,
        backgroundColor: color,
      }} />
    </View>
  );
}
