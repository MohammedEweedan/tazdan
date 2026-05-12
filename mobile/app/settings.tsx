/**
 * Settings — theme + language + account preferences.
 */

import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel, PanelRow } from '@/components/ui/ScreenShell';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics, useUpdateMyProfile } from '@/hooks';
import { LocalePickerModal } from '@/components/ui/LocalePickerModal';

export default function Settings() {
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
  const setMode = useTheme((s) => s.setMode);
  const locale = useI18n((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const updateProfile = useUpdateMyProfile();
  // Mirror the server flag locally so the switch flips instantly while the
  // mutation is in-flight; we revert if the request fails.
  const [isPublic, setIsPublic] = useState<boolean>(user?.profilePublic ?? true);
  const togglePublic = (v: boolean) => {
    h.selection();
    setIsPublic(v);
    updateProfile.mutate({ profilePublic: v }, {
      onError: () => setIsPublic(!v),
    });
  };

  return (
    <ScreenShell title={t('settings.title')}>
      {/* Account info */}
      <Panel style={{ marginTop: 18, padding: 16 }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
          {t('settings.account').toUpperCase()}
        </Text>
        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginTop: 6 }}>
          {user ? `${user.firstName} ${user.lastName}` : t('settings.notSignedIn')}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 2 }}>
          {user?.email ?? '—'}
        </Text>
      </Panel>

      {/* Privacy */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        {t('settings.privacy').toUpperCase()}
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 14,
          borderBottomWidth: 1, borderBottomColor: p.border,
        }}>
          <View style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: p.pillBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={isPublic ? 'globe-outline' : 'lock-closed-outline'} size={16} color={p.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
              {t('settings.publicProfile')}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
              {isPublic
                ? `${t('settings.visibleAt')} promrkts.app/u/${user?.username ?? 'me'}`
                : t('settings.privateProfile')}
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={togglePublic}
            disabled={!user?.username || updateProfile.isPending}
          />
        </View>
        <PanelRow
          icon="at-outline"
          label={user?.username ? `@${user.username}` : t('settings.setHandle')}
          last
          right={<Ionicons name="chevron-forward" size={16} color={p.fgFaint} />}
          onPress={() => Alert.alert(t('settings.changeHandle'), t('settings.handleSoon'))}
        />
      </Panel>

      {/* Theme */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        {t('settings.appearance').toUpperCase()}
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <PanelRow
          icon="contrast-outline"
          label={`${t('settings.theme')} · ${themeMode === 'dark' ? t('settings.dark') : t('settings.light')}`}
          onPress={() => { h.selection(); toggleTheme(); }}
          right={<Ionicons name="swap-horizontal" size={16} color={p.fgFaint} />}
        />
        <PanelRow
          icon="moon-outline"
          label={t('settings.useDark')}
          last
          onPress={() => { h.selection(); setMode('dark'); }}
          right={themeMode === 'dark'
            ? <Ionicons name="checkmark-circle" size={18} color={p.greenFg} />
            : null}
        />
      </Panel>

      {/* Language */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        {t('settings.language').toUpperCase()}
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <PanelRow
          icon="language-outline"
          label={`${LOCALE_META[locale].flag}  ${LOCALE_META[locale].label}`}
          last
          onPress={() => { h.selection(); setLangPickerVisible(true); }}
          right={<Ionicons name="chevron-forward" size={16} color={p.fgFaint} />}
        />
      </Panel>
      <LocalePickerModal visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />

      {/* Privacy / about */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        {t('settings.about').toUpperCase()}
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <PanelRow
          icon="document-text-outline"
          label={t('settings.terms')}
          onPress={() => Alert.alert(t('settings.terms'), t('settings.termsAlert'))}
        />
        <PanelRow
          icon="lock-closed-outline"
          label={t('settings.privacyPolicy')}
          onPress={() => Alert.alert(t('settings.privacy'), t('settings.privacyAlert'))}
        />
        <PanelRow
          icon="help-circle-outline"
          label={t('settings.support')}
          last
          onPress={() => Alert.alert(t('settings.support'), t('settings.supportAlert'))}
        />
      </Panel>

      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500' }}>
          Promrkts · v0.1.0
        </Text>
      </View>
    </ScreenShell>
  );
}
