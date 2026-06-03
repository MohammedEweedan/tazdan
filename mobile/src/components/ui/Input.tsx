/**
 * Floating-label input. Animates label up when focused or value present.
 * Right slot for inline icons (eye toggle for password, etc.).
 */

import { ReactNode, useState } from 'react';
import { View, type TextInputProps, Pressable } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useThemedPalette } from '@/store/themeStore';

interface Props extends Omit<TextInputProps, 'onChange'> {
  label: string;
  error?: string;
  right?: ReactNode;
}

export function Input({ label, error, right, value, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const lift = useSharedValue(value ? 1 : 0);
  const p = useThemedPalette();

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 12 }, { scale: 1 - lift.value * 0.18 }],
    opacity:   0.55 + lift.value * 0.35,
  }));

  return (
    <View>
      <View
        className="px-4"
        style={{
          height: 64,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: error ? p.redFg : focused ? p.accentText : p.border,
          backgroundColor: p.pillBg,
          justifyContent: 'center',
          paddingTop: 18,
        }}
      >
        <Animated.Text
          style={[labelStyle, {
            position: 'absolute', left: 16, top: 22,
            color: p.fgMuted, fontSize: 15, fontWeight: '500',
          }]}
        >
          {label}
        </Animated.Text>
        <TextInput
          {...rest}
          value={value}
          onFocus={(e) => { setFocused(true); lift.value = withTiming(1, { duration: 180 }); onFocus?.(e); }}
          onBlur={(e)  => {
            setFocused(false);
            if (!value) lift.value = withTiming(0, { duration: 180 });
            onBlur?.(e);
          }}
          placeholderTextColor={p.fgFaint}
          selectionColor={p.fg}
          style={{ color: p.fg, fontSize: 16, fontWeight: '500', paddingTop: 6 }}
        />
        {right && (
          <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
            <Pressable hitSlop={8}>{right}</Pressable>
          </View>
        )}
      </View>
      {error && <Text className="text-danger text-xs mt-2 ml-1 font-medium">{error}</Text>}
    </View>
  );
}
