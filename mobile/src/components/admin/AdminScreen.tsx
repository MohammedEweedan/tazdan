/**
 * Shared admin chrome — gives every admin page one consistent, polished look:
 *
 *   <AdminScreen title="Deposits" subtitle="…" right={…}>
 *     <AdminTabs tabs={[…]} value={tab} onChange={setTab} />
 *     …content…
 *   </AdminScreen>
 *
 * Replaces the ad-hoc per-page headers + the cramped horizontal pill rows that
 * read as "trash". The tab bar is a real segmented control with a clear active
 * state in the brand accent, a count badge, and even spacing.
 */

import { ReactNode } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useThemedPalette, useTheme, type Palette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';
import { TopGradient } from '@/components/ui/ScreenShell';

export function AdminScreen({
  title, subtitle, right, children, scroll = true, refreshControl,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: ReactNode;
}) {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const h = useHaptics();
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN';

  if (!isAdmin) return <AdminDenied />;

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
      <Pressable
        onPress={() => { h.selection(); router.back(); }}
        hitSlop={8}
        style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border }}
      >
        <Ionicons name="chevron-back" size={20} color={p.fg} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl as any}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * Segmented tab control. `tabs` is `[{ key, label, count? }]`. The active tab
 * fills with the brand accent; counts render as a subtle badge. Evenly spaced
 * when ≤4 tabs, horizontally scrollable beyond that.
 */
export function AdminTabs<T extends string>({
  tabs, value, onChange,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  value: T;
  onChange: (k: T) => void;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  const scrollable = tabs.length > 4;

  const Pill = ({ tab }: { tab: { key: T; label: string; count?: number } }) => {
    const on = value === tab.key;
    return (
      <Pressable
        onPress={() => { h.selection(); onChange(tab.key); }}
        style={{
          flex: scrollable ? undefined : 1,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11,
          backgroundColor: on ? p.accent : 'transparent',
        }}
      >
        <Text style={{ color: on ? p.accentFg : p.fgMuted, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
          {tab.label}
        </Text>
        {tab.count != null && tab.count > 0 && (
          <View style={{ minWidth: 18, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.25)' : p.pillBg }}>
            <Text style={{ color: on ? p.accentFg : p.fgMuted, fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{tab.count}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const track: StyleProp<ViewStyle> = {
    flexDirection: 'row', backgroundColor: p.bgElev, borderRadius: 14,
    borderWidth: 1, borderColor: p.border, padding: 4, marginBottom: 16,
  };

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 4 }}>
        <View style={[track, { marginBottom: 0 }]}>{tabs.map((t) => <Pill key={t.key} tab={t} />)}</View>
      </ScrollView>
    );
  }
  return <View style={track}>{tabs.map((t) => <Pill key={t.key} tab={t} />)}</View>;
}

/** Consistent section card used across admin pages. */
export function AdminCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useThemedPalette();
  return (
    <View style={[{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 16 }, style]}>
      {children}
    </View>
  );
}

/** A labelled stat row (label left, value right). */
export function AdminStatRow({ label, value, tone, p }: { label: string; value: string; tone?: 'ok' | 'bad' | 'warn'; p: Palette }) {
  const color = tone === 'ok' ? p.greenFg : tone === 'bad' ? p.redFg : tone === 'warn' ? p.amberFg : p.fg;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 }}>
      <Text style={{ color: p.fgMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function AdminDenied() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <Ionicons name="lock-closed-outline" size={48} color={p.fgFaint} />
      <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', marginTop: 14 }}>Admin only</Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 24, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
        <Text style={{ color: p.fg, fontWeight: '700' }}>Back</Text>
      </Pressable>
    </View>
  );
}
