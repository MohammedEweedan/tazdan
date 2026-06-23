'use client';

import NextLink from 'next/link';
import { useTranslate } from '@tolgee/react';
import {
  Box, SimpleGrid, VStack, HStack,
  Text, Icon, useColorMode,
} from '@chakra-ui/react';
import { FiSmartphone, FiBook, FiMail, FiZap } from 'react-icons/fi';
import { publicPageTheme } from './publicPageTheme';
import { SectionHeading } from './appleKit';

export default function SupportSection() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const {
    textMain, textSub, cardBg, cardBgHover, cardBorder, strongBorder,
    accentText, accentSoft, accentBorder, shadow,
  } = publicPageTheme(dark);

  const CHANNELS = [
    {
      icon: FiSmartphone,
      title: t('support_app_title'),
      desc: t('support_app_desc'),
      cta: t('support_app_cta'),
      href: 'https://apps.apple.com',
      external: true,
    },
    {
      icon: FiBook,
      title: t('support_faq_title'),
      desc: t('support_faq_desc'),
      cta: t('support_faq_cta'),
      href: '/faq',
      external: false,
    },
    {
      icon: FiMail,
      title: t('support_email_title'),
      desc: t('support_email_desc'),
      cta: t('support_email_cta'),
      href: '/contact',
      external: false,
    },
    {
      icon: FiZap,
      title: t('support_community_title'),
      desc: t('support_community_desc'),
      cta: t('support_community_cta'),
      href: 'https://t.me/tazdan',
      external: true,
    },
  ];

  return (
    <Box id="support" py={{ base: 18, md: 28 }} px={{ base: 5, md: 8 }}>
      <Box maxW="1100px" mx="auto">
        <SectionHeading
          eyebrow={t('support_tag')}
          title={t('support_title')}
          lede={t('support_sub')}
        />

        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
          {CHANNELS.map((ch) => (
            <Box
              key={ch.title}
              as={ch.external ? 'a' : NextLink}
              href={ch.href}
              target={ch.external ? '_blank' : undefined}
              rel={ch.external ? 'noopener noreferrer' : undefined}
              display="block"
              bg={cardBg} border="1px solid" borderColor={cardBorder}
              borderRadius="24px" p={6} cursor="pointer" role="group"
              transition="transform 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.35s, background 0.35s"
              _hover={{
                transform: 'translateY(-3px)',
                bg: cardBgHover,
                borderColor: strongBorder,
                boxShadow: shadow,
              }}
            >
              <VStack align="start" spacing={4} h="100%">
                <HStack justify="space-between" w="100%">
                  <Box
                    w="44px" h="44px" borderRadius="12px"
                    bg={accentSoft}
                    border="1px solid" borderColor={accentBorder}
                    display="flex" alignItems="center" justifyContent="center"
                    transition="background 0.2s"
                    _groupHover={{ bg: accentSoft }}
                  >
                    <Icon as={ch.icon} boxSize={5} color={accentText} />
                  </Box>
                </HStack>

                <VStack align="start" spacing={1.5} flex={1}>
                  <Text fontSize="16px" fontWeight="800" color={textMain} letterSpacing="-0.01em">
                    {ch.title}
                  </Text>
                  <Text fontSize="13.5px" color={textSub} lineHeight="1.6">
                    {ch.desc}
                  </Text>
                </VStack>

                <Text
                  fontSize="13px" fontWeight="700" color={textMain}
                  _groupHover={{ textDecoration: 'underline' }}
                  transition="all 0.15s"
                >
                  {ch.cta} →
                </Text>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
