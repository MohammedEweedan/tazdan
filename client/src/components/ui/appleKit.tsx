"use client";

/* ─────────────────────────────────────────────────────────────────────────
   appleKit — the shared Apple-grade design system for every public page.

   The landing's language, factored into reusable parts so all pages feel like
   one premium product site: oversized tight-tracked headlines with an accent
   italic keyword, restrained copy, clean chevron CTAs, soft radial
   product glow, animated SVG "scene" graphics, glass bento cards that lift on
   hover, and slow cinematic fade-up motion (cubic-bezier 0.16,1,0.3,1).
   ───────────────────────────────────────────────────────────────────────── */

import NextLink from "next/link";
import { useTolgee } from "@tolgee/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Box, Container, Heading, Text, VStack, HStack, SimpleGrid, Flex, Button, Icon,
  useColorMode,
} from "@chakra-ui/react";
import {
  FiArrowRight, FiChevronRight, FiSend, FiShield, FiCreditCard, FiGlobe,
  FiMessageCircle, FiZap, FiRepeat, FiTrendingUp, FiCheck,
} from "react-icons/fi";
import { publicPageTheme } from "@/components/ui/publicPageTheme";
import ShaderLines from "@/components/ui/shader-lines";

const ACCENT = "#63a1db";
const ACCENT_HI = "#7DB4E4";
export const appleEase = [0.16, 1, 0.3, 1] as const;
const MBox = motion(Box as any);

export function useAppleLocale() {
  const tolgee = useTolgee(["language"]);
  const language =
    tolgee.getLanguage() ??
    (typeof document !== "undefined" ? document.documentElement.lang : "en");
  const isAr = language === "ar";

  return {
    language,
    isAr,
    headingLine: isAr ? 1.16 : undefined,
    heroLine: isAr ? { base: 1.16, md: 1.08 } : { base: 1.03, md: 0.98 },
    bodyLine: isAr ? 1.75 : 1.6,
    compactBodyLine: isAr ? 1.7 : 1.5,
  };
}

/* Accent italic keyword inside a headline — the manifesto treatment. */
export function Em({ children }: { children: React.ReactNode }) {
  const { colorMode } = useColorMode();
  const accent = colorMode === "dark" ? ACCENT_HI : ACCENT;
  return (
    <Box as="span" fontStyle="italic" fontWeight="500" color={accent}>
      {children}
    </Box>
  );
}

/* Slow fade-up reveal as a section scrolls into view. */
export function Reveal({
  children, delay = 0, y = 30, amount = 0.25,
}: { children: React.ReactNode; delay?: number; y?: number; amount?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.9, delay, ease: appleEase }}
    >
      {children}
    </motion.div>
  );
}

