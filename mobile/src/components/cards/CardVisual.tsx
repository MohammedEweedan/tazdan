/**
 * CardVisual — premium fintech card with tier-driven design (Starter /
 * Master / Pro), tap-to-flip, masked PAN/CVV/expiry by default and a
 * biometric (Face ID / Touch ID / passcode) gate for revealing
 * sensitive fields.
 *
 * Native port of `CardStack.tsx` which was authored as a web component.
 * Uses `expo-linear-gradient` for the gradient body and the React
 * Native `Animated` API for the 3D flip transform.
 *
 * Pick the tier via `card.tier` (`STARTER` | `MASTER` | `PRO`). Gradient
 * tokens match the original web design exactly so brand colours stay
 * consistent across web / mobile.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAuthStore } from '@/store/authStore';
import type { CardEntity } from '@/types';

/* ─── Tier design tokens — mirror CardStack.tsx ────────────────── */
type TierKey = CardEntity['tier']; // 'STARTER' | 'MASTER' | 'PRO'

interface TierTheme {
  label: string;
  gradient: readonly [string, string, string];
  text: string;
  muted: string;
  visa: string;
  /** Pro uses a soft blue accent for the PRO sub-mark; others inherit. */
  brandAccent?: string;
}

// Mono tier ramps — same hue family for all three tiers (warm graphite
// → obsidian) so the only thing that distinguishes them is depth, not
// colour. No periwinkle, no blue. STARTER is the lightest; MASTER is
// the deepest. Foreground is always near-white because the cards are
// always dark — light-mode card stock makes the chip metallics look
// muddy in user testing.
const TIER: Record<TierKey, TierTheme> = {
  STARTER: {
    label: 'Starter',
    gradient: ['#3A3A3D', '#26262A', '#1A1A1D'],
    text: '#FAFAFA',
    muted: 'rgba(250,250,250,0.62)',
    visa: 'rgba(250,250,250,0.82)',
  },
  MASTER: {
    label: 'Master',
    gradient: ['#26262A', '#16161A', '#0A0A0B'],
    text: '#FAFAFA',
    muted: 'rgba(250,250,250,0.58)',
    visa: 'rgba(250,250,250,0.85)',
  },
  PRO: {
    label: 'Pro',
    gradient: ['#1A1A1D', '#0E0E11', '#040405'],
    text: '#FAFAFA',
    muted: 'rgba(250,250,250,0.52)',
    visa: 'rgba(250,250,250,0.88)',
  },
};

/* ─── Number / CVV synthesis (demo only, never real PAN) ─────────── */
function deriveFullNumber(card: CardEntity): string {
  const seed = card.id.replace(/[^0-9]/g, '0').padEnd(12, '4');
  return [
    seed.slice(0, 4) || '4242',
    seed.slice(4, 8) || '4242',
    seed.slice(8, 12) || '4242',
    card.last4,
  ].join(' ');
}

function deriveCvv(card: CardEntity): string {
  let h = 0;
  for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return String(100 + (h % 900));
}

/* ─── Contactless glyph ─────────────────────────────────────────── */
function ContactlessIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M7 12c0-2.76 2.24-5 5-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Path d="M5 12c0-3.87 3.13-7 7-7" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.6} />
      <Path d="M3 12C3 6.48 7.03 2 12 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.3} />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
    </Svg>
  );
}

/* ─── Chip ─────────────────────────────────────────────────────── */
function Chip() {
  return (
    <LinearGradient
      colors={['#d4c9a8', '#b8a870', '#c8bc94', '#a89858']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{
        width: 36, height: 28, borderRadius: 5,
        // inner contact-rectangle
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <View style={{
        width: 12, height: 16, borderRadius: 2,
        borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)',
      }} />
    </LinearGradient>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */
export function CardVisual({ card }: { card: CardEntity }) {
  const theme = TIER[card.tier] ?? TIER.STARTER;
  const user  = useAuthStore((s) => s.user);
  // Authoritative cardholder name — derived from the signed-in user,
  // not from card.cardHolder. Backfills onto legacy mock cards (e.g.
  // the "RAYAN ZAHI" demo seed) so cards always read the real user.
  const liveHolder =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim().toUpperCase()
    || card.cardHolder
    || 'CARD HOLDER';
  const cardForRender = { ...card, cardHolder: liveHolder };
  const [revealed, setRevealed] = useState(false);
  const [flipped, setFlipped] = useState(false);

  // Auto-hide sensitive fields after 30s.
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(false), 30_000);
    return () => clearTimeout(t);
  }, [revealed]);

  // Flip animation: 0 -> 180deg interpolated rotateY.
  const flipAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: flipped ? 1 : 0,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [flipped, flipAnim]);

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  // Hide the off-side via opacity gates that flip exactly at the midpoint
  // (RN doesn't honour CSS `backface-visibility` reliably on Android).
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });

  const requestReveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Reveal card details',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setRevealed(true);
      } else {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware || !enrolled) {
          Alert.alert(
            'Authentication required',
            'Set up Face ID, Touch ID, or a device passcode to view sensitive card details.',
          );
        }
      }
    } catch (e: any) {
      Alert.alert('Authentication error', e?.message ?? 'Try again.');
    }
  };

  const fullNumber = deriveFullNumber(card);
  const cvv = deriveCvv(card);
  const maskedNumber = `•••• •••• •••• ${card.last4}`;
  const maskedCvv = '•••';
  const expiry = `${String(card.expiryMonth).padStart(2, '0')} / ${String(card.expiryYear).slice(-2)}`;
  const isFrozen = card.status === 'FROZEN' || card.frozen;

  return (
    <View style={{ width: '100%', aspectRatio: 1.586 }}>
      {/* Tap anywhere on the card to flip. */}
      <Pressable onPress={() => setFlipped((f) => !f)} style={{ flex: 1 }}>
        {/* FRONT */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            opacity: frontOpacity,
            transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
          }}
        >
          <CardFace gradient={theme.gradient}>
            <CardFront card={cardForRender} theme={theme} revealed={revealed} maskedNumber={maskedNumber} fullNumber={fullNumber} expiry={expiry} isFrozen={isFrozen} />
          </CardFace>
        </Animated.View>

        {/* BACK */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            opacity: backOpacity,
            transform: [{ perspective: 1200 }, { rotateY: backRotate }],
          }}
        >
          <CardFace gradient={theme.gradient}>
            <CardBack theme={theme} revealed={revealed} cvv={cvv} maskedCvv={maskedCvv} />
          </CardFace>
        </Animated.View>
      </Pressable>

      {/* Reveal toggle — moved to a small pill at TOP-LEFT so it can
          never overlap the brand mark that now sits in the top-right
          corner (per the monochrome redesign). Eats taps so they
          don't trigger the card flip. */}
      <Pressable
        onPress={requestReveal}
        accessibilityLabel={revealed ? 'Hide card details' : 'Reveal card details'}
        style={({ pressed }) => ({
          position: 'absolute', top: 14, left: 14,
          height: 26, paddingHorizontal: 9,
          borderRadius: 13,
          backgroundColor: pressed ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.10)',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
          flexDirection: 'row', gap: 4,
        })}
      >
        <Ionicons name={revealed ? 'eye-off' : 'eye'} size={11} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>
          {revealed ? 'HIDE' : 'REVEAL'}
        </Text>
      </Pressable>
    </View>
  );
}

