/**
 * Covers a "start something new" screen (Send, Top up, Convert…) when staff
 * have locked or hidden its feature for this account — including when it is
 * reached from a deep link, a QR code or a notification. The server refuses
 * the activity anyway; this keeps the customer from filling in a form that
 * can't go through.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { featureForRoute, useAvailability } from '@/hooks/useFeatures';

export function AvailabilityGate() {
  const path = usePathname();
  const router = useRouter();
  const avail = useAvailability();
  const p = useThemedPalette();
  const t = useT();
  const feature = featureForRoute(path);
  if (!feature || !avail.loaded) return null;
  const a = avail.feature(feature);
  if (a.state === 'AVAILABLE') return null;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: p.pillBg }}>
          <Ionicons name="lock-closed" size={28} color={p.fg} />
        </View>
        <Text style={{ color: p.fg, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
          {t(a.state === 'LOCKED' ? 'avail.lockedTitle' : 'avail.hiddenTitle')}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
          {a.message || t('avail.lockedBody')}
        </Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={({ pressed }) => ({ marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: p.accent, opacity: pressed ? 0.85 : 1 })}
        >
          <Text style={{ color: p.accentFg, fontSize: 15, fontWeight: '700' }}>{t('avail.back')}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
