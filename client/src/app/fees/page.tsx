"use client";

import { useRef } from "react";
import NextLink from "next/link";
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Badge,
  Icon,
  Button,
  Flex,
  useColorMode,
} from "@chakra-ui/react";
import {
  FiArrowRight,
  FiCheck,
  FiShield,
  FiZap,
  FiTrendingDown,
  FiUser,
  FiCheckCircle,
  FiStar,
} from "react-icons/fi";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTranslate } from "@tolgee/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

const BRAND = "#0057b8";
const BRAND_LIGHT = "#4a8fe0";

export default function FeesPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const pageBg = dark ? "#000000" : "#fafbfe";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const rowBorder = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const glow = dark ? "rgba(0,87,184,0.2)" : "rgba(0,87,184,0.08)";
  const chipBg = dark ? "rgba(255,255,255,0.04)" : "white";

  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 55%, rgba(255,255,255,0.5) 100%)"
    : "linear(to-b, #0057b8 0%, #0a0f1e 55%, rgba(10,15,30,0.4) 100%)";

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
      grad: "linear-gradient(135deg, rgba(100,116,139,0.18), rgba(100,116,139,0.04))",
      dot: "#94a3b8",
      perks: [
        t("page_fees_perk_free_signup", "Free signup"),
        t("page_fees_perk_small_limits", "Small daily limits"),
      ],
    },
    {
      icon: FiCheckCircle,
      title: t("page_fees_limits_verified"),
      desc: t("page_fees_limits_verified_d"),
      grad: "linear-gradient(135deg, rgba(0,87,184,0.25), rgba(0,87,184,0.04))",
      dot: "#4a8fe0",
      badge: true,
      perks: [
        t("page_fees_perk_higher_limits", "Higher limits"),
        t("page_fees_perk_priority", "Priority support"),
        t("page_fees_perk_card_req", "Card eligibility"),
      ],
    },
    {
      icon: FiStar,
      title: t("page_fees_limits_pro"),
      desc: t("page_fees_limits_pro_d"),
      grad: "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(245,158,11,0.04))",
      dot: "#f59e0b",
      perks: [
        t("page_fees_perk_top_limits", "Top-tier limits"),
        t("page_fees_perk_reduced_fees", "Reduced fees"),
        t("page_fees_perk_vip", "Dedicated manager"),
      ],
    },
  ];

  const highlights = [
    { icon: FiTrendingDown, title: t("page_fees_hl1_t", "Lowest on the market"), desc: t("page_fees_hl1_d", "Flat 0.5% P2P fee — beats every competitor in the region.") },
    { icon: FiZap, title: t("page_fees_hl2_t", "No hidden charges"), desc: t("page_fees_hl2_d", "What you see is what you pay. No surprises at checkout.") },
    { icon: FiShield, title: t("page_fees_hl3_t", "Free deposits forever"), desc: t("page_fees_hl3_d", "Move money in from any bank or wallet — always free.") },
  ];

  /* Parallax */
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroGlowY = useTransform(heroProgress, [0, 1], ["0%", "40%"]);
  const heroTitleY = useTransform(heroProgress, [0, 1], ["0%", "-25%"]);
  const heroFade = useTransform(heroProgress, [0, 1], [1, 0.4]);

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box ref={heroRef} position="relative" pt={{ base: "120px", md: "170px" }} pb={{ base: 14, md: 20 }} overflow="hidden">
        <motion.div
          style={{ y: heroGlowY, position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}
        >
          <Box w={{ base: "600px", md: "1000px" }} h={{ base: "400px", md: "560px" }} bg={glow} filter="blur(160px)" borderRadius="full" />
        </motion.div>

        {/* Floating orbs */}
        <motion.div
          animate={{ y: [0, -18, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", top: "22%", left: "10%", pointerEvents: "none" }}
        >
          <Box w="120px" h="120px" borderRadius="full" bg="radial-gradient(circle, rgba(74,143,224,0.4), transparent 70%)" filter="blur(20px)" />
        </motion.div>
        <motion.div
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          style={{ position: "absolute", top: "18%", right: "12%", pointerEvents: "none" }}
        >
          <Box w="160px" h="160px" borderRadius="full" bg="radial-gradient(circle, rgba(0,87,184,0.35), transparent 70%)" filter="blur(26px)" />
        </motion.div>

        <Container maxW="1000px" position="relative" zIndex={1}>
          <motion.div style={{ y: heroTitleY, opacity: heroFade }}>
            <VStack spacing={6} textAlign="center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 36, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <Heading
                  as="h1"
                  fontFamily="'DM Sans', sans-serif"
                  fontWeight="800"
                  fontSize={{ base: "44px", md: "80px" }}
                  lineHeight="0.95"
                  letterSpacing="-0.045em"
                  bgGradient={titleGradient}
                  bgClip="text"
                >
                  {t("page_fees_title")}
                </Heading>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
              >
                <Text fontSize={{ base: "15px", md: "19px" }} color={textSub} maxW="620px" lineHeight="1.7">
                  {t("page_fees_sub")}
                </Text>
              </motion.div>

              {/* Stat strip */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                style={{ width: "100%" }}
              >
                <HStack
                  spacing={{ base: 3, md: 6 }}
                  justify="center"
                  flexWrap="wrap"
                  pt={4}
                >
                  {[
                    { k: "0.5%", v: t("page_fees_stat_p2p", "P2P fee") },
                    { k: t("page_fees_stat_deposit_v", "Free"), v: t("page_fees_stat_deposit", "Deposits") },
                    { k: "24/7", v: t("page_fees_stat_support", "Support") },
                  ].map((s) => (
                    <VStack
                      key={s.v}
                      bg={chipBg}
                      border="1px solid"
                      borderColor={cardBorder}
                      borderRadius="16px"
                      px={{ base: 4, md: 6 }}
                      py={3}
                      spacing={0}
                      backdropFilter="blur(14px)"
                      minW={{ base: "100px", md: "130px" }}
                    >
                      <Text fontSize={{ base: "20px", md: "24px" }} fontWeight="800" color={textMain} letterSpacing="-0.02em" fontFamily="'DM Sans', sans-serif">
                        {s.k}
                      </Text>
                      <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing="0.12em" textTransform="uppercase">
                        {s.v}
                      </Text>
                    </VStack>
                  ))}
                </HStack>
              </motion.div>
            </VStack>
          </motion.div>
        </Container>
      </Box>

      {/* Highlight trio */}
      <Container maxW="1100px" py={{ base: 6, md: 10 }}>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          {highlights.map((h, i) => (
            <motion.div
              key={h.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <VStack
                align="start"
                spacing={3}
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="20px"
                p={6}
                h="100%"
                backdropFilter="blur(14px)"
                transition="all 0.25s ease"
                _hover={{ transform: "translateY(-3px)", borderColor: BRAND_LIGHT, boxShadow: dark ? "0 12px 40px rgba(0,87,184,0.25)" : "0 12px 40px rgba(0,87,184,0.12)" }}
              >
                <Flex
                  w="40px"
                  h="40px"
                  borderRadius="12px"
                  bg="rgba(0,87,184,0.15)"
                  border="1px solid rgba(0,87,184,0.25)"
                  align="center"
                  justify="center"
                >
                  <Icon as={h.icon} color={BRAND_LIGHT} boxSize={4.5} />
                </Flex>
                <Text fontSize="16px" fontWeight="800" color={textMain} letterSpacing="-0.01em">
                  {h.title}
                </Text>
                <Text fontSize="13.5px" color={textSub} lineHeight="1.6">
                  {h.desc}
                </Text>
              </VStack>
            </motion.div>
          ))}
        </SimpleGrid>
      </Container>

      {/* Fees table */}
      <Container maxW="1100px" py={{ base: 8, md: 12 }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Box
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="28px"
            overflow="hidden"
            backdropFilter="blur(16px)"
            boxShadow={dark ? "0 20px 60px rgba(0,0,0,0.4)" : "0 20px 60px rgba(0,87,184,0.08)"}
          >
            <Box px={{ base: 5, md: 8 }} py={5} borderBottom="1px solid" borderColor={rowBorder}>
              <HStack justify="space-between" flexWrap="wrap" gap={2}>
                <Text fontSize="13px" fontWeight="800" color={textMain} letterSpacing="0.12em" textTransform="uppercase">
                  {t("page_fees_table_title", "Pricing breakdown")}
                </Text>
                <Badge bg="rgba(34,197,94,0.15)" color="#22c55e" fontSize="10px" px={2.5} py={1} borderRadius="full" letterSpacing="0.1em">
                  LIVE
                </Badge>
              </HStack>
            </Box>
            <TableContainer>
              <Table variant="simple">
                <Thead bg={dark ? "rgba(255,255,255,0.02)" : "rgba(0,87,184,0.04)"}>
                  <Tr>
                    <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5}>{t("page_fees_t1")}</Th>
                    <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5}>{t("page_fees_t2")}</Th>
                    <Th color={textSub} borderColor={rowBorder} fontSize="11px" letterSpacing="0.12em" py={5} display={{ base: "none", md: "table-cell" }}>{t("page_fees_t3")}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((r, i) => (
                    <Tr
                      key={i}
                      _hover={{ bg: dark ? "rgba(255,255,255,0.025)" : "rgba(0,87,184,0.03)" }}
                      transition="background 0.15s ease"
                    >
                      <Td borderColor={rowBorder} py={5}>
                        <Text fontSize={{ base: "13.5px", md: "15px" }} color={textMain} fontWeight="600">{r.s}</Text>
                      </Td>
                      <Td borderColor={rowBorder} py={5}>
                        <HStack spacing={2}>
                          <Text fontSize={{ base: "13.5px", md: "15px" }} color={textMain} fontWeight="700">{r.f}</Text>
                          {r.free && <Badge bg="rgba(34,197,94,0.15)" color="#22c55e" fontSize="9.5px" px={2} py={0.5} borderRadius="full">FREE</Badge>}
                          {r.highlight && <Badge bg="rgba(0,87,184,0.15)" color={BRAND_LIGHT} fontSize="9.5px" px={2} py={0.5} borderRadius="full">LOW</Badge>}
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
        </motion.div>
      </Container>

      {/* Account tiers */}
      <Container maxW="1100px" py={{ base: 14, md: 24 }}>
        <VStack spacing={12}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7 }}
          >
            <VStack spacing={3} textAlign="center">
              <Heading fontSize={{ base: "32px", md: "52px" }} fontWeight="800" letterSpacing="-0.035em" fontFamily="'DM Sans', sans-serif" color={textMain} lineHeight="1">
                {t("page_fees_limits_title")}
              </Heading>
            </VStack>
          </motion.div>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap={5} w="100%">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <Box
                  position="relative"
                  borderRadius="24px"
                  p={{ base: 6, md: 8 }}
                  bg={dark ? tier.grad : cardBg}
                  border="1px solid"
                  borderColor={tier.badge ? "rgba(0,87,184,0.4)" : cardBorder}
                  backdropFilter="blur(14px)"
                  transition="all 0.3s ease"
                  _hover={{ transform: "translateY(-4px)", borderColor: tier.badge ? BRAND : BRAND_LIGHT, boxShadow: dark ? "0 18px 50px rgba(0,87,184,0.25)" : "0 18px 50px rgba(0,87,184,0.12)" }}
                  overflow="hidden"
                  h="100%"
                >
                  {!dark && <Box position="absolute" inset={0} bg={tier.grad} opacity={0.5} pointerEvents="none" />}
                  <VStack align="start" spacing={5} position="relative">
                    <HStack spacing={3} w="100%">
                      <Flex
                        w="44px"
                        h="44px"
                        borderRadius="14px"
                        bg={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
                        border="1px solid"
                        borderColor={cardBorder}
                        align="center"
                        justify="center"
                      >
                        <Icon as={tier.icon} color={tier.dot} boxSize={5} />
                      </Flex>
                      <Box flex={1}>
                        <Text fontSize="11.5px" fontWeight="800" color={textSub} letterSpacing="0.15em" textTransform="uppercase">
                          {t("page_fees_tier", "TIER")}
                        </Text>
                        <Text fontSize="18px" fontWeight="800" color={textMain} letterSpacing="-0.015em">
                          {tier.title}
                        </Text>
                      </Box>
                      {tier.badge && (
                        <Badge bg={BRAND} color="white" fontSize="9.5px" fontWeight="800" letterSpacing="0.1em" px={2.5} py={1} borderRadius="full">
                          POPULAR
                        </Badge>
                      )}
                    </HStack>

                    <Text fontSize="14.5px" color={textSub} lineHeight="1.7" fontWeight="500">
                      {tier.desc}
                    </Text>

                    <VStack align="start" spacing={2.5} w="100%" pt={2} borderTop="1px solid" borderColor={cardBorder}>
                      {tier.perks.map((p) => (
                        <HStack key={p} spacing={2.5} pt={2.5}>
                          <Flex w="18px" h="18px" borderRadius="full" bg={tier.dot} opacity={0.85} align="center" justify="center" flexShrink={0}>
                            <Icon as={FiCheck} color="white" boxSize={2.5} />
                          </Flex>
                          <Text fontSize="13px" color={textMain} fontWeight="600">
                            {p}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </VStack>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Button
              as={NextLink}
              href="/register"
              h="56px"
              px={10}
              bg={dark ? "white" : "#0a0f1e"}
              color={dark ? "black" : "white"}
              borderRadius="full"
              fontWeight="800"
              fontSize="14px"
              rightIcon={<Icon as={FiArrowRight} />}
              _hover={{ opacity: 0.9, transform: "translateY(-2px)", boxShadow: "0 14px 40px rgba(0,87,184,0.3)" }}
              transition="all 0.2s"
            >
              {t("nav_register")}
            </Button>
          </motion.div>
        </VStack>
      </Container>

      <PublicFooter />
    </Box>
  );
}
