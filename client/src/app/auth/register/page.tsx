'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box, Flex, VStack, HStack, Heading, Text, Button, Input, InputGroup,
  InputRightElement, IconButton, FormControl, FormLabel, SimpleGrid,
  useColorModeValue, useToast, Icon,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { FiEye, FiEyeOff, FiTrendingUp } from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const toast = useToast();
  const { register } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', referralCode: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const subtleText = useColorModeValue('gray.600', 'gray.400');

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast({ title: 'Password must be at least 8 characters', status: 'error' }); return; }
    setLoading(true);
    try {
      await register({ ...form, referralCode: form.referralCode || undefined, phone: form.phone || undefined });
      toast({ title: t('common_success'), status: 'success' });
      router.push('/dashboard');
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    } finally { setLoading(false); }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" px={4} py={12}>
      <Box w="full" maxW="md">
        <VStack spacing={4} mb={8} textAlign="center">
          <HStack as={NextLink} href="/" spacing={2}>
            <Flex align="center" justify="center" w={10} h={10} rounded="lg" bgGradient="linear(to-br, brand.500, accent.500)">
              <Icon as={FiTrendingUp} color="white" boxSize={5} />
            </Flex>
            <Text fontSize="2xl" fontWeight="bold">{t('app_name')}</Text>
          </HStack>
          <Heading size="lg">{t('auth_create_account')}</Heading>
          <Text fontSize="sm" color={subtleText}>{t('auth_create_subtitle')}</Text>
        </VStack>

        <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6}>
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <SimpleGrid columns={2} spacing={4} w="full">
                <FormControl isRequired>
                  <FormLabel fontSize="sm">{t('auth_first_name')}</FormLabel>
                  <Input placeholder="Mohamed" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">{t('auth_last_name')}</FormLabel>
                  <Input placeholder="Ahmed" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
                </FormControl>
              </SimpleGrid>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t('auth_email')}</FormLabel>
                <Input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t('auth_phone')}</FormLabel>
                <Input type="tel" placeholder="+218 9X XXX XXXX" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t('auth_password')}</FormLabel>
                <InputGroup>
                  <Input type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={form.password} onChange={(e) => update('password', e.target.value)} minLength={8} />
                  <InputRightElement>
                    <IconButton aria-label="Toggle" icon={showPassword ? <FiEyeOff /> : <FiEye />} variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)} />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t('auth_referral_code')}</FormLabel>
                <Input placeholder="Enter referral code" value={form.referralCode} onChange={(e) => update('referralCode', e.target.value)} />
              </FormControl>
              <Button type="submit" colorScheme="brand" w="full" isLoading={loading}>{t('auth_create_account')}</Button>
            </VStack>
          </form>
        </Box>

        <Text mt={6} textAlign="center" fontSize="sm" color={subtleText}>
          {t('auth_already_have_account')}{' '}
          <Button as={NextLink} href="/login" variant="link" colorScheme="brand" size="sm">{t('auth_sign_in')}</Button>
        </Text>
      </Box>
    </Flex>
  );
}
