"use client";

import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import NextLink from "next/link";
import {
  Box, Container, Heading, Text, VStack, HStack, SimpleGrid,
  Input, InputGroup, InputLeftElement,
  Icon, Flex, Button, useColorMode, useDisclosure,
} from "@chakra-ui/react";
import {
  FiSearch, FiUserPlus, FiShield, FiRepeat, FiSend,
  FiCreditCard, FiDollarSign, FiArrowRight, FiMessageSquare,
  FiZap, FiPlus, FiMinus,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import WaitlistSection from "@/components/ui/WaitlistSection";
import WaitlistModal from "@/components/ui/WaitlistModal";

export default function FAQPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const [q, setQ] = useState("");
  const { isOpen: isWaitlistOpen, onOpen: onWaitlistOpen, onClose: onWaitlistClose } = useDisclosure();

  const pageBg    = dark ? "#000000" : "#ffffff";
  const textMain  = dark ? "#ffffff" : "#0a0f1e";
  const textSub   = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const inputBg   = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const ctaBg     = dark ? "#ffffff" : "#0a0f1e";
  const ctaFg     = dark ? "#000000" : "#ffffff";

  const titleGradient = dark
    ? "linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)"
    : "linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)";

  const cats = [
    { icon: FiUserPlus,   label: t("page_help_cat_getting"),  desc: t("page_help_cat_getting_d") },
    { icon: FiShield,     label: t("page_help_cat_security"), desc: t("page_help_cat_security_d") },
    { icon: FiRepeat,     label: t("page_help_cat_trading"),  desc: t("page_help_cat_trading_d") },
    { icon: FiSend,       label: t("page_help_cat_wallet"),   desc: t("page_help_cat_wallet_d") },
    { icon: FiCreditCard, label: t("page_help_cat_card"),     desc: t("page_help_cat_card_d") },
    { icon: FiDollarSign, label: t("page_help_cat_fees"),     desc: t("page_help_cat_fees_d") },
    { icon: FiZap,        label: t("page_help_cat_tokens"),   desc: t("page_help_cat_tokens_d") },
  ];

  const allFaqs = [
    { q: t("page_help_faq1_q"), a: t("page_help_faq1_a") },
    { q: t("page_help_faq2_q"), a: t("page_help_faq2_a") },
    { q: t("page_help_faq3_q"), a: t("page_help_faq3_a") },
    { q: t("page_help_faq4_q"), a: t("page_help_faq4_a") },
    { q: t("page_help_faq5_q"), a: t("page_help_faq5_a") },
    { q: t("page_help_faq6_q"), a: t("page_help_faq6_a") },
    { q: t("page_help_faq7_q"), a: t("page_help_faq7_a") },
    { q: t("page_help_faq8_q"), a: t("page_help_faq8_a") },
    { q: t("faq_s_q1"),  a: t("faq_s_a1") },
    { q: t("faq_s_q2"),  a: t("faq_s_a2") },
    { q: t("faq_s_q3"),  a: t("faq_s_a3") },
    { q: t("faq_s_q4"),  a: t("faq_s_a4") },
    { q: t("faq_s_q5"),  a: t("faq_s_a5") },
    { q: t("faq_s_q6"),  a: t("faq_s_a6") },
    { q: t("faq_s_q7"),  a: t("faq_s_a7") },
    { q: t("faq_s_q8"),  a: t("faq_s_a8") },
    { q: t("faq_s_q9"),  a: t("faq_s_a9") },
    { q: t("faq_s_q10"), a: t("faq_s_a10") },
  ];

  const seen = new Set<string>();
  const dedupedFaqs = allFaqs.filter((f) => {
    if (seen.has(f.q)) return false;
    seen.add(f.q);
    return true;
  });

  const filtered = q
    ? dedupedFaqs.filter(
        (f) =>
          f.q.toLowerCase().includes(q.toLowerCase()) ||
          f.a.toLowerCase().includes(q.toLowerCase())
      )
    : dedupedFaqs;

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box pt={{ base: "120px", md: "160px" }} pb={{ base: 10, md: 16 }} textAlign="center">
        <Container maxW="820px">
          <VStack spacing={6}>
            <Heading
              as="h1"
              fontWeight="900"
              fontSize={{ base: "48px", md: "80px" }}
              lineHeight="1.0"
              letterSpacing="-0.04em"
              bgGradient={titleGradient}
              bgClip="text"
              whiteSpace="pre-line"
            >
              {t("faq_page_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="520px" lineHeight="1.7">
              {t("faq_page_sub")}
            </Text>

            {/* Search */}
            <InputGroup maxW="560px" size="lg" mt={2}>
              <InputLeftElement pointerEvents="none" h="56px" ps={5}>
                <Icon as={FiSearch} color={textSub} boxSize={5} />
              </InputLeftElement>
              <Input
                placeholder={t("page_help_search_ph")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                h="56px" ps="52px"
                bg={inputBg} border="1px solid" borderColor={cardBorder}
                borderRadius="16px" fontSize="15px" color={textMain}
                _placeholder={{ color: textSub }}
                _focus={{ borderColor: textMain, boxShadow: "none" }}
              />
            </InputGroup>

            <HStack spacing={3} pt={1} flexWrap="wrap" justify="center">
              <Button
                onClick={onWaitlistOpen}
                h="46px" px={6}
                bg={ctaBg} color={ctaFg}
                borderRadius="full" fontWeight="700" fontSize="14px"
                rightIcon={<Icon as={FiArrowRight} />}
                _hover={{ opacity: 0.88, transform: "translateY(-1px)" }}
                transition="all 0.15s"
              >
                {t("faq_page_cta_waitlist")}
              </Button>
              <Button
                as={NextLink} href="/contact"
                h="46px" px={6} variant="outline"
                borderRadius="full" fontWeight="700" fontSize="14px"
                color={textMain} borderColor={cardBorder}
                _hover={{ bg: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
              >
                {t("faq_page_cta_contact")}
              </Button>
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* Category cards — only when not searching */}
      {!q && (
        <Container maxW="1100px" pb={{ base: 6, md: 10 }}>
          <VStack spacing={4} mb={8} textAlign="center">
            <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.14em" textTransform="uppercase">
              {t("faq_section_tag")}
            </Text>
            <Heading fontSize={{ base: "28px", md: "40px" }} fontWeight="900" letterSpacing="-0.04em" color={textMain}>
              {t("page_help_title")}
            </Heading>
          </VStack>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
            {cats.map((c) => (
              <Box
                key={c.label}
                bg={cardBg} border="1px solid" borderColor={cardBorder}
                borderRadius="20px" p={6} cursor="pointer"
                transition="all 0.2s ease"
                _hover={{ transform: "translateY(-3px)", borderColor: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}
              >
                <Flex
                  w="42px" h="42px" borderRadius="12px"
                  bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                  border="1px solid" borderColor={cardBorder}
                  align="center" justify="center" mb={4}
                >
                  <Icon as={c.icon} color={textMain} boxSize={5} />
                </Flex>
                <Heading fontSize="17px" fontWeight="700" color={textMain} letterSpacing="-0.01em" mb={1.5}>
                  {c.label}
                </Heading>
                <Text fontSize="13.5px" color={textSub} lineHeight="1.6">{c.desc}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </Container>
      )}

      {/* FAQ accordion */}
      <Container maxW="820px" py={{ base: 12, md: 20 }}>
        <VStack spacing={10} align="stretch">
          <Heading
            fontSize={{ base: "28px", md: "40px" }} fontWeight="900"
            letterSpacing="-0.04em" textAlign="center" color={textMain}
          >
            {q ? t("faq_search_results") : t("faq_section_title")}
          </Heading>

          {filtered.length === 0 ? (
            <Box
              textAlign="center" py={12}
              bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="20px"
            >
              <Text color={textSub} fontSize="15px">{t("faq_no_results")}</Text>
              <Button mt={4} variant="ghost" color={textMain} fontWeight="700" onClick={() => setQ("")}>
                {t("faq_clear_search")}
              </Button>
            </Box>
          ) : (
            <Box
              border="1px solid" borderColor={cardBorder} borderRadius="20px"
              px={{ base: 5, md: 8 }}
              bg={dark ? "rgba(255,255,255,0.02)" : "#f9f9f9"}
            >
              {filtered.map((f, i) => (
                <FAQItem key={f.q} q={f.q} a={f.a} last={i === filtered.length - 1} dark={dark} textMain={textMain} textSub={textSub} />
              ))}
            </Box>
          )}
        </VStack>
      </Container>

      {/* Contact CTA */}
      <Container maxW="900px" pb={{ base: 10, md: 16 }}>
        <Box
          bg={cardBg} border="1px solid" borderColor={cardBorder}
          borderRadius="28px" p={{ base: 8, md: 12 }}
          textAlign="center"
        >
          <Flex
            w="56px" h="56px"
            bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
            border="1px solid" borderColor={cardBorder}
            borderRadius="16px" align="center" justify="center" mx="auto" mb={5}
          >
            <Icon as={FiMessageSquare} color={textMain} boxSize={6} />
          </Flex>
          <Heading fontSize={{ base: "22px", md: "28px" }} fontWeight="900" color={textMain} letterSpacing="-0.03em" mb={2}>
            {t("page_help_contact_title")}
          </Heading>
          <Text fontSize="14.5px" color={textSub} mb={6} maxW="440px" mx="auto">
            {t("page_help_contact_d")}
          </Text>
          <Button
            as={NextLink} href="/contact"
            h="48px" px={7}
            bg={ctaBg} color={ctaFg}
            borderRadius="12px" fontWeight="800" fontSize="13.5px"
            rightIcon={<Icon as={FiArrowRight} />}
            _hover={{ opacity: 0.9 }}
          >
            {t("nav_contact")}
          </Button>
        </Box>
      </Container>

      <WaitlistSection />
      <WaitlistModal isOpen={isWaitlistOpen} onClose={onWaitlistClose} />
      <PublicFooter />
    </Box>
  );
}

function FAQItem({ q, a, last, dark, textMain, textSub }: {
  q: string; a: string; last?: boolean; dark: boolean; textMain: string; textSub: string;
}) {
  const [open, setOpen] = useState(false);
  const border    = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const iconColor = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";

  return (
    <Box borderBottom={last ? "none" : "1px solid"} borderColor={border}>
      <HStack
        as="button" w="100%"
        onClick={() => setOpen((o) => !o)}
        py={{ base: 5, md: 6 }}
        align="flex-start" justify="space-between"
        spacing={4} textAlign="left"
        _hover={{ opacity: 0.75 }} transition="opacity 0.15s"
      >
        <Text fontSize={{ base: "15px", md: "16px" }} fontWeight="700" color={textMain} lineHeight="1.4" flex={1}>
          {q}
        </Text>
        <Box
          flexShrink={0} w="22px" h="22px" borderRadius="full"
          border="1.5px solid" borderColor={iconColor}
          display="flex" alignItems="center" justifyContent="center" mt="1px"
        >
          <Icon as={open ? FiMinus : FiPlus} boxSize={3} color={iconColor} />
        </Box>
      </HStack>
      {open && (
        <Text fontSize={{ base: "14px", md: "15px" }} color={textSub} lineHeight="1.75" pb={6} maxW="680px">
          {a}
        </Text>
      )}
    </Box>
  );
}
