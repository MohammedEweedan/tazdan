import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Platform, Pressable, View, ActionSheetIOS, Alert, StyleSheet } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, useMessageRealtime } from '@/hooks';

/** One full turn of the brand asterisk. Slow enough to read as "alive", not busy. */
const MARK_TURN_MS = 24000;

/** The brand asterisk. Blue on the white disc; black in mono. Rotates slowly
 *  unless the OS asks for reduced motion. */
function BrandMark({ size, mono }: { size: number; mono: boolean }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(360, { duration: MARK_TURN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <Animated.Image
      source={mono ? require('../../assets/icon-asterisk-black.png') : require('../../assets/icon-asterisk.png')}
      style={[{ width: size, height: size }, spin]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  wallet: 'wallet',
  p2p: 'swap-horizontal',
  profile: 'person',
  messages: 'chatbubble-ellipses',
};

const FAB_SIZE = 62;
const MARK_SIZE = 30;

export default function TabsLayout() {
  const p = useThemedPalette();
  const t = useT();
  const router = useRouter();
  const h = useHaptics();
  const userId = useAuthStore((s) => s.user?.id);
  // FAB is a CONSTANT white disc carrying the brand asterisk, which rotates
  // slowly. In dark/light it's the blue mark; in mono it's the black mark on
  // the same white disc — pure monochrome.
  const isMono    = p.accentText === p.fg; // mono collapses accent → fg
  const haloColor = isMono ? '#000000' : p.accent;

  useMessageRealtime(userId);

  const insets = useSafeAreaInsets();
  const barHeight = 64 + Math.max(insets.bottom, 12);

  // Long-press on the home mark: the three money moves people reach for most.
  const quickActions: { label: string; href: string }[] = [
    { label: t('quick.send'),    href: '/send' },
    { label: t('quick.receive'), href: '/receive' },
    { label: t('quick.topUp'),   href: '/topup' },
  ];
  const handleQuickActions = () => {
    h.medium();
    const go = (i: number) => { const a = quickActions[i]; if (a) router.push(a.href as any); };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...quickActions.map((a) => a.label), t('common.cancel')], cancelButtonIndex: quickActions.length },
        go,
      );
    } else {
      Alert.alert(t('home.more'), undefined, [
        ...quickActions.map((a, i) => ({ text: a.label, onPress: () => go(i) })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ]);
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accentText,
        tabBarInactiveTintColor: p.fgFaint,
        tabBarShowLabel: false,
        tabBarIconStyle: { width: '100%', height: 46 },
        tabBarStyle: {
          height: barHeight,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.home')}
              accessibilityState={props.accessibilityState}
              accessibilityHint={t('quick.hint')}
              delayLongPress={450}
              onLongPress={handleQuickActions}
              onPress={props.onPress as any}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}
            >
              {({ pressed }) => (
                // White disc lifted out of the bar. The page-coloured ring
                // cuts it cleanly from the bar's hairline; the halo is a soft
                // shadow (blue in dark/light, grey in mono).
                <View
                  style={{
                    marginTop: -22,
                    width: FAB_SIZE,
                    height: FAB_SIZE,
                    borderRadius: FAB_SIZE / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FFFFFF',
                    borderWidth: 4,
                    borderColor: p.bgElev,
                    shadowColor: haloColor,
                    shadowOpacity: 0.16,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 8,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  }}
                >
                  <BrandMark size={MARK_SIZE} mono={isMono} />
                </View>
              )}
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
