"use client";

/* ═══════════════════════════════════════════════════════════════════
   /business — Fortuni Business marketing page
   Monochrome palette, #226dff as the only accent.
   All copy from Tolgee (biz_* namespace).
   ─────────────────────────────────────────────────────────────────── */

import NextLink from "next/link";
import { useEffect } from "react";
import { useTranslate } from "@tolgee/react";
import {
  Box, Container, Flex, HStack, VStack, SimpleGrid,
  Heading, Text, Icon, useColorMode,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import {
  FiArrowRight, FiCheck, FiUsers, FiCreditCard, FiSend,
  FiBarChart2, FiShield, FiZap, FiCode, FiGlobe,
  FiLock, FiTrendingUp,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

const ACCENT = "#226dff";
const ease = [0.22, 1, 0.36, 1] as const;

/** Use animate (not whileInView) for elements already above the fold */
const heroAnim = (delay = 0) => ({
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease },
});

/** whileInView for sections below the fold */
const fadeUp = (delay = 0) => ({
  initial:     { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport:    { once: true, amount: 0.12 },
  transition:  { duration: 0.6, delay, ease },
});

/* ─── 1. HERO ─────────────────────────────────────────────────────── */
function Hero() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark     = colorMode === "dark";
  const textMain = dark ? "#ffffff" : "#0a0a0a";
  const textSub  = dark ? "rgba(255,255,255,0.52)" : "rgba(0,0,0,0.52)";
  const border   = dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
  const surfBg   = dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.03)";

  return (
    <Box
      position="relative" overflow="hidden"
      pt={{ base: "116px", md: "152px" }}
      pb={{ base: 20, md: 28 }}
      px={{ base: 5, md: 10 }}
      borderBottom="1px solid" borderColor={border}
    >
      {/* Accent glow — motion.div so filter:blur stays in inline style */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute", top: 0, left: "50%",
          width: 900, height: 500,
          transform: "translate(-50%, -42%)",
          borderRadius: "50%",
          background: ACCENT,
          filter: "blur(200px)",
          opacity: dark ? 0.08 : 0.05,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <Container maxW="1200px" position="relative" zIndex={1}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 12, lg: 16 }} alignItems="center">

          {/* Left — headline */}
          <motion.div {...heroAnim(0)}>
            <VStack align="start" spacing={7}>
              <Text
                fontSize="11.5px" fontWeight="800" letterSpacing="0.14em"
                textTransform="uppercase" color={ACCENT}
              >
                Fortuni Business
              </Text>

              <Heading
                fontFamily="'DM Sans', sans-serif" fontWeight="800"
                fontSize={{ base: "40px", md: "62px", lg: "76px" }}
                letterSpacing="-0.045em" lineHeight={0.97} color={textMain}
              >
                {t("biz_page_h1_1")}
                <br />
                <Box as="span" color={ACCENT}>{t("biz_page_h1_2")}</Box>
              </Heading>

              <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} maxW="480px" lineHeight={1.65}>
                {t("biz_page_sub")}
              </Text>

              <HStack spacing={3} flexWrap="wrap" pt={1}>
                <NextLink href="/register?type=business" passHref legacyBehavior>
                  <HStack as="a" spacing={2} px={6} h="50px" borderRadius="13px"
                    bg={ACCENT} color="#fff" cursor="pointer"
                    transition="all 0.2s ease"
                    _hover={{ opacity: 0.88, transform: "translateY(-1px)" } as any}
                  >
                    <Text fontWeight="800" fontSize="15px">{t("biz_page_cta_start")}</Text>
                    <Icon as={FiArrowRight} boxSize="15px" />
                  </HStack>
                </NextLink>
                <NextLink href="#contact" passHref legacyBehavior>
                  <HStack as="a" spacing={2} px={5} h="50px" borderRadius="13px"
                    bg="transparent" color={textSub} cursor="pointer"
                    border="1px solid" borderColor={border}
                    transition="all 0.2s ease"
                    _hover={{ color: textMain, borderColor: dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)" } as any}
                  >
                    <Text fontWeight="700" fontSize="15px">{t("biz_page_cta_contact")}</Text>
                  </HStack>
                </NextLink>
              </HStack>
            </VStack>
          </motion.div>

          {/* Right — trust + stats */}
          <motion.div {...heroAnim(0.14)}>
            <VStack align="start" spacing={6}>
              {/* Trust badges */}
              <HStack spacing={5} flexWrap="wrap">
                {[
                  { icon: FiShield, label: t("biz_page_trust_1") },
                  { icon: FiLock,   label: t("biz_page_trust_2") },
                  { icon: FiGlobe,  label: t("biz_page_trust_3") },
                ].map((tt) => (
                  <HStack key={tt.label} spacing={2}>
                    <Icon as={tt.icon} boxSize="13px" color={textSub} />
                    <Text fontSize="11.5px" fontWeight="700" color={textSub}
                      letterSpacing="0.07em" textTransform="uppercase">
                      {tt.label}
                    </Text>
                  </HStack>
                ))}
              </HStack>

              {/* Stat tiles */}
              <SimpleGrid columns={2} spacing={4} w="100%">
                {[
                  { stat: t("biz_stat1_val"), label: t("biz_stat1_label") },
                  { stat: t("biz_stat2_val"), label: t("biz_stat2_label") },
                  { stat: t("biz_stat3_val"), label: t("biz_stat3_label") },
                  { stat: t("biz_stat4_val"), label: t("biz_stat4_label") },
                ].map((s) => (
                  <Box key={s.stat}
                    p={{ base: 5, md: 6 }}
                    border="1px solid" borderColor={border}
                    borderRadius="16px"
                    bg={surfBg}
                  >
                    <Text
                      fontFamily="'DM Sans', sans-serif" fontWeight="800"
                      fontSize={{ base: "28px", md: "36px" }}
                      letterSpacing="-0.04em" color={textMain} lineHeight={1}
                    >
                      {s.stat}
                    </Text>
                    <Text fontSize="12px" fontWeight="600" color={textSub} mt={1}>
                      {s.label}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </VStack>
          </motion.div>

        </SimpleGrid>
      </Container>
    </Box>
  );
}

/* ─── 2. COMPARISON ───────────────────────────────────────────────── */
function Comparison() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark     = colorMode === "dark";
  const textMain = dark ? "#ffffff" : "#0a0a0a";
  const textSub  = dark ? "rgba(255,255,255,0.52)" : "rgba(0,0,0,0.52)";
  const border   = dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
  const surfBg   = dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)";

  const rows = [
    { feature: t("biz_cmp_r1"), bank: t("biz_cmp_r1_bank"), fortuni: t("biz_cmp_r1_us") },
    { feature: t("biz_cmp_r2"), bank: t("biz_cmp_r2_bank"), fortuni: t("biz_cmp_r2_us") },
    { feature: t("biz_cmp_r3"), bank: t("biz_cmp_r3_bank"), fortuni: t("biz_cmp_r3_us") },
    { feature: t("biz_cmp_r4"), bank: t("biz_cmp_r4_bank"), fortuni: t("biz_cmp_r4_us") },
    { feature: t("biz_cmp_r5"), bank: t("biz_cmp_r5_bank"), fortuni: t("biz_cmp_r5_us") },
  ];

  return (
    <Box py={{ base: 20, md: 28 }} px={{ base: 5, md: 10 }}>
      <Container maxW="1200px">
        <VStack spacing={{ base: 10, md: 14 }} align="stretch">
          <motion.div {...fadeUp()}>
            <VStack spacing={4} align="start" maxW="600px">
              <Heading
                fontSize={{ base: "28px", md: "44px" }} fontWeight="800"
                letterSpacing="-0.04em" color={textMain} lineHeight={1.05}
              >
                {t("biz_cmp_title")}
              </Heading>
              <Text fontSize={{ base: "14px", md: "16px" }} color={textSub} lineHeight={1.65}>
                {t("biz_cmp_sub")}
              </Text>
            </VStack>
          </motion.div>

          <motion.div {...fadeUp(0.1)}>
            <Box border="1px solid" borderColor={border} borderRadius="20px"
              overflow="hidden" bg={surfBg}>
              {/* Header */}
              <SimpleGrid columns={3}
                px={{ base: 4, md: 7 }} py={4}
                bg={dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)"}
                borderBottom="1px solid" borderColor={border}
              >
                {[t("biz_cmp_hdr_feature"), t("biz_cmp_hdr_bank"), t("biz_cmp_hdr_us")].map((h, i) => (
                  <Text key={h} fontSize="11px" fontWeight="800" letterSpacing="0.1em"
                    textTransform="uppercase" color={i === 2 ? ACCENT : textSub}>
                    {h}
                  </Text>
                ))}
              </SimpleGrid>
              {/* Rows */}
              {rows.map((r, i) => (
                <SimpleGrid key={i} columns={3}
                  px={{ base: 4, md: 7 }} py={{ base: 4, md: 5 }}
                  borderBottom={i < rows.length - 1 ? "1px solid" : "none"}
                  borderColor={border} alignItems="center"
                >
                  <Text fontSize={{ base: "13px", md: "14px" }} fontWeight="700" color={textMain}>
                    {r.feature}
                  </Text>
                  <Text fontSize={{ base: "12.5px", md: "13.5px" }} color={textSub}>{r.bank}</Text>
                  <HStack spacing={2}>
                    <Flex w="18px" h="18px" borderRadius="full" bg={ACCENT}
                      align="center" justify="center" flexShrink={0}>
                      <Icon as={FiCheck} color="#fff" boxSize="10px" />
                    </Flex>
                    <Text fontSize={{ base: "12.5px", md: "13.5px" }} color={textMain} fontWeight="700">
                      {r.fortuni}
                    </Text>
                  </HStack>
                </SimpleGrid>
              ))}
            </Box>
          </motion.div>
        </VStack>
      </Container>
    </Box>
  );
}

