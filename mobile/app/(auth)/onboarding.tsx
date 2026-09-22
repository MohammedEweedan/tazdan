/**
 * Onboarding — premium three-slide flow.
 *
 *   Slide 1: Four-row drifting crypto carousel + "One wallet for the world."
 *   Slide 2: Compact in-app finance mockup + "Money, movement, and markets."
 *   Slide 3: Premium launch panel + localized CTA.
 *
 *   Layout: hero pinned to top 58%, title + CTAs in bottom 42%.
 *   Background: single solid colour from the onboarding theme surface.
 */

import { useRef, useState, useEffect } from 'react';
import { useWindowDimensions, FlatList, Image, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useHaptics } from '@/hooks';
import { useTheme, type ThemeMode } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { OnboardingHero } from '@/components/ui/OnboardingHero';
import { LocalePickerModal } from '@/components/ui/LocalePickerModal';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';
import { useAuthStore } from '@/store/authStore';


interface Slide { id: string; titleKey: string; variant: 1 | 2 | 3 }
const SLIDES: Slide[] = [
  { id: 's1', titleKey: 'onboard.title.1', variant: 1 },
  { id: 's2', titleKey: 'onboard.title.2', variant: 2 },
  { id: 's3', titleKey: 'onboard.title.3', variant: 3 },
];

const THEME_OPTIONS: { mode: ThemeMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'light', icon: 'sunny-outline' },
  { mode: 'dark',  icon: 'moon-outline' },
  { mode: 'mono',  icon: 'contrast-outline' },
];

