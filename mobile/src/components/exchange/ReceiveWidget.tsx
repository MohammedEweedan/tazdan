/**
 * ReceiveWidget — QR code + bank transfer bottom sheet content.
 * Matches BuyWidget/SellWidget visual language.
 */
import { useState } from 'react';
import { Alert, Image, Pressable, Share, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

type Tab = 'HANDLE' | 'BANK';

export function ReceiveWidget() {
  const p = useThemedPalette();
  const t = useT();
  const haptics = useHaptics();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('HANDLE');

  // Receive link must point at a real handle, never the email-derived one.
  // When no handle is set yet, we use the user's id so the QR still resolves
  // server-side; the UI surfaces a "Set @handle" call-to-action so users
  // know they should pick one for a friendlier link.
  const handle = user?.username?.trim();
  const linkSlug = handle ?? user?.id ?? 'me';
  const profileLink = `https://tazdan.com/u/${linkSlug}`;
  // ecc=H = highest error-correction level. Up to ~30% of the QR can
  // be obscured and it still scans. That's what makes the centered
  // logo overlay safe; without it the QR would fail to decode when
  // we punch a hole through the middle.
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=16&ecc=H&data=${encodeURIComponent(profileLink)}&bgcolor=ffffff&color=000000`;

  const copyLink = async () => {
    haptics.success();
    await Clipboard.setStringAsync(profileLink);
    Alert.alert(t('common.copied'), t('receive.linkCopied'));
  };
  const copyIban = async () => {
    haptics.success();
    await Clipboard.setStringAsync('DE89 3704 0044 0532 0130 00');
    Alert.alert(t('common.copied'), t('receive.ibanCopied'));
  };
  const shareLink = () => {
    haptics.light();
    Share.share({ message: t('receive.shareMessage', { handle: handle ?? linkSlug, link: profileLink }) });
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Tab toggle ── */}
      <View style={{
        flexDirection: 'row', padding: 4, borderRadius: 16,
        backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
        gap: 4, marginBottom: 24,
      }}>
        {(['HANDLE', 'BANK'] as Tab[]).map((tabKey) => (
          <Pressable
            key={tabKey}
            onPress={() => { haptics.selection(); setTab(tabKey); }}
            style={{ flex: 1 }}
          >
            <View style={{
              paddingVertical: 11, borderRadius: 12, alignItems: 'center',
              backgroundColor: tab === tabKey ? p.ctaBg : 'transparent',
            }}>
              <Text style={{
                color: tab === tabKey ? p.ctaFg : p.fgMuted,
                fontSize: 13, fontWeight: '700', letterSpacing: 0.4,
              }}>
                {tabKey === 'HANDLE' ? t('receive.handleQr') : t('receive.bankTransfer')}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {tab === 'HANDLE' ? (
        <>
          {/* ── QR card ── */}
          <View style={{
            backgroundColor: p.bgElev, borderRadius: 24, borderWidth: 1, borderColor: p.border,
            alignItems: 'center', paddingTop: 28, paddingBottom: 24, paddingHorizontal: 20,
            marginBottom: 20,
          }}>
            <View style={{
              width: 200, height: 200, borderRadius: 20, backgroundColor: '#ffffff',
              alignItems: 'center', justifyContent: 'center', padding: 8,
              shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
            }}>
              <Image source={{ uri: qrUrl }} style={{ width: 184, height: 184 }} resizeMode="contain" />
              {/* Centered tazdan badge — the dark-coloured icon
                  variant (icon-black.png = dark mark for use on white
                  surfaces). Wrapped in a small white-bordered tile so
                  there's a clean quiet-zone between the mark and the
                  surrounding QR modules; without that ring the icon
                  edges blur into the code's black pixels and the
                  result looks like a smudge. */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: '#ffffff',
                  borderWidth: 3, borderColor: '#ffffff',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000', shadowOpacity: 0.18,
                  shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
                }}
              >
                <Image
                  source={require('../../../assets/icon-black.png')}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>
            </View>

            <Text style={{ color: handle ? p.fg : p.fgMuted, fontSize: 26, fontWeight: '600', letterSpacing: -0.5, marginTop: 20 }}>
              {handle ? `@${handle}` : (t('home.setHandle') || 'Set @handle')}
            </Text>
            <Text selectable style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 4 }}>
              {profileLink}
            </Text>
            <Text style={{
              color: p.fgFaint, fontSize: 12, fontWeight: '500', marginTop: 10,
              textAlign: 'center', lineHeight: 18,
            }}>
              {t('receive.qrHelp')}
            </Text>
          </View>

          {/* ── Action buttons ── */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={copyLink}
              style={({ pressed }) => ({
                flex: 1, height: 52, borderRadius: 26,
                backgroundColor: pressed ? p.border : p.bgElev,
                borderWidth: 1, borderColor: p.border,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              })}
            >
              <Ionicons name="copy-outline" size={17} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{t('receive.copyLink')}</Text>
            </Pressable>
            <Pressable
              onPress={shareLink}
              style={({ pressed }) => ({
                flex: 1, height: 52, borderRadius: 26,
                backgroundColor: pressed ? p.border : p.bgElev,
                borderWidth: 1, borderColor: p.border,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              })}
            >
              <Ionicons name="share-outline" size={17} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{t('common.share')}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {/* ── Bank details card ── */}
          <View style={{
            backgroundColor: p.bgElev, borderRadius: 20, borderWidth: 1, borderColor: p.border,
            overflow: 'hidden', marginBottom: 20,
          }}>
            <BankRow
              label={t('receive.accountHolder')}
              value={
                user
                  ? (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
                      || (handle ? `@${handle}` : 'tazdan user'))
                  : 'tazdan user'
              }
              palette={p}
              first
            />
            <BankRow label="IBAN" value="DE89 3704 0044 0532 0130 00" palette={p} />
            <BankRow label="BIC / SWIFT" value="COBADEFFXXX" palette={p} />
            <BankRow label={t('receive.reference')} value={`PRMK-${linkSlug.toUpperCase()}`} palette={p} />
            <BankRow label={t('receive.currency')} value="EUR" palette={p} />
          </View>

          {/* ── Copy IBAN CTA ── */}
          <Pressable
            onPress={copyIban}
            style={({ pressed }) => ({
              height: 56, borderRadius: 28,
              backgroundColor: p.ctaBg,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
              opacity: pressed ? 0.88 : 1,
              shadowColor: p.ctaBg,
              shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
            })}
          >
            <Ionicons name="copy-outline" size={18} color={p.ctaFg} />
            <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '600' }}>{t('receive.copyIban')}</Text>
          </Pressable>

          <Text style={{ color: p.fgFaint, fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 18 }}>
            {t('receive.bankHelp')}
          </Text>
        </>
      )}
    </View>
  );
}

function BankRow({ label, value, palette: p, first }: { label: string; value: string; palette: any; first?: boolean }) {
  return (
    <View style={{
      paddingHorizontal: 18, paddingVertical: 14,
      borderTopWidth: first ? 0 : 1, borderTopColor: p.border,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
      <Text selectable style={{ color: p.fg, fontSize: 14, fontWeight: '600', maxWidth: '55%', textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}