/* ─── 3. CAPABILITY GRID ──────────────────────────────────────────── */
function Capabilities() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark     = colorMode === "dark";
  const textMain = dark ? "#ffffff" : "#0a0a0a";
  const textSub  = dark ? "rgba(255,255,255,0.52)" : "rgba(0,0,0,0.52)";
  const border   = dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
  const surfBg   = dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)";

  const caps = [
    { icon: FiSend,       title: t("biz_cap1_title"), desc: t("biz_cap1_desc") },
    { icon: FiCreditCard, title: t("biz_cap2_title"), desc: t("biz_cap2_desc") },
    { icon: FiUsers,      title: t("biz_cap3_title"), desc: t("biz_cap3_desc") },
    { icon: FiBarChart2,  title: t("biz_cap4_title"), desc: t("biz_cap4_desc") },
    { icon: FiCode,       title: t("biz_cap5_title"), desc: t("biz_cap5_desc") },
    { icon: FiTrendingUp, title: t("biz_cap6_title"), desc: t("biz_cap6_desc") },
  ];

  return (
    <Box
      py={{ base: 20, md: 28 }} px={{ base: 5, md: 10 }}
      borderTop="1px solid" borderColor={border}
    >
      <Container maxW="1200px">
        <VStack spacing={{ base: 12, md: 16 }} align="stretch">
          <motion.div {...fadeUp()}>
            <VStack spacing={4} align="start" maxW="640px">
              <Text fontSize="11.5px" fontWeight="800" letterSpacing="0.14em"
                textTransform="uppercase" color={ACCENT}>
                {t("biz_section_cap")}
              </Text>
              <Heading fontSize={{ base: "28px", md: "44px" }} fontWeight="800"
                letterSpacing="-0.04em" color={textMain} lineHeight={1.05}>
                {t("biz_cap_title")}
              </Heading>
              <Text fontSize={{ base: "14px", md: "16px" }} color={textSub} lineHeight={1.65}>
                {t("biz_cap_sub")}
              </Text>
            </VStack>
          </motion.div>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 4, md: 5 }}>
            {caps.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{ duration: 0.5, delay: 0.06 * i, ease }}
                whileHover={{ y: -3 }}
              >
                <VStack align="start" spacing={4} h="100%"
                  p={{ base: 6, md: 7 }}
                  bg={surfBg} border="1px solid" borderColor={border}
                  borderRadius="18px"
                  transition="border-color 0.2s ease, box-shadow 0.2s ease"
                  _hover={{
                    borderColor: "rgba(34,109,255,0.40)",
                    boxShadow: `0 12px 32px ${dark ? "rgba(34,109,255,0.12)" : "rgba(34,109,255,0.07)"}`,
                  }}
                >
                  <Flex w="40px" h="40px" borderRadius="10px" align="center" justify="center"
                    bg={dark ? "rgba(34,109,255,0.12)" : "rgba(34,109,255,0.08)"}
                    border="1px solid" borderColor={dark ? "rgba(34,109,255,0.28)" : "rgba(34,109,255,0.16)"}
                    flexShrink={0}
                  >
                    <Icon as={c.icon} color={ACCENT} boxSize="17px" />
                  </Flex>
                  <Text fontWeight="800" fontSize={{ base: "15px", md: "17px" }}
                    color={textMain} letterSpacing="-0.02em">
                    {c.title}
                  </Text>
                  <Text fontSize={{ base: "13px", md: "13.5px" }} color={textSub} lineHeight={1.65}>
                    {c.desc}
                  </Text>
                </VStack>
              </motion.div>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}

