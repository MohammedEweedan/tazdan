'use client';

import {
  Box, Container, VStack, HStack, Heading, Text, Button, SimpleGrid,
  Icon, Flex,
} from '@chakra-ui/react';
import {
  FiSend, FiShield, FiGlobe, FiZap, FiCreditCard, FiLock,
  FiArrowRight, FiRepeat, FiBarChart2, FiMessageSquare, FiUser,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useColorMode } from '@chakra-ui/react';
import PublicNav from '@/components/ui/PublicNav';
import PublicFooter from '@/components/ui/PublicFooter';
import WaitlistSection from '@/components/ui/WaitlistSection';

const FEATURE_GROUPS = [
  {
    eyebrow: 'P2P MARKETPLACE',
    title: 'Trade directly,\nnot through middlemen',
    desc: 'Our order-book P2P marketplace lets you buy and sell crypto directly with verified peers. Makers pay 0%, takers pay 0.25% — no spread, no hidden fees.',
    features: [
      { icon: FiRepeat,     label: 'Maker / Taker model' },
      { icon: FiShield,     label: 'Escrow protection' },
      { icon: FiUser,       label: 'Verified peer IDs' },
      { icon: FiBarChart2,  label: '400+ trading pairs' },
    ],
  },
  {
    eyebrow: 'INSTANT TRANSFERS',
    title: 'Send money\nin under 2 seconds',
    desc: 'Transfer crypto or fiat to anyone by @handle. No SWIFT delays, no bank queues, no FX markup. Works across Libya, Egypt, UAE, Saudi Arabia and growing.',
    features: [
      { icon: FiZap,    label: '<2s settlement' },
      { icon: FiGlobe,  label: '120+ countries' },
      { icon: FiSend,   label: 'Send by @handle' },
      { icon: FiLock,   label: 'AES-256 encrypted' },
    ],
  },
  {
    eyebrow: 'SOCIAL WALLET',
    title: 'Finance meets\nyour social graph',
    desc: 'Every @handle is a wallet. Pay friends directly from a chat thread, split bills, leave payment notes, and view your full history — all in one feed.',
    features: [
      { icon: FiMessageSquare, label: 'In-chat payments' },
      { icon: FiUser,          label: 'Custom @handles' },
      { icon: FiRepeat,        label: 'Split bills' },
      { icon: FiBarChart2,     label: 'Full history' },
    ],
  },
  {
    eyebrow: 'VISA CARD',
    title: 'Spend crypto\neverywhere',
    desc: 'A virtual or physical Visa card that auto-converts your crypto at checkout. Zero FX markup, 1% USDT cashback, and real-time freeze from the app.',
    features: [
      { icon: FiCreditCard, label: 'Virtual & physical' },
      { icon: FiGlobe,      label: '190+ countries' },
      { icon: FiZap,        label: '1% USDT cashback' },
      { icon: FiLock,       label: 'Instant freeze' },
    ],
  },
  {
    eyebrow: 'SECURITY',
    title: 'Bank-grade\nprotection',
    desc: 'Every asset is protected by AES-256 encryption, cold-custody storage, biometric authentication, 2FA, and a 24/7 SOC team monitoring for threats.',
    features: [
      { icon: FiShield, label: 'AES-256 encryption' },
      { icon: FiLock,   label: 'Cold custody' },
      { icon: FiUser,   label: 'Biometric 2FA' },
      { icon: FiZap,    label: '24/7 SOC monitoring' },
    ],
  },
];

const STAT_STRIP = [
  { value: '<2s',    label: 'Settlement time' },
  { value: '0%',     label: 'Maker fee' },
  { value: '400+',   label: 'Trading pairs' },
  { value: '120+',   label: 'Countries served' },
  { value: '2,400+', label: 'Waitlisted users' },
];

