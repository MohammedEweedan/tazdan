/**
 * EmptyState — the centred icon + title + message block for empty lists and
 * load errors, with an optional action (e.g. "Try again").
 */
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useThemedPalette } from '@/store/themeStore';

export function EmptyState({
  icon, title, message, actionLabel, onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const p = useThemedPalette();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{
        width: 64, height: 64, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder,
      }}>
        <Ionicons name={icon} size={26} color={p.accentText} />
      </View>
      <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
        {title}
      </Text>
      {!!message && (
        <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 22, marginTop: 6, textAlign: 'center' }}>
          {message}
        </Text>
      )}
      {!!actionLabel && !!onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 18, minHeight: 44, paddingHorizontal: 18, borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
