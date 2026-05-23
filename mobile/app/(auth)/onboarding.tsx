/**
 * Onboarding — fintech vibes.
 *
 *   • Logo top-left.
 *   • Language switcher (globe icon → LocalePickerModal) + dark mode toggle top-right.
 *   • Hero: scrolling crypto ticker tape fills the top 58%.
 *   • Slide content: title + body only — no eyebrow badge.
 *   • Full-width brand-blue CTAs.
 */

import { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, View, type ListRenderItemInfo } from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Camera } from 'expo-camera';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useHaptics } from '@/hooks';
import { useTheme } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { OnboardingHero } from '@/components/ui/OnboardingHero';
import { LocalePickerModal } from '@/components/ui/LocalePickerModal';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide { id: string; titleKey: string; bodyKey: string; variant: 1 | 2 | 3 }
const SLIDES: Slide[] = [
  { id: 's1', titleKey: 'onboard.title.1', bodyKey: 'onboard.body.1', variant: 1 },
  { id: 's2', titleKey: 'onboard.title.2', bodyKey: 'onboard.body.2', variant: 2 },
  { id: 's3', titleKey: 'onboard.permissions.title', bodyKey: 'onboard.permissions.body', variant: 3 },
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
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const locale = useI18n((s) => s.locale);

  const [page, setPage] = useState(0);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const flat = useRef<FlatList<Slide>>(null);
  const last = page === SLIDES.length - 1;
  const onPermissionsSlide = page === 2;

  useEffect(() => { if (onPermissionsSlide) requestAllPermissions(); }, [onPermissionsSlide]);

  const markOnboardedAndNavigate = async (dest: '/register' | '/login') => {
    await secureStore.set(STORAGE_KEYS.onboarded, 'true');
    router.push(dest);
  };

  const isDark = themeMode === 'dark';

  // Fintech gradient palette
  const bg      = isDark ? '#06112b' : '#eef3ff';
  const fg      = isDark ? '#ffffff' : '#0d1b4b';
  const fgMuted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(13,27,75,0.65)';
  const fgFaint = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(13,27,75,0.38)';
  const chipBg  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(13,27,75,0.07)';
  const chipBd  = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(13,27,75,0.14)';
  const ctaBg   = '#226dff';
  const ctaFg   = '#ffffff';

  const LOGO_W = 96;
  const LOGO_H = 26;
  const logoSrc = isDark
    ? require('../../assets/logo-white.png')
    : require('../../assets/logo-black.png');

  const renderItem = ({ item, index }: ListRenderItemInfo<Slide>) => {
    const active = index === page;
    return (
      <View
        style={{
          width: SCREEN_W,
          flex: 1,
          paddingHorizontal: 28,
          justifyContent: 'flex-end',
          paddingBottom: 28,
        }}
      >
        <Animated.View entering={FadeInDown.duration(500).springify().damping(18)}>
          {/* Title — bold, no eyebrow above it */}
          <Text
            style={{
              color: fg,
              fontSize: 40,
              fontWeight: '800',
              letterSpacing: -1.4,
              lineHeight: 44,
              textAlign: 'center',
              opacity: active ? 1 : 0.4,
            }}
          >
            {t(item.titleKey)}
          </Text>

          {/* Body */}
          <Text
            style={{
              color: fgMuted,
              fontSize: 16,
              lineHeight: 24,
              marginTop: 16,
              fontWeight: '500',
              textAlign: 'center',
              opacity: active ? 1 : 0.4,
              paddingHorizontal: 4,
            }}
          >
            {t(item.bodyKey)}
          </Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Hero pinned to top 58% */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '58%' }}>
        <OnboardingHero fg={fg} bg={bg} variant={SLIDES[page]?.variant ?? 1} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header: logo top-left, controls top-right */}
        <Animated.View
          entering={FadeIn.duration(500)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 12,
          }}
        >
          {/* Logo — top left */}
          <Image source={logoSrc} style={{ width: LOGO_W, height: LOGO_H }} resizeMode="contain" />

          {/* Controls — top right: globe (language) + theme toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Language — globe icon + flag, opens LocalePickerModal (same as profile) */}
            <Pressable
              onPress={() => { h.selection(); setLangPickerVisible(true); }}
              hitSlop={10}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 10, height: 34, borderRadius: 17,
                backgroundColor: pressed ? chipBg : chipBg,
                borderWidth: 1, borderColor: chipBd,
              })}
            >
              <Ionicons name="globe-outline" size={15} color={fg} />
              <Text style={{ fontSize: 13 }}>{LOCALE_META[locale].flag}</Text>
            </Pressable>

            {/* Theme toggle */}
            <Pressable
              onPress={() => { h.selection(); toggleTheme(); }}
              hitSlop={10}
              style={{
                width: 34, height: 34, borderRadius: 17,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: chipBg,
                borderWidth: 1, borderColor: chipBd,
              }}
            >
              <Ionicons name={isDark ? 'sunny' : 'moon'} size={15} color={fg} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Slides */}
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

        {/* Footer — dots + full-width CTAs */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            {SLIDES.map((s, i) => (
              <View
                key={s.id}
                style={{
                  height: 4, borderRadius: 2,
                  width: i === page ? 28 : 6,
                  backgroundColor: i === page ? ctaBg : fgFaint,
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
              alignSelf: 'stretch',
              height: 58,
              borderRadius: 29,
              backgroundColor: ctaBg,
              opacity: pressed ? 0.85 : 1,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: ctaBg,
              shadowOpacity: 0.28,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 20,
              elevation: 4,
            })}
          >
            <Text style={{ color: ctaFg, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }}>
              {last ? t('onboard.create') : t('onboard.continue')}
            </Text>
          </Pressable>

          {/* Secondary */}
          <Pressable
            onPress={() => { h.selection(); markOnboardedAndNavigate('/login'); }}
            style={({ pressed }) => ({
              alignSelf: 'stretch',
              height: 52,
              borderRadius: 26,
              alignItems: 'center', justifyContent: 'center',
              marginTop: 10,
              borderWidth: 1,
              borderColor: chipBd,
              backgroundColor: pressed ? chipBg : 'transparent',
            })}
          >
            <Text style={{ color: fg, fontSize: 15, fontWeight: '600' }}>
              {t('onboard.haveAccount')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <LocalePickerModal visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />
    </View>
  );
}
