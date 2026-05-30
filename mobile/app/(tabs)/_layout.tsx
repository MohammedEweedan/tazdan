import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, Pressable, Text, View, ActionSheetIOS, Alert } from 'react-native';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useMessageRealtime } from '@/hooks';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  wallet: 'wallet',
  p2p: 'swap-horizontal',
  profile: 'person',
  messages: 'chatbubble-ellipses',
};

const FAB_SIZE = 66;

export default function TabsLayout() {
  const p = useThemedPalette();
  const t = useT();
  const userId = useAuthStore((s) => s.user?.id);
  const themeMode = useTheme((s) => s.mode);
  // FAB is a clean mono disc; the "active" feel comes from a soft
  // halo ring behind it, not a gradient fill. Halo colour matches the
  // primary foreground so it reads on either theme.
  const fabFill = p.fg;
  const fabFg   = p.bg;
  const haloColor = themeMode === 'dark' ? '#FAFAFA' : '#0A0A0B';

  useMessageRealtime(userId);

  const barHeight = Platform.OS === 'ios' ? 80 : 72;

  const handleQuickActions = () => {
    const actions = [t('home.sendMoney'), t('cards.orderCard'), t('nav.wallet'), t('common.cancel')];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: actions, cancelButtonIndex: 3 },
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
          paddingTop: 8,
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
            <BarIcon name={ICONS.messages} focused={focused} color={color} label={t('nav.messages')} />
          ),
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: t('nav.wallet'),
          tabBarIcon: ({ color, focused }) => (
            <BarIcon name={ICONS.wallet} focused={focused} color={color} label={t('nav.wallet')} />
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
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -10,
              }}
            >
              {/* Clean mono disc — no gradient, no concentric rings.
                  The "halo" is a soft shadow glow in the FAB's own
                  colour, picked up by the shadowColor below.  This
                  preserves the lifted feel without painting any
                  visible rings around the button. */}
              <View
                style={{
                  width: FAB_SIZE,
                  height: FAB_SIZE,
                  borderRadius: FAB_SIZE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: fabFill,
                  borderWidth: 3,
                  borderColor: p.bg,
                  shadowColor: haloColor,
                  shadowOpacity: 0.35,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 10,
                }}
              >
                <Image
                  source={require('../../assets/icon-color.png')}
                  style={{ width: FAB_SIZE - 22, height: FAB_SIZE - 22, tintColor: fabFg }}
                  resizeMode="contain"
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
            <BarIcon name={ICONS.p2p} focused={focused} color={color} label={t('nav.p2p')} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, focused }) => (
            <BarIcon name={ICONS.profile} focused={focused} color={color} label={t('nav.profile')} />
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
  label,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  label: string;
}) {
  const iconName = focused
    ? name
    : (`${name}-outline` as keyof typeof Ionicons.glyphMap);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 3, width: '100%' }}>
      <Ionicons name={iconName} size={22} color={color} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontSize: 10,
          fontWeight: focused ? '600' : '400',
          color,
          textAlign: 'center',
          width: '100%',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
