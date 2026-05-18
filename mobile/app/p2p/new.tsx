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
import { Alert, Modal, Platform, Pressable, ScrollView, View, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useThemedPalette } from '@/store/themeStore';
import { TopGradient } from '@/components/ui/ScreenShell';
import { useCreateP2PListing, useHaptics } from '@/hooks';
import type { Palette } from '@/store/themeStore';

const CRYPTOS = ['USDT', 'BTC', 'ETH', 'SOL'] as const;
const FIATS   = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'] as const;
const METHODS = ['Bank Transfer', 'Wise', 'Revolut', 'Cash', 'PayPal', 'Internal Wallet'] as const;

export default function NewListing() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();
  const create = useCreateP2PListing();

  const [side, setSide] = useState<'BUY' | 'SELL'>('SELL');
  const [currency, setCurrency] = useState<typeof CRYPTOS[number]>('USDT');
  const [fiatCurrency, setFiatCurrency] = useState<typeof FIATS[number]>('USD');
  const [price, setPrice]       = useState('');
  const [amount, setAmount]     = useState('');
  const [minLimit, setMin]      = useState('');
  const [maxLimit, setMax]      = useState('');
  const [minMode, setMinMode]   = useState<'fiat' | 'asset'>('fiat');
  const [maxMode, setMaxMode]   = useState<'fiat' | 'asset'>('fiat');
  const [methods, setMethods]   = useState<string[]>(['Bank Transfer']);
  const [terms, setTerms]       = useState('');

  const priceN = Number(price), amountN = Number(amount), minN = Number(minLimit), maxN = Number(maxLimit);
  const totalFiat = priceN > 0 && amountN > 0 ? priceN * amountN : 0;
  
  // Convert minimum to fiat for validation/submission if in asset mode
  const minFiat = minMode === 'asset' && priceN > 0 && minN > 0 ? minN * priceN : minN;
  const minFiatN = Number(minFiat);
  
  // Convert maximum to fiat for validation/submission if in asset mode
  const maxFiat = maxMode === 'asset' && priceN > 0 && maxN > 0 ? maxN * priceN : maxN;
  const maxFiatN = Number(maxFiat);

  // Limit constraints: both min and max must be ≤ the total fiat value of the
  // listing (price × amount). Otherwise a buyer could "spend" more fiat than
  // there is crypto available.
  const minOverTotal = minFiatN > 0 && totalFiat > 0 && minFiatN > totalFiat;
  const maxOverTotal = maxFiatN > 0 && totalFiat > 0 && maxFiatN > totalFiat;
  const minOverMax   = minFiatN > 0 && maxFiatN > 0 && minFiatN > maxFiatN;

  const valid =
    priceN  > 0 &&
    amountN > 0 &&
    minFiatN > 0 &&
    maxFiatN >= minFiatN &&
    !minOverTotal &&
    !maxOverTotal &&
    methods.length > 0;

  const submit = async () => {
    if (!valid) {
      h.error();
      const reason = minOverTotal
        ? `Min limit (${minFiatN.toLocaleString()} ${fiatCurrency}) must be ≤ the total listing value (${totalFiat.toLocaleString()} ${fiatCurrency}).`
        : maxOverTotal
          ? `Max limit (${maxFiatN.toLocaleString()} ${fiatCurrency}) must be ≤ the total listing value (${totalFiat.toLocaleString()} ${fiatCurrency}).`
          : minOverMax
            ? 'Min limit must be ≤ max limit.'
            : 'Price, amount and limits must be positive numbers, max ≥ min, and at least one payment method.';
      Alert.alert('Check your inputs', reason);
      return;
    }
    try {
      await create.mutateAsync({
        side, currency, fiatCurrency,
        price: priceN, amount: amountN,
        minLimit: minFiatN, maxLimit: maxFiatN,
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
    <Modal visible animationType="slide" transparent onRequestClose={() => router.back()}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={() => router.back()}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            style={{
              backgroundColor: p.bg,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              maxHeight: '85%',
              overflow: 'hidden',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <TopGradient height={220} />
            {/* Handle + header */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4,
            }}>
              <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }}>
                New P2P listing
              </Text>
              <Pressable onPress={() => router.back()} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={16} color={p.fg} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
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
                fontSize: 13, fontWeight: '600', letterSpacing: 0.4,
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
            <Section title={`MIN`} palette={p}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {(['fiat', 'asset'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => { h.selection(); setMinMode(mode); }}
                    style={{
                      flex: 1, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: minMode === mode ? p.fg : p.pillBg,
                      borderWidth: 1, borderColor: minMode === mode ? p.fg : p.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      color: minMode === mode ? p.bg : p.fgMuted,
                      fontSize: 11, fontWeight: '600',
                    }}>
                      {mode === 'fiat' ? fiatCurrency : currency}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field
                palette={p}
                value={minLimit}
                onChangeText={(t) => setMin(t.replace(/[^0-9.]/g, ''))}
                placeholder={minMode === 'fiat' ? '50' : '10'}
                error={minOverTotal || minOverMax}
                suffix={minMode === 'fiat' ? fiatCurrency : currency}
              />
            </Section>
          </View>
          <View style={{ flex: 1 }}>
            <Section title={`MAX`} palette={p}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {(['fiat', 'asset'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => { h.selection(); setMaxMode(mode); }}
                    style={{
                      flex: 1, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: maxMode === mode ? p.fg : p.pillBg,
                      borderWidth: 1, borderColor: maxMode === mode ? p.fg : p.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{
                      color: maxMode === mode ? p.bg : p.fgMuted,
                      fontSize: 11, fontWeight: '600',
                    }}>
                      {mode === 'fiat' ? fiatCurrency : currency}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field
                palette={p}
                value={maxLimit}
                onChangeText={(t) => setMax(t.replace(/[^0-9.]/g, ''))}
                placeholder={maxMode === 'fiat' ? '2000' : '500'}
                error={maxOverTotal}
                suffix={maxMode === 'fiat' ? fiatCurrency : currency}
              />
            </Section>
          </View>
        </View>

        {/* Limits hint / errors */}
        {(totalFiat > 0 || minOverTotal || maxOverTotal || minOverMax) && (
          <Text style={{
            color: minOverTotal || maxOverTotal || minOverMax ? p.redFg : p.fgMuted,
            fontSize: 12, fontWeight: '600', marginTop: 8, marginLeft: 4, lineHeight: 17,
          }}>
            {minOverTotal
              ? `Min limit must be ≤ total listing value (${totalFiat.toLocaleString()} ${fiatCurrency}).`
              : maxOverTotal
                ? `Max limit must be ≤ total listing value (${totalFiat.toLocaleString()} ${fiatCurrency}).`
                : minOverMax
                  ? 'Min limit must be ≤ max limit.'
                  : `Total listing value: ${totalFiat.toLocaleString()} ${fiatCurrency}`}
          </Text>
        )}

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
          <View style={{
            borderRadius: 14, backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
          }}>
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
          </View>
        </Section>
      </ScrollView>

      {/* Sticky CTA footer */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: insets.bottom + 12,
        backgroundColor: p.bg,
        borderTopWidth: 1, borderTopColor: p.border,
      }}>
        <Pressable
          onPress={submit}
          disabled={!valid || create.isPending}
          style={({ pressed }) => ({
            height: 56, borderRadius: 28,
            backgroundColor: valid ? p.ctaBg : p.bgElev,
            borderWidth: valid ? 0 : 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            opacity: (!valid || create.isPending) ? 0.6 : pressed ? 0.85 : 1,
            shadowColor: valid ? p.ctaBg : 'transparent',
            shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
          })}
        >
          {create.isPending ? (
            <ActivityIndicator size="small" color={p.ctaFg} />
          ) : (
            <Ionicons name="megaphone" size={16} color={valid ? p.ctaFg : p.fgMuted} />
          )}
          <Text style={{
            color: valid ? p.ctaFg : p.fgMuted,
            fontSize: 16, fontWeight: '600', letterSpacing: -0.2,
          }}>
            {create.isPending ? 'Posting…' : `Post ${side} listing`}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  </KeyboardAvoidingView>
</Pressable>
</Modal>
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
  palette: p, value, onChangeText, placeholder, suffix, error,
}: {
  palette: Palette;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  suffix?: string;
  error?: boolean;
}) {
  return (
    <View style={{
      height: 56, borderRadius: 14,
      backgroundColor: p.bgElev,
      borderWidth: error ? 1.5 : 1, borderColor: error ? p.redFg : p.border,
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
