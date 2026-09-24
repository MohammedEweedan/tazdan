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
import { useT } from '@/store/i18nStore';
import { useWallets } from '@/hooks';
import { getCurrencyMeta } from '@/constants';
import type { Currency, Wallet } from '@/types';

import { BottomSheet } from '@/components/ui/BottomSheet';
const BRAND_BLUE = '#737373'; // mono accent neutral

export interface SendMoneySheetProps {
  visible: boolean;
  palette: Palette;
  /** Display name of the recipient — shown under the title. */
  recipientLabel?: string;
  mode?: 'SEND' | 'REQUEST';
  onClose: () => void;
  onSubmit: (amount: number, currency: string, note?: string) => void;
}

export function SendMoneySheet({
  visible, palette: p, recipientLabel, mode = 'SEND', onClose, onSubmit,
}: SendMoneySheetProps) {
  const { data: wallets } = useWallets();
  const t = useT();

  // Normalised wallet list: any chain variant (USDT_ERC20, USDT_TRC20,
  // ETH_ERC20 if/when introduced, etc.) collapses into a single chip
  // for the base symbol.  Mirrors the home-tab merge logic so the
  // user sees the same "one logical asset" view everywhere.  We still
  // show every base symbol (even 0-balance) so the user can see what
  // they hold; chips with 0 avail are visually dimmed and
  // non-selectable.
  const displayWallets = useMemo<DisplayWallet[]>(() => {
    // Base = the part of the currency code before the first `_`.
    //   USDT_TRC20 → USDT.  BTC → BTC.  No special-cases.
    const baseOf = (c: string) => {
      const i = c.indexOf('_');
      return i >= 0 ? c.slice(0, i) : c;
    };
    const chainOf = (c: string) => {
      const i = c.indexOf('_');
      return i >= 0 ? c.slice(i + 1) : undefined;
    };
    const map = new Map<string, DisplayWallet>();
    (wallets ?? []).forEach((w) => {
      const cur = String(w.currency);
      const base = baseOf(cur);
      const bal = availableOf(w);
      const existing = map.get(base);
      if (existing) {
        existing.balance += bal;
        // Keep the variant with the highest balance as canonical so
        // the metadata (icon, decimals) prefers what the user
        // actually holds the most of.
        if (bal > availableOf(existing.wallet)) {
          existing.wallet = w;
          existing.chain = chainOf(cur);
        }
      } else {
        map.set(base, {
          currency: base,
          wallet: w,
          balance: bal,
          chain: chainOf(cur),
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
  const valid = !!selected && numAmount > 0 && (mode === 'REQUEST' || (selected.balance > 0 && !overflow));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={mode === 'REQUEST' ? t('money.requestTitle') : t('money.sendTitle')}
      subtitle={recipientLabel ? `${mode === 'REQUEST' ? t('money.from') : t('money.to')} ${recipientLabel}` : undefined}
    >

            {displayWallets.length === 0 ? (
              <View style={{
                padding: 16, borderRadius: 14,
                borderWidth: 1, borderColor: p.border,
                backgroundColor: p.bgElev,
                gap: 6,
              }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                  {t('money.noWalletsTitle')}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>
                  {t('money.noWalletsBody')}
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
                          backgroundColor: active ? p.accent : p.bgElev,
                          borderWidth: 1, borderColor: active ? p.accent : p.border,
                          opacity: hasBalance ? (pressed ? 0.9 : 1) : 0.45,
                        })}
                      >
                        <Text style={{
                          color: active ? p.accentFg : p.fg,
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
                            color: active ? p.accentFg : p.fgMuted,
                            fontSize: 10, fontWeight: '600', marginTop: 2,
                            fontVariant: ['tabular-nums'],
                            opacity: active ? 0.8 : 1,
                          }}
                        >
                          {formatBal(d.balance, decimals)} {t('money.availableSuffix')}
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
                      {t('money.amount')}
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
                          {t('money.max')}
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
                      {t('money.exceedsBalance')}
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
                    placeholder={mode === 'REQUEST' ? t('money.requestNotePlaceholder') : t('money.notePlaceholder')}
                    placeholderTextColor={p.fgFaint}
                    multiline
                    style={{ color: p.fg, fontSize: 14, fontWeight: '500', minHeight: 36 }}
                  />
                </View>
              </>
            )}

            {/* Send / request CTA */}
            <Pressable
              disabled={!valid}
              // Send the LOGICAL currency (USDT, BTC, ETH…) rather than
              // the underlying wallet currency (USDT_TRC20, etc). The
              // server's transfer controller now collapses USDT
              // variants to a single logical balance and picks the
              // right underlying wallet to debit; the client just has
              // to ask in human terms.
              onPress={() => valid && onSubmit(numAmount, selected!.currency, note.trim() || undefined)}
              style={({ pressed }) => ({
                height: 52, borderRadius: 16, marginTop: 4,
                backgroundColor: valid ? BRAND_BLUE : p.border,
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
                flexDirection: 'row', gap: 8,
              })}
            >
              <Ionicons name={mode === 'REQUEST' ? 'receipt-outline' : 'paper-plane'} size={15} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
                {valid
                  ? t(mode === 'REQUEST' ? 'money.requestCta' : 'money.sendCta', { amount: formatAmount(numAmount), currency: currency ?? '' })
                  : t(mode === 'REQUEST' ? 'money.requestFallback' : 'money.sendFallback')}
              </Text>
            </Pressable>
          </BottomSheet>
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
