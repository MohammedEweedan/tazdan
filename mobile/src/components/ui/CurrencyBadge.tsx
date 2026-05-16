/**
 * CurrencyBadge — the ONE way to render a currency anywhere in the app.
 *
 *   <CurrencyBadge code="USD" />              → 🇺🇸  USD
 *   <CurrencyBadge code="BTC" />              → ₿   BTC
 *   <CurrencyBadge code="LYD" showName />     → 🇱🇾  LYD · Libyan Dinar
 *   <CurrencyBadge code="USD" variant="chip" /> → pill with flag+code
 *   <CurrencyBadge code="BTC" size="sm" />    → small inline
 *
 * Renders flag emoji for fiat, glyph for crypto. Falls back to the code
 * itself when no meta exists, so unknown codes never render blank.
 *
 * If you ever feel tempted to write `<Text>${meta.symbol}{currency}</Text>`
 * by hand again — stop. Use this. Uniformity > cleverness.
 */
import { Text, View, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { useThemedPalette } from '@/store/themeStore';
import { getCurrencyMeta } from '@/constants';

export type CurrencyBadgeSize = 'sm' | 'md' | 'lg';
export type CurrencyBadgeVariant =
  /** Plain inline: glyph + code. Default. */
  | 'inline'
  /** Pill on bgElev — for selectable currency rows. */
  | 'chip'
  /** Glyph in a square tile + code/name on the right. */
  | 'row';

interface Props {
  code: string;
  /** Render the long name after the code ("USD · US Dollar"). Default false. */
  showName?: boolean;
  /** Hide the code text — show only the glyph/flag. */
  glyphOnly?: boolean;
  size?: CurrencyBadgeSize;
  variant?: CurrencyBadgeVariant;
  style?: StyleProp<ViewStyle>;
  /** Override the text style of the code label. */
  codeStyle?: StyleProp<TextStyle>;
}

const SIZE_MAP: Record<CurrencyBadgeSize, {
  glyphFont: number; codeFont: number; nameFont: number; tile: number; gap: number;
}> = {
  sm: { glyphFont: 14, codeFont: 12, nameFont: 11, tile: 24, gap: 6 },
  md: { glyphFont: 18, codeFont: 14, nameFont: 12, tile: 32, gap: 8 },
  lg: { glyphFont: 26, codeFont: 16, nameFont: 13, tile: 44, gap: 12 },
};

export function CurrencyBadge({
  code, showName = false, glyphOnly = false,
  size = 'md', variant = 'inline', style, codeStyle,
}: Props) {
  const p = useThemedPalette();
  const meta = getCurrencyMeta(code);
  const s = SIZE_MAP[size];

  const glyph = meta?.flagOrIcon ?? meta?.symbol ?? code.slice(0, 2);
  const displayCode = meta?.code ?? code;
  const displayName = meta?.name;

  if (variant === 'chip') {
    return (
      <View
        style={[{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          gap: s.gap,
        }, style]}
      >
        <Text style={{ fontSize: s.glyphFont, lineHeight: s.glyphFont + 2 }}>{glyph}</Text>
        {!glyphOnly && (
          <Text style={[{ color: p.fg, fontSize: s.codeFont, fontWeight: '700', letterSpacing: 0.2 }, codeStyle]}>
            {displayCode}
          </Text>
        )}
      </View>
    );
  }

  if (variant === 'row') {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: s.gap }, style]}>
        <View
          style={{
            width: s.tile, height: s.tile, borderRadius: s.tile / 4,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
          }}
        >
          <Text style={{ fontSize: s.glyphFont, lineHeight: s.glyphFont + 2 }}>{glyph}</Text>
        </View>
        {!glyphOnly && (
          <View style={{ flex: 1 }}>
            <Text style={[{ color: p.fg, fontSize: s.codeFont, fontWeight: '700', letterSpacing: 0.2 }, codeStyle]}>
              {displayCode}
            </Text>
            {showName && displayName && (
              <Text style={{ color: p.fgMuted, fontSize: s.nameFont, fontWeight: '500', marginTop: 1 }}>
                {displayName}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  // inline (default)
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: s.gap }, style]}>
      <Text style={{ fontSize: s.glyphFont, lineHeight: s.glyphFont + 2 }}>{glyph}</Text>
      {!glyphOnly && (
        <Text style={[{ color: p.fg, fontSize: s.codeFont, fontWeight: '700', letterSpacing: 0.2 }, codeStyle]}>
          {showName && displayName ? `${displayCode} · ${displayName}` : displayCode}
        </Text>
      )}
    </View>
  );
}
