/**
 * Settings — grouped rows with toggles, choosers, destructive actions.
 * Uses Ionicons for left glyphs. Each toggle uses RN Switch for fidelity.
 */

import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useHaptics } from '@/hooks';

export default function Settings() {
  const h = useHaptics();
  const [biometrics, setBiometrics] = useState(true);
  const [push, setPush]             = useState(true);
  const [marketing, setMarketing]   = useState(false);
  const [twoFA, setTwoFA]           = useState(true);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Settings" subtitle="Account & preferences" showBack />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>

          <Group title="Security">
            <ToggleRow icon="finger-print" label="Biometric login" hint="Face ID / Touch ID"
              value={biometrics} onChange={(v) => { h.selection(); setBiometrics(v); }} />
            <ToggleRow icon="shield-checkmark" label="Two-factor authentication" hint="TOTP via Authy / Google"
              value={twoFA} onChange={(v) => { h.selection(); setTwoFA(v); }} />
            <NavRow icon="lock-closed" label="Change password" />
            <NavRow icon="key" label="API keys" />
            <NavRow icon="time" label="Active sessions" subtitle="3 devices" />
          </Group>

          <Group title="Preferences">
            <NavRow icon="globe" label="Language" subtitle="English" />
            <NavRow icon="cash" label="Default currency" subtitle="USDT" />
            <NavRow icon="contrast" label="Appearance" subtitle="Dark" />
          </Group>

          <Group title="Notifications">
            <ToggleRow icon="notifications" label="Push notifications"   value={push}      onChange={(v) => { h.selection(); setPush(v); }} />
            <ToggleRow icon="megaphone"     label="Product updates"      value={marketing} onChange={(v) => { h.selection(); setMarketing(v); }} />
          </Group>

          <Group title="Data">
            <NavRow icon="download" label="Export account data" />
            <NavRow icon="document-text" label="Statements & receipts" />
          </Group>

          <Group title="Support">
            <NavRow icon="help-circle" label="Help center" />
            <NavRow icon="chatbubbles" label="Contact support" />
            <NavRow icon="document" label="Terms & privacy" />
          </Group>

          <Group title="Danger zone" danger>
            <NavRow icon="trash" label="Close account" danger />
          </Group>

          <Text className="text-ink-muted text-xs text-center mt-8">
            Promrkts · v0.1.0 · build 100
          </Text>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ── Building blocks ───────────────────────────────────────────────── */

function Group({ title, children, danger }: { title: string; children: any; danger?: boolean }) {
  return (
    <View className="mt-6">
      <Text
        className={danger ? 'text-danger text-xs font-semibold mb-2 ml-2' : 'text-ink-tertiary text-xs font-semibold mb-2 ml-2'}
        style={{ letterSpacing: 1 }}
      >
        {title.toUpperCase()}
      </Text>
      <View className="bg-white/[0.03] rounded-2xl border border-white/[0.06]">
        {children}
      </View>
    </View>
  );
}

function ToggleRow({ icon, label, hint, value, onChange }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; hint?: string;
  value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center',
        padding: 14, gap: 12,
        borderTopWidth: StyleHairline(),
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View style={iconBg('#4A8FE0')}>
        <Ionicons name={icon} size={16} color="#4A8FE0" />
      </View>
      <View style={{ flex: 1 }}>
        <Text className="text-ink-primary text-sm font-semibold">{label}</Text>
        {hint && <Text className="text-ink-tertiary text-xs mt-0.5">{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? '#fff' : '#fff'}
        trackColor={{ false: 'rgba(255,255,255,0.10)', true: '#0057B8' }}
        ios_backgroundColor="rgba(255,255,255,0.10)"
      />
    </View>
  );
}

function NavRow({ icon, label, subtitle, danger, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; subtitle?: string; danger?: boolean;
  onPress?: () => void;
}) {
  const h = useHaptics();
  return (
    <Pressable
      onPress={() => { h.selection(); onPress?.(); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        padding: 14, gap: 12,
        borderTopWidth: StyleHairline(),
        borderColor: 'rgba(255,255,255,0.05)',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={iconBg(danger ? '#ef4444' : '#4A8FE0')}>
        <Ionicons name={icon} size={16} color={danger ? '#ef4444' : '#4A8FE0'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? '#ef4444' : '#fff', fontSize: 14, fontWeight: '600' }}>{label}</Text>
        {subtitle && <Text className="text-ink-tertiary text-xs mt-0.5">{subtitle}</Text>}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.32)" />}
    </Pressable>
  );
}

const iconBg = (color: string) => ({
  width: 32, height: 32, borderRadius: 10,
  alignItems: 'center' as const, justifyContent: 'center' as const,
  backgroundColor: `${color}24`,
});

// First child gets no top border. We can't easily know "is first" inside a
// generic Group, so we use a 0.5px hairline for all rows — the first row's
// border just sits flush against the rounded container's inside edge,
// invisibly clipped by border-radius. Trade-off vs. requiring index plumbing.
function StyleHairline() { return 1; }
