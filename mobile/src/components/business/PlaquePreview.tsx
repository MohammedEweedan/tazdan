/**
 * On-screen till plaque — the same design as the printed one (lib/plaque):
 * brand strip, business name, "Scan to pay", the QR with the business logo
 * in the middle, and a brand footer with the tazdan ن and "tazdan accepted
 * here" in the chosen language.
 */
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { BrandedQr } from './BrandedQr';
import { brandOr, onBrand, plaqueText } from '@/lib/plaque';

const BOWL = 'M497 445 L454 445 A155.5 155.5 0 0 0 298.5 600.5 L298.5 766 A155.5 155.5 0 0 0 454 921.5 L765 921.5 A155.5 155.5 0 0 0 920.5 766 L920.5 600.5 A155.5 155.5 0 0 0 765 445 L730 445';

/** The tazdan ن in one colour; `hole` is the colour behind it (the clasp's hole). */
export function TazdanMark({ size, color, hole }: { size: number; color: string; hole: string }) {
  return (
    <Svg width={size} height={(size * 714) / 765} viewBox="240 266 765 714" accessibilityLabel="tazdan">
      <Path d={BOWL} stroke={color} strokeWidth={87} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x={635} y={584} width={355} height={207} rx={103.5} fill={color} />
      <Circle cx={878} cy={687} r={39} fill={hole} />
      <Circle cx={618} cy={350} r={69} fill={color} />
    </Svg>
  );
}

export function PlaquePreview({ width, name, value, primary, secondary, logo, locale, till }: {
  width: number; name: string; value: string; primary?: string | null; secondary?: string | null;
  logo?: string | null; locale: string; till?: string | null;
}) {
  const t = plaqueText(locale);
  const brand = brandOr(primary);
  const accent = secondary ? brandOr(secondary) : brand;
  const ink = onBrand(brand);
  const u = width / 105; // millimetres of the A6 design → points
  const qr = 58 * u;
  return (
    <View style={{ width, height: 148 * u, backgroundColor: '#FFFFFF', borderRadius: 4 * u, overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
      <LinearGradient colors={[brand, accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 5 * u }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 * u }}>
        <Text numberOfLines={2} style={{ color: brand, fontSize: 6.35 * u, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2 }}>{name}</Text>
        <Text style={{ color: '#3C4A58', fontSize: 3.5 * u, fontWeight: '600', marginTop: 1.5 * u, marginBottom: 5 * u, writingDirection: t.rtl ? 'rtl' : 'ltr' }}>{t.scan}</Text>
        <View style={{ padding: 3 * u, borderRadius: 5 * u, borderWidth: Math.max(1, 0.5 * u), borderColor: '#E6E8EC', backgroundColor: '#FFFFFF' }}>
          <BrandedQr value={value} size={qr} brand={primary} logo={logo} />
        </View>
        {till ? <Text style={{ color: '#8A94A3', fontSize: 2.5 * u, marginTop: 3 * u }}>{till}</Text> : null}
      </View>
      <View style={{ height: 17 * u, backgroundColor: brand, flexDirection: t.rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 2.5 * u }}>
        <TazdanMark size={8 * u} color={ink} hole={brand} />
        <Text style={{ color: ink, fontSize: 3.5 * u, fontWeight: '700' }}>{t.accepted}</Text>
      </View>
    </View>
  );
}
