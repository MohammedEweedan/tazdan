import { Image, View, type ImageSourcePropType } from 'react-native';
import { useThemedPalette } from '@/store/themeStore';
import { Text } from './Text';

const FLAGS: Record<string, ImageSourcePropType> = {
  LYD: require('../../../assets/flags/ly.png'),
  USD: require('../../../assets/flags/us.png'),
  EUR: require('../../../assets/flags/eu.png'),
  GBP: require('../../../assets/flags/gb.png'),
  AED: require('../../../assets/flags/ae.png'),
  SAR: require('../../../assets/flags/sa.png'),
  EGP: require('../../../assets/flags/eg.png'),
  TND: require('../../../assets/flags/tn.png'),
  TRY: require('../../../assets/flags/tr.png'),
  CAD: require('../../../assets/flags/ca.png'),
  CHF: require('../../../assets/flags/ch.png'),
  AUD: require('../../../assets/flags/au.png'),
  JPY: require('../../../assets/flags/jp.png'),
  CNY: require('../../../assets/flags/cn.png'),
  NGN: require('../../../assets/flags/ng.png'),
  SDG: require('../../../assets/flags/sd.png'),
  LBP: require('../../../assets/flags/lb.png'),
};
export const hasFiatFlag = (currency: string) => currency.toUpperCase() in FLAGS;

export function FiatFlag({ currency, size = 40 }: { currency: string; size?: number }) {
  const p = useThemedPalette();
  const source = FLAGS[currency.toUpperCase()];
  return <View accessibilityLabel={currency} style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: p.bgRaised, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
    {source ? <Image source={source} resizeMode="cover" style={{ width: size, height: size }} /> : <Text style={{ color: p.fgMuted, fontSize: size * .28 }}>{currency}</Text>}
  </View>;
}
