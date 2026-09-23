/**
 * Settings — preferences, privacy, handle change, 2FA, about.
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel, PanelRow, SectionLabel, ToggleRow } from '@/components/ui/ScreenShell';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useI18n, useT, LOCALE_META } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useChatPrefs } from '@/store/chatPrefsStore';
import { useHaptics, useUpdateMyProfile } from '@/hooks';
import { LocalePickerModal } from '@/components/ui/LocalePickerModal';
import { authService, profileService } from '@/services';
import { router } from 'expo-router';

export default function Settings() {
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
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

  // ── 2FA ──
  const [twoFAModal, setTwoFAModal] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFAQr, setTwoFAQr] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);

  const open2FASetup = async () => {
    setTwoFALoading(true);
    try {
      const res = await authService.enable2FA();
      setTwoFASecret(res.secret);
      setTwoFAQr(res.qrCodeDataUrl);
      setTwoFACode('');
      setTwoFAModal('setup');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Could not start 2FA setup.');
    } finally {
      setTwoFALoading(false);
    }
  };

  const confirm2FA = async () => {
    if (twoFACode.length < 6) return;
    setTwoFALoading(true);
    try {
      await authService.verify2FA(twoFACode);
      updateUser({ twoFactorEnabled: true });
      h.success();
      setTwoFAModal('idle');
    } catch (e: any) {
      h.error();
      Alert.alert('Invalid code', e?.response?.data?.error ?? 'Try again.');
    } finally {
      setTwoFALoading(false);
    }
  };

  // Disabling 2FA requires the account password too (server-enforced), which
  // the dedicated /settings/2fa screen collects. Route there instead of the
  // old code-only modal that the API now rejects.
  const disable2FA = async () => {
    setTwoFAModal('idle');
    router.push('/settings/2fa' as any);
  };

  const press2FA = () => {
    h.selection();
    // The dedicated /settings/2fa screen is the canonical 2FA manager —
    // enable, disable (code + password), and reset-to-new-device all live
    // there. Routing avoids a second, divergent disable UI here.
    router.push('/settings/2fa' as any);
  };

  return (
    <ScreenShell title={t('settings.title')}>
      {/* Account */}
      <SectionLabel first>{t('settings.account')}</SectionLabel>
      <Panel style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: p.accentSoft,
        }}>
          <Text style={{ color: p.accentText, fontSize: 18, fontWeight: '700' }}>
            {(user?.firstName?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
            {user ? `${user.firstName} ${user.lastName}` : t('settings.notSignedIn')}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
            {user?.email ?? '—'}
          </Text>
        </View>
      </Panel>

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
          right={twoFALoading ? <ActivityIndicator size="small" color={p.fgMuted} /> : undefined}
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

      {/* Appearance — one control instead of a toggle plus three rows */}
      <SectionLabel>{t('settings.appearance')}</SectionLabel>
      <Panel style={{ padding: 12 }}>
        <SegmentedControl
          value={themeMode}
          onChange={(mode) => setMode(mode)}
          options={[
            { key: 'light', label: t('settings.light'), icon: 'sunny-outline' },
            { key: 'dark',  label: t('settings.dark'),  icon: 'moon-outline' },
            { key: 'mono',  label: t('settings.mono'),  icon: 'contrast-outline' },
          ]}
        />
      </Panel>

      {/* Language */}
      <SectionLabel>{t('settings.language')}</SectionLabel>
      <Panel>
        <PanelRow
          icon="language-outline"
          label={t('settings.language')}
          value={`${LOCALE_META[locale].flag}  ${LOCALE_META[locale].label}`}
          last
          onPress={() => { h.selection(); setLangPickerVisible(true); }}
        />
      </Panel>
      <LocalePickerModal visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />

      {/* About */}
      <SectionLabel>{t('settings.about')}</SectionLabel>
      <Panel>
        <PanelRow icon="document-text-outline" label={t('settings.terms')}
          onPress={() => Alert.alert(t('settings.terms'), t('settings.termsAlert'))} />
        <PanelRow icon="lock-closed-outline" label={t('settings.privacyPolicy')}
          onPress={() => Alert.alert(t('settings.privacy'), t('settings.privacyAlert'))} />
        <PanelRow icon="help-circle-outline" label={t('settings.support')} last
          onPress={() => Alert.alert(t('settings.support'), t('settings.supportAlert'))} />
      </Panel>

      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500' }}>tazdan · v0.1.0</Text>
      </View>

      {/* ── Handle change modal ── */}
      <Modal visible={handleModalVisible} transparent animationType="fade"
        onRequestClose={() => { if (!handleSaving) setHandleModalVisible(false); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{ backgroundColor: p.bgElev, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: p.border }}>
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', marginBottom: 6 }}>Change @handle</Text>
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
          </View>
        </View>
      </Modal>

      {/* ── 2FA setup modal ── */}
      <Modal visible={twoFAModal === 'setup'} transparent animationType="fade"
        onRequestClose={() => { if (!twoFALoading) setTwoFAModal('idle'); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: p.bgElev, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: p.border }}>
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', marginBottom: 6 }}>Set up 2FA</Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
              Scan this QR code with Google Authenticator, Authy, or any TOTP app. Then enter the 6-digit code to confirm.
            </Text>
            {twoFAQr ? (
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Image source={{ uri: twoFAQr }} style={{ width: 180, height: 180, borderRadius: 12 }} />
              </View>
            ) : null}
            <View style={{ backgroundColor: p.bg, borderRadius: 10, padding: 10, marginBottom: 16 }}>
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>
                MANUAL KEY
              </Text>
              <Text selectable style={{ color: p.fg, fontSize: 13, fontWeight: '600', letterSpacing: 1, fontVariant: ['tabular-nums'] }}>
                {twoFASecret}
              </Text>
            </View>
            <TextInput
              value={twoFACode}
              onChangeText={(v) => setTwoFACode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor={p.fgFaint}
              style={{
                height: 52, borderRadius: 14, paddingHorizontal: 16,
                backgroundColor: p.bg, borderWidth: 1, borderColor: p.border,
                color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: 4,
                textAlign: 'center', marginBottom: 18, fontVariant: ['tabular-nums'],
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => { if (!twoFALoading) setTwoFAModal('idle'); }}
                style={{ flex: 1, height: 50, borderRadius: 25, borderWidth: 1, borderColor: p.border, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirm2FA}
                disabled={twoFALoading || twoFACode.length < 6}
                style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: p.ctaBg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: (twoFALoading || twoFACode.length < 6) ? 0.6 : 1 }}
              >
                {twoFALoading && <ActivityIndicator size="small" color={p.ctaFg} />}
                <Text style={{ color: p.ctaFg, fontSize: 14, fontWeight: '600' }}>Enable</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 2FA disable modal ── */}
      <Modal visible={twoFAModal === 'disable'} transparent animationType="fade"
        onRequestClose={() => { if (!twoFALoading) setTwoFAModal('idle'); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{ backgroundColor: p.bgElev, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: p.border }}>
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', marginBottom: 6 }}>Disable 2FA</Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, marginBottom: 18 }}>
              Enter your current authenticator code to turn off two-factor authentication.
            </Text>
            <TextInput
              value={twoFACode}
              onChangeText={(v) => setTwoFACode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoFocus
              placeholder="123456"
              placeholderTextColor={p.fgFaint}
              style={{
                height: 52, borderRadius: 14, paddingHorizontal: 16,
                backgroundColor: p.bg, borderWidth: 1, borderColor: p.border,
                color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: 4,
                textAlign: 'center', marginBottom: 18, fontVariant: ['tabular-nums'],
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => { if (!twoFALoading) setTwoFAModal('idle'); }}
                style={{ flex: 1, height: 50, borderRadius: 25, borderWidth: 1, borderColor: p.border, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={disable2FA}
                disabled={twoFALoading || twoFACode.length < 6}
                style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: p.redBg, borderWidth: 1, borderColor: p.redFg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: (twoFALoading || twoFACode.length < 6) ? 0.6 : 1 }}
              >
                {twoFALoading && <ActivityIndicator size="small" color={p.redFg} />}
                <Text style={{ color: p.redFg, fontSize: 14, fontWeight: '600' }}>Disable</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}
