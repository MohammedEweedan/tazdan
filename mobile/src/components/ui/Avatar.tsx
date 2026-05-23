
import { Text } from './Text';
import { LinearGradient } from 'expo-linear-gradient';
import { initialsOf } from '@/utils/format';
import { AuthedImage } from './AuthedImage';

interface Props {
  name: string;
  uri?: string;
  size?: number;
}

export function Avatar({ name, uri, size = 40 }: Props) {
  if (uri) {
    // AuthedImage transparently attaches the JWT for /uploads/* URLs and
    // behaves like a plain <Image> for everything else (CDN, CoinGecko).
    return (
      <AuthedImage
        uri={uri}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1a2658' }}
      />
    );
  }
  return (
    <LinearGradient
      colors={['#226dff', '#1a52cc']}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: 'white', fontWeight: '700', fontSize: size * 0.36, letterSpacing: 0.5 }}>
        {initialsOf(name)}
      </Text>
    </LinearGradient>
  );
}
