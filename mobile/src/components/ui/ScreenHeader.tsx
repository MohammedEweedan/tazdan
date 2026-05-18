/**
 * Top bar used inside screens. Title centered, back button optional, right
 * accessory slot for actions.
 */

import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';

interface Props {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack, right }: Props) {
  const router = useRouter();
  const h = useHaptics();

  return (
    <View className="px-5 pt-2 pb-3 flex-row items-center" style={{ minHeight: 48 }}>
      <View style={{ width: 40, alignItems: 'flex-start' }}>
        {showBack && (
          <Pressable
            onPress={() => { h.selection(); router.back(); }}
            hitSlop={12}
            className="w-10 h-10 rounded-full items-center justify-center bg-white/[0.06] border border-white/[0.08]"
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
        )}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title && <Text className="text-ink-primary text-lg font-bold" style={{ letterSpacing: -0.3 }}>{title}</Text>}
        {subtitle && <Text className="text-ink-tertiary text-xs font-medium mt-0.5">{subtitle}</Text>}
      </View>
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
