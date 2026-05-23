/**
 * QuickAction — icon-over-label pill used in the home action row.
 * Frosted glass background with a brand-tinted icon disc on top.
 *
 * QuickActionRow lays out a row of five evenly: Buy · Sell · Send · Receive · More.
 */

import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/Motion';
import { brand, type Palette, useTheme } from '@/store/themeStore';
import { useHaptics } from '@/hooks';

export interface QuickActionDef {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Filled brand disc — for the single primary action (typically Buy). */
  emphasized?: boolean;
}

interface PillProps {
  def: QuickActionDef;
  palette: Palette;
}

export function QuickAction({ def, palette: p }: PillProps) {
  const h = useHaptics();
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;

  const discBg = def.emphasized ? accent : `${accent}1F`;
  const iconColor = def.emphasized ? '#ffffff' : accent;
  const borderColor = def.emphasized ? `${accent}80` : `${accent}33`;

  return (
    <PressableScale onPress={() => { h.medium(); def.onPress(); }} style={{ flex: 1 }}>
      <View style={{
        height: 80,
        borderRadius: 18,
        backgroundColor: p.bgElev,
        borderWidth: 1, borderColor,
        alignItems: 'center', justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 4,
      }}>
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: discBg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={def.icon} size={18} color={iconColor} />
        </View>
        <Text
          style={{ color: p.fg, fontSize: 11, fontWeight: '600', letterSpacing: -0.1 }}
          numberOfLines={1}
        >
          {def.label}
        </Text>
      </View>
    </PressableScale>
  );
}

export function QuickActionRow({
  actions, palette: p,
}: {
  actions: QuickActionDef[];
  palette: Palette;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      marginTop: 18,
    }}>
      {actions.map((a) => (
        <QuickAction key={a.key} def={a} palette={p} />
      ))}
    </View>
  );
}