/* ─── 4. USE CASES ─────────────────────────────────────────────────── */
function UseCases() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark     = colorMode === "dark";
  const textMain = dark ? "#ffffff" : "#0a0a0a";
  const textSub  = dark ? "rgba(255,255,255,0.52)" : "rgba(0,0,0,0.52)";
  const border   = dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
  const surfBg   = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)";

  const cases = [
    { tag: t("biz_uc1_tag"), title: t("biz_uc1_title"), desc: t("biz_uc1_desc"), icon: FiGlobe },
    { tag: t("biz_uc2_tag"), title: t("biz_uc2_title"), desc: t("biz_uc2_desc"), icon: FiUsers },
    { tag: t("biz_uc3_tag"), title: t("biz_uc3_title"), desc: t("biz_uc3_desc"), icon: FiZap },
    { tag: t("biz_uc4_tag"), title: t("biz_uc4_title"), desc: t("biz_uc4_desc"), icon: FiCode },
  ];

  return (
    <Box py={{ base: 20, md: 28 }} px={{ base: 5, md: 10 }}
      borderTop="1px solid" borderColor={border}>
      <Container maxW="1200px">
        <VStack spacing={{ base: 12, md: 16 }} align="stretch">
          <motion.div {...fadeUp()}>
            <VStack spacing={4} align="start" maxW="640px">
              <Text fontSize="11.5px" fontWeight="800" letterSpacing="0.14em"
                textTransform="uppercase" color={ACCENT}>
                {t("biz_section_uc")}
              </Text>
              <Heading fontSize={{ base: "28px", md: "44px" }} fontWeight="800"
                letterSpacing="-0.04em" color={textMain} lineHeight={1.05}>
                {t("biz_uc_title")}
              </Heading>
              <Text fontSize={{ base: "14px", md: "16px" }} color={textSub} lineHeight={1.65}>
                {t("biz_uc_sub")}
              </Text>
            </VStack>
          </motion.div>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 4, md: 5 }}>
            {cases.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{ duration: 0.55, delay: 0.06 * i, ease }}
                whileHover={{ y: -3 }}
              >
                <Box bg={surfBg} border="1px solid" borderColor={border}
                  borderRadius="20px" p={{ base: 7, md: 9 }} h="100%"
                  transition="border-color 0.2s ease"
                  _hover={{ borderColor: dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.16)" }}
                >
                  <HStack spacing={3} mb={4}>
                    <Flex w="34px" h="34px" borderRadius="9px" align="center" justify="center"
                      bg={dark ? "rgba(34,109,255,0.12)" : "rgba(34,109,255,0.08)"}
                      border="1px solid" borderColor={dark ? "rgba(34,109,255,0.28)" : "rgba(34,109,255,0.16)"}
                      flexShrink={0}
                    >
                      <Icon as={c.icon} color={ACCENT} boxSize="14px" />
                    </Flex>
                    <Text fontSize="11px" fontWeight="800" color={ACCENT}
                      letterSpacing="0.12em" textTransform="uppercase">
                      {c.tag}
                    </Text>
                  </HStack>
                  <Heading fontSize={{ base: "20px", md: "23px" }} fontWeight="800"
                    color={textMain} letterSpacing="-0.025em" mb={3} lineHeight={1.15}>
                    {c.title}
                  </Heading>
                  <Text fontSize={{ base: "13.5px", md: "14.5px" }} color={textSub} lineHeight={1.65}>
                    {c.desc}
                  </Text>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}

