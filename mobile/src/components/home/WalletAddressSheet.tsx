/**
 * WalletAddressSheet — per-asset deposit / address bottom sheet.
 *
 * Surfaced from the info icon on each AssetRow. Shows the wallet
 * deposit address (for crypto) or bank reference (for fiat) with a
 * QR code, copy button, and clear "send only X on Y network" warning.
 *
 * Replaces the dedicated "Wallets" home tab — addresses are now
 * reachable in-context per asset.
 */

import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';

import { CoinLogo } from '@/components/ui/CoinLogo';
import { cryptoWalletAPI } from '@/lib/cryptoApi';
import { brand, type Palette, useTheme } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import type { Wallet } from '@/types';

const FIAT_SET = new Set(['USD','EUR','GBP','AED','SAR','EGP','LYD','CAD','AUD','CHF','JPY','CNY']);

const ASSET_TITLE: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', USDT_ERC20: 'Tether ERC20',
  USDT_TRC20: 'Tether TRC20', USDC: 'USD Coin', SOL: 'Solana', BNB: 'BNB',
  XRP: 'XRP', ADA: 'Cardano', DOGE: 'Dogecoin', MATIC: 'Polygon', DOT: 'Polkadot',
  AVAX: 'Avalanche', LTC: 'Litecoin', LINK: 'Chainlink', UNI: 'Uniswap',
  AAVE: 'Aave', ATOM: 'Cosmos', TRX: 'TRON', XLM: 'Stellar', ARB: 'Arbitrum',
  OP: 'Optimism', SUI: 'Sui', APT: 'Aptos', TON: 'Toncoin',
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', AED: 'UAE Dirham',
  SAR: 'Saudi Riyal', EGP: 'Egyptian Pound', LYD: 'Libyan Dinar',
};

const CHAIN_LABEL: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum (ERC-20)', USDT: 'Ethereum (ERC-20)',
  USDT_ERC20: 'Ethereum (ERC-20)', USDT_TRC20: 'Tron (TRC-20)',
  USDC: 'Ethereum (ERC-20)', SOL: 'Solana', BNB: 'BNB Smart Chain',
  XRP: 'XRP Ledger', ADA: 'Cardano', DOGE: 'Dogecoin Network',
  MATIC: 'Polygon', DOT: 'Polkadot', AVAX: 'Avalanche C-Chain',
  LTC: 'Litecoin', TRX: 'Tron', XLM: 'Stellar', ARB: 'Arbitrum One',
  OP: 'Optimism', TON: 'TON', SUI: 'Sui', APT: 'Aptos',
};

const DEPOSIT_ROUTE: Record<string, { asset: string; network: string }> = {
  BTC: { asset: 'BTC', network: 'BTC' },
  SOL: { asset: 'SOL', network: 'SOL' },
  ETH: { asset: 'ETH', network: 'ERC20' },
  USDT: { asset: 'USDT', network: 'ERC20' },
  USDT_ERC20: { asset: 'USDT', network: 'ERC20' },
  USDT_TRC20: { asset: 'USDT', network: 'TRC20' },
  TRX: { asset: 'TRX', network: 'TRON' },
  XRP: { asset: 'XRP', network: 'XRP' },
};

function depositRoute(currency: string): { asset: string; network: string } {
  return DEPOSIT_ROUTE[currency.toUpperCase()] ?? { asset: currency.toUpperCase(), network: 'ERC20' };
}

function useDepositAddress(currency: string, enabled: boolean) {
  const { asset, network } = depositRoute(currency);
  return useQuery({
    queryKey: ['deposit-address', asset, network],
    enabled,
    queryFn: async () => {
      const res = await cryptoWalletAPI.depositAddress(asset, network);
      return res.data.address;
    },
    staleTime: Infinity,
    retry: 1,
  });
}

interface Props {
  wallet: Wallet | null;
  palette: Palette;
  onClose: () => void;
}

export function WalletAddressSheet({ wallet, palette: p, onClose }: Props) {
  const t = useT();
  const h = useHaptics();
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;
  const [copied, setCopied] = useState(false);

  const isCrypto = wallet ? !FIAT_SET.has(wallet.currency) : false;
  const { data: serverAddr, isLoading } = useDepositAddress(wallet?.currency ?? '', !!wallet && isCrypto);

  if (!wallet) return null;

  const title = ASSET_TITLE[wallet.currency] ?? wallet.currency;
  const chain = CHAIN_LABEL[wallet.currency] ?? wallet.currency;
  const fiatRef = `PRMK-${wallet.currency}-${wallet.id.slice(0, 8).toUpperCase()}`;
  const address = isCrypto ? (serverAddr ?? '') : fiatRef;
  const addrReady = isCrypto ? !!serverAddr : true;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=12&data=${encodeURIComponent(address)}&bgcolor=ffffff&color=000000`;

  const onCopy = async () => {
    if (!addrReady) return;
    h.selection();
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal visible={!!wallet} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: p.bg,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingBottom: 32,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 8 }}>
            <CoinLogo currency={wallet.currency} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}>
                {isCrypto ? `${t('home.receiveAsset')} ${title}` : `${title} ${t('home.bankReference')}`}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                {isCrypto ? `${chain} ${t('home.network')}` : t('home.bankReference')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => ({
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: pressed ? p.border : p.bgElev,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            })}>
              <Ionicons name="close" size={16} color={p.fg} />
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', marginTop: 22, paddingHorizontal: 24 }}>
            <View style={{
              backgroundColor: '#ffffff',
              borderRadius: 24, padding: 16,
              shadowColor: accent,
              shadowOpacity: themeMode === 'dark' ? 0.22 : 0.12,
              shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
              elevation: 5,
            }}>
              {addrReady ? (
                <Image
                  source={{ uri: qrUrl }}
                  style={{ width: 220, height: 220, borderRadius: 8 }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={accent} />
                </View>
              )}
            </View>
          </View>

          <View style={{
            marginTop: 22, marginHorizontal: 24,
            paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
                {t('home.address').toUpperCase()}
              </Text>
              {isLoading && isCrypto ? (
                <ActivityIndicator size="small" color={p.fgMuted} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
              ) : (
                <Text
                  selectable
                  numberOfLines={2}
                  style={{
                    color: p.fg, fontSize: 12.5, fontWeight: '600',
                    fontFamily: 'Menlo' as any,
                    marginTop: 4, lineHeight: 18,
                  }}
                >
                  {address}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onCopy}
              hitSlop={6}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                backgroundColor: copied ? p.greenBg : (pressed ? `${accent}26` : `${accent}1A`),
                borderWidth: 1, borderColor: copied ? p.greenFg : `${accent}33`,
                flexDirection: 'row', alignItems: 'center', gap: 5,
              })}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copied ? p.greenFg : accent}
              />
              <Text style={{
                color: copied ? p.greenFg : accent,
                fontSize: 12, fontWeight: '700',
              }}>
                {copied ? 'Copied' : t('common.copy')}
              </Text>
            </Pressable>
          </View>

          {isCrypto && (
            <Text style={{
              color: p.fgFaint, fontSize: 11.5, fontWeight: '500',
              textAlign: 'center', marginTop: 16, paddingHorizontal: 36,
              lineHeight: 17,
            }}>
              {t('home.sendOnlyWarning', { currency: wallet.currency, chain })}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
