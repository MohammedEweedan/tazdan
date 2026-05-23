/**
 * CoinIcon — displays a real coin logo inside a coloured circle.
 *
 * Uses useCoinIcons() which cascades through sources:
 *   1. Server /api/markets/icons map
 *   2. Client-side CoinGecko search cache
 *   3. CoinCap CDN  (~2,000 coins)
 *   4. jsDelivr      (~800 coins)
 *
 * Usage:
 *   <CoinIcon symbol="BTC" size={44} />
 *   <CoinIcon symbol="BTCUSDT" size={32} />   ← strips Binance quote suffix
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useCoinIcons } from '@/hooks/useCoinIcons';

// Strip Binance pair suffixes and variant suffixes so BTCUSDT → btc, ETH_ERC20 → eth
function normalise(symbol: string): string {
  let s = symbol.toUpperCase();
  s = s.replace(/_.*$/, '');     // ETH_ERC20 → ETH
  s = s.replace(/(?<!^)USDT$/, ''); // BTCUSDT → BTC, USDT stays USDT
  s = s.replace(/(?<!^)USDC$/, ''); // ETHUSDC → ETH, USDC stays USDC
  s = s.replace(/BTC$/, (m, i) => (i > 0 ? '' : m)); // only strip trailing BTC when it's a quote
  return s || symbol.toUpperCase().split(/USDT|USDC/)[0];
}

const COIN_COLOR: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff', USDT: '#26a17b',
  BNB: '#f3ba2f', XRP: '#346aa9', ADA: '#0033ad', DOGE: '#c3a634',
  AVAX: '#e84142', DOT: '#e6007a', MATIC: '#8247e5', LINK: '#2a5ada',
  UNI: '#ff007a', LTC: '#bfbbbb', ATOM: '#6f7590', TRX: '#ef0027',
  NEAR: '#00c08b', FIL: '#0090ff', ALGO: '#6cc3a8', VET: '#15bdff',
  XLM: '#7d00ff', AAVE: '#b6509e', ARB: '#12aaff', OP: '#ff0420',
  SUI: '#4da2ff', SHIB: '#e44d26', PEPE: '#00a550',
};

function coinColor(sym: string): string {
  return COIN_COLOR[sym] ?? '#226dff';
}

interface Props {
  symbol: string;
  size?: number;
  /** Optional override for the background circle colour. Kept for API compat; ignored visually. */
  color?: string;
}

export function CoinIcon({ symbol, size = 40, color }: Props) {
  const getIconUrl = useCoinIcons();
  const sym = normalise(symbol);
  const uri = getIconUrl(sym);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [uri]);

  const source = useMemo(() => ({ uri }), [uri]);

  if (failed) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: color ?? coinColor(sym), fontSize: size * 0.45, fontWeight: '800' }}>
          {sym[0] ?? '?'}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}
