/**
 * Row of large rounded action buttons under the balance — Send / Receive /
 * Buy / Top up. Mirrors the iOS Wallet quick-action pill layout.
 */

import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';

interface Action {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
}

const ACTIONS: Action[] = [
  { key: 'send',    label: 'Send',    icon: 'arrow-up-outline',    href: '/send' },
  { key: 'receive', label: 'Receive', icon: 'arrow-down-outline',  href: '/receive' },
  { key: 'buy',     label: 'Buy',     icon: 'add-outline',         href: '/buy' },
  { key: 'topup',   label: 'Top up',  icon: 'card-outline',        href: '/topup' },
];

export function QuickActions() {
  const router = useRouter();
  const h = useHaptics();
  return (
    <View className="flex-row" style={{ gap: 10 }}>
      {ACTIONS.map((a) => (
        <Pressable
          key={a.key}
          onPress={() => { h.light(); router.push(a.href as never); }}
          style={{ flex: 1 }}
        >
          {({ pressed }) => (
            <View
              style={{
                paddingVertical: 14,
                borderRadius: 18,
                alignItems: 'center',
                gap: 6,
                backgroundColor: pressed ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <View
                style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: 'rgba(34,109,255,0.18)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name={a.icon} size={18} color="#FAFAFA" />
              </View>
              <Text className="text-ink-primary text-xs font-semibold">{a.label}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}
