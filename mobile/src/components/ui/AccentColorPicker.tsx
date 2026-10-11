import { useState } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from './Text';
import { BottomSheet } from './BottomSheet';
import { CTAButton } from './ScreenShell';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { hexToHsv, hsvToHex, normalizeAccent, DEFAULT_ACCENT } from '@/theme/accent';

const PRESETS = [DEFAULT_ACCENT, '#A78BFA', '#EC77B4', '#52C9A8', '#EAB765', '#EC786B', '#5FC8D6'];

export function AccentColorPicker() {
  const p = useThemedPalette();
  const t = useT();
  const haptics = useHaptics();
  const accent = useTheme(s => s.accentColor);
  const setAccent = useTheme(s => s.setAccent);
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<[number, number, number]>([210, .55, .86]);
  const [input, setInput] = useState(accent ?? DEFAULT_ACCENT);
  const [width, setWidth] = useState(320);
  const color = hsvToHex(...hsv);
  const update = (next: [number, number, number]) => { setHsv(next); setInput(hsvToHex(...next)); };
  const position = (event: GestureResponderEvent, hue = false) => {
    const x = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
    const y = Math.min(1, Math.max(0, event.nativeEvent.locationY / 190));
    update(hue ? [x * 359.9, hsv[1], hsv[2]] : [hsv[0], x, 1 - y]);
  };
  return <>
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: p.fgMuted, fontSize: 13 }}>{t('settings.accentColor')}</Text>
        {accent && <Pressable onPress={() => { haptics.selection(); setAccent(null); }} hitSlop={8}>
          <Text style={{ color: p.accentText, fontSize: 12 }}>{t('settings.resetColor')}</Text>
        </Pressable>}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {PRESETS.map((preset, i) => {
          const selected = accent === preset || (!accent && i === 0);
          return <Pressable key={preset} accessibilityRole="radio" accessibilityLabel={`${t('settings.accentColor')} ${preset}`}
            accessibilityState={{ checked: selected }} onPress={() => { haptics.selection(); setAccent(i ? preset : null); }}
            style={{ width: 34, height: 34, borderRadius: 17, borderWidth: selected ? 2 : 0, borderColor: p.fg, padding: 4 }}>
            <View style={{ flex: 1, borderRadius: 20, backgroundColor: preset }} />
          </Pressable>;
        })}
        <Pressable accessibilityRole="button" accessibilityLabel={t('settings.customColor')}
          onPress={() => { const selected = accent ?? DEFAULT_ACCENT; setInput(selected); setHsv(hexToHsv(selected)); setOpen(true); }}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="color-palette-outline" size={19} color={p.fg} />
        </Pressable>
      </View>
    </View>
    <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('settings.customColor')}
      footer={<CTAButton label={t('settings.applyColor')} disabled={!normalizeAccent(input)}
        onPress={() => { setAccent(input); haptics.success(); setOpen(false); }} />}>
      <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 21, marginBottom: 24 }}>{t('settings.colorHint')}</Text>
      <View accessibilityLabel={t('settings.colorSaturation')} onLayout={event => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={event => position(event)} onResponderMove={event => position(event)}
        style={{ height: 190, borderRadius: 20, backgroundColor: hsvToHex(hsv[0], 1, 1), overflow: 'hidden' }}>
        <LinearGradient pointerEvents="none" colors={['#FFFFFF', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', inset: 0 }} />
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', '#000000']} style={{ position: 'absolute', inset: 0 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`,
          width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: 11, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: color }} />
      </View>
      <View accessibilityLabel={t('settings.colorHue')} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={event => position(event, true)} onResponderMove={event => position(event, true)}
        style={{ height: 30, marginTop: 24, borderRadius: 15 }}>
        <LinearGradient pointerEvents="none" colors={['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 15 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: `${hsv[0] / 360 * 100}%`, top: -2, width: 12, height: 34,
          borderRadius: 6, marginLeft: -6, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: hsvToHex(hsv[0], 1, 1) }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 30 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: normalizeAccent(input) ?? color }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fgMuted, fontSize: 12, marginBottom: 6 }}>HEX</Text>
          <TextInput accessibilityLabel={t('settings.hexColor')} autoCapitalize="characters" autoCorrect={false} maxLength={7}
            value={input} onChangeText={value => { setInput(value); const parsed = normalizeAccent(value); if (parsed) setHsv(hexToHsv(parsed)); }}
            style={{ color: p.fg, fontSize: 20, fontWeight: '500', backgroundColor: p.bgElev, borderRadius: 14, padding: 12 }} />
        </View>
      </View>
    </BottomSheet>
  </>;
}
