/**
 * FeeBreakdown — itemised cost panel used on every money-moving screen:
 * topup, withdraw, send, swap, p2p, card topup. Always renders the
 * same columns in the same order so the user reads "fee" the same
 * way everywhere.
 *
 *   <FeeBreakdown
 *     rows={[
 *       { label: 'Amount',        amount: 100,  currency: 'USD' },
 *       { label: 'Processing fee', amount: 2.9,  currency: 'USD', muted: true },
 *       { label: 'Network fee',    amount: 0.5,  currency: 'USD', muted: true },
 *     ]}
 *     total={{ label: 'You pay', amount: 103.4, currency: 'USD' }}
 *     youReceive={{ amount: 0.00149, currency: 'BTC' }}
 *   />
 *
 * Any "muted" row renders in fgMuted so the headline (amount + total)
 * dominates. The optional `youReceive` row is split below a divider
 * — visually distinct from the cost stack.
 */
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { formatMoney } from '@/utils/format';
import type { Currency } from '@/types';

export interface FeeRow {
  label: string;
  amount: number | string;
  currency: Currency;
  /** Render dimmer than the headline rows. Use for fees/spread. */
  muted?: boolean;
  /** Optional hint text under the label (e.g. "1.5% spread"). */
  hint?: string;
}

interface Props {
  rows: FeeRow[];
  total?: FeeRow;
  youReceive?: Omit<FeeRow, 'label' | 'muted'>;
  /** Compact vertical layout for cramped contexts. */
  compact?: boolean;
}

export function FeeBreakdown({ rows, total, youReceive, compact = false }: Props) {
  const p = useThemedPalette();
  const padV = compact ? 7 : 10;
  const padH = compact ? 12 : 14;

  return (
    <View
      style={{
        backgroundColor: p.bgElev,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.border,
        overflow: 'hidden',
      }}
    >
      {rows.map((r, i) => (
        <Row
          key={`${r.label}-${i}`}
          row={r}
          padH={padH}
          padV={padV}
          divider={i < rows.length - 1 || total !== undefined || youReceive !== undefined}
          dividerColor={p.divider}
          fg={r.muted ? p.fgMuted : p.fg}
          hintColor={p.fgFaint}
        />
      ))}

      {total && (
        <Row
          row={{ ...total, muted: false }}
          padH={padH}
          padV={padV + 2}
          divider={youReceive !== undefined}
          dividerColor={p.divider}
          fg={p.fg}
          bold
          background={p.bgRaised}
          hintColor={p.fgFaint}
        />
      )}

      {youReceive && (
        <Row
          row={{
            label: 'You receive',
            amount: youReceive.amount,
            currency: youReceive.currency,
            hint: youReceive.hint,
          }}
          padH={padH}
          padV={padV + 2}
          divider={false}
          dividerColor={p.divider}
          fg={p.greenFg}
          bold
          background={p.greenBg}
          hintColor={p.fgFaint}
        />
      )}
    </View>
  );
}

function Row({
  row, padH, padV, divider, dividerColor, fg, hintColor, bold = false, background,
}: {
  row: FeeRow;
  padH: number; padV: number;
  divider: boolean;
  dividerColor: string;
  fg: string;
  hintColor: string;
  bold?: boolean;
  background?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: padH,
        paddingVertical: padV,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: dividerColor,
        backgroundColor: background,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: fg, fontSize: 13, fontWeight: bold ? '800' : '600' }}>
          {row.label}
        </Text>
        {row.hint && (
          <Text style={{ color: hintColor, fontSize: 11, fontWeight: '500', marginTop: 2 }}>
            {row.hint}
          </Text>
        )}
      </View>
      <Text
        style={{
          color: fg, fontSize: 13.5, fontWeight: bold ? '800' : '600',
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatMoney(row.amount, row.currency, { showSymbol: true })}
      </Text>
    </View>
  );
}
