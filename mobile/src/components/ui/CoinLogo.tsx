/**
 * CoinLogo — premium currency chip.
 *
 * Renders a round, tinted disc with the real coin logo on top (via
 * Trust Wallet's public asset registry). The tinted disc shows
 * instantly so there's no white flash while the remote PNG loads,
 * and stays underneath so transparent logos still look intentional.
 *
 * Fiat is rendered as the flag emoji on the tinted disc.
 *
 * Unknown tickers fall back to a soft brand disc with the glyph
 * derived from the ticker symbol.
 */

import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { useCoinIcons } from '@/hooks/useCoinIcons';
import { getCurrencyMeta } from '@/constants';

interface Props {
  currency: string;
  size?: number;
}

export function CoinLogo({ currency, size = 44 }: Props) {
  const getIconUrl = useCoinIcons();
  const meta = getCurrencyMeta(currency);
  const isCrypto = meta?.kind === 'crypto';
  const iconUrl = isCrypto ? getIconUrl(currency) : null;

  if (!iconUrl) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.45, fontWeight: '800' }}>
          {meta?.flagOrIcon ?? currency.slice(0, 2)}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: iconUrl }}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={220}
    />
  );
}
