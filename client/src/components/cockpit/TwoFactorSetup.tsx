'use client';

/**
 * Shown instead of the cockpit when production requires staff 2FA and the
 * signed-in staff member has not turned it on. Uses the same endpoints as the
 * mobile app (/auth/2fa/enable, /auth/2fa/verify).
 */
import { useState } from 'react';
import { Box, Button, Center, Code, Input, Text, VStack } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useCockpitColors } from './ui';

export default function TwoFactorSetup({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const c = useCockpitColors();
  const [setup, setSetup] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true); setError(null);
    try { setSetup(await api('/auth/2fa/enable', { method: 'POST' })); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError(null);
    try { await api('/auth/2fa/verify', { method: 'POST', body: { code } }); onDone(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Center minH="100vh" bg={c.page} p={6}>
      <Box maxW="440px" w="100%" bg={c.surface} border="1px solid" borderColor={c.border} borderRadius="12px" p={6}>
        <Text fontWeight={700} mb={2}>Turn on two-factor authentication</Text>
        <Text fontSize="sm" color={c.muted} mb={4}>
          Staff tools in production need an authenticator app (Google Authenticator, 1Password, Authy…). It takes a minute.
        </Text>
        {!setup ? (
          <Button size="sm" colorScheme="brand" isLoading={busy} onClick={start}>Set up authenticator</Button>
        ) : (
          <VStack align="stretch" spacing={3}>
            <Text fontSize="sm">1. Scan this code with your authenticator app.</Text>
            <Center><Box as="img" src={setup.qrCodeDataUrl} alt="Authenticator QR code" w="180px" h="180px" bg="white" p={2} borderRadius="8px" /></Center>
            <Text fontSize="xs" color={c.muted}>Or enter this key: <Code fontSize="xs">{setup.secret}</Code></Text>
            <Text fontSize="sm">2. Enter the 6-digit code it shows.</Text>
            <Input size="sm" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            <Button size="sm" colorScheme="brand" isLoading={busy} isDisabled={code.length !== 6} onClick={verify}>Verify and continue</Button>
          </VStack>
        )}
        {error ? <Text color="red.400" fontSize="sm" mt={3}>{error}</Text> : null}
        <Text as="button" fontSize="xs" color={c.muted} mt={5} onClick={onSignOut}>Sign out</Text>
      </Box>
    </Center>
  );
}