/* A soft blurred accent orb — decorative depth behind hero/section content. */
export function GlowOrb({
  color, top, left, right, bottom, size = "420px", opacity = 0.5,
}: {
  color?: string; top?: string; left?: string; right?: string; bottom?: string; size?: string; opacity?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <MBox
      aria-hidden
      position="absolute"
      top={top} left={left} right={right} bottom={bottom}
      w={size} h={size}
      pointerEvents="none"
      style={{
        background: `radial-gradient(circle, ${color ?? ACCENT}, transparent 68%)`,
        filter: "blur(70px)",
        opacity,
      }}
      animate={reduced ? undefined : { scale: [1, 1.12, 1], opacity: [opacity, opacity * 1.25, opacity] }}
      transition={reduced ? undefined : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function ShaderBackdrop({
  opacity,
  mode,
  mask = "linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)",
  saturate = 0.95,
  zIndex = 0,
}: {
  opacity?: number;
  mode?: "dark" | "light";
  mask?: string;
  saturate?: number;
  zIndex?: number;
}) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const resolvedMode = mode ?? (dark ? "dark" : "light");
  const resolvedOpacity = opacity ?? (dark ? 0.09 : 0.06);

  return (
    <Box
      aria-hidden
      position="absolute"
      inset={0}
      zIndex={zIndex}
      pointerEvents="none"
      opacity={resolvedOpacity}
      filter={`saturate(${saturate})`}
      sx={{
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      <ShaderLines mode={resolvedMode} />
    </Box>
  );
}

type CTA = { label: string; href?: string; onClick?: () => void };

/* Centered, cinematic page hero — restrained copy over a soft radial glow. */
export function PageHero({
  title, subtitle, primary, secondary, children, maxW = "1080px", size = "lg",
}: {
  eyebrow?: string; title: React.ReactNode; subtitle?: React.ReactNode;
  primary?: CTA; secondary?: CTA; children?: React.ReactNode; maxW?: string; size?: "lg" | "md";
}) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const reduced = useReducedMotion();
  const { textMain, textSub, accent, accentText } = publicPageTheme(dark);
  const { isAr, heroLine, bodyLine } = useAppleLocale();

  const headingSize =
    size === "lg"
      ? { base: "clamp(42px, 11.5vw, 62px)", md: "clamp(74px, 8.2vw, 116px)" }
      : { base: "clamp(36px, 10vw, 52px)", md: "clamp(56px, 6.6vw, 84px)" };

  return (
    <Box as="section" position="relative" overflow="hidden"
      pt={{ base: "140px", md: "210px" }} pb={{ base: 16, md: 26 }} textAlign="center">
      <Box position="absolute" inset={0} pointerEvents="none"
        bg={dark
          ? "radial-gradient(ellipse 72% 52% at 50% -6%, rgba(99,161,219,0.20), transparent 60%)"
          : "radial-gradient(ellipse 72% 52% at 50% -6%, rgba(99,161,219,0.15), transparent 62%)"} />
      <GlowOrb top="-120px" left="8%" size="380px" opacity={dark ? 0.18 : 0.1} />
      <GlowOrb top="0px" right="6%" size="340px" color={ACCENT_HI} opacity={dark ? 0.14 : 0.08} />
      <Container maxW={maxW} position="relative">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, ease: appleEase }}
        >
          <VStack spacing={{ base: 5, md: 7 }}>
            <Heading as="h1" fontWeight="700" fontSize={headingSize}
              lineHeight={heroLine} letterSpacing={isAr ? "0" : "-0.04em"} color={textMain}
              maxW="1000px" whiteSpace="pre-line">
              {title}
            </Heading>
            {subtitle && (
              <Text fontSize={{ base: "18px", md: "23px" }} fontWeight="400" color={textSub}
                maxW="660px" lineHeight={bodyLine}>
                {subtitle}
              </Text>
            )}
            {(primary || secondary) && (
              <HStack spacing={{ base: 5, md: 7 }} pt={{ base: 2, md: 3 }} flexWrap="wrap" justify="center">
                {primary && (
                  <Button
                    {...((primary.href ? { as: NextLink, href: primary.href } : { onClick: primary.onClick }) as any)}
                    h="50px" px={7} bg={accent} color="#ffffff" borderRadius="16px"
                    fontWeight="600" fontSize="15px" rightIcon={<Icon as={FiArrowRight} />}
                    boxShadow={dark ? "0 14px 40px rgba(99,161,219,0.28)" : "0 14px 34px rgba(79,139,196,0.22)"}
                    _hover={{ bg: "#5790c8", transform: "scale(1.02)" }}
                    _active={{ transform: "scale(0.99)" }}
                    transition="all 0.3s cubic-bezier(0.16,1,0.3,1)">
                    {primary.label}
                  </Button>
                )}
                {secondary && (
                  <Box
                    {...((secondary.href ? { as: NextLink, href: secondary.href } : { onClick: secondary.onClick }) as any)}
                    display="inline-flex" alignItems="center" gap="4px" color={accentText}
                    fontWeight="600" fontSize="15px" _hover={{ gap: "9px" }}
                    transition="gap 0.25s cubic-bezier(0.16,1,0.3,1)">
                    {secondary.label}
                    <Icon as={FiChevronRight} />
                  </Box>
                )}
              </HStack>
            )}
            {children}
          </VStack>
        </motion.div>
      </Container>
    </Box>
  );
}

/* Section band — vertical rhythm + optional tone (alt grey / cinematic ink). */
export function Band({
  children, tone = "default", maxW = "1180px", id, shader = false,
}: {
  children: React.ReactNode;
  tone?: "default" | "alt" | "ink";
  maxW?: string;
  id?: string;
  shader?: boolean | { opacity?: number; mask?: string; saturate?: number };
}) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const bg =
    tone === "ink" ? (dark ? "#0E1116" : "#0A0A0B")
    : tone === "alt" ? (dark ? "rgba(255,255,255,0.022)" : "#F8FAFC")
    : "transparent";
  return (
    <Box as="section" id={id} bg={bg} py={{ base: 20, md: 32 }} px={{ base: 4, md: 8 }} position="relative" overflow="hidden">
      {shader && (
        <ShaderBackdrop
          opacity={typeof shader === "object" ? shader.opacity : undefined}
          mask={typeof shader === "object" ? shader.mask : undefined}
          saturate={typeof shader === "object" ? shader.saturate : undefined}
        />
      )}
      <Container maxW={maxW} position="relative" zIndex={1}>{children}</Container>
    </Box>
  );
}

