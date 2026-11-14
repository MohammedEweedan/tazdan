/**
 * SendMoneySheet — pay or request money inside a chat.
 *
 *   • Currency pills from the user's wallets (each chain variant collapses to
 *     one logical asset). Paying needs a balance; requesting can ask for any
 *     held currency plus the core fiats.
 *   • A big centred amount typed on the app's own keypad (no system keyboard
 *     jumping over the sheet); "Available" fills the maximum when paying.
 *   • An optional note, and the action docked at the bottom.
 *   • Pure presentation — the parent owns the actual send.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '@/components/ui/Text';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { CurrencyMark } from '@/components/messages/PaymentReceiptBubble';
import { type Palette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useWallets } from '@/hooks';
import { fiatSymbol, getCurrencyMeta } from '@/constants';
import type { Wallet } from '@/types';

/** Always offered when asking for money, held or not. */
const REQUESTABLE = ['LYD', 'USD', 'EUR'];

export interface SendMoneySheetProps {
  visible: boolean;
  palette: Palette;
  /** Display name of the recipient — shown under the title. */
  recipientLabel?: string;
  mode?: 'SEND' | 'REQUEST';
  onClose: () => void;
  onSubmit: (amount: number, currency: string, note?: string) => void;
  /** Set when the recipient can't receive right now — shown above the
   *  button, which stays disabled (SEND only; requests are unaffected). */
  blockedNotice?: string | null;
}

