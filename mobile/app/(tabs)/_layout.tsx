import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedPalette } from '@/store/themeStore';
import { HomeFab, QuickSelectOverlay, useQuickSelect } from '@/components/nav/QuickSelect';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useMessageRealtime } from '@/hooks';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  wallet: 'wallet',
  p2p: 'swap-horizontal',
  profile: 'person',
  messages: 'chatbubble-ellipses',
};

export default function TabsLayout() {
  const p = useThemedPalette();
  const t = useT();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  useMessageRealtime(userId);

  // Short bar: the home indicator already sits in the inset, so only part of
  // it is added as padding.
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom > 0 ? Math.max(insets.bottom - 16, 10) : 10;
  const barHeight = 56 + bottomPad;

  // Hold the home button (or slide up from it) for these.
  const qs = useQuickSelect([
    { key: 'send',    label: t('quick.send'),    icon: 'arrow-up',   onSelect: () => router.push('/send') },
    { key: 'receive', label: t('quick.receive'), icon: 'arrow-down', onSelect: () => router.push('/receive') },
    { key: 'topup',   label: t('quick.topUp'),   icon: 'add',        onSelect: () => router.push('/topup') },
  ]);

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      // Switching tabs while the quick select is open closes it.
      screenListeners={{ tabPress: () => { if (qs.mode !== 'closed') qs.close(); } }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accentText,
        tabBarInactiveTintColor: p.fgFaint,
        tabBarShowLabel: false,
        tabBarIconStyle: { width: '100%', height: 46 },
        tabBarStyle: {
          height: barHeight,
          paddingTop: 6,
          paddingBottom: bottomPad,
          backgroundColor: p.bgElev,
          borderTopColor: p.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
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
            <HomeFab
              qs={qs}
              onPress={() => props.onPress?.(undefined as any)}
              label={t('nav.home')}
              hint={t('quick.hint')}
              selected={props.accessibilityState?.selected}
            />
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
    <QuickSelectOverlay qs={qs} barHeight={barHeight} />
    </View>
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
  const p = useThemedPalette();
  const outline = `${name}-outline` as keyof typeof Ionicons.glyphMap;
  const iconName = !focused && outline in Ionicons.glyphMap ? outline : name;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%' }}>
      <Ionicons name={iconName} size={21} color={color} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontSize: 10.5,
          fontWeight: focused ? '600' : '500',
          letterSpacing: 0.1,
          color,
          textAlign: 'center',
          width: '100%',
        }}
      >
        {label}
      </Text>
      {/* Active marker — a small accent dot, the one bit of colour in the bar. */}
      <View style={{
        width: 4, height: 4, borderRadius: 2, marginTop: -1,
        backgroundColor: focused ? p.accent : 'transparent',
      }} />
    </View>
  );
}
