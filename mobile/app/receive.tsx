/**
 * Receive money / crypto.
 *  Tabs: Handle (default) · Address · Bank
 *   - Handle: shows @username, big QR-style block, share + copy CTAs
 *   - Address: network picker (TRC20/ERC20/BEP20) + crypto deposit address
 *   - Bank: SEPA/SWIFT IBAN instructions for fiat deposits
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

type Tab = 'HANDLE' | 'ADDRESS' | 'BANK';

const NETWORKS = [
  { id: 'TRC20', label: 'Tron · TRC20',  fee: '~$1' },
  { id: 'ERC20', label: 'Ethereum · ERC20', fee: '~$8' },
  { id: 'BEP20', label: 'BNB · BEP20',   fee: '~$0.30' },
];

const MOCK_ADDR: Record<string, string> = {
  TRC20: 'TXyZ8jK4mP9qR2sV1nB7cD6gH3wF5tQ4eL',
  ERC20: '0x4A8FE0aB12cD34eF56789012345678901234abcd',
  BEP20: 'bnb1q9z8x7y6w5v4u3t2s1r0p9o8n7m6l5k4j3i2h1g',
};

export default function Receive() {
  const h = useHaptics();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('HANDLE');
  const [network, setNetwork] = useState('TRC20');

  const handle = `@${user?.username ?? 'rayofsunshine'}`;

  const onShare = async (text: string) => {
    h.light();
    try { await Share.share({ message: text }); } catch { /* noop */ }
  };
  const onCopy = (text: string) => {
    h.success();
    Alert.alert('Copied', text);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Receive" subtitle="Get paid" showBack />

        {/* Segmented */}
        <View className="px-5">
          <View
            className="flex-row p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]"
            style={{ gap: 4 }}
          >
            {(['HANDLE', 'ADDRESS', 'BANK'] as Tab[]).map((t) => (
              <Pressable key={t} onPress={() => { h.selection(); setTab(t); }} style={{ flex: 1 }}>
                <View
                  style={{
                    paddingVertical: 10, borderRadius: 14, alignItems: 'center',
                    backgroundColor: tab === t ? '#0057B8' : 'transparent',
                  }}
                >
                  <Text style={{
                    color: tab === t ? '#fff' : 'rgba(255,255,255,0.55)',
                    fontWeight: '700', fontSize: 13, letterSpacing: 0.5,
                  }}>
                    {t === 'HANDLE' ? '@Handle' : t === 'ADDRESS' ? 'Crypto' : 'Bank'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 }}>

          {tab === 'HANDLE' && (
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 320 }}
            >
              <View className="items-center">
                <FakeQR text={handle} />
                <Text className="text-ink-primary mt-5" style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}>
                  {handle}
                </Text>
                <Text className="text-ink-tertiary text-xs mt-1.5 text-center px-6">
                  Anyone with promrkts can pay you instantly with this handle.
                </Text>
              </View>
              <View className="flex-row mt-8" style={{ gap: 10 }}>
                <Button
                  label="Share"
                  variant="primary"
                  size="md"
                  fullWidth
                  iconLeft={<Ionicons name="share-outline" size={16} color="#fff" />}
                  onPress={() => onShare(`Pay me on Promrkts: ${handle}`)}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Copy"
                  variant="secondary"
                  size="md"
                  fullWidth
                  iconLeft={<Ionicons name="copy-outline" size={16} color="#fff" />}
                  onPress={() => onCopy(handle)}
                  style={{ flex: 1 }}
                />
              </View>
            </MotiView>
          )}

          {tab === 'ADDRESS' && (
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 320 }}
            >
              <Text className="text-ink-tertiary text-xs font-semibold ml-1" style={{ letterSpacing: 1 }}>NETWORK</Text>
              <View className="bg-white/[0.03] rounded-2xl mt-2 border border-white/[0.06]">
                {NETWORKS.map((n, i) => (
                  <Pressable
                    key={n.id}
                    onPress={() => { h.selection(); setNetwork(n.id); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center',
                      padding: 14, gap: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderColor: 'rgba(255,255,255,0.05)',
                      opacity: pressed ? 0.78 : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text className="text-ink-primary text-sm font-semibold">{n.label}</Text>
                      <Text className="text-ink-tertiary text-xs mt-0.5">Network fee {n.fee}</Text>
                    </View>
                    <Radio active={network === n.id} />
                  </Pressable>
                ))}
              </View>

              <View className="items-center mt-6">
                <FakeQR text={MOCK_ADDR[network]} />
              </View>

              <View
                className="px-4 mt-6"
                style={{
                  paddingVertical: 14, borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 0.6 }}>
                  YOUR USDT ADDRESS · {network}
                </Text>
                <Text className="text-ink-primary text-xs font-semibold mt-2" selectable style={{ fontFamily: 'Menlo' }}>
                  {MOCK_ADDR[network]}
                </Text>
              </View>

              <View className="flex-row mt-5" style={{ gap: 10 }}>
                <Button label="Share" variant="primary" size="md" fullWidth onPress={() => onShare(MOCK_ADDR[network])} style={{ flex: 1 }} />
                <Button label="Copy"  variant="secondary" size="md" fullWidth onPress={() => onCopy(MOCK_ADDR[network])} style={{ flex: 1 }} />
              </View>

              <View
                className="px-4 mt-5"
                style={{
                  flexDirection: 'row', gap: 10, alignItems: 'flex-start',
                  paddingVertical: 12, borderRadius: 14,
                  backgroundColor: 'rgba(245,158,11,0.10)',
                  borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
                }}
              >
                <Ionicons name="warning-outline" size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                <Text className="text-ink-secondary text-xs leading-4" style={{ flex: 1 }}>
                  Send only USDT on the {network} network. Tokens sent on other networks will be lost.
                </Text>
              </View>
            </MotiView>
          )}

          {tab === 'BANK' && (
            <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }}>
              <Card padding={20} radius={20}>
                <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>SEPA · EUR</Text>
                <BankRow k="Beneficiary" v={`${user?.firstName} ${user?.lastName}`} />
                <BankRow k="IBAN" v="DE89 3704 0044 0532 0130 00" mono />
                <BankRow k="BIC" v="COBADEFFXXX" mono />
                <BankRow k="Reference" v={`PRM-${user?.referralCode ?? ''}`} mono />
              </Card>
              <Text className="text-ink-tertiary text-xs mt-4 text-center px-3">
                Always include the reference. Funds typically arrive within 1 business day.
              </Text>
            </MotiView>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function FakeQR({ text }: { text: string }) {
  // Deterministic pseudo-QR pattern from the input string. Replace with
  // `react-native-qrcode-svg` when wired up — keeping zero-dep here so the
  // foundation stays installable.
  const cells = 13;
  const grid: boolean[][] = [];
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  for (let y = 0; y < cells; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < cells; x++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      row.push(((seed >>> ((x + y) % 16)) & 1) === 1);
    }
    grid.push(row);
  }
  // Force 3 finder squares (top-left, top-right, bottom-left)
  const stamp = (sx: number, sy: number) => {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) grid[sy + y][sx + x] = true;
  };
  stamp(0, 0); stamp(cells - 3, 0); stamp(0, cells - 3);

  return (
    <LinearGradient
      colors={['#ffffff', '#e8f0fc']}
      style={{ padding: 16, borderRadius: 24 }}
    >
      <View>
        {grid.map((row, y) => (
          <View key={y} style={{ flexDirection: 'row' }}>
            {row.map((on, x) => (
              <View
                key={x}
                style={{
                  width: 14, height: 14,
                  backgroundColor: on ? '#0057B8' : 'transparent',
                  borderRadius: 2,
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <View
      style={{
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2,
        borderColor: active ? '#4A8FE0' : 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A8FE0' }} />}
    </View>
  );
}

function BankRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View className="mt-3">
      <Text className="text-ink-tertiary text-xs font-medium" style={{ letterSpacing: 0.4 }}>{k}</Text>
      <Text
        selectable
        className="text-ink-primary text-sm font-bold mt-0.5"
        style={mono ? { fontFamily: 'Menlo' } : undefined}
      >
        {v}
      </Text>
    </View>
  );
}
