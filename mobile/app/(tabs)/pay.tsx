/**
 * Pay tab — pay a shop or a person.
 *
 *   Scan to pay      opens the scanner; a tazdan code lands on /pay/<payee>
 *   Name or @handle  public profiles by prefix + the exact handle typed
 *   Recent           people and shops paid lately
 *
 * The P2P market that used to live here is a pushed page now (/p2p).
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Text, TextInput } from '@/components/ui/Text';
import { TopGradient, SectionLabel } from '@/components/ui/ScreenShell';
import { HEADER, TabHeader } from '@/components/ui/ScreenHeader';
import { PayeeRow } from '@/components/pay/PayeeRow';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { payService, profileService, type Payee } from '@/services';

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

export default function PayTab() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const t = useT();
  const themeMode = useTheme((s) => s.mode);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim().toLowerCase().replace(/^@/, '')), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const recent = useQuery({ queryKey: ['pay-recent'], queryFn: payService.recent, staleTime: 30_000 });
  const search = useQuery({
    queryKey: ['profile-search', debounced],
    queryFn: () => profileService.search(debounced),
    enabled: debounced.length >= 1,
    staleTime: 30_000,
  });
  // Search only finds public profiles; an exact handle reaches anyone.
  const exact = useQuery({
    queryKey: ['pay-exact', debounced],
    queryFn: () => payService.payee(debounced).catch(() => null),
    enabled: HANDLE_RE.test(debounced),
    staleTime: 30_000,
  });

  const results = useMemo<Payee[]>(() => {
    const out: Payee[] = [];
    if (exact.data && !exact.data.self) out.push(exact.data);
    for (const m of search.data ?? []) {
      if (out.some((x) => x.id === m.id)) continue;
      out.push({
        id: m.id, username: m.username, kind: 'PERSON', verified: false,
        name: `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim(), avatarUrl: m.avatarUrl ?? null,
      });
    }
    return out;
  }, [exact.data, search.data]);

  const typing = query.trim().length > 0;
  const loading = typing && (debounced !== query.trim().toLowerCase().replace(/^@/, '') || search.isFetching || exact.isFetching);

  const open = (x: Pick<Payee, 'id' | 'username'>) => {
    h.selection();
    router.push({ pathname: '/pay/[payee]', params: { payee: x.username ?? x.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <TabHeader title={t('pay.title')} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: HEADER.gutter, paddingBottom: 140 }}
          refreshControl={
            <RefreshControl refreshing={recent.isRefetching} onRefresh={() => recent.refetch()} tintColor={p.accentText} colors={[p.accent]} />
          }
        >
          {/* Scan — the quickest way to pay at a till. Hidden while typing so
              results sit right under the field. */}
          {!typing && (
            <Pressable
              onPress={() => { h.light(); router.push('/scanner'); }}
              accessibilityRole="button"
              accessibilityLabel={t('pay.scan')}
              accessibilityHint={t('pay.scanHint')}
              style={({ pressed }) => ({ alignItems: 'center', paddingTop: 20, paddingBottom: 28, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{
                width: 76, height: 76, borderRadius: 38, backgroundColor: p.accent,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="scan" size={32} color={p.accentFg} />
              </View>
              <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600', marginTop: 14 }}>{t('pay.scan')}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4, textAlign: 'center', maxWidth: 280, lineHeight: 18 }}>
                {t('pay.scanHint')}
              </Text>
            </Pressable>
          )}

          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: p.bgElev, borderRadius: 18,
            borderWidth: 1, borderColor: focused ? p.accent : p.border,
            paddingHorizontal: 14, marginTop: typing ? 8 : 0,
          }}>
            <Ionicons name="search-outline" size={18} color={p.fgMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={() => { if (results[0]) open(results[0]); }}
              placeholder={t('pay.searchPlaceholder')}
              placeholderTextColor={p.fgFaint}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              accessibilityLabel={t('pay.searchPlaceholder')}
              style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '500', paddingVertical: 14, marginLeft: 10 }}
            />
            {typing && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('pay.clear')}>
                <Ionicons name="close-circle" size={18} color={p.fgFaint} />
              </Pressable>
            )}
          </View>

          {typing ? (
            <View style={{ marginTop: 8 }}>
              {results.map((x, i) => (
                <PayeeRow key={x.id} payee={x} last={i === results.length - 1} onPress={() => open(x)} />
              ))}
              {loading && results.length === 0 && (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={p.fgMuted} />
                </View>
              )}
              {!loading && results.length === 0 && (
                <Text style={{ color: p.fgMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 }}>{t('pay.noResults')}</Text>
              )}
            </View>
          ) : (
            <View>
              <SectionLabel>{t('pay.recent')}</SectionLabel>
              {(recent.data ?? []).map((x, i, all) => (
                <PayeeRow key={x.id} payee={x} last={i === all.length - 1} onPress={() => open(x)} />
              ))}
              {recent.isSuccess && recent.data.length === 0 && (
                <Text style={{ color: p.fgMuted, fontSize: 14, marginLeft: 4, lineHeight: 20 }}>{t('pay.recentEmpty')}</Text>
              )}
              {recent.isLoading && (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={p.fgMuted} />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
