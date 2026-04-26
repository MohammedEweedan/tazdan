/**
 * Virtual Visa cards.
 *  - Top: paged card slider — gradient cards with PAN tail + holder + expiry,
 *         tier badge top-right, contactless icon, brand wordmark
 *  - Middle: spend stats (this month / limit / cashback)
 *  - Below: card controls grid (freeze, settings, top-up, ATM)
 *  - Bottom: recent card transactions list
 */

import { useState, Fragment } from 'react';
import { Dimensions, ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TransactionItem } from '@/components/transactions/TransactionItem';
import { useCards, useTransactions, useHaptics } from '@/hooks';
import { gradients, shadows } from '@/theme';
import { formatAmount, maskCardNumber } from '@/utils/format';
import type { CardEntity } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 40;
const CARD_H = Math.round(CARD_W * 0.62);   // ISO/IEC 7810 ID-1 ratio-ish

export default function Cards() {
  const h = useHaptics();
  const { data: cards } = useCards();
  const { data: txData } = useTransactions(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = cards?.[activeIdx];

  const cardSpends = (txData?.items ?? []).filter((t) => t.type === 'CARD_SPEND' || t.type === 'CASHBACK');

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          title="Cards"
          subtitle={cards ? `${cards.length} active` : ' '}
          showBack
          right={
            <Pressable
              hitSlop={8}
              onPress={() => { h.light(); /* TODO: issue card flow */ }}
              className="w-10 h-10 rounded-full items-center justify-center bg-white/[0.06] border border-white/[0.08]"
            >
              <Ionicons name="add" size={18} color="#fff" />
            </Pressable>
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Card slider */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + 16}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20 }}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 16));
              if (i !== activeIdx) { h.selection(); setActiveIdx(i); }
            }}
          >
            {(cards ?? []).map((c, i) => (
              <MotiView
                key={c.id}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 380, delay: 60 * i }}
              >
                <View style={{ width: CARD_W, marginRight: 16 }}>
                  <VisaCard card={c} />
                </View>
              </MotiView>
            ))}
          </ScrollView>

          {/* Pager dots */}
          {cards && cards.length > 1 && (
            <View className="flex-row justify-center mt-4" style={{ gap: 6 }}>
              {cards.map((c, i) => (
                <View
                  key={c.id}
                  style={{
                    width: i === activeIdx ? 22 : 6, height: 6, borderRadius: 3,
                    backgroundColor: i === activeIdx ? '#4A8FE0' : 'rgba(255,255,255,0.18)',
                  }}
                />
              ))}
            </View>
          )}

          {/* Stats */}
          {active && (
            <View className="px-5 mt-6" style={{ gap: 10 }}>
              <Card padding={18} radius={20}>
                <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>
                  THIS MONTH
                </Text>
                <View className="flex-row items-baseline mt-2" style={{ gap: 8 }}>
                  <Text className="text-ink-primary" style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}>
                    {formatAmount(active.spentMonth, active.currency, { showSymbol: true })}
                  </Text>
                  <Text className="text-ink-tertiary text-sm font-semibold">
                    of {formatAmount(active.monthlyLimit, active.currency, { showSymbol: true })}
                  </Text>
                </View>
                {/* Progress bar */}
                <View className="mt-3" style={{
                  height: 6, borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}>
                  <View style={{
                    width: `${Math.min(100, (Number(active.spentMonth) / Number(active.monthlyLimit)) * 100)}%`,
                    height: '100%',
                    backgroundColor: '#4A8FE0',
                  }} />
                </View>
              </Card>

              <View className="flex-row" style={{ gap: 10 }}>
                <StatTile
                  label="CASHBACK"
                  value={formatAmount(active.cashbackBalance, active.currency, { showSymbol: true })}
                  icon="gift"
                  color="#22c55e"
                />
                <StatTile
                  label="DAILY LIMIT"
                  value={formatAmount(active.dailyLimit, active.currency, { showSymbol: true })}
                  icon="speedometer"
                  color="#4A8FE0"
                />
              </View>
            </View>
          )}

          {/* Card controls */}
          {active && (
            <View className="px-5 mt-6">
              <Text className="text-ink-tertiary text-xs font-semibold ml-1" style={{ letterSpacing: 1 }}>
                CONTROLS
              </Text>
              <View className="flex-row mt-3" style={{ gap: 10 }}>
                <ControlBtn
                  icon={active.frozen ? 'snow' : 'snow-outline'}
                  label={active.frozen ? 'Unfreeze' : 'Freeze'}
                  active={active.frozen}
                />
                <ControlBtn icon="cash-outline" label="Top up" />
                <ControlBtn icon="settings-outline" label="Settings" />
                <ControlBtn icon="trash-outline" label="Cancel" danger />
              </View>
            </View>
          )}

          {/* Recent activity */}
          <View className="px-5 mt-7">
            <Text className="text-ink-primary text-base font-bold">Recent transactions</Text>
            <View className="bg-white/[0.03] rounded-2xl px-3 mt-3 border border-white/[0.06]">
              {cardSpends.length === 0 && (
                <Text className="text-ink-tertiary text-sm p-4 text-center">No card transactions yet.</Text>
              )}
              {cardSpends.map((tx, i) => (
                <Fragment key={tx.id}>
                  <View style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                    <TransactionItem tx={tx} />
                  </View>
                </Fragment>
              ))}
            </View>
          </View>

          <View className="px-5 mt-7">
            <Button label="Add a new card" variant="secondary" size="md" fullWidth iconLeft={<Ionicons name="add" size={16} color="#fff" />} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ── Visa card visual ──────────────────────────────────────────────── */
