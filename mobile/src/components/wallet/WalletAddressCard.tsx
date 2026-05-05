/**
 * Per-chain deposit address card. QR data-URL comes from the server so
 * we don't bundle a QR generator in the app.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { cryptoWalletAPI } from '@/lib/cryptoApi';

interface Props {
  asset: 'ETH' | 'BTC' | 'SOL' | 'USDT';
  network: string;
  label?: string;
}

export function WalletAddressCard({ asset, network, label }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cryptoWalletAPI
      .depositAddress(asset, network)
      .then((res) => {
        if (cancelled) return;
        setAddress(res.data.address);
        setQr(res.data.qr);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.response?.data?.error || 'Failed to load address');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [asset, network]);

  async function copyAddress() {
    await Clipboard.setStringAsync(address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-neutral-900 dark:text-white">
          {label ?? `${asset} · ${network}`}
        </Text>
        <Text className="text-xs text-neutral-500">Deposit address</Text>
      </View>

      {loading && (
        <View className="py-10">
          <ActivityIndicator />
        </View>
      )}

      {error && (
        <Text className="mt-3 text-sm text-red-500">{error}</Text>
      )}

      {!loading && !error && (
        <>
          {qr ? (
            <View className="mx-auto mt-4 rounded-xl bg-white p-3">
              <Image source={{ uri: qr }} style={{ width: 180, height: 180 }} />
            </View>
          ) : null}

          <View className="mt-4 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
            <Text className="font-mono text-xs text-neutral-800 dark:text-neutral-200">
              {address}
            </Text>
          </View>

          <Pressable
            onPress={copyAddress}
            className="mt-3 items-center rounded-lg bg-neutral-900 py-3 dark:bg-white"
          >
            <Text className="font-semibold text-white dark:text-neutral-900">
              {copied ? 'Copied!' : 'Copy address'}
            </Text>
          </Pressable>

          <Text className="mt-3 text-xs text-amber-600">
            Only send {asset} on the {network} network. Wrong network = permanent loss.
          </Text>
        </>
      )}
    </View>
  );
}

export default WalletAddressCard;
