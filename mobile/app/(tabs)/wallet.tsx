/**
 * Wallet tab - MoonPay-flavoured net-worth dashboard.
 *
 *  Header:        title + (+) action
 *  Net worth:     centred big number + 24h delta pill
 *  Segmented:     ALL · CRYPTO · FIAT · CARDS
 *  ALL:           3-tile hero grid splitting Crypto / Fiat / Cards totals
 *                 followed by the unified asset list.
 *  CRYPTO/FIAT:   filtered asset list.
 *  CARDS:         per-card panel with last4, status, daily limit + a
 *                 "Manage" CTA into /cards.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useWallets, useCards, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import type { Wallet } from '@/types';

type Filter = 'ALL' | 'CRYPTO' | 'FIAT' | 'CARDS';

export default function WalletScreen() {
  const router = useRouter();
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const { data: wallets } = useWallets();
  const { data: cards } = useCards();
  const [filter, setFilter] = useState<Filter>('ALL');

  /** Buckets the user actually cares about. */
  const cryptoUsd = useMemo(() => sumByKind(wallets, 'crypto'), [wallets]);
  const fiatUsd   = useMemo(() => sumByKind(wallets, 'fiat'),   [wallets]);
  const cardsUsd  = useMemo(
    () => (cards ?? []).reduce((s, c: any) => s + Number(c.balance ?? 0), 0),
    [cards],
  );
  const totalUsd  = cryptoUsd + fiatUsd + cardsUsd;

  const list = useMemo<Wallet[]>(() => {
    if (!wallets) return [];
    if (filter === 'CRYPTO') return wallets.filter((w) => CURRENCY_META[w.currency]?.kind === 'crypto');
    if (filter === 'FIAT')   return wallets.filter((w) => CURRENCY_META[w.currency]?.kind === 'fiat');
    return wallets; // ALL
  }, [wallets, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: 18, paddingBottom: 8,
          }}>
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}>
              {t('wallet.title') || 'Wallets'}
            </Text>
            <Pressable
              hitSlop={6}
              onPress={() => { h.light(); router.push('/cards'); }}
              accessibilityLabel="Manage cards"
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: p.pillBg,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={18} color={p.fg} />
            </Pressable>
          </View>

          {/* Net worth */}
          <Text style={{
            color: p.fgMuted, fontSize: 13, fontWeight: '500',
            marginTop: 22, textAlign: 'center', letterSpacing: 0.2,
          }}>
            {t('wallet.netWorth') || 'Net worth'}
          </Text>
          <Text style={{
            color: p.fg, fontSize: 46, fontWeight: '800',
            letterSpacing: -1.4, marginTop: 4, textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}>
            ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={{
            flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 4,
            marginTop: 6,
            paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9,
            backgroundColor: p.greenBg,
          }}>
            <Ionicons name="caret-up" size={9} color={p.greenFg} />
            <Text style={{ color: p.greenFg, fontSize: 12, fontWeight: '700' }}>
              3.12% · 24h
            </Text>
          </View>

          {/* Segmented filter */}
          <View style={{
            flexDirection: 'row',
            marginHorizontal: 24, marginTop: 24,
            padding: 4,
            borderRadius: 14,
            backgroundColor: p.pillBg,
            gap: 4,
          }}>
            {(['ALL', 'CRYPTO', 'FIAT', 'CARDS'] as Filter[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => { h.selection(); setFilter(f); }}
                style={{ flex: 1 }}
              >
                <View style={{
                  paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                  backgroundColor: filter === f ? p.fg : 'transparent',
                }}>
                  <Text style={{
                    color: filter === f ? p.bg : p.fgMuted,
                    fontWeight: '700', fontSize: 11, letterSpacing: 0.6,
                  }}>
                    {f}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* ALL: 3-tile hero split */}
          {filter === 'ALL' && (
            <View style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 18, marginHorizontal: 24,
            }}>
              <BucketTile palette={p} icon="logo-bitcoin" label="Crypto" usd={cryptoUsd} count={(wallets ?? []).filter((w) => CURRENCY_META[w.currency]?.kind === 'crypto').length} accent="#f7931a" />
              <BucketTile palette={p} icon="cash-outline" label="Fiat"   usd={fiatUsd}   count={(wallets ?? []).filter((w) => CURRENCY_META[w.currency]?.kind === 'fiat').length}   accent="#22c55e" />
              <BucketTile palette={p} icon="card-outline" label="Cards"  usd={cardsUsd}  count={cards?.length ?? 0} accent="#7c3aed" />
            </View>
          )}

          {/* CARDS view */}
          {filter === 'CARDS' ? (
            <View style={{ paddingHorizontal: 24, marginTop: 18, gap: 12 }}>
              {(cards ?? []).length === 0 ? (
                <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                  <Ionicons name="card-outline" size={36} color={p.fgFaint} />
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 12 }}>
                    No cards issued yet.
                  </Text>
                  <Pressable
                    onPress={() => { h.medium(); router.push('/cards'); }}
                    style={{ marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: p.ctaBg }}
                  >
                    <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '700' }}>Order a card</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {cards!.map((c: any) => (
                    <Pressable
                      key={c.id}
                      onPress={() => { h.selection(); router.push('/cards'); }}
                      style={({ pressed }) => ({
                        borderRadius: 18,
                        padding: 18,
                        backgroundColor: pressed ? p.border : p.bgElev,
                        borderWidth: 1, borderColor: p.border,
                      })}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{
                            width: 38, height: 38, borderRadius: 12,
                            backgroundColor: p.pillBg,
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: p.border,
                          }}>
                            <Ionicons name={c.status === 'FROZEN' ? 'snow' : 'card'} size={18} color={p.fg} />
                          </View>
                          <View>
                            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '800' }}>
                              {c.tier ?? 'Card'} · •••• {c.last4}
                            </Text>
                            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                              {c.cardHolder} · ${Number(c.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
                      </View>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => { h.light(); router.push('/cards'); }}
                    style={({ pressed }) => ({
                      marginTop: 6, height: 48, borderRadius: 24,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 6,
                      backgroundColor: pressed ? p.border : p.pillBg,
                      borderWidth: 1, borderColor: p.border,
                    })}
                  >
                    <Ionicons name="settings-outline" size={14} color={p.fg} />
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>Manage cards</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <>
              <View style={{ height: 1, backgroundColor: p.border, marginTop: 18 }} />
              {list.map((w) => {
                const meta = CURRENCY_META[w.currency];
                if (!meta) return null;
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => h.selection()}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 24, paddingVertical: 16,
                      backgroundColor: pressed ? p.bgElev : 'transparent',
                      borderBottomWidth: 1, borderBottomColor: p.border,
                    })}
                  >
                    <View style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: p.pillBg,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1, borderColor: p.border,
                      marginRight: 14,
                    }}>
                      <Text style={{ color: p.fg, fontWeight: '700', fontSize: 14 }}>
                        {meta.flagOrIcon}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>
                        {meta.name}
                      </Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                        {Number(w.balance).toLocaleString('en-US', {
                          maximumFractionDigits: meta.decimals,
                        })} {w.currency}
                      </Text>
                    </View>
                    <Text style={{
                      color: p.fg, fontSize: 15, fontWeight: '700',
                      fontVariant: ['tabular-nums'],
                    }}>
                      ${Number(w.fiatValueUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Helpers ─────────────────────────────────────── */

function sumByKind(wallets: Wallet[] | undefined, kind: 'crypto' | 'fiat') {
  if (!wallets) return 0;
  return wallets
    .filter((w) => CURRENCY_META[w.currency]?.kind === kind)
    .reduce((s, w) => s + Number(w.fiatValueUsd ?? 0), 0);
}

function BucketTile({
  palette: p, icon, label, usd, count, accent,
}: {
  palette: Palette;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  usd: number;
  count: number;
  accent: string;
}) {
  return (
    <View style={{
      flex: 1,
      borderRadius: 18,
      backgroundColor: p.bgElev,
      borderWidth: 1, borderColor: p.border,
      padding: 14,
      gap: 10,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: `${accent}22`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <View>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
          {label.toUpperCase()}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: p.fg, fontSize: 17, fontWeight: '800',
            marginTop: 2, fontVariant: ['tabular-nums'],
          }}
        >
          ${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </Text>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', marginTop: 2 }}>
          {count} {count === 1 ? 'item' : 'items'}
        </Text>
      </View>
    </View>
  );
}