/* ─── Face wrapper (gradient + soft elevation) ─────────────────── */
function CardFace({
  children, gradient,
}: {
  children: React.ReactNode;
  gradient: readonly [string, string, string];
}) {
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{
        flex: 1, borderRadius: 18, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 12 },
        elevation: 8,
      }}
    >
      {/* Diagonal shimmer overlay (matches CSS ::after) */}
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
        start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />
      {children}
    </LinearGradient>
  );
}

/* ─── Front content ─────────────────────────────────────────────── */
function CardFront({
  card, theme, revealed, maskedNumber, fullNumber, expiry, isFrozen,
}: {
  card: CardEntity;
  theme: TierTheme;
  revealed: boolean;
  maskedNumber: string;
  fullNumber: string;
  expiry: string;
  isFrozen: boolean;
}) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 16 }}>
      {/* Top row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Left side intentionally empty — the eye-toggle pill in the
            parent now occupies this slot. Tier label moves to the row
            above the cardholder name (bottom) so it doesn't compete
            with the brand mark for top-row attention. */}
        <View />

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {isFrozen && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}>
              <Ionicons name="snow" size={10} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>FROZEN</Text>
            </View>
          )}
          {/* tazdan mark — icon-white on every tier because the
              monochrome cards are always dark. Placed in the upper
              right corner per the design spec. */}
          <Image
            source={require('../../../assets/icon-white.png')}
            style={{ width: 26, height: 26, opacity: 0.95 }}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Chip + contactless cluster, pushed to the lower half. */}
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Chip />
          <ContactlessIcon color={theme.text} />
          <View style={{ flex: 1 }} />
          <Text style={{
            color: theme.muted, fontSize: 9, fontWeight: '700',
            letterSpacing: 1.6, textTransform: 'uppercase',
          }}>
            {theme.label}
          </Text>
        </View>
        <Text style={{
          color: theme.text, fontSize: 16, fontWeight: '600',
          letterSpacing: 2.4, fontVariant: ['tabular-nums'],
          opacity: 0.94,
          textShadowColor: 'rgba(0,0,0,0.35)',
          textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
        }}>
          {revealed ? fullNumber : maskedNumber}
        </Text>

        {/* Bottom row: holder + expiry + visa */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
          <View>
            <Text style={{ color: theme.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Card Holder
            </Text>
            <Text style={{ color: theme.text, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 2 }}>
              {card.cardHolder}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Expires
            </Text>
            <Text style={{
              color: theme.text, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 2,
              fontVariant: ['tabular-nums'],
            }}>
              {revealed ? expiry : '•• / ••'}
            </Text>
          </View>
          <Text style={{
            color: theme.visa, fontSize: 22, fontWeight: '600',
            fontStyle: 'italic', letterSpacing: -1,
          }}>
            VISA
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Back content ─────────────────────────────────────────────── */
function CardBack({
  theme, revealed, cvv, maskedCvv,
}: {
  theme: TierTheme;
  revealed: boolean;
  cvv: string;
  maskedCvv: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      {/* Magstripe */}
      <View style={{
        marginTop: '14%',
        height: '22%',
        backgroundColor: '#1a1a1a',
      }} />

      {/* Signature + CVV */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 18, paddingTop: 14,
      }}>
        <View style={{
          flex: 1, height: 28, borderRadius: 3,
          backgroundColor: '#f0f0f0',
        }} />
        <View style={{
          backgroundColor: '#fff', borderRadius: 3,
          paddingHorizontal: 10, paddingVertical: 5,
          minWidth: 50, alignItems: 'center',
        }}>
          <Text style={{
            color: '#111', fontSize: 12, fontWeight: '700',
            letterSpacing: 3, fontVariant: ['tabular-nums'],
          }}>
            {revealed ? cvv : maskedCvv}
          </Text>
        </View>
      </View>

      {/* VISA */}
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 14 }}>
        <Text style={{
          color: theme.visa, fontSize: 20, fontWeight: '600',
          fontStyle: 'italic', letterSpacing: -1,
        }}>
          VISA
        </Text>
      </View>
    </View>
  );
}
