import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, View, ActionSheetIOS, Alert } from 'react-native';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useMessageRealtime } from '@/hooks';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  wallet: 'wallet',
  p2p: 'swap-horizontal',
  profile: 'person',
  messages: 'chatbubble-ellipses',
};

const FAB_SIZE = 56;

export default function TabsLayout() {
  const p = useThemedPalette();
  const t = useT();
  const userId = useAuthStore((s) => s.user?.id);

  useMessageRealtime(userId);

  const isDark = p.bg === '#000' || p.bg.toLowerCase().includes('0');
  const BRAND_BLUE = '#ffffff';
  const barHeight = Platform.OS === 'ios' ? 82 : 68;

  const handleQuickActions = () => {
    const actions = [t('home.sendMoney'), t('cards.orderCard'), t('nav.wallet'), t('common.cancel')];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: actions,
          cancelButtonIndex: 3,
        },
        () => {}
      );
    } else {
      Alert.alert(t('home.more'), `• ${t('home.sendMoney')}\n• ${t('cards.orderCard')}\n• ${t('nav.wallet')}`);
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.fg,
        tabBarInactiveTintColor: p.fgFaint,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: barHeight,
          paddingTop: 12,
          backgroundColor: p.bg,
          borderTopColor: p.border,
          borderTopWidth: 1,
          overflow: 'visible',
        },
      }}
    >
      <Tabs.Screen
        name="messages"
        options={{
          title: t('nav.messages'),
          tabBarIcon: ({ color, focused }) => (
            <BarIcon name={ICONS.messages} focused={focused} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: t('nav.wallet'),
          tabBarIcon: ({ color, focused }) => (
            <BarIcon name={ICONS.wallet} focused={focused} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.home')}
              delayLongPress={3000}
              onLongPress={handleQuickActions}
              onPress={props.onPress as any}
              style={{
                flex: 1,
                marginTop: -FAB_SIZE / 3 - 1,
                alignItems: 'center',
                justifyContent: 'flex-start',
              }}
            >
              <View
                style={{
                  width: FAB_SIZE,
                  height: FAB_SIZE,
                  borderRadius: FAB_SIZE / 2,
                  backgroundColor: isDark ? '#000000' : '#ffffff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: BRAND_BLUE,
                  shadowOpacity: 0.45,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 4,
                  borderWidth: 3,
                  borderColor: isDark ? '#1a1a1a' : p.bg,
                  transform: [{ scale: 1.02 }],
                }}
              >
                <Ionicons
                  name="home"
                  size={24}
                  color={isDark ? '#ffffff' : '#000000'}
                />
              </View>
            </Pressable>
          ),
        }}
      />

      <Tabs.Screen
        name="p2p"
        options={{
          title: t('nav.p2p'),
          tabBarIcon: ({ color, focused }) => (
            <BarIcon name={ICONS.p2p} focused={focused} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, focused }) => (
            <BarIcon name={ICONS.profile} focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function BarIcon({
  name,
  focused,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
}) {
  const iconName = focused
    ? name
    : (`${name}-outline` as keyof typeof Ionicons.glyphMap);

  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      <View
        style={{
          padding: focused ? 2 : 0,
          borderRadius: 14,
          backgroundColor: focused ? 'transparent' : 'transparent',
        }}
      >
        <Ionicons name={iconName} size={24} color={color} />
      </View>

      <View
        style={{
          width: focused ? 8 : 0,
          height: focused ? 8 : 0,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