/* Section heading — oversized title (use <Em> for the accent word). */
export function SectionHeading({
  title, lede, align = "center", maxW = "760px",
}: { eyebrow?: string; title: React.ReactNode; lede?: React.ReactNode; align?: "center" | "start"; maxW?: string }) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const { textMain, textSub } = publicPageTheme(dark);
  const { isAr, headingLine, bodyLine } = useAppleLocale();
  return (
    <Reveal>
      <VStack spacing={4} align={align === "center" ? "center" : "start"}
        textAlign={align === "center" ? "center" : "start"}
        maxW={align === "center" ? maxW : undefined} mx={align === "center" ? "auto" : undefined}
        mb={{ base: 10, md: 16 }}>
        <Heading fontWeight="700" fontSize={{ base: "clamp(30px, 7.6vw, 40px)", md: "clamp(44px, 5vw, 72px)" }}
          letterSpacing={isAr ? "0" : "-0.035em"} lineHeight={headingLine ?? 1.03} color={textMain} whiteSpace="pre-line">
          {title}
        </Heading>
        {lede && (
          <Text fontSize={{ base: "16px", md: "20px" }} color={textSub} lineHeight={bodyLine} maxW="640px">
            {lede}
          </Text>
        )}
      </VStack>
    </Reveal>
  );
}

/* Big stat row, fade-up staggered. */
export function StatStrip({ stats }: { stats: { value: string; label: string }[] }) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const { textMain, textSub, cardBorder } = publicPageTheme(dark);
  const { isAr } = useAppleLocale();
  return (
    <SimpleGrid columns={{ base: 2, md: stats.length }} gap={{ base: 8, md: 0 }}>
      {stats.map((s, i) => (
        <Reveal key={s.label} delay={i * 0.07}>
          <VStack spacing={1} textAlign="center" px={6}
            borderRight={{ md: i < stats.length - 1 ? "1px solid" : "none" }} borderColor={cardBorder}>
            <Heading fontWeight="700" fontSize={{ base: "34px", md: "52px" }} letterSpacing="-0.04em"
              lineHeight={isAr ? 1.15 : 1} color={textMain}>
              {s.value}
            </Heading>
            <Text fontSize="12px" fontWeight="600" color={textSub}>
              {s.label}
            </Text>
          </VStack>
        </Reveal>
      ))}
    </SimpleGrid>
  );
}

