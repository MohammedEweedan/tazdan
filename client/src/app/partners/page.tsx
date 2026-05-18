'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import NextImage from 'next/image';
import {
  Box, Container, Heading, Text, VStack, HStack,
  SimpleGrid, Icon, Flex, useColorMode,
} from '@chakra-ui/react';
import { FiArrowUpRight, FiCheck, FiShield, FiZap, FiGlobe, FiCreditCard } from 'react-icons/fi';
import { useTranslate } from '@tolgee/react';
import PublicNav from '@/components/ui/PublicNav';
import PublicFooter from '@/components/ui/PublicFooter';

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
};

function PartnerLogo({ src, name, bg, border }: { src: string; name: string; bg: string; border: string }) {
  const [errored, setErrored] = useState(false);
  return (
    <Box
      h="52px" w="auto" minW="120px"
      borderRadius="16px"
      bg={bg} border="1px solid" borderColor={border}
      position="relative" flexShrink={0} overflow="hidden"
      display="flex" alignItems="center" justifyContent="center"
      px={5} py={3}
    >
      {errored ? (
        <Text fontSize="18px" fontWeight="800" color={border} userSelect="none" letterSpacing="0">
          {name}
        </Text>
      ) : (
        <NextImage
          src={src}
          alt={name}
          fill
          style={{ objectFit: 'contain', padding: '2px 8px' }}
          onError={() => setErrored(true)}
        />
      )}
    </Box>
  );
}

