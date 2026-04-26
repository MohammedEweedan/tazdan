/**
 * Refer & earn — share code, see earnings + invite progress.
 */

import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

export default function Referral() {
  const h = useHaptics();
  const user = useAuthStore((s) => s.user);
  const code = user?.referralCode ?? 'PROMRKTS';

  const earned = 142.60;
  const pending = 12;
  const joined = 7;
  const link = `https://promrkts.app/r/${code}`;

  const onShare = async () => {
    h.medium();
    try { await Share.share({ message: `Join me on Promrkts and we both earn rewards. ${link}` }); } catch { /* noop */ }
  };
  const onCopy = () => { h.success(); Alert.alert('Copied', code); };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Refer & earn" subtitle="Share Promrkts" showBack />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>

          {/* Hero gradient */}
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 360 }}>
            <View style={{ borderRadius: 28, overflow: 'hidden', marginTop: 12 }}>
              <LinearGradient
                colors={['#4A8FE0', '#0057B8']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ padding: 24, alignItems: 'center' }}
              >
                <View
                  style={{
                    width: 64, height: 64, borderRadius: 22,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="gift" size={30} color="#fff" />
                </View>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 16, textAlign: 'center' }}>
                  Earn $25 for every friend
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>
                  They get $25 too — credited after their first $100 trade.
                </Text>
              </LinearGradient>
            </View>
          </MotiView>

          {/* Code box */}
          <View
            className="px-4 mt-5"
            style={{
              paddingVertical: 16, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              flexDirection: 'row', alignItems: 'center',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>YOUR CODE</Text>
              <Text className="text-ink-primary mt-1" style={{ fontSize: 22, fontWeight: '800', letterSpacing: 1.5 }}>
                {code}
              </Text>
            </View>
            <Pressable
              onPress={onCopy}
              hitSlop={6}
              className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] flex-row"
              style={{ gap: 6, alignItems: 'center' }}
            >
              <Ionicons name="copy-outline" size={14} color="#fff" />
              <Text className="text-ink-secondary text-xs font-bold">Copy</Text>
            </Pressable>
          </View>

          <View className="mt-4">
            <Button
              label="Share invite link"
              size="lg" fullWidth
              iconLeft={<Ionicons name="share-outline" size={16} color="#fff" />}
              onPress={onShare}
            />
          </View>

          {/* Stats */}
          <View className="flex-row mt-6" style={{ gap: 10 }}>
            <Stat label="EARNED"  value={`$${earned.toFixed(2)}`} icon="trending-up" color="#22c55e" />
            <Stat label="PENDING" value={`$${pending.toFixed(2)}`} icon="time" color="#f59e0b" />
            <Stat label="JOINED"  value={String(joined)} icon="people" color="#4A8FE0" />
          </View>

          {/* Steps */}
          <View className="mt-7">
            <Text className="text-ink-tertiary text-xs font-semibold ml-1" style={{ letterSpacing: 1 }}>HOW IT WORKS</Text>
            <View className="bg-white/[0.03] rounded-2xl mt-2 border border-white/[0.06]">
              <Step n={1} title="Share your code" body="Send to friends via text, social, or QR." />
              <Step n={2} title="They sign up + verify" body="They use your code at sign-up and pass KYC." />
              <Step n={3} title="Earn $25 each"     body="Credited after their first $100 trade. No cap." />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function Stat({ label, value, icon, color }: {
  label: string; value: string;
  icon: keyof typeof Ionicons.glyphMap; color: string;
}) {
  return (
    <Card padding={16} radius={18} style={{ flex: 1 }}>
      <View
        style={{
          width: 30, height: 30, borderRadius: 10,
          backgroundColor: `${color}28`,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text className="text-ink-tertiary text-xs font-semibold mt-3" style={{ letterSpacing: 0.6 }}>{label}</Text>
      <Text className="text-ink-primary text-base font-bold mt-1">{value}</Text>
    </Card>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'flex-start',
        padding: 14, gap: 14,
        borderTopWidth: n === 1 ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View
        style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: 'rgba(74,143,224,0.18)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#4A8FE0', fontSize: 13, fontWeight: '800' }}>{n}</Text>
      </View>
      <View style={{ flex: 1, paddingTop: 2 }}>
        <Text className="text-ink-primary text-sm font-semibold">{title}</Text>
        <Text className="text-ink-tertiary text-xs mt-1 leading-4">{body}</Text>
      </View>
    </View>
  );
}
