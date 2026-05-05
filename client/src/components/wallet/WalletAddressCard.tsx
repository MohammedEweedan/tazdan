'use client';

/**
 * WalletAddressCard — displays a per-chain deposit address with QR code.
 *
 * The QR is generated server-side (data-URL) by
 * GET /api/wallet/deposit-address/:asset/:network so we don't ship a QR
 * library to the browser.
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  HStack,
  Image,
  Spinner,
  Text,
  VStack,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import { cryptoWalletAPI } from '@/lib/api';

export interface WalletAddressCardProps {
  asset: 'ETH' | 'BTC' | 'SOL' | 'USDT';
  network: string;
  label?: string;
}

export function WalletAddressCard({ asset, network, label }: WalletAddressCardProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [qr, setQr] = useState('');

  const { onCopy, hasCopied } = useClipboard(address);

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
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.error || 'Failed to load deposit address');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [asset, network]);

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      p={5}
      bg="white"
      _dark={{ bg: 'gray.800', borderColor: 'gray.700' }}
      shadow="sm"
    >
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between">
          <Text fontWeight="bold" fontSize="lg">
            {label ?? `${asset} · ${network}`}
          </Text>
          <Text fontSize="xs" color="gray.500">
            Deposit address
          </Text>
        </HStack>

        {loading && (
          <HStack justify="center" py={10}>
            <Spinner />
          </HStack>
        )}

        {error && (
          <Text color="red.500" fontSize="sm">
            {error}
          </Text>
        )}

        {!loading && !error && (
          <>
            <Box alignSelf="center" p={3} bg="white" borderRadius="md" borderWidth="1px">
              {/* QR is a data: URL from the server */}
              {qr ? <Image src={qr} alt={`${asset} deposit QR`} boxSize="180px" /> : null}
            </Box>

            <Box
              p={3}
              borderRadius="md"
              bg="gray.50"
              _dark={{ bg: 'gray.900' }}
              fontFamily="mono"
              fontSize="sm"
              wordBreak="break-all"
            >
              {address}
            </Box>

            <Button
              size="sm"
              onClick={() => {
                onCopy();
                toast({
                  title: 'Address copied',
                  status: 'success',
                  duration: 1500,
                  isClosable: true,
                });
              }}
            >
              {hasCopied ? 'Copied!' : 'Copy address'}
            </Button>

            <Text fontSize="xs" color="orange.500">
              Only send {asset} on the {network} network to this address. Sending any
              other asset or using the wrong network will result in permanent loss.
            </Text>
          </>
        )}
      </VStack>
    </Box>
  );
}

export default WalletAddressCard;
