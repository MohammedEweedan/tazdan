import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/ui/ScreenHeader';
import { TopupBody } from '@/components/topup/TopupSheet';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import type { Currency } from '@/types';

export default function Topup() {
  const router = useRouter();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ currency?: string }>();
  const initial = (params.currency as Currency | undefined) || undefined;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <View style={{ paddingTop: insets.top }}>
        <StackHeader title="Top up" backIcon="close" />
      </View>
      <TopupBody
        palette={p}
        initialCurrency={initial}
        onComplete={() => router.back()}
      />
    </View>
  );
}
