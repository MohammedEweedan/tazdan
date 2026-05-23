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
import { View } from 'react-native';
import { Text } from './Text';

interface IconCfg {
  color: string;
  glyph: string;
  logoUrl?: string;
  fiat?: boolean;
  glyphSize?: number;
}

const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const COIN_CFG: Record<string, IconCfg> = {
  BTC:        { color: '#f7931a', glyph: '₿',  logoUrl: `${TW}/bitcoin/info/logo.png` },
  ETH:        { color: '#627eea', glyph: 'Ξ',  logoUrl: `${TW}/ethereum/info/logo.png` },
  USDT:       { color: '#26a17b', glyph: '₮',  logoUrl: `${TW}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png` },
  USDT_ERC20: { color: '#26a17b', glyph: '₮',  logoUrl: `${TW}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png` },
  USDT_TRC20: { color: '#26a17b', glyph: '₮',  logoUrl: `${TW}/tron/assets/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/logo.png` },
  USDC:       { color: '#2775ca', glyph: 'U',  logoUrl: `${TW}/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png` },
  SOL:        { color: '#9945ff', glyph: 'S',  logoUrl: `${TW}/solana/info/logo.png` },
  BNB:        { color: '#f3ba2f', glyph: 'B',  logoUrl: `${TW}/binance/info/logo.png` },
  XRP:        { color: '#346aa9', glyph: 'X',  logoUrl: `${TW}/ripple/info/logo.png` },
  ADA:        { color: '#0033ad', glyph: '₳',  logoUrl: `${TW}/cardano/info/logo.png` },
  DOGE:       { color: '#c3a634', glyph: 'Ð',  logoUrl: `${TW}/doge/info/logo.png` },
  MATIC:      { color: '#8247e5', glyph: 'M',  logoUrl: `${TW}/polygon/info/logo.png` },
  DOT:        { color: '#e6007a', glyph: '●',  logoUrl: `${TW}/polkadot/info/logo.png` },
  AVAX:       { color: '#e84142', glyph: 'A',  logoUrl: `${TW}/avalanchec/info/logo.png` },
  LTC:        { color: '#bfbbbb', glyph: 'Ł',  logoUrl: `${TW}/litecoin/info/logo.png` },
  LINK:       { color: '#2a5ada', glyph: 'L',  logoUrl: `${TW}/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png` },
  UNI:        { color: '#ff007a', glyph: 'U',  logoUrl: `${TW}/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png` },
  AAVE:       { color: '#b6509e', glyph: 'A',  logoUrl: `${TW}/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png` },
  ATOM:       { color: '#6f7590', glyph: '⚛',  logoUrl: `${TW}/cosmos/info/logo.png` },
  ALGO:       { color: '#6cc3a8', glyph: 'A',  logoUrl: `${TW}/algorand/info/logo.png` },
  NEAR:       { color: '#00c08b', glyph: 'N',  logoUrl: `${TW}/near/info/logo.png` },
  FTM:        { color: '#1969ff', glyph: 'F',  logoUrl: `${TW}/fantom/info/logo.png` },
  VET:        { color: '#15bdff', glyph: 'V',  logoUrl: `${TW}/vechain/info/logo.png` },
  TRX:        { color: '#ef0027', glyph: 'T',  logoUrl: `${TW}/tron/info/logo.png` },
  XLM:        { color: '#7d00ff', glyph: '✶',  logoUrl: `${TW}/stellar/info/logo.png` },
  FIL:        { color: '#0090ff', glyph: 'F',  logoUrl: `${TW}/filecoin/info/logo.png` },
  SHIB:       { color: '#e44d26', glyph: 'S',  logoUrl: `${TW}/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png` },
  PEPE:       { color: '#00a550', glyph: 'P',  logoUrl: `${TW}/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png` },
  WIF:        { color: '#9b4dca', glyph: 'W' },
  ARB:        { color: '#12aaff', glyph: 'A',  logoUrl: `${TW}/arbitrum/info/logo.png` },
  OP:         { color: '#ff0420', glyph: 'O',  logoUrl: `${TW}/optimism/info/logo.png` },
  SUI:        { color: '#4da2ff', glyph: 'S',  logoUrl: `${TW}/sui/info/logo.png` },
  APT:        { color: '#00d4aa', glyph: 'A',  logoUrl: `${TW}/aptos/info/logo.png` },
  INJ:        { color: '#00b0ff', glyph: 'I' },
  SEI:        { color: '#9d4edd', glyph: 'S' },
  TON:        { color: '#0098ea', glyph: 'T',  logoUrl: `${TW}/ton/info/logo.png` },
  USD: { color: '#5b8cff', glyph: '🇺🇸', fiat: true, glyphSize: 26 },
  EUR: { color: '#5b8cff', glyph: '🇪🇺', fiat: true, glyphSize: 26 },
  GBP: { color: '#5b8cff', glyph: '🇬🇧', fiat: true, glyphSize: 26 },
  AED: { color: '#5b8cff', glyph: '🇦🇪', fiat: true, glyphSize: 26 },
  SAR: { color: '#5b8cff', glyph: '🇸🇦', fiat: true, glyphSize: 26 },
  EGP: { color: '#5b8cff', glyph: '🇪🇬', fiat: true, glyphSize: 26 },
  LYD: { color: '#5b8cff', glyph: '🇱🇾', fiat: true, glyphSize: 26 },
  CAD: { color: '#5b8cff', glyph: '🇨🇦', fiat: true, glyphSize: 26 },
  AUD: { color: '#5b8cff', glyph: '🇦🇺', fiat: true, glyphSize: 26 },
  CHF: { color: '#5b8cff', glyph: '🇨🇭', fiat: true, glyphSize: 26 },
  JPY: { color: '#5b8cff', glyph: '🇯🇵', fiat: true, glyphSize: 26 },
  CNY: { color: '#5b8cff', glyph: '🇨🇳', fiat: true, glyphSize: 26 },
};

function symbolColor(sym: string): string {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 60%, 55%)`;
}

function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('rgb') || hex.startsWith('hsl')) return hex;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Props {
  currency: string;
  size?: number;
}

export function CoinLogo({ currency, size = 44 }: Props) {
  const cfg = COIN_CFG[currency] ?? {
    color: symbolColor(currency),
    glyph: currency.slice(0, 3),
  };
  const discColor = withAlpha(cfg.color, 0.14);
  const logoInset = Math.round(size * 0.16);
  const logoSize = size - logoInset * 2;

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: discColor,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <Text style={{
        color: cfg.fiat ? '#fff' : cfg.color,
        fontWeight: '700',
        fontSize: cfg.glyphSize ?? Math.round(size * 0.5),
        lineHeight: (cfg.glyphSize ?? Math.round(size * 0.5)) + 4,
      }}>
        {cfg.glyph}
      </Text>

      {!cfg.fiat && cfg.logoUrl && (
        <Image
          source={{ uri: cfg.logoUrl }}
          style={{
            position: 'absolute',
            top: logoInset, left: logoInset,
            width: logoSize, height: logoSize,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={220}
        />
      )}
    </View>
  );
}
