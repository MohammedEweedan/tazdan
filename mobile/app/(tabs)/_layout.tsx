import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, Pressable, Text, View, ActionSheetIOS, Alert } from 'react-native';
import { useThemedPalette, useTheme, brand } from '@/store/themeStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useMessageRealtime } from '@/hooks';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  wallet: 'wallet',
  p2p: 'swap-horizontal',
  profile: 'person',
  messages: 'chatbubble-ellipses',
};

const FAB_SIZE = 62;

export default function TabsLayout() {
  const p = useThemedPalette();
  const t = useT();
  const userId = useAuthStore((s) => s.user?.id);
  const themeMode = useTheme((s) => s.mode);
  const brandAccent = themeMode === 'dark' ? brand.primaryDark : brand.primary;

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
        tabBarActiveTintColor: brandAccent,
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
              <View
                style={{
                  width: FAB_SIZE,
                  height: FAB_SIZE,
                  borderRadius: FAB_SIZE / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: brandAccent,
                  shadowOpacity: 0.55,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 10,
                  borderWidth: 3,
                  borderColor: p.bg,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={[brand.primaryDark, brand.primary, brand.deep]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={{
                    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                    borderRadius: FAB_SIZE / 2,
                  }}
                />
                <Image
                  source={require('../../assets/icon-color.png')}
                  style={{ width: FAB_SIZE - 18, height: FAB_SIZE - 18, tintColor: '#ffffff' }}
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
