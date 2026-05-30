/**
 * Receive — show your @handle, copy + share. Tab between Handle and Bank.
 */

import { useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Text } from '@/components/ui/Text';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

type Tab = 'HANDLE' | 'BANK';

export default function Receive() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('HANDLE');
  // Never derive a handle from the email local-part — exposes PII and
  // pretends the user picked a handle they didn't. When no handle is
  // set, the link still works via the user's id but we surface a "Set
  // @handle" call-to-action in the UI instead of a fake @handle.
  const handle = user?.username?.trim();
  const linkSlug = handle ?? user?.id ?? 'me';
  // Universal link a counterparty's app deep-links into when they scan
  // the QR code — resolves to /u/[slug] in the promrkts app.
  const profileLink = `https://promrkts.com/u/${linkSlug}`;

  return (
    <ScreenShell title="Receive money">
      {/* Tabs */}
      <View style={{
        flexDirection: 'row', padding: 4, marginTop: 12,
        borderRadius: 14,
        backgroundColor: p.bgElev,
        borderWidth: 1, borderColor: p.border,
        gap: 4,
      }}>
        {(['HANDLE', 'BANK'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => { h.selection(); setTab(t); }}
            style={{ flex: 1 }}
          >
            <View style={{
              paddingVertical: 10, borderRadius: 10, alignItems: 'center',
              backgroundColor: tab === t ? p.ctaBg : 'transparent',
            }}>
              <Text style={{
                color: tab === t ? p.ctaFg : p.fgMuted,
                fontSize: 12, fontWeight: '700', letterSpacing: 0.5,
              }}>
                {t === 'HANDLE' ? '@HANDLE' : 'BANK TRANSFER'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {tab === 'HANDLE' ? (
        <View style={{ marginTop: 28, alignItems: 'center' }}>
          {/* Real QR code with a centered promrkts mark. The white
              card around the code is intentional — QR scanners need
              the white quiet-zone to lock on, so we don't tint it.
              The dark surrounding screen + soft shadow stops it from
              floating awkwardly inside the mono UI. */}
          <View style={{
            width: 220, height: 220, borderRadius: 20,
            backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
            padding: 10,
            shadowColor: '#000', shadowOpacity: 0.18,
            shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
          }}>
            {/* QR renders locally via react-native-qrcode-svg —
                no network round-trip means the code shows up even
                offline / in regions where the previous qrserver.com
                CDN was blocked.  ecc=H gives ~30% redundancy so the
                centred promrkts mark below doesn't break decoding. */}
            <QRCode
              value={profileLink}
              size={200}
              backgroundColor="#ffffff"
              color="#000000"
              ecl="H"
              logo={require('../assets/icon-white.png')}
              logoSize={40}
              logoBackgroundColor="#ffffff"
              logoMargin={4}
              logoBorderRadius={10}
            />
          </View>
          <Text style={{
            color: handle ? p.fg : p.fgMuted, fontSize: 28, fontWeight: '600',
            letterSpacing: -0.6, marginTop: 22,
          }}>
            {handle ? `@${handle}` : 'Set @handle'}
          </Text>
          <Text
            selectable
            style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 4 }}
          >
            {profileLink}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 8, textAlign: 'center', paddingHorizontal: 12 }}>
            Scanning the QR opens your public profile so anyone can pay you,
            see your KYC tier, and view your P2P offers.
          </Text>

          <Pressable
            onPress={() => { h.selection(); router.push(`/u/${linkSlug}`); }}
            hitSlop={6}
            style={({ pressed }) => ({
              marginTop: 14,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
              backgroundColor: pressed ? p.border : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            })}
          >
            <Ionicons name="person-outline" size={14} color={p.fg} />
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>
              Preview public profile
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
            <Pressable
              onPress={async () => {
                h.success();
                await Clipboard.setStringAsync(profileLink);
                Alert.alert('Copied', 'Profile link copied to clipboard.');
              }}
              style={({ pressed }) => ({
                flex: 1, height: 50, borderRadius: 25,
                backgroundColor: pressed ? p.border : p.pillBg,
                borderWidth: 1, borderColor: p.border,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8,
              })}
            >
              <Ionicons name="copy-outline" size={16} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Copy</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                h.light();
                Share.share({
                  message: handle
                    ? `Pay me on promrkts → @${handle}\n${profileLink}`
                    : `Pay me on promrkts → ${profileLink}`,
                });
              }}
              style={({ pressed }) => ({
                flex: 1, height: 50, borderRadius: 25,
                backgroundColor: pressed ? p.border : p.pillBg,
                borderWidth: 1, borderColor: p.border,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8,
              })}
            >
              <Ionicons name="share-outline" size={16} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Share</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 22 }}>
          <Panel>
            <View style={{ padding: 16, gap: 14 }}>
              <BankRow label="Account holder" value={user ? `${user.firstName} ${user.lastName}` : 'promrkts user'} palette={p} />
              <BankRow label="IBAN"            value="DE89 3704 0044 0532 0130 00" palette={p} />
              <BankRow label="BIC / SWIFT"     value="COBADEFFXXX" palette={p} />
              <BankRow label="Reference"       value={`PRMK-${linkSlug.toUpperCase()}`} palette={p} />
            </View>
          </Panel>
          <Pressable
            onPress={async () => {
              h.success();
              await Clipboard.setStringAsync('DE89 3704 0044 0532 0130 00');
              Alert.alert('Copied', 'IBAN copied to clipboard.');
            }}
            style={({ pressed }) => ({
              marginTop: 16, height: 50, borderRadius: 25,
              backgroundColor: pressed ? p.border : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8,
            })}
          >
            <Ionicons name="copy-outline" size={16} color={p.fg} />
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Copy IBAN</Text>
          </Pressable>
        </View>
      )}
    </ScreenShell>
  );
}

function BankRow({ label, value, palette: p }: { label: string; value: string; palette: ReturnType<typeof useThemedPalette> }) {
  return (
    <View>
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Text>
      <Text selectable style={{ color: p.fg, fontSize: 14, fontWeight: '600', marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
