/**
 * Premium wallet card. Pageable horizontal slider on the home dashboard.
 * Each card has its own gradient colorway from `theme.gradients.cards`.
 * Includes a sparkline for crypto currencies and a balance summary.
 */

import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, shadows } from '@/theme';
import { getCurrencyMeta } from '@/constants';
import { formatAmount, formatPercent } from '@/utils/format';
import { Sparkline } from '@/components/ui/Sparkline';
import type { Wallet } from '@/types';

interface Props {
  wallet: Wallet;
  width: number;
  height?: number;
  onPress?: () => void;
  sparkline?: number[];
}

const colorwayFor = (i: number): keyof typeof gradients.cards => {
  const keys = Object.keys(gradients.cards) as Array<keyof typeof gradients.cards>;
  return keys[i % keys.length];
};

export function WalletCard({ wallet, width, height = 200, onPress, sparkline }: Props) {
  const meta = getCurrencyMeta(wallet.currency);
  const grad = gradients.cards[colorwayFor(wallet.currency.charCodeAt(0))];
  const positive = (wallet.changePct24h ?? 0) >= 0;
  const icon = meta?.flagOrIcon ?? wallet.currency.slice(0, 1);
  const code = meta?.code ?? wallet.currency;
  const name = meta?.name ?? wallet.currency;

  return (
    <Pressable onPress={onPress} style={{ width, marginRight: 14 }}>
      <View style={{ ...shadows.card, borderRadius: 24 }}>
        <LinearGradient
          colors={[...grad]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 20, height, overflow: 'hidden' }}
        >
          {/* Inner sheen */}
          <LinearGradient
            colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }}
            pointerEvents="none"
          />

          {/* Top row */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{icon}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>
                {code} · {name.toUpperCase()}
              </Text>
            </View>
            {meta?.kind === 'crypto' && wallet.changePct24h != null && (
              <View
                style={{
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: positive ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
                }}
              >
                <Text style={{ color: positive ? '#22c55e' : '#ef4444', fontSize: 11, fontWeight: '700' }}>
                  {formatPercent(wallet.changePct24h, { signed: true })}
                </Text>
              </View>
            )}
          </View>

          {/* Balance */}
          <View style={{ marginTop: 'auto' }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '500', letterSpacing: 0.5 }}>
              BALANCE
            </Text>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 28, letterSpacing: -0.6, marginTop: 2 }}>
              {formatAmount(wallet.balance, wallet.currency, { showSymbol: true })}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500', marginTop: 2 }}>
              ≈ ${formatAmount(wallet.fiatValueUsd, 'USD')}
            </Text>
          </View>

          {/* Sparkline */}
          {sparkline && (
            <View style={{ position: 'absolute', right: 16, bottom: 16, opacity: 0.55 }}>
              <Sparkline data={sparkline} width={90} height={28} color="#ffffff" />
            </View>
          )}
        </LinearGradient>
      </View>
    </Pressable>
  );
}
