import { Image, View } from 'react-native';
import { Text } from './Text';
import { useTheme, useThemedPalette } from '@/store/themeStore';

export function BrandLogo({ size = 28 }: { size?: number }) {
  const p = useThemedPalette();
  const mono = useTheme((s) => s.mode === 'mono');
  return (
    <View accessible accessibilityLabel="tazdan" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={mono ? require('../../../assets/icon-asterisk-white.png') : require('../../../assets/icon-asterisk.png')} style={{ width: size, height: size }} resizeMode="contain" />
      <Text style={{ color: p.fg, fontSize: size, fontWeight: '600', letterSpacing: -1 }}>tazdan</Text>
    </View>
  );
}
