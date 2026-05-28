'use client';

import NextLink from 'next/link';
import { useTranslate } from '@tolgee/react';
import {
  Box, SimpleGrid, VStack, HStack, Heading,
  Text, Icon, useColorMode,
} from '@chakra-ui/react';
import { FiSmartphone, FiBook, FiMail, FiZap } from 'react-icons/fi';

export default function SupportSection() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const textMain   = dark ? '#ffffff' : '#0a0f1e';
  const textSub    = dark ? 'rgba(255,255,255,0.55)' : '#64748b';
  const cardBg     = dark ? 'rgba(255,255,255,0.04)' : '#f4f4f4';
  const cardBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';

  const CHANNELS = [
    {
      icon: FiSmartphone,
      title: t('support_app_title'),
      desc: t('support_app_desc'),
      cta: t('support_app_cta'),
      href: 'https://apps.apple.com',
      badge: t('support_fastest'),
      external: true,
    },
    {
      icon: FiBook,
      title: t('support_faq_title'),
      desc: t('support_faq_desc'),
      cta: t('support_faq_cta'),
      href: '/faq',
      badge: null,
      external: false,
    },
    {
      icon: FiMail,
      title: t('support_email_title'),
      desc: t('support_email_desc'),
      cta: t('support_email_cta'),
      href: '/contact',
      badge: null,
      external: false,
    },
    {
      icon: FiZap,
      title: t('support_community_title'),
      desc: t('support_community_desc'),
      cta: t('support_community_cta'),
      href: 'https://t.me/Fortuni',
      badge: null,
      external: true,
    },
  ];

  return (
    <Box id="support" py={{ base: 20, md: 28 }} px={{ base: 5, md: 8 }}>
      <Box maxW="1100px" mx="auto">
        <VStack spacing={4} mb={{ base: 10, md: 14 }} textAlign="center">
          <Text fontSize="11px" fontWeight="800" letterSpacing="0.14em" color={textSub} textTransform="uppercase">
            {t('support_tag')}
          </Text>
          <Heading
            fontSize={{ base: '34px', md: '50px' }}
            fontWeight="900" letterSpacing="-0.04em"
            color={textMain} lineHeight="1.05"
          >
            {t('support_title')}
          </Heading>
          <Text fontSize={{ base: '15px', md: '17px' }} color={textSub} maxW="420px">
            {t('support_sub')}
          </Text>
        </VStack>

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
              borderRadius="20px" p={6} cursor="pointer" role="group"
              transition="all 0.2s ease"
              _hover={{
                transform: 'translateY(-3px)',
                borderColor: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.4)' : '0 12px 32px rgba(0,0,0,0.08)',
              }}
            >
              <VStack align="start" spacing={4} h="100%">
                <HStack justify="space-between" w="100%">
                  <Box
                    w="44px" h="44px" borderRadius="12px"
                    bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                    border="1px solid" borderColor={cardBorder}
                    display="flex" alignItems="center" justifyContent="center"
                    transition="background 0.2s"
                    _groupHover={{ bg: dark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)' }}
                  >
                    <Icon as={ch.icon} boxSize={5} color={textMain} />
                  </Box>
                  {ch.badge && (
                    <Box
                      px={2.5} py={0.5} borderRadius="full"
                      bg={dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'}
                      fontSize="10px" fontWeight="800" letterSpacing="0.08em"
                      textTransform="uppercase" color={textSub}
                    >
                      {ch.badge}
                    </Box>
                  )}
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
