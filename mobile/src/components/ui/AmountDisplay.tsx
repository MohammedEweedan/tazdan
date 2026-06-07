/**
 * AmountDisplay — the shared big-number money figure used across the
 * Buy / Sell / Send screens. Matches the home-screen balance treatment:
 * a muted currency symbol, a dynamically-sized figure that always fits on
 * ONE line (adjustsFontSizeToFit), and a restrained fraction. Never bold to
 * the point of shouting — semibold figure, muted decimals.
 */
import { memo } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { F } from '@/theme';
import type { Palette } from '@/store/themeStore';

export const AmountDisplay = memo(function AmountDisplay({
  value,
  symbol,
  palette: p,
  tint,
  maxSize = 66,
}: {
  /** The raw amount string the user is entering, e.g. "1,250.50" or "0". */
  value: string;
  /** Currency glyph/prefix, e.g. "$", "LYD", "₿". */
  symbol: string;
  palette: Palette;
  /** Optional override for the figure colour (e.g. red on overspend). */
  tint?: string;
  maxSize?: number;
}) {
  const shown = value && value.length ? value : '0';
  const [whole, frac] = shown.split('.');

  // Dynamic sizing mirrors the home balance: shrink as digits grow so the
  // whole figure stays on one line without wrapping or clipping.
  const digitCount = shown.replace(/[^0-9]/g, '').length;
  const baseSize = digitCount <= 6 ? 66 : digitCount <= 8 ? 56 : digitCount <= 10 ? 44 : 34;
  const amountSize = Math.min(maxSize, baseSize);
  const symbolSize = Math.max(24, Math.round(amountSize * 0.40));
  const fractionSize = Math.max(22, Math.round(amountSize * 0.52));
  const lineHeight = Math.round(amountSize * 1.06);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        maxWidth: '100%',
        paddingHorizontal: 6,
      }}
    >
      <Text
        style={{
          color: p.fgMuted,
          fontFamily: F.semibold,
          fontSize: symbolSize,
          lineHeight,
          marginTop: Math.max(0.5, amountSize * 0.08),
          marginRight: 5,
          letterSpacing: 0,
          fontVariant: ['tabular-nums'],
        }}
      >
        {symbol}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{
          color: tint ?? p.fg,
          fontFamily: F.semibold,
          fontSize: amountSize,
          lineHeight,
          letterSpacing: 0,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
          includeFontPadding: false,
        }}
      >
        {whole}
        {frac != null && (
          <Text style={{ color: p.fgMuted, fontFamily: F.semibold, fontSize: fractionSize }}>
            .{frac}
          </Text>
        )}
      </Text>
    </View>
  );
});
