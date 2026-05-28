
import { View } from 'react-native';
import { Text } from './Text';
import { initialsOf } from '@/utils/format';
import { AuthedImage } from './AuthedImage';
import { useThemedPalette } from '@/store/themeStore';

interface Props {
  name: string;
  uri?: string;
  size?: number;
}

export function Avatar({ name, uri, size = 40 }: Props) {
  const p = useThemedPalette();
  if (uri) {
    // AuthedImage transparently attaches the JWT for /uploads/* URLs and
    // behaves like a plain <Image> for everything else (CDN, CoinGecko).
    return (
      <AuthedImage
        uri={uri}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.bgRaised }}
      />
    );
  }
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: p.bgRaised,
        borderWidth: 1, borderColor: p.border,
      }}
    >
      <Text style={{ color: p.fg, fontWeight: '700', fontSize: size * 0.36, letterSpacing: 0.5 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
