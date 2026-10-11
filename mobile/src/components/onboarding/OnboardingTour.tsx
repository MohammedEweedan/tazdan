import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { OnboardingHero } from '@/components/ui/OnboardingHero';
import { HeaderIconButton } from '@/components/ui/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { LocalePickerModal } from '@/components/ui/LocalePickerModal';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { LOCALE_META, useI18n, useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks/useHaptics';
import { SceneVisual, type SceneKey } from './OnboardingScenes';

const CHAPTERS: SceneKey[] = ['intro', 'wallets', 'funding', 'rate', 'send', 'explore', 'security', 'start'];

/** Shared by first launch and Profile's replayable product guide. No account or network operations here. */
export function OnboardingTour({ onFinish, onLogin, onClose, busy = false }: {
  onFinish: () => void; onLogin?: () => void; onClose?: () => void; busy?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 600);
  const stageH = Math.max(128, Math.min((height - 520) * 0.94, 350));
  const p = useThemedPalette();
  const mode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const locale = useI18n((s) => s.locale);
  const t = useT();
  const h = useHaptics();
  const reduce = useReducedMotion();
  const isAr = locale === 'ar';
  const [page, setPage] = useState(0);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const flat = useRef<FlatList<SceneKey>>(null);
  const currentPage = useRef(0);
  const last = page === CHAPTERS.length - 1;
  const scene = CHAPTERS[page];
  const row = isAr ? 'row-reverse' : 'row';

  // Keep the same chapter centred after rotation or a split-screen resize.
  useEffect(() => { flat.current?.scrollToOffset({ offset: currentPage.current * W, animated: false }); }, [W]);
  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(CHAPTERS.length - 1, index));
    h.selection();
    currentPage.current = next;
    setPage(next);
    flat.current?.scrollToOffset({ offset: next * W, animated: !reduce });
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
        <View style={styles.header}>
          <BrandLogo size={27} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <HeaderIconButton icon="globe-outline" label={LOCALE_META[locale].label} onPress={() => setLanguageOpen(true)} />
            <HeaderIconButton icon={mode === 'light' ? 'sunny-outline' : mode === 'mono' ? 'contrast-outline' : 'moon-outline'} label={`${t('settings.theme')}: ${t(`settings.${mode}`)}`} onPress={toggleTheme} />
            {onClose && <HeaderIconButton icon="close" label={t('common.close')} onPress={onClose} />}
          </View>
        </View>
        <View style={[styles.chapterRow, { flexDirection: row }]}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{t('tour.guide')} <Text style={{ color: p.fgFaint }}> / {String(page + 1).padStart(2, '0')}</Text></Text>
          <Pressable accessibilityRole="button" disabled={last} onPress={() => goTo(CHAPTERS.length - 1)} style={{ minHeight: 36, justifyContent: 'center', opacity: last ? 0 : 1 }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{t('onboard2.skip')}</Text>
          </Pressable>
        </View>
        <FlatList
          ref={flat} data={CHAPTERS} horizontal pagingEnabled bounces={false}
          showsHorizontalScrollIndicator={false} keyExtractor={(item) => item}
          style={{ flex: 1 }} extraData={`${page}-${locale}-${mode}-${W}`}
          getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
          onMomentumScrollEnd={(e) => {
            const next = Math.max(0, Math.min(CHAPTERS.length - 1, Math.round(e.nativeEvent.contentOffset.x / W)));
            currentPage.current = next;
            setPage(next);
          }}
          renderItem={({ item, index }) => (
            <ScrollView aria-hidden={index !== page} accessibilityElementsHidden={index !== page} importantForAccessibility={index === page ? "auto" : "no-hide-descendants"} style={{ width: W }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
              <View style={{ height: stageH, overflow: 'hidden' }} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {index === page && (item === 'intro'
                  ? <OnboardingHero bg={p.bg} />
                  : <Animated.View entering={reduce ? undefined : FadeIn.duration(400)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale: Math.min(1, stageH / 320) }] }}>
                      <SceneVisual scene={item} p={p} t={t} width={W} height={320} isAr={isAr} />
                    </Animated.View>)}
              </View>
              <View style={{ paddingHorizontal: width < 360 ? 20 : 28, alignItems: 'center' }}>
                <Text style={{ color: p.accentText, fontSize: 11, fontWeight: '600', letterSpacing: isAr ? 0 : 1.7, textAlign: 'center', marginTop: 4, marginBottom: 12 }}>{t(`tour.${item}.label`)}</Text>
                <Text accessibilityRole="header" style={{ color: p.fg, fontSize: isAr ? (height < 730 ? 27 : 32) : width < 360 ? 30 : 38, lineHeight: isAr ? (height < 730 ? 42 : 49) : width < 360 ? 36 : 43, fontWeight: '600', letterSpacing: isAr ? 0 : -1.4, textAlign: 'center' }}>{t(`tour.${item}.title`)}</Text>
                <Text style={{ color: p.fgMuted, fontSize: width < 360 ? 14 : 15, lineHeight: isAr ? 26 : 23, textAlign: 'center', marginTop: 14, maxWidth: 360 }}>{t(`tour.${item}.body`)}</Text>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(true)} style={({ pressed }) => ({ flexDirection: row, alignItems: 'center', gap: 6, minHeight: 44, marginTop: 4, opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '600' }}>{t('tour.details')}</Text>
                  <Ionicons name={isAr ? 'arrow-back' : 'arrow-forward'} size={14} color={p.accentText} />
                </Pressable>
              </View>
            </ScrollView>
          )}
        />
        <View style={[styles.footer, { backgroundColor: p.bg }]}>
          <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('tour.back')} disabled={page === 0} onPress={() => goTo(page - 1)} style={{ width: W < 360 ? 36 : 44, height: 44, justifyContent: 'center', alignItems: 'center', opacity: page === 0 ? 0 : 1 }}>
              <Ionicons name={isAr ? 'arrow-forward' : 'arrow-back'} size={20} color={p.fgMuted} />
            </Pressable>
            <View style={{ flexDirection: row, alignItems: 'center' }}>
              {CHAPTERS.map((chapter, i) => (
                <Pressable key={chapter} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${t(`tour.${chapter}.label`)}`} accessibilityState={{ selected: page === i }} onPress={() => goTo(i)} style={{ minWidth: W < 360 ? 22 : 27, height: 44, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ height: 5, width: page === i ? 22 : 5, borderRadius: 3, backgroundColor: page === i ? p.accent : p.divider }} />
                </Pressable>
              ))}
            </View>
            <Text style={{ color: p.fgFaint, fontSize: 11, width: W < 360 ? 36 : 44, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{page + 1} / {CHAPTERS.length}</Text>
          </View>
          <Button label={last ? t(onClose ? 'tour.done' : 'onboard.create') : t('onboard.continue')} onPress={() => last ? onFinish() : goTo(page + 1)} loading={busy} fullWidth size="lg" iconRight={<Ionicons name={isAr ? 'arrow-back' : 'arrow-forward'} size={18} color={p.ctaFg} />} />
          {onLogin && <Pressable accessibilityRole="button" disabled={busy} onPress={onLogin} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}><Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>{t('onboard.haveAccount')}</Text></Pressable>}
        </View>
      </SafeAreaView>
      <LocalePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      <BottomSheet visible={detailsOpen} onClose={() => setDetailsOpen(false)} title={t('tour.details')} subtitle={t(`tour.${scene}.title`).replace('\n', ' ')}>
        {[1, 2].map((n) => (
          <View key={n} style={{ padding: 18, borderRadius: 20, backgroundColor: p.bgRaised, borderWidth: 1, borderColor: p.border, marginBottom: 12 }}>
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600', textAlign: isAr ? 'right' : 'left' }}>{t(`tour.${scene}.detail${n}`)}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: isAr ? 26 : 23, marginTop: 8, textAlign: isAr ? 'right' : 'left' }}>{t(`tour.${scene}.explain${n}`)}</Text>
          </View>
        ))}
        <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 20, textAlign: 'center', paddingVertical: 12 }}>{t('tour.available')}</Text>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
  chapterRow: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26, marginTop: 8 },
  footer: { paddingHorizontal: 24, paddingBottom: 8 },
});
