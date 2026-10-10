'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, Center, FormControl, FormLabel, HStack, Input, PinInput, PinInputField, Text, VStack } from '@chakra-ui/react';
import { login } from '@/lib/cockpit/api';
import { useCockpitColors } from '@/components/cockpit/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const c = useCockpitColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = params?.get('next');
  const target = next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await login(email.trim(), password, needs2fa ? code : undefined);
      if (r.requires2FA) { setNeeds2fa(true); return; }
      router.replace(target);
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Center minH="100vh" bg={c.page} px={4}>
      <Box as="form" onSubmit={submit} w="100%" maxW="380px" bg={c.surface} border="1px solid" borderColor={c.border} borderRadius="12px" p={7}>
        <HStack spacing={2} mb={6}>
          <Box as="img" src="/icon-asterisk.svg" alt="" w="22px" h="22px" />
          <Text fontWeight={700}>tazdan</Text>
          <Text color={c.muted}>Control Cockpit</Text>
        </HStack>
        <VStack spacing={4} align="stretch">
          {!needs2fa ? (
            <>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Staff email</FormLabel>
                <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Password</FormLabel>
                <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormControl>
            </>
          ) : (
            <FormControl>
              <FormLabel fontSize="sm">Authenticator code</FormLabel>
              <HStack justify="center">
                <PinInput otp value={code} onChange={setCode} autoFocus>
                  {[0, 1, 2, 3, 4, 5].map((i) => <PinInputField key={i} />)}
                </PinInput>
              </HStack>
            </FormControl>
          )}
          {error ? <Text fontSize="sm" color="red.400">{error}</Text> : null}
          <Button type="submit" colorScheme="brand" isLoading={busy} isDisabled={needs2fa && code.length !== 6}>
            {needs2fa ? 'Verify and continue' : 'Sign in'}
          </Button>
          <Text fontSize="xs" color={c.faint}>
            Staff only. Access is logged. In production every staff account must have two-factor authentication enabled.
          </Text>
        </VStack>
      </Box>
    </Center>
  );
}

export default function CockpitLoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
