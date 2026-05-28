/**
 * SendMoneySheet — bottom-sheet picker for sending an in-chat payment.
 *
 *   • Asset chips driven by the user's actual `useWallets()` data, so they
 *     can only pay with what they hold. Each chip shows the available
 *     balance (balance − frozen) under the symbol.
 *   • Amount input with the active currency suffix and a soft "MAX" pill
 *     to drop the full available balance into the field.
 *   • Personalised note input under the amount.
 *   • Keyboard-aware: wraps the sheet in `KeyboardAvoidingView` so the
 *     primary action stays visible whenever a soft keyboard is up.
 *   • Pure-presentational — the parent owns the actual mutation.
 */

import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';

import { type Palette } from '@/store/themeStore';
import { useWallets } from '@/hooks';
import { getCurrencyMeta } from '@/constants';
import type { Currency, Wallet } from '@/types';

const BRAND_BLUE = '#737373'; // mono accent neutral

export interface SendMoneySheetProps {
  visible: boolean;
  palette: Palette;
  /** Display name of the recipient — shown under the title. */
  recipientLabel?: string;
  onClose: () => void;
  onSubmit: (amount: number, currency: string, note?: string) => void;
}

export function SendMoneySheet({
  visible, palette: p, recipientLabel, onClose, onSubmit,
}: SendMoneySheetProps) {
  const { data: wallets } = useWallets();

  // Normalised wallet list: USDT_ERC20 / USDT_TRC20 merge into one USDT
  // chip.  We still show every wallet (even 0-balance) so the user can
  // see what's held, but chips with 0 avail are visually dimmed and
  // non-selectable.
  const displayWallets = useMemo<DisplayWallet[]>(() => {
    const map = new Map<string, DisplayWallet>();
    (wallets ?? []).forEach((w) => {
      const cur = String(w.currency);
      const isUsdtVariant = cur === 'USDT_ERC20' || cur === 'USDT_TRC20';
      const displayCurrency = isUsdtVariant ? 'USDT' : cur;
      const bal = availableOf(w);
      const existing = map.get(displayCurrency);
      if (existing) {
        existing.balance += bal;
        // Keep the wallet with the highest individual balance as the canonical one
        if (bal > availableOf(existing.wallet)) {
          existing.wallet = w;
        }
      } else {
        map.set(displayCurrency, {
          currency: displayCurrency,
          wallet: w,
          balance: bal,
          chain: isUsdtVariant ? (cur === 'USDT_ERC20' ? 'ERC20' : 'TRC20') : undefined,
        });
      }
    });
    return Array.from(map.values())
      .sort((a, b) => Number(b.wallet.fiatValueUsd ?? 0) - Number(a.wallet.fiatValueUsd ?? 0));
  }, [wallets]);

  const [currency, setCurrency] = useState<string | null>(null);
  const [amount,   setAmount]   = useState('');
  const [note,     setNote]     = useState('');

  // Reset form on every open; default to top-funded wallet.
  useEffect(() => {
    if (!visible) { setAmount(''); setNote(''); return; }
    const firstFunded = displayWallets.find((d) => d.balance > 0);
    setCurrency(firstFunded?.currency ?? displayWallets[0]?.currency ?? null);
  }, [visible, displayWallets]);

  const selected = displayWallets.find((d) => d.currency === currency);
  const available = selected?.balance ?? 0;
  const numAmount = parseFloat(amount);
  const overflow = numAmount > available;
  const valid = !!selected && selected.balance > 0 && numAmount > 0 && !overflow;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          // The Modal does NOT inherit the parent's safe-area; nudge the
          // content up so the Send button clears the keyboard reliably.
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: p.bg,
              borderTopLeftRadius: 22, borderTopRightRadius: 22,
              padding: 20, paddingBottom: 32, gap: 14,
              maxHeight: '92%',
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: 'center', marginBottom: 4 }}>
              <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>

            {/* Title + recipient */}
            <View>
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>
                Send a payment
              </Text>
              {!!recipientLabel && (
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                  To {recipientLabel}
                </Text>
              )}
            </View>

            {displayWallets.length === 0 ? (
              <View style={{
                padding: 16, borderRadius: 14,
                borderWidth: 1, borderColor: p.border,
                backgroundColor: p.bgElev,
                gap: 6,
              }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                  No wallets
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>
                  Top up a wallet first to send a payment in chat.
                </Text>
              </View>
            ) : (
              <>
                {/* Asset chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                >
                  {displayWallets.map((d) => {
                    const meta = getCurrencyMeta(d.currency);
                    const active = currency === d.currency;
                    const decimals = meta?.decimals ?? 2;
                    const hasBalance = d.balance > 0;
                    return (
                      <Pressable
                        key={d.currency}
                        onPress={() => hasBalance && setCurrency(d.currency)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 12, paddingVertical: 10,
                          borderRadius: 14, minWidth: 110,
                          backgroundColor: active ? p.fg : p.bgElev,
                          borderWidth: 1, borderColor: active ? p.fg : p.border,
                          opacity: hasBalance ? (pressed ? 0.9 : 1) : 0.45,
                        })}
                      >
                        <Text style={{
                          color: active ? p.bg : p.fg,
                          fontSize: 13, fontWeight: '600', letterSpacing: 0.2,
                        }}>
                          {meta?.flagOrIcon ?? d.currency.slice(0, 1)} {d.currency}
                          {d.chain && (
                            <Text style={{ fontSize: 9, fontWeight: '700', opacity: 0.7 }}>
                              {' '}{d.chain}
                            </Text>
                          )}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: active ? p.bg : p.fgMuted,
                            fontSize: 10, fontWeight: '600', marginTop: 2,
                            fontVariant: ['tabular-nums'],
                            opacity: active ? 0.8 : 1,
                          }}
                        >
                          {formatBal(d.balance, decimals)} avail.
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Amount */}
                <View style={{
                  borderRadius: 14, borderWidth: 1,
                  borderColor: overflow ? '#ef4444' : p.border,
                  backgroundColor: p.bgElev,
                  paddingHorizontal: 14, paddingVertical: 12, gap: 4,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                      AMOUNT
                    </Text>
                    {selected && selected.balance > 0 && (
                      <Pressable
                        hitSlop={6}
                        onPress={() => setAmount(String(available))}
                        style={{
                          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                          backgroundColor: p.pillBg,
                          borderWidth: 1, borderColor: p.border,
                        }}
                      >
                        <Text style={{ color: p.fg, fontSize: 10, fontWeight: '600', letterSpacing: 0.4 }}>
                          MAX
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={p.fgFaint}
                      style={{
                        flex: 1, color: p.fg, fontSize: 28, fontWeight: '600',
                        fontVariant: ['tabular-nums'], letterSpacing: -0.5,
                        paddingVertical: 0,
                      }}
                    />
                    <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600' }}>
                      {currency}{selected?.chain ? ` (${selected.chain})` : ''}
                    </Text>
                  </View>
                  {overflow && (
                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                      Exceeds available balance
                    </Text>
                  )}
                </View>

                {/* Note */}
                <View style={{
                  borderRadius: 14, borderWidth: 1, borderColor: p.border,
                  backgroundColor: p.bgElev,
                  paddingHorizontal: 14, paddingVertical: 10,
                }}>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="What's this for? (optional)"
                    placeholderTextColor={p.fgFaint}
                    multiline
                    style={{ color: p.fg, fontSize: 14, fontWeight: '500', minHeight: 36 }}
                  />
                </View>
              </>
            )}

            {/* Send CTA */}
            <Pressable
              disabled={!valid}
              onPress={() => valid && onSubmit(numAmount, selected!.wallet.currency, note.trim() || undefined)}
              style={({ pressed }) => ({
                height: 52, borderRadius: 16, marginTop: 4,
                backgroundColor: valid ? BRAND_BLUE : p.border,
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
                flexDirection: 'row', gap: 8,
              })}
            >
              <Ionicons name="paper-plane" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
                {valid ? `Send ${formatAmount(numAmount)} ${currency}` : 'Send payment'}
              </Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

interface DisplayWallet {
  currency: string;
  wallet: Wallet;
  balance: number;
  chain?: string;
}

function availableOf(w: Wallet): number {
  return Math.max(0, Number(w.balance) - Number(w.frozen ?? 0));
}

function formatBal(n: number, decimals: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.min(decimals, 6) }).format(n);
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(n);
}
