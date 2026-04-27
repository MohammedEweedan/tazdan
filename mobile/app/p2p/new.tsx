/**
 * P2P listing creator — `/p2p/new`.
 *
 * BUY listings  → user wants to buy `currency` with `fiatCurrency`
 * SELL listings → user wants to sell `currency` for `fiatCurrency` (escrow
 *                 holds the crypto until the trade completes)
 *
 * On submit it POSTs to `/p2p/listings` and invalidates the marketplace +
 * "my listings" caches so the new listing appears everywhere instantly.
 */

import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useCreateP2PListing, useHaptics } from '@/hooks';
import type { Palette } from '@/store/themeStore';

const CRYPTOS = ['USDT', 'BTC', 'ETH', 'SOL'] as const;
const FIATS   = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'] as const;
const METHODS = ['Bank Transfer', 'Wise', 'Revolut', 'Cash', 'PayPal', 'Internal Wallet'] as const;

export default function NewListing() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const create = useCreateP2PListing();

  const [side, setSide] = useState<'BUY' | 'SELL'>('SELL');
  const [currency, setCurrency] = useState<typeof CRYPTOS[number]>('USDT');
  const [fiatCurrency, setFiatCurrency] = useState<typeof FIATS[number]>('USD');
  const [price, setPrice]       = useState('');
  const [amount, setAmount]     = useState('');
  const [minLimit, setMin]      = useState('');
  const [maxLimit, setMax]      = useState('');
  const [methods, setMethods]   = useState<string[]>(['Bank Transfer']);
  const [terms, setTerms]       = useState('');

  const priceN = Number(price), amountN = Number(amount), minN = Number(minLimit), maxN = Number(maxLimit);
  const valid =
    priceN  > 0 &&
    amountN > 0 &&
    minN    > 0 &&
    maxN    >= minN &&
    methods.length > 0;

  const submit = async () => {
    if (!valid) {
      h.error();
      Alert.alert('Check your inputs', 'Price, amount and limits must be positive numbers, max ≥ min, and at least one payment method.');
      return;
    }
    try {
      await create.mutateAsync({
        side, currency, fiatCurrency,
        price: priceN, amount: amountN,
        minLimit: minN, maxLimit: maxN,
        paymentMethods: methods,
        terms: terms || undefined,
      });
      h.success();
      Alert.alert(
        'Listing posted',
        `Your ${side} ${currency} listing is live. Other traders can now match it.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      h.error();
      Alert.alert(
        'Could not post listing',
        e?.response?.data?.error ?? e?.message ?? 'Please try again.',
      );
    }
  };

  const toggleMethod = (m: string) => {
    h.selection();
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  return (
    <ScreenShell title="New P2P listing" scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Side toggle */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: p.pillBg,
          borderRadius: 14, padding: 4, gap: 4, marginTop: 12,
        }}>
          {(['BUY', 'SELL'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => { h.selection(); setSide(s); }}
              style={{
                flex: 1, paddingVertical: 11, borderRadius: 10,
                backgroundColor: side === s ? p.fg : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: side === s ? p.bg : p.fgMuted,
                fontSize: 13, fontWeight: '800', letterSpacing: 0.4,
              }}>
                I WANT TO {s}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
          {side === 'SELL'
            ? `You'll send ${currency} into escrow. Buyers pay you in ${fiatCurrency} via your chosen methods, then we release the crypto.`
            : `You're posting that you'll buy ${currency} from someone. They send to escrow, you pay them in ${fiatCurrency}.`}
        </Text>

        {/* Currency pickers */}
        <Section title="ASSET" palette={p}>
          <ChipGroup
            palette={p}
            options={[...CRYPTOS]}
            value={currency}
            onPick={(c) => setCurrency(c as typeof CRYPTOS[number])}
          />
        </Section>

        <Section title="PRICED IN" palette={p}>
          <ChipGroup
            palette={p}
            options={[...FIATS]}
            value={fiatCurrency}
            onPick={(c) => setFiatCurrency(c as typeof FIATS[number])}
          />
        </Section>

        {/* Price + amount */}
        <Section title={`PRICE (${fiatCurrency} per ${currency})`} palette={p}>
          <Field
            palette={p}
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))}
            placeholder="3.65"
            suffix={`${fiatCurrency}`}
          />
        </Section>

        <Section title={`AMOUNT (${currency})`} palette={p}>
          <Field
            palette={p}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            placeholder="500"
            suffix={currency}
          />
        </Section>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Section title={`MIN (${fiatCurrency})`} palette={p}>
              <Field
                palette={p}
                value={minLimit}
                onChangeText={(t) => setMin(t.replace(/[^0-9.]/g, ''))}
                placeholder="50"
              />
            </Section>
          </View>
          <View style={{ flex: 1 }}>
            <Section title={`MAX (${fiatCurrency})`} palette={p}>
              <Field
                palette={p}
                value={maxLimit}
                onChangeText={(t) => setMax(t.replace(/[^0-9.]/g, ''))}
                placeholder="2000"
              />
            </Section>
          </View>
        </View>

        {/* Payment methods */}
        <Section title="PAYMENT METHODS" palette={p}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {METHODS.map((m) => {
              const on = methods.includes(m);
              return (
                <Pressable
                  key={m}
                  onPress={() => toggleMethod(m)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                    backgroundColor: on ? p.fg : p.pillBg,
                    borderWidth: 1, borderColor: on ? p.fg : p.border,
                  }}
                >
                  <Text style={{
                    color: on ? p.bg : p.fg,
                    fontSize: 12, fontWeight: '700',
                  }}>
                    {m}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Optional terms */}
        <Section title="TERMS (OPTIONAL)" palette={p}>
          <Panel>
            <TextInput
              value={terms}
              onChangeText={setTerms}
              placeholder="e.g. Reply within 5 minutes. SEPA only. ID required for >2000 EUR."
              placeholderTextColor={p.fgFaint}
              multiline
              style={{
                color: p.fg, fontSize: 14, fontWeight: '500',
                padding: 14, minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </Panel>
        </Section>

        <View style={{ marginTop: 24 }}>
          <CTAButton
            label={create.isPending ? 'Posting…' : `Post ${side} listing`}
            icon="megaphone"
            disabled={!valid || create.isPending}
            loading={create.isPending}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function Section({ title, palette: p, children }: { title: string; palette: Palette; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginLeft: 4, marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ChipGroup({
  palette: p, options, value, onPick,
}: { palette: Palette; options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onPick(o)}
            style={{
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
              backgroundColor: on ? p.fg : p.pillBg,
              borderWidth: 1, borderColor: on ? p.fg : p.border,
            }}
          >
            <Text style={{
              color: on ? p.bg : p.fg,
              fontSize: 13, fontWeight: '700',
            }}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  palette: p, value, onChangeText, placeholder, suffix,
}: {
  palette: Palette;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  suffix?: string;
}) {
  return (
    <View style={{
      height: 56, borderRadius: 14,
      backgroundColor: p.bgElev,
      borderWidth: 1, borderColor: p.border,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.fgFaint}
        keyboardType="decimal-pad"
        style={{
          flex: 1, color: p.fg, fontSize: 18, fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}
      />
      {suffix && (
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{suffix}</Text>
      )}
    </View>
  );
}
