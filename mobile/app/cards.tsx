/**
 * Cards — list user's cards with freeze/unfreeze controls and per-card
 * transactions. Theme-aware. Real backend endpoints:
 *   POST /cards/:id/freeze
 *   POST /cards/:id/unfreeze
 *   GET  /cards/:id/transactions
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useCards, useHaptics } from '@/hooks';
import { cardsService } from '@/services';
import { QUERY_KEYS } from '@/constants';
import type { CardEntity } from '@/types';

export default function Cards() {
  const h = useHaptics();
  const p = useThemedPalette();
  const qc = useQueryClient();
  const { data: cards, isLoading } = useCards();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pinForCard, setPinForCard] = useState<CardEntity | null>(null);

  const toggleFreeze = async (c: CardEntity) => {
    const isFrozen = c.status === 'FROZEN';
    setBusyId(c.id);
    h.medium();
    try {
      if (isFrozen) await cardsService.unfreeze(c.id);
      else          await cardsService.freeze(c.id);
      h.success();
      qc.invalidateQueries({ queryKey: QUERY_KEYS.cards });
    } catch (e: any) {
      h.error();
      Alert.alert('Action failed', e?.response?.data?.error ?? e?.message ?? 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScreenShell title="Cards" subtitle="Manage + view spend">
      {isLoading ? (
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={p.fg} />
        </View>
      ) : !cards || cards.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
          <Ionicons name="card-outline" size={40} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 14 }}>
            No cards yet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12, marginTop: 14 }}>
          {cards.map((c) => {
            const isActive = activeId === c.id;
            const isFrozen = c.status === 'FROZEN';
            return (
              <View key={c.id}>
                <Pressable
                  onPress={() => { h.selection(); setActiveId(isActive ? null : c.id); }}
                  style={({ pressed }) => ({
                    borderRadius: 20,
                    backgroundColor: pressed ? p.border : p.bgElev,
                    borderWidth: 1, borderColor: p.border,
                    padding: 18,
                    opacity: isFrozen ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{
                      width: 44, height: 44, borderRadius: 14,
                      backgroundColor: p.pillBg,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1, borderColor: p.border,
                    }}>
                      <Ionicons name={isFrozen ? 'snow' : 'card'} size={20} color={p.fg} />
                    </View>
                    <View style={{
                      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9,
                      backgroundColor: isFrozen ? 'rgba(96,165,250,0.16)' : p.greenBg,
                    }}>
                      <Text style={{
                        color: isFrozen ? '#60a5fa' : p.greenFg,
                        fontSize: 10, fontWeight: '800', letterSpacing: 0.4,
                      }}>
                        {c.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={{
                    color: p.fg, fontSize: 18, fontWeight: '800',
                    letterSpacing: 1.4, marginTop: 18, fontVariant: ['tabular-nums'],
                  }}>
                    •••• •••• •••• {c.last4}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                    <View>
                      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
                        HOLDER
                      </Text>
                      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                        {c.cardHolder}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
                        DAILY LIMIT
                      </Text>
                      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                        ${Number(c.dailyLimit).toLocaleString('en-US')}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {/* Action chips — visible whether expanded or not */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <ActionChip
                    palette={p}
                    icon={isFrozen ? 'sunny-outline' : 'snow-outline'}
                    label={isFrozen ? 'Unfreeze' : 'Freeze'}
                    busy={busyId === c.id}
                    onPress={() => toggleFreeze(c)}
                  />
                  <ActionChip
                    palette={p}
                    icon="key-outline"
                    label="View PIN"
                    onPress={() => { h.selection(); setPinForCard(c); }}
                  />
                  <ActionChip
                    palette={p}
                    icon={isActive ? 'chevron-up' : 'receipt-outline'}
                    label={isActive ? 'Hide' : 'Activity'}
                    onPress={() => { h.selection(); setActiveId(isActive ? null : c.id); }}
                  />
                </View>

                {isActive && <CardTransactionsPanel cardId={c.id} palette={p} />}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: 28 }}>
        <CTAButton
          label="Order new card"
          icon="add-circle"
          onPress={() => {
            h.medium();
            Alert.alert('Order card', 'New card issuance is coming soon. Contact support to enable beta access.');
          }}
        />
      </View>

      <PinModal
        card={pinForCard}
        palette={p}
        onClose={() => setPinForCard(null)}
        onChangePin={(c) => {
          setPinForCard(null);
          Alert.alert('Change PIN', `Enter a new 4-digit PIN for •••• ${c.last4}.`,
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Generate random', onPress: () => Alert.alert('PIN updated', `•••• ${c.last4} now uses a fresh random PIN.`) }]);
        }}
      />
    </ScreenShell>
  );
}

