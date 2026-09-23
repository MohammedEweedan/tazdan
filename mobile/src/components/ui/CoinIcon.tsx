/**
 * CoinIcon — displays a real coin logo inside a coloured circle.
 *
 * Uses useCoinIcons() which cascades through sources:
 *   1. Server markets/icons map
 *   2. Client-side CoinGecko search cache
 *   3. CoinCap CDN  (~2,000 coins)
 *   4. jsDelivr      (~800 coins)
 *
 * Usage:
 *   <CoinIcon symbol="BTC" size={44} />
 *   <CoinIcon symbol="BTCUSDT" size={32} />   ← strips Binance quote suffix
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { Text } from './Text';
import { useTheme, useThemedPalette } from '@/store/themeStore';
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
  // Coin-specific brand colors are kept (BTC orange, ETH purple) because
  // they're identity markers, not app chrome. Fallback for unknown coins
  // is neutral gray, not the old app brand blue.
  return COIN_COLOR[sym] ?? '#737373';
}

interface Props {
  symbol: string;
  size?: number;
  /** Optional override for the background circle colour. Kept for API compat; ignored visually. */
  color?: string;
}

const LOCAL_ICONS: Record<string, ImageSourcePropType> = {
  BTC: require('../../../assets/coins/btc.png'),
  ETH: require('../../../assets/coins/eth.png'),
  USDT: require('../../../assets/coins/usdt.png'),
  SOL: require('../../../assets/coins/sol.png'),
  BNB: require('../../../assets/coins/bnb.png'),
  XRP: require('../../../assets/coins/xrp.png'),
  ADA: require('../../../assets/coins/ada.png'),
  LINK: require('../../../assets/coins/link.png'),
  LTC: require('../../../assets/coins/ltc.png'),
  USDC: require('../../../assets/coins/usdc.png'),
  DOGE: require('../../../assets/coins/doge.png'),
  DOT: require('../../../assets/coins/dot.png'),
};

const MONO_ICONS: Record<string, ImageSourcePropType> = {
  BTC: require('../../../assets/coins/btc-mono.png'),
  ETH: require('../../../assets/coins/eth-mono.png'),
  USDT: require('../../../assets/coins/usdt-mono.png'),
  SOL: require('../../../assets/coins/sol-mono.png'),
  BNB: require('../../../assets/coins/bnb-mono.png'),
  XRP: require('../../../assets/coins/xrp-mono.png'),
  ADA: require('../../../assets/coins/ada-mono.png'),
  LINK: require('../../../assets/coins/link-mono.png'),
  LTC: require('../../../assets/coins/ltc-mono.png'),
  USDC: require('../../../assets/coins/usdc-mono.png'),
  DOGE: require('../../../assets/coins/doge-mono.png'),
  DOT: require('../../../assets/coins/dot-mono.png'),
};

export function CoinIcon({ symbol, size = 40, color }: Props) {
  const sym = normalise(symbol);
  const local = LOCAL_ICONS[sym];
  const mono = useTheme((s) => s.mode === 'mono');
  const p = useThemedPalette();
  if (local) return <Image source={mono ? MONO_ICONS[sym] : local} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={sym} />;
  return <RemoteCoinIcon symbol={sym} size={size} color={mono ? p.fg : color} mono={mono} />;
}

function RemoteCoinIcon({ symbol: sym, size = 40, color, mono }: Props & { mono: boolean }) {
  const getIconUrl = useCoinIcons();
  const uri = getIconUrl(sym);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  const source = useMemo(() => ({ uri }), [uri]);
  if (failed || !uri) return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${coinColor(sym)}18`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: color ?? coinColor(sym), fontSize: size * 0.38, fontWeight: '600' }}>{sym.slice(0, 2)}</Text>
    </View>
  );
  return <Image source={source} style={{ width: size, height: size, tintColor: mono ? color : undefined }} resizeMode="contain" onError={() => setFailed(true)} accessibilityLabel={sym} />;
}
