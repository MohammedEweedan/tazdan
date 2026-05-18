'use client';

import NextLink from 'next/link';
import {
  Box, SimpleGrid, VStack, HStack, Heading,
  Text, Icon, useColorMode,
} from '@chakra-ui/react';
import {
  FiMessageCircle, FiBook, FiMail, FiZap,
} from 'react-icons/fi';

const CHANNELS = [
  {
    icon: FiMessageCircle,
    title: 'Live Chat',
    desc: 'Talk to a real person. Average response time under 3 minutes during business hours.',
    cta: 'Start chat',
    href: '/contact',
    color: '#22c55e',
    badge: 'Fastest',
  },
  {
    icon: FiBook,
    title: 'Help Center',
    desc: 'Browse 200+ step-by-step guides covering every feature from setup to advanced trading.',
    cta: 'Browse guides',
    href: '/help',
    color: '#0057b8',
    badge: null,
  },
  {
    icon: FiMail,
    title: 'Email Support',
    desc: 'For account issues, KYC disputes, or anything sensitive. We reply within 24 hours.',
    cta: 'Send email',
    href: '/contact',
    color: '#8b5cf6',
    badge: null,
  },
  {
    icon: FiZap,
    title: 'Community',
    desc: 'Join our Telegram group to get tips, trade signals, and early feature previews.',
    cta: 'Join Telegram',
    href: 'https://t.me/promrkts',
    color: '#f59e0b',
    badge: null,
  },
];

export default function SupportSection() {
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const textMain  = dark ? '#ffffff' : '#0a0f1e';
  const textSub   = dark ? 'rgba(255,255,255,0.55)' : '#64748b';
  const cardBg    = dark ? 'rgba(255,255,255,0.03)' : 'white';
  const cardBorder = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,87,184,0.09)';
  const accentBg  = dark ? 'rgba(0,87,184,0.12)' : 'rgba(0,87,184,0.06)';

  return (
    <Box id="support" py={{ base: 20, md: 28 }} px={{ base: 5, md: 8 }}>
      <Box maxW="1100px" mx="auto">
        {/* Header */}
        <VStack spacing={4} mb={{ base: 10, md: 14 }} textAlign="center">
          <Box
            display="inline-block"
            px={3} py={1}
            borderRadius="full"
            bg={accentBg}
            fontSize="11px"
            fontWeight="800"
            letterSpacing="0.12em"
            textTransform="uppercase"
            color="#0057b8"
          >
            Support
          </Box>
          <Heading
            fontSize={{ base: '34px', md: '50px' }}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={textMain}
            lineHeight="1.05"
          >
            We&apos;re here to help
          </Heading>
          <Text
            fontSize={{ base: '15px', md: '17px' }}
            color={textSub}
            maxW="420px"
          >
            Reach us however works best for you. Real humans, real answers — no bots.
          </Text>
        </VStack>

        {/* Cards */}
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
          {CHANNELS.map((ch) => {
            const isExternal = ch.href.startsWith('http');
            return (
              <Box
                key={ch.title}
                as={isExternal ? 'a' : NextLink}
                href={ch.href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                display="block"
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="20px"
                p={6}
                cursor="pointer"
                role="group"
                transition="all 0.2s ease"
                _hover={{
                  transform: 'translateY(-3px)',
                  boxShadow: dark
                    ? `0 12px 32px rgba(0,0,0,0.4)`
                    : `0 12px 32px rgba(0,87,184,0.1)`,
                  borderColor: ch.color,
                }}
              >
                <VStack align="start" spacing={4} h="100%">
                  {/* Icon + badge */}
                  <HStack justify="space-between" w="100%">
                    <Box
                      w="44px" h="44px"
                      borderRadius="12px"
                      bg={`${ch.color}18`}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      transition="background 0.2s"
                      _groupHover={{ bg: `${ch.color}28` }}
                    >
                      <Icon as={ch.icon} boxSize={5} color={ch.color} />
                    </Box>
                    {ch.badge && (
                      <Box
                        px={2.5} py={0.5}
                        borderRadius="full"
                        bg={`${ch.color}18`}
                        fontSize="10px"
                        fontWeight="800"
                        letterSpacing="0.08em"
                        textTransform="uppercase"
                        color={ch.color}
                      >
                        {ch.badge}
                      </Box>
                    )}
                  </HStack>

                  {/* Text */}
                  <VStack align="start" spacing={1.5} flex={1}>
                    <Text
                      fontSize="16px"
                      fontWeight="800"
                      color={textMain}
                      letterSpacing="-0.01em"
                    >
                      {ch.title}
                    </Text>
                    <Text
                      fontSize="13.5px"
                      color={textSub}
                      lineHeight="1.6"
                    >
                      {ch.desc}
                    </Text>
                  </VStack>

                  {/* CTA */}
                  <Text
                    fontSize="13px"
                    fontWeight="700"
                    color={ch.color}
                    _groupHover={{ textDecoration: 'underline' }}
                    transition="all 0.15s"
                  >
                    {ch.cta} →
                  </Text>
                </VStack>
              </Box>
            );
          })}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
