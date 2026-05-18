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

export default function FeesPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const pageBg    = dark ? "#000000" : "#ffffff";
  const textMain  = dark ? "#ffffff" : "#0a0f1e";
  const textSub   = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const rowBorder  = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const ctaBg     = dark ? "#ffffff" : "#0a0f1e";
  const ctaFg     = dark ? "#000000" : "#ffffff";

  const titleGradient = dark
    ? "linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)"
    : "linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)";

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
      <Box pt={{ base: "120px", md: "170px" }} pb={{ base: 14, md: 20 }} textAlign="center">
        <Container maxW="900px">
          <VStack spacing={6}>
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
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="16px" px={{ base: 4, md: 6 }} py={3} spacing={0}
                  minW={{ base: "90px", md: "120px" }}
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
              _hover={{ transform: "translateY(-3px)", borderColor: dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)" }}
            >
              <Flex
                w="40px" h="40px" borderRadius="12px"
                bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                border="1px solid" borderColor={cardBorder}
                align="center" justify="center"
              >
                <Icon as={h.icon} color={textMain} boxSize={4.5} />
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
          bg={cardBg} border="1px solid" borderColor={cardBorder}
          borderRadius="28px" overflow="hidden"
          boxShadow={dark ? "0 20px 60px rgba(0,0,0,0.4)" : "0 20px 60px rgba(0,0,0,0.06)"}
        >
          <Box px={{ base: 5, md: 8 }} py={5} borderBottom="1px solid" borderColor={rowBorder}>
            <HStack justify="space-between" flexWrap="wrap" gap={2}>
              <Text fontSize="13px" fontWeight="800" color={textMain} letterSpacing="0.12em" textTransform="uppercase">
                {t("page_fees_table_title")}
              </Text>
              <Badge
                bg={dark ? "rgba(74,222,128,0.15)" : "rgba(22,163,74,0.12)"}
                color={dark ? "#4ade80" : "#16a34a"}
                fontSize="10px" px={2.5} py={1} borderRadius="full" letterSpacing="0.1em"
              >
                LIVE
              </Badge>
            </HStack>
          </Box>
          <TableContainer>
            <Table variant="simple">
              <Thead bg={dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"}>
                <Tr>
                  <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5}>{t("page_fees_t1")}</Th>
                  <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5}>{t("page_fees_t2")}</Th>
                  <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5} display={{ base: "none", md: "table-cell" }}>{t("page_fees_t3")}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((r, i) => (
                  <Tr key={i} _hover={{ bg: dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)" }} transition="background 0.15s">
                    <Td borderColor={rowBorder} py={5}>
                      <Text fontSize={{ base: "13.5px", md: "15px" }} color={textMain} fontWeight="600">{r.s}</Text>
                    </Td>
                    <Td borderColor={rowBorder} py={5}>
                      <HStack spacing={2}>
                        <Text fontSize={{ base: "13.5px", md: "15px" }} color={textMain} fontWeight="700">{r.f}</Text>
                        {r.free && (
                          <Badge bg={dark ? "rgba(74,222,128,0.15)" : "rgba(22,163,74,0.12)"} color={dark ? "#4ade80" : "#16a34a"} fontSize="9.5px" px={2} py={0.5} borderRadius="full">FREE</Badge>
                        )}
                        {r.highlight && (
                          <Badge bg={dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)"} color={textSub} fontSize="9.5px" px={2} py={0.5} borderRadius="full">LOW</Badge>
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

      {/* Calculator */}
      <Container maxW="620px" pb={{ base: 16, md: 24 }}>
        <FeeCalculator />
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
                borderRadius="24px"
                p={{ base: 6, md: 8 }}
                bg={cardBg}
                border="2px solid"
                borderColor={tier.badge ? (dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)") : cardBorder}
                transition="all 0.25s ease"
                _hover={{ transform: "translateY(-4px)", borderColor: dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                h="100%"
              >
                <VStack align="start" spacing={5}>
                  <HStack spacing={3} w="100%">
                    <Flex
                      w="44px" h="44px" borderRadius="14px"
                      bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                      border="1px solid" borderColor={cardBorder}
                      align="center" justify="center"
                    >
                      <Icon as={tier.icon} color={textMain} boxSize={5} />
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
                      <Badge bg={dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"} color={textMain} fontSize="9.5px" fontWeight="800" letterSpacing="0.1em" px={2.5} py={1} borderRadius="full">
                        POPULAR
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="14.5px" color={textSub} lineHeight="1.7" fontWeight="500">{tier.desc}</Text>
                  <VStack align="start" spacing={2.5} w="100%" pt={2} borderTop="1px solid" borderColor={cardBorder}>
                    {tier.perks.map((p) => (
                      <HStack key={p} spacing={2.5} pt={2.5}>
                        <Flex w="18px" h="18px" borderRadius="full" bg={textMain} align="center" justify="center" flexShrink={0}>
                          <Icon as={FiCheck} color={pageBg} boxSize={2.5} />
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
