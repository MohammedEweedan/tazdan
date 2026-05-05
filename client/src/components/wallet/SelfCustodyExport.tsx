'use client';

/**
 * SelfCustodyExport — per-chain private key export.
 *
 * Multi-stage flow designed to prevent accidental exposure:
 *   1. WARN — scary red card explaining the consequences.
 *   2. AUTH — password + 2FA.
 *   3. REVEAL — private key shown ONCE with copy button + import hints.
 *   4. ACK — user must confirm "I've saved this" before closing.
 *
 * After export, the custodial balance for that chain is zeroed server-side.
 */
import { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  HStack,
  Heading,
  Input,
  Select,
  Text,
  VStack,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import { cryptoWalletAPI, type CryptoChain } from '@/lib/api';

type Stage = 'warn' | 'auth' | 'reveal' | 'done';

interface ExportResult {
  chain: CryptoChain;
  address: string;
  privateKey: string;
  importInstructions: string;
  exportedAt: string;
}

export function SelfCustodyExport() {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('warn');
  const [chain, setChain] = useState<CryptoChain>('ETH');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [confirmUnderstood, setConfirmUnderstood] = useState(false);
  const [ack, setAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const keyClipboard = useClipboard(result?.privateKey ?? '');

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await cryptoWalletAPI.export({
        chain,
        password,
        twoFactorCode,
        confirmUnderstood: true,
      });
      setResult(res.data);
      setPassword('');
      setTwoFactorCode('');
      setStage('reveal');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setConfirmUnderstood(false);
    setAck(false);
    setError(null);
    setStage('warn');
  }

  return (
    <Box
      borderWidth="2px"
      borderColor="red.400"
      borderRadius="xl"
      p={5}
      bg="red.50"
      _dark={{ bg: 'red.900', borderColor: 'red.600' }}
      maxW="560px"
    >
      <VStack align="stretch" spacing={4}>
        <HStack>
          <Heading size="md" color="red.600" _dark={{ color: 'red.200' }}>
            Self-custody export
          </Heading>
          <Badge colorScheme="red">Irreversible</Badge>
        </HStack>

        {stage === 'warn' && (
          <>
            <Text fontSize="sm">
              You are about to export the private key for your on-platform{' '}
              <b>{chain}</b> wallet. Anyone with this key owns the funds.
            </Text>
            <VStack align="stretch" spacing={1} fontSize="sm" pl={2}>
              <Text>• We will stop custodying this chain for you.</Text>
              <Text>• Your custodial balance for {chain} will become 0.</Text>
              <Text>• We cannot recover a lost or stolen private key.</Text>
              <Text>• Only import into a wallet you fully trust.</Text>
            </VStack>

            <Select value={chain} onChange={(e) => setChain(e.target.value as CryptoChain)}>
              {(['ETH', 'BTC', 'SOL', 'TRON'] as CryptoChain[]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Checkbox
              isChecked={confirmUnderstood}
              onChange={(e) => setConfirmUnderstood(e.target.checked)}
            >
              I understand the risks and accept responsibility.
            </Checkbox>

            <Button
              colorScheme="red"
              isDisabled={!confirmUnderstood}
              onClick={() => setStage('auth')}
            >
              Continue
            </Button>
          </>
        )}

        {stage === 'auth' && (
          <>
            <Text fontSize="sm">
              Confirm your password and 2FA code to reveal the private key for{' '}
              <b>{chain}</b>.
            </Text>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Input
              placeholder="6-digit 2FA code"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              inputMode="numeric"
              maxLength={8}
            />
            {error && (
              <Alert status="error" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}
            <HStack>
              <Button variant="ghost" onClick={() => setStage('warn')}>
                Back
              </Button>
              <Button
                colorScheme="red"
                onClick={submit}
                isLoading={loading}
                isDisabled={!password || twoFactorCode.length < 6}
                flex={1}
              >
                Reveal private key
              </Button>
            </HStack>
          </>
        )}

        {stage === 'reveal' && result && (
          <>
            <Alert status="warning" fontSize="sm">
              <AlertIcon />
              This key is shown <b>once</b>. Save it now.
            </Alert>

            <Box>
              <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.300' }}>
                Address
              </Text>
              <Code fontSize="sm" wordBreak="break-all" w="full">
                {result.address}
              </Code>
            </Box>

            <Box>
              <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.300' }}>
                Private key
              </Text>
              <Code
                fontSize="sm"
                wordBreak="break-all"
                w="full"
                p={3}
                colorScheme="red"
              >
                {result.privateKey}
              </Code>
            </Box>

            <Button
              size="sm"
              onClick={() => {
                keyClipboard.onCopy();
                toast({
                  title: 'Private key copied',
                  status: 'warning',
                  duration: 2000,
                });
              }}
            >
              {keyClipboard.hasCopied ? 'Copied!' : 'Copy private key'}
            </Button>

            <Divider />
            <Text fontSize="sm">
              <b>How to import:</b> {result.importInstructions}
            </Text>

            <Checkbox isChecked={ack} onChange={(e) => setAck(e.target.checked)}>
              I&apos;ve saved this private key somewhere safe.
            </Checkbox>

            <Button colorScheme="red" isDisabled={!ack} onClick={() => setStage('done')}>
              Finish
            </Button>
          </>
        )}

        {stage === 'done' && (
          <>
            <Text fontSize="sm">
              Export complete. Your custodial {result?.chain} balance is now 0.
            </Text>
            <Button variant="outline" onClick={reset}>
              Close
            </Button>
          </>
        )}
      </VStack>
    </Box>
  );
}

export default SelfCustodyExport;
