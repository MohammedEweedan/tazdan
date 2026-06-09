"use client";

import { useMemo, useState } from "react";
import { useTranslate } from "@tolgee/react";
import NextLink from "next/link";
import {
  Box, Button, Container, Flex, Heading, HStack, Icon,
  Input, InputGroup, InputLeftElement, Text, VStack, useColorMode,
} from "@chakra-ui/react";
import {
  FiArrowRight, FiCreditCard, FiDollarSign, FiGrid, FiMessageSquare,
  FiMinus, FiPlus, FiRepeat, FiSearch, FiSend, FiShield, FiUserPlus, FiZap,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { publicPageTheme } from "@/components/ui/publicPageTheme";

type FaqCategory = "all" | "getting" | "security" | "trading" | "wallet" | "card" | "fees" | "tokens";

export default function FAQPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("all");

  const {
    pageBg, textMain, textSub, cardBg, cardBgHover, raisedBg,
    cardBorder, rowBorder, strongBorder, inputBg, accent, accentText,
    accentSoft, accentBorder, shadow,
  } = publicPageTheme(dark);

  const cats = useMemo(() => [
    { id: "all" as const, icon: FiGrid, label: t("faq_section_title"), desc: t("page_help_sub") },
    { id: "getting" as const, icon: FiUserPlus, label: t("page_help_cat_getting"), desc: t("page_help_cat_getting_d") },
    { id: "security" as const, icon: FiShield, label: t("page_help_cat_security"), desc: t("page_help_cat_security_d") },
    { id: "trading" as const, icon: FiRepeat, label: t("page_help_cat_trading"), desc: t("page_help_cat_trading_d") },
    { id: "wallet" as const, icon: FiSend, label: t("page_help_cat_wallet"), desc: t("page_help_cat_wallet_d") },
    { id: "card" as const, icon: FiCreditCard, label: t("page_help_cat_card"), desc: t("page_help_cat_card_d") },
    { id: "fees" as const, icon: FiDollarSign, label: t("page_help_cat_fees"), desc: t("page_help_cat_fees_d") },
    { id: "tokens" as const, icon: FiZap, label: t("page_help_cat_tokens"), desc: t("page_help_cat_tokens_d") },
  ], [t]);

  const allFaqs = useMemo(() => [
    { category: "getting" as const, q: t("page_help_faq1_q"), a: t("page_help_faq1_a") },
    { category: "trading" as const, q: t("page_help_faq2_q"), a: t("page_help_faq2_a") },
    { category: "security" as const, q: t("page_help_faq3_q"), a: t("page_help_faq3_a") },
    { category: "security" as const, q: t("page_help_faq4_q"), a: t("page_help_faq4_a") },
    { category: "wallet" as const, q: t("page_help_faq5_q"), a: t("page_help_faq5_a") },
    { category: "wallet" as const, q: t("page_help_faq6_q"), a: t("page_help_faq6_a") },
    { category: "tokens" as const, q: t("page_help_faq7_q"), a: t("page_help_faq7_a") },
    { category: "getting" as const, q: t("page_help_faq8_q"), a: t("page_help_faq8_a") },
    { category: "getting" as const, q: t("faq_s_q1"), a: t("faq_s_a1") },
    { category: "getting" as const, q: t("faq_s_q2"), a: t("faq_s_a2") },
    { category: "wallet" as const, q: t("faq_s_q3"), a: t("faq_s_a3") },
    { category: "fees" as const, q: t("faq_s_q4"), a: t("faq_s_a4") },
    { category: "security" as const, q: t("faq_s_q5"), a: t("faq_s_a5") },
    { category: "trading" as const, q: t("faq_s_q6"), a: t("faq_s_a6") },
    { category: "card" as const, q: t("faq_s_q7"), a: t("faq_s_a7") },
    { category: "getting" as const, q: t("faq_s_q8"), a: t("faq_s_a8") },
    { category: "tokens" as const, q: t("faq_s_q9"), a: t("faq_s_a9") },
    { category: "getting" as const, q: t("faq_s_q10"), a: t("faq_s_a10") },
  ], [t]);

  const active = cats.find((c) => c.id === activeCategory) ?? cats[0];
  const filtered = useMemo(() => {
    const seen = new Set<string>();
    const query = q.trim().toLowerCase();

    return allFaqs.filter((f) => {
      if (seen.has(f.q)) return false;
      seen.add(f.q);

      const inCategory = Boolean(query) || activeCategory === "all" || f.category === activeCategory;
      const inSearch = !query || f.q.toLowerCase().includes(query) || f.a.toLowerCase().includes(query);
      return inCategory && inSearch;
    });
  }, [activeCategory, allFaqs, q]);

  const clearFilters = () => {
    setQ("");
    setActiveCategory("all");
  };

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      <Box pt={{ base: "112px", md: "132px" }} pb={{ base: 8, md: 10 }} textAlign="center" position="relative" overflow="hidden">
        <Box
          position="absolute"
          inset={0}
          bg={dark
            ? "linear-gradient(180deg, rgba(99,161,219,0.10) 0%, rgba(99,161,219,0.025) 44%, rgba(22,24,28,0) 100%)"
            : "linear-gradient(180deg, rgba(79,139,196,0.10) 0%, rgba(79,139,196,0.025) 44%, rgba(255,255,255,0) 100%)"}
          pointerEvents="none"
        />
        <Container maxW="820px" position="relative">
          <VStack spacing={5}>
            <Heading
              as="h1"
              fontWeight="900"
              fontSize={{ base: "40px", md: "58px" }}
              lineHeight="1.04"
              letterSpacing="-0.035em"
              color={textMain}
            >
              {t("page_help_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} maxW="560px" lineHeight="1.65">
              {t("page_help_sub")}
            </Text>
            <InputGroup maxW="640px" size="lg" mt={1}>
              <InputLeftElement pointerEvents="none" h="56px" ps={5}>
                <Icon as={FiSearch} color={accentText} />
              </InputLeftElement>
              <Input
                placeholder={t("page_help_search_ph")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                h="56px"
                ps="52px"
                bg={inputBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="16px"
                fontSize="15px"
                color={textMain}
                boxShadow={dark ? "0 16px 44px rgba(0,0,0,0.20)" : "0 16px 38px rgba(10,10,11,0.06)"}
                _placeholder={{ color: textSub }}
                _focus={{
                  borderColor: accentBorder,
                  boxShadow: dark
                    ? "0 0 0 1px rgba(99,161,219,0.24), 0 16px 44px rgba(0,0,0,0.20)"
                    : "0 0 0 1px rgba(79,139,196,0.20), 0 16px 38px rgba(10,10,11,0.06)",
                }}
              />
            </InputGroup>
          </VStack>
        </Container>
      </Box>

      <Container maxW="1120px" py={{ base: 8, md: 12 }}>
        <Flex direction={{ base: "column", lg: "row" }} align="flex-start" gap={{ base: 5, lg: 8 }}>
          <Box w={{ base: "100%", lg: "300px" }} position={{ base: "relative", lg: "sticky" }} top={{ lg: "104px" }}>
            <Text fontSize="11px" fontWeight="800" color={textSub} letterSpacing="0.14em" textTransform="uppercase" mb={3}>
              {t("faq_section_tag")}
            </Text>
            <Flex
              direction={{ base: "row", lg: "column" }}
              gap={2}
              overflowX={{ base: "auto", lg: "visible" }}
              pb={{ base: 2, lg: 0 }}
              pe={{ base: 1, lg: 0 }}
            >
              {cats.map((c) => {
                const selected = activeCategory === c.id;
                return (
                  <Box
                    key={c.id}
                    as="button"
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    textAlign="left"
                    flexShrink={0}
                    w={{ base: "240px", lg: "100%" }}
                    bg={selected ? raisedBg : cardBg}
                    border="1px solid"
                    borderColor={selected ? accentBorder : cardBorder}
                    borderRadius="16px"
                    p={4}
                    cursor="pointer"
                    transition="all 0.16s ease"
                    boxShadow={selected ? (dark ? "0 14px 38px rgba(0,0,0,0.20)" : "0 14px 30px rgba(10,10,11,0.06)") : "none"}
                    _hover={{ bg: cardBgHover, borderColor: selected ? accentBorder : strongBorder }}
                  >
                    <HStack spacing={3} align="flex-start">
                      <Flex
                        w="36px"
                        h="36px"
                        borderRadius="10px"
                        bg={selected ? accentSoft : (dark ? "rgba(255,255,255,0.055)" : "rgba(10,10,11,0.045)")}
                        border="1px solid"
                        borderColor={selected ? accentBorder : cardBorder}
                        align="center"
                        justify="center"
                        flexShrink={0}
                      >
                        <Icon as={c.icon} color={selected ? accentText : textMain} />
                      </Flex>
                      <Box>
                        <Text fontSize="14px" fontWeight="800" color={textMain} letterSpacing="-0.01em">
                          {c.label}
                        </Text>
                        <Text display={{ base: "none", lg: "block" }} fontSize="12.5px" color={textSub} lineHeight="1.45" mt={1}>
                          {c.desc}
                        </Text>
                      </Box>
                    </HStack>
                  </Box>
                );
              })}
            </Flex>
          </Box>

          <Box flex={1} w="100%">
            <HStack justify="space-between" align="flex-end" mb={4} gap={4}>
              <Box>
                <Heading fontSize={{ base: "24px", md: "32px" }} fontWeight="900" letterSpacing="-0.035em" color={textMain}>
                  {q ? t("faq_search_results") : active.label}
                </Heading>
                <Text fontSize="13.5px" color={textSub} mt={1}>
                  {q ? t("faq_section_sub") : active.desc}
                </Text>
              </Box>
              {(q || activeCategory !== "all") && (
                <Button
                  h="38px"
                  px={4}
                  borderRadius="12px"
                  variant="ghost"
                  fontSize="13px"
                  fontWeight="800"
                  color={textMain}
                  onClick={clearFilters}
                  _hover={{ bg: cardBgHover }}
                  flexShrink={0}
                >
                  {t("faq_clear_search")}
                </Button>
              )}
            </HStack>

            {filtered.length === 0 ? (
              <Box
                textAlign="center"
                py={12}
                bg={raisedBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="18px"
                boxShadow={shadow}
              >
                <Text color={textSub} fontSize="15px">{t("faq_no_results")}</Text>
                <Button mt={4} variant="ghost" color={textMain} fontWeight="800" onClick={clearFilters}>
                  {t("faq_clear_search")}
                </Button>
              </Box>
            ) : (
              <Box border="1px solid" borderColor={cardBorder} borderRadius="18px" px={{ base: 4, md: 6 }} bg={raisedBg} boxShadow={shadow}>
                {filtered.map((f, i) => (
                  <FAQItem
                    key={`${activeCategory}-${q}-${f.q}`}
                    q={f.q}
                    a={f.a}
                    last={i === filtered.length - 1}
                    dark={dark}
                    textMain={textMain}
                    textSub={textSub}
                    rowBorder={rowBorder}
                    defaultOpen={i === 0 && (Boolean(q) || activeCategory !== "all")}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Flex>
      </Container>

      <Container maxW="1120px" pb={{ base: 10, md: 16 }}>
        <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="20px" p={{ base: 5, md: 6 }}>
          <Flex direction={{ base: "column", md: "row" }} align={{ base: "flex-start", md: "center" }} justify="space-between" gap={5}>
            <HStack spacing={4} align="flex-start">
              <Flex
                w="44px"
                h="44px"
                bg={accentSoft}
                border="1px solid"
                borderColor={accentBorder}
                borderRadius="12px"
                align="center"
                justify="center"
                flexShrink={0}
              >
                <Icon as={FiMessageSquare} color={accentText} boxSize={5} />
              </Flex>
              <Box>
                <Heading fontSize={{ base: "19px", md: "22px" }} fontWeight="900" color={textMain} letterSpacing="-0.025em" mb={1}>
                  {t("page_help_contact_title")}
                </Heading>
                <Text fontSize="14px" color={textSub} maxW="560px">
                  {t("page_help_contact_d")}
                </Text>
              </Box>
            </HStack>
            <Button
              as={NextLink}
              href="/contact"
              h="44px"
              px={6}
              bg={accent}
              color="#ffffff"
              borderRadius="12px"
              fontWeight="800"
              fontSize="13.5px"
              rightIcon={<Icon as={FiArrowRight} />}
              _hover={{ opacity: 0.9, transform: "translateY(-1px)" }}
              flexShrink={0}
            >
              {t("nav_contact")}
            </Button>
          </Flex>
        </Box>
      </Container>

      <PublicFooter />
    </Box>
  );
}

function FAQItem({ q, a, last, dark, textMain, textSub, rowBorder, defaultOpen = false }: {
  q: string; a: string; last?: boolean; dark: boolean; textMain: string; textSub: string; rowBorder: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const iconColor = dark ? "rgba(255,255,255,0.44)" : "rgba(0,0,0,0.38)";

  return (
    <Box borderBottom={last ? "none" : "1px solid"} borderColor={rowBorder}>
      <HStack
        as="button"
        type="button"
        w="100%"
        onClick={() => setOpen((o) => !o)}
        py={{ base: 5, md: 5.5 }}
        align="flex-start"
        justify="space-between"
        spacing={4}
        textAlign="left"
        _hover={{ opacity: 0.78 }}
        transition="opacity 0.15s"
        aria-expanded={open}
      >
        <Text fontSize={{ base: "15px", md: "16px" }} fontWeight="800" color={textMain} lineHeight="1.4" flex={1}>
          {q}
        </Text>
        <Box
          flexShrink={0}
          w="24px"
          h="24px"
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
      {open && (
        <Text fontSize={{ base: "14px", md: "15px" }} color={textSub} lineHeight="1.75" pb={6} maxW="720px">
          {a}
        </Text>
      )}
    </Box>
  );
}