export default function PartnersPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const pageBg     = dark ? '#000000' : '#ffffff';
  const textMain   = dark ? '#ffffff' : '#0a0f1e';
  const textSub    = dark ? 'rgba(255,255,255,0.6)' : '#64748b';
  const cardBg     = dark ? 'rgba(255,255,255,0.04)' : '#f4f4f4';
  const cardBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const iconBg     = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const titleGradient = dark
    ? 'linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)'
    : 'linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)';

  const PARTNERS = [
    {
      key: 'banxa',
      name: 'Banxa',
      url: 'https://banxa.com',
      logo: dark ? '/Banxa-Logo-Light.webp' : '/Banxa-Logo-Dark.webp',
      logoBg: dark ? 'rgba(255,255,255,0.04)' : '#f0f0f0',
      roleKey: 'partner_banxa_role',
      taglineKey: 'partner_banxa_tagline',
      descKey: 'partner_banxa_desc',
      perks: [
        { icon: FiZap,    key: 'partner_banxa_perk1' },
        { icon: FiGlobe,  key: 'partner_banxa_perk2' },
        { icon: FiShield, key: 'partner_banxa_perk3' },
      ],
    },
    {
      key: 'crypto',
      name: 'Crypto.com',
      url: 'https://crypto.com',
      logo: '/crypto.com.png',
      logoBg: dark ? 'rgba(255,255,255,0.04)' : '#f0f0f0',
      roleKey: 'partner_crypto_role',
      taglineKey: 'partner_crypto_tagline',
      descKey: 'partner_crypto_desc',
      perks: [
        { icon: FiCheck,  key: 'partner_crypto_perk1' },
        { icon: FiZap,    key: 'partner_crypto_perk2' },
        { icon: FiGlobe,  key: 'partner_crypto_perk3' },
      ],
    },
    {
      key: 'visa',
      name: 'Visa',
      url: 'https://visa.com',
      logo: '/visa-logo.webp',
      logoBg: 'rgba(26, 31, 113, 0.21)',
      roleKey: 'partner_visa_role',
      taglineKey: 'partner_visa_tagline',
      descKey: 'partner_visa_desc',
      perks: [
        { icon: FiGlobe,      key: 'partner_visa_perk1' },
        { icon: FiZap,        key: 'partner_visa_perk2' },
        { icon: FiCreditCard, key: 'partner_visa_perk3' },
      ],
    },
  ];

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
        <Box pt={{ base: '120px', md: '170px' }} pb={{ base: 14, md: 24 }} textAlign="center" position="relative">
          <Box
            position="absolute" inset={0} opacity={dark ? 0.04 : 0.03}
            backgroundImage="linear-gradient(rgba(128,128,128,1) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,1) 1px, transparent 1px)"
            backgroundSize="60px 60px" pointerEvents="none"
          />
          <Container maxW="860px" position="relative" zIndex={1}>
            <VStack spacing={6}>
              <Text fontSize="11px" fontWeight="800" letterSpacing="0.18em" color={textSub} textTransform="uppercase">
                {t('partners_eyebrow')}
              </Text>
              <Heading
                as="h1" fontWeight="900"
                fontSize={{ base: '42px', md: '72px' }}
                lineHeight="1.05" letterSpacing="-0.04em"
                bgGradient={titleGradient} bgClip="text"
                maxW="700px"
              >
                {t('partners_title')}
              </Heading>
              <Text fontSize={{ base: '16px', md: '19px' }} color={textSub} maxW="560px" lineHeight="1.7">
                {t('partners_sub')}
              </Text>
            </VStack>
          </Container>
        </Box>
      </motion.div>

      {/* ── Partner cards ─────────────────────────────────────────────────── */}
      <Container maxW="960px" pb={{ base: 20, md: 32 }}>
        <VStack spacing={6} align="stretch">
          {PARTNERS.map((p, i) => (
            <motion.div key={p.key} {...fadeUp} transition={{ duration: 0.65, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}>
              <Box
                bg={cardBg} border="1px solid" borderColor={cardBorder}
                borderRadius="28px" p={{ base: 8, md: 12 }}
                transition="border-color 0.2s"
                _hover={{ borderColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)' }}
              >
                <VStack align="start" spacing={6}>
                  {/* Header row: logo + name + link */}
                  <HStack spacing={5} justify="space-between" w="100%" align="center">
                    <HStack spacing={5} align="center">
                      <PartnerLogo src={p.logo} name={p.name} bg={p.logoBg} border={cardBorder} />
                      <VStack align="start" spacing={1}>
                        <Text fontSize="11px" fontWeight="700" letterSpacing="0.12em" color={textSub} textTransform="uppercase">
                          {t(p.roleKey)}
                        </Text>
                        <Heading fontSize={{ base: '24px', md: '32px' }} fontWeight="900" letterSpacing="-0.02em" color={textMain}>
                          {p.name}
                        </Heading>
                      </VStack>
                    </HStack>
                    {/* External link */}
                    <Box
                      as="a"
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      display="inline-flex"
                      alignItems="center"
                      gap={1}
                      fontSize="12px"
                      fontWeight="600"
                      color={textSub}
                      _hover={{ color: textMain }}
                      transition="color 0.15s"
                      flexShrink={0}
                    >
                      {p.url.replace('https://', '')}
                      <Icon as={FiArrowUpRight} boxSize={3} />
                    </Box>
                  </HStack>

                  {/* Tagline */}
                  <Text fontSize={{ base: '14px', md: '15px' }} fontWeight="600" color={textSub}>
                    {t(p.taglineKey)}
                  </Text>

                  {/* Description */}
                  <Text fontSize={{ base: '15px', md: '16px' }} color={textSub} lineHeight="1.8">
                    {t(p.descKey)}
                  </Text>

                  {/* Perks */}
                  <SimpleGrid columns={{ base: 1, sm: 3 }} gap={4} w="100%">
                    {p.perks.map((perk) => (
                      <HStack
                        key={perk.key}
                        bg={dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                        border="1px solid" borderColor={cardBorder}
                        borderRadius="14px" p={4} spacing={3} align="flex-start"
                      >
                        <Flex
                          w="32px" h="32px" flexShrink={0}
                          bg={iconBg} border="1px solid" borderColor={cardBorder}
                          borderRadius="9px" align="center" justify="center"
                        >
                          <Icon as={perk.icon} color={textMain} boxSize={3.5} />
                        </Flex>
                        <Text fontSize="13px" fontWeight="600" color={textSub} lineHeight="1.5">
                          {t(perk.key)}
                        </Text>
                      </HStack>
                    ))}
                  </SimpleGrid>
                </VStack>
              </Box>
            </motion.div>
          ))}
        </VStack>
      </Container>

      {/* ── Compliance disclaimer ─────────────────────────────────────────── */}
      <motion.div {...fadeUp}>
        <Container maxW="960px" pb={{ base: 16, md: 24 }}>
          <Box
            bg={cardBg} border="1px solid" borderColor={cardBorder}
            borderRadius="20px" p={{ base: 6, md: 8 }}
          >
            <HStack spacing={3} align="flex-start">
              <Flex
                w="36px" h="36px" flexShrink={0}
                bg={iconBg} border="1px solid" borderColor={cardBorder}
                borderRadius="10px" align="center" justify="center"
              >
                <Icon as={FiShield} color={textMain} boxSize={4} />
              </Flex>
              <Text fontSize="13px" color={textSub} lineHeight="1.8">
                <Box as="span" fontWeight="700" color={textMain}>{t('partners_compliance_note')} </Box>
                {t('partners_compliance_body')}
              </Text>
            </HStack>
          </Box>
        </Container>
      </motion.div>

      <PublicFooter />
    </Box>
  );
}