export default function Onboarding() {
  const { width: SCREEN_W } = useWindowDimensions();
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
  const locale = useI18n((s) => s.locale);
  const isAr = locale === 'ar';
  const lastUser = useAuthStore((s) => s.lastUser);

  const [page, setPage] = useState(0);
  const [canShow, setCanShow] = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const flat = useRef<FlatList<Slide>>(null);
  const last = page === SLIDES.length - 1;

  useEffect(() => {
  let alive = true;

  const guardInitialOnboarding = async () => {
    const onboarded = await secureStore.get(STORAGE_KEYS.onboarded).catch(() => null);

    if (!alive) return;

    if (lastUser) {
      router.replace('/(auth)/welcome-back');
      return;
    }

    if (onboarded) {
      router.replace('/(auth)/login');
      return;
    }

    setCanShow(true);
  };

  guardInitialOnboarding();

  return () => {
    alive = false;
  };
}, [lastUser, router]);

  const markOnboardedAndNavigate = async (dest: '/register' | '/login') => {
    await secureStore.set(STORAGE_KEYS.onboarded, 'true');
    router.push(dest);
  };

  const isDark = themeMode !== 'light';
  /* Single solid background — no gradients, no tonal shifts */
  const bg      = themeMode === 'dark' ? '#16181C' : themeMode === 'mono' ? '#0C0C0D' : '#FAFAF7';
  const fg      = isDark ? '#ffffff' : '#0a0a0a';
  const fgFaint = isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.25)';
  const chipBg  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const chipBd  = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const ctaBg   = isDark ? '#ffffff' : '#0a0a0a';
  const ctaFg   = isDark ? '#0a0a0a' : '#ffffff';
  // Active page-dot accent — brand blue on dark/light, grey in mono.
  const dotAccent = themeMode === 'mono' ? ctaBg : '#63A1DB';

  // Header wordmark reacts to the theme: white on dark, black on light, so it
  // flips live when the user toggles the theme button beside it.
  const logoSrc = require("../../assets/logo-color.png");

  if (!canShow) {
    return <View style={{ flex: 1, backgroundColor: bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Hero — pinned to top 50%, transparent, same bg as page ── */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '69%' }}>
        <OnboardingHero bg={bg} variant={SLIDES[page]?.variant ?? 1} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <Animated.View
          entering={FadeIn.duration(500)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 8,
          }}
        >
          <Image
            source={logoSrc}
            style={{ width: 100, height: 28 }}
            resizeMode="contain"
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Language */}
            <Pressable
              onPress={() => { h.selection(); setLangPickerVisible(true); }}
              hitSlop={10}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 12, height: 36, borderRadius: 18,
                backgroundColor: pressed ? chipBg : chipBg,
                borderWidth: 1, borderColor: chipBd,
              })}
            >
              <Ionicons name="globe-outline" size={15} color={fg} />
              <Text style={{ fontSize: 13, color: fg }}>{LOCALE_META[locale].flag}</Text>
            </Pressable>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 3,
              borderRadius: 20,
              backgroundColor: chipBg,
              borderWidth: 1,
              borderColor: chipBd,
            }}>
              {THEME_OPTIONS.map(({ mode, icon }) => {
                const active = themeMode === mode;
                const label = mode === 'mono' ? 'Mono' : mode === 'dark' ? t('settings.dark') : t('settings.light');
                return (
                  <Pressable
                    key={mode}
                    accessibilityLabel={label}
                    onPress={() => { h.selection(); setThemeMode(mode); }}
                    hitSlop={8}
                    style={{
                      minWidth: 54,
                      height: 30,
                      paddingHorizontal: 8,
                      borderRadius: 15,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 4,
                      backgroundColor: active ? ctaBg : 'transparent',
                    }}
                  >
                    <Ionicons name={icon} size={14} color={active ? ctaFg : fg} />
                    <Text style={{ color: active ? ctaFg : fg, fontSize: 10, fontWeight: active ? '800' : '700' }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* ── Slides — title only, large type ── */}
        <FlatList
          ref={flat}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          renderItem={({ item, index }) => {
            const active = index === page;
            const isLast = index === SLIDES.length - 1;
            const title = t(item.titleKey);
            return (
              <View
                style={{
                  width: SCREEN_W,
                  justifyContent: 'flex-end',
                  paddingHorizontal: 32,
                  paddingBottom: isLast ? 12 : 20,
                }}
              >
                {!isLast && (
                  <Animated.View entering={FadeInDown.duration(500).springify().damping(18)}>
                    <Text
                      style={{
                        color: fg,
                        fontSize: isAr ? 34 : 38,
                        fontWeight: '800',
                        // Arabic is a connected script: negative tracking jams
                        // the joined letters, and a tight lineHeight clips the
                        // dots (i'jām). Give it zero tracking + generous height.
                        letterSpacing: isAr ? 0 : -1.3,
                        lineHeight: isAr ? 56 : 44,
                        textAlign: 'center',
                        opacity: active ? 1 : 0.35,
                      }}
                    >
                      {title}
                    </Text>
                  </Animated.View>
                )}
              </View>
            );
          }}
        />

        {/* ── Footer — page dots + CTAs ── */}
        <View style={{ paddingHorizontal: 14, paddingBottom: 8, paddingTop: 18 }}>
          {/* Page dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
            {SLIDES.map((s, i) => (
              <View
                key={s.id}
                style={{
                  height: 4, borderRadius: 2,
                  width: i === page ? 28 : 6,
                  backgroundColor: i === page ? dotAccent : fgFaint,
                }}
              />
            ))}
          </View>

          {/* Primary CTA */}
          <Pressable
            onPress={() => {
              h.medium();
              if (last) markOnboardedAndNavigate('/register');
              else {
                const nextPage = Math.min(page + 1, SLIDES.length - 1);
                setPage(nextPage);
                flat.current?.scrollToOffset({ offset: nextPage * SCREEN_W, animated: true });
              }
            }}
            style={({ pressed }) => ({
              alignSelf: 'stretch',
              height: 56,
              borderRadius: 28,
              backgroundColor: dotAccent,
              opacity: pressed ? 0.82 : 1,
              flexDirection: isAr ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.35 : 0.12,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
              elevation: 3,
            })}
          >
            <Text style={{ color: ctaFg, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }}>
              {last ? t('onboard.join') : t('onboard.continue')}
            </Text>
            {/* Forward arrow — points the way reading flows: right in LTR,
                left in Arabic (RTL). row-reverse above puts it on the
                correct side too. */}
            <Ionicons
              name={isAr ? 'arrow-back' : 'arrow-forward'}
              size={18}
              color={ctaFg}
            />
          </Pressable>

          {/* Secondary CTA */}
          <Pressable
            onPress={() => { h.selection(); markOnboardedAndNavigate('/login'); }}
            style={({ pressed }) => ({
              alignSelf: 'stretch',
              height: 48,
              borderRadius: 24,
              alignItems: 'center', justifyContent: 'center',
              marginTop: 10,
              borderWidth: 1,
              borderColor: chipBd,
              backgroundColor: pressed ? chipBg : 'transparent',
            })}
          >
            <Text style={{ color: fg, fontSize: 15, fontWeight: '500' }}>
              {t('onboard.haveAccount')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <LocalePickerModal visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />
    </View>
  );
}
