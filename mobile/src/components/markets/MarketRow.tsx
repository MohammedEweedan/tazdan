/**
 * Market list row used on the home screen "Markets preview" and (later) the
 * full markets screen. Coin icon + name → price + 24h % → sparkline.
 */

import { Pressable, Text, View } from 'react-native';
import { Sparkline } from '@/components/ui/Sparkline';
import { CURRENCY_META } from '@/constants';
import { formatPercent } from '@/utils/format';
import type { MarketTicker } from '@/types';

interface Props { ticker: MarketTicker; onPress?: () => void }

export function MarketRow({ ticker, onPress }: Props) {
  const meta = CURRENCY_META[ticker.base];
  const positive = ticker.changePct24h >= 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: 'rgba(255,255,255,0.06)',
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{meta.flagOrIcon}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text className="text-ink-primary text-sm font-semibold">{ticker.displayName}</Text>
        <Text className="text-ink-tertiary text-xs mt-0.5">{ticker.base} / {ticker.quote}</Text>
      </View>

      <Sparkline data={ticker.sparkline} width={64} height={22} color={positive ? '#22c55e' : '#ef4444'} />

      <View style={{ alignItems: 'flex-end', marginLeft: 12, minWidth: 86 }}>
        <Text className="text-ink-primary text-sm font-bold" style={{ fontVariant: ['tabular-nums'] }}>
          ${ticker.price.toLocaleString('en-US', { maximumFractionDigits: ticker.price < 1 ? 4 : 2 })}
        </Text>
        <Text
          className="text-xs font-bold mt-0.5"
          style={{ color: positive ? '#22c55e' : '#ef4444' }}
        >
          {formatPercent(ticker.changePct24h, { signed: true })}
        </Text>
      </View>
    </Pressable>
  );
}
