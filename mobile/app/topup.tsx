import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
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
      <View style={{
        paddingTop: insets.top + 2,
        paddingHorizontal: 18,
        height: insets.top + 54,
        justifyContent: 'center',
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({
            position: 'absolute',
            left: 16,
            bottom: 8,
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? p.bgElev : p.pillBg,
            borderWidth: 1,
            borderColor: p.border,
          })}
        >
          <Ionicons name="close" size={20} color={p.fg} />
        </Pressable>
        <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
          Top up
        </Text>
      </View>
      <TopupBody
        palette={p}
        initialCurrency={initial}
        onComplete={() => router.back()}
      />
    </View>
  );
}
