/**
 * Onboarding — 2 minimal slides.
 *  - Theme-aware (black or white surface, text inverts)
 *  - i18n-aware (4 locales, RTL flips Arabic)
 *  - Top-right: theme toggle + language switcher
 *
 * KEY BUG NOTE: in the previous version the FlatList had no `flex` so it
 * collapsed to zero height — that's why the screen looked empty. Fixed by
 * giving FlatList `flex: 1` and the renderItem View `flex: 1` too.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Alert, Dimensions, FlatList, Image, Pressable, Text, View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Camera } from 'expo-camera';

import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { LoopVideo } from '@/components/ui/LoopVideo';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide { id: string; titleKey: string; bodyKey: string }
const SLIDES: Slide[] = [
  { id: 's1', titleKey: 'onboard.title.1', bodyKey: 'onboard.body.1' },
  { id: 's2', titleKey: 'onboard.title.2', bodyKey: 'onboard.body.2' },
  { id: 's3', titleKey: 'onboard.permissions.title', bodyKey: 'onboard.permissions.body' },
];

async function requestAllPermissions() {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.requestPermissionsAsync();
  } catch {}
  try {
    await Camera.requestCameraPermissionsAsync();
  } catch {}
  try {
    const hasBio = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasBio && enrolled) {
      await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable Face ID / biometric sign-in',
        cancelLabel: 'Skip',
        disableDeviceFallback: true,
      });
    }
  } catch {}
}

export default function Onboarding() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const locale = useI18n((s) => s.locale);
  const cycleLocale = useI18n((s) => s.cycle);

  const [page, setPage] = useState(0);
  const flat = useRef<FlatList<Slide>>(null);
  const last = page === SLIDES.length - 1;
  const onPermissionsSlide = page === 2;

  // Request permissions when the user reaches the permissions slide.
  useEffect(() => {
    if (onPermissionsSlide) requestAllPermissions();
  }, [onPermissionsSlide]);

  const markOnboardedAndNavigate = async (dest: '/register' | '/login') => {
    await secureStore.set(STORAGE_KEYS.onboarded, 'true');
    router.push(dest);
  };

  // Slide copy lives on a translucent panel so the text always reads
  // clearly over the moving video, in BOTH light + dark themes.
  const renderItem = ({ item, index }: ListRenderItemInfo<Slide>) => {
    const active = index === page;
    return (
      <View
        style={{
          width: SCREEN_W,
          flex: 1,
          paddingHorizontal: 32,
          justifyContent: 'flex-end',
          paddingBottom: 40,
        }}
      >
        <Text
          style={{
            color: p.fg,
            fontSize: 40,
            fontWeight: '800',
            letterSpacing: -1.2,
            lineHeight: 46,
            textAlign: 'left',
            opacity: active ? 1 : 0.4,
          }}
        >
          {t(item.titleKey)}
        </Text>
        <Text
          style={{
            color: p.fgMuted,
            fontSize: 17,
            lineHeight: 24,
            marginTop: 16,
            fontWeight: '500',
            textAlign: 'left',
            opacity: active ? 1 : 0.4,
          }}
        >
          {t(item.bodyKey)}
        </Text>
      </View>
    );
  };

  const isDark = themeMode === 'dark';
  
  // A premium fintech feel: let the video play in the top 60%, and 
  // fade it out smoothly into the solid background color at the bottom
  // where the clean typography and buttons live.
  const gradient: [string, string, string, string] = isDark
    ? ['rgba(15,17,23,0)', 'rgba(15,17,23,0.4)', 'rgba(15,17,23,0.95)', p.bg]
    : ['rgba(245,245,247,0)', 'rgba(245,245,247,0.4)', 'rgba(245,245,247,0.95)', p.bg];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Video pinned to the top half */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '70%' }}>
        <LoopVideo
          source={require('../../assets/WebHeader.mp4')}
          style={{ width: '100%', height: '100%' }}
          opacity={isDark ? 0.6 : 0.8}
        />
        <LinearGradient
          colors={gradient}
          locations={[0, 0.4, 0.7, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Top bar ── */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 4,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Image
            source={isDark ? require('../../assets/logo-white.png') : require('../../assets/logo-black.png')}
            style={{ width: 120, height: 32 }}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {/* Lang switcher */}
            <Pressable
              onPress={() => { h.selection(); cycleLocale(); }}
              hitSlop={6}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, height: 36, borderRadius: 18,
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }}
            >
              <Text style={{ fontSize: 14 }}>{LOCALE_META[locale].flag}</Text>
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 }}>
                {locale.toUpperCase()}
              </Text>
            </Pressable>

            {/* Theme toggle */}
            <Pressable
              onPress={() => { h.selection(); toggleTheme(); }}
              hitSlop={6}
              style={{
                width: 36, height: 36, borderRadius: 18,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }}
            >
              <Ionicons
                name={isDark ? 'sunny' : 'moon'}
                size={18}
                color={p.fg}
              />
            </Pressable>
          </View>
        </View>

        {/* ── Slides ── */}
        <FlatList
          ref={flat}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          renderItem={renderItem}
        />

        {/* ── Footer ── */}
        <View style={{ paddingHorizontal: 32, paddingBottom: 24, paddingTop: 10 }}>
          {/* Dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 6, marginBottom: 32 }}>
            {SLIDES.map((s, i) => (
              <View
                key={s.id}
                style={{
                  height: 4,
                  borderRadius: 2,
                  width: i === page ? 24 : 8,
                  backgroundColor: i === page
                    ? p.fg
                    : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                }}
              />
            ))}
          </View>

          {/* Primary CTA */}
          <Pressable
            onPress={() => {
              h.medium();
              if (last) markOnboardedAndNavigate('/register');
              else flat.current?.scrollToIndex({ index: page + 1, animated: true });
            }}
            style={({ pressed }) => ({
              height: 56,
              borderRadius: 28,
              backgroundColor: p.fg,
              opacity: pressed ? 0.8 : 1,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: p.fg,
              shadowOpacity: 0.15,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
              elevation: 3,
            })}
          >
            <Text style={{ color: p.bg, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
              {last ? t('onboard.create') : t('onboard.continue')}
            </Text>
          </Pressable>

          {/* Secondary CTA */}
          <Pressable
            onPress={() => { h.selection(); markOnboardedAndNavigate('/login'); }}
            style={({ pressed }) => ({
              height: 56,
              borderRadius: 28,
              alignItems: 'center', justifyContent: 'center',
              marginTop: 12,
              backgroundColor: pressed
                ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                : 'transparent',
            })}
          >
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}>
              {t('onboard.haveAccount')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