/* Premium glass bento card — accent icon tile, lift + sheen on hover. */
export function BentoCard({
  icon, title, desc, delay = 0, align = "start", children,
}: {
  icon?: any; title: React.ReactNode; desc?: React.ReactNode; delay?: number;
  align?: "start" | "center"; children?: React.ReactNode;
}) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const { textMain, textSub, accent, cardBorder, strongBorder } = publicPageTheme(dark);
  const { isAr, compactBodyLine } = useAppleLocale();
  return (
    <Reveal delay={delay}>
      <Box h="100%" position="relative" overflow="hidden" borderRadius="28px"
        p={{ base: 6, md: 8 }}
        bg={dark ? "rgba(255,255,255,0.04)" : "rgba(10,15,30,0.022)"}
        border="1px solid" borderColor={cardBorder}
        transition="transform 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s, box-shadow 0.4s"
        _hover={{ transform: "translateY(-6px)", borderColor: strongBorder,
          boxShadow: dark ? "0 30px 70px rgba(0,0,0,0.4)" : "0 30px 60px rgba(10,15,30,0.12)" }}
        role="group">
        <Box position="absolute" top="-40%" right="-20%" w="60%" h="80%" pointerEvents="none"
          opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.5s"
          style={{ background: `radial-gradient(circle, ${accent}22, transparent 70%)`, filter: "blur(30px)" }} />
        <VStack align={align} textAlign={align} spacing={3} position="relative" h="100%">
          {icon && (
            <Flex w="52px" h="52px" borderRadius="16px" align="center" justify="center" mb={1}
              bg={dark ? "rgba(99,161,219,0.16)" : "rgba(79,139,196,0.12)"}
              border="1px solid" borderColor={dark ? "rgba(99,161,219,0.36)" : "rgba(79,139,196,0.30)"}
              transition="transform 0.4s cubic-bezier(0.16,1,0.3,1)" _groupHover={{ transform: "scale(1.08)" }}>
              <Icon as={icon} color={accent} boxSize={6} />
            </Flex>
          )}
          <Heading fontSize={{ base: "20px", md: "23px" }} fontWeight="700" letterSpacing={isAr ? "0" : "-0.02em"} color={textMain} lineHeight={isAr ? 1.22 : 1.15}>
            {title}
          </Heading>
          {desc && <Text fontSize={{ base: "14px", md: "15px" }} color={textSub} lineHeight={compactBodyLine}>{desc}</Text>}
          {children}
        </VStack>
      </Box>
    </Reveal>
  );
}

/* Alternating cinematic feature row: copy + checklist on one side, animated
   Graphic on the other, with a slow slide-in reveal. */
export function FeatureShowcase({
  title, accent: accentWord, desc, points, kind, flip = false,
}: {
  eyebrow?: string; title: string; accent?: string; desc: string;
  points?: { icon?: any; label: string }[]; kind: GraphicKind; flip?: boolean;
}) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const reduced = useReducedMotion();
  const { textMain, textSub, accent } = publicPageTheme(dark);
  const { isAr, headingLine, bodyLine } = useAppleLocale();
  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 10, lg: 20 }} alignItems="center"
      py={{ base: 14, md: 24 }}>
      <motion.div
        initial={reduced ? false : { opacity: 0, x: flip ? 40 : -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, ease: appleEase }}
        style={{ order: flip ? 2 : 1 }}>
        <VStack align={{ base: "center", lg: "start" }} textAlign={{ base: "center", lg: "start" }} spacing={6}>
          <Heading fontWeight="700" fontSize={{ base: "clamp(32px, 8vw, 40px)", md: "clamp(40px, 4.4vw, 60px)" }}
            letterSpacing={isAr ? "0" : "-0.035em"} lineHeight={headingLine ?? 1.04} color={textMain}>
            {title}{accentWord ? <> <Em>{accentWord}</Em></> : null}
          </Heading>
          <Text fontSize={{ base: "16px", md: "19px" }} color={textSub} lineHeight={bodyLine} maxW="480px">
            {desc}
          </Text>
          {points && (
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3} w="100%" maxW="480px" pt={1}>
              {points.map((p) => (
                <HStack key={p.label} spacing={3} align="center">
                  <Flex w="26px" h="26px" borderRadius="9px" align="center" justify="center" flexShrink={0}
                    bg={dark ? "rgba(99,161,219,0.16)" : "rgba(79,139,196,0.12)"}>
                    <Icon as={p.icon ?? FiCheck} color={accent} boxSize={3} />
                  </Flex>
                  <Text fontSize="14px" fontWeight="600" color={textMain}>{p.label}</Text>
                </HStack>
              ))}
            </SimpleGrid>
          )}
        </VStack>
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.94 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.0, ease: appleEase, delay: 0.05 }}
        style={{ order: flip ? 1 : 2 }}>
        <Graphic kind={kind} dark={dark} />
      </motion.div>
    </SimpleGrid>
  );
}

