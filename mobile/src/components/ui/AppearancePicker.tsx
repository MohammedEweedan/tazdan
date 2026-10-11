import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useTheme, useThemedPalette, type ThemeMode } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { DEFAULT_ACCENT } from '@/theme/accent';
import { AccentColorPicker } from './AccentColorPicker';

const OPTIONS: { mode: ThemeMode; bg: string; surface: string; ink: string; accent: string }[] = [
  { mode: 'light', bg: '#F6F7FA', surface: '#FFFFFF', ink: '#16181C', accent: DEFAULT_ACCENT },
  { mode: 'dark', bg: '#16181C', surface: '#262A31', ink: '#F4F5F7', accent: DEFAULT_ACCENT },
  { mode: 'mono', bg: '#080808', surface: '#202020', ink: '#FFFFFF', accent: '#B9B9B9' },
];

/** Live theme previews shared by profile and settings. */
export function AppearancePicker() {
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const customAccent = useTheme(s => s.accentColor);
  const current = useTheme(s => s.mode);
  const setMode = useTheme(s => s.setMode);
  return <><View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 12 }}>
    {OPTIONS.map(option => {
      const selected = current === option.mode;
      return <Pressable key={option.mode} accessibilityRole="radio" accessibilityState={{ checked: selected }}
        accessibilityLabel={t(`settings.${option.mode}`)} onPress={() => { h.selection(); setMode(option.mode); }}
        style={({ pressed }) => ({ flex: 1, opacity: pressed ? .8 : 1 })}>
        <View style={{ height: 116, borderRadius: 20, padding: 10, backgroundColor: option.bg,
          borderWidth: 1.5, borderColor: selected ? p.accent : p.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: option.surface }} />
            <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: option.ink, opacity: .35 }} />
          </View>
          <View style={{ width: '68%', height: 7, borderRadius: 4, backgroundColor: option.ink }} />
          <View style={{ width: '45%', height: 3, borderRadius: 2, backgroundColor: option.ink, opacity: .35, marginTop: 7 }} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 15 }}>
            {[0, 1, 2].map(i => <View key={i} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: i ? option.surface : (customAccent ?? option.accent) }} />)}
          </View>
          {selected && <View style={{ position: 'absolute', right: 7, top: 7, width: 20, height: 20, borderRadius: 10,
            alignItems: 'center', justifyContent: 'center', backgroundColor: p.accent }}>
            <Ionicons name="checkmark" size={13} color={p.accentFg} />
          </View>}
        </View>
        <Text style={{ color: selected ? p.fg : p.fgMuted, fontSize: 13, fontWeight: selected ? '600' : '400', textAlign: 'center', marginTop: 9 }}>
          {t(`settings.${option.mode}`)}
        </Text>
      </Pressable>;
    })}
  </View><AccentColorPicker /></>;
}
