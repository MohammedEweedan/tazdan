/**
 * ReceiveWidget — receive-by-handle QR bottom sheet content.
 * Matches BuyWidget/SellWidget visual language.
 *
 * Bank deposits are NOT shown here: the only valid beneficiary details are
 * the admin-managed platform bank accounts served by the deposit flow.
 */
import { Alert, Image, Pressable, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Text } from '@/components/ui/Text';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

export function ReceiveWidget() {
  const p = useThemedPalette();
  const t = useT();
  const haptics = useHaptics();
  const user = useAuthStore((s) => s.user);

  // Receive link must point at a real handle, never the email-derived one.
  // When no handle is set yet, we use the user's id so the QR still resolves
  // server-side; the UI surfaces a "Set @handle" call-to-action so users
  // know they should pick one for a friendlier link.
  const handle = user?.username?.trim();
  const linkSlug = handle ?? user?.id ?? 'me';
  const profileLink = `https://tazdan.com/u/${linkSlug}`;

  const copyLink = async () => {
    haptics.success();
    await Clipboard.setStringAsync(profileLink);
    Alert.alert(t('common.copied'), t('receive.linkCopied'));
  };
  const shareLink = () => {
    haptics.light();
    Share.share({ message: t('receive.shareMessage', { handle: handle ?? linkSlug, link: profileLink }) });
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
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
          {/* Drawn on-device. ecl H tolerates ~30% of the code being
              covered, which keeps the centred logo overlay scannable. */}
          <QRCode value={profileLink} size={184} backgroundColor="#ffffff" color="#000000" ecl="H" />
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
    </View>
  );
}