/* Cinematic closing CTA — ink panel, accent glow, chevron action. */
export function CTASection({
  title, subtitle, primary, secondary,
}: { title: React.ReactNode; subtitle?: React.ReactNode; primary?: CTA; secondary?: CTA }) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const { isAr, headingLine, bodyLine } = useAppleLocale();
  return (
    <Box py={{ base: 16, md: 28 }} px={{ base: 4, md: 8 }}>
      <Container maxW="1180px">
        <Reveal>
          <Box position="relative" overflow="hidden" borderRadius={{ base: "28px", md: "40px" }}
            bg={dark ? "#0E1116" : "#0A0A0B"} border="1px solid"
            borderColor={dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,11,0.12)"}
            p={{ base: 12, md: 24 }} textAlign="center"
            boxShadow={dark ? "0 40px 100px rgba(0,0,0,0.5)" : "0 40px 90px rgba(10,15,30,0.25)"}>
            <Box position="absolute" inset={0} pointerEvents="none"
              bg="radial-gradient(ellipse 60% 70% at 50% 0%, rgba(99,161,219,0.30), transparent 60%)" />
            <GlowOrb bottom="-160px" left="20%" size="420px" opacity={0.4} />
            <VStack spacing={6} position="relative">
              <Heading fontWeight="700" fontSize={{ base: "clamp(30px, 8vw, 40px)", md: "clamp(48px, 5.4vw, 78px)" }}
                letterSpacing={isAr ? "0" : "-0.04em"} lineHeight={headingLine ?? 1.02} color="#ffffff" maxW="760px">
                {title}
              </Heading>
              {subtitle && (
                <Text fontSize={{ base: "16px", md: "20px" }} color="rgba(255,255,255,0.72)" maxW="520px" lineHeight={bodyLine}>
                  {subtitle}
                </Text>
              )}
              {(primary || secondary) && (
                <HStack spacing={6} pt={2} flexWrap="wrap" justify="center">
                  {primary && (
                    <Button
                      {...((primary.href ? { as: NextLink, href: primary.href } : { onClick: primary.onClick }) as any)}
                      h="52px" px={8} bg="#ffffff" color="#0A0A0B" borderRadius="16px"
                      fontWeight="600" fontSize="15px" rightIcon={<Icon as={FiArrowRight} />}
                      _hover={{ transform: "scale(1.03)" }} _active={{ transform: "scale(0.99)" }}
                      transition="all 0.3s cubic-bezier(0.16,1,0.3,1)">
                      {primary.label}
                    </Button>
                  )}
                  {secondary && (
                    <Box
                      {...((secondary.href ? { as: NextLink, href: secondary.href } : { onClick: secondary.onClick }) as any)}
                      display="inline-flex" alignItems="center" gap="4px" color="rgba(255,255,255,0.85)"
                      fontWeight="600" fontSize="15px" _hover={{ gap: "9px", color: "#fff" }}
                      transition="all 0.25s cubic-bezier(0.16,1,0.3,1)">
                      {secondary.label}
                      <Icon as={FiChevronRight} />
                    </Box>
                  )}
                </HStack>
              )}
            </VStack>
          </Box>
          </Reveal>
        </Container>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GRAPHIC — animated SVG "scenes" inside a glowing glass panel.
   ═══════════════════════════════════════════════════════════════════════════ */

export type GraphicKind =
  | "transfer" | "card" | "shield" | "chart" | "chat" | "globe" | "spark" | "swap";

const KIND_ICON: Record<GraphicKind, any> = {
  transfer: FiSend, card: FiCreditCard, shield: FiShield, chart: FiTrendingUp,
  chat: FiMessageCircle, globe: FiGlobe, spark: FiZap, swap: FiRepeat,
};

export function Graphic({ kind, dark }: { kind: GraphicKind; dark: boolean }) {
  const reduced = useReducedMotion();
  const line = dark ? "rgba(255,255,255,0.22)" : "rgba(10,15,30,0.18)";
  const faint = dark ? "rgba(255,255,255,0.06)" : "rgba(10,15,30,0.05)";
  const fg = dark ? "#F4F5F7" : "#0A0A0B";

  const scene = (() => {
    switch (kind) {
      case "transfer":
        return (
          <svg viewBox="0 0 420 220" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <path d="M40 160 C 150 40, 270 40, 380 150" fill="none" stroke={line} strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
            <circle cx="40" cy="160" r="9" fill={ACCENT} />
            <circle cx="380" cy="150" r="9" fill={dark ? "#3FCF8E" : "#1F8F58"} />
            {!reduced && (
              <motion.circle r="7" fill={ACCENT}
                animate={{ cx: [40, 380], cy: [160, 150], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
            )}
          </svg>
        );
      case "swap":
        return (
          <svg viewBox="0 0 320 200" width="80%" height="80%">
            <motion.g animate={reduced ? undefined : { rotate: [0, 180, 360] }}
              transition={reduced ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "160px 100px" }}>
              <path d="M110 70 H210 M210 70 l-18 -14 M210 70 l-18 14" stroke={ACCENT} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M210 130 H110 M110 130 l18 -14 M110 130 l18 14" stroke={dark ? "#3FCF8E" : "#1F8F58"} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </motion.g>
          </svg>
        );
      case "card":
        return (
          <motion.div
            animate={reduced ? undefined : { rotateY: [-12, 12, -12], rotateX: [6, -4, 6] }}
            transition={reduced ? undefined : { duration: 7, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: "78%", maxWidth: 300, transformStyle: "preserve-3d", perspective: 900 }}>
            <Box borderRadius="20px" p={6} h="180px" color="#fff" position="relative" overflow="hidden"
              style={{ background: "linear-gradient(135deg, #2b6cb0 0%, #143257 100%)", boxShadow: "0 30px 60px rgba(0,0,0,0.4)" }}>
              <Flex justify="space-between" align="center">
                <Text fontWeight="700" letterSpacing="0.04em">tazdan</Text>
                <Icon as={FiCreditCard} boxSize={5} opacity={0.9} />
              </Flex>
              <Text position="absolute" bottom="46px" left="24px" fontFamily="'JetBrains Mono', monospace" fontSize="17px" letterSpacing="0.14em">•••• 8240</Text>
              <Text position="absolute" bottom="22px" left="24px" fontSize="11px" opacity={0.7} letterSpacing="0.06em">VIRTUAL · VISA</Text>
              {!reduced && (
                <motion.div animate={{ x: ["-120%", "220%"] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{ position: "absolute", top: 0, bottom: 0, width: "40%", background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.35), transparent)" }} />
              )}
            </Box>
          </motion.div>
        );
      case "shield":
        return (
          <svg viewBox="0 0 220 220" width="70%" height="70%">
            {[70, 92].map((r, i) => (
              <motion.circle key={r} cx="110" cy="110" r={r} fill="none" stroke={ACCENT} strokeWidth="1.4"
                animate={reduced ? undefined : { opacity: [0.1, 0.5, 0.1], scale: [0.96, 1.04, 0.96] }}
                transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
                style={{ transformOrigin: "110px 110px" }} />
            ))}
            <path d="M110 58 l38 16 v30 c0 26 -16 46 -38 56 c-22 -10 -38 -30 -38 -56 v-30 z"
              fill={faint} stroke={ACCENT} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M96 112 l10 10 l20 -22" fill="none" stroke={dark ? "#3FCF8E" : "#1F8F58"} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "chart":
        return (
          <svg viewBox="0 0 360 200" width="86%" height="80%">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const h = [60, 100, 78, 130, 110, 160][i];
              return (
                <motion.rect key={i} x={26 + i * 56} width="30" rx="7" fill={i === 5 ? ACCENT : faint}
                  initial={reduced ? false : { height: 0, y: 180 }}
                  whileInView={{ height: h, y: 180 - h }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: i * 0.08, ease: appleEase }} />
              );
            })}
            <line x1="20" y1="182" x2="346" y2="182" stroke={line} strokeWidth="1.5" />
          </svg>
        );
      case "chat":
        return (
          <VStack spacing={3} w="80%" align="stretch">
            {[{ me: false, w: "70%" }, { me: true, w: "55%" }, { me: false, w: "62%" }].map((b, i) => (
              <motion.div key={i}
                initial={reduced ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.25, ease: appleEase }}
                style={{ alignSelf: b.me ? "flex-end" : "flex-start", width: b.w }}>
                <Box borderRadius="18px" px={4} py={3}
                  bg={b.me ? ACCENT : (dark ? "rgba(255,255,255,0.08)" : "rgba(10,15,30,0.06)")}>
                  <Box h="7px" borderRadius="4px" mb={2} w="80%" bg={b.me ? "rgba(255,255,255,0.7)" : line} />
                  <Box h="7px" borderRadius="4px" w="55%" bg={b.me ? "rgba(255,255,255,0.5)" : faint} />
                </Box>
              </motion.div>
            ))}
          </VStack>
        );
      case "globe":
        return (
          <svg viewBox="0 0 220 220" width="74%" height="74%">
            <circle cx="110" cy="110" r="82" fill="none" stroke={line} strokeWidth="1.4" />
            <ellipse cx="110" cy="110" rx="82" ry="32" fill="none" stroke={faint} strokeWidth="1.4" />
            <ellipse cx="110" cy="110" rx="40" ry="82" fill="none" stroke={faint} strokeWidth="1.4" />
            <line x1="28" y1="110" x2="192" y2="110" stroke={faint} strokeWidth="1.4" />
            {!reduced && (
              <motion.g animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "110px 110px" }}>
                <circle cx="192" cy="110" r="6" fill={ACCENT} />
              </motion.g>
            )}
            <circle cx="110" cy="28" r="5" fill={dark ? "#3FCF8E" : "#1F8F58"} />
          </svg>
        );
      case "spark":
      default:
        return (
          <svg viewBox="0 0 200 200" width="58%" height="58%">
            <motion.path d="M112 30 L74 112 H104 L88 170 L140 84 H108 Z"
              fill={ACCENT}
              animate={reduced ? undefined : { opacity: [0.7, 1, 0.7], scale: [0.96, 1.05, 0.96] }}
              transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "100px 100px" }} />
          </svg>
        );
    }
  })();

  return (
    <Box position="relative" w="100%" h={{ base: "260px", md: "400px" }} borderRadius="32px" overflow="hidden"
      bg={dark
        ? "linear-gradient(155deg, rgba(99,161,219,0.12), rgba(255,255,255,0.02) 60%)"
        : "linear-gradient(155deg, rgba(99,161,219,0.12), rgba(10,15,30,0.015) 60%)"}
      border="1px solid" borderColor={dark ? "rgba(255,255,255,0.09)" : "rgba(10,15,30,0.08)"}>
      <Box position="absolute" top="-30%" left="50%" w="80%" h="70%" pointerEvents="none"
        style={{ transform: "translateX(-50%)", background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, filter: "blur(40px)" }} />
      <Box position="absolute" top={4} left={5}>
        <Icon as={KIND_ICON[kind]} color={dark ? "rgba(255,255,255,0.35)" : "rgba(10,15,30,0.30)"} boxSize={5} />
      </Box>
      <Flex position="absolute" inset={0} align="center" justify="center" p={{ base: 6, md: 10 }}>
        {scene}
      </Flex>
    </Box>
  );
}
