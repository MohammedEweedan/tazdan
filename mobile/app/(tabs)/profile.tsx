/**
 * Profile tab — theme-aware, every Pressable is real.
 */

import { Pressable, ScrollView, Switch, View, Modal, Alert } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';

import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { Panel, PanelRow } from '@/components/ui/ScreenShell';
import { LocalePickerModal } from '@/components/ui/LocalePickerModal';
import { profileAPI } from '@/lib/api';

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
  const { user, logout, updateUser, biometricEnabled, enableBiometric, disableBiometric, clearViewSelection } = useAuthStore();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const locale = useI18n((s) => s.locale);

  const t = useT();

  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase();
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'fortuni user';
  const handle = user?.username ?? user?.email?.split('@')[0] ?? 'me';
  const userEmoji = (user as any)?.avatarUrl;
  const baseCurrency = (user as any)?.baseCurrency || 'USD';

  const handleAvatarChange = async (emoji: string) => {
    setSaving(true);
    try {
      await profileAPI.updateProfile({ avatarUrl: emoji });
      updateUser({ avatarUrl: emoji });
      setAvatarModalVisible(false);
      h.success();
    } catch (error) {
      h.error();
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    setSaving(true);
    try {
      await profileAPI.updateProfile({ baseCurrency: currency });
      updateUser({ baseCurrency: currency } as any);
      setCurrencyModalVisible(false);
      h.success();
    } catch (error) {
      h.error();
    } finally {
      setSaving(false);
    }
  };

  const currencies = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'USDT', 'BTC', 'ETH', 'BNB', 'SOL'];

  const handleBiometricToggle = async () => {
    setBioLoading(true);
    try {
      if (biometricEnabled) {
        await disableBiometric();
        h.success();
      } else {
        const [hasHW, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (!hasHW || !enrolled) {
          Alert.alert('Not available', 'Face ID / biometrics are not set up on this device.');
          return;
        }
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable Face ID for fortuni' });
        if (result.success) { await enableBiometric(); h.success(); }
        else h.error();
      }
    } finally {
      setBioLoading(false);
    }
  };

  const emojiGroups = {
    Cool: [
      "🔥","⚡","💀","☠️","👑","😈","😎","🫡","💯","🚀","🎯","🥷",
      "🦾","🔒","💸","🏴","⭐","✨","🌙","☄️","🪐","⚔️","🛡️","🏁"
    ],
    Animals: [
      "🦁","🐺","🦅","🦊","🐆","🐅","🦈","🐊","🐍","🦂","🕷","🐉",
      "🐎","🦌","🦍","🐘","🦏","🦓","🐪","🦜","🐬","🐳","👽","🦇"
    ],
    Faces: [
      "😎","😈","🤠","🫡","🥶","🥷","😏","😤","🤝","🫶","🖤","❤️",
      "💙","💚","💜","🤍","🩶","💛","🧠","👀","🫥","🫠","🤫","🧿"
    ],
    Symbols: [
      "👑","💎","💸","💯","🔒","⚡","🔥","⭐","✨","☠️","💀","🚀",
      "🎯","🏴","🏁","⚔️","🛡️","📿","🧿","🪬","🌍","☄️","🪐","🌊"
    ],
    Nature: [
      "☀️","🌙","☁️","❄️","🌊","🌴","🌵","🌍","🌎","🌏","🪐","☄️",
      "⭐","✨","🌊","🌴","🍂","🍁","🌸","🌹","🌺","🌻","🌼","🌿"
    ],
    Faith: [
      "📿","☪️","🕋","🤲","🙏","🧿","🪬","🕊️","🤍","🌙","⭐","☀️"
    ],
    Flags: [
      "🇱🇾","🇵🇸","🇸🇦","🇦🇪","🇪🇬","🇹🇳","🇩🇿","🇲🇦","🇹🇷","🇮🇹"
    ],
  };

  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState('Cool');

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: t('profile.section.preferences'),
      rows: [
        {
          icon: themeMode === 'dark' ? 'moon-outline' : 'sunny-outline',
          label: `${t('profile.row.theme')} · ${themeMode === 'dark' ? t('settings.dark') : t('settings.light')}`,
          onPress: () => { h.selection(); toggleTheme(); },
          right: <Ionicons name="swap-horizontal" size={16} color={p.fgFaint} />,
        },
        {
          icon: 'language-outline',
          label: `${t('profile.row.language')} · ${LOCALE_META[locale].label}`,
          onPress: () => { h.selection(); setLangPickerVisible(true); },
          right: <Text style={{ fontSize: 16 }}>{LOCALE_META[locale].flag}</Text>,
        },
        {
          icon: 'cash-outline',
          label: `${t('profile.row.baseCurrency')} · ${baseCurrency}`,
          onPress: () => { h.selection(); setCurrencyModalVisible(true); },
          right: <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />,
        },
      ],
    },
    {
      title: t('profile.section.security'),
      rows: [
        {
          icon: 'finger-print',
          label: `${t('profile.row.faceId')} · ${biometricEnabled ? t('profile.on') : t('profile.off')}`,
          onPress: handleBiometricToggle,
          right: (
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              disabled={bioLoading}
              trackColor={{ false: p.border, true: p.ctaBg }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          ),
        },
        {
          icon: 'shield-outline',
          label: `${t('profile.row.twoFactor')} · ${user?.twoFactorEnabled ? t('profile.on') : t('profile.off')}`,
          onPress: () => { h.selection(); router.push('/settings/2fa' as never); },
          right: user?.twoFactorEnabled
            ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: p.greenBg }}>
                <Text style={{ color: p.greenFg, fontSize: 10, fontWeight: '600' }}>{t('profile.on').toUpperCase()}</Text>
              </View>
            )
            : <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />,
        },
      ],
    },
    {
      title: t('profile.section.account'),
      rows: [
        { icon: 'person-outline',           label: t('profile.row.editProfile'),     href: '/settings' },
        { icon: 'shield-checkmark-outline', label: t('profile.row.kycVerification'), href: '/kyc' },
        { icon: 'card-outline',             label: t('profile.row.linkedAccounts'),  href: '/linked-accounts' },
      ],
    },
    {
      title: t('profile.section.money'),
      rows: [
        { icon: 'receipt-outline',     label: t('history.title'),       href: '/history' },
        { icon: 'add-circle-outline',  label: t('profile.row.deposits'), href: '/topup' },
        { icon: 'gift-outline',        label: t('home.referral'),        href: '/referral' },
      ],
    },
    {
      title: t('profile.section.app'),
      rows: [
        { icon: 'notifications-outline', label: t('profile.row.notifications'), href: '/notifications' },
        { icon: 'settings-outline',      label: t('settings.title'),            href: '/settings' },
      ],
    },
    {
      title: t('profile.section.session'),
      rows: [
        ...(user?.role === 'ADMIN' ? [{
          icon: 'shield-checkmark-outline' as const,
          label: 'Switch view (Admin / User)',
          onPress: () => { h.selection(); clearViewSelection(); router.replace('/role-select' as any); },
        }] : []),
        {
          icon: 'log-out-outline',
          label: t('profile.row.logout'),
          danger: true,
          onPress: async () => { h.warning(); await logout(); router.replace('/(auth)/login'); },
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
              {t('nav.profile')}
            </Text>
          </View>

          {/* User panel */}
          <View style={{ paddingHorizontal: 24, marginTop: 18 }}>
            <Panel>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 }}>
                <Pressable
                  onPress={() => {
                    h.selection();
                    setAvatarModalVisible(true);
                  }}
                  style={{
                    width: 56, height: 56, borderRadius: 28,
                  backgroundColor: userEmoji ? (themeMode === 'dark' ? '#1a1d27' : '#f5f5f7') : (themeMode === 'dark' ? '#a78bfa' : '#7c3aed'),
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: userEmoji ? 1 : 0,
                  borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
                }}>
                  {userEmoji ? (
                    <Text style={{ fontSize: 28 }}>{userEmoji}</Text>
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 22 }}>{initial}</Text>
                  )}
                  {/* Small "edit" badge on the avatar to hint it's editable */}
                  <View style={{
                    position: 'absolute', bottom: -2, right: -2,
                    backgroundColor: p.bg, borderRadius: 10, padding: 2,
                  }}>
                    <View style={{
                      backgroundColor: p.ctaBg, width: 16, height: 16, borderRadius: 8,
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Ionicons name="pencil" size={9} color={p.ctaFg} />
                    </View>
                  </View>
                </Pressable>
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
                  <Text style={{ color: p.greenFg, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.4 }}>
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
            fortuni · v0.1.0
          </Text>
        </ScrollView>
      </SafeAreaView>

      {/* Avatar Picker Modal */}
      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={() => setAvatarModalVisible(false)}
        >
          <Pressable
            style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}
            onPress={(e) => e.stopPropagation()}
          >
            
            {/* Category tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
              contentContainerStyle={{ gap: 6 }}
            >
              {Object.keys(emojiGroups).map((category) => (
                <Pressable
                  key={category}
                  onPress={() => { h.selection(); setSelectedEmojiCategory(category); }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: selectedEmojiCategory === category ? p.ctaBg : p.bgElev,
                    borderWidth: 1,
                    borderColor: selectedEmojiCategory === category ? p.ctaBg : 'transparent',
                  }}
                >
                  <Text style={{
                    color: selectedEmojiCategory === category ? p.ctaFg : p.fg,
                    fontSize: 12,
                    fontWeight: '700',
                  }}>
                    {category}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Emojis for selected category */}
            <ScrollView style={{ maxHeight: 300 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {emojiGroups[selectedEmojiCategory as keyof typeof emojiGroups]?.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => handleAvatarChange(emoji)}
                    style={{
                      width: 52, height: 52, borderRadius: 26,
                      backgroundColor: userEmoji === emoji ? p.ctaBg : p.bgElev,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 2, borderColor: userEmoji === emoji ? p.ctaBg : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <LocalePickerModal visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />

      {/* Currency Picker Modal */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={() => setCurrencyModalVisible(false)}
        >
          <Pressable
            style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>{t('profile.row.baseCurrency')}</Text>
            <View style={{ gap: 8 }}>
              {currencies.map((currency) => (
                <Pressable
                  key={currency}
                  onPress={() => handleCurrencyChange(currency)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: 14, borderRadius: 12,
                    backgroundColor: baseCurrency === currency ? `${p.ctaBg}15` : p.bgElev,
                    borderWidth: 1, borderColor: baseCurrency === currency ? p.ctaBg : 'transparent',
                  }}
                >
                  <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}>{currency}</Text>
                  {baseCurrency === currency && <Ionicons name="checkmark-circle" size={20} color={p.ctaBg} />}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
