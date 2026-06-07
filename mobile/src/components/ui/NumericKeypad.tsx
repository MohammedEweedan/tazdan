/**
 * NumericKeypad — the custom 3×4 keypad used by Send / Buy / Sell. Matches the
 * reference design: large centered glyphs, decimal + backspace, haptic taps.
 * Pure presentational — the parent owns the amount string.
 */
import { memo } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks';
import type { Palette } from '@/store/themeStore';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;
type Key = (typeof KEYS)[number];

export const NumericKeypad = memo(function NumericKeypad({
  value,
  onChange,
  palette: p,
  allowDecimal = true,
  maxDecimals = 8,
  keyHeight = 58,
  fontSize = 28,
}: {
  value: string;
  onChange: (next: string) => void;
  palette: Palette;
  allowDecimal?: boolean;
  maxDecimals?: number;
  keyHeight?: number;
  fontSize?: number;
}) {
  const h = useHaptics();

  const press = (k: Key) => {
    h.selection();
    if (k === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === '.') {
      if (!allowDecimal || value.includes('.')) return;
      onChange(value === '' ? '0.' : value + '.');
      return;
    }
    // digit
    if (value === '0') { onChange(k); return; } // replace leading zero
    const dot = value.indexOf('.');
    if (dot >= 0 && value.length - dot - 1 >= maxDecimals) return; // cap decimals
    onChange(value + k);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          onPress={() => press(k)}
          android_ripple={{ color: p.pillBg, borderless: true }}
          style={({ pressed }) => ({
            width: '33.333%',
            height: keyHeight,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.55 : 1,
          })}
        >
          {k === 'back' ? (
            <Ionicons name="backspace-outline" size={Math.max(22, fontSize - 2)} color={p.fg} />
          ) : (
            <Text style={{ color: p.fg, fontSize, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
              {k}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
});