export default function FeaturesPage() {
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const pageBg     = dark ? '#000000' : '#ffffff';
  const textMain   = dark ? '#ffffff' : '#0a0f1e';
  const textSub    = dark ? 'rgba(255,255,255,0.6)' : '#64748b';
  const cardBg     = dark ? 'rgba(255,255,255,0.04)' : '#f4f4f4';
  const cardBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const ctaBg      = dark ? '#ffffff' : '#0a0f1e';
  const ctaFg      = dark ? '#000000' : '#ffffff';
  const stripBg    = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  const titleGradient = dark
    ? 'linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)'
    : 'linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)';

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* ── Hero ── */}
      <Box pt={{ base: '120px', md: '170px' }} pb={{ base: 14, md: 20 }} textAlign="center">
        <Container maxW="900px">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <VStack spacing={6}>
              <Box
                display="inline-block" px={3} py={1} borderRadius="full"
                bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                border="1px solid" borderColor={cardBorder}
                fontSize="11px" fontWeight="800" letterSpacing="0.14em"
                textTransform="uppercase" color={textMain}
              >
                Platform Features
              </Box>
              <Heading
                as="h1" fontWeight="900"
                fontSize={{ base: '52px', md: '96px' }}
                lineHeight="0.92" letterSpacing="-0.05em"
                bgGradient={titleGradient} bgClip="text"
              >
                Everything{'\n'}in one app
              </Heading>
              <Text
                fontSize={{ base: '15px', md: '19px' }} color={textSub}
                maxW="540px" lineHeight="1.7"
              >
                P2P trading, instant transfers, a social wallet, a Visa card, and bank-grade security — built specifically for the MENA region.
              </Text>
              <HStack spacing={3} pt={2} flexWrap="wrap" justify="center">
                <Button
                  h="52px" px={8} bg={ctaBg} color={ctaFg}
                  borderRadius="full" fontWeight="800" fontSize="14px"
                  rightIcon={<Icon as={FiArrowRight} />}
                  _hover={{ opacity: 0.88, transform: 'translateY(-1px)' }}
                  transition="all 0.15s"
                >
                  Join Waitlist
                </Button>
                <Button
                  as="a" href="#features-list"
                  h="52px" px={8}
                  bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                  color={textMain}
                  border="1px solid" borderColor={cardBorder}
                  borderRadius="full" fontWeight="700" fontSize="14px"
                  _hover={{ bg: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}
                  transition="all 0.15s"
                >
                  Explore Features
                </Button>
              </HStack>
            </VStack>
          </motion.div>
        </Container>
      </Box>

      {/* ── Stat strip ── */}
      <Box py={{ base: 8, md: 12 }} bg={stripBg} borderY="1px solid" borderColor={cardBorder}>
        <Container maxW="1100px">
          <SimpleGrid columns={{ base: 2, sm: 3, md: 5 }} gap={{ base: 6, md: 0 }}>
            {STAT_STRIP.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
              >
                <VStack
                  spacing={1} textAlign="center"
                  borderRight={i < STAT_STRIP.length - 1 ? '1px solid' : 'none'}
                  borderColor={cardBorder}
                  px={4}
                >
                  <Text
                    fontSize={{ base: '28px', md: '36px' }}
                    fontWeight="900" letterSpacing="-0.04em"
                    color={textMain} lineHeight="1"
                    fontFamily="'DM Sans', sans-serif"
                  >
                    {s.value}
                  </Text>
                  <Text fontSize="11px" fontWeight="600" color={textSub} letterSpacing="0.06em" textTransform="uppercase">
                    {s.label}
                  </Text>
                </VStack>
              </motion.div>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ── Feature groups ── */}
      <Box id="features-list">
        {FEATURE_GROUPS.map((group, gi) => (
          <Box
            key={group.eyebrow}
            py={{ base: 16, md: 24 }}
            bg={gi % 2 === 1 ? (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : pageBg}
          >
            <Container maxW="1100px">
              <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 10, lg: 16 }} alignItems="center">

                {/* Text side */}
                <motion.div
                  initial={{ opacity: 0, x: gi % 2 === 0 ? -32 : 32 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  style={{ order: gi % 2 === 0 ? 1 : 2 }}
                >
                  <VStack align={{ base: 'center', lg: 'start' }} spacing={6} textAlign={{ base: 'center', lg: 'start' }}>
                    <Text
                      fontSize="11px" fontWeight="800" letterSpacing="0.14em"
                      textTransform="uppercase" color={textSub}
                    >
                      {group.eyebrow}
                    </Text>
                    <Heading
                      fontSize={{ base: '36px', md: '52px' }} fontWeight="900"
                      letterSpacing="-0.04em" color={textMain} lineHeight="1.05"
                      whiteSpace="pre-line"
                    >
                      {group.title}
                    </Heading>
                    <Text fontSize={{ base: '14.5px', md: '16.5px' }} color={textSub} maxW="440px" lineHeight="1.7">
                      {group.desc}
                    </Text>
                    <SimpleGrid columns={2} gap={3} w="100%" maxW="440px">
                      {group.features.map((f, fi) => (
                        <motion.div
                          key={f.label}
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.3 }}
                          transition={{ duration: 0.4, delay: 0.08 * fi }}
                        >
                          <HStack
                            h="60px"
                            bg={cardBg} border="1px solid" borderColor={cardBorder}
                            borderRadius="14px" px={4} spacing={3}
                            transition="all 0.2s ease"
                            _hover={{ transform: 'translateY(-2px)', borderColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}
                          >
                            <Flex
                              w="32px" h="32px" borderRadius="9px"
                              bg={dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
                              border="1px solid" borderColor={cardBorder}
                              align="center" justify="center" flexShrink={0}
                            >
                              <Icon as={f.icon} color={textMain} boxSize={3.5} />
                            </Flex>
                            <Text fontSize="12.5px" fontWeight="700" color={textMain} lineHeight="1.3">{f.label}</Text>
                          </HStack>
                        </motion.div>
                      ))}
                    </SimpleGrid>
                  </VStack>
                </motion.div>

                {/* Visual side */}
                <motion.div
                  initial={{ opacity: 0, x: gi % 2 === 0 ? 32 : -32 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                  style={{ order: gi % 2 === 0 ? 2 : 1 }}
                >
                  <Flex justify="center" align="center">
                    <Box
                      w={{ base: '240px', md: '340px' }}
                      h={{ base: '240px', md: '340px' }}
                      borderRadius="32px"
                      bg={dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
                      border="1px solid" borderColor={cardBorder}
                      display="flex" alignItems="center" justifyContent="center"
                    >
                      <Icon
                        as={group.features[0].icon}
                        boxSize={{ base: '72px', md: '96px' }}
                        color={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                      />
                    </Box>
                  </Flex>
                </motion.div>

              </SimpleGrid>
            </Container>
          </Box>
        ))}
      </Box>

      <WaitlistSection />
      <PublicFooter />
    </Box>
  );
}
