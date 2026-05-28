/**
 * "Start a new chat" picker.
 *
 * Type-ahead search reusing the existing `profileService.search` (the
 * same endpoint Send uses), debounced by 220ms. Tapping a result jumps
 * straight into `/messages/[id]` keyed by the partner's user id — the
 * thread will be empty until the first message is sent, which creates
 * the conversation server-side.
 *
 * Includes a quick-action "Message Fortuni Support" tile at the top
 * so users can always reach support without searching.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { profileService } from '@/services';
import { TopGradient } from '@/components/ui/ScreenShell';

interface SearchHit {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  kycTier?: string;
}

const BRAND_BLUE = '#737373'; // mono accent neutral

export default function NewChat() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced type-ahead search.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) {
      setHits([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    debounce.current = setTimeout(async () => {
      try {
        const results = await profileService.search(query);
        setHits(results as SearchHit[]);
      } finally {
        setBusy(false);
      }
    }, 220);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  const openChat = (userId: string) => {
    h.light();
    router.replace(`/messages/${userId}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10,
          gap: 10,
        }}>
          <Pressable
            onPress={() => { h.selection(); router.back(); }}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={18} color={p.fg} />
          </Pressable>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>
            New chat
          </Text>
        </View>

        {/* Search box */}
        <View style={{
          marginHorizontal: 16,
          height: 46, borderRadius: 14,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 12, gap: 8,
        }}>
          <Ionicons name="at-outline" size={16} color={p.fgMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by @handle"
            placeholderTextColor={p.fgFaint}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={{ flex: 1, color: p.fg, fontSize: 15, fontWeight: '500' }}
          />
          {busy ? (
            <Ionicons name="ellipsis-horizontal" size={15} color={p.fgFaint} />
          ) : query.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={p.fgFaint} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 18, paddingBottom: 80 }}
        >
          {/* Quick action: support */}
          {!query.trim() && (
            <SupportTile palette={p} onPress={() => openChat('support')} />
          )}

          {/* Section header */}
          <Text style={{
            color: p.fgMuted, fontSize: 11, fontWeight: '700',
            letterSpacing: 0.6, textTransform: 'uppercase',
            paddingHorizontal: 24, paddingTop: 18, paddingBottom: 6,
          }}>
            {query.trim() ? 'Results' : 'Suggestions'}
          </Text>

          {/* Result rows */}
          {hits.length === 0 && query.trim() && !busy ? (
            <Text style={{
              color: p.fgFaint, fontSize: 13, fontWeight: '500',
              textAlign: 'center', paddingTop: 36,
            }}>
              No one matches "{query.trim()}".
            </Text>
          ) : (
            hits.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => openChat(u.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 24, paddingVertical: 12,
                  backgroundColor: pressed ? p.bgElev : 'transparent',
                  gap: 12,
                })}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: '#7c3aed',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                    {(u.firstName[0] ?? u.username[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                    {u.firstName} {u.lastName}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 1 }}>
                    @{u.username}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
              </Pressable>
            ))
          )}

          {!query.trim() && (
            <Text style={{
              color: p.fgFaint, fontSize: 12, fontWeight: '500',
              textAlign: 'center', marginTop: 24, paddingHorizontal: 32, lineHeight: 18,
            }}>
              Type a Fortuni handle (e.g. @aisha) to start a conversation.
              Anyone with a public profile can be messaged.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SupportTile({ palette: p, onPress }: { palette: Palette; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 16, marginTop: 18,
        flexDirection: 'row', alignItems: 'center', gap: 14,
        padding: 14, borderRadius: 16,
        backgroundColor: pressed ? p.bgElev : p.pillBg,
        borderWidth: 1, borderColor: p.border,
      })}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: BRAND_BLUE,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="headset" size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 }}>
            Fortuni Support
          </Text>
          <View style={{
            paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5,
            backgroundColor: BRAND_BLUE,
          }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>STAFF</Text>
          </View>
        </View>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
          Get help with payments, KYC, P2P, and more.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
    </Pressable>
  );
}
