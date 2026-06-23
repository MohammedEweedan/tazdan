"use client";

import NextImage from "next/image";
import { useTranslate } from "@tolgee/react";
import {
  Box, Container, Heading, Text, VStack, HStack,
  SimpleGrid, Icon, Flex, Grid, GridItem,
  useColorMode,
} from "@chakra-ui/react";
import {
  FiEye, FiMapPin, FiShield, FiKey,
  FiCheckCircle, FiDollarSign, FiZap,
} from "react-icons/fi";
import { motion } from "framer-motion";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { publicPageEase, publicPageTheme } from "@/components/ui/publicPageTheme";
import {
  Band,
  CTASection,
  Em,
  GlowOrb,
  PageHero,
  Reveal,
  ShaderBackdrop,
  useAppleLocale,
} from "@/components/ui/appleKit";

const PEOPLE_AVATARS = [
  { src: "/screenshots/p1.avif", x: "clamp(-220px, -32vw, -118px)", y: "clamp(-118px, -14vw, -68px)", size: 92, delay: 0.02 },
  { src: "/screenshots/p2.avif", x: "clamp(-84px, -11vw, -44px)", y: "clamp(-172px, -22vw, -96px)", size: 104, delay: 0.10 },
  { src: "/screenshots/p3.avif", x: "clamp(96px, 19vw, 150px)", y: "clamp(-128px, -16vw, -72px)", size: 112, delay: 0.18 },
  { src: "/screenshots/p4.avif", x: "clamp(-182px, -27vw, -96px)", y: "clamp(76px, 15vw, 112px)", size: 88, delay: 0.26 },
  { src: "/screenshots/p5.avif", x: "clamp(68px, 14vw, 104px)", y: "clamp(92px, 18vw, 148px)", size: 96, delay: 0.34 },
  { src: "/screenshots/p6.avif", x: "clamp(126px, 30vw, 232px)", y: "clamp(26px, 6vw, 42px)", size: 102, delay: 0.42 },
];

function MarkedHeadline({ text }: { text: string }) {
  const parts = text.split("*");
  if (parts.length < 3) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <Em>{parts[1]}</Em>
      {parts.slice(2).join("*")}
    </>
  );
}

function AboutHeroMedia() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,11,0.08)";

  return (
    <Reveal delay={0.16} y={24}>
      <Box
        position="relative"
        w="100%"
        maxW="980px"
        mt={{ base: 3, md: 5 }}
        borderRadius={{ base: "28px", md: "40px" }}
        overflow="hidden"
        border="1px solid"
        borderColor={border}
        bg={dark ? "#0E1116" : "#F8FAFC"}
        boxShadow={dark ? "0 34px 110px rgba(0,0,0,0.36)" : "0 34px 110px rgba(10,15,30,0.12)"}
        style={{ aspectRatio: "16 / 7" }}
      >
        <Box
          as="video"
          src="/videos/Web_GlobeVideo.webm"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          position="absolute"
          inset={0}
          w="100%"
          h="100%"
          objectFit="cover"
          opacity={dark ? 0.7 : 0.76}
          zIndex={0}
        />
        <ShaderBackdrop opacity={dark ? 0.1 : 0.07} saturate={0.85} zIndex={1} />
        <Box position="absolute" inset={0} zIndex={2} bg={dark
          ? "linear-gradient(180deg, rgba(14,17,22,0.08), rgba(14,17,22,0.42))"
          : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.42))"}
        />
      </Box>
    </Reveal>
  );
}

