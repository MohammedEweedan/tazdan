'use client';

import { motion } from 'framer-motion';
import NextLink from 'next/link';
import {
  Box, Container, Heading, Text, VStack, HStack,
  Icon, Flex, useColorMode,
} from '@chakra-ui/react';
import { FiArrowLeft, FiAlertTriangle } from 'react-icons/fi';
import { useTranslate } from '@tolgee/react';
import PublicNav from '@/components/ui/PublicNav';
import PublicFooter from '@/components/ui/PublicFooter';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
};

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

  const pageBg     = dark ? '#000000' : '#ffffff';
  const textMain   = dark ? '#ffffff' : '#0a0f1e';
  const textSub    = dark ? 'rgba(255,255,255,0.6)' : '#64748b';
  const cardBg     = dark ? 'rgba(255,255,255,0.03)' : '#f7f7f7';
  const cardBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
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

      <Container maxW="740px" pt={{ base: '120px', md: '160px' }} pb={{ base: 20, md: 32 }}>

        {/* Back link top */}
        <motion.div {...fadeUp}>
          <Box mb={10}>{backLink()}</Box>
        </motion.div>

        {/* Header */}
        <motion.div {...fadeUp}>
          <VStack align="start" spacing={3} mb={10}>
            <Text fontSize="11px" fontWeight="800" letterSpacing="0.18em" color={textSub} textTransform="uppercase">
              {t('risk_page_eyebrow')}
            </Text>
            <Heading
              as="h1" fontWeight="900"
              fontSize={{ base: '36px', md: '52px' }}
              letterSpacing="-0.04em" lineHeight="1.05"
              color={textMain}
            >
              {t('risk_page_title')}
            </Heading>
            <Text fontSize="13px" color={textSub}>{t('risk_page_reading_time')}</Text>
          </VStack>
        </motion.div>

        {/* FCA warning box */}
        <motion.div {...fadeUp}>
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
        </motion.div>

        {/* Key risks eyebrow */}
        <motion.div {...fadeUp}>
          <Text fontSize="11px" fontWeight="800" letterSpacing="0.18em" color={textSub} textTransform="uppercase" mb={5}>
            {t('risk_page_key_risks_eyebrow')}
          </Text>
        </motion.div>

        {/* Key risk cards */}
        <VStack spacing={4} align="stretch" mb={12}>
          {SECTIONS.map((s, i) => (
            <motion.div key={s.titleKey} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}>
              <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={{ base: 5, md: 6 }}>
                <Heading as="h2" fontSize={{ base: '16px', md: '17px' }} fontWeight="800" letterSpacing="-0.02em" color={textMain} mb={3}>
                  {t(s.titleKey)}
                </Heading>
                <VStack align="start" spacing={2.5}>
                  {s.bodyKeys.map((k) => (
                    <Text key={k} fontSize="14px" color={textSub} lineHeight="1.75">
                      {t(k)}
                    </Text>
                  ))}
                </VStack>
              </Box>
            </motion.div>
          ))}
        </VStack>

        {/* Asset risks eyebrow */}
        <motion.div {...fadeUp}>
          <VStack align="start" spacing={2} mb={6}>
            <Text fontSize="11px" fontWeight="800" letterSpacing="0.18em" color={textSub} textTransform="uppercase">
              {t('risk_page_asset_risks_eyebrow')}
            </Text>
            <Text fontSize="14px" color={textSub} lineHeight="1.7">
              {t('risk_page_asset_risks_sub')}
            </Text>
          </VStack>
        </motion.div>

        {/* Asset risk cards */}
        <VStack spacing={3} align="stretch" mb={12}>
          {ASSET_RISKS.map((a, i) => (
            <motion.div key={a.nameKey} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}>
              <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="14px" p={{ base: 4, md: 5 }}>
                <Text fontSize="14px" fontWeight="700" color={textMain} mb={2} letterSpacing="-0.01em">
                  {t(a.nameKey)}
                </Text>
                <VStack align="start" spacing={1.5}>
                  {a.riskKeys.map((k) => (
                    <HStack key={k} align="flex-start" spacing={2.5}>
                      <Box w="4px" h="4px" borderRadius="full" bg={textSub} mt="7px" flexShrink={0} />
                      <Text fontSize="13px" color={textSub} lineHeight="1.7">{t(k)}</Text>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </motion.div>
          ))}
        </VStack>

        {/* Footer notes */}
        <motion.div {...fadeUp}>
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
        </motion.div>

        {/* Back link bottom */}
        <motion.div {...fadeUp}>
          {backLink(12)}
        </motion.div>

      </Container>

      <PublicFooter />
    </Box>
  );
}
