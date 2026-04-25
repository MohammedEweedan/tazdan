"use client";

import NextLink from "next/link";
import { useState } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Input,
  InputGroup,
  InputLeftElement,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Icon,
  Flex,
  Button,
  useColorMode,
} from "@chakra-ui/react";
import {
  FiSearch,
  FiUserPlus,
  FiShield,
  FiRepeat,
  FiSend,
  FiCreditCard,
  FiDollarSign,
  FiArrowRight,
  FiMessageSquare,
  FiZap,
  FiCode,
} from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

export default function HelpPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const [q, setQ] = useState("");

  const pageBg = dark ? "#000000" : "#fafbfe";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const inputBg = dark ? "rgba(255,255,255,0.04)" : "white";
  const glow = dark ? "rgba(0,87,184,0.15)" : "rgba(0,87,184,0.06)";

  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 55%, rgba(255,255,255,0.5) 100%)"
    : "linear(to-b, #0057b8 0%, #0a0f1e 55%, rgba(10,15,30,0.4) 100%)";

  const cats = [
    { icon: FiUserPlus, label: t("page_help_cat_getting"), desc: t("page_help_cat_getting_d"), color: "#4a8fe0" },
    { icon: FiShield, label: t("page_help_cat_security"), desc: t("page_help_cat_security_d"), color: "#22c55e" },
    { icon: FiRepeat, label: t("page_help_cat_trading"), desc: t("page_help_cat_trading_d"), color: "#f59e0b" },
    { icon: FiSend, label: t("page_help_cat_wallet"), desc: t("page_help_cat_wallet_d"), color: "#06b6d4" },
    { icon: FiCreditCard, label: t("page_help_cat_card"), desc: t("page_help_cat_card_d"), color: "#8b5cf6" },
    { icon: FiDollarSign, label: t("page_help_cat_fees"), desc: t("page_help_cat_fees_d"), color: "#ec4899" },
    { icon: FiZap, label: t("page_help_cat_tokens"), desc: t("page_help_cat_tokens_d"), color: "#f97316" },
    { icon: FiCode, label: t("page_help_cat_contracts"), desc: t("page_help_cat_contracts_d"), color: "#14b8a6" },
  ];

  const faqs = [
    { q: t("page_help_faq1_q"), a: t("page_help_faq1_a") },
    { q: t("page_help_faq2_q"), a: t("page_help_faq2_a") },
    { q: t("page_help_faq3_q"), a: t("page_help_faq3_a") },
    { q: t("page_help_faq4_q"), a: t("page_help_faq4_a") },
    { q: t("page_help_faq5_q"), a: t("page_help_faq5_a") },
    { q: t("page_help_faq6_q"), a: t("page_help_faq6_a") },
    { q: t("page_help_faq7_q"), a: t("page_help_faq7_a") },
    { q: t("page_help_faq8_q"), a: t("page_help_faq8_a") },
  ];
  const filteredFaqs = q
    ? faqs.filter((f) => f.q.toLowerCase().includes(q.toLowerCase()) || f.a.toLowerCase().includes(q.toLowerCase()))
    : faqs;

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero + Search */}
      <Box position="relative" pt={{ base: "110px", md: "160px" }} pb={{ base: 10, md: 16 }}>
        <Box position="absolute" top="20%" left="50%" transform="translateX(-50%)" w="800px" h="440px" bg={glow} filter="blur(140px)" borderRadius="full" pointerEvents="none" />
        <Container maxW="820px" position="relative" zIndex={1}>
          <VStack spacing={6} textAlign="center">
            <Heading
              as="h1"
              fontFamily="'DM Sans', sans-serif"
              fontWeight="800"
              fontSize={{ base: "40px", md: "68px" }}
              lineHeight="1.0"
              letterSpacing="-0.04em"
              bgGradient={titleGradient}
              bgClip="text"
            >
              {t("page_help_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="560px" lineHeight="1.7">
              {t("page_help_sub")}
            </Text>
            <InputGroup maxW="560px" size="lg" mt={2}>
              <InputLeftElement pointerEvents="none" h="56px" ps={5}>
                <Icon as={FiSearch} color={textSub} boxSize={5} />
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
                _placeholder={{ color: textSub }}
                _focus={{ borderColor: "#0057b8", boxShadow: "0 0 0 3px rgba(0,87,184,0.15)" }}
              />
            </InputGroup>
          </VStack>
        </Container>
      </Box>

      {/* Category grid */}
      <Container maxW="1180px" py={{ base: 6, md: 12 }}>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
          {cats.map((c) => (
            <Box
              key={c.label}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="20px"
              p={6}
              cursor="pointer"
              transition="all 0.2s ease"
              _hover={{ transform: "translateY(-3px)", boxShadow: dark ? "0 16px 32px rgba(0,0,0,0.3)" : "0 16px 32px rgba(0,87,184,0.08)", borderColor: "#0057b8" }}
            >
              <Flex
                w="42px"
                h="42px"
                borderRadius="12px"
                bg={`${c.color}22`}
                border="1px solid"
                borderColor={`${c.color}44`}
                align="center"
                justify="center"
                mb={4}
              >
                <Icon as={c.icon} color={c.color} boxSize={5} />
              </Flex>
              <Heading fontSize="17px" fontWeight="700" color={textMain} letterSpacing="-0.01em" fontFamily="'DM Sans', sans-serif" mb={1.5}>
                {c.label}
              </Heading>
              <Text fontSize="13.5px" color={textSub} lineHeight="1.6">
                {c.desc}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Container>

      {/* FAQ */}
      <Container maxW="820px" py={{ base: 12, md: 20 }}>
        <VStack spacing={10} align="stretch">
          <Heading fontSize={{ base: "28px", md: "40px" }} fontWeight="800" letterSpacing="-0.03em" textAlign="center" fontFamily="'DM Sans', sans-serif" color={textMain}>
            {t("page_help_faq_title")}
          </Heading>
          <Accordion allowToggle>
            {filteredFaqs.map((f, i) => (
              <AccordionItem
                key={i}
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="18px"
                mb={3}
                overflow="hidden"
                _last={{ mb: 0 }}
              >
                <AccordionButton py={5} px={6} _hover={{ bg: dark ? "rgba(255,255,255,0.02)" : "rgba(0,87,184,0.03)" }}>
                  <Text flex={1} textAlign="start" fontSize={{ base: "15px", md: "16px" }} color={textMain} fontWeight="700">
                    {f.q}
                  </Text>
                  <AccordionIcon color={textSub} />
                </AccordionButton>
                <AccordionPanel px={6} pb={5}>
                  <Text fontSize={{ base: "14px", md: "15px" }} color={textSub} lineHeight="1.8">
                    {f.a}
                  </Text>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </VStack>
      </Container>

      {/* Contact CTA */}
      <Container maxW="900px" py={{ base: 10, md: 16 }}>
        <Box
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="28px"
          p={{ base: 8, md: 12 }}
          textAlign="center"
          backdropFilter="blur(14px)"
        >
          <Flex w="56px" h="56px" bg="rgba(0,87,184,0.15)" border="1px solid rgba(0,87,184,0.3)" borderRadius="16px" align="center" justify="center" mx="auto" mb={5}>
            <Icon as={FiMessageSquare} color="#4a8fe0" boxSize={6} />
          </Flex>
          <Heading fontSize={{ base: "22px", md: "28px" }} fontWeight="800" color={textMain} letterSpacing="-0.02em" fontFamily="'DM Sans', sans-serif" mb={2}>
            {t("page_help_contact_title")}
          </Heading>
          <Text fontSize="14.5px" color={textSub} mb={6} maxW="440px" mx="auto">
            {t("page_help_contact_d")}
          </Text>
          <Button
            as={NextLink}
            href="/contact"
            h="48px"
            px={7}
            bg={dark ? "white" : "#0a0f1e"}
            color={dark ? "black" : "white"}
            borderRadius="12px"
            fontWeight="800"
            fontSize="13.5px"
            rightIcon={<Icon as={FiArrowRight} />}
            _hover={{ opacity: 0.9 }}
          >
            {t("nav_contact")}
          </Button>
        </Box>
      </Container>

      <PublicFooter />
    </Box>
  );
}
