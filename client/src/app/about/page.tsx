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
import { publicPageEase, publicPageTheme } from "@/components/ui/publicPageTheme";

export default function AboutPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const {
    pageBg, textMain, textSub, cardBg, cardBgHover,
    raisedBg, raisedAlt, cardBorder, strongBorder, accent, accentText,
    accentSoft, accentBorder, shadow, titleGradient,
  } = publicPageTheme(dark);
  const iconBg = accentSoft;

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
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [...publicPageEase] }}>
      <Box pt={{ base: "118px", md: "160px" }} pb={{ base: 14, md: 22 }} textAlign="center" position="relative" overflow="hidden">
        <Box
          position="absolute" inset={0}
          bg={dark
            ? "linear-gradient(180deg, rgba(99,161,219,0.10) 0%, rgba(99,161,219,0.025) 42%, rgba(22,24,28,0) 100%)"
            : "linear-gradient(180deg, rgba(79,139,196,0.10) 0%, rgba(79,139,196,0.025) 42%, rgba(255,255,255,0) 100%)"}
          pointerEvents="none"
        />
        <Container maxW="960px" position="relative" zIndex={1}>
          <VStack spacing={7}>
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
                bg={accent} color="#ffffff"
                borderRadius="14px" fontWeight="800" fontSize="14px"
                rightIcon={<Icon as={FiArrowRight} />}
                boxShadow={dark ? "0 14px 38px rgba(99,161,219,0.22)" : "0 14px 34px rgba(79,139,196,0.18)"}
                _hover={{ opacity: 0.9, transform: "translateY(-2px)" }}
                transition="all 0.2s"
              >
                {t("nav_register")}
              </Button>
              <Button
                as={NextLink} href="/trust"
                h="52px" px={8} variant="ghost"
                color={textMain}
                border="1px solid" borderColor={cardBorder}
                bg={cardBg}
                borderRadius="14px" fontWeight="700" fontSize="14px"
                _hover={{ borderColor: strongBorder, bg: cardBgHover }}
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
      <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6, ease: [...publicPageEase] }}>
      <Container maxW="1100px" pb={{ base: 14, md: 22 }}>
        <SimpleGrid
          columns={{ base: 2, md: 4 }}
          gap={{ base: 3, md: 4 }}
        >
          {stats.map((s, i) => (
            <VStack
              key={s.l}
              align="start"
              spacing={2}
              p={{ base: 5, md: 6 }}
              bg={i === 0 ? raisedBg : cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="18px"
              minH={{ base: "126px", md: "140px" }}
              boxShadow={i === 0 ? shadow : "none"}
            >
              <Heading
                fontSize={{ base: "30px", md: "42px" }}
                fontWeight="900"
                letterSpacing="-0.04em"
                color={textMain}
              >
                {s.v}
              </Heading>
              <Text fontSize="12px" color={textSub} fontWeight="700" lineHeight="1.35">
                {s.l}
              </Text>
            </VStack>
          ))}
        </SimpleGrid>
      </Container>
      </motion.div>

      {/* ── Mission ───────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65, ease: [...publicPageEase] }}>
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
                  bg={raisedBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="20px" p={{ base: 6, md: 8 }}
                  boxShadow={dark ? "0 18px 48px rgba(0,0,0,0.22)" : "0 18px 48px rgba(10,10,11,0.06)"}
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
      <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.65, ease: [...publicPageEase] }}>
      <Container maxW="860px" py={{ base: 12, md: 20 }}>
        <VStack spacing={6} align="start">
          <Heading
            fontSize={{ base: "28px", md: "40px" }}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={textMain}
          >
            {t("page_about_story_title")}
          </Heading>
          <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="22px" p={{ base: 6, md: 8 }}>
            <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight="1.9">
              {t("page_about_story_p1")}
            </Text>
            <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight="1.9" mt={5}>
              {t("page_about_story_p2")}
            </Text>
          </Box>
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
                    bg={raisedAlt} border="1px solid" borderColor={cardBorder}
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
                  bg: cardBgHover,
                  borderColor: strongBorder,
                  boxShadow: shadow,
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
                    bg: cardBgHover,
                    borderColor: strongBorder,
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
          borderRadius="28px" overflow="hidden" position="relative"
          bg={dark ? "#1E2127" : "#0A0A0B"}
          border="1px solid"
          borderColor={dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,11,0.12)"}
          p={{ base: 10, md: 16 }} textAlign="center"
          boxShadow={shadow}
        >
          <Box
            position="absolute" inset={0}
            bg="linear-gradient(135deg, rgba(99,161,219,0.20), transparent 42%)"
            pointerEvents="none"
          />
          <VStack spacing={6} position="relative" zIndex={2}>
            <Heading
              fontSize={{ base: "28px", md: "48px" }}
              fontWeight="900"
              color="#ffffff"
              letterSpacing="-0.04em"
              lineHeight="1.05"
              maxW="580px"
            >
              {t("page_about_cta")}
            </Heading>
            <Text
              fontSize={{ base: "15px", md: "17px" }}
              color="rgba(255,255,255,0.72)"
              maxW="440px"
            >
              {t("page_about_cta_sub")}
            </Text>
            <HStack spacing={3}>
              <Button
                as={NextLink} href="/register"
                h="52px" px={8}
                bg="#ffffff"
                color="#0A0A0B"
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
                color="rgba(255,255,255,0.78)"
                borderRadius="14px" fontWeight="700" fontSize="14px"
                _hover={{ bg: "rgba(255,255,255,0.1)" }}
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
