/**
 * Notification preferences — per-category opt-outs for email + push.
 *
 * Required by App Store / Play Store policy for any app sending
 * transactional comms. Backed by /api/notifications/preferences.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel, SectionLabel, ToggleRow } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { NOTIF_PREFS_KEY } from '@/widgets/useWidgetSync';

type ChannelKey = 'email' | 'push';
type CategoryKey = 'trades' | 'transfers' | 'deposits' | 'withdrawals' | 'p2p' | 'marketing';
/** Push-only chat settings. Present only when the server supports them. */
type ChatKey = 'messages' | 'messagePreview';
type Prefs = { email: Record<CategoryKey, boolean>; push: Record<CategoryKey, boolean> & Partial<Record<ChatKey, boolean>> };

const CATEGORIES: { key: CategoryKey; titleKey: string; descKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'trades',      titleKey: 'notifPrefs.trades.title',      descKey: 'notifPrefs.trades.desc',      icon: 'trending-up' },
  { key: 'transfers',   titleKey: 'notifPrefs.transfers.title',   descKey: 'notifPrefs.transfers.desc',   icon: 'swap-horizontal' },
  { key: 'deposits',    titleKey: 'notifPrefs.deposits.title',    descKey: 'notifPrefs.deposits.desc',    icon: 'arrow-down-circle' },
  { key: 'withdrawals', titleKey: 'notifPrefs.withdrawals.title', descKey: 'notifPrefs.withdrawals.desc', icon: 'arrow-up-circle' },
  { key: 'p2p',         titleKey: 'notifPrefs.p2p.title',         descKey: 'notifPrefs.p2p.desc',         icon: 'people' },
  { key: 'marketing',   titleKey: 'notifPrefs.marketing.title',   descKey: 'notifPrefs.marketing.desc',   icon: 'megaphone' },
];

const DEFAULT_PREFS: Prefs = {
  email: { trades: true, transfers: true, deposits: true, withdrawals: true, p2p: true, marketing: false },
  push:  { trades: true, transfers: true, deposits: true, withdrawals: true, p2p: true, marketing: false },
};

export default function NotifSettings() {
  const t = useT();
  const p = useThemedPalette();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    api.get('/notifications/preferences')
      .then((r) => {
        if (cancelled) return;
        const incoming = r.data?.preferences;
        if (incoming?.email && incoming?.push) setPrefs(incoming);
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const chatsSupported = typeof prefs.push.messages === 'boolean';

  const toggle = (channel: ChannelKey, cat: CategoryKey | ChatKey, value: boolean) => {
    const next: Prefs = {
      ...prefs,
      [channel]: { ...prefs[channel], [cat]: value },
    };
    setPrefs(next);
    // Optimistic save — revert on error.
    api.put('/notifications/preferences', { preferences: next })
      .then(() => qc.invalidateQueries({ queryKey: NOTIF_PREFS_KEY })) // widgets follow "Show preview"
      .catch(() => setPrefs(prefs));
  };

  return (
    <ScreenShell title={t('notifPrefs.title') || 'Notifications'}>
      {loading ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <ActivityIndicator color={p.fgMuted} />
        </View>
      ) : (
        <>
          <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, marginTop: 12, marginLeft: 4 }}>
            {t('notifPrefs.intro') || 'Choose which transactional confirmations you receive by email and push.'}
          </Text>

          {chatsSupported && (
            <View>
              <SectionLabel>{t('notifPrefs.channel.chats')}</SectionLabel>
              <Panel>
                <ToggleRow
                  icon="chatbubble-ellipses"
                  label={t('notifPrefs.messages.title')}
                  description={t('notifPrefs.messages.desc')}
                  value={prefs.push.messages !== false}
                  onValueChange={(v) => toggle('push', 'messages', v)}
                />
                <ToggleRow
                  icon="eye"
                  label={t('notifPrefs.preview.title')}
                  description={t('notifPrefs.preview.desc')}
                  value={prefs.push.messages !== false && prefs.push.messagePreview !== false}
                  disabled={prefs.push.messages === false}
                  onValueChange={(v) => toggle('push', 'messagePreview', v)}
                  last
                />
              </Panel>
            </View>
          )}

          {(['email', 'push'] as ChannelKey[]).map((channel) => (
            <View key={channel}>
              <SectionLabel>
                {channel === 'email'
                  ? (t('notifPrefs.channel.email') || 'Email')
                  : (t('notifPrefs.channel.push') || 'Push')}
              </SectionLabel>
              <Panel>
                {CATEGORIES.map((cat, i) => (
                  <ToggleRow
                    key={cat.key}
                    icon={cat.icon}
                    label={t(cat.titleKey) || cat.key}
                    description={t(cat.descKey) || undefined}
                    value={prefs[channel][cat.key]}
                    onValueChange={(v) => toggle(channel, cat.key, v)}
                    last={i === CATEGORIES.length - 1}
                  />
                ))}
              </Panel>
            </View>
          ))}

          <Text style={{ color: p.fgFaint, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 20, paddingHorizontal: 8 }}>
            {t('notifPrefs.footer') || 'You will always receive security-critical messages (logins, password resets, KYC outcomes) regardless of these settings.'}
          </Text>
        </>
      )}
    </ScreenShell>
  );
}