function StoryFilm() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const { isAr, bodyLine, headingLine } = useAppleLocale();
  const dark = colorMode === "dark";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.16)";
  const inkSub = "rgba(255,255,255,0.68)";

  return (
    <Band tone="ink" maxW="1180px" shader={{ opacity: dark ? 0.16 : 0.12, saturate: 0.9 }}>
      <GlowOrb top="-180px" left="-80px" size="440px" opacity={0.18} />
      <GlowOrb bottom="-220px" right="-120px" size="520px" opacity={0.14} />
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
        <Reveal>
          <VStack align="start" spacing={6}>
            <Heading
              fontSize={{ base: "42px", md: "68px" }}
              lineHeight={headingLine ?? 0.96}
              letterSpacing={isAr ? "0" : "-0.05em"}
              color="#ffffff"
              fontWeight="800"
              maxW="560px"
            >
              {t("page_about_story_title")}
            </Heading>
            <Text fontSize={{ base: "17px", md: "21px" }} color={inkSub} lineHeight={bodyLine} maxW="580px">
              {t("page_about_story_p1")}
            </Text>
            <Text fontSize={{ base: "15px", md: "17px" }} color="rgba(255,255,255,0.52)" lineHeight={bodyLine} maxW="560px">
              {t("page_about_story_p2")}
            </Text>
          </VStack>
        </Reveal>

        <Reveal delay={0.12}>
          <Box
            position="relative"
            overflow="hidden"
            borderRadius={{ base: "28px", md: "36px" }}
            border="1px solid"
            borderColor={border}
            bg="rgba(255,255,255,0.045)"
            boxShadow="0 38px 120px rgba(0,0,0,0.44)"
            style={{ aspectRatio: "16 / 11" }}
          >
            <Box
              as="video"
              src="/videos/Consumer_UIAnims_Desktop-SendReceive.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              position="absolute"
              inset={0}
              w="100%"
              h="100%"
              objectFit="cover"
              opacity={0.86}
              zIndex={0}
            />
            <ShaderBackdrop opacity={0.12} mode="dark" saturate={0.85} zIndex={1} />
            <Box position="absolute" inset={0} zIndex={2} bg="linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.46))" />
            <Flex position="absolute" zIndex={3} left={{ base: 5, md: 7 }} right={{ base: 5, md: 7 }} bottom={{ base: 5, md: 7 }} align="end" justify="space-between" gap={4}>
              <Text color="#fff" fontSize={{ base: "14px", md: "16px" }} lineHeight={isAr ? 1.65 : 1.45} maxW="360px" fontWeight="650">
                {t("page_about_mission_title")}
              </Text>
              <Text color="rgba(255,255,255,0.62)" fontSize="12px" fontWeight="700">
                tazdan
              </Text>
            </Flex>
          </Box>
        </Reveal>
      </SimpleGrid>
    </Band>
  );
}

function PeopleConstellation() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const { isAr, headingLine, bodyLine } = useAppleLocale();
  const dark = colorMode === "dark";
  const textMain = dark ? "#F4F5F7" : "#0A0A0B";
  const textSub = dark ? "rgba(244,245,247,0.62)" : "rgba(10,10,11,0.58)";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,11,0.08)";

  return (
    <Band maxW="1180px" shader={{ opacity: dark ? 0.075 : 0.045 }}>
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 20 }} alignItems="center">
        <Reveal>
          <VStack align="start" spacing={5}>
            <Heading
              fontSize={{ base: "42px", md: "72px" }}
              lineHeight={headingLine ?? 0.98}
              letterSpacing={isAr ? "0" : "-0.05em"}
              color={textMain}
              fontWeight="800"
              maxW="620px"
            >
              <MarkedHeadline text={t("socialproof_label")} />
            </Heading>
            <Text fontSize={{ base: "16px", md: "20px" }} lineHeight={bodyLine} color={textSub} maxW="560px">
              {t("page_about_sub")}
            </Text>
          </VStack>
        </Reveal>

        <Reveal delay={0.08}>
          <Box position="relative" h={{ base: "390px", md: "520px" }} overflow="visible">
            <GlowOrb top="12%" left="18%" size="360px" opacity={dark ? 0.16 : 0.1} />
            <Box
              position="absolute"
              top="50%"
              left="50%"
              w={{ base: "210px", md: "270px" }}
              h={{ base: "210px", md: "270px" }}
              transform="translate(-50%, -50%)"
              borderRadius="50%"
              border="1px solid"
              borderColor={border}
              opacity={0.52}
            />
            <Box
              position="absolute"
              top="50%"
              left="50%"
              w={{ base: "318px", md: "420px" }}
              h={{ base: "318px", md: "420px" }}
              transform="translate(-50%, -50%)"
              borderRadius="50%"
              border="1px solid"
              borderColor={border}
              opacity={0.34}
            />
            {PEOPLE_AVATARS.map((avatar, index) => (
              <motion.div
                key={avatar.src}
                initial={{ opacity: 0, x: "-50%", y: "-50%", scale: 0.62 }}
                whileInView={{ opacity: 1, x: `calc(-50% + ${avatar.x})`, y: `calc(-50% + ${avatar.y})`, scale: 1 }}
                viewport={{ once: true, amount: 0.45 }}
                transition={{ duration: 1.15, delay: avatar.delay, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  zIndex: 10 + index,
                }}
              >
                <motion.div
                  animate={{ y: [0, index % 2 ? -10 : 10, 0] }}
                  transition={{ duration: 5.5 + index * 0.35, repeat: Infinity, ease: "easeInOut", delay: avatar.delay }}
                >
                  <Box
                    position="relative"
                    w={{ base: `${Math.max(64, avatar.size - 24)}px`, md: `${avatar.size}px` }}
                    h={{ base: `${Math.max(64, avatar.size - 24)}px`, md: `${avatar.size}px` }}
                    borderRadius="50%"
                    overflow="hidden"
                    border="2px solid"
                    borderColor={dark ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.92)"}
                    boxShadow={dark
                      ? "0 22px 70px rgba(0,0,0,0.52), 0 0 0 1px rgba(99,161,219,0.16)"
                      : "0 22px 70px rgba(10,15,30,0.16), 0 0 0 1px rgba(99,161,219,0.12)"}
                    bg={dark ? "#111" : "#edf2f7"}
                  >
                    <NextImage src={avatar.src} alt="" fill style={{ objectFit: "cover" }} sizes="120px" />
                  </Box>
                </motion.div>
              </motion.div>
            ))}
            <Flex position="absolute" inset={0} align="center" justify="center" pointerEvents="none">
              <Box
                w={{ base: "128px", md: "154px" }}
                h={{ base: "128px", md: "154px" }}
                borderRadius="50%"
                bg={dark ? "rgba(14,17,22,0.72)" : "rgba(255,255,255,0.72)"}
                border="1px solid"
                borderColor={border}
                backdropFilter="blur(18px)"
                boxShadow={dark ? "0 24px 70px rgba(0,0,0,0.45)" : "0 24px 70px rgba(10,15,30,0.12)"}
                display="grid"
                placeItems="center"
                overflow="hidden"
              >
                <NextImage src="/text-logo-color.png" alt="tazdan" width={110} height={34} style={{ width: "72%", height: "auto" }} />
              </Box>
            </Flex>
          </Box>
        </Reveal>
      </SimpleGrid>
    </Band>
  );
}

