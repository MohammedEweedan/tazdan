"use client";

import NextLink from "next/link";
import {
  Box, Container, Heading, Text, VStack, HStack, SimpleGrid,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  Badge, Icon, Button, Flex, useColorMode,
} from "@chakra-ui/react";
import {
  FiArrowRight, FiCheck, FiShield, FiZap, FiTrendingDown,
  FiUser, FiCheckCircle, FiStar,
} from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import FeeCalculator from "@/components/ui/FeeCalculator";
import { publicPageTheme } from "@/components/ui/publicPageTheme";

export default function FeesPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const {
    pageBg, textMain, textSub, cardBg, cardBgHover, raisedBg, raisedAlt,
    cardBorder, rowBorder, strongBorder, accent, accentText, accentSoft,
    accentBorder, green, greenSoft, shadow, titleGradient,
  } = publicPageTheme(dark);
  const ctaBg     = accent;
  const ctaFg     = "#ffffff";

  const rows = [
    { s: t("page_fees_row1_s"), f: t("page_fees_row1_f"), n: t("page_fees_row1_n"), highlight: true },
    { s: t("page_fees_row2_s"), f: t("page_fees_row2_f"), n: t("page_fees_row2_n") },
    { s: t("page_fees_row3_s"), f: t("page_fees_row3_f"), n: t("page_fees_row3_n") },
    { s: t("page_fees_row4_s"), f: t("page_fees_row4_f"), n: t("page_fees_row4_n") },
    { s: t("page_fees_row5_s"), f: t("page_fees_row5_f"), n: t("page_fees_row5_n") },
    { s: t("page_fees_row6_s"), f: t("page_fees_row6_f"), n: t("page_fees_row6_n"), free: true },
    { s: t("page_fees_row7_s"), f: t("page_fees_row7_f"), n: t("page_fees_row7_n"), free: true },
    { s: t("page_fees_row8_s"), f: t("page_fees_row8_f"), n: t("page_fees_row8_n") },
  ];

  const tiers = [
    {
      icon: FiUser,
      title: t("page_fees_limits_basic"),
      desc: t("page_fees_limits_basic_d"),
      perks: [t("page_fees_perk_free_signup"), t("page_fees_perk_small_limits")],
      badge: false,
    },
    {
      icon: FiCheckCircle,
      title: t("page_fees_limits_verified"),
      desc: t("page_fees_limits_verified_d"),
      perks: [t("page_fees_perk_higher_limits"), t("page_fees_perk_priority"), t("page_fees_perk_card_req")],
      badge: true,
    },
    {
      icon: FiStar,
      title: t("page_fees_limits_pro"),
      desc: t("page_fees_limits_pro_d"),
      perks: [t("page_fees_perk_top_limits"), t("page_fees_perk_reduced_fees"), t("page_fees_perk_vip")],
      badge: false,
    },
  ];

  const highlights = [
    { icon: FiTrendingDown, title: t("page_fees_hl1_t"), desc: t("page_fees_hl1_d") },
    { icon: FiZap,          title: t("page_fees_hl2_t"), desc: t("page_fees_hl2_d") },
    { icon: FiShield,       title: t("page_fees_hl3_t"), desc: t("page_fees_hl3_d") },
  ];

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box pt={{ base: "118px", md: "160px" }} pb={{ base: 14, md: 20 }} textAlign="center" position="relative" overflow="hidden">
        <Box
          position="absolute"
          inset={0}
          bg={dark
            ? "linear-gradient(180deg, rgba(99,161,219,0.10) 0%, rgba(99,161,219,0.025) 44%, rgba(22,24,28,0) 100%)"
            : "linear-gradient(180deg, rgba(79,139,196,0.10) 0%, rgba(79,139,196,0.025) 44%, rgba(255,255,255,0) 100%)"}
          pointerEvents="none"
        />
        <Container maxW="900px" position="relative">
          <VStack spacing={6}>
            <Text
              fontSize="11px"
              fontWeight="800"
              letterSpacing="0.18em"
              color={accentText}
              textTransform="uppercase"
              border="1px solid"
              borderColor={accentBorder}
              bg={accentSoft}
              borderRadius="full"
              px={4}
              py={2}
            >
              {t("page_fees_eyebrow")}
            </Text>
            <Heading
              as="h1"
              fontWeight="900"
              fontSize={{ base: "52px", md: "88px" }}
              lineHeight="0.95"
              letterSpacing="-0.045em"
              bgGradient={titleGradient}
              bgClip="text"
            >
              {t("page_fees_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "19px" }} color={textSub} maxW="560px" lineHeight="1.7">
              {t("page_fees_sub")}
            </Text>

            {/* Stat chips */}
            <HStack spacing={{ base: 2, md: 4 }} justify="center" flexWrap="wrap" pt={2}>
              {[
                { k: "0.5%",                             v: t("page_fees_stat_p2p") },
                { k: t("page_fees_stat_deposit_v"),      v: t("page_fees_stat_deposit") },
                { k: "24/7",                             v: t("page_fees_stat_support") },
              ].map((s) => (
                <VStack
                  key={s.v}
                  bg={raisedBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="16px" px={{ base: 4, md: 6 }} py={3} spacing={0}
                  minW={{ base: "90px", md: "120px" }}
                  boxShadow={dark ? "0 14px 36px rgba(0,0,0,0.18)" : "0 14px 32px rgba(10,10,11,0.05)"}
                >
                  <Text fontSize={{ base: "20px", md: "24px" }} fontWeight="800" color={textMain} letterSpacing="-0.02em">
                    {s.k}
                  </Text>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing="0.12em" textTransform="uppercase">
                    {s.v}
                  </Text>
                </VStack>
              ))}
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* Highlights trio */}
      <Container maxW="1100px" pb={{ base: 10, md: 14 }}>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          {highlights.map((h) => (
            <VStack
              key={h.title}
              align="start" spacing={3}
              bg={cardBg} border="1px solid" borderColor={cardBorder}
              borderRadius="20px" p={6} h="100%"
              transition="all 0.2s ease"
              _hover={{ transform: "translateY(-3px)", bg: cardBgHover, borderColor: strongBorder, boxShadow: shadow }}
            >
              <Flex
                w="40px" h="40px" borderRadius="12px"
                bg={accentSoft}
                border="1px solid" borderColor={accentBorder}
                align="center" justify="center"
              >
                <Icon as={h.icon} color={accentText} />
              </Flex>
              <Text fontSize="16px" fontWeight="800" color={textMain} letterSpacing="-0.01em">{h.title}</Text>
              <Text fontSize="13.5px" color={textSub} lineHeight="1.6">{h.desc}</Text>
            </VStack>
          ))}
        </SimpleGrid>
      </Container>

      {/* Fees table */}
      <Container maxW="1100px" pb={{ base: 10, md: 16 }}>
        <Box
          bg={raisedBg} border="1px solid" borderColor={cardBorder}
          borderRadius="24px" overflow="hidden"
          boxShadow={shadow}
        >
          <TableContainer>
            <Table variant="simple">
              <Thead bg={dark ? "rgba(255,255,255,0.025)" : "rgba(10,10,11,0.025)"}>
                <Tr>
                  <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5}>{t("page_fees_t1")}</Th>
                  <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5}>{t("page_fees_t2")}</Th>
                  <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5} display={{ base: "none", md: "table-cell" }}>{t("page_fees_t3")}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((r, i) => (
                  <Tr key={i} _hover={{ bg: dark ? "rgba(255,255,255,0.035)" : "rgba(10,10,11,0.03)" }} transition="background 0.15s">
                    <Td borderColor={rowBorder} py={5}>
                      <Text fontSize={{ base: "13.5px", md: "15px" }} color={textMain} fontWeight="600">{r.s}</Text>
                    </Td>
                    <Td borderColor={rowBorder} py={5}>
                      <HStack spacing={2}>
                        <Text fontSize={{ base: "13.5px", md: "15px" }} color={textMain} fontWeight="700">{r.f}</Text>
                        {r.free && (
                          <Badge bg={greenSoft} color={green} fontSize="9.5px" px={2} py={0.5} borderRadius="full">FREE</Badge>
                        )}
                        {r.highlight && (
                          <Badge bg={accentSoft} color={accentText} fontSize="9.5px" px={2} py={0.5} borderRadius="full">LOW</Badge>
                        )}
                      </HStack>
                    </Td>
                    <Td borderColor={rowBorder} py={5} display={{ base: "none", md: "table-cell" }}>
                      <Text fontSize="13px" color={textSub}>{r.n}</Text>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Container>

      {/* Account tiers */}
      <Container maxW="1100px" pb={{ base: 16, md: 24 }}>
        <VStack spacing={12}>
          <VStack spacing={3} textAlign="center">
            <Heading fontSize={{ base: "32px", md: "52px" }} fontWeight="900" letterSpacing="-0.04em" color={textMain} lineHeight="1">
              {t("page_fees_limits_title")}
            </Heading>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap={5} w="100%">
            {tiers.map((tier) => (
              <Box
                key={tier.title}
                position="relative"
                borderRadius="22px"
                p={{ base: 6, md: 8 }}
                bg={tier.badge ? raisedBg : cardBg}
                border="1px solid"
                borderColor={tier.badge ? accentBorder : cardBorder}
                transition="all 0.25s ease"
                boxShadow={tier.badge ? shadow : "none"}
                _hover={{ transform: "translateY(-4px)", bg: tier.badge ? raisedBg : cardBgHover, borderColor: tier.badge ? accentBorder : strongBorder }}
                h="100%"
              >
                <VStack align="start" spacing={5}>
                  <HStack spacing={3} w="100%">
                    <Flex
                      w="44px" h="44px" borderRadius="14px"
                      bg={tier.badge ? accentSoft : (dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,11,0.06)")}
                      border="1px solid" borderColor={tier.badge ? accentBorder : cardBorder}
                      align="center" justify="center"
                    >
                      <Icon as={tier.icon} color={tier.badge ? accentText : textMain} boxSize={5} />
                    </Flex>
                    <Box flex={1}>
                      <Text fontSize="11.5px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase">
                        {t("page_fees_tier")}
                      </Text>
                      <Text fontSize="18px" fontWeight="800" color={textMain} letterSpacing="-0.015em">
                        {tier.title}
                      </Text>
                    </Box>
                    {tier.badge && (
                      <Badge bg={accentSoft} color={accentText} fontSize="9.5px" fontWeight="800" letterSpacing="0.1em" px={2.5} py={1} borderRadius="full">
                        POPULAR
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="14.5px" color={textSub} lineHeight="1.7" fontWeight="500">{tier.desc}</Text>
                  <VStack align="start" spacing={2.5} w="100%" pt={2} borderTop="1px solid" borderColor={cardBorder}>
                    {tier.perks.map((p) => (
                      <HStack key={p} spacing={2.5} pt={2.5}>
                        <Flex w="18px" h="18px" borderRadius="full" bg={accentSoft} border="1px solid" borderColor={accentBorder} align="center" justify="center" flexShrink={0}>
                          <Icon as={FiCheck} color={accentText} boxSize={2.5} />
                        </Flex>
                        <Text fontSize="13px" color={textMain} fontWeight="600">{p}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </VStack>
              </Box>
            ))}
          </SimpleGrid>

          <Button
            as={NextLink} href="/register"
            h="56px" px={10}
            bg={ctaBg} color={ctaFg}
            borderRadius="full" fontWeight="800" fontSize="14px"
            rightIcon={<Icon as={FiArrowRight} />}
            boxShadow={dark ? "0 14px 38px rgba(99,161,219,0.22)" : "0 14px 34px rgba(79,139,196,0.18)"}
            _hover={{ opacity: 0.9, transform: "translateY(-2px)" }}
            transition="all 0.2s"
          >
            {t("nav_register")}
          </Button>
        </VStack>
      </Container>

      <PublicFooter />
    </Box>
  );
}