export function SendMoneySheet({
  visible, palette: p, recipientLabel, mode = 'SEND', onClose, onSubmit, blockedNotice,
}: SendMoneySheetProps) {
  const { data: wallets } = useWallets();
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const request = mode === 'REQUEST';

  // One entry per logical asset (USDT_TRC20 + USDT_ERC20 → USDT), richest first.
  const assets = useMemo<Asset[]>(() => {
    const map = new Map<string, Asset>();
    (wallets ?? []).forEach((w) => {
      const cur = String(w.currency);
      const i = cur.indexOf('_');
      const base = i >= 0 ? cur.slice(0, i) : cur;
      const bal = availableOf(w);
      const usd = Number(w.fiatValueUsd ?? 0);
      const existing = map.get(base);
      if (existing) { existing.balance += bal; existing.usd += usd; }
      else map.set(base, { currency: base, balance: bal, usd });
    });
    if (request) REQUESTABLE.forEach((c) => { if (!map.has(c)) map.set(c, { currency: c, balance: 0, usd: 0 }); });
    return [...map.values()]
      .filter((a) => request || a.balance > 0)
      .sort((a, b) => b.usd - a.usd || b.balance - a.balance);
  }, [wallets, request]);

  const [currency, setCurrency] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // Fresh form on every open, on the best-funded asset (LYD first when asking).
  useEffect(() => {
    if (!visible) { setAmount(''); setNote(''); return; }
    setCurrency(request ? (assets.find((a) => a.currency === 'LYD')?.currency ?? assets[0]?.currency ?? null) : assets[0]?.currency ?? null);
  }, [visible, request]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = assets.find((a) => a.currency === currency);
  const decimals = Math.min(getCurrencyMeta(currency ?? '')?.decimals ?? 2, 8);
  const available = selected?.balance ?? 0;
  const numAmount = Number(amount || 0);
  const overflow = !request && numAmount > available;
  const blocked = !request && !!blockedNotice;
  const valid = !blocked && !!selected && numAmount > 0 && !overflow;
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n);
  const symbol = currency ? (getCurrencyMeta(currency)?.kind === 'fiat' ? fiatSymbol(currency, locale) : currency) : '';

  const cta = (
    <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
      {blocked && (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Ionicons name="information-circle-outline" size={16} color={p.redFg} />
          <Text style={{ flex: 1, color: p.redFg, fontSize: 13, fontWeight: '500' }}>{blockedNotice}</Text>
        </View>
      )}
      <Pressable
        disabled={!valid}
        // The LOGICAL currency (USDT, not USDT_TRC20): the server picks the wallet.
        onPress={() => valid && onSubmit(numAmount, selected!.currency, note.trim() || undefined)}
        accessibilityRole="button"
        style={({ pressed }) => ({
          height: 54, borderRadius: 27, flexDirection: 'row', gap: 8,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: valid ? p.accent : p.pillBg,
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <Ionicons name={request ? 'arrow-down' : 'arrow-up'} size={17} color={valid ? p.accentFg : p.fgFaint} />
        <Text style={{ color: valid ? p.accentFg : p.fgFaint, fontSize: 16, fontWeight: '700' }}>
          {valid
            ? t(request ? 'money.requestCta' : 'money.sendCta', { amount: fmt(numAmount), currency: currency ?? '' })
            : t(request ? 'money.requestFallback' : 'money.sendFallback')}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={request ? t('money.requestTitle') : t('money.sendTitle')}
      subtitle={recipientLabel ? `${request ? t('money.from') : t('money.to')} ${recipientLabel}` : undefined}
      footer={assets.length ? cta : undefined}
    >
      {assets.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="wallet-outline" size={24} color={p.fgMuted} />
          </View>
          <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>{t('money.noWalletsTitle')}</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', maxWidth: 260 }}>{t('money.noWalletsBody')}</Text>
        </View>
      ) : (
        <View>
          {/* Currency pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
            contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingHorizontal: 2 }}>
            {assets.map((a) => {
              const on = a.currency === currency;
              return (
                <Pressable key={a.currency} onPress={() => { setCurrency(a.currency); setAmount(''); }} accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingLeft: 6, paddingRight: 14, height: 40, borderRadius: 20,
                    backgroundColor: on ? p.accent : p.bgElev,
                    borderWidth: 1, borderColor: on ? p.accent : p.border,
                    opacity: pressed ? 0.85 : 1,
                  })}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: on ? 'rgba(255,255,255,0.18)' : p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
                    <CurrencyMark currency={a.currency} size={18} fallbackColor={on ? p.accentFg : p.fg} />
                  </View>
                  <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 14, fontWeight: '700' }}>{a.currency}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Amount */}
          <View style={{ marginTop: compact ? 14 : 22 }}>
            <AmountDisplay value={amount} symbol={symbol} palette={p} tint={overflow ? p.redFg : undefined} maxSize={compact ? 48 : 58} />
          </View>
          {request ? (
            <Text style={{ color: p.fgFaint, fontSize: 12.5, textAlign: 'center', marginTop: 6 }}>
              {recipientLabel ? t('money.requestFrom', { name: recipientLabel }) : t('money.requestTitle')}
            </Text>
          ) : (
            <Pressable onPress={() => setAmount(String(Number(available.toFixed(decimals))))} hitSlop={8} style={{ alignSelf: 'center', marginTop: 6 }}>
              <Text style={{ color: overflow ? p.redFg : p.fgMuted, fontSize: 12.5, fontWeight: '600' }}>
                {overflow ? t('money.exceedsBalance') : `${t('money.available')} · ${fmt(available)} ${currency ?? ''}`}
              </Text>
            </Pressable>
          )}

          {/* Note */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: compact ? 12 : 18,
            height: 44, borderRadius: 22, paddingHorizontal: 14,
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
          }}>
            <Ionicons name="create-outline" size={16} color={p.fgMuted} />
            <TextInput value={note} onChangeText={setNote} maxLength={200}
              placeholder={request ? t('money.requestNotePlaceholder') : t('money.notePlaceholder')} placeholderTextColor={p.fgFaint}
              style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '500', paddingVertical: 0 }} />
          </View>

          {/* Keypad */}
          <View style={{ marginTop: compact ? 8 : 14 }}>
            <NumericKeypad value={amount} onChange={setAmount} palette={p} maxDecimals={decimals}
              keyHeight={compact ? 44 : 52} fontSize={compact ? 23 : 26} />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

interface Asset { currency: string; balance: number; usd: number }

function availableOf(w: Wallet): number {
  return Math.max(0, Number(w.balance) - Number(w.frozen ?? 0));
}
