/**
 * Profile tab — premium account hub. Shows user header + KYC tier + grouped
 * settings rows. Logout calls `useAuthStore`.
 */

import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

interface Row { label: string; icon: keyof typeof Ionicons.glyphMap; href?: string; danger?: boolean; onPress?: () => void; }

export default function Profile() {
  const router = useRouter();
  const h = useHaptics();
  const { user, logout } = useAuthStore();

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'Account',
      rows: [
        { label: 'Personal info',        icon: 'person-outline',          href: '/settings' },
        { label: 'Identity verification',icon: 'shield-checkmark-outline',href: '/(auth)/kyc' },
        { label: 'Linked cards',         icon: 'card-outline',            href: '/cards' },
      ],
    },
    {
      title: 'Money',
      rows: [
        { label: 'Transaction history', icon: 'receipt-outline',  href: '/history' },
        { label: 'Top up',              icon: 'add-circle-outline',href: '/topup' },
        { label: 'Refer & earn',        icon: 'gift-outline',     href: '/referral' },
      ],
    },
    {
      title: 'Preferences',
      rows: [
        { label: 'Notifications', icon: 'notifications-outline', href: '/notifications' },
        { label: 'Settings',      icon: 'settings-outline',      href: '/settings' },
      ],
    },
    {
      title: 'Session',
      rows: [
        { label: 'Log out', icon: 'log-out-outline', danger: true, onPress: () => { h.warning(); logout(); } },
      ],
    },
  ];

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View className="px-5 pt-3 pb-1">
            <Text className="text-ink-primary text-xl font-bold" style={{ letterSpacing: -0.4 }}>Profile</Text>
          </View>

          {/* User card */}
          <View className="px-5 mt-4">
            <Card padding={20} radius={24}>
              <View className="flex-row items-center" style={{ gap: 14 }}>
                <Avatar name={`${user?.firstName ?? 'P'} ${user?.lastName ?? ''}`} size={56} />
                <View style={{ flex: 1 }}>
                  <Text className="text-ink-primary text-base font-bold">
                    {user?.firstName} {user?.lastName}
                  </Text>
                  <Text className="text-ink-tertiary text-xs mt-0.5">@{user?.username ?? '—'}</Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
                    backgroundColor: 'rgba(34,197,94,0.16)',
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                  }}
                >
                  <Ionicons name="shield-checkmark" size={11} color="#22c55e" />
                  <Text style={{ color: '#22c55e', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }}>
                    {user?.kycTier?.replace('_', ' ') ?? 'TIER 0'}
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          {/* Groups */}
          {groups.map((g) => (
            <View key={g.title} className="mt-7 px-5">
              <Text className="text-ink-tertiary text-xs font-semibold mb-2 ml-2" style={{ letterSpacing: 1 }}>
                {g.title.toUpperCase()}
              </Text>
              <View className="bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                {g.rows.map((r, i) => (
                  <Pressable
                    key={r.label}
                    onPress={() => { h.selection(); r.onPress ? r.onPress() : r.href && router.push(r.href as never); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14, paddingHorizontal: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderColor: 'rgba(255,255,255,0.05)',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 32, height: 32, borderRadius: 10,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: r.danger ? 'rgba(239,68,68,0.14)' : 'rgba(74,143,224,0.14)',
                        marginRight: 12,
                      }}
                    >
                      <Ionicons name={r.icon} size={16} color={r.danger ? '#ef4444' : '#4A8FE0'} />
                    </View>
                    <Text style={{ color: r.danger ? '#ef4444' : '#fff', fontSize: 14, fontWeight: '600', flex: 1 }}>
                      {r.label}
                    </Text>
                    {!r.danger && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.32)" />}
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          <Text className="text-ink-muted text-xs text-center mt-8">Promrkts · v0.1.0</Text>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
