/**
 * Role chooser — shown right after login for users with role===ADMIN.
 * Picks between the regular user experience and the admin ops console.
 * Selection is persisted to secure storage so it survives reloads;
 * logging out (or tapping "switch view" in profile) clears it.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import * as Haptics from 'expo-haptics';

export default function RoleSelectScreen() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setViewMode = useAuthStore((s) => s.setViewMode);

  // Pulse animation for the live indicator on the admin tile
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const dotScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });

  const choose = async (mode: 'admin' | 'user') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setViewMode(mode);
    if (mode === 'admin') {
      router.replace('/admin' as any);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      {/* Subtle ambient gradient */}
      <LinearGradient
        colors={themeMode === 'dark'
          ? ['rgba(74,143,224,0.16)', 'rgba(124,58,237,0.10)', 'transparent']
          : ['rgba(74,143,224,0.14)', 'rgba(124,58,237,0.08)', 'transparent']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 480 }}
        pointerEvents="none"
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 36, justifyContent: 'space-between' }}>
          {/* Heading */}
          <View>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 }}>
              WELCOME BACK, {(user?.firstName ?? 'ADMIN').toUpperCase()}
            </Text>
            <Text style={{ color: p.fg, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 }}>
              Continue as…
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
              You have admin privileges. Choose how to use the app for this session.
            </Text>
          </View>

          {/* Tiles */}
          <View style={{ gap: 14 }}>
            {/* Admin tile */}
            <Pressable
              onPress={() => choose('admin')}
              style={({ pressed }) => ({
                borderRadius: 22,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(74,143,224,0.45)',
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <LinearGradient
                colors={['rgba(74,143,224,0.20)', 'rgba(74,143,224,0.05)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ padding: 22 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 14,
                    backgroundColor: '#4a8fe0',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="shield-checkmark" size={24} color="#fff" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Animated.View style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: '#22c55e',
                      transform: [{ scale: dotScale }],
                      opacity: dotOpacity,
                    }} />
                    <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>LIVE OPS</Text>
                  </View>
                </View>
                <Text style={{ color: p.fg, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
                  Admin Console
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
                  Dashboard · KYC · Deposits · Withdrawals · Rates · Users · Support · Escalations
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <FeatureChip icon="trending-up" label="Revenue" />
                  <FeatureChip icon="people" label="Users" />
                  <FeatureChip icon="cash" label="Rates" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Open admin</Text>
                  <Ionicons name="arrow-forward" size={15} color={p.fg} />
                </View>
              </LinearGradient>
            </Pressable>

            {/* User tile */}
            <Pressable
              onPress={() => choose('user')}
              style={({ pressed }) => ({
                borderRadius: 22,
                backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border,
                padding: 22,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{
                  width: 48, height: 48, borderRadius: 14,
                  backgroundColor: p.fg,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="person" size={24} color={p.bg} />
                </View>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: p.pillBg }}>
                  <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>USER VIEW</Text>
                </View>
              </View>
              <Text style={{ color: p.fg, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>
                My Wallet
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
                Trade, deposit, withdraw, and use the app exactly like a regular customer.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <FeatureChip icon="wallet" label="Balances" />
                <FeatureChip icon="swap-horizontal" label="P2P" />
                <FeatureChip icon="card" label="Cards" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Continue as user</Text>
                <Ionicons name="arrow-forward" size={15} color={p.fg} />
              </View>
            </Pressable>
          </View>

          {/* Footer note */}
          <Text style={{ color: p.fgFaint, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
            You can switch views any time from your profile menu.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function FeatureChip({ icon, label }: { icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; label: string }) {
  const p = useThemedPalette();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7,
      backgroundColor: p.bg,
      borderWidth: 1, borderColor: p.border,
    }}>
      <Ionicons name={icon} size={11} color={p.fgMuted} />
      <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}
