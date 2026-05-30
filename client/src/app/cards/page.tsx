'use client';

import {
  Box, Container, VStack, HStack, Heading, Text, Button, SimpleGrid,
  Icon, Flex,
} from '@chakra-ui/react';
import {
  FiCreditCard, FiShield, FiGlobe, FiZap, FiDollarSign, FiLock,
  FiArrowRight, FiCheck, FiWifi,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useColorMode } from '@chakra-ui/react';
import PublicNav from '@/components/ui/PublicNav';
import PublicFooter from '@/components/ui/PublicFooter';
import WaitlistSection from '@/components/ui/WaitlistSection';

const FEATURES = [
  { icon: FiGlobe,      title: 'Accepted Worldwide',     desc: 'Use anywhere Visa is accepted — online, in-store, at ATMs across 190+ countries.' },
  { icon: FiDollarSign, title: 'Zero FX Markup',         desc: 'No foreign exchange surcharge. Spend in any currency at the real mid-market rate.' },
  { icon: FiZap,        title: '1% USDT Cashback',       desc: 'Every purchase earns 1% back in USDT, deposited to your wallet automatically.' },
  { icon: FiShield,     title: 'Bank-grade Security',    desc: 'AES-256 encryption, real-time fraud monitoring, and instant card controls.' },
  { icon: FiLock,       title: 'Instant Freeze',         desc: 'Tap once to freeze or unfreeze your card in real time — no waiting, no hold music.' },
  { icon: FiCreditCard, title: 'Virtual & Physical',     desc: 'Get a virtual card instantly. Order a physical Mastercard for $10, delivered in 7 days.' },
];

const TIERS = [
  {
    name: 'Starter',
    price: 'Free',
    perks: ['Virtual card only', 'Up to $500/day spend', '0.5% USDT cashback', 'Standard support'],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Master',
    price: '$10',
    note: 'one-time card fee',
    perks: ['Virtual + physical card', 'Up to $10,000/day spend', '1% USDT cashback', 'Priority support', 'ATM withdrawals'],
    cta: 'Get Master Card',
    highlight: true,
  },
  {
    name: 'Pro',
    price: 'Custom',
    perks: ['Everything in Master', 'Unlimited daily spend', '1.5% USDT cashback', 'VIP account manager', 'Custom card design'],
    cta: 'Contact Sales',
    highlight: false,
  },
];

