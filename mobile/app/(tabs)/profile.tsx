/**
 * Profile tab — theme-aware, every Pressable is real.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useI18n, LOCALE_META } from '@/store/i18nStore';
import { Panel, PanelRow } from '@/components/ui/ScreenShell';

interface Row {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}

export default function Profile() {
  const router = useRouter();
  const h = useHaptics();
  const { user, logout } = useAuthStore();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const locale = useI18n((s) => s.locale);
  const cycleLocale = useI18n((s) => s.cycle);

  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase();
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Promrkts user';
  const handle = user?.username ?? user?.email?.split('@')[0] ?? 'me';
  const userEmoji = user?.avatarUrl;

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'PREFERENCES',
      rows: [
        {
          icon: themeMode === 'dark' ? 'moon-outline' : 'sunny-outline',
          label: `Theme · ${themeMode === 'dark' ? 'Dark' : 'Light'}`,
          onPress: () => { h.selection(); toggleTheme(); },
          right: <Ionicons name="swap-horizontal" size={16} color={p.fgFaint} />,
        },
        {
          icon: 'language-outline',
          label: `Language · ${LOCALE_META[locale].label}`,
          onPress: () => { h.selection(); cycleLocale(); },
          right: <Text style={{ fontSize: 16 }}>{LOCALE_META[locale].flag}</Text>,
        },
      ],
    },
    {
      title: 'ACCOUNT',
      rows: [
        { icon: 'person-outline',           label: 'Personal info',         href: '/settings' },
        { icon: 'shield-checkmark-outline', label: 'Identity verification', href: '/kyc' },
        { icon: 'card-outline',             label: 'Linked cards',          href: '/cards' },
      ],
    },
    {
      title: 'MONEY',
      rows: [
        { icon: 'receipt-outline',     label: 'Transaction history', href: '/history' },
        { icon: 'add-circle-outline',  label: 'Top up balance',      href: '/topup' },
        { icon: 'gift-outline',        label: 'Refer & earn',        href: '/referral' },
      ],
    },
    {
      title: 'APP',
      rows: [
        { icon: 'notifications-outline', label: 'Notifications', href: '/notifications' },
        { icon: 'settings-outline',      label: 'Settings',      href: '/settings' },
      ],
    },
    {
      title: 'SESSION',
      rows: [
        {
          icon: 'log-out-outline',
          label: 'Log out',
          danger: true,
          onPress: () => { h.warning(); logout(); },
        },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {/* Title */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
          }}>
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}>
              Profile
            </Text>
          </View>

          {/* User panel */}
          <View style={{ paddingHorizontal: 24, marginTop: 18 }}>
            <Panel>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 }}>
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: userEmoji ? (themeMode === 'dark' ? '#1a1d27' : '#f5f5f7') : (themeMode === 'dark' ? '#a78bfa' : '#7c3aed'),
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: userEmoji ? 1 : 0,
                  borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
                }}>
                  {userEmoji ? (
                    <Text style={{ fontSize: 28 }}>{userEmoji}</Text>
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22 }}>{initial}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>{fullName}</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 2 }}>
                    @{handle}
                  </Text>
                </View>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
                  backgroundColor: p.greenBg,
                }}>
                  <Ionicons name="shield-checkmark" size={11} color={p.greenFg} />
                  <Text style={{ color: p.greenFg, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }}>
                    {(user?.kycTier ?? 'TIER_0').replace('_', ' ')}
                  </Text>
                </View>
              </View>
            </Panel>
          </View>

          {/* Groups */}
          {groups.map((g) => (
            <View key={g.title} style={{ paddingHorizontal: 24, marginTop: 24 }}>
              <Text style={{
                color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
                marginBottom: 8, marginLeft: 4,
              }}>
                {g.title}
              </Text>
              <Panel>
                {g.rows.map((r, i) => (
                  <PanelRow
                    key={r.label}
                    icon={r.icon}
                    label={r.label}
                    danger={r.danger}
                    last={i === g.rows.length - 1}
                    right={r.right}
                    onPress={() => {
                      h.selection();
                      if (r.onPress) r.onPress();
                      else if (r.href) router.push(r.href as never);
                    }}
                  />
                ))}
              </Panel>
            </View>
          ))}

          <Text style={{
            color: p.fgFaint, fontSize: 11, fontWeight: '500',
            textAlign: 'center', marginTop: 28,
          }}>
            Promrkts · v0.1.0
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