export default function AboutPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const {
    pageBg, textMain, textSub, cardBg, cardBgHover,
    raisedBg, raisedAlt, cardBorder, strongBorder, accent,
    accentSoft, shadow,
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
    { v: "<2s",    l: t("biz_stat3_label") },
    { v: "0.25%",  l: t("page_fees_stat_p2p") },
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

      {/* ── Hero ── */}
      <PageHero
        title={t("page_about_title")}
        subtitle={t("page_about_sub")}
        primary={{ label: t("nav_register"), href: "/register" }}
        secondary={{ label: t("nav_trust"), href: "/trust" }}
      >
        <AboutHeroMedia />
      </PageHero>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6, ease: [...publicPageEase] }}>
      <Container maxW="1120px" pb={{ base: 14, md: 22 }}>
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
              borderRadius="16px"
              minH={{ base: "126px", md: "140px" }}
              boxShadow="none"
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

      <StoryFilm />

      <PeopleConstellation />

      {/* ── Mission ───────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65, ease: [...publicPageEase] }}>
      <Box py={{ base: 16, md: 24 }} px={{ base: 4, md: 8 }} borderTop="1px solid" borderColor={cardBorder}>
        <Container maxW="1100px">
          <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={{ base: 8, lg: 16 }} alignItems="center">
            <GridItem>
              <VStack align="start" spacing={5}>
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
                  borderRadius="18px" p={{ base: 6, md: 8 }}
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
                  borderRadius="18px" p={{ base: 6, md: 8 }}
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

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <Box py={{ base: 14, md: 24 }} px={{ base: 4, md: 8 }} borderTop="1px solid" borderColor={cardBorder}>
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
                      w="10px" h="10px" borderRadius="3px"
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
                      color={textSub} mb={1}
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
                borderRadius="18px"
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
      <Box py={{ base: 14, md: 24 }} px={{ base: 4, md: 8 }} borderTop="1px solid" borderColor={cardBorder}>
        <Container maxW="1100px">
          <VStack spacing={10}>
            <VStack spacing={4} textAlign="center">
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
                  borderRadius="18px" p={{ base: 6, md: 8 }}
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

      <CTASection
        title={t("page_about_cta")}
        subtitle={t("page_about_cta_sub")}
        primary={{ label: t("minimal_cta_primary"), href: "/register" }}
        secondary={{ label: t("nav_contact"), href: "/contact" }}
      />

      <PublicFooter />
    </Box>
  );
}
