/**
 * Receive — show your @handle, copy + share. Tab between Handle and Bank.
 */

import { useState } from 'react';
import { Alert, Image, Pressable, Share, View } from 'react-native';
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
  const handle = user?.username ?? user?.email?.split('@')[0] ?? 'me';
  // Universal link a counterparty's app deep-links into when they scan
  // the QR code — resolves to /u/[handle] in the promrkts app.
  const profileLink = `https://promrkts.com/u/${handle}`;
  // Real QR code via qrserver.com — white bg + black foreground for reliable scanning.
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=12&data=${encodeURIComponent(profileLink)}&bgcolor=ffffff&color=000000`;

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
          {/* Real QR code */}
          <View style={{
            width: 220, height: 220, borderRadius: 20,
            backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
            padding: 10,
          }}>
            <Image
              source={{ uri: qrUrl }}
              style={{ width: 200, height: 200 }}
              resizeMode="contain"
            />
          </View>
          <Text style={{
            color: p.fg, fontSize: 28, fontWeight: '600',
            letterSpacing: -0.6, marginTop: 22,
          }}>
            @{handle}
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
            onPress={() => { h.selection(); router.push(`/u/${handle}`); }}
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
                  message: `Pay me on promrkts → @${handle}\n${profileLink}`,
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
              <BankRow label="Reference"       value={`PRMK-${handle.toUpperCase()}`} palette={p} />
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