/* ─── 5. CTA ──────────────────────────────────────────────────────── */
function CTASection() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark   = colorMode === "dark";
  const border = dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";

  return (
    <Box id="contact" py={{ base: 20, md: 28 }} px={{ base: 5, md: 10 }}
      borderTop="1px solid" borderColor={border}>
      <Container maxW="1100px">
        <motion.div {...fadeUp()}>
          {/* Dark panel in both modes — deliberate contrast break */}
          <Box
            borderRadius={{ base: "24px", md: "32px" }} overflow="hidden"
            bg="#0a0a0a"
            border="1px solid" borderColor="rgba(255,255,255,0.08)"
            p={{ base: 10, md: 14, lg: 16 }}
            position="relative"
          >
            {/* Dot-grid texture */}
            <Box
              position="absolute" inset={0} pointerEvents="none"
              style={{
                opacity: 0.05,
                backgroundImage: "radial-gradient(circle at 1.5px 1.5px, #fff 1px, transparent 0)",
                backgroundSize: "28px 28px",
              } as React.CSSProperties}
            />
            {/* Accent glow */}
            <motion.div
              aria-hidden
              style={{
                position: "absolute", top: "50%", left: "32%",
                width: 600, height: 380,
                transform: "translate(-50%,-50%)",
                borderRadius: "50%",
                background: ACCENT,
                filter: "blur(160px)",
                opacity: 0.10,
                pointerEvents: "none",
              }}
            />

            <VStack spacing={7} position="relative" zIndex={1} align="start" maxW="640px">
              <Text fontSize="11.5px" fontWeight="800" letterSpacing="0.14em"
                textTransform="uppercase" color="rgba(255,255,255,0.38)">
                Fortuni Business
              </Text>
              <Heading
                fontSize={{ base: "28px", md: "48px" }} fontWeight="800"
                color="#ffffff" letterSpacing="-0.04em" lineHeight={1.04}
                fontFamily="'DM Sans', sans-serif"
              >
                {t("biz_cta_title")}
              </Heading>
              <Text fontSize={{ base: "14px", md: "17px" }} color="rgba(255,255,255,0.55)" lineHeight={1.65}>
                {t("biz_cta_sub")}
              </Text>
              <HStack spacing={3} flexWrap="wrap" pt={1}>
                <NextLink href="/register?type=business" passHref legacyBehavior>
                  <HStack as="a" spacing={2} px={6} h="50px" borderRadius="13px"
                    bg={ACCENT} color="#fff" cursor="pointer"
                    transition="all 0.2s ease"
                    _hover={{ opacity: 0.88 } as any}
                  >
                    <Text fontWeight="800" fontSize="15px">{t("biz_cta_button_start")}</Text>
                    <Icon as={FiArrowRight} boxSize="15px" />
                  </HStack>
                </NextLink>
                <NextLink href={`mailto:business@fortuni.com`} passHref legacyBehavior>
                  <HStack as="a" spacing={2} px={5} h="50px" borderRadius="13px"
                    bg="rgba(255,255,255,0.07)" color="rgba(255,255,255,0.75)" cursor="pointer"
                    border="1px solid rgba(255,255,255,0.13)"
                    transition="all 0.2s ease"
                    _hover={{ bg: "rgba(255,255,255,0.12)", color: "#fff" } as any}
                  >
                    <Text fontWeight="700" fontSize="14px">business@fortuni.com</Text>
                  </HStack>
                </NextLink>
              </HStack>
            </VStack>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}

/* ─── PAGE ────────────────────────────────────────────────────────── */
export default function BusinessPage() {
  const { colorMode } = useColorMode();
  const dark     = colorMode === "dark";
  const pageBg   = dark ? "#000000" : "#ffffff";
  const textMain = dark ? "#ffffff" : "#0a0a0a";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.background;
    document.body.style.background = pageBg;
    return () => { document.body.style.background = prev; };
  }, [pageBg]);

  return (
    <Box minH="100vh" color={textMain} bg={pageBg}>
      <PublicNav />
      <Hero />
      <Comparison />
      <Capabilities />
      <UseCases />
      <CTASection />
      <PublicFooter />
    </Box>
  );
}