export default function CardsPage() {
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const pageBg     = dark ? '#000000' : '#ffffff';
  const textMain   = dark ? '#ffffff' : '#0a0f1e';
  const textSub    = dark ? 'rgba(255,255,255,0.6)' : '#64748b';
  const cardBg     = dark ? 'rgba(255,255,255,0.04)' : '#f4f4f4';
  const cardBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const ctaBg      = dark ? '#ffffff' : '#0a0f1e';
  const ctaFg      = dark ? '#000000' : '#ffffff';

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
                promrkts Card
              </Box>
              <Heading
                as="h1" fontWeight="900"
                fontSize={{ base: '52px', md: '96px' }}
                lineHeight="0.92" letterSpacing="-0.05em"
                bgGradient={titleGradient} bgClip="text"
              >
                Spend crypto{'\n'}anywhere
              </Heading>
              <Text
                fontSize={{ base: '15px', md: '19px' }} color={textSub}
                maxW="520px" lineHeight="1.7"
              >
                A Visa card that turns your crypto into spending power. No FX fees, 1% cashback in USDT, accepted in 190+ countries.
              </Text>
              <HStack spacing={3} pt={2} flexWrap="wrap" justify="center">
                <Button
                  h="52px" px={8} bg={ctaBg} color={ctaFg}
                  borderRadius="full" fontWeight="800" fontSize="14px"
                  rightIcon={<Icon as={FiArrowRight} />}
                  _hover={{ opacity: 0.88, transform: 'translateY(-1px)' }}
                  transition="all 0.15s"
                >
                  Get Your Card
                </Button>
                <Button
                  as="a" href="#tiers"
                  h="52px" px={8}
                  bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                  color={textMain}
                  border="1px solid" borderColor={cardBorder}
                  borderRadius="full" fontWeight="700" fontSize="14px"
                  _hover={{ bg: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}
                  transition="all 0.15s"
                >
                  Compare Tiers
                </Button>
              </HStack>
            </VStack>
          </motion.div>
        </Container>
      </Box>

      {/* ── Card Visual ── */}
      <Box py={{ base: 10, md: 16 }}>
        <Container maxW="480px">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <Box
              position="relative" borderRadius="28px" overflow="hidden"
              bg={dark ? '#ffffff' : '#000000'}
              boxShadow={dark
                ? '0 40px 100px rgba(255,255,255,0.14)'
                : '0 40px 100px rgba(0,0,0,0.35)'}
              style={{ aspectRatio: '1.586 / 1' }}
              p={{ base: 6, md: 8 }}
            >
              <Flex justify="space-between" align="center" mb={6}>
                <Text
                  fontSize={{ base: '14px', md: '16px' }}
                  fontWeight="900"
                  color={dark ? '#0a0f1e' : '#ffffff'}
                  letterSpacing="-0.02em"
                >
                  promrkts
                </Text>
                <Icon
                  as={FiWifi}
                  color={dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'}
                  boxSize={5}
                  style={{ transform: 'rotate(90deg)' }}
                />
              </Flex>
              <Text
                fontSize={{ base: '18px', md: '22px' }}
                fontFamily="monospace"
                letterSpacing="0.18em"
                fontWeight="700"
                color={dark ? '#0a0f1e' : '#ffffff'}
                mb={6}
              >
                1144 •••• •••• 2288
              </Text>
              <Flex justify="space-between" align="flex-end">
                <VStack align="start" spacing={0}>
                  <Text
                    fontSize="10px"
                    color={dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'}
                    letterSpacing="0.1em"
                  >
                    CARD HOLDER
                  </Text>
                  <Text
                    fontSize={{ base: '13px', md: '15px' }}
                    fontWeight="700"
                    color={dark ? '#0a0f1e' : '#ffffff'}
                  >
                    YOUR NAME
                  </Text>
                </VStack>
                <Text
                  fontSize={{ base: '20px', md: '24px' }}
                  fontWeight="900"
                  fontStyle="italic"
                  color={dark ? '#0a0f1e' : '#ffffff'}
                >
                  VISA
                </Text>
              </Flex>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* ── Features ── */}
      <Box py={{ base: 16, md: 24 }}>
        <Container maxW="1100px">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <VStack spacing={3} mb={{ base: 10, md: 14 }} textAlign="center">
              <Text
                fontSize="11px" fontWeight="800" letterSpacing="0.14em"
                textTransform="uppercase" color={textSub}
              >
                CARD FEATURES
              </Text>
              <Heading
                fontSize={{ base: '32px', md: '52px' }} fontWeight="900"
                letterSpacing="-0.04em" color={textMain} lineHeight="1"
              >
                Everything you need
              </Heading>
            </VStack>
          </motion.div>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
              >
                <Box
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="20px" p={6} h="100%"
                  transition="all 0.2s ease"
                  _hover={{ transform: 'translateY(-3px)', borderColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}
                >
                  <Flex
                    w="40px" h="40px" borderRadius="12px"
                    bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                    border="1px solid" borderColor={cardBorder}
                    align="center" justify="center" mb={4}
                  >
                    <Icon as={f.icon} color={textMain} boxSize={4} />
                  </Flex>
                  <Text
                    fontSize="16px" fontWeight="800" color={textMain}
                    mb={2} letterSpacing="-0.01em"
                  >
                    {f.title}
                  </Text>
                  <Text fontSize="13.5px" color={textSub} lineHeight="1.6">{f.desc}</Text>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ── Tiers ── */}
      <Box py={{ base: 16, md: 24 }} id="tiers" bg={dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}>
        <Container maxW="1100px">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
          >
            <VStack spacing={3} mb={{ base: 10, md: 14 }} textAlign="center">
              <Text
                fontSize="11px" fontWeight="800" letterSpacing="0.14em"
                textTransform="uppercase" color={textSub}
              >
                CARD TIERS
              </Text>
              <Heading
                fontSize={{ base: '32px', md: '52px' }} fontWeight="900"
                letterSpacing="-0.04em" color={textMain} lineHeight="1"
              >
                Choose your tier
              </Heading>
            </VStack>
          </motion.div>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <VStack
                  bg={tier.highlight
                    ? (dark ? '#ffffff' : '#0a0f1e')
                    : cardBg}
                  border="1px solid"
                  borderColor={tier.highlight
                    ? (dark ? 'transparent' : 'transparent')
                    : cardBorder}
                  borderRadius="24px" p={7} spacing={5} align="start" h="100%"
                  transition="all 0.2s ease"
                  _hover={{ transform: 'translateY(-4px)' }}
                  boxShadow={tier.highlight
                    ? (dark
                      ? '0 24px 60px rgba(255,255,255,0.12)'
                      : '0 24px 60px rgba(0,0,0,0.20)')
                    : 'none'}
                >
                  <Box>
                    <Text
                      fontSize="12px" fontWeight="800" letterSpacing="0.1em"
                      textTransform="uppercase"
                      color={tier.highlight ? (dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)') : textSub}
                      mb={1}
                    >
                      {tier.name}
                    </Text>
                    <HStack align="baseline" spacing={1}>
                      <Text
                        fontSize="40px" fontWeight="900" letterSpacing="-0.04em"
                        color={tier.highlight ? (dark ? '#0a0f1e' : '#ffffff') : textMain}
                        lineHeight="1"
                      >
                        {tier.price}
                      </Text>
                      {tier.note && (
                        <Text
                          fontSize="12px"
                          color={tier.highlight ? (dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)') : textSub}
                        >
                          {tier.note}
                        </Text>
                      )}
                    </HStack>
                  </Box>
                  <VStack align="start" spacing={3} flex={1} w="100%">
                    {tier.perks.map((perk) => (
                      <HStack key={perk} spacing={2.5}>
                        <Icon
                          as={FiCheck} boxSize={3.5}
                          color={tier.highlight ? (dark ? '#0a0f1e' : '#ffffff') : textMain}
                          flexShrink={0}
                        />
                        <Text
                          fontSize="13.5px" fontWeight="500"
                          color={tier.highlight ? (dark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)') : textSub}
                        >
                          {perk}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                  <Button
                    w="100%" h="46px"
                    bg={tier.highlight
                      ? (dark ? '#0a0f1e' : '#ffffff')
                      : ctaBg}
                    color={tier.highlight
                      ? (dark ? '#ffffff' : '#0a0f1e')
                      : ctaFg}
                    borderRadius="full" fontWeight="700" fontSize="13.5px"
                    _hover={{ opacity: 0.88 }}
                    transition="all 0.15s"
                  >
                    {tier.cta}
                  </Button>
                </VStack>
              </motion.div>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      <WaitlistSection />
      <PublicFooter />
    </Box>
  );
}
