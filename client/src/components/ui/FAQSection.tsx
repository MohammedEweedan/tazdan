'use client';

import { useState } from 'react';
import {
  Box, Container, Heading, Text, VStack, HStack,
  Icon, Collapse, Divider, useColorMode,
} from '@chakra-ui/react';
import { FiPlus, FiMinus } from 'react-icons/fi';

const FAQS = [
  {
    q: 'What is promrkts?',
    a: 'promrkts is a MENA-first financial super-app. You can buy and sell crypto, hold fiat currencies (USD, EUR, GBP, AED, SAR, EGP, LYD), send money internationally, trade peer-to-peer, and get a virtual Visa card — all in one place.',
  },
  {
    q: 'Which countries are supported?',
    a: 'We focus on the MENA region: Libya, Egypt, UAE, Saudi Arabia, Jordan, Kuwait, Bahrain, Qatar, Oman, Morocco, Tunisia, Algeria, Lebanon, and Iraq — plus the UK and US for the diaspora. More territories are added regularly.',
  },
  {
    q: 'How do I deposit money?',
    a: 'You can deposit via bank transfer in your local currency, or by card (Visa / Mastercard / Apple Pay / Google Pay). On-chain crypto deposits (BTC, ETH, USDT, SOL, TRX) are also supported directly to your wallet address.',
  },
  {
    q: 'What are the fees?',
    a: 'Crypto-to-crypto swaps charge 0.5%. Card deposits have a 2.9% + $0.30 processing fee. Bank transfers are free. Early-access members get 0% fees for their first 6 months.',
  },
  {
    q: 'Is my money safe?',
    a: 'Yes. Fiat funds are held in segregated accounts. Crypto assets are held in cold-storage wallets with multi-signature authorization. We use Sumsub for KYC/AML compliance and require identity verification before withdrawals.',
  },
  {
    q: 'What is the P2P marketplace?',
    a: 'The P2P marketplace lets you trade directly with other users at the rate you set. An escrow system holds funds until both parties confirm, so every trade is safe — even between strangers.',
  },
  {
    q: 'How does the virtual Visa card work?',
    a: 'Once KYC is approved you can issue a virtual Visa card from your promrkts balance in under 60 seconds. Use it for online purchases, subscriptions, and international payments anywhere Visa is accepted.',
  },
  {
    q: 'Do I need to complete KYC?',
    a: 'Basic account features (crypto deposits, viewing prices) work without KYC. Fiat deposits, withdrawals, P2P trading, and the virtual card all require identity verification — typically completed in under 5 minutes with a government ID and selfie.',
  },
  {
    q: 'What currencies can I hold?',
    a: 'Fiat: USD, EUR, GBP, AED, SAR, EGP, LYD. Crypto: BTC, ETH, USDT, SOL, XRP, BNB, ADA, DOGE, MATIC, DOT, AVAX, and more being added each quarter.',
  },
  {
    q: 'How do I join the early-access waitlist?',
    a: 'Scroll down and enter your email. You\'ll get 0% fees for 6 months once we open your region. Refer friends to move up the list — each referral bumps you up automatically.',
  },
];

function FAQItem({ q, a, last }: { q: string; a: string; last?: boolean }) {
  const [open, setOpen] = useState(false);
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const textMain  = dark ? '#ffffff' : '#0a0f1e';
  const textSub   = dark ? 'rgba(255,255,255,0.6)' : '#475569';
  const border    = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,87,184,0.09)';
  const iconColor = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,87,184,0.5)';

  return (
    <Box borderBottom={last ? 'none' : '1px solid'} borderColor={border}>
      <HStack
        as="button"
        w="100%"
        onClick={() => setOpen(o => !o)}
        py={{ base: 5, md: 6 }}
        align="flex-start"
        justify="space-between"
        spacing={4}
        textAlign="left"
        _hover={{ opacity: 0.8 }}
        transition="opacity 0.15s"
      >
        <Text
          fontSize={{ base: '15px', md: '16px' }}
          fontWeight="700"
          color={textMain}
          lineHeight="1.4"
          flex={1}
        >
          {q}
        </Text>
        <Box
          flexShrink={0}
          w="22px" h="22px"
          borderRadius="full"
          border="1.5px solid"
          borderColor={iconColor}
          display="flex"
          alignItems="center"
          justifyContent="center"
          mt="1px"
        >
          <Icon as={open ? FiMinus : FiPlus} boxSize={3} color={iconColor} />
        </Box>
      </HStack>
      <Collapse in={open} animateOpacity>
        <Text
          fontSize={{ base: '14px', md: '15px' }}
          color={textSub}
          lineHeight="1.7"
          pb={6}
          maxW="680px"
        >
          {a}
        </Text>
      </Collapse>
    </Box>
  );
}

export default function FAQSection() {
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';
  const textMain = dark ? '#ffffff' : '#0a0f1e';
  const textSub  = dark ? 'rgba(255,255,255,0.55)' : '#64748b';
  const accentBg = dark ? 'rgba(0,87,184,0.12)' : 'rgba(0,87,184,0.06)';

  return (
    <Box id="faq" py={{ base: 20, md: 28 }} px={{ base: 5, md: 8 }}>
      <Box maxW="780px" mx="auto">
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
            FAQ
          </Box>
          <Heading
            fontSize={{ base: '34px', md: '50px' }}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={textMain}
            lineHeight="1.05"
          >
            Common questions
          </Heading>
          <Text
            fontSize={{ base: '15px', md: '17px' }}
            color={textSub}
            maxW="440px"
          >
            Everything you need to know before you start. Can&apos;t find an answer?{' '}
            <Box
              as="a"
              href="/contact"
              color="#0057b8"
              fontWeight="700"
              _hover={{ textDecoration: 'underline' }}
            >
              Ask us directly.
            </Box>
          </Text>
        </VStack>

        {/* Accordion */}
        <Box
          border="1px solid"
          borderColor={dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,87,184,0.09)'}
          borderRadius="20px"
          px={{ base: 5, md: 8 }}
          bg={dark ? 'rgba(255,255,255,0.02)' : 'white'}
          boxShadow={dark ? 'none' : '0 4px 24px rgba(0,87,184,0.06)'}
        >
          {FAQS.map((item, i) => (
            <FAQItem key={item.q} q={item.q} a={item.a} last={i === FAQS.length - 1} />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
