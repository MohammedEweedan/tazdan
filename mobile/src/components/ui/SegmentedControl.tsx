/**
 * SegmentedControl — pick one of a few options in a single row
 * (e.g. Light / Dark / Mono). Theme-aware; the selected segment uses the
 * accent surface like other selected states in the app.
 */
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks/useHaptics';

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function SegmentedControl<K extends string>({
  options, value, onChange,
}: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row', padding: 4, gap: 4, borderRadius: 18,
        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
      }}
    >
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => { if (!selected) { h.selection(); onChange(o.key); } }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            style={({ pressed }) => ({
              flex: 1, minHeight: 40, paddingVertical: 8, borderRadius: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: selected ? p.bgElev : 'transparent',
              opacity: pressed && !selected ? 0.7 : 1,
            })}
          >
            {o.icon && <Ionicons name={o.icon} size={14} color={selected ? p.fg : p.fgMuted} />}
            <Text style={{ color: selected ? p.fg : p.fgMuted, fontSize: 13, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