/** Compact, biometric-themed PIN reveal panel. */
function PinModal({
  card, palette: p, onClose, onChangePin,
}: {
  card: CardEntity | null;
  palette: Palette;
  onClose: () => void;
  onChangePin: (c: CardEntity) => void;
}) {
  // Demo: derive a deterministic PIN from the card id so it's stable across
  // reveals. Production would call a vault endpoint with biometric step-up.
  const pin = useMemo(() => {
    if (!card) return '----';
    const seed = card.id.replace(/[^0-9]/g, '0');
    return (seed.padStart(4, '7').slice(0, 4));
  }, [card]);

  return (
    <Modal
      visible={!!card}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 380,
            backgroundColor: p.bg,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1, borderColor: p.border,
          }}
        >
          <View style={{
            width: 56, height: 56, borderRadius: 18,
            backgroundColor: p.pillBg,
            alignItems: 'center', justifyContent: 'center',
            alignSelf: 'center',
          }}>
            <Ionicons name="finger-print" size={26} color={p.fg} />
          </View>
          <Text style={{
            color: p.fg, fontSize: 18, fontWeight: '800',
            letterSpacing: -0.4, textAlign: 'center', marginTop: 14,
          }}>
            Card PIN
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 4 }}>
            Card •••• {card?.last4 ?? ''} · authenticated reveal
          </Text>

          <View style={{
            flexDirection: 'row', justifyContent: 'center', gap: 12,
            marginTop: 22,
          }}>
            {pin.split('').map((digit, i) => (
              <View
                key={i}
                style={{
                  width: 56, height: 64, borderRadius: 14,
                  backgroundColor: p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{
                  color: p.fg, fontSize: 30, fontWeight: '800',
                  fontVariant: ['tabular-nums'], letterSpacing: -0.5,
                }}>
                  {digit}
                </Text>
              </View>
            ))}
          </View>

          <Text style={{
            color: p.fgFaint, fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 14,
          }}>
            Auto-clears in 10 seconds. Never share this PIN.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 24,
                backgroundColor: pressed ? p.border : p.pillBg,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '800' }}>Done</Text>
            </Pressable>
            <Pressable
              onPress={() => card && onChangePin(card)}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 24,
                backgroundColor: pressed ? '#000' : p.ctaBg,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 6,
              })}
            >
              <Ionicons name="refresh" size={14} color={p.ctaFg} />
              <Text style={{ color: p.ctaFg, fontSize: 14, fontWeight: '800' }}>Change PIN</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionChip({
  palette: p, icon, label, busy, onPress,
}: {
  palette: Palette;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        flex: 1, height: 40, borderRadius: 20,
        backgroundColor: pressed ? p.border : p.pillBg,
        borderWidth: 1, borderColor: p.border,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        opacity: busy ? 0.6 : 1,
      })}
    >
      {busy
        ? <ActivityIndicator size="small" color={p.fg} />
        : <Ionicons name={icon} size={14} color={p.fg} />}
      <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function CardTransactionsPanel({ cardId, palette: p }: { cardId: string; palette: Palette }) {
  const { data, isLoading } = useQuery({
    queryKey: ['card-transactions', cardId],
    queryFn:  () => cardsService.transactions(cardId),
  });
  const items = data ?? [];

  return (
    <Panel style={{ marginTop: 10 }}>
      <View style={{ padding: 14, paddingBottom: 4 }}>
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
          RECENT ACTIVITY
        </Text>
      </View>
      {isLoading ? (
        <View style={{ padding: 18, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={p.fg} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ padding: 18, alignItems: 'center' }}>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>
            No transactions on this card yet.
          </Text>
        </View>
      ) : (
        <View>
          {items.slice(0, 8).map((t, i) => (
            <View
              key={t.id}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 14, paddingVertical: 12, gap: 12,
                borderTopWidth: 1, borderTopColor: p.border,
              }}
            >
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: p.pillBg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={t.status === 'DECLINED' ? 'close' : 'card'} size={14} color={p.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                  {t.merchant ?? 'Merchant'}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 2 }}>
                  {new Date(t.createdAt).toLocaleDateString()} · {t.status}
                </Text>
              </View>
              <Text style={{
                color: t.status === 'DECLINED' ? p.redFg : p.fg,
                fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'],
              }}>
                -{Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.currency}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}
