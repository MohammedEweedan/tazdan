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

import { useRef, useState } from 'react';
import {
  Dimensions, FlatList, Image, Pressable, Text, View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { LoopVideo } from '@/components/ui/LoopVideo';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide { id: string; titleKey: string; bodyKey: string }
const SLIDES: Slide[] = [
  { id: 's1', titleKey: 'onboard.title.1', bodyKey: 'onboard.body.1' },
  { id: 's2', titleKey: 'onboard.title.2', bodyKey: 'onboard.body.2' },
];

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

  // Slide copy lives on a translucent panel so the text always reads
  // clearly over the moving video, in BOTH light + dark themes.
  const renderItem = ({ item, index }: ListRenderItemInfo<Slide>) => {
    const active = index === page;
    return (
      <View
        style={{
          width: SCREEN_W,
          flex: 1,
          paddingHorizontal: 24,
          justifyContent: 'flex-end',
          paddingBottom: 24,
        }}
      >
        <View
          style={{
            backgroundColor: themeMode === 'dark'
              ? 'rgba(0,0,0,0.55)'
              : 'rgba(255,255,255,0.78)',
            borderRadius: 24,
            paddingVertical: 22,
            paddingHorizontal: 22,
            borderWidth: 1,
            borderColor: themeMode === 'dark'
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.06)',
          }}
        >
          <Text
            style={{
              color: p.fg,
              fontSize: 32,
              fontWeight: '800',
              letterSpacing: -0.9,
              lineHeight: 38,
              textAlign: 'center',
              opacity: active ? 1 : 0.4,
            }}
          >
            {t(item.titleKey)}
          </Text>
          <Text
            style={{
              color: p.fgMuted,
              fontSize: 15,
              lineHeight: 22,
              marginTop: 12,
              fontWeight: '500',
              textAlign: 'center',
              opacity: active ? 1 : 0.4,
            }}
          >
            {t(item.bodyKey)}
          </Text>
        </View>
      </View>
    );
  };

  /* Theme-aware gradient stack so the video never washes out the slide copy.
     Dark mode → black-vignette to keep white text legible.
     Light mode → white-vignette + lower video opacity so black text reads. */
  const isDark = themeMode === 'dark';
  const gradient: [string, string, string] = isDark
    ? ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.95)']
    : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.95)'];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Ambient looping video. Opacity drops in light mode so dark text
          on a bright surface still has enough contrast. */}
      <LoopVideo
        source={require('../../assets/WebHeader.mp4')}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        opacity={isDark ? 0.45 : 0.18}
      />
      <LinearGradient
        colors={gradient}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

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
            source={require('../../assets/logo-color.png')}
            style={{ width: 52, height: 52 }}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {/* Lang switcher */}
            <Pressable
              onPress={() => { h.selection(); cycleLocale(); }}
              hitSlop={6}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 10, height: 34, borderRadius: 17,
                backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.10)',
              }}
            >
              <Text style={{ fontSize: 14 }}>{LOCALE_META[locale].flag}</Text>
              <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
                {locale.toUpperCase()}
              </Text>
            </Pressable>

            {/* Theme toggle */}
            <Pressable
              onPress={() => { h.selection(); toggleTheme(); }}
              hitSlop={6}
              style={{
                width: 34, height: 34, borderRadius: 17,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.10)',
              }}
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={16}
                color={p.fg}
              />
            </Pressable>

            {/* Skip */}
            <Pressable
              hitSlop={12}
              onPress={() => { h.selection(); router.push('/login'); }}
              style={{ paddingHorizontal: 8, height: 34, justifyContent: 'center' }}
            >
              <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>
                {t('onboard.skip')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Slides — flex:1 is the fix for the previous black-screen bug ── */}
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
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
          {/* Dots */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            {SLIDES.map((s, i) => (
              <View
                key={s.id}
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: i === page ? 26 : 6,
                  backgroundColor: i === page
                    ? p.fg
                    : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'),
                }}
              />
            ))}
          </View>

          {/* Primary CTA — drop-shadow + chunkier so it pops over the video */}
          <Pressable
            onPress={() => {
              h.medium();
              if (last) router.push('/register');
              else flat.current?.scrollToIndex({ index: page + 1, animated: true });
            }}
            style={({ pressed }) => ({
              height: 58,
              borderRadius: 29,
              backgroundColor: p.ctaBg,
              opacity: pressed ? 0.85 : 1,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 14,
              elevation: 4,
            })}
          >
            <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>
              {last ? t('onboard.create') : t('onboard.continue')}
            </Text>
          </Pressable>

          {/* Secondary — bordered so it reads on bright frames too */}
          <Pressable
            onPress={() => { h.selection(); router.push('/login'); }}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 26,
              alignItems: 'center', justifyContent: 'center',
              marginTop: 10,
              borderWidth: 1.5,
              borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)',
              backgroundColor: pressed
                ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                : 'transparent',
            })}
          >
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>
              {t('onboard.haveAccount')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
