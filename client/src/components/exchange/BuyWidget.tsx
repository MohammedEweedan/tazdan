'use client';

/**
 * BuyWidget — custodial BUY flow with holdings, pairs, and buy-to-send option.
 *
 * Flow:
 *   1. Shows user's holdings balances
 *   2. User picks asset+network and enters a fiat amount
 *   3. On debounce (400ms) we POST /exchange/quote → live quote (10s TTL)
 *   4. Quote breakdown shown: market price vs quoted price, all fees, you receive
 *   5. User chooses "Buy to own" or "Buy to send"
 *   6. User clicks "Confirm buy" → shows verifying → confirming → success states
 *   7. POST /exchange/execute with idempotency key
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Divider,
  HStack,
  Input,
  Select,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useToast,
  RadioGroup,
  Radio,
  Flex,
  Badge,
  CircularProgress,
  CircularProgressLabel,
} from '@chakra-ui/react';
import { cryptoExchangeAPI, type CryptoAsset, type CryptoQuote } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { walletAPI } from '@/lib/api';

const BRAND = '#226dff';
const BRAND_LIGHT = '#7649ff';
const SUCCESS_GREEN = '#22c55e';

const NETWORKS: Record<CryptoAsset, string[]> = {
  ETH: ['ERC20'],
  BTC: ['BTC'],
  SOL: ['SOL'],
  USDT: ['ERC20', 'TRC20'],
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SAR: '﷼',
  EGP: 'ج.م',
  USDT: '₮',
  BTC: '₿',
  ETH: 'Ξ',
  BNB: 'B',
  SOL: '◎',
};

const CRYPTO_PAIRS = [
  { base: 'ETH', quote: 'USD', label: 'ETH/USD' },
  { base: 'BTC', quote: 'USD', label: 'BTC/USD' },
  { base: 'SOL', quote: 'USD', label: 'SOL/USD' },
  { base: 'USDT', quote: 'USD', label: 'USDT/USD' },
  { base: 'ETH', quote: 'EUR', label: 'ETH/EUR' },
  { base: 'BTC', quote: 'EUR', label: 'BTC/EUR' },
  { base: 'ETH', quote: 'AED', label: 'ETH/AED' },
  { base: 'BTC', quote: 'AED', label: 'BTC/AED' },
];

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

function fmt(n: string | number, digits = 6) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

function newIdemKey() {
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

type ExecutionState = 'idle' | 'verifying' | 'confirming' | 'success';

export function BuyWidget() {
  const toast = useToast();
  const { user } = useAuthStore();
  const baseCurrency = (user as any)?.baseCurrency || 'USD';
  
  const [asset, setAsset] = useState<CryptoAsset>('ETH');
  const [network, setNetwork] = useState<string>('ERC20');
  const [fiat, setFiat] = useState<string>('100');
  const [buyMode, setBuyMode] = useState<'own' | 'send'>('own');

  const [quote, setQuote] = useState<CryptoQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [executionState, setExecutionState] = useState<ExecutionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [holdings, setHoldings] = useState<any[]>([]);

  // Fetch user holdings
  useEffect(() => {
    (async () => {
      try {
        const res = await walletAPI.getAll();
        const nextHoldings = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.wallets)
            ? res.data.wallets
            : [];
        setHoldings(nextHoldings);
      } catch (e) {
        console.error('Failed to fetch holdings:', e);
      }
    })();
  }, []);

  // Reset network when asset changes.
  useEffect(() => {
    setNetwork(NETWORKS[asset][0]);
  }, [asset]);

  // Debounced quote fetch.
  useEffect(() => {
    const amt = parseFloat(fiat);
    if (!amt || amt <= 0) {
      setQuote(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoadingQuote(true);
      setError(null);
      try {
        const res = await cryptoExchangeAPI.quote({
          asset,
          network,
          side: 'BUY',
          fiatAmount: String(amt),
        });
        setQuote(res.data.quote);
        setSecondsLeft(10);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to get quote');
        setQuote(null);
      } finally {
        setLoadingQuote(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [asset, network, fiat]);

  // 10 second countdown for quotes
  useEffect(() => {
    if (!quote || secondsLeft <= 0) return;
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setQuote(null);
          return 10;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [quote]);

  const disabled = !quote || executionState !== 'idle' || secondsLeft <= 0;

  const idemKey = useMemo(newIdemKey, [quote?.id]);

  async function onConfirm() {
    if (!quote) return;
    setExecutionState('verifying');
    
    // Simulate verifying state (1-2 seconds)
    setTimeout(() => {
      setExecutionState('confirming');
      
      // Simulate confirming state (1-2 seconds)
      setTimeout(async () => {
        try {
          await cryptoExchangeAPI.execute({
            quoteId: quote.id,
            confirmedByUser: true,
            idempotencyKey: idemKey,
          });
          setExecutionState('success');
          toast({
            title: 'Order executed',
            description: `${fmt(quote.cryptoAmount, 8)} ${quote.asset} credited`,
            status: 'success',
            duration: 4000,
            isClosable: true,
          });
          setQuote(null);
          setFiat('');
          setTimeout(() => setExecutionState('idle'), 2000);
        } catch (e: any) {
          setExecutionState('idle');
          toast({
            title: 'Order failed',
            description: e?.response?.data?.error || 'Unknown error',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      }, 1500);
    }, 1500);
  }

  const getButtonColor = () => {
    if (executionState === 'success') return SUCCESS_GREEN;
    if (executionState === 'verifying' || executionState === 'confirming') return BRAND;
    return BRAND;
  };

  const getButtonText = () => {
    if (executionState === 'verifying') return 'Verifying...';
    if (executionState === 'confirming') return 'Confirming...';
    if (executionState === 'success') return 'Success ✓';
    return 'Confirm buy';
  };

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      p={6}
      bg="white"
      _dark={{ bg: 'gray.800', borderColor: 'gray.700' }}
      shadow="sm"
      maxW="520px"
    >
      <VStack align="stretch" spacing={5}>
        <Text fontWeight="bold" fontSize="2xl" color="gray.900" _dark={{ color: 'white' }}>
          Buy crypto
        </Text>

        {/* Holdings Section */}
        <Box bg="gray.50" _dark={{ bg: 'gray.700' }} borderRadius="lg" p={4}>
          <Text fontSize="sm" fontWeight="600" color="gray.600" _dark={{ color: 'gray.300' }} mb={3}>
            Your holdings
          </Text>
          <VStack spacing={2}>
            {holdings.length === 0 ? (
              <Text fontSize="sm" color="gray.500">No holdings yet</Text>
            ) : (
              holdings.slice(0, 3).map((h) => (
                <HStack key={h.id} justify="space-between">
                  <Text fontSize="sm" color="gray.700" _dark={{ color: 'gray.200' }}>
                    {h.currency}
                  </Text>
                  <Text fontSize="sm" fontWeight="600" color="gray.900" _dark={{ color: 'white' }}>
                    {fmt(h.balance, h.currency === 'USDT' ? 2 : 8)}
                  </Text>
                </HStack>
              ))
            )}
          </VStack>
        </Box>

        {/* Crypto Pair Selection */}
        <Box>
          <Text fontSize="sm" fontWeight="600" color="gray.600" _dark={{ color: 'gray.300' }} mb={2}>
            Trading pair
          </Text>
          <HStack>
            <Select
              value={`${asset}/${baseCurrency}`}
              onChange={(e) => {
                const val = e.target.value;
                const [newAsset] = val.split('/');
                setAsset(newAsset as CryptoAsset);
              }}
              maxW="180px"
            >
              {CRYPTO_PAIRS.filter(p => p.quote === baseCurrency).map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Select value={network} onChange={(e) => setNetwork(e.target.value)} maxW="130px">
              {NETWORKS[asset].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </HStack>
        </Box>

        {/* Amount Input */}
        <Box>
          <Text fontSize="sm" fontWeight="600" color="gray.600" _dark={{ color: 'gray.300' }} mb={2}>
            Amount
          </Text>
          <HStack>
            <Input
              type="number"
              value={fiat}
              onChange={(e) => setFiat(e.target.value)}
              placeholder={`${baseCurrency} amount`}
              min={0}
              size="lg"
            />
            <Badge bg={BRAND} color="white" px={3} py={2} borderRadius="md">
              {baseCurrency}
            </Badge>
          </HStack>
        </Box>

        {/* Buy Mode Selection */}
        <Box>
          <Text fontSize="sm" fontWeight="600" color="gray.600" _dark={{ color: 'gray.300' }} mb={2}>
            Buy to
          </Text>
          <RadioGroup value={buyMode} onChange={(v) => setBuyMode(v as 'own' | 'send')}>
            <HStack spacing={6}>
              <Radio value="own" colorScheme="blue">
                <Text ml={2} fontSize="sm" color="gray.700" _dark={{ color: 'gray.200' }}>
                  Own wallet
                </Text>
              </Radio>
              <Radio value="send" colorScheme="blue">
                <Text ml={2} fontSize="sm" color="gray.700" _dark={{ color: 'gray.200' }}>
                  Send to address
                </Text>
              </Radio>
            </HStack>
          </RadioGroup>
        </Box>

        {error && (
          <Alert status="error" fontSize="sm">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {loadingQuote && (
          <HStack justify="center" py={4}>
            <Spinner size="sm" color={BRAND} />
            <Text fontSize="sm" color="gray.500">Fetching quote…</Text>
          </HStack>
        )}

        {quote && !loadingQuote && (
          <>
            <Divider />
            
            {/* You Receive */}
            <Stat>
              <StatLabel fontSize="sm" color="gray.500">You receive</StatLabel>
              <StatNumber fontSize="3xl" color="gray.900" _dark={{ color: 'white' }}>
                {fmt(quote.cryptoAmount, 8)} {quote.asset}
              </StatNumber>
            </Stat>

            {/* Fee Breakdown */}
            <Box bg="gray.50" _dark={{ bg: 'gray.700' }} borderRadius="lg" p={4}>
              <Text fontSize="sm" fontWeight="600" color="gray.600" _dark={{ color: 'gray.300' }} mb={3}>
                Fee breakdown
              </Text>
              <VStack align="stretch" spacing={2} fontSize="sm">
                <HStack justify="space-between">
                  <Text color="gray.500">Market price</Text>
                  <Text color="gray.900" _dark={{ color: 'white' }}>
                    {getCurrencySymbol(baseCurrency)}{fmt(quote.marketPrice, 2)}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.500">Your price</Text>
                  <Text color="gray.900" _dark={{ color: 'white' }}>
                    {getCurrencySymbol(baseCurrency)}{fmt(quote.quotedPrice, 2)}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.500">Platform fee (0.5%)</Text>
                  <Text color="gray.900" _dark={{ color: 'white' }}>
                    {getCurrencySymbol(baseCurrency)}{fmt(quote.platformFee, 2)}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text color="gray.500">Network fee</Text>
                  <Text color="gray.900" _dark={{ color: 'white' }}>
                    {getCurrencySymbol(baseCurrency)}{fmt(quote.networkFee, 2)}
                  </Text>
                </HStack>
                <Divider />
                <HStack justify="space-between" fontWeight="bold" fontSize="md">
                  <Text color="gray.900" _dark={{ color: 'white' }}>Total</Text>
                  <Text color="gray.900" _dark={{ color: 'white' }}>
                    {getCurrencySymbol(baseCurrency)}{fmt(quote.totalUserPays, 2)}
                  </Text>
                </HStack>
              </VStack>
            </Box>

            {/* 10 Second Countdown */}
            <Flex justify="center" align="center" gap={3}>
              <CircularProgress
                value={(secondsLeft / 10) * 100}
                size="40px"
                color={secondsLeft < 3 ? 'red.500' : BRAND}
                trackColor="gray.200"
                _dark={{ trackColor: 'gray.700' }}
              >
                <CircularProgressLabel fontSize="xs" fontWeight="bold">
                  {secondsLeft}s
                </CircularProgressLabel>
              </CircularProgress>
              <Text fontSize="sm" color={secondsLeft < 3 ? 'red.500' : 'gray.500'}>
                Price quote expires
              </Text>
            </Flex>

            {/* Confirm Button with States */}
            <Button
              bg={getButtonColor()}
              color="white"
              onClick={onConfirm}
              isDisabled={disabled}
              isLoading={executionState === 'verifying' || executionState === 'confirming'}
              size="lg"
              borderRadius="xl"
              _hover={{ bg: executionState === 'success' ? SUCCESS_GREEN : BRAND_LIGHT }}
              _disabled={{ bg: 'gray.300', cursor: 'not-allowed' }}
            >
              {getButtonText()}
            </Button>
          </>
        )}
      </VStack>
    </Box>
  );
}

export default BuyWidget;
