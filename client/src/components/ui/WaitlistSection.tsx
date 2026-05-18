'use client';
import { useState } from 'react';
import { useTranslate } from '@tolgee/react';
import {
  Box, VStack, HStack, Heading, Text, Input,
  Button, Icon, useColorModeValue,
} from '@chakra-ui/react';
import { FiArrowRight, FiCheck } from 'react-icons/fi';

export default function WaitlistSection() {
  const { t } = useTranslate();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const bg     = useColorModeValue('#000000', '#ffffff');
  const fg     = useColorModeValue('#ffffff', '#000000');
  const muted  = useColorModeValue('rgba(255,255,255,0.6)', 'rgba(0,0,0,0.55)');
  const border = useColorModeValue('rgba(255,255,255,0.15)', 'rgba(0,0,0,0.12)');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { setErrorMsg(t('waitlist_error')); return; }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed');
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg(t('waitlist_error'));
    }
  }

  return (
    <Box id="waitlist" bg={bg} py={{ base: 20, md: 28 }} px={6}>
      <VStack spacing={8} maxW="540px" mx="auto" textAlign="center">
        {/* Eyebrow */}
        <Text
          fontSize="11px" fontWeight="800" letterSpacing="0.14em"
          color={muted} textTransform="uppercase"
        >
          {t('waitlist_eyebrow')}
        </Text>

        <Heading
          fontSize={{ base: '36px', md: '52px' }}
          fontWeight="900"
          letterSpacing="-0.04em"
          color={fg}
          lineHeight="1.05"
          whiteSpace="pre-line"
        >
          {t('waitlist_title')}
        </Heading>

        <Text fontSize={{ base: '15px', md: '17px' }} color={muted} maxW="380px">
          {t('waitlist_sub')}
        </Text>

        {/* Social proof mini-bar */}
        <HStack spacing={6} justify="center" flexWrap="wrap">
          {([
            { n: t('waitlist_stat1_n'), label: t('waitlist_stat1_l') },
            { n: t('waitlist_stat2_n'), label: t('waitlist_stat2_l') },
            { n: t('waitlist_stat3_n'), label: t('waitlist_stat3_l') },
          ] as { n: string; label: string }[]).map(({ n, label }) => (
            <VStack key={label} spacing={0}>
              <Text fontSize="22px" fontWeight="900" color={fg} letterSpacing="-0.04em">{n}</Text>
              <Text fontSize="12px" color={muted}>{label}</Text>
            </VStack>
          ))}
        </HStack>

        {/* Form */}
        {status === 'success' ? (
          <HStack
            bg={useColorModeValue('rgba(255,255,255,0.1)', 'rgba(0,0,0,0.06)')}
            border="1px solid" borderColor={border}
            borderRadius="16px" px={6} py={4} spacing={3}
          >
            <Box
              w={8} h={8} bg={fg} borderRadius="full"
              display="flex" alignItems="center" justifyContent="center" flexShrink={0}
            >
              <Icon as={FiCheck} color={bg} boxSize={4} />
            </Box>
            <VStack spacing={0} align="start">
              <Text fontWeight="800" color={fg} fontSize="15px">{t('waitlist_success_title')}</Text>
              <Text fontSize="13px" color={muted}>{t('waitlist_success_sub')}</Text>
            </VStack>
          </HStack>
        ) : (
          <Box w="100%" as="form" onSubmit={handleSubmit}>
            <HStack spacing={2}>
              <Input
                type="email"
                placeholder={t('waitlist_placeholder')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                bg={useColorModeValue('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.06)')}
                border="1px solid"
                borderColor={border}
                color={fg}
                borderRadius="14px"
                h="52px"
                px={5}
                fontSize="15px"
                _placeholder={{ color: muted }}
                _focus={{ outline: 'none', borderColor: fg }}
                flex={1}
              />
              <Button
                type="submit"
                isLoading={status === 'loading'}
                h="52px"
                px={6}
                bg={fg}
                color={bg}
                borderRadius="14px"
                fontWeight="800"
                fontSize="14px"
                rightIcon={<Icon as={FiArrowRight} />}
                _hover={{ opacity: 0.88 }}
                transition="opacity 0.15s"
                flexShrink={0}
              >
                {t('waitlist_btn')}
              </Button>
            </HStack>
            {(status === 'error' || errorMsg) && (
              <Text fontSize="13px" color="red.400" mt={2} textAlign="left">
                {errorMsg || t('waitlist_error')}
              </Text>
            )}
          </Box>
        )}

        <Text fontSize="12px" color={useColorModeValue('rgba(255,255,255,0.35)', 'rgba(0,0,0,0.30)')}>
          {t('waitlist_disclaimer')}
        </Text>
      </VStack>
    </Box>
  );
}
