/** Shared floating-label input; the same surface, focus ring and font as the rest of the app. */
import { ReactNode, useEffect, useState } from 'react';
import { View, type TextInputProps } from 'react-native';
import { Text, TextInput } from './Text';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n } from '@/store/i18nStore';
import { ui } from '@/theme';
const AnimatedText = Animated.createAnimatedComponent(Text);

interface Props extends Omit<TextInputProps, 'onChange'> { label: string; error?: string; right?: ReactNode; }
export function Input({ label, error, right, value, onFocus, onBlur, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const p = useThemedPalette();
  const isAr = useI18n((s) => s.locale === 'ar');
  const lift = useSharedValue(value ? 1 : 0);
  useEffect(() => { lift.value = withTiming(focused || value ? 1 : 0, { duration: 180 }); }, [focused, value, lift]);
  const labelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 12 }], fontSize: 15 - lift.value * 3 }));
  return (
    <View>
      <View style={{ minHeight: ui.input, borderRadius: ui.fieldRadius, borderWidth: 1, borderColor: error ? p.redFg : focused ? p.accentText : p.border, backgroundColor: p.bgElev, justifyContent: 'center', paddingTop: 18, paddingBottom: 6, paddingHorizontal: 16 }}>
        <AnimatedText pointerEvents="none" style={[labelStyle, { position: 'absolute', left: 16, right: right ? 52 : 16, top: 22, color: focused ? p.accentText : p.fgMuted, fontWeight: '500', textAlign: isAr ? 'right' : 'left' }]}>{label}</AnimatedText>
        <TextInput {...rest} accessibilityLabel={rest.accessibilityLabel ?? label} value={value}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }} onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          placeholderTextColor={p.fgFaint} selectionColor={p.accent}
          style={[{ color: p.fg, fontSize: 16, fontWeight: '500', paddingTop: 6, paddingRight: right ? 38 : 0 }, style]} />
        {right && <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>{right}</View>}
      </View>
      {error && <Text accessibilityRole="alert" style={{ color: p.redFg, fontSize: 12, marginTop: 8, marginHorizontal: 4 }}>{error}</Text>}
    </View>
  );
}
