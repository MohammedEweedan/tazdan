'use client';

import { useState } from 'react';
import { useTranslate } from '@tolgee/react';
import {
  Box, Container, Heading, Text, VStack, HStack,
  Icon, Collapse, Divider, useColorMode,
} from '@chakra-ui/react';
import { FiPlus, FiMinus } from 'react-icons/fi';

const FAQ_KEYS = [
  { q: 'faq_s_q1',  a: 'faq_s_a1'  },
  { q: 'faq_s_q2',  a: 'faq_s_a2'  },
  { q: 'faq_s_q3',  a: 'faq_s_a3'  },
  { q: 'faq_s_q4',  a: 'faq_s_a4'  },
  { q: 'faq_s_q5',  a: 'faq_s_a5'  },
  { q: 'faq_s_q6',  a: 'faq_s_a6'  },
  { q: 'faq_s_q7',  a: 'faq_s_a7'  },
  { q: 'faq_s_q8',  a: 'faq_s_a8'  },
  { q: 'faq_s_q9',  a: 'faq_s_a9'  },
  { q: 'faq_s_q10', a: 'faq_s_a10' },
];

function FAQItem({ q, a, last }: { q: string; a: string; last?: boolean }) {
  const [open, setOpen] = useState(false);
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const textMain  = dark ? '#ffffff' : '#0a0f1e';
  const textSub   = dark ? 'rgba(255,255,255,0.6)' : '#475569';
  const border    = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const iconColor = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';

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
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';
  const textMain = dark ? '#ffffff' : '#0a0f1e';
  const textSub  = dark ? 'rgba(255,255,255,0.55)' : '#64748b';
  const accentBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

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
            color={textMain}
          >
            {t('faq_section_tag')}
          </Box>
          <Heading
            fontSize={{ base: '34px', md: '50px' }}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={textMain}
            lineHeight="1.05"
          >
            {t('faq_section_title')}
          </Heading>
          <Text
            fontSize={{ base: '15px', md: '17px' }}
            color={textSub}
            maxW="440px"
          >
            {t('faq_section_sub')}{' '}
            <Box
              as="a"
              href="/contact"
              color={textMain}
              fontWeight="700"
              _hover={{ textDecoration: 'underline' }}
            >
              {t('faq_section_ask')}
            </Box>
          </Text>
        </VStack>

        {/* Accordion */}
        <Box
          border="1px solid"
          borderColor={dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}
          borderRadius="20px"
          px={{ base: 5, md: 8 }}
          bg={dark ? 'rgba(255,255,255,0.02)' : '#f9f9f9'}
          boxShadow={dark ? 'none' : '0 4px 24px rgba(0,0,0,0.04)'}
        >
          {FAQ_KEYS.map((item, i) => (
            <FAQItem key={item.q} q={t(item.q)} a={t(item.a)} last={i === FAQ_KEYS.length - 1} />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
