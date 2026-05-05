/**
 * Buy crypto — premium UX.
 *
 *  - Pair picker:  "BUY [crypto]  WITH [fiat]"   ← both tappable to swap
 *  - Big amount display (USD by default; flip to crypto with the swap arrow)
 *  - Live spot price + 24h change underneath
 *  - Custom always-visible numeric keypad (no system keyboard)
 *  - Available fiat balance shown at the top
 *  - Quick chips: 25 / 50 / 100 / MAX
 *  - Buy CTA at the bottom — disabled while amount=0 or > balance
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useMarkets, useSwap, useWallets, extractErrorMessage } from '@/hooks';
import type { Currency } from '@/types';

const CRYPTO: Currency[] = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE'];
const FIATS:  Currency[] = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'];

type Mode = 'FIAT' | 'CRYPTO';

export default function Buy() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const { data: tickers } = useMarkets();
  const { data: wallets }  = useWallets();
  const swap = useSwap();
  // The CTA itself flashes green / red (no toast) — caller drives the state.
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError, setCtaError] = useState<string | null>(null);

  const [coin, setCoin] = useState<Currency>('BTC');
  const [fiat, setFiat] = useState<Currency>('USD');
  const [mode, setMode] = useState<Mode>('FIAT');   // are we typing a fiat amount or crypto amount?
  const [amount, setAmount] = useState('0');
  const [coinPickerOpen, setCoinPickerOpen] = useState(false);
  const [fiatPickerOpen, setFiatPickerOpen] = useState(false);

  // Live spot — backend symbols are "BTCUSDT" (no slash) so match by base.
  const ticker = useMemo(
    () => tickers?.find((t) => t.base === coin) ?? null,
    [tickers, coin],
  );
  const spotUsd = ticker ? Number(ticker.price) : 0;
  // For non-USD fiat, we'd ideally pull a USD/FIAT rate. Use a hardcoded
  // demo rate — accurate enough for a dev preview.
  const fiatPerUsd: Record<string, number> = {
    USD: 1,    EUR: 0.92, GBP: 0.79, AED: 3.67,
    SAR: 3.75, EGP: 49.5,
  };
  const rateFiatPerUsd = fiatPerUsd[fiat] ?? 1;
  const pricePerCoinFiat = spotUsd * rateFiatPerUsd;

  // Available balance (the user pays from this fiat wallet)
  const fiatWallet = wallets?.find((w) => w.currency === fiat);
  const fiatBalance = fiatWallet ? Number(fiatWallet.balance) : 0;

  // Compute the "other side" based on which mode the user is typing in
  const numericAmount = Number(amount || 0);
  const fiatAmount   = mode === 'FIAT'   ? numericAmount : numericAmount * pricePerCoinFiat;
  const cryptoAmount = mode === 'CRYPTO' ? numericAmount : (pricePerCoinFiat > 0 ? numericAmount / pricePerCoinFiat : 0);
  const overspend = fiatAmount > fiatBalance;
  const valid = fiatAmount > 0 && !overspend;

  // ── Keypad handler ─────────────────────────────
  const onKey = (k: string) => {
    h.selection();
    if (k === '⌫') {
      setAmount((a) => (a.length > 1 ? a.slice(0, -1) : '0'));
      return;
    }
    if (k === '.') {
      setAmount((a) => (a.includes('.') ? a : a + '.'));
      return;
    }
    setAmount((a) => (a === '0' ? k : a + k));
  };

  return (
    <ScreenShell title="Buy crypto" scroll={false} contentStyle={{ paddingBottom: 0, paddingHorizontal: 0 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 24 }}
        style={{ flex: 1 }}
      >
        {/* ── Pair picker row ─────────────────── */}
        <View style={{ marginTop: 8, gap: 8 }}>
          <PickerRow
            palette={p}
            label="BUY"
            value={coin}
            chevronOpen={coinPickerOpen}
            onPress={() => { h.selection(); setCoinPickerOpen((o) => !o); setFiatPickerOpen(false); }}
          />
          {coinPickerOpen && (
            <ChipGrid
              palette={p}
              options={CRYPTO}
              active={coin}
              onPick={(c) => { h.medium(); setCoin(c); setCoinPickerOpen(false); }}
            />
          )}

          <PickerRow
            palette={p}
            label="WITH"
            value={fiat}
            chevronOpen={fiatPickerOpen}
            onPress={() => { h.selection(); setFiatPickerOpen((o) => !o); setCoinPickerOpen(false); }}
          />
          {fiatPickerOpen && (
            <ChipGrid
              palette={p}
              options={FIATS}
              active={fiat}
              onPick={(c) => { h.medium(); setFiat(c); setFiatPickerOpen(false); }}
            />
          )}
        </View>

        {/* ── Available balance ─────────────────── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          marginTop: 18,
        }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: p.greenBg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="wallet" size={14} color={p.greenFg} />
          </View>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>
            Available
          </Text>
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {fiatBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {fiat}
          </Text>
        </View>

        {/* ── Big amount display ─────────────────── */}
        <View style={{ alignItems: 'center', marginTop: 22, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            {mode === 'FIAT' && (
              <Text style={{
                color: overspend ? p.redFg : p.fg,
                fontSize: 56, fontWeight: '800', letterSpacing: -2.4,
              }}>
                {fiatSymbol(fiat)}
              </Text>
            )}
            <Text
              style={{
                color: overspend ? p.redFg : p.fg,
                fontSize: 64,
                fontWeight: '800',
                letterSpacing: -2.4,
                fontVariant: ['tabular-nums'],
                minWidth: 80,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amount}
            </Text>
            {mode === 'CRYPTO' && (
              <Text style={{ color: p.fgMuted, fontSize: 22, fontWeight: '700', marginLeft: 4 }}>
                {coin}
              </Text>
            )}
          </View>

          {/* Switch FIAT ↔ CRYPTO display + secondary line */}
          <Pressable
            hitSlop={6}
            onPress={() => {
              h.medium();
              setMode((m) => (m === 'FIAT' ? 'CRYPTO' : 'FIAT'));
              setAmount('0');
            }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              marginTop: 8,
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
            }}
          >
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              ≈ {mode === 'FIAT'
                ? `${cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${coin}`
                : `${fiatSymbol(fiat)}${fiatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
            <Ionicons name="swap-vertical" size={13} color={p.fgMuted} />
          </Pressable>

          {/* Spot price */}
          <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500', marginTop: 10 }}>
            1 {coin} ≈ {fiatSymbol(fiat)}{pricePerCoinFiat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {ticker && (
              <>  ·  <Text style={{ color: Number(ticker.changePct24h) >= 0 ? p.greenFg : p.redFg }}>
                {Number(ticker.changePct24h) >= 0 ? '▲' : '▼'} {Math.abs(Number(ticker.changePct24h)).toFixed(2)}%
              </Text></>
            )}
          </Text>

          {overspend && (
            <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600', marginTop: 8 }}>
              Exceeds your {fiat} balance
            </Text>
          )}
        </View>

        {/* ── Quick chips ─────────────────── */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {[25, 50, 100].map((v) => (
            <Pressable
              key={v}
              onPress={() => { h.selection(); setMode('FIAT'); setAmount(String(v)); }}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 10, borderRadius: 12,
                backgroundColor: pressed ? p.border : p.pillBg,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center',
              })}
            >
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>
                {fiatSymbol(fiat)}{v}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => { h.selection(); setMode('FIAT'); setAmount(String(fiatBalance.toFixed(2))); }}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 10, borderRadius: 12,
              backgroundColor: pressed ? p.border : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>MAX</Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* ── Sticky bottom: keypad + CTA — always visible, never below
          the fold on small phones ─────────────────────────────────── */}
      <View style={{
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 16,
        backgroundColor: p.bg,
        borderTopWidth: 1,
        borderTopColor: p.border,
      }}>
        <Keypad palette={p} themeMode={themeMode} onKey={onKey} />
        <View style={{ marginTop: 12 }}>
          <CTAButton
            label={
              ctaState === 'loading'
                ? 'Buying…'
                : valid
                  ? `Buy ${cryptoAmount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${coin}`
                  : `Buy ${coin}`
            }
            icon="checkmark-circle"
            disabled={!valid}
            state={ctaState}
            successLabel={`Bought ${coin}`}
            errorLabel={ctaError ?? 'Order failed'}
            onPress={async () => {
              setCtaState('loading');
              setCtaError(null);
              try {
                await swap.mutateAsync({ from: fiat, to: coin, amount: fiatAmount });
                h.success();
                setCtaState('success');
                // Hold the green flash briefly so the user sees it,
                // then dismiss the modal back to home (which now shows
                // the updated holdings).
                setTimeout(() => router.back(), 900);
              } catch (e: any) {
                h.error();
                setCtaError(extractErrorMessage(e, 'Order failed'));
                setCtaState('error');
                // Auto-revert to idle after a moment so the user can retry.
                setTimeout(() => setCtaState('idle'), 1800);
              }
            }}
          />
        </View>
      </View>
    </ScreenShell>
  );
}

/* ── Picker row ── */
function PickerRow({
  palette: p, label, value, chevronOpen, onPress,
}: {
  palette: Palette;
  label: string;
  value: Currency;
  chevronOpen: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: pressed ? p.border : p.bgElev,
        borderWidth: 1, borderColor: p.border,
      })}
    >
      <Text style={{
        color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1,
        width: 44,
      }}>
        {label}
      </Text>
      <Text style={{ color: p.fg, fontSize: 16, fontWeight: '800', flex: 1 }}>
        {value}
      </Text>
      <Ionicons
        name={chevronOpen ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={p.fgMuted}
      />
    </Pressable>
  );
}

/* ── Chip grid for picker open state ── */
function ChipGrid({
  palette: p, options, active, onPick,
}: {
  palette: Palette;
  options: Currency[];
  active: Currency;
  onPick: (c: Currency) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((c) => (
        <Pressable
          key={c}
          onPress={() => onPick(c)}
          style={({ pressed }) => ({
            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
            backgroundColor: c === active ? p.fg : p.bgElev,
            borderWidth: 1, borderColor: c === active ? p.fg : p.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{
            color: c === active ? p.bg : p.fg,
            fontSize: 13, fontWeight: '700', letterSpacing: 0.4,
          }}>
            {c}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ── Custom numeric keypad ── */
function Keypad({
  palette: p, themeMode, onKey,
}: { palette: Palette; themeMode: 'dark' | 'light'; onKey: (k: string) => void }) {
  const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];
  return (
    <View>
      {KEYS.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 6, marginTop: r === 0 ? 0 : 6 }}>
          {row.map((k) => (
            <Pressable
              key={k}
              onPress={() => onKey(k)}
              hitSlop={2}
              style={({ pressed }) => ({
                flex: 1, height: 46, borderRadius: 12,
                backgroundColor: pressed ? p.border : p.bgElev,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              {k === '⌫' ? (
                <Ionicons name="backspace-outline" size={20} color={p.fg} />
              ) : (
                <Text style={{
                  color: p.fg, fontSize: 22, fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                }}>
                  {k}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ── helpers ── */
function fiatSymbol(c: Currency): string {
  switch (c) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'AED': return 'د.إ';
    case 'SAR': return '﷼';
    case 'EGP': return '£';
    default:    return '';
  }
}
