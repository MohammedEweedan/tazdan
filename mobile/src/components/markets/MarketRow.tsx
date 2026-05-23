/**
 * Market list row used on the home screen "Markets preview" and (later) the
 * full markets screen. Coin icon + name → price + 24h % → sparkline.
 */

import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Sparkline } from '@/components/ui/Sparkline';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { CURRENCY_META } from '@/constants';
import { formatPercent } from '@/utils/format';
import type { MarketTicker } from '@/types';

interface Props { ticker: MarketTicker; onPress?: () => void }

export function MarketRow({ ticker, onPress }: Props) {
  const meta = (CURRENCY_META as Record<string, typeof CURRENCY_META[keyof typeof CURRENCY_META] | undefined>)[ticker.base];
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
      <CoinIcon symbol={ticker.base} size={38} />

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
