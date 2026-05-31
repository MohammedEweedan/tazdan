/**
 * StatusBanner — inline success / error / info message for the exchange
 * widgets (and anywhere else). Theme-aware: pulls its colours from the active
 * palette so it reads correctly in dark, light and monochrome modes. Animates
 * in, supports an optional dismiss button, and is a no-op when `message` is
 * empty so callers can render it unconditionally.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useThemedPalette } from '@/store/themeStore';

export type StatusKind = 'success' | 'error' | 'info';

interface Props {
  kind: StatusKind;
  message?: string | null;
  onDismiss?: () => void;
}

export function StatusBanner({ kind, message, onDismiss }: Props) {
  const p = useThemedPalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: message ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [message, anim]);

  if (!message) return null;

  const palette = {
    success: { fg: p.greenFg, bg: p.greenBg, icon: 'checkmark-circle' as const },
    error:   { fg: p.redFg,   bg: p.redBg,   icon: 'alert-circle' as const },
    info:    { fg: p.fg,      bg: p.pillBg,  icon: 'information-circle' as const },
  }[kind];

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.fg + '40',
        marginBottom: 12,
      }}
    >
      <Ionicons name={palette.icon} size={18} color={palette.fg} />
      <Text style={{ flex: 1, color: palette.fg, fontSize: 13, fontWeight: '600' }}>
        {message}
      </Text>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={16} color={palette.fg} />
        </Pressable>
      )}
    </Animated.View>
  );
}
