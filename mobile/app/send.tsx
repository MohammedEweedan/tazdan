/**
 * Send money flow.
 *  Step 1 — Pick recipient (search by @handle, recent contacts list)
 *  Step 2 — Enter amount (numeric keypad with shake animation on overspend)
 *  Step 3 — Confirm preview (recipient, amount, fee, note) → submit
 *
 * On submit we run a fake settle and push a success bottom-sheet feel via
 * a slide-in MotiView, then route back. The real flow will hit
 * `POST /api/payments/preview` then `POST /api/payments/send`.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Animated, {
  useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useWallets, useHaptics } from '@/hooks';
import { CURRENCY_META } from '@/constants';
import { formatAmount } from '@/utils/format';
import type { Currency } from '@/types';

interface Contact { handle: string; name: string; lastTx?: string }
const RECENT: Contact[] = [
  { handle: '@moe.ali',       name: 'Moe Ali',       lastTx: '2 days ago' },
  { handle: '@rayofsunshine', name: 'Rayan',         lastTx: '1 week ago' },
  { handle: '@noran.g',       name: 'Noran',         lastTx: '3 weeks ago' },
  { handle: '@rahma.a',       name: 'Rahma',         lastTx: 'last month' },
];

type Step = 'recipient' | 'amount' | 'confirm';

export default function SendMoney() {
  const router  = useRouter();
  const h       = useHaptics();
  const { data: wallets } = useWallets();
  const [step, setStep]           = useState<Step>('recipient');
  const [contact, setContact]     = useState<Contact | null>(null);
  const [search, setSearch]       = useState('');
  const [amount, setAmount]       = useState('0');
  const [note, setNote]           = useState('');
  const [currency, setCurrency]   = useState<Currency>('USDT');

  const wallet = wallets?.find((w) => w.currency === currency);
  const max    = Number(wallet?.balance ?? 0);
  const value  = Number(amount);
  const overspend = value > max;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RECENT;
    return RECENT.filter((c) => c.handle.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [search]);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader
          title={step === 'recipient' ? 'Send to' : step === 'amount' ? `Send to ${contact?.name}` : 'Confirm send'}
          subtitle={step === 'recipient' ? 'Pick a recipient' : step === 'amount' ? contact?.handle : 'Review the details'}
          showBack
        />

        {step === 'recipient' && (
          <RecipientStep
            search={search}
            setSearch={setSearch}
            contacts={filtered}
            onPick={(c) => { h.light(); setContact(c); setStep('amount'); }}
          />
        )}

        {step === 'amount' && contact && (
          <AmountStep
            contact={contact}
            amount={amount}
            setAmount={setAmount}
            currency={currency}
            setCurrency={setCurrency}
            max={max}
            overspend={overspend}
            onContinue={() => {
              if (overspend || value <= 0) { h.error(); return; }
              h.medium();
              setStep('confirm');
            }}
          />
        )}

        {step === 'confirm' && contact && (
          <ConfirmStep
            contact={contact}
            amount={amount}
            currency={currency}
            note={note}
            setNote={setNote}
            onSend={() => {
              h.success();
              Alert.alert('Sent', `${formatAmount(amount, currency, { showSymbol: true })} on its way to ${contact.handle}.`, [
                { text: 'Done', onPress: () => router.back() },
              ]);
            }}
            onBack={() => setStep('amount')}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ── Step 1: recipient picker ───────────────────────────────────────── */
