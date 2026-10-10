/**
 * Settings — preferences, privacy, handle change, 2FA, about.
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel, PanelRow, SectionLabel, ToggleRow } from '@/components/ui/ScreenShell';
import { AppearancePicker } from '@/components/ui/AppearancePicker';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { avatarMode } from '@/utils/displayUser';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useChatPrefs } from '@/store/chatPrefsStore';
import { useHaptics, useUpdateMyProfile } from '@/hooks';
import { LocalePickerModal } from '@/components/ui/LocalePickerModal';
import { profileService } from '@/services';
import { router } from 'expo-router';

export default function Settings() {
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const locale = useI18n((s) => s.locale);
  const { user, updateUser } = useAuthStore();
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const updateProfile = useUpdateMyProfile();

  const [isPublic, setIsPublic] = useState<boolean>(user?.profilePublic ?? true);
  const readReceiptsOn = useChatPrefs((s) => s.readReceiptsOn);
  const togglePublic = (v: boolean) => {
    h.selection();
    setIsPublic(v);
    updateProfile.mutate({ profilePublic: v }, { onError: () => setIsPublic(!v) });
  };

  // ── Handle editing ──
  const [handleModalVisible, setHandleModalVisible] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [handleSaving, setHandleSaving] = useState(false);

  const openHandleModal = () => {
    setHandleInput(user?.username ?? '');
    setHandleModalVisible(true);
  };

  const saveHandle = async () => {
    const trimmed = handleInput.trim().toLowerCase().replace(/^@/, '');
    if (!trimmed || trimmed === user?.username) { setHandleModalVisible(false); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(trimmed)) {
      Alert.alert('Invalid handle', 'Only letters, numbers and underscores. 3–30 characters.');
      return;
    }
    setHandleSaving(true);
    try {
      await profileService.updateMe({ username: trimmed });
      updateUser({ username: trimmed });
      h.success();
      setHandleModalVisible(false);
    } catch (e: any) {
      h.error();
      Alert.alert('Could not update handle', e?.response?.data?.error ?? 'Try again.');
    } finally {
      setHandleSaving(false);
    }
  };

  const avatar = avatarMode(user);
  const press2FA = () => { h.selection(); router.push('/settings/2fa' as any); };

  return (
    <ScreenShell title={t('settings.title')}>
      <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 28 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: p.bgElev,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16 }}>
          {avatar.kind === 'image' ? <Image source={{ uri: avatar.uri }} style={{ width: 76, height: 76 }} /> :
            <Text style={{ color: p.fg, fontSize: avatar.kind === 'emoji' ? 38 : 30, fontWeight: '500' }}>{avatar.char}</Text>}
        </View>
        <Text style={{ color: p.fg, fontSize: 27, fontWeight: '600', letterSpacing: -.7 }}>
          {user ? `${user.firstName} ${user.lastName}` : t('settings.notSignedIn')}
        </Text>
        <Pressable onPress={openHandleModal} style={{ flexDirection: 'row', gap: 7, alignItems: 'center', paddingVertical: 9 }}>
          <Text style={{ color: p.accentText, fontSize: 14 }}>{user?.username ? `@${user.username}` : t('settings.setHandle')}</Text>
          <Ionicons name="pencil-outline" size={13} color={p.accentText} />
        </Pressable>
        <Text style={{ color: p.fgFaint, fontSize: 12 }}>{user?.email}</Text>
      </View>

      <SectionLabel first>{t('settings.appearance')}</SectionLabel>
      <AppearancePicker />
      <View style={{ marginTop: 20 }}><Panel>
        <PanelRow icon="language-outline" label={t('settings.language')}
          value={`${LOCALE_META[locale].flag}  ${LOCALE_META[locale].label}`} last
          onPress={() => { h.selection(); setLangPickerVisible(true); }} />
      </Panel></View>
      <LocalePickerModal visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />

      {/* Privacy */}
      <SectionLabel>{t('settings.privacy')}</SectionLabel>
      <Panel>
        <ToggleRow
          icon={isPublic ? 'globe-outline' : 'lock-closed-outline'}
          label={t('settings.publicProfile')}
          description={isPublic
            ? `${t('settings.visibleAt')} tazdan.com/u/${user?.username ?? 'me'}`
            : t('settings.privateProfile')}
          value={isPublic}
          onValueChange={togglePublic}
          disabled={!user?.username || updateProfile.isPending}
        />
        <PanelRow
          icon="at-outline"
          label={user?.username ? `@${user.username}` : t('settings.setHandle')}
          right={<Ionicons name="create-outline" size={16} color={p.fgFaint} />}
          onPress={openHandleModal}
        />
        {/* When read receipts are off we suppress the "read" double-check on
            outbound bubbles so the local UI doesn't leak read state. */}
        <ToggleRow
          icon={readReceiptsOn ? 'checkmark-done-outline' : 'eye-off-outline'}
          label={t('chat.readReceipts')}
          description={t('chat.readReceiptsDesc')}
          value={readReceiptsOn}
          onValueChange={(on) => { h.selection(); useChatPrefs.getState().setReadReceiptsOn(on); }}
          last
        />
      </Panel>

      {/* Security */}
      <SectionLabel>{t('settings.security')}</SectionLabel>
      <Panel>
        <PanelRow
          icon="shield-checkmark-outline"
          label={t('settings.twoFactor')}
          value={user?.twoFactorEnabled ? t('settings.on') : t('settings.off')}
          onPress={press2FA}
        />
        <PanelRow
          icon="phone-portrait-outline"
          label={t('settings.trustedDevices')}
          last
          onPress={() => { h.selection(); router.push('/settings/devices' as any); }}
        />
      </Panel>

      {/* Notifications */}
      <SectionLabel>{t('settings.notifications') || 'Notifications'}</SectionLabel>
      <Panel>
        <PanelRow
          icon="notifications-outline"
          label={t('settings.manageNotifications') || 'Email + push preferences'}
          last
          onPress={() => { h.selection(); router.push('/notif-settings' as any); }}
        />
      </Panel>

      {/* About */}
      <SectionLabel>{t('settings.about')}</SectionLabel>
      <Panel>
        <PanelRow icon="document-text-outline" label={t('settings.terms')}
          onPress={() => { void Linking.openURL('https://tazdan.com/terms'); }} />
        <PanelRow icon="lock-closed-outline" label={t('settings.privacyPolicy')}
          onPress={() => { void Linking.openURL('https://tazdan.com/privacy'); }} />
        <PanelRow icon="help-circle-outline" label={t('settings.support')} last
          onPress={() => { void Linking.openURL('mailto:support@tazdan.com'); }} />
      </Panel>

      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500' }}>tazdan · v0.1.0</Text>
      </View>

      {/* ── Handle change modal ── */}
      <BottomSheet visible={handleModalVisible} title="Change @handle"
        onClose={() => { if (!handleSaving) setHandleModalVisible(false); }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 18, lineHeight: 19 }}>
              Letters, numbers and underscores only. 3–30 characters.
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              height: 52, borderRadius: 14, paddingHorizontal: 14,
              backgroundColor: p.bg, borderWidth: 1, borderColor: p.border, gap: 6, marginBottom: 20,
            }}>
              <Text style={{ color: p.fgMuted, fontSize: 16, fontWeight: '700' }}>@</Text>
              <TextInput
                value={handleInput}
                onChangeText={(v) => setHandleInput(v.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                placeholder="yourhandle"
                placeholderTextColor={p.fgFaint}
                style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '600' }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => { if (!handleSaving) setHandleModalVisible(false); }}
                style={{ flex: 1, height: 50, borderRadius: 25, borderWidth: 1, borderColor: p.border, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveHandle}
                disabled={handleSaving || !handleInput.trim()}
                style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: p.ctaBg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: handleSaving ? 0.7 : 1 }}
              >
                {handleSaving && <ActivityIndicator size="small" color={p.ctaFg} />}
                <Text style={{ color: p.ctaFg, fontSize: 14, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
      </BottomSheet>

    </ScreenShell>
  );
}
