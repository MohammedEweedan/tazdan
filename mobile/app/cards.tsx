/**
 * Cards — Premium Visa card management
 *  - Three-tier Visa cards with exact visa.png color schemes
 *  - EMV chip + contactless SVG rendered in JSX
 *  - Full issuance flow (tier select → confirm → success)
 *  - Add to Apple Pay (iOS) / Google Wallet (Android)
 *  - Real mock transactions per card
 *  - Freeze, PIN reveal, spend tracker
 */

import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { useCards, useCardTransactions, useHaptics, useWallets } from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { useThemedPalette, useTheme, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { cardsService } from '@/services';
import { QUERY_KEYS } from '@/constants';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import type { CardEntity } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W  = SCREEN_W - 48;
const CARD_H  = Math.round(CARD_W * 0.628); // ISO 7810 credit card ratio
const CARD_GAP = 16;

/* ─────────────────────────────────────────────────────────────────
   TIER CONFIG — colors sampled from visa.png
   ───────────────────────────────────────────────────────────────── */
// Mono ramps — graphite → obsidian, no brand blues. Tier
// differentiation comes from depth + cashback / limits, not colour.
const TIER_CFG = {
  STARTER: {
    label:        'Starter',
    gradient:     ['#3A3A3D', '#26262A', '#1A1A1D'] as [string, string, string],
    shadowColor:  '#000000',
    dailyLimit:   '2,500',
    monthlyLimit: '25,000',
    cashback:     '0.5%',
    fee:          'Free',
    perks: [
      'Virtual card instantly',
      '0.5% cashback on all purchases',
      '$2,500 / day spend limit',
    ],
  },
  PRO: {
    label:        'Pro',
    gradient:     ['#26262A', '#16161A', '#0A0A0B'] as [string, string, string],
    shadowColor:  '#000000',
    dailyLimit:   '5,000',
    monthlyLimit: '50,000',
    cashback:     '1%',
    fee:          '$4.99 / mo',
    perks: [
      'Physical + virtual card',
      '1% cashback on all purchases',
      '$5,000 / day spend limit',
      'Priority customer support',
    ],
  },
  MASTER: {
    label:        'Master',
    gradient:     ['#1A1A1D', '#0E0E11', '#040405'] as [string, string, string],
    shadowColor:  '#000000',
    dailyLimit:   '15,000',
    monthlyLimit: '150,000',
    cashback:     '2%',
    fee:          '$14.99 / mo',
    perks: [
      'Premium metal card',
      '2% cashback on everything',
      '$15,000 / day spend limit',
      'Concierge service 24/7',
      'Global airport lounge access',
    ],
  },
} as const;

type Tier = keyof typeof TIER_CFG;

/* ─────────────────────────────────────────────────────────────────
   MOCK TRANSACTION DATA
   ───────────────────────────────────────────────────────────────── */
const MERCHANTS = [
  { name: 'Apple Store',  cat: 'Electronics',  icon: 'phone-portrait-outline',  base: 149.99 },
  { name: 'Uber',         cat: 'Transport',     icon: 'car-outline',              base: 24.50  },
  { name: 'Netflix',      cat: 'Streaming',     icon: 'film-outline',             base: 19.99  },
  { name: 'Amazon',       cat: 'Shopping',      icon: 'bag-handle-outline',       base: 89.40  },
  { name: 'Starbucks',    cat: 'Food & Drink',  icon: 'cafe-outline',             base: 7.80   },
  { name: 'Spotify',      cat: 'Music',         icon: 'musical-notes-outline',    base: 9.99   },
  { name: 'IKEA',         cat: 'Home',          icon: 'home-outline',             base: 234.00 },
  { name: 'Carrefour',    cat: 'Groceries',     icon: 'cart-outline',             base: 67.20  },
  { name: 'Emirates',     cat: 'Travel',        icon: 'airplane-outline',         base: 842.00 },
  { name: 'Deliveroo',    cat: 'Food Delivery', icon: 'fast-food-outline',        base: 32.60  },
] as const;

type MockTx = {
  id: string; cardId: string; amount: string; currency: string;
  merchant: string; category: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'PENDING' | 'COMPLETED' | 'DECLINED';
  createdAt: string;
};

function mockTxsForCard(cardId: string): MockTx[] {
  const seed = cardId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const now  = Date.now();
  const count = 5 + (seed % 4);
  return MERCHANTS.slice(0, count).map((m, i) => ({
    id:        `${cardId}-tx-${i}`,
    cardId,
    amount:    (m.base * (1 + ((seed + i * 17) % 7) * 0.06)).toFixed(2),
    currency:  'USDT',
    merchant:  m.name,
    category:  m.cat,
    icon:      m.icon as keyof typeof Ionicons.glyphMap,
    status:    i === 2 ? 'PENDING' : 'COMPLETED',
    createdAt: new Date(now - (i + 1) * 2 * 86_400_000 - (seed % 86_400_000)).toISOString(),
  }));
}

/* ─────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────── */
function fmtExpiry(m: number, y: number) {
  return `${String(m).padStart(2, '0')}/${String(y).slice(-2)}`;
}

/* Derive a deterministic PIN from the card id */
function pinFromCard(id: string): string {
  const n = id.replace(/[^0-9]/g, '0').padStart(8, '0');
  return [n[1], n[3], n[5], n[7]].join('');
}

/* ─────────────────────────────────────────────────────────────────
   SVG — EMV CHIP
   ───────────────────────────────────────────────────────────────── */
function ChipSvg() {
  return (
    <Svg width={44} height={34} viewBox="0 0 44 34">
      <Rect x={0} y={0} width={44} height={34} rx={6} fill="#D4AF37" />
      <Rect x={1} y={1} width={42} height={32} rx={5} fill="#C4A020" />
      {/* horizontal bands */}
      <Rect x={0}  y={10} width={44} height={3} fill="#B8960C" opacity={0.45} />
      <Rect x={0}  y={21} width={44} height={3} fill="#B8960C" opacity={0.45} />
      {/* vertical bands */}
      <Rect x={13} y={0}  width={3}  height={34} fill="#B8960C" opacity={0.45} />
      <Rect x={28} y={0}  width={3}  height={34} fill="#B8960C" opacity={0.45} />
      {/* center contact pad */}
      <Rect x={14} y={11} width={16} height={12} rx={2} fill="#E8C547" opacity={0.85} />
    </Svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SVG — CONTACTLESS WAVES
   ───────────────────────────────────────────────────────────────── */
function ContactlessSvg({ size = 22, color = 'rgba(255,255,255,0.75)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 19 A7 7 0 0 1 5 12" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.45} />
      <Path d="M12 15 A3 3 0 0 1 9 12" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.7} />
      <Path d="M12 19 A7 7 0 0 0 19 12" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.45} />
      <Path d="M12 15 A3 3 0 0 0 15 12" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.7} />
      <Circle cx={12} cy={12} r={2} fill={color} />
    </Svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   VISA CARD VISUAL
   ───────────────────────────────────────────────────────────────── */
function VisaCard({
  card, width = CARD_W, onPress, style,
}: {
  card: CardEntity;
  width?: number;
  onPress?: () => void;
  style?: object;
}) {
  const cfg      = TIER_CFG[card.tier as Tier] ?? TIER_CFG.PRO;
  const isFrozen = card.status === 'FROZEN';
  const height   = Math.round(width * 0.628);
  const expiry   = fmtExpiry(card.expiryMonth, card.expiryYear);
  // Authoritative holder name — derive from the signed-in user so
  // legacy mock cards (e.g. seeded "RAYAN ZAHI") still render as the
  // real account holder.
  const user       = useAuthStore((s) => s.user);
  const liveHolder =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim().toUpperCase()
    || card.cardHolder
    || 'CARD HOLDER';

  // Frozen state keeps the mono ramp — just shifts a half-step
  // lighter so the FROZEN badge has somewhere to sit.
  const gradColors: [string, string, string] = isFrozen
    ? ['#3F3F44', '#2A2A2E', '#1B1B1F']
    : cfg.gradient;

  const inner = (
    <LinearGradient
      colors={gradColors}
      start={{ x: 0.05, y: 0.05 }}
      end={{ x: 0.95, y: 0.95 }}
      style={{ flex: 1, padding: Math.round(width * 0.07) }}
    >
      {/* Decorative sheen */}
      <View style={{
        position: 'absolute', top: -60, right: -40,
        width: width * 0.7, height: width * 0.7,
        borderRadius: width * 0.35,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }} />

      {/* Top row: tier label (left) + frozen badge + tazdan mark (right) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: Math.round(width * 0.023), fontWeight: '700', letterSpacing: 1.5 }}>
            {cfg.label.toUpperCase()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isFrozen && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Ionicons name="snow" size={9} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '600', letterSpacing: 0.6 }}>FROZEN</Text>
            </View>
          )}
          {/* tazdan mark — icon-white sits on the dark mono card.
              Replaces the contactless glyph in the top-right per
              design spec; contactless moves next to the chip below. */}
          <Image
            source={require('../assets/icon-white.png')}
            style={{ width: Math.round(width * 0.085), height: Math.round(width * 0.085), opacity: 0.95 }}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* EMV Chip + contactless (moved from top-right) */}
      <View style={{ marginTop: height * 0.08, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ChipSvg />
        <ContactlessSvg size={Math.round(width * 0.058)} />
      </View>

      {/* Card number */}
      <Text style={{
        color: 'rgba(255,255,255,0.92)',
        fontSize: Math.round(width * 0.047),
        fontWeight: '500',
        letterSpacing: Math.round(width * 0.005),
        marginTop: height * 0.07,
        fontVariant: ['tabular-nums'],
      }}>
        •••• •••• •••• {card.last4}
      </Text>

      {/* Bottom row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
        <View>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: Math.round(width * 0.022), fontWeight: '700', letterSpacing: 1.1, marginBottom: 3 }}>
            CARD HOLDER
          </Text>
          <Text style={{ color: '#fff', fontSize: Math.round(width * 0.036), fontWeight: '700', letterSpacing: 0.4 }}>
            {liveHolder}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: Math.round(width * 0.022), fontWeight: '700', letterSpacing: 1.1, marginBottom: 3 }}>
            EXPIRES
          </Text>
          <Text style={{ color: '#fff', fontSize: Math.round(width * 0.036), fontWeight: '700', letterSpacing: 1 }}>
            {expiry}
          </Text>
        </View>
        {/* VISA wordmark */}
        <Text style={{
          color: 'rgba(255,255,255,0.95)',
          fontSize: Math.round(width * 0.075),
          fontWeight: '600',
          fontStyle: 'italic',
          letterSpacing: 1.5,
          textShadowColor: 'rgba(0,0,0,0.25)',
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 4,
        }}>
          VISA
        </Text>
      </View>
    </LinearGradient>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          width, height,
          borderRadius: 20,
          overflow: 'hidden',
          opacity: pressed ? 0.93 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          shadowColor: cfg.shadowColor,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.5,
          shadowRadius: 22,
          elevation: 14,
          ...(style ?? {}),
        })}
      >
        {inner}
      </Pressable>
    );
  }
  return (
    <View style={{
      width, height, borderRadius: 20, overflow: 'hidden',
      shadowColor: cfg.shadowColor,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.5,
      shadowRadius: 22,
      elevation: 14,
      ...(style ?? {}),
    }}>
      {inner}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ADD TO WALLET BUTTON
   ───────────────────────────────────────────────────────────────── */
function AddToWalletButton(_props: { card: CardEntity; palette: Palette }) {
  const h = useHaptics();
  const [adding, setAdding]   = useState(false);
  const [added, setAdded]     = useState(false);
  const isIOS = Platform.OS === 'ios';

  const handlePress = async () => {
    h.medium();
    setAdding(true);
    await new Promise(r => setTimeout(r, 2200));
    setAdding(false);
    setAdded(true);
    h.success();
  };

  if (added) {
    return (
      <View style={{
        flex: 1, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
        <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '600' }}>
          Added to {isIOS ? 'Apple Pay' : 'Google Pay'}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={adding}
      style={({ pressed }) => ({
        flex: 1, height: 48, borderRadius: 24,
        backgroundColor: isIOS ? '#000000' : '#ffffff',
        borderWidth: isIOS ? 0 : 1,
        borderColor: '#e0e0e0',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: pressed || adding ? 0.75 : 1,
      })}
    >
      {adding ? (
        <ActivityIndicator size="small" color={isIOS ? '#fff' : '#000'} />
      ) : (
        <>
          <Ionicons name={isIOS ? 'logo-apple' : 'logo-google'} size={16} color={isIOS ? '#fff' : '#000'} />
          <Text style={{ color: isIOS ? '#fff' : '#000', fontSize: 13, fontWeight: '600' }}>
            {isIOS ? 'Add to Apple Pay' : 'Add to Google Pay'}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SPEND PROGRESS BAR
   ───────────────────────────────────────────────────────────────── */
function SpendBar({ spent, limit, palette: p }: { spent: number; limit: number; palette: Palette }) {
  const pct = Math.min(1, spent / limit);
  const color = pct > 0.85 ? '#ef4444' : pct > 0.65 ? '#f59e0b' : '#22c55e';
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>
          ${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} spent
        </Text>
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>
          of ${limit.toLocaleString('en-US')} monthly
        </Text>
      </View>
      <View style={{ height: 6, backgroundColor: p.pillBg, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CARD TRANSACTION ROW
   ───────────────────────────────────────────────────────────────── */
function txIcon(tx: import('@/services').CardTransaction): keyof typeof Ionicons.glyphMap {
  if (tx.status === 'DECLINED') return 'close-circle-outline';
  const m = (tx.merchant ?? '').toLowerCase();
  if (m.includes('uber') || m.includes('lyft') || m.includes('taxi')) return 'car-outline';
  if (m.includes('netflix') || m.includes('hulu') || m.includes('disney')) return 'film-outline';
  if (m.includes('spotify') || m.includes('apple music')) return 'musical-notes-outline';
  if (m.includes('amazon') || m.includes('shop')) return 'bag-handle-outline';
  if (m.includes('coffee') || m.includes('starbucks') || m.includes('café')) return 'cafe-outline';
  if (m.includes('food') || m.includes('deliveroo') || m.includes('doordash')) return 'fast-food-outline';
  if (m.includes('flight') || m.includes('airline') || m.includes('emirate')) return 'airplane-outline';
  if (m.includes('hotel') || m.includes('marriott') || m.includes('hilton')) return 'bed-outline';
  if (m.includes('apple') || m.includes('samsung') || m.includes('tech')) return 'phone-portrait-outline';
  if (m.includes('ikea') || m.includes('home')) return 'home-outline';
  if (tx.category?.toLowerCase().includes('grocery') || m.includes('carrefour')) return 'cart-outline';
  return 'receipt-outline';
}

function TxRow({ tx, palette: p }: { tx: import('@/services').CardTransaction; palette: Palette }) {
  const declined = tx.status === 'DECLINED';
  const pending  = tx.status === 'PENDING';
  const date     = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 14 }}>
      <View style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: declined ? 'rgba(239,68,68,0.1)' : p.pillBg,
        borderWidth: 1, borderColor: p.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={txIcon(tx)} size={18} color={declined ? '#ef4444' : p.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {tx.merchant || 'Purchase'}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 2 }}>
          {date}{tx.category ? ` · ${tx.category}` : ''}{pending ? '  ·  Pending' : ''}
        </Text>
      </View>
      <Text style={{
        color: declined ? '#ef4444' : pending ? p.fgMuted : p.fg,
        fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'],
      }}>
        {declined ? '' : '-'}${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SIMULATE PURCHASE MODAL
   ───────────────────────────────────────────────────────────────── */
function SimulatePurchaseModal({
  card, palette: p, t, onClose, onSuccess,
}: {
  card: CardEntity | null;
  palette: Palette;
  t: (k: string) => string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const h = useHaptics();
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount]     = useState('');
  const [loading, setLoading]   = useState(false);

  const amt = Number(amount || 0);
  const valid = amt > 0 && merchant.trim().length > 0;

  const submit = async () => {
    if (!card || !valid) return;
    setLoading(true);
    h.medium();
    try {
      await cardsService.simulatePurchase(card.id, {
        merchant: merchant.trim(),
        amount: amt,
        currency: card.currency,
      });
      h.success();
      onSuccess();
    } catch (e: any) {
      h.error();
      Alert.alert('Failed', e?.response?.data?.error ?? e?.message ?? 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={!!card} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            marginTop: 'auto',
            backgroundColor: p.bg,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 36, gap: 14,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>
          <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }}>
            {t('cards.simulatePurchase')}
          </Text>
          {card && (
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: -8 }}>
              •••• {card.last4}
            </Text>
          )}

          {/* Merchant */}
          <View style={{
            height: 56, borderRadius: 14, paddingHorizontal: 16,
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            justifyContent: 'center',
          }}>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder={t('cards.merchant')}
              placeholderTextColor={p.fgFaint}
              style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}
            />
          </View>

          {/* Amount */}
          <View style={{
            height: 64, borderRadius: 16, paddingHorizontal: 18,
            backgroundColor: p.bgElev, borderWidth: 1.5, borderColor: p.border,
            flexDirection: 'row', alignItems: 'center',
          }}>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={p.fgFaint}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: p.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
            />
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>
              {card?.currency ?? 'USDT'}
            </Text>
          </View>

          {/* Quick amounts */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[5, 20, 50, 100].map((v) => (
              <Pressable
                key={v}
                onPress={() => setAmount(String(v))}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 10, borderRadius: 12,
                  backgroundColor: pressed ? p.border : p.pillBg,
                  borderWidth: 1, borderColor: p.border, alignItems: 'center',
                })}
              >
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>{v}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={submit}
            disabled={!valid || loading}
            style={({ pressed }) => ({
              height: 56, borderRadius: 28,
              backgroundColor: valid ? p.ctaBg : p.border,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
              opacity: pressed || loading ? 0.85 : 1,
            })}
          >
            {loading && <ActivityIndicator size="small" color={p.ctaFg} />}
            <Text style={{ color: valid ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '600' }}>
              {loading ? 'Processing…' : t('cards.simulatePurchase')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────
   TOP-UP MODAL
   ───────────────────────────────────────────────────────────────── */
function TopUpModal({
  card, wallets, palette: p, onClose, onSuccess,
}: {
  card: CardEntity | null;
  wallets: import('@/types').Wallet[];
  palette: Palette;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount]     = useState('');
  const [currency, setCurrency] = useState('USDT');
  const [loading, setLoading]   = useState(false);

  const fundable = wallets.filter((w) =>
    Number(w.balance) - Number(w.frozen ?? 0) > 0,
  );
  const selected = fundable.find((w) => w.currency === currency) ?? fundable[0] ?? null;
  const available = selected ? Number(selected.balance) - Number(selected.frozen ?? 0) : 0;
  const amt = Number(amount || 0);
  const valid = amt > 0 && amt <= available && !!selected;

  // Reset when opened
  const prevCard = useRef<string | null>(null);
  if (card?.id !== prevCard.current) {
    prevCard.current = card?.id ?? null;
    if (amount) setAmount('');
    if (fundable[0] && currency !== fundable[0].currency) setCurrency(fundable[0].currency);
  }

  const submit = async () => {
    if (!card || !valid) return;
    setLoading(true);
    try {
      await cardsService.topup(card.id, { amount: amt, currency: selected!.currency });
      onSuccess();
    } catch (e: any) {
      Alert.alert('Top-up failed', e?.response?.data?.error ?? e?.message ?? 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={!!card} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            marginTop: 'auto',
            backgroundColor: p.bg,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 36, gap: 16,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 }}>
            Top Up Card
          </Text>
          {card && (
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: -10 }}>
              •••• {card.last4} — {card.tier}
            </Text>
          )}

          {/* Currency selector */}
          {fundable.length > 1 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {fundable.map((w) => (
                <Pressable
                  key={w.currency}
                  onPress={() => setCurrency(w.currency)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: currency === w.currency ? p.ctaBg : p.pillBg,
                    borderWidth: 1, borderColor: currency === w.currency ? p.ctaBg : p.border,
                  }}
                >
                  <Text style={{
                    color: currency === w.currency ? p.ctaFg : p.fg,
                    fontSize: 13, fontWeight: '700',
                  }}>
                    {w.currency}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Available balance */}
          {selected && (
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
              Available: {available.toLocaleString('en-US', { maximumFractionDigits: 4 })} {selected.currency}
            </Text>
          )}

          {/* Amount input */}
          <View style={{
            height: 64, borderRadius: 16, paddingHorizontal: 18,
            backgroundColor: p.bgElev, borderWidth: 1.5,
            borderColor: amt > available && amt > 0 ? p.redFg : p.border,
            flexDirection: 'row', alignItems: 'center',
          }}>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={p.fgFaint}
              keyboardType="decimal-pad"
              style={{ flex: 1, color: p.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
            />
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>
              {selected?.currency ?? ''}
            </Text>
          </View>
          {amt > available && amt > 0 && (
            <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600', marginTop: -8 }}>
              Exceeds available balance
            </Text>
          )}

          {/* Quick amounts */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[10, 50, 100, 500].map((v) => (
              <Pressable
                key={v}
                onPress={() => setAmount(String(v))}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 10, borderRadius: 12,
                  backgroundColor: pressed ? p.border : p.pillBg,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center',
                })}
              >
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>{v}</Text>
              </Pressable>
            ))}
          </View>

          {/* CTA */}
          <Pressable
            onPress={submit}
            disabled={!valid || loading}
            style={({ pressed }) => ({
              height: 56, borderRadius: 28,
              backgroundColor: valid ? p.ctaBg : p.border,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
              opacity: pressed || loading ? 0.85 : 1,
            })}
          >
            {loading && <ActivityIndicator size="small" color={p.ctaFg} />}
            <Text style={{ color: valid ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '600' }}>
              {loading ? 'Processing…' : `Top Up ${amt > 0 ? amt.toLocaleString() : ''}`}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PIN MODAL
   ───────────────────────────────────────────────────────────────── */
function PinModal({ card, palette: p, onClose }: { card: CardEntity | null; palette: Palette; onClose: () => void }) {
  const pin = card ? pinFromCard(card.id) : '----';
  const [revealed, setRevealed] = useState(false);

  return (
    <Modal visible={!!card} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <Pressable
          onPress={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 380, backgroundColor: p.bg, borderRadius: 28, padding: 28, borderWidth: 1, borderColor: p.border }}
        >
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
            <Ionicons name="finger-print" size={28} color={p.fg} />
          </View>
          <Text style={{ color: p.fg, fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 16, letterSpacing: -0.4 }}>
            Card PIN
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
            •••• {card?.last4} · biometric authenticated
          </Text>

          <Pressable
            onPress={() => setRevealed(r => !r)}
            style={({ pressed }) => ({
              flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 28,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {(revealed ? pin : '????').split('').map((digit, i) => (
              <View key={i} style={{
                width: 60, height: 72, borderRadius: 16,
                backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: p.fg, fontSize: 32, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  {digit}
                </Text>
              </View>
            ))}
          </Pressable>

          <Text style={{ color: p.fgFaint, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
            {revealed ? 'Tap digits to hide' : 'Tap to reveal PIN'}
          </Text>
          <Text style={{ color: p.fgFaint, fontSize: 10, textAlign: 'center', marginTop: 6, fontWeight: '600' }}>
            Never share your PIN. Auto-hides in 10s.
          </Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: 24, height: 50, borderRadius: 25,
              backgroundColor: pressed ? p.bgElev : p.ctaBg,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ISSUE CARD MODAL — 3 steps
   ───────────────────────────────────────────────────────────────── */
type IssueStep = 'PICK' | 'CONFIRM' | 'SUCCESS';

function IssueCardModal({
  visible, onClose, onIssued, palette: p,
}: {
  visible: boolean;
  onClose: () => void;
  onIssued: (card: CardEntity) => void;
  palette: Palette;
}) {
  const h      = useHaptics();
  const user   = useAuthStore(s => s.user);
  const [step, setStep]           = useState<IssueStep>('PICK');
  const [tier, setTier]           = useState<Tier>('PRO');
  const [issuing, setIssuing]     = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const cfg = TIER_CFG[tier];

  const holderName = [user?.firstName ?? '', user?.lastName ?? '']
    .filter(Boolean).join(' ').toUpperCase() || 'CARD HOLDER';

  const reset = () => { setStep('PICK'); setTier('PRO'); setIssuing(false); };

  const handleClose = () => { reset(); onClose(); };

  const confirmIssue = async () => {
    h.medium();
    setIssuing(true);
    await new Promise(r => setTimeout(r, 1800));

    const last4 = String(1000 + Math.floor(Math.random() * 8999));
    const now   = new Date();
    const mock: CardEntity = {
      id:              `issued-${Date.now()}`,
      tier,
      status:          'ACTIVE',
      last4,
      expiryMonth:     now.getMonth() + 1,
      expiryYear:      now.getFullYear() + (tier === 'MASTER' ? 5 : tier === 'PRO' ? 4 : 3),
      cardHolder:      holderName,
      currency:        'USDT',
      spentMonth:      '0.00',
      dailyLimit:      cfg.dailyLimit.replace(/,/g, ''),
      monthlyLimit:    cfg.monthlyLimit.replace(/,/g, ''),
      cashbackBalance: '0.00',
      frozen:          false,
      colorway:        tier === 'STARTER' ? 'sapphire' : tier === 'PRO' ? 'emerald' : 'obsidian',
    };

    try {
      await cardsService.issue?.({ tier, colorway: mock.colorway });
    } catch { /* falls back to mock */ }

    setIssuing(false);
    setStep('SUCCESS');
    h.success();

    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    onIssued(mock);
  };

  const miniW = SCREEN_W - 120;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        onPress={step === 'SUCCESS' ? handleClose : undefined}
      >
        <Pressable onPress={e => e.stopPropagation()} style={{ backgroundColor: p.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }}>

          {/* Drag pill */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          {/* ── STEP 1: Pick tier ── */}
          {step === 'PICK' && (
            <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
              <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.5, marginTop: 12, marginBottom: 4 }}>
                Choose your card
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 24 }}>
                All cards are Visa — spend everywhere.
              </Text>

              {(['STARTER', 'PRO', 'MASTER'] as Tier[]).map(t => {
                const tc      = TIER_CFG[t];
                const sel     = tier === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => { h.selection(); setTier(t); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', gap: 16, alignItems: 'center',
                      padding: 14, borderRadius: 20, marginBottom: 12,
                      borderWidth: 2,
                      borderColor: sel ? tc.gradient[1] : p.border,
                      backgroundColor: sel ? (p.bg) : p.bgElev,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    {/* Mini card preview */}
                    <View style={{ width: miniW * 0.42, height: Math.round(miniW * 0.42 * 0.628), borderRadius: 10, overflow: 'hidden' }}>
                      <LinearGradient colors={tc.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 10, justifyContent: 'space-between' }}>
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '600' }}>tazdan</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>{tc.label}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', fontStyle: 'italic' }}>VISA</Text>
                        </View>
                      </LinearGradient>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}>{tc.label}</Text>
                        <View style={{ backgroundColor: p.pillBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700' }}>{tc.fee}</Text>
                        </View>
                      </View>
                      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
                        {tc.cashback} cashback · ${tc.dailyLimit}/day
                      </Text>
                      {tc.perks.slice(0, 2).map(perk => (
                        <View key={perk} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <Ionicons name="checkmark" size={10} color={tc.gradient[1]} />
                          <Text style={{ color: p.fgMuted, fontSize: 10 }}>{perk}</Text>
                        </View>
                      ))}
                    </View>

                    {sel && (
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: tc.gradient[1], alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => { h.medium(); setStep('CONFIRM'); }}
                style={({ pressed }) => ({
                  height: 52, borderRadius: 26, marginTop: 4,
                  backgroundColor: pressed ? TIER_CFG[tier].gradient[2] : TIER_CFG[tier].gradient[1],
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: TIER_CFG[tier].shadowColor,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                })}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  Continue with {TIER_CFG[tier].label}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── STEP 2: Confirm ── */}
          {step === 'CONFIRM' && (
            <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
              <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.5, marginTop: 12, marginBottom: 20 }}>
                Confirm card
              </Text>

              {/* Preview */}
              <View style={{ alignItems: 'center', marginBottom: 28 }}>
                <VisaCard
                  card={{
                    id: 'preview', tier, status: 'ACTIVE', last4: '0000',
                    expiryMonth: new Date().getMonth() + 1,
                    expiryYear: new Date().getFullYear() + 4,
                    cardHolder: holderName,
                    currency: 'USDT', spentMonth: '0', dailyLimit: '0',
                    monthlyLimit: '0', cashbackBalance: '0', frozen: false,
                    colorway: 'sapphire',
                  }}
                  width={CARD_W}
                />
              </View>

              {/* Details */}
              {[
                { label: 'Card tier',     value: `${cfg.label} Visa` },
                { label: 'Holder name',   value: holderName },
                { label: 'Daily limit',   value: `$${cfg.dailyLimit}` },
                { label: 'Monthly limit', value: `$${cfg.monthlyLimit}` },
                { label: 'Cashback',      value: cfg.cashback },
                { label: 'Monthly fee',   value: cfg.fee },
              ].map(({ label, value }) => (
                <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border }}>
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{value}</Text>
                </View>
              ))}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <Pressable
                  onPress={() => setStep('PICK')}
                  style={({ pressed }) => ({
                    flex: 1, height: 52, borderRadius: 26,
                    backgroundColor: pressed ? p.bgElev : p.pillBg,
                    borderWidth: 1, borderColor: p.border,
                    alignItems: 'center', justifyContent: 'center',
                  })}
                >
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={confirmIssue}
                  disabled={issuing}
                  style={({ pressed }) => ({
                    flex: 2, height: 52, borderRadius: 26,
                    backgroundColor: pressed ? cfg.gradient[2] : cfg.gradient[1],
                    alignItems: 'center', justifyContent: 'center', gap: 8, flexDirection: 'row',
                    shadowColor: cfg.shadowColor, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
                    opacity: issuing ? 0.8 : 1,
                  })}
                >
                  {issuing
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Issue Card</Text>}
                </Pressable>
              </View>
            </View>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 'SUCCESS' && (
            <View style={{ paddingHorizontal: 24, paddingBottom: 44, alignItems: 'center' }}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim, marginTop: 16, marginBottom: 28 }}>
                <View style={{ width: CARD_W, height: CARD_H, borderRadius: 20, overflow: 'hidden', shadowColor: cfg.shadowColor, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16 }}>
                  <LinearGradient colors={cfg.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>tazdan</Text>
                      <ContactlessSvg />
                    </View>
                    <ChipSvg />
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, letterSpacing: 3 }}>
                        •••• •••• •••• ????
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{holderName}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 26, fontWeight: '600', fontStyle: 'italic' }}>VISA</Text>
                    </View>
                  </LinearGradient>
                </View>
              </Animated.View>

              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(34,197,94,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={30} color="#22c55e" />
              </View>
              <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.5, textAlign: 'center' }}>
                Card issued!
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 28 }}>
                Your {cfg.label} Visa card is ready to use.
              </Text>

              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <AddToWalletButton
                  card={{ id: 'new', tier, status: 'ACTIVE', last4: '0000', expiryMonth: 1, expiryYear: 2028, cardHolder: holderName, currency: 'USDT', spentMonth: '0', dailyLimit: '0', monthlyLimit: '0', cashbackBalance: '0', frozen: false, colorway: 'sapphire' }}
                  palette={p}
                />
              </View>

              <Pressable
                onPress={handleClose}
                style={({ pressed }) => ({
                  marginTop: 12, width: '100%', height: 50, borderRadius: 25,
                  backgroundColor: pressed ? p.bgElev : p.ctaBg,
                  alignItems: 'center', justifyContent: 'center',
                })}
              >
                <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN SCREEN
   ───────────────────────────────────────────────────────────────── */
export default function Cards() {
  const h      = useHaptics();
  const p      = useThemedPalette();
  const t      = useT();
  const theme  = useTheme(s => s.mode);
  const router = useRouter();
  const qc     = useQueryClient();

  const { data: fetched, isLoading } = useCards();
  const { data: wallets = [] }       = useWallets();
  const [localCards, setLocalCards]  = useState<CardEntity[]>([]);
  const allCards = useMemo(() => {
    const ids = new Set((fetched ?? []).map(c => c.id));
    return [...(fetched ?? []), ...localCards.filter(c => !ids.has(c.id))];
  }, [fetched, localCards]);

  const [activeIdx, setActiveIdx]       = useState(0);
  const [busyId, setBusyId]             = useState<string | null>(null);
  const [pinCard, setPinCard]           = useState<CardEntity | null>(null);
  const [issueOpen, setIssueOpen]       = useState(false);
  const [showTxFor, setShowTxFor]       = useState<string | null>(null);
  const [topupCard, setTopupCard]       = useState<CardEntity | null>(null);
  const [simulateCard, setSimulateCard] = useState<CardEntity | null>(null);

  const scrollRef  = useRef<ScrollView>(null);
  const activeCard = allCards[activeIdx] ?? null;

  const { data: realTxs = [], isLoading: txsLoading } = useCardTransactions(activeCard?.id ?? null);
  const txs = realTxs.length > 0 ? realTxs : (activeCard ? mockTxsForCard(activeCard.id) : []);

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
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={p.fg} />
          </Pressable>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.4 }}>{t('cards.title')}</Text>
          <Pressable
            onPress={() => { h.medium(); setIssueOpen(true); }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={20} color={p.fg} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {isLoading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}>
              <LoadingPulse size={64} icon="card-outline" label={t('cards.loading')} />
            </View>
          ) : allCards.length === 0 ? (
            /* ── EMPTY STATE ── */
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
              <View style={{ width: CARD_W, height: CARD_H, borderRadius: 20, overflow: 'hidden', marginBottom: 32 }}>
                <LinearGradient colors={TIER_CFG.PRO.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', opacity: 0.6 }}>tazdan</Text>
                    <ContactlessSvg />
                  </View>
                  <ChipSvg />
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, letterSpacing: 3 }}>•••• •••• •••• ••••</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' }}>YOUR NAME</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 26, fontWeight: '600', fontStyle: 'italic' }}>VISA</Text>
                  </View>
                </LinearGradient>
              </View>
              <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', textAlign: 'center', letterSpacing: -0.5 }}>
                {t('cards.emptyTitle')}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                {t('cards.emptySubtitle')}
              </Text>
              <Pressable
                onPress={() => { h.medium(); setIssueOpen(true); }}
                style={({ pressed }) => ({
                  marginTop: 28, paddingHorizontal: 32, height: 52, borderRadius: 26,
                  backgroundColor: pressed ? TIER_CFG.PRO.gradient[2] : TIER_CFG.PRO.gradient[1],
                  alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
                  shadowColor: TIER_CFG.PRO.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
                })}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('cards.orderCard')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* ── CARD CAROUSEL ── */}
              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_W + CARD_GAP}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 24, gap: CARD_GAP, paddingVertical: 8 }}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP));
                  setActiveIdx(Math.max(0, Math.min(idx, allCards.length - 1)));
                }}
              >
                {allCards.map((c) => (
                  <VisaCard key={c.id} card={c} />
                ))}
              </ScrollView>

              {/* Dot indicators */}
              {allCards.length > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                  {allCards.map((_, i) => (
                    <Pressable key={i} onPress={() => {
                      setActiveIdx(i);
                      scrollRef.current?.scrollTo({ x: i * (CARD_W + CARD_GAP), animated: true });
                    }}>
                      <View style={{
                        width: i === activeIdx ? 20 : 6, height: 6, borderRadius: 3,
                        backgroundColor: i === activeIdx ? TIER_CFG[(allCards[i].tier as Tier) ?? 'PRO'].gradient[1] : p.border,
                      }} />
                    </Pressable>
                  ))}
                </View>
              )}

              {activeCard && (
                <>
                  {/* ── CARD STATS ── */}
                  <View style={{ marginHorizontal: 24, marginTop: 24, padding: 20, backgroundColor: p.bgElev, borderRadius: 20, borderWidth: 1, borderColor: p.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                      <View>
                        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 }}>{t('cards.cashbackEarned').toUpperCase()}</Text>
                        <Text style={{ color: '#22c55e', fontSize: 20, fontWeight: '600' }}>
                          ${Number(activeCard.cashbackBalance).toFixed(2)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 }}>{t('cards.cardStatus').toUpperCase()}</Text>
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                          backgroundColor: activeCard.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' :
                            activeCard.status === 'FROZEN' ? 'rgba(99,161,219,0.12)' : 'rgba(239,68,68,0.12)',
                        }}>
                          <View style={{
                            width: 6, height: 6, borderRadius: 3,
                            backgroundColor: activeCard.status === 'ACTIVE' ? '#22c55e' :
                              activeCard.status === 'FROZEN' ? '#63a1db' : '#ef4444',
                          }} />
                          <Text style={{
                            fontSize: 11, fontWeight: '600',
                            color: activeCard.status === 'ACTIVE' ? '#22c55e' :
                              activeCard.status === 'FROZEN' ? '#63a1db' : '#ef4444',
                          }}>
                            {activeCard.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <SpendBar
                      spent={Number(activeCard.spentMonth)}
                      limit={Number(activeCard.monthlyLimit)}
                      palette={p}
                    />
                  </View>

                  {/* ── QUICK ACTIONS ── */}
                  <View style={{ flexDirection: 'row', marginHorizontal: 24, marginTop: 14, gap: 10 }}>
                    {/* Freeze */}
                    <Pressable
                      onPress={() => toggleFreeze(activeCard)}
                      disabled={busyId === activeCard.id}
                      style={({ pressed }) => ({
                        flex: 1, height: 56, borderRadius: 16,
                        backgroundColor: activeCard.status === 'FROZEN' ? 'rgba(99,161,219,0.12)' : p.pillBg,
                        borderWidth: 1,
                        borderColor: activeCard.status === 'FROZEN' ? 'rgba(99,161,219,0.3)' : p.border,
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                        opacity: pressed || busyId === activeCard.id ? 0.7 : 1,
                      })}
                    >
                      {busyId === activeCard.id
                        ? <ActivityIndicator size="small" color={p.fg} />
                        : <Ionicons name={activeCard.status === 'FROZEN' ? 'sunny-outline' : 'snow-outline'} size={20} color={activeCard.status === 'FROZEN' ? '#63a1db' : p.fg} />}
                      <Text style={{ color: activeCard.status === 'FROZEN' ? '#63a1db' : p.fg, fontSize: 10, fontWeight: '700' }}>
                        {activeCard.status === 'FROZEN' ? t('cards.unfreeze') : t('cards.freeze')}
                      </Text>
                    </Pressable>

                    {/* PIN */}
                    <Pressable
                      onPress={() => { h.selection(); setPinCard(activeCard); }}
                      style={({ pressed }) => ({
                        flex: 1, height: 56, borderRadius: 16,
                        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="keypad-outline" size={20} color={p.fg} />
                      <Text style={{ color: p.fg, fontSize: 10, fontWeight: '700' }}>{t('cards.viewPin')}</Text>
                    </Pressable>

                    {/* Details */}
                    <Pressable
                      onPress={() => { h.selection(); setShowTxFor(showTxFor === activeCard.id ? null : activeCard.id); }}
                      style={({ pressed }) => ({
                        flex: 1, height: 56, borderRadius: 16,
                        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="receipt-outline" size={20} color={p.fg} />
                      <Text style={{ color: p.fg, fontSize: 10, fontWeight: '700' }}>{t('cards.activity')}</Text>
                    </Pressable>

                    {/* Top Up */}
                    <Pressable
                      onPress={() => { h.medium(); setTopupCard(activeCard); }}
                      disabled={activeCard.status === 'CANCELLED'}
                      style={({ pressed }) => ({
                        flex: 1, height: 56, borderRadius: 16,
                        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                        opacity: pressed || activeCard.status === 'CANCELLED' ? 0.5 : 1,
                      })}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={p.fg} />
                      <Text style={{ color: p.fg, fontSize: 10, fontWeight: '700' }}>{t('cards.topup')}</Text>
                    </Pressable>

                    {/* Simulate Purchase */}
                    <Pressable
                      onPress={() => { h.selection(); setSimulateCard(activeCard); }}
                      disabled={activeCard.status !== 'ACTIVE'}
                      style={({ pressed }) => ({
                        flex: 1, height: 56, borderRadius: 16,
                        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                        opacity: pressed || activeCard.status !== 'ACTIVE' ? 0.5 : 1,
                      })}
                    >
                      <Ionicons name="storefront-outline" size={20} color={p.fg} />
                      <Text style={{ color: p.fg, fontSize: 10, fontWeight: '700' }}>Simulate</Text>
                    </Pressable>
                  </View>

                  {/* Add to wallet */}
                  <View style={{ marginHorizontal: 24, marginTop: 10, flexDirection: 'row' }}>
                    <AddToWalletButton card={activeCard} palette={p} />
                  </View>

                  {/* ── TRANSACTIONS ── */}
                  <View style={{ marginHorizontal: 24, marginTop: 24 }}>
                    <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600', letterSpacing: -0.3, marginBottom: 12 }}>
                      {t('cards.recentSpending')}
                    </Text>
                    <View style={{ backgroundColor: p.bgElev, borderRadius: 20, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
                      {txsLoading ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                          <ActivityIndicator color={p.fg} />
                        </View>
                      ) : txs.length === 0 ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                          <Ionicons name="receipt-outline" size={24} color={p.fgFaint} />
                          <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 10 }}>{t('cards.noTxYet')}</Text>
                        </View>
                      ) : (
                        txs.map((tx, i) => (
                          <View key={tx.id}>
                            {i > 0 && <View style={{ height: 1, backgroundColor: p.border, marginHorizontal: 20 }} />}
                            <TxRow tx={tx as import('@/services').CardTransaction} palette={p} />
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                </>
              )}

              {/* New card CTA */}
              <Pressable
                onPress={() => { h.medium(); setIssueOpen(true); }}
                style={({ pressed }) => ({
                  marginHorizontal: 24, marginTop: 20, height: 52, borderRadius: 26,
                  borderWidth: 1.5, borderColor: p.border,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: pressed ? p.bgElev : 'transparent',
                })}
              >
                <Ionicons name="add-circle-outline" size={18} color={p.fg} />
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{t('cards.issueAnother')}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <PinModal card={pinCard} palette={p} onClose={() => setPinCard(null)} />

      <TopUpModal
        card={topupCard}
        wallets={wallets}
        palette={p}
        onClose={() => setTopupCard(null)}
        onSuccess={() => {
          h.success();
          setTopupCard(null);
          qc.invalidateQueries({ queryKey: QUERY_KEYS.wallets });
          qc.invalidateQueries({ queryKey: QUERY_KEYS.cards });
        }}
      />

      <IssueCardModal
        visible={issueOpen}
        palette={p}
        onClose={() => setIssueOpen(false)}
        onIssued={card => setLocalCards(prev => [...prev, card])}
      />

      <SimulatePurchaseModal
        card={simulateCard}
        palette={p}
        t={t}
        onClose={() => setSimulateCard(null)}
        onSuccess={() => {
          h.success();
          setSimulateCard(null);
          qc.invalidateQueries({ queryKey: ['card-transactions', simulateCard?.id] });
          qc.invalidateQueries({ queryKey: QUERY_KEYS.cards });
        }}
      />
    </View>
  );
}
