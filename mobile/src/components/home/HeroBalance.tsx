/**
 * HeroBalance — the headline portfolio number on the home tab.
 *
 * Premium glass card containing:
 *  - Ghost sparkline behind the number (highest-balance asset, 12% periwinkle)
 *  - Count-up ticker animation (ported from the original AnimatedTotal)
 *  - Tx flash dot when the value moves by > $0.50
 *  - 24h delta pill: brand-tinted when mild, green/red when strong
 *  - Currency-code chip top-right; eye toggle inline; tap number → chart
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { brand, type Palette, useTheme } from '@/store/themeStore';
import { useDisplayCurrency } from '@/hooks';

interface Props {
  value: number;
  palette: Palette;
  dc: ReturnType<typeof useDisplayCurrency>;
  showBalance: boolean;
  onToggle: () => void;
  onPress?: () => void;
  ghostSpark?: number[];
  deltaUsd: number;
  deltaPct: number;
}

export function HeroBalance({
  value, palette: p, dc, showBalance, onToggle, onPress,
  ghostSpark, deltaUsd, deltaPct,
}: Props) {
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;

  const initializedRef = useRef(false);
  const [displayed, setDisplayed] = useState(0);
  const fromRef = useRef(0);
  const targetRef = useRef(value);
  const startTsRef = useRef<number | null>(null);

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashTranslateY = useRef(new Animated.Value(6)).current;
  const [flash, setFlash] = useState<{ dir: 'up' | 'down' } | null>(null);
  const prevValueRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initializedRef.current && value > 0) {
      initializedRef.current = true;
      setDisplayed(value);
      prevValueRef.current = value;
      return;
    }
    fromRef.current = displayed;
    targetRef.current = value;
    startTsRef.current = Date.now();
    const dur = 1400;
    let raf: any;
    let lastFrameTs = 0;
    const tick = () => {
      const now = Date.now();
      if (now - lastFrameTs < 33) { raf = requestAnimationFrame(tick); return; }
      lastFrameTs = now;
      const elapsed = now - (startTsRef.current ?? now);
      const progress = Math.min(1, elapsed / dur);
      const eased = progress < 0.5
        ? 8 * progress * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 4) / 2;
      setDisplayed(fromRef.current + (targetRef.current - fromRef.current) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (prevValueRef.current === null) {
      prevValueRef.current = value;
      return;
    }
    const diff = value - prevValueRef.current;
    prevValueRef.current = value;
    if (Math.abs(diff) < 0.5) return;
    setFlash({ dir: diff > 0 ? 'up' : 'down' });
    flashOpacity.setValue(0);
    flashTranslateY.setValue(6);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(flashOpacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(flashTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      Animated.delay(1300),
      Animated.parallel([
        Animated.timing(flashOpacity,    { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(flashTranslateY, { toValue: -6, duration: 350, useNativeDriver: true }),
      ]),
    ]).start(() => setFlash(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const converted = dc.convert(displayed);
  const totalStr = converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: dc.isCrypto ? 6 : 2,
  });
  const digitCount = totalStr.replace(/[^0-9]/g, '').length;
  const fontSize = digitCount <= 7 ? 48 : digitCount <= 9 ? 40 : digitCount <= 11 ? 34 : 28;
  const maskedStr = totalStr.replace(/[0-9]/g, '*');

  const positive = deltaPct >= 0;
  const strong = Math.abs(deltaPct) >= 0.5;
  const pillFg = !showBalance ? p.fgFaint
                : !strong ? accent
                : positive ? p.greenFg : p.redFg;
  const pillBg = !showBalance ? p.pillBg
                : !strong ? `${accent}1A`
                : positive ? p.greenBg : 'rgba(239,68,68,0.14)';
  const pillBorder = !showBalance ? p.border
                : !strong ? `${accent}40`
                : positive ? 'rgba(34,197,94,0.30)' : 'rgba(239,68,68,0.30)';

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
      <View style={{
        backgroundColor: p.bgElev,
        borderRadius: 24,
        borderWidth: 1, borderColor: p.border,
        overflow: 'hidden',
        shadowColor: accent,
        shadowOpacity: themeMode === 'dark' ? 0.22 : 0.12,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 5,
      }}>
        {ghostSpark && ghostSpark.length >= 2 && (
          <View
            style={{ position: 'absolute', left: 0, right: 0, top: 28, bottom: 0, opacity: 0.16 }}
            pointerEvents="none"
          >
            <GhostSparkline data={ghostSpark} color={accent} />
          </View>
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }}>
              TOTAL BALANCE
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
              backgroundColor: `${accent}1A`,
              borderWidth: 1, borderColor: `${accent}33`,
            }}>
              <Text style={{ color: accent, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 }}>
                {dc.currency}
              </Text>
              <Ionicons name="chevron-down" size={10} color={accent} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Pressable onPress={onPress} hitSlop={12} style={{ flexShrink: 1 }}>
              <Text style={{
                color: p.fg,
                fontSize, fontWeight: '700', letterSpacing: -1.6,
                fontVariant: ['tabular-nums'],
              }}>
                {dc.symbol}{showBalance ? totalStr : maskedStr}
              </Text>
            </Pressable>
            <Pressable onPress={onToggle} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons
                name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={p.fgFaint}
              />
            </Pressable>

            {flash && (
              <Animated.View
                style={{
                  opacity: flashOpacity,
                  transform: [{ translateY: flashTranslateY }],
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: flash.dir === 'up' ? p.greenFg : p.redFg,
                  shadowColor: flash.dir === 'up' ? p.greenFg : p.redFg,
                  shadowOpacity: 0.7, shadowRadius: 8,
                }}
              />
            )}
          </View>

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
          }}>
            <Text style={{
              color: p.fgMuted,
              fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'],
            }}>
              {showBalance
                ? `${positive ? '+' : '−'}${dc.fmt(Math.abs(deltaUsd))}`
                : `${dc.symbol}****`}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
              backgroundColor: pillBg,
              borderWidth: 1, borderColor: pillBorder,
            }}>
              {showBalance && (
                <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={9} color={pillFg} />
              )}
              <Text style={{
                color: pillFg,
                fontSize: 12, fontWeight: '700',
              }}>
                {showBalance ? `${Math.abs(deltaPct).toFixed(2)}%` : '**.**%'}
              </Text>
            </View>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>· 24h</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function GhostSparkline({ data, color }: { data: number[]; color: string }) {
  const width = 360;
  const height = 70;
  const points = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    return data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return [x, y] as const;
    });
  }, [data]);

  const stroke = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const fill = `${stroke} L${width},${height} L0,${height} Z`;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Defs>
        <SvgGradient id="ghost" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={fill} fill="url(#ghost)" />
      <Path d={stroke} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
