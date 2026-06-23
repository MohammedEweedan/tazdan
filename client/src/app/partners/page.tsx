'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import {
  Box, Heading, Text, VStack, HStack,
  SimpleGrid, Icon, Flex, useColorMode,
} from '@chakra-ui/react';
import { FiArrowUpRight, FiCheck, FiShield, FiZap, FiGlobe, FiCreditCard } from 'react-icons/fi';
import { useTranslate } from '@tolgee/react';
import PublicNav from '@/components/ui/PublicNav';
import PublicFooter from '@/components/ui/PublicFooter';
import { publicPageTheme } from '@/components/ui/publicPageTheme';
import { Band, BentoCard, CTASection, Graphic, PageHero, Reveal } from '@/components/ui/appleKit';

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

  const {
    pageBg, textMain, textSub, cardBg, cardBorder,
    strongBorder, accentText, accentSoft, accentBorder,
  } = publicPageTheme(dark);
  const iconBg = accentSoft;

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

      {/* ── Hero ── */}
      <PageHero
        eyebrow={t('partners_eyebrow')}
        title={t('partners_title')}
        subtitle={t('partners_sub')}
      />

      <Band maxW="1060px">
        <Reveal>
          <Box mb={{ base: 8, md: 12 }}>
            <Graphic kind="globe" dark={dark} />
          </Box>
        </Reveal>
        <VStack spacing={5} align="stretch">
          {PARTNERS.map((p, i) => (
            <Reveal key={p.key} delay={i * 0.06}>
              <BentoCard title={p.name}>
                <VStack align="start" spacing={6}>
                  <HStack spacing={5} justify="space-between" w="100%" align="center">
                    <HStack spacing={5} align="center">
                      <PartnerLogo src={p.logo} name={p.name} bg={p.logoBg} border={cardBorder} />
                      <VStack align="start" spacing={1}>
                        <Text fontSize="12px" fontWeight="700" color={textSub}>
                          {t(p.roleKey)}
                        </Text>
                        <Heading fontSize={{ base: '24px', md: '32px' }} fontWeight="800" letterSpacing="-0.02em" color={textMain}>
                          {p.name}
                        </Heading>
                      </VStack>
                    </HStack>
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
                          bg={iconBg} border="1px solid" borderColor={accentBorder}
                          borderRadius="9px" align="center" justify="center"
                        >
                          <Icon as={perk.icon} color={accentText} boxSize={3.5} />
                        </Flex>
                        <Text fontSize="13px" fontWeight="600" color={textSub} lineHeight="1.5">
                          {t(perk.key)}
                        </Text>
                      </HStack>
                    ))}
                  </SimpleGrid>
                </VStack>
              </BentoCard>
            </Reveal>
          ))}
        </VStack>
      </Band>

      <Band tone="alt" maxW="960px">
        <BentoCard icon={FiShield} title={t('partners_compliance_note')} desc={t('partners_compliance_body')} />
      </Band>

      <CTASection
        title={t('minimal_cta_title')}
        subtitle={t('minimal_cta_desc')}
        primary={{ label: t('minimal_cta_primary'), href: '/register' }}
      />

      <PublicFooter />
    </Box>
  );
}
