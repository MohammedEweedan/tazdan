import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import type { Payee } from '@/services';

type RowPayee = Pick<Payee, 'name' | 'username' | 'avatarUrl' | 'kind' | 'verified'>;

/** Flat row: avatar, name (+ check for a verified business), @handle. */
export function PayeeRow({ payee, onPress, last }: { payee: RowPayee; onPress: () => void; last?: boolean }) {
  const p = useThemedPalette();
  const t = useT();
  const merchant = payee.kind === 'MERCHANT';
  const handle = payee.username ? `@${payee.username}` : '';
  const sub = merchant ? [t('pay.business'), handle].filter(Boolean).join(' · ') : handle;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[payee.name, sub].filter(Boolean).join(', ')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}
    >
      <Avatar name={payee.name || handle} uri={payee.avatarUrl ?? undefined} size={44} />
      <View style={{
        flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.border,
      }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text numberOfLines={1} style={{ color: p.fg, fontSize: 15, fontWeight: '600', flexShrink: 1 }}>
              {payee.name || handle}
            </Text>
            {merchant && payee.verified && <Ionicons name="checkmark-circle" size={15} color={p.accentText} />}
          </View>
          {!!sub && (
            <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }}>{sub}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
      </View>
    </Pressable>
  );
}
