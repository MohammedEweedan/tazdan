"use client";

import NextLink from "next/link";
import { useTranslate } from "@tolgee/react";
import {
  Box, Container, Heading, Text, VStack, HStack,
  SimpleGrid, Icon, Flex, Button, Grid, GridItem,
  useColorMode,
} from "@chakra-ui/react";
import {
  FiEye, FiMapPin, FiShield, FiKey, FiArrowRight,
  FiCheckCircle, FiDollarSign, FiZap,
} from "react-icons/fi";
import { motion } from "framer-motion";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

export default function AboutPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  // Charcoal dark mode (matches the app) + #63a1db brand accent.
  const pageBg     = dark ? "#16181C" : "#ffffff";
  const textMain   = dark ? "#ffffff" : "#0a0f1e";
  const textSub    = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const cardBg     = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const iconBg     = dark ? "rgba(99,161,219,0.14)" : "rgba(99,161,219,0.10)";
  const accent     = "#63a1db";

  const titleGradient = dark
    ? "linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)"
    : "linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)";

  const values = [
    { icon: FiEye,    title: t("page_about_v1_t"), desc: t("page_about_v1_d") },
    { icon: FiMapPin, title: t("page_about_v2_t"), desc: t("page_about_v2_d") },
    { icon: FiShield, title: t("page_about_v3_t"), desc: t("page_about_v3_d") },
    { icon: FiKey,    title: t("page_about_v4_t"), desc: t("page_about_v4_d") },
  ];

  const stats = [
    { v: "2,400+", l: t("waitlist_stat1_l") },
    { v: "<2s",    l: "Settlement speed" },
    { v: "0.25%",  l: "Taker fee" },
    { v: "99.98%", l: t("page_about_stats_uptime") },
  ];

  const milestones = [
    { year: t("page_about_milestone1_year"), title: t("page_about_milestone1_t"), desc: t("page_about_milestone1_d") },
    { year: t("page_about_milestone2_year"), title: t("page_about_milestone2_t"), desc: t("page_about_milestone2_d") },
    { year: t("page_about_milestone3_year"), title: t("page_about_milestone3_t"), desc: t("page_about_milestone3_d") },
    { year: t("page_about_milestone4_year"), title: t("page_about_milestone4_t"), desc: t("page_about_milestone4_d") },
    { year: t("page_about_milestone5_year"), title: t("page_about_milestone5_t"), desc: t("page_about_milestone5_d") },
  ];

  const principles = [
    { icon: FiCheckCircle, title: t("page_about_press_1_t"), desc: t("page_about_press_1_d") },
    { icon: FiDollarSign,  title: t("page_about_press_2_t"), desc: t("page_about_press_2_d") },
    { icon: FiZap,         title: t("page_about_press_3_t"), desc: t("page_about_press_3_d") },
  ];

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      <Box pt={{ base: "120px", md: "170px" }} pb={{ base: 16, md: 28 }} textAlign="center" position="relative">
        {/* subtle grid texture */}
        <Box
          position="absolute" inset={0} opacity={dark ? 0.04 : 0.03}
          backgroundImage="linear-gradient(rgba(128,128,128,1) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,1) 1px, transparent 1px)"
          backgroundSize="60px 60px"
          pointerEvents="none"
        />
        <Container maxW="960px" position="relative" zIndex={1}>
          <VStack spacing={7}>
            <Text
              fontSize="11px" fontWeight="800" letterSpacing="0.18em"
              color={textSub} textTransform="uppercase"
            >
              {t("page_about_eyebrow")}
            </Text>
            <Heading
              as="h1"
              fontWeight="900"
              fontSize={{ base: "52px", md: "88px" }}
              lineHeight="1.0"
              letterSpacing="-0.04em"
              bgGradient={titleGradient}
              bgClip="text"
              maxW="860px"
              whiteSpace="pre-line"
            >
              {t("page_about_title")}
            </Heading>
            <Text
              fontSize={{ base: "16px", md: "20px" }}
              color={textSub}
              maxW="620px"
              lineHeight="1.7"
            >
              {t("page_about_sub")}
            </Text>
            <HStack spacing={3} pt={2}>
              <Button
                as={NextLink} href="/register"
                h="52px" px={8}
                bg={textMain} color={pageBg}
                borderRadius="14px" fontWeight="800" fontSize="14px"
                rightIcon={<Icon as={FiArrowRight} />}
                _hover={{ opacity: 0.85, transform: "scale(1.02)" }}
                transition="all 0.2s"
              >
                {t("nav_register")}
              </Button>
              <Button
                as={NextLink} href="/trust"
                h="52px" px={8} variant="ghost"
                color={textSub}
                border="1px solid" borderColor={cardBorder}
                borderRadius="14px" fontWeight="700" fontSize="14px"
                _hover={{ borderColor: textMain, color: textMain }}
                transition="all 0.2s"
              >
                {t("nav_trust") ?? "Trust & Security"}
              </Button>
            </HStack>
          </VStack>
        </Container>
      </Box>
      </motion.div>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      <Container maxW="1100px" pb={{ base: 16, md: 24 }}>
        <SimpleGrid
          columns={{ base: 2, md: 4 }}
          bg={cardBg}
          border="1px solid" borderColor={cardBorder}
          borderRadius="28px"
          py={{ base: 8, md: 10 }}
          px={{ base: 6, md: 10 }}
        >
          {stats.map((s, i) => (
            <VStack
              key={s.l}
              align="center"
              spacing={1.5}
              py={3}
              borderRight={i < stats.length - 1 ? "1px solid" : "none"}
              borderColor={cardBorder}
            >
              <Heading
                fontSize={{ base: "30px", md: "42px" }}
                fontWeight="900"
                letterSpacing="-0.04em"
                color={textMain}
              >
                {s.v}
              </Heading>
              <Text fontSize="12px" color={textSub} fontWeight="600" textAlign="center">
                {s.l}
              </Text>
            </VStack>
          ))}
        </SimpleGrid>
      </Container>
      </motion.div>

      {/* ── Mission ───────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
      <Box py={{ base: 16, md: 24 }} px={{ base: 4, md: 8 }}>
        <Container maxW="1100px">
          <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={{ base: 8, lg: 16 }} alignItems="center">
            <GridItem>
              <VStack align="start" spacing={5}>
                <Text fontSize="11px" fontWeight="800" letterSpacing="0.18em" color={textSub} textTransform="uppercase">
                  {t("page_about_mission_eyebrow")}
                </Text>
                <Heading
                  fontSize={{ base: "36px", md: "52px" }}
                  fontWeight="900"
                  letterSpacing="-0.04em"
                  lineHeight="1.05"
                  color={textMain}
                  whiteSpace="pre-line"
                >
                  {t("page_about_mission_title")}
                </Heading>
                <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight="1.8">
                  {t("page_about_mission_sub")}
                </Text>
              </VStack>
            </GridItem>
            <GridItem>
              <VStack align="stretch" spacing={4}>
                <Box
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="20px" p={{ base: 6, md: 8 }}
                >
                  <Heading fontSize="17px" fontWeight="800" color={textMain} mb={3} letterSpacing="-0.02em">
                    {t("page_about_problem_title")}
                  </Heading>
                  <Text fontSize="14.5px" color={textSub} lineHeight="1.8">
                    {t("page_about_problem_body")}
                  </Text>
                </Box>
                <Box
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="20px" p={{ base: 6, md: 8 }}
                >
                  <Heading fontSize="17px" fontWeight="800" color={textMain} mb={3} letterSpacing="-0.02em">
                    {t("page_about_solution_title")}
                  </Heading>
                  <Text fontSize="14.5px" color={textSub} lineHeight="1.8">
                    {t("page_about_solution_body")}
                  </Text>
                </Box>
              </VStack>
            </GridItem>
          </Grid>
        </Container>
      </Box>
      </motion.div>

      {/* ── Story prose ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
      <Container maxW="820px" py={{ base: 12, md: 20 }}>
        <VStack spacing={6} align="start">
          <Heading
            fontSize={{ base: "28px", md: "40px" }}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={textMain}
          >
            {t("page_about_story_title")}
          </Heading>
          <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight="1.9">
            {t("page_about_story_p1")}
          </Text>
          <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight="1.9">
            {t("page_about_story_p2")}
          </Text>
        </VStack>
      </Container>
      </motion.div>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <Box py={{ base: 14, md: 24 }} px={{ base: 4, md: 8 }}>
        <Container maxW="900px">
          <VStack spacing={12}>
            <VStack spacing={4} textAlign="center">
              <Heading
                fontSize={{ base: "28px", md: "44px" }}
                fontWeight="900"
                letterSpacing="-0.04em"
                color={textMain}
              >
                {t("page_about_timeline_title")}
              </Heading>
            </VStack>

            <VStack align="stretch" spacing={0} w="100%" position="relative">
              {/* vertical line */}
              <Box
                position="absolute"
                left={{ base: "20px", md: "88px" }}
                top={0} bottom={0} w="1px"
                bg={cardBorder}
              />

              {milestones.map((m, i) => (
                <motion.div key={m.year} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.08 }}>
                <HStack align="flex-start" spacing={{ base: 5, md: 8 }} pb={i < milestones.length - 1 ? 8 : 0} position="relative">
                  {/* year + dot */}
                  <VStack spacing={0} flexShrink={0} align="center" w={{ base: "40px", md: "104px" }}>
                    <Text
                      display={{ base: "none", md: "block" }}
                      fontSize="12px" fontWeight="800"
                      color={textSub} letterSpacing="0.08em"
                      mb={2}
                    >
                      {m.year}
                    </Text>
                    <Box
                      w="10px" h="10px" borderRadius="full"
                      bg={textMain} border="2px solid" borderColor={pageBg}
                      boxShadow={`0 0 0 3px ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`}
                      position="relative" zIndex={1}
                    />
                  </VStack>

                  {/* content card */}
                  <Box
                    flex={1}
                    bg={cardBg} border="1px solid" borderColor={cardBorder}
                    borderRadius="16px" p={{ base: 5, md: 6 }}
                    mb={0}
                  >
                    <Text
                      display={{ base: "block", md: "none" }}
                      fontSize="11px" fontWeight="800"
                      color={textSub} letterSpacing="0.10em"
                      textTransform="uppercase" mb={1}
                    >
                      {m.year}
                    </Text>
                    <Heading fontSize={{ base: "16px", md: "18px" }} fontWeight="800" color={textMain} letterSpacing="-0.02em" mb={2}>
                      {m.title}
                    </Heading>
                    <Text fontSize="14px" color={textSub} lineHeight="1.75">
                      {m.desc}
                    </Text>
                  </Box>
                </HStack>
                </motion.div>
              ))}
            </VStack>
          </VStack>
        </Container>
      </Box>

      {/* ── Values ────────────────────────────────────────────────────────── */}
      <Container maxW="1100px" py={{ base: 14, md: 24 }}>
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65 }}>
        <VStack spacing={12}>
          <Heading
            fontSize={{ base: "28px", md: "44px" }}
            fontWeight="900"
            letterSpacing="-0.04em"
            textAlign="center"
            color={textMain}
          >
            {t("page_about_values_title")}
          </Heading>
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap={5} w="100%">
            {values.map((v) => (
              <Box
                key={v.title}
                bg={cardBg}
                border="1px solid" borderColor={cardBorder}
                borderRadius="24px"
                p={{ base: 7, md: 9 }}
                transition="all 0.25s ease"
                _hover={{
                  transform: "translateY(-4px)",
                  borderColor: dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)",
                }}
              >
                <Flex
                  w="48px" h="48px"
                  bg={iconBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="14px" align="center" justify="center" mb={5}
                >
                  <Icon as={v.icon} color={accent} boxSize={5} />
                </Flex>
                <Heading fontSize={{ base: "19px", md: "22px" }} fontWeight="800" color={textMain} letterSpacing="-0.02em" mb={2}>
                  {v.title}
                </Heading>
                <Text fontSize="14.5px" color={textSub} lineHeight="1.75">
                  {v.desc}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </VStack>
        </motion.div>
      </Container>

      {/* ── Principles ────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65 }}>
      <Box py={{ base: 14, md: 24 }} px={{ base: 4, md: 8 }}>
        <Container maxW="1100px">
          <VStack spacing={10}>
            <VStack spacing={4} textAlign="center">
              <Text fontSize="11px" fontWeight="800" letterSpacing="0.18em" color={textSub} textTransform="uppercase">
                {t("page_about_press_eyebrow")}
              </Text>
              <Heading
                fontSize={{ base: "28px", md: "44px" }}
                fontWeight="900"
                letterSpacing="-0.04em"
                color={textMain}
              >
                {t("page_about_press_title")}
              </Heading>
            </VStack>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={5} w="100%">
              {principles.map((p) => (
                <Box
                  key={p.title}
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="20px" p={{ base: 6, md: 8 }}
                  transition="all 0.25s ease"
                  _hover={{
                    transform: "translateY(-4px)",
                    borderColor: dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)",
                  }}
                >
                  <Flex
                    w="44px" h="44px"
                    bg={iconBg} border="1px solid" borderColor={cardBorder}
                    borderRadius="12px" align="center" justify="center" mb={5}
                  >
                    <Icon as={p.icon} color={accent} boxSize={5} />
                  </Flex>
                  <Heading fontSize="17px" fontWeight="800" color={textMain} letterSpacing="-0.02em" mb={2}>
                    {p.title}
                  </Heading>
                  <Text fontSize="14px" color={textSub} lineHeight="1.8">
                    {p.desc}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>
      </motion.div>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65 }}>
      <Container maxW="1100px" py={{ base: 12, md: 20 }}>
        <Box
          borderRadius="32px" overflow="hidden" position="relative"
          bg={dark ? "#ffffff" : "#0a0f1e"}
          p={{ base: 10, md: 16 }} textAlign="center"
        >
          <Box
            position="absolute" inset={0} opacity={dark ? 0.04 : 0.06}
            backgroundImage="radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)"
            backgroundSize="36px 36px" pointerEvents="none"
            color={dark ? "black" : "white"}
          />
          <VStack spacing={6} position="relative" zIndex={2}>
            <Heading
              fontSize={{ base: "28px", md: "48px" }}
              fontWeight="900"
              color={dark ? "#000000" : "#ffffff"}
              letterSpacing="-0.04em"
              lineHeight="1.05"
              maxW="580px"
            >
              {t("page_about_cta")}
            </Heading>
            <Text
              fontSize={{ base: "15px", md: "17px" }}
              color={dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.75)"}
              maxW="440px"
            >
              {t("page_about_cta_sub")}
            </Text>
            <HStack spacing={3}>
              <Button
                as={NextLink} href="/register"
                h="52px" px={8}
                bg={dark ? "#0a0f1e" : "#ffffff"}
                color={dark ? "#ffffff" : "#0a0f1e"}
                borderRadius="14px" fontWeight="800" fontSize="14px"
                rightIcon={<Icon as={FiArrowRight} />}
                _hover={{ opacity: 0.9, transform: "scale(1.02)" }}
                transition="all 0.2s"
              >
                {t("nav_register")}
              </Button>
              <Button
                as={NextLink} href="/contact"
                h="52px" px={8} variant="ghost"
                color={dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.8)"}
                borderRadius="14px" fontWeight="700" fontSize="14px"
                _hover={{ bg: dark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)" }}
              >
                {t("nav_contact")}
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Container>
      </motion.div>

      <PublicFooter />
    </Box>
  );
}
