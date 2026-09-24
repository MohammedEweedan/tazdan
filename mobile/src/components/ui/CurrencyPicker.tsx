/**
 * CurrencyPicker — one swipeable field that holds every currency the user can
 * pick. Swipe left/right to cycle through holdings, or tap to open a list with
 * balances. No fiat/crypto toggle — all holdings live in this one control.
 *
 * The parent owns the selected `value` and renders the balance under the
 * amount input separately (as the Send screen already does).
 */
import { memo, useRef, useState } from 'react';
import { View, Pressable, PanResponder, Modal, ScrollView } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { useHaptics } from '@/hooks';
import type { Palette } from '@/store/themeStore';

import { BottomSheet } from '@/components/ui/BottomSheet';
export interface CurrencyItem {
  id?: string;        // stable selection id; defaults to currency
  currency: string;
  balance: number;
  label: string;
  icon: string;     // glyph used for fiat ($, €, ₮…) and the card label
  color: string;
  bg: string;
  isFiat?: boolean; // crypto → real coin logo; fiat → the symbol glyph
  kind?: 'fiat' | 'crypto' | 'card';
  displayCode?: string;
  showBalance?: boolean;
}

/**
 * Glyph rendering — NO background colour circles:
 *   • fiat  → the currency symbol in the theme foreground (black in light,
 *             white in dark)
 *   • crypto→ the real coin logo (its own brand colours)
 *   • card  → a card icon in the theme foreground
 */
function CurrencyGlyph({ item, size, palette: p }: { item: CurrencyItem; size: number; palette: Palette }) {
  const kind = item.kind ?? (item.isFiat ? 'fiat' : 'crypto');
  if (kind === 'card') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="card" size={size * 0.72} color={p.fg} />
      </View>
    );
  }
  if (kind === 'fiat') {
    // Currency symbol in theme foreground (black on light, white on dark),
    // sized to fill the glyph box like a coin logo would.
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: p.fg, fontSize: size * 0.66, fontWeight: '700', lineHeight: size }}
        >
          {item.icon}
        </Text>
      </View>
    );
  }
  return <CoinIcon symbol={item.currency} size={size} color={item.color} />;
}

export const CurrencyPicker = memo(function CurrencyPicker({
  items,
  value,
  onChange,
  palette: p,
  fmtBalance = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 8 }),
}: {
  items: CurrencyItem[];
  value: string;
  onChange: (currency: string) => void;
  palette: Palette;
  fmtBalance?: (n: number) => string;
}) {
  const h = useHaptics();
  const [listOpen, setListOpen] = useState(false);

  const itemId = (it: CurrencyItem) => it.id ?? it.currency;
  const idx = Math.max(0, items.findIndex((it) => itemId(it) === value));
  const current = items[idx] ?? items[0];

  const cycle = (dir: 1 | -1) => {
    if (items.length < 2) return;
    h.selection();
    const next = (idx + dir + items.length) % items.length;
    onChange(itemId(items[next]));
  };

  // Horizontal swipe to cycle. Captures only clearly-horizontal drags so it
  // never steals vertical scroll from the parent.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -28) cycle(1);      // swipe left → next
        else if (g.dx >= 28) cycle(-1); // swipe right → previous
      },
    }),
  ).current;

  if (!current) return null;

  return (
    <>
      <View
        {...pan.panHandlers}
        style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.pillBg, borderRadius: 14,
          paddingHorizontal: 6, paddingVertical: 7,
        }}
      >
        {/* prev */}
        <Pressable onPress={() => cycle(-1)} hitSlop={10} disabled={items.length < 2}
          style={{ padding: 6, opacity: items.length < 2 ? 0.2 : 0.5 }}>
          <Ionicons name="chevron-back" size={16} color={p.fg} />
        </Pressable>

        {/* current — tap to open the full list */}
        <Pressable
          onPress={() => { h.selection(); setListOpen(true); }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 2 }}
        >
          <CurrencyGlyph item={current} size={26} palette={p} />
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }} numberOfLines={1}>
            {current.displayCode ?? current.currency}
          </Text>
          <Ionicons name="chevron-down" size={13} color={p.fgMuted} />
        </Pressable>

        {/* next */}
        <Pressable onPress={() => cycle(1)} hitSlop={10} disabled={items.length < 2}
          style={{ padding: 6, opacity: items.length < 2 ? 0.2 : 0.5 }}>
          <Ionicons name="chevron-forward" size={16} color={p.fg} />
        </Pressable>
      </View>

      {/* Full list with balances */}
      <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {items.map((it) => {
                const key = itemId(it);
                const sel = key === value;
                return (
                  <Pressable
                    key={key}
                    onPress={() => { h.selection(); onChange(key); setListOpen(false); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 13, borderRadius: 16, marginBottom: 8,
                      borderWidth: 1.5, borderColor: sel ? it.color : p.border,
                      backgroundColor: sel ? `${it.color}14` : p.bgElev,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <CurrencyGlyph item={it} size={40} palette={p} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{it.displayCode ?? it.currency}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{it.label}</Text>
                    </View>
                    {it.showBalance !== false && (
                      <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {fmtBalance(it.balance)}
                      </Text>
                    )}
                    {sel && <Ionicons name="checkmark-circle" size={20} color={it.color} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </BottomSheet>
    </>
  );
});