function VisaCard({ card }: { card: CardEntity }) {
  const grad = gradients.cards[card.colorway];
  return (
    <View style={{ ...shadows.cardHigh, borderRadius: 24 }}>
      <LinearGradient
        colors={[...grad]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: CARD_W, height: CARD_H,
          borderRadius: 24, padding: 22,
          overflow: 'hidden',
          justifyContent: 'space-between',
        }}
      >
        {/* Sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100 }}
          pointerEvents="none"
        />

        {/* Top row */}
        <View className="flex-row items-start justify-between">
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>
            PROMRKTS · {card.tier}
          </Text>
          <Ionicons name="wifi" size={16} color="rgba(255,255,255,0.85)" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>

        {/* Card number */}
        <Text style={{
          color: '#fff',
          fontSize: 22, fontWeight: '800', letterSpacing: 4,
          fontVariant: ['tabular-nums'],
        }}>
          {maskCardNumber(card.last4)}
        </Text>

        {/* Bottom row */}
        <View className="flex-row items-end justify-between">
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>
              CARDHOLDER
            </Text>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 }}>
              {card.cardHolder}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>
              EXP
            </Text>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] }}>
              {String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -1, fontStyle: 'italic' }}>
            VISA
          </Text>
        </View>

        {/* Frozen overlay */}
        {card.frozen && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(7,13,34,0.55)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="snow" size={28} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1, marginTop: 6 }}>
              FROZEN
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────────── */
function StatTile({ label, value, icon, color }: {
  label: string; value: string;
  icon: keyof typeof Ionicons.glyphMap; color: string;
}) {
  return (
    <View
      style={{
        flex: 1, padding: 16, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <View
        style={{
          width: 32, height: 32, borderRadius: 10,
          backgroundColor: `${color}28`,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text className="text-ink-tertiary text-xs font-semibold mt-3" style={{ letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text className="text-ink-primary text-base font-bold mt-1" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ── Control button ────────────────────────────────────────────────── */
function ControlBtn({ icon, label, active, danger }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  active?: boolean; danger?: boolean;
}) {
  const h = useHaptics();
  const tint = danger ? '#ef4444' : active ? '#4A8FE0' : '#fff';
  return (
    <Pressable
      onPress={() => h.light()}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        gap: 6,
        backgroundColor: pressed ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: active ? '#4A8FE0' : 'rgba(255,255,255,0.06)',
      })}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={{ color: tint, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