function RecipientStep({
  search, setSearch, contacts, onPick,
}: {
  search: string; setSearch: (s: string) => void;
  contacts: Contact[]; onPick: (c: Contact) => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>
      {/* Search */}
      <View
        className="px-4 flex-row items-center mt-2"
        style={{
          height: 56, borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          gap: 12,
        }}
      >
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.45)" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search @handle, name, phone"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Text className="text-ink-tertiary text-xs font-semibold mt-7 ml-1" style={{ letterSpacing: 1 }}>
        RECENT
      </Text>
      <View className="bg-white/[0.03] rounded-2xl mt-2 border border-white/[0.06]">
        {contacts.length === 0 && (
          <Text className="text-ink-tertiary text-sm p-4 text-center">No matches.</Text>
        )}
        {contacts.map((c, i) => (
          <Pressable
            key={c.handle}
            onPress={() => onPick(c)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center',
              padding: 14,
              borderTopWidth: i === 0 ? 0 : 1,
              borderColor: 'rgba(255,255,255,0.05)',
              opacity: pressed ? 0.78 : 1,
              gap: 12,
            })}
          >
            <Avatar name={c.name} size={42} />
            <View style={{ flex: 1 }}>
              <Text className="text-ink-primary text-sm font-semibold">{c.name}</Text>
              <Text className="text-ink-tertiary text-xs mt-0.5">{c.handle}</Text>
            </View>
            <Text className="text-ink-tertiary text-xs">{c.lastTx}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.32)" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/* ── Step 2: amount keypad ──────────────────────────────────────────── */
function AmountStep({
  contact, amount, setAmount, currency, setCurrency, max, overspend, onContinue,
}: {
  contact: Contact; amount: string; setAmount: (s: string) => void;
  currency: Currency; setCurrency: (c: Currency) => void;
  max: number; overspend: boolean; onContinue: () => void;
}) {
  const h = useHaptics();
  const meta = CURRENCY_META[currency];
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const tap = (k: string) => {
    h.selection();
    setAmount((prev) => {
      if (k === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (k === '.') return prev.includes('.') ? prev : `${prev}.`;
      return prev === '0' ? k : `${prev}${k}`;
    });
  };

  const onContinueTap = () => {
    if (overspend) {
      h.error();
      shake.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming( 8, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming( 6, { duration: 60 }),
        withTiming( 0, { duration: 60 }),
      );
      return;
    }
    onContinue();
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 20 }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View className="items-center" style={{ gap: 10 }}>
          <Avatar name={contact.name} size={64} />
          <Text className="text-ink-secondary text-sm font-semibold">{contact.handle}</Text>
        </View>

        <Animated.View style={[shakeStyle, { alignItems: 'center', marginTop: 32 }]}>
          <View className="flex-row items-baseline" style={{ gap: 4 }}>
            <Text style={{ color: '#4A8FE0', fontSize: 22, fontWeight: '700', alignSelf: 'flex-start', marginTop: 16 }}>
              {meta.symbol}
            </Text>
            <Text
              style={{
                color: overspend ? '#ef4444' : '#fff',
                fontSize: 64, fontWeight: '800', letterSpacing: -2,
                fontVariant: ['tabular-nums'],
              }}
            >
              {amount}
            </Text>
          </View>
          <View className="flex-row items-center mt-2" style={{ gap: 6 }}>
            <Text className="text-ink-tertiary text-xs">Available </Text>
            <Text className="text-ink-secondary text-xs font-semibold">
              {formatAmount(max, currency, { showSymbol: true })}
            </Text>
          </View>
        </Animated.View>

        {/* Currency chips */}
        <View className="flex-row justify-center mt-7" style={{ gap: 8, flexWrap: 'wrap' }}>
          {(['USDT', 'USD', 'EUR', 'AED'] as Currency[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => { h.selection(); setCurrency(c); setAmount('0'); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: currency === c ? '#0057B8' : 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: currency === c ? '#0057B8' : 'rgba(255,255,255,0.08)',
              }}
            >
              <Text style={{ color: currency === c ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' }}>
                {c}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Keypad */}
      <View className="mt-2">
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((k) => (
            <Pressable
              key={k}
              onPress={() => tap(k)}
              style={({ pressed }) => ({
                width: '31%',
                height: 64,
                alignItems: 'center', justifyContent: 'center',
                borderRadius: 18,
                backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
              })}
            >
              <Text style={{
                color: k === '⌫' ? 'rgba(255,255,255,0.6)' : '#fff',
                fontSize: 24, fontWeight: '600',
              }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <View className="mt-4">
          <Button
            label="Continue"
            size="lg"
            fullWidth
            onPress={onContinueTap}
            disabled={Number(amount) <= 0}
            iconRight={<Ionicons name="arrow-forward" size={18} color="#fff" />}
          />
        </View>
      </View>
    </View>
  );
}

/* ── Step 3: confirm summary ────────────────────────────────────────── */
function ConfirmStep({
  contact, amount, currency, note, setNote, onSend, onBack,
}: {
  contact: Contact; amount: string; currency: Currency;
  note: string; setNote: (s: string) => void;
  onSend: () => void; onBack: () => void;
}) {
  const fee = '0.00';
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
      <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 360 }}>
        <Card padding={22} radius={24} glow>
          <View className="items-center" style={{ gap: 12 }}>
            <Avatar name={contact.name} size={64} />
            <Text className="text-ink-tertiary text-xs font-semibold" style={{ letterSpacing: 1 }}>
              YOU'RE SENDING
            </Text>
            <Text className="text-ink-primary" style={{ fontSize: 38, fontWeight: '800', letterSpacing: -1 }}>
              {formatAmount(amount, currency, { showSymbol: true })}
            </Text>
            <Text className="text-ink-secondary text-sm font-semibold">to {contact.name} · {contact.handle}</Text>
          </View>

          <View className="mt-6" style={{ gap: 10 }}>
            <Row k="Network fee" v={`${fee} ${currency}`} />
            <Row k="Arrives"     v="Instantly" valueColor="#22c55e" />
            <Row k="From"        v="Promrkts Wallet · USDT" />
          </View>
        </Card>
      </MotiView>

      <Text className="text-ink-tertiary text-xs font-semibold mt-7 ml-1" style={{ letterSpacing: 1 }}>NOTE</Text>
      <View className="px-4 mt-2" style={{
        height: 56, borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
      }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What's it for?"
          placeholderTextColor="rgba(255,255,255,0.3)"
          maxLength={140}
          style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}
        />
      </View>

      <View className="mt-7" style={{ gap: 10 }}>
        <Button label={`Send ${formatAmount(amount, currency, { showSymbol: true })}`} size="lg" fullWidth onPress={onSend} haptic="medium" />
        <Button label="Edit"  variant="ghost" size="lg" fullWidth onPress={onBack} />
      </View>
    </ScrollView>
  );
}

function Row({ k, v, valueColor = '#fff' }: { k: string; v: string; valueColor?: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-ink-tertiary text-sm">{k}</Text>
      <Text style={{ color: valueColor, fontSize: 14, fontWeight: '700' }}>{v}</Text>
    </View>
  );
}
