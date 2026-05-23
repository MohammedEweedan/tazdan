/**
 * Referral — share a code, earn cash. Theme-aware.
 */

import { Alert, Pressable, Share, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel, CTAButton } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

export default function Referral() {
  const h = useHaptics();
  const p = useThemedPalette();
  const user = useAuthStore((s) => s.user);
  const code = user?.referralCode ?? 'fortuni';

  return (
    <ScreenShell title="Refer & earn">
      <View style={{ alignItems: 'center', marginTop: 14 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="gift" size={36} color={p.fg} />
        </View>
        <Text style={{ color: p.fg, fontSize: 28, fontWeight: '600', letterSpacing: -0.6, marginTop: 18, textAlign: 'center' }}>
          Earn $10 for every friend
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500', marginTop: 8, textAlign: 'center', paddingHorizontal: 12 }}>
          Share your code. Friends get $10 when they sign up and complete KYC. You earn $10 too.
        </Text>
      </View>

      {/* Code box */}
      <Panel style={{ marginTop: 28 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          padding: 18, gap: 14,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
              YOUR CODE
            </Text>
            <Text selectable style={{
              color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: 1, marginTop: 4,
            }}>
              {code}
            </Text>
          </View>
          <Pressable
            onPress={async () => {
              h.success();
              await Clipboard.setStringAsync(code);
              Alert.alert('Copied', `${code} copied to clipboard.`);
            }}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: pressed ? p.border : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Ionicons name="copy-outline" size={18} color={p.fg} />
          </Pressable>
        </View>
      </Panel>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <Stat label="Friends invited" value="3" palette={p} />
        <Stat label="Total earned"    value="$30" palette={p} accent={p.greenFg} />
      </View>

      {/* How it works */}
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 28, marginLeft: 4 }}>
        HOW IT WORKS
      </Text>
      <Panel style={{ marginTop: 8 }}>
        {[
          { icon: 'share-social-outline' as const,    label: 'Share your unique code with friends.' },
          { icon: 'person-add-outline' as const,      label: 'They sign up and complete KYC.' },
          { icon: 'cash-outline' as const,            label: 'You both get $10 instantly.' },
        ].map((s, i, arr) => (
          <View key={s.label} style={{
            flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
            borderBottomWidth: i === arr.length - 1 ? 0 : 1,
            borderBottomColor: p.border,
          }}>
            <View style={{
              width: 32, height: 32, borderRadius: 10,
              backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: p.border,
            }}>
              <Ionicons name={s.icon} size={15} color={p.fg} />
            </View>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500', flex: 1 }}>{s.label}</Text>
          </View>
        ))}
      </Panel>

      {/* Share CTA */}
      <View style={{ marginTop: 26 }}>
        <CTAButton
          label="Share my code"
          icon="share-outline"
          onPress={() => {
            h.medium();
            Share.share({ message: `Join me on fortuni — sign up with code ${code} and we both get $10. https://fortuni.app/r/${code}` });
          }}
        />
      </View>
    </ScreenShell>
  );
}

function Stat({ label, value, accent, palette: p }: { label: string; value: string; accent?: string; palette: ReturnType<typeof useThemedPalette> }) {
  return (
    <View style={{
      flex: 1, padding: 16, borderRadius: 16,
      backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
    }}>
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{
        color: accent ?? p.fg,
        fontSize: 24, fontWeight: '600', letterSpacing: -0.5, marginTop: 6,
        fontVariant: ['tabular-nums'],
      }}>
        {value}
      </Text>
    </View>
  );
}
