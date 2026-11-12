import { Tabs, useRouter } from 'expo-router';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedPalette } from '@/store/themeStore';
import { HomeFab, QuickSelectBackdrop, QuickSelectOverlay, useQuickSelect } from '@/components/nav/QuickSelect';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { useEffect, useMemo } from 'react';
import { useConversations, useMessageRealtime } from '@/hooks';
import { syncAppBadge } from '@/lib/pushNotifications';
import { useWidgetSync } from '@/widgets/useWidgetSync';
import { mixColor, normalizeAccent } from '@/theme/accent';
import { useAvailability } from '@/hooks/useFeatures';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  wallet: 'wallet',
  pay: 'qr-code',
  profile: 'person',
  messages: 'chatbubble-ellipses',
};

export default function TabsLayout() {
  const p = useThemedPalette();
  const t = useT();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  // Staff can hide Pay for everyone or for this account; a locked Pay stays and shows a notice.
  const payHidden = useAvailability().feature('pay').state === 'HIDDEN';

  useMessageRealtime(userId);
  useWidgetSync();

  // Unread chats: a count on the Chats tab and the app-icon badge, both
  // cleared as threads are opened (here or on another device).
  const { data: conversations } = useConversations();
  const unread = useMemo(() => (conversations ?? []).reduce((s, c) => s + c.unread, 0), [conversations]);
  useEffect(() => { if (conversations) syncAppBadge(unread); }, [conversations, unread]);

  // Floating bar: inset from the sides, lifted clear of the home indicator.
  // Screens end above it (sceneStyle), so nothing hides behind the bar.
  const insets = useSafeAreaInsets();
  const BAR_H = 64;
  const SIDE = 40; // margin from each side of the screen
  const barBottom = insets.bottom > 0 ? insets.bottom : 14;
  const active = p.accentFg;
  const inactive = mixColor(p.accentFg, p.accent, 0.4);

  // Hold the home button (or slide up from it) for these.
  const qs = useQuickSelect([
    { key: 'send',    label: t('quick.send'),    icon: 'arrow-up',   onSelect: () => router.push('/send') },
    { key: 'receive', label: t('quick.receive'), icon: 'arrow-down', onSelect: () => router.push('/receive') },
    { key: 'topup',   label: t('quick.topUp'),   icon: 'add',        onSelect: () => router.push('/topup') },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
    <Tabs
      // Floating frosted-glass bar, inset from both sides. The glass is clipped
      // to the rounded shape; the Home disc can still rise above it. The quick
      // select's blur is drawn first, under the bar, so it covers the whole
      // screen around the bar while the bar stays sharp.
      tabBar={(props) => (
        <>
        <QuickSelectBackdrop qs={qs} />
        <View pointerEvents="box-none" style={{ position: 'absolute', left: SIDE, right: SIDE, bottom: barBottom, height: BAR_H }}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 26, overflow: 'hidden' }]}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, {
              borderRadius: 26, backgroundColor: `${normalizeAccent(p.accent) ?? '#24384F'}C7`, // navy glass, 78%
              borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)',
            }]} />
          </View>
          <BottomTabBar {...props} insets={{ top: 0, left: 0, right: 0, bottom: 0 }} />
        </View>
        </>
      )}
      // Switching tabs while the quick select is open closes it.
      screenListeners={{ tabPress: () => { if (qs.mode !== 'closed') qs.close(); } }}
      screenOptions={{
        headerShown: false,
        // The bar is the brand colour; icons and labels are ink on accent,
        // dimmed (not transparent) when inactive so they stay legible.
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarShowLabel: false,
        tabBarItemStyle: { height: BAR_H, paddingTop: 0, paddingBottom: 0 },
        tabBarIconStyle: { width: '100%', height: BAR_H },
        tabBarStyle: {
          // Positioned and painted by the wrapper in `tabBar` below.
          height: BAR_H,
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 4,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          overflow: 'visible',
        },
        // Screens run under the glass bar; their lists end with enough padding to clear it.
        sceneStyle: { backgroundColor: p.bg },
      }}
    >
      <Tabs.Screen
        name="messages"
        options={{
          title: t('nav.messages'),
          tabBarIcon: ({ color, focused }) => (
            <BarIcon name={ICONS.messages} focused={focused} color={color} label={t('nav.messages')} badge={unread} />
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
          // The raised disc, protruding above the bar; hold or slide up for quick actions.
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
        name="pay"
        options={{
          href: payHidden ? null : undefined,
          title: t('nav.pay'),
          tabBarIcon: ({ color, focused }) => (
            <BarIcon name={ICONS.pay} focused={focused} color={color} label={t('nav.pay')} />
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
    <QuickSelectOverlay qs={qs} />
    </View>
  );
}

function BarIcon({
  name,
  focused,
  color,
  label,
  badge = 0,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  label: string;
  /** Unread count, drawn like the inbox's unread pill. */
  badge?: number;
}) {
  const p = useThemedPalette();
  const outline = `${name}-outline` as keyof typeof Ionicons.glyphMap;
  const iconName = !focused && outline in Ionicons.glyphMap ? outline : name;

  return (
    // Bottom padding lifts the icon and name 4pt above the bar's centre line.
    <View style={{ width: '100%', height: 64, alignItems: 'center', justifyContent: 'center', gap: 3, paddingBottom: 8 }}>
      <View style={{
        width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
        backgroundColor: focused ? mixColor(p.accentFg, p.accent, 0.84) : 'transparent',
      }}>
        <Ionicons name={iconName} size={21} color={color} />
        {badge > 0 && (
          <View
            accessibilityLabel={`${badge} unread`}
            style={{
              position: 'absolute', top: -3, left: 28,
              minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9,
              backgroundColor: p.accentFg,
              borderWidth: 1.5, borderColor: p.accent,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: p.accent, fontSize: 9.5, fontWeight: '600' }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          height: 14,
          lineHeight: 14,
          fontSize: 10.5,
          fontWeight: focused ? '700' : '500',
          letterSpacing: 0.1,
          color,
          textAlign: 'center',
          width: '100%',
          paddingHorizontal: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
