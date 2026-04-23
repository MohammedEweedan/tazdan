'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box, Container, VStack, HStack, Heading, Text, Button, Input, InputGroup,
  InputRightElement, IconButton, FormControl, FormLabel, useColorModeValue,
  useToast, Flex, Icon, Spinner,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { FiEye, FiEyeOff, FiTrendingUp } from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const toast = useToast();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const subtleText = useColorModeValue('gray.600', 'gray.400');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password, requires2FA ? twoFactorCode : undefined);
      if (result?.requires2FA) {
        setRequires2FA(true);
        toast({ title: t('auth_2fa_code'), status: 'info' });
      } else {
        toast({ title: t('common_success'), status: 'success' });
        router.push(result?.user?.role === 'ADMIN' ? '/admin' : '/dashboard');
      }
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" px={4}>
      <Box w="full" maxW="md">
        <VStack spacing={4} mb={8} textAlign="center">
          <HStack as={NextLink} href="/" spacing={2}>
            <Flex align="center" justify="center" w={10} h={10} rounded="lg" bgGradient="linear(to-br, brand.500, accent.500)">
              <Icon as={FiTrendingUp} color="white" boxSize={5} />
            </Flex>
            <Text fontSize="2xl" fontWeight="bold">{t('app_name')}</Text>
          </HStack>
          <Heading size="lg">{t('auth_welcome_back')}</Heading>
          <Text fontSize="sm" color={subtleText}>{t('auth_login_subtitle')}</Text>
        </VStack>

        <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6}>
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t('auth_email')}</FormLabel>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">{t('auth_password')}</FormLabel>
                <InputGroup>
                  <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <InputRightElement>
                    <IconButton aria-label="Toggle password" icon={showPassword ? <FiEyeOff /> : <FiEye />} variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)} />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              {requires2FA && (
                <FormControl isRequired>
                  <FormLabel fontSize="sm">{t('auth_2fa_code')}</FormLabel>
                  <Input type="text" placeholder="000000" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} maxLength={6} />
                </FormControl>
              )}

              <Button type="submit" colorScheme="brand" w="full" isLoading={loading}>
                {requires2FA ? t('auth_verify_sign_in') : t('auth_sign_in')}
              </Button>
            </VStack>
          </form>
        </Box>

        <Text mt={6} textAlign="center" fontSize="sm" color={subtleText}>
          {t('auth_no_account')}{' '}
          <Button as={NextLink} href="/auth/register" variant="link" colorScheme="brand" size="sm">
            {t('auth_create_one')}
          </Button>
        </Text>
      </Box>
    </Flex>
  );
}
