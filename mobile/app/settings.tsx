/**
 * Settings — preferences, privacy, handle change, 2FA, about.
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, Switch, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel, PanelRow } from '@/components/ui/ScreenShell';
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
  const toggleTheme = useTheme((s) => s.toggle);
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

  const disable2FA = async () => {
    if (twoFACode.length < 6) return;
    setTwoFALoading(true);
    try {
      await authService.disable2FA(twoFACode);
      updateUser({ twoFactorEnabled: false });
      h.success();
      setTwoFAModal('idle');
    } catch (e: any) {
      h.error();
      Alert.alert('Invalid code', e?.response?.data?.error ?? 'Try again.');
    } finally {
      setTwoFALoading(false);
    }
  };

  const press2FA = () => {
    h.selection();
    if (user?.twoFactorEnabled) {
      setTwoFACode('');
      setTwoFAModal('disable');
    } else {
      open2FASetup();
    }
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
          padding: 14, borderBottomWidth: 1, borderBottomColor: p.border,
        }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={isPublic ? 'globe-outline' : 'lock-closed-outline'} size={16} color={p.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{t('settings.publicProfile')}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
              {isPublic
                ? `${t('settings.visibleAt')} tazdan.com/u/${user?.username ?? 'me'}`
                : t('settings.privateProfile')}
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={togglePublic}
            disabled={!user?.username || updateProfile.isPending}
            trackColor={{ false: p.border, true: p.ctaBg }}
            thumbColor="#fff"
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
        </View>
        <PanelRow
          icon="at-outline"
          label={user?.username ? `@${user.username}` : t('settings.setHandle')}
          right={<Ionicons name="create-outline" size={16} color={p.fgFaint} />}
          onPress={openHandleModal}
        />
        {/* Read receipts toggle.  When off, we suppress the "read"
            double-check on outbound bubbles so the local UI doesn't
            leak read state.  Server-side suppression is a follow-up
            (next step would be propagating this flag to message-read
            broadcasting). */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 14,
        }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={readReceiptsOn ? 'checkmark-done-outline' : 'eye-off-outline'} size={16} color={p.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
              {t('chat.readReceipts')}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
              {t('chat.readReceiptsDesc')}
            </Text>
          </View>
          <Switch
            value={readReceiptsOn}
            onValueChange={(on) => useChatPrefs.getState().setReadReceiptsOn(on)}
            trackColor={{ false: p.border, true: p.ctaBg }}
            thumbColor="#fff"
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
        </View>
      </Panel>

      {/* Notifications */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        {(t('settings.notifications') || 'NOTIFICATIONS').toUpperCase()}
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <PanelRow
          icon="notifications-outline"
          label={t('settings.manageNotifications') || 'Email + push preferences'}
          last
          onPress={() => { h.selection(); router.push('/notif-settings' as any); }}
          right={<Ionicons name="chevron-forward" size={16} color={p.fgFaint} />}
        />
      </Panel>

      {/* Security */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        SECURITY
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <PanelRow
          icon="shield-outline"
          label={`Two-Factor Auth · ${user?.twoFactorEnabled ? 'ON' : 'OFF'}`}
          right={
            twoFALoading
              ? <ActivityIndicator size="small" color={p.fgMuted} />
              : user?.twoFactorEnabled
                ? <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: p.greenBg }}>
                    <Text style={{ color: p.greenFg, fontSize: 10, fontWeight: '600' }}>ON</Text>
                  </View>
                : <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
          }
          onPress={press2FA}
        />
        <PanelRow
          icon="phone-portrait-outline"
          label="Trusted Devices"
          last
          right={<Ionicons name="chevron-forward" size={16} color={p.fgFaint} />}
          onPress={() => { h.selection(); router.push('/settings/devices' as any); }}
        />
      </Panel>

      {/* Appearance */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        {t('settings.appearance').toUpperCase()}
      </Text>
      <Panel style={{ marginTop: 8 }}>
        <PanelRow
          icon="contrast-outline"
          label={`${t('settings.theme')} · ${themeMode === 'mono' ? 'Mono' : themeMode === 'dark' ? t('settings.dark') : t('settings.light')}`}
          onPress={() => { h.selection(); toggleTheme(); }}
          right={<Ionicons name="swap-horizontal" size={16} color={p.fgFaint} />}
        />
        <PanelRow
          icon="sunny-outline"
          label={t('settings.light')}
          onPress={() => { h.selection(); setMode('light'); }}
          right={themeMode === 'light' ? <Ionicons name="checkmark-circle" size={18} color={p.greenFg} /> : null}
        />
        <PanelRow
          icon="moon-outline"
          label={t('settings.dark')}
          onPress={() => { h.selection(); setMode('dark'); }}
          right={themeMode === 'dark' ? <Ionicons name="checkmark-circle" size={18} color={p.greenFg} /> : null}
        />
        <PanelRow
          icon="contrast"
          label="Monochrome"
          last
          onPress={() => { h.selection(); setMode('mono'); }}
          right={themeMode === 'mono' ? <Ionicons name="checkmark-circle" size={18} color={p.greenFg} /> : null}
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

      {/* About */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 22, marginLeft: 4 }}>
        {t('settings.about').toUpperCase()}
      </Text>
      <Panel style={{ marginTop: 8 }}>
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
