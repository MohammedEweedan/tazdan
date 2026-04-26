import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { initialsOf } from '@/utils/format';

interface Props {
  name: string;
  uri?: string;
  size?: number;
}

export function Avatar({ name, uri, size = 40 }: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1a2658' }}
      />
    );
  }
  return (
    <LinearGradient
      colors={['#4A8FE0', '#0057B8']}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: 'white', fontWeight: '700', fontSize: size * 0.36, letterSpacing: 0.5 }}>
        {initialsOf(name)}
      </Text>
    </LinearGradient>
  );
}
