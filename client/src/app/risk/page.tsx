'use client';

import NextLink from 'next/link';
import {
  Box, Text, VStack, HStack,
  Icon, Flex, useColorMode,
} from '@chakra-ui/react';
import { FiArrowLeft, FiAlertTriangle } from 'react-icons/fi';
import { useTranslate } from '@tolgee/react';
import PublicNav from '@/components/ui/PublicNav';
import PublicFooter from '@/components/ui/PublicFooter';
import { publicPageTheme } from '@/components/ui/publicPageTheme';
import { Band, BentoCard, Graphic, PageHero, Reveal, SectionHeading } from '@/components/ui/appleKit';

const SECTIONS = [
  { titleKey: 'risk_s1_title', bodyKeys: ['risk_s1_p1', 'risk_s1_p2'] },
  { titleKey: 'risk_s2_title', bodyKeys: ['risk_s2_p1', 'risk_s2_p2'] },
  { titleKey: 'risk_s3_title', bodyKeys: ['risk_s3_p1', 'risk_s3_p2'] },
  { titleKey: 'risk_s4_title', bodyKeys: ['risk_s4_p1', 'risk_s4_p2'] },
  { titleKey: 'risk_s5_title', bodyKeys: ['risk_s5_p1', 'risk_s5_p2'] },
];

const ASSET_RISKS = [
  { nameKey: 'risk_a1_name', riskKeys: ['risk_a1_r1', 'risk_a1_r2'] },
  { nameKey: 'risk_a2_name', riskKeys: ['risk_a2_r1', 'risk_a2_r2'] },
  { nameKey: 'risk_a3_name', riskKeys: ['risk_a3_r1', 'risk_a3_r2'] },
  { nameKey: 'risk_a4_name', riskKeys: ['risk_a4_r1', 'risk_a4_r2'] },
  { nameKey: 'risk_a5_name', riskKeys: ['risk_a5_r1', 'risk_a5_r2'] },
];

export default function RiskPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const {
    pageBg, textMain, textSub, cardBg, cardBorder,
  } = publicPageTheme(dark);
  const warnBg     = dark ? 'rgba(255,200,0,0.06)' : 'rgba(180,120,0,0.05)';
  const warnBorder = dark ? 'rgba(255,200,0,0.18)' : 'rgba(180,120,0,0.18)';
  const warnText   = dark ? 'rgba(255,220,80,0.9)' : 'rgba(140,90,0,0.9)';

  const backLink = (mt?: number) => (
    <Box
      as={NextLink}
      href="/"
      display="inline-flex"
      alignItems="center"
      gap={1.5}
      fontSize="13px"
      fontWeight="600"
      color={textSub}
      _hover={{ color: textMain }}
      transition="color 0.15s"
      mt={mt}
    >
      <Icon as={FiArrowLeft} boxSize={3.5} />
      {t('risk_page_back')}
    </Box>
  );

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      <PageHero
        eyebrow={t('risk_page_eyebrow')}
        title={t('risk_page_title')}
        subtitle={t('risk_page_reading_time')}
        size="md"
        maxW="740px"
      />

      <Band maxW="860px">

        {/* Back link top */}
        <Reveal>
          <Box mb={10}>{backLink()}</Box>
        </Reveal>

        {/* FCA warning box */}
        <Reveal>
          <Box mb={10}>
            <Graphic kind="shield" dark={dark} />
          </Box>
          <Box
            bg={warnBg} border="1px solid" borderColor={warnBorder}
            borderRadius="16px" p={{ base: 5, md: 6 }} mb={10}
          >
            <HStack spacing={3} align="flex-start">
              <Flex w="32px" h="32px" flexShrink={0} align="center" justify="center" color={warnText}>
                <Icon as={FiAlertTriangle} boxSize={5} />
              </Flex>
              <Text fontSize="14px" color={warnText} lineHeight="1.7" fontWeight="500">
                {t('risk_page_fca_warning')}
              </Text>
            </HStack>
          </Box>
        </Reveal>

        {/* Key risks eyebrow */}
        <SectionHeading align="start" title={t('risk_page_key_risks_eyebrow')} />

        {/* Key risk cards */}
        <VStack spacing={4} align="stretch" mb={12}>
          {SECTIONS.map((s, i) => (
            <BentoCard key={s.titleKey} title={t(s.titleKey)} delay={i * 0.04}>
                <VStack align="start" spacing={2.5}>
                  {s.bodyKeys.map((k) => (
                    <Text key={k} fontSize="14px" color={textSub} lineHeight="1.75">
                      {t(k)}
                    </Text>
                  ))}
                </VStack>
            </BentoCard>
          ))}
        </VStack>

        {/* Asset risks eyebrow */}
        <Reveal>
          <VStack align="start" spacing={2} mb={6}>
            <Text fontSize={{ base: '22px', md: '30px' }} fontWeight="700" color={textMain} letterSpacing="-0.03em">
              {t('risk_page_asset_risks_eyebrow')}
            </Text>
            <Text fontSize="14px" color={textSub} lineHeight="1.7">
              {t('risk_page_asset_risks_sub')}
            </Text>
          </VStack>
        </Reveal>

        {/* Asset risk cards */}
        <VStack spacing={3} align="stretch" mb={12}>
          {ASSET_RISKS.map((a, i) => (
            <Reveal key={a.nameKey} delay={i * 0.035}>
              <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="14px" p={{ base: 4, md: 5 }}>
                <Text fontSize="14px" fontWeight="700" color={textMain} mb={2} letterSpacing="-0.01em">
                  {t(a.nameKey)}
                </Text>
                <VStack align="start" spacing={1.5}>
                  {a.riskKeys.map((k) => (
                    <HStack key={k} align="flex-start" spacing={2.5}>
                      <Box w="4px" h="4px" borderRadius="1px" bg={textSub} mt="7px" flexShrink={0} />
                      <Text fontSize="13px" color={textSub} lineHeight="1.7">{t(k)}</Text>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </Reveal>
          ))}
        </VStack>

        {/* Footer notes */}
        <Reveal>
          <VStack align="start" spacing={3}>
            <Text fontSize="13px" color={textSub} lineHeight="1.7">
              {t('risk_page_footer_1')}
            </Text>
            <Text fontSize="13px" color={textSub} lineHeight="1.7">
              {t('risk_page_footer_2')}{' '}
              <Box as="a" href="https://www.fca.org.uk" target="_blank" rel="noopener noreferrer"
                fontWeight="600" color={textMain} textDecoration="underline" _hover={{ opacity: 0.7 }} transition="opacity 0.15s"
              >
                {t('risk_page_footer_fca_1')}
              </Box>
              {t('risk_page_footer_join')}{' '}
              <Box as="a" href="https://www.fca.org.uk/consumers/cryptoassets" target="_blank" rel="noopener noreferrer"
                fontWeight="600" color={textMain} textDecoration="underline" _hover={{ opacity: 0.7 }} transition="opacity 0.15s"
              >
                {t('risk_page_footer_fca_2')}
              </Box>
              .
            </Text>
          </VStack>
        </Reveal>

        {/* Back link bottom */}
        <Reveal>
          {backLink(12)}
        </Reveal>

      </Band>

      <PublicFooter />
    </Box>
  );
}
