"use client";

/* ─────────────────────────────────────────────────────────────────────────
   tazdan — Apple-grade landing sections.

   Three exported pieces, composed in app/page.tsx:
     • VideoHero            — full-bleed looping video with a text overlay.
     • ScrollytellingManifesto — a scroll-pinned stage where three lines of
                              copy crossfade through the centre; the final line
                              HOLDS (sticks) as the last slide before you scroll
                              on. Framed by four small corner accents that never
                              cross the text.
     • AppleBento           — a restrained, asymmetric bento of outline cards.

   Everything outside the video hero shares one flat background (the page's).
   Every string goes through Tolgee `t(key, default)`. Motion is gated behind
   useReducedMotion(); palette is the house accent (#63a1db) on DM Sans. No
   links to register/login anywhere — this is brand-led, not conversion-led.
   ───────────────────────────────────────────────────────────────────────── */

import { useRef, useEffect } from "react";
import {
  motion,
  useTransform,
  useSpring,
  useReducedMotion,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import { Box, Container, Heading, Text, VStack, HStack, Flex, Icon, useColorMode } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiSend, FiLink, FiShield, FiCreditCard, FiChevronDown } from "react-icons/fi";
import { useIsAr } from "@/hooks/useIsAr";

const ACCENT = "#63a1db";
const ACCENT_HI = "#7DB4E4"; // lifted accent for dark surfaces
const EASE = [0.22, 1, 0.36, 1] as const;

/* Live scroll progress for an element. While the element is in (or near) the
   viewport an IntersectionObserver runs a requestAnimationFrame loop that
   re-reads getBoundingClientRect every frame and writes 0→1 progress. This is
   immune to the two things that break framer's useScroll({ target }): a stale
   cached offset when sections above grow as their media loads, and a frozen
   reading when the section is reached before hydration finishes (no scroll
   event ever arrives). The loop only runs on-screen, so it costs nothing
   otherwise. pin → 0 when the element top hits the viewport top, 1 when its
   bottom hits the viewport bottom. */
function useScrollProgress(ref: React.RefObject<HTMLElement>): MotionValue<number> {
  const mv = useMotionValue(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let running = false;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const measure = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      mv.set(clamp(r.height - vh > 0 ? -r.top / (r.height - vh) : 0));
    };
    const loop = () => {
      measure();
      if (running) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          loop();
        } else if (!entry.isIntersecting) {
          running = false;
          cancelAnimationFrame(raf);
          measure(); // settle to a clamped 0 / 1 once fully off-screen
        }
      },
      { rootMargin: "120px 0px 120px 0px" },
    );
    io.observe(el);
    measure(); // correct on first paint, before the observer first fires
    return () => {
      io.disconnect();
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [ref, mv]);
  return mv;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIDEO HERO
   ═══════════════════════════════════════════════════════════════════════════ */

export function VideoHero({
  eyebrow,
  title,
  subtitle,
  children,
  h = "100vh",
  minH = "640px",
  showCue = true,
  nowrap = false,
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
  h?: string;
  minH?: string;
  showCue?: boolean;
  nowrap?: boolean;
} = {}) {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const reduced = !!useReducedMotion();
  useIsAr();

  const isDefault = title == null;
  const wrap = nowrap || isDefault; // landing title is a fixed single line
  const titleNode = title ?? (
    <>
      {t("tz_hero_title_1", "Money")}{" "}
      <Box as="span" color="#63a1db" fontStyle="italic">{t("tz_hero_title_2", "without")}</Box>{" "}
      {t("tz_hero_title_3", "borders.")}
    </>
  );

  return (
    <Box as="section" position="relative" h={h} minH={minH} overflow="hidden" bg="#05070a">
      {/* full-bleed looping video */}
      <Box
        as="video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        position="absolute"
        inset={0}
        w="100%"
        h="100%"
        sx={{ objectFit: "cover" }}
      >
        <source src="/videos/WebHeader.mp4" type="video/mp4" />
      </Box>

      {/* legibility scrim — strong enough to hold white text over the video's
          bright sky: a vertical wash plus a soft centre vignette behind copy */}
      <Box position="absolute" inset={0} bg="linear-gradient(180deg, rgba(5,7,10,0.56) 0%, rgba(5,7,10,0.45) 48%, rgba(5,7,10,0.64) 100%)" />
      <Box position="absolute" inset={0} bg="radial-gradient(ellipse 85% 60% at 50% 48%, rgba(5,7,10,0.55) 0%, transparent 72%)" />

      {/* text overlay */}
      <Flex position="absolute" inset={0} direction="column" align="center" justify="center" textAlign="center" px={6}>

        {/* opacity stays 1 (visible without/ before JS — this is the hero/LCP);
            only a subtle rise animates in. */}
        <motion.div
          initial={reduced ? false : { y: 26, opacity: isDefault ? 1 : 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.0, delay: 0.15, ease: EASE }}
        >
         <VStack spacing={{ base: 4, md: 5 }}>
          {eyebrow && (
            <Text fontSize={{ base: "11px", md: "12px" }} fontWeight="800" letterSpacing="0.22em" textTransform="uppercase" color="#7DB4E4">
              {eyebrow}
            </Text>
          )}
          <Heading
            fontWeight="700"
            fontSize={wrap
              ? { base: "clamp(28px, 8.6vw, 42px)", sm: "clamp(34px, 8vw, 52px)", md: "clamp(72px, 7.4vw, 104px)" }
              : { base: "clamp(34px, 9vw, 46px)", md: "clamp(52px, 6.6vw, 82px)" }}
            letterSpacing={{ base: "-0.055em", md: "-0.05em" }}
            lineHeight={wrap ? 0.98 : 1.02}
            color="#ffffff"
            maxW={wrap ? "calc(100vw - 24px)" : "900px"}
            whiteSpace={wrap ? "nowrap" : "normal"}
            sx={wrap ? { textWrap: "nowrap" } : undefined}
          >
            {titleNode}
          </Heading>
          {subtitle && (
            <Text fontSize={{ base: "15px", md: "19px" }} color="rgba(255,255,255,0.82)" maxW="600px" lineHeight="1.6">
              {subtitle}
            </Text>
          )}
          {children}
         </VStack>
        </motion.div>
      </Flex>

      {/* scroll cue */}
      {showCue && (
      <motion.div
        style={{ position: "absolute", bottom: "4vh", left: 0, right: 0, display: "flex", justifyContent: "center" }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.8 }}
      >
        <motion.div animate={reduced ? undefined : { y: [0, 8, 0] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}>
          <Icon as={FiChevronDown} color="rgba(255,255,255,0.6)" boxSize={6} />
        </motion.div>
      </motion.div>
      )}

      {/* fade the video into the page background below */}
      <Box position="absolute" bottom={0} left={0} right={0} h="11vh" bgGradient={`linear(to-t, ${dark ? "#16181C" : "#ffffff"}, transparent)`} pointerEvents="none" />
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANIFESTO — pinned crossfade, last line holds
   ═══════════════════════════════════════════════════════════════════════════ */

function CornerAccent({
  corner,
  progress,
  reduced,
  delay,
  floatY,
  children,
}: {
  corner: "tl" | "tr" | "bl" | "br";
  progress: MotionValue<number>;
  reduced: boolean;
  delay: number;
  floatY: number;
  children: React.ReactNode;
}) {
  const sx = corner === "tl" || corner === "bl" ? -1 : 1;
  const sy = corner === "tl" || corner === "tr" ? -1 : 1;
  const x = useTransform(progress, [0, 1], [0, sx * 16]);
  const y = useTransform(progress, [0, 1], [0, sy * 16]);
  const pos =
    corner === "tl" ? { top: 0, left: 0 }
    : corner === "tr" ? { top: 0, right: 0 }
    : corner === "bl" ? { bottom: 0, left: 0 }
    : { bottom: 0, right: 0 };

  return (
    <Box position="absolute" {...pos} m={{ base: "13vh 5vw", md: "15vh 6vw" }} pointerEvents="none" aria-hidden>
      <motion.div style={reduced ? undefined : { x, y }}>
        <motion.div initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay, ease: EASE }}>
          <motion.div animate={reduced ? undefined : { y: [0, floatY, 0] }} transition={reduced ? undefined : { duration: 5 + delay * 2, repeat: Infinity, ease: "easeInOut" }}>
            {children}
          </motion.div>
        </motion.div>
      </motion.div>
    </Box>
  );
}

function GlyphRing({ c, reduced }: { c: string; reduced: boolean }) {
  return (
    <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="34" stroke={c} strokeWidth="1.6" opacity="0.45" />
      <motion.circle cx="50" cy="50" r="4" fill={c} animate={reduced ? undefined : { scale: [1, 1.7, 1], opacity: [1, 0.35, 1] }} transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "50px 50px" }} />
    </svg>
  );
}
function GlyphSpark({ c }: { c: string }) {
  return (
    <svg width="64" height="48" viewBox="0 0 100 70" fill="none">
      <polyline points="6,56 28,40 44,48 64,22 86,30" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <motion.circle cx="86" cy="30" r="3.4" fill={c} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
    </svg>
  );
}
function GlyphChip({ c }: { c: string }) {
  return (
    <svg width="56" height="44" viewBox="0 0 90 70" fill="none">
      <rect x="6" y="8" width="78" height="54" rx="10" stroke={c} strokeWidth="1.6" opacity="0.45" />
      <line x1="20" y1="28" x2="48" y2="28" stroke={c} strokeWidth="1.6" opacity="0.5" />
      <line x1="20" y1="40" x2="40" y2="40" stroke={c} strokeWidth="1.6" opacity="0.35" />
    </svg>
  );
}
function GlyphArc({ c, reduced }: { c: string; reduced: boolean }) {
  return (
    <svg width="62" height="50" viewBox="0 0 100 80" fill="none">
      <path d="M10 64 C 30 18, 70 18, 90 56" stroke={c} strokeWidth="1.6" strokeDasharray="2 7" strokeLinecap="round" opacity="0.5" />
      <circle cx="10" cy="64" r="3.2" fill={c} opacity="0.7" />
      <motion.circle cx="90" cy="56" r="3.6" fill={c} animate={reduced ? undefined : { cx: [10, 90], cy: [64, 56], opacity: [0, 1, 0] }} transition={reduced ? undefined : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }} />
    </svg>
  );
}

/* one crossfading line. `hold` keeps the final line on screen (fades in, then
   sticks at full opacity through the end of the track). */
function HeroLine({
  progress,
  range,
  reduced,
  hold = false,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  reduced: boolean;
  hold?: boolean;
  children: React.ReactNode;
}) {
  const [a, b] = range;
  const mid = (a + b) / 2;
  const inEnd = a + 0.14;
  // hold: ramp in over [a, inEnd] and clamp at 1 for the rest of the track
  const opacity = useTransform(
    progress,
    hold ? [a, inEnd] : [a, a + (mid - a) * 0.5, b - (b - mid) * 0.5, b],
    hold ? [0, 1] : [0, 1, 1, 0],
  );
  const y = useTransform(progress, hold ? [a, inEnd] : [a, mid, b], hold ? [44, 0] : [40, 0, -40]);
  const blurPx = useTransform(progress, hold ? [a, inEnd] : [a, mid - 0.04, mid + 0.04, b], hold ? [10, 0] : [9, 0, 0, 9]);
  const filter = useTransform(blurPx, (v) => `blur(${v}px)`);
  return (
    <motion.div
      style={reduced ? { position: "absolute", inset: 0 } : { position: "absolute", inset: 0, opacity, y, filter, willChange: "transform, opacity" }}
    >
      <Flex h="100%" w="100%" align="center" justify="center" px={6} textAlign="center">
        {children}
      </Flex>
    </motion.div>
  );
}

export function ScrollytellingManifesto() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const pageBg = dark ? "#16181C" : "#ffffff";
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();
  const raw = useScrollProgress(trackRef);
  const p = useSpring(raw, { stiffness: 90, damping: 28, mass: 0.4 });
  useIsAr();

  const fg = dark ? "#ffffff" : "#0a0f1e";
  const accent = dark ? ACCENT_HI : ACCENT;
  const headline = {
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
    letterSpacing: "-0.05em",
    lineHeight: 1.02,
    color: fg,
    maxW: "920px",
    fontSize: { base: "44px", md: "96px" },
  } as const;

  return (
    <Box ref={trackRef} position="relative" h={{ base: "320vh", md: "360vh" }} bg={pageBg}>
      <Box position="sticky" top={0} h="100vh" overflow="hidden" bg={pageBg}>
        <Box
          position="absolute"
          inset={0}
          bg={dark
            ? "radial-gradient(circle at 50% 45%, rgba(99,161,219,0.08), transparent 48%)"
            : "radial-gradient(circle at 50% 45%, rgba(99,161,219,0.10), transparent 50%)"}
          pointerEvents="none"
        />

        <Box position="absolute" inset={0} zIndex={2}>
          <HeroLine progress={p} range={[0.0, 0.4]} reduced={reduced}>
            <Heading {...headline}>{t("tz_manifesto_1", "Money, the way it should move.")}</Heading>
          </HeroLine>
          <HeroLine progress={p} range={[0.34, 0.72]} reduced={reduced}>
            <Heading {...headline}>
              {t("tz_manifesto_2a", "Crypto,")}{" "}
              <Box as="span" color={accent} fontStyle="italic" fontWeight="500">{t("tz_manifesto_2b", "made for everyone.")}</Box>
            </Heading>
          </HeroLine>
          <HeroLine progress={p} range={[0.66, 1.0]} reduced={reduced} hold>
            <Heading {...headline}>{t("tz_manifesto_3", "This is tazdan.")}</Heading>
          </HeroLine>
        </Box>
      </Box>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BENTO
   ═══════════════════════════════════════════════════════════════════════════ */

function BentoTile({ children, area, dark, delay = 0 }: { children: React.ReactNode; area: string; dark: boolean; delay?: number }) {
  return (
    <motion.div
      style={{ gridArea: area, willChange: "transform, opacity" }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      <Box
        h="100%"
        minH={{ base: "150px", md: "auto" }}
        p={{ base: 6, md: 8 }}
        borderRadius="24px"
        position="relative"
        overflow="hidden"
        bg={dark ? "rgba(255,255,255,0.035)" : "rgba(10,15,30,0.025)"}
        border="1px solid"
        borderColor={dark ? "rgba(255,255,255,0.09)" : "rgba(10,15,30,0.09)"}
        transition="border-color 0.35s ease, transform 0.35s ease"
        _hover={{ borderColor: dark ? "rgba(255,255,255,0.2)" : "rgba(10,15,30,0.2)", transform: "translateY(-3px)" }}
      >
        {children}
      </Box>
    </motion.div>
  );
}

function TiltCard({ label }: { label: string }) {
  const reduced = !!useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 18 });
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 14);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 14);
  }
  return (
    <Box onMouseMove={onMove} onMouseLeave={() => { rx.set(0); ry.set(0); }} style={{ perspective: 800 }}>
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>
        <Flex direction="column" justify="space-between" h="180px" borderRadius="18px" p={5} color="white" style={{ background: "linear-gradient(135deg, #2b6cb0 0%, #143257 100%)", transform: "translateZ(36px)" }}>
          <HStack justify="space-between">
            <Text fontWeight="700" letterSpacing="0.03em">tazdan</Text>
            <Icon as={FiCreditCard} boxSize={5} opacity={0.9} />
          </HStack>
          <Box>
            <Text fontFamily="'JetBrains Mono', monospace" fontSize="16px" letterSpacing="0.14em" opacity={0.95}>••••&nbsp;&nbsp;8240</Text>
            <Text fontSize="11px" opacity={0.7} mt={2} letterSpacing="0.06em">{label}</Text>
          </Box>
        </Flex>
      </motion.div>
    </Box>
  );
}

function RouteLine({ dark }: { dark: boolean }) {
  const line = dark ? "rgba(255,255,255,0.16)" : "rgba(10,15,30,0.14)";
  const reduced = !!useReducedMotion();
  return (
    <svg viewBox="0 0 420 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <path d="M24 92 C 150 18, 270 18, 396 88" fill="none" stroke={line} strokeWidth="1.6" />
      <circle cx="24" cy="92" r="5" fill={ACCENT} />
      <circle cx="396" cy="88" r="5" fill={dark ? "#4ade80" : "#16a34a"} />
      <motion.circle cx="24" cy="92" r="4" fill={ACCENT} animate={reduced ? undefined : { cx: [24, 396], cy: [92, 88] }} transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }} />
    </svg>
  );
}

export function AppleBento() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const pageBg = dark ? "#16181C" : "#ffffff";
  const fg = dark ? "#ffffff" : "#0a0f1e";
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgba(10,15,30,0.55)";
  const accent = dark ? ACCENT_HI : ACCENT;
  useIsAr();

  return (
    <Box as="section" py={{ base: 20, md: 32 }} px={{ base: 4, md: 8 }} bg={pageBg}>
      <Container maxW="1180px">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.6, ease: EASE }}>
          <Heading fontFamily="'DM Sans', sans-serif" fontWeight="700" fontSize={{ base: "30px", md: "52px" }} letterSpacing="-0.04em" lineHeight={1.06} color={fg} maxW="660px" mb={{ base: 10, md: 16 }}>
            {t("tz_bento_title_a", "A new home for the")}{" "}
            <Box as="span" color={accent}>{t("tz_bento_title_b", "world's money.")}</Box>
          </Heading>
        </motion.div>

        <Box
          display="grid"
          gap={{ base: 3, md: 4 }}
          gridTemplateColumns={{ base: "1fr", md: "repeat(6, 1fr)" }}
          gridAutoRows={{ md: "minmax(150px, auto)" }}
          gridTemplateAreas={{
            base: `"hero" "card" "link" "secure"`,
            md: `
              "hero hero hero hero card card"
              "hero hero hero hero card card"
              "link link link secure secure secure"
            `,
          }}
        >
          <BentoTile area="hero" dark={dark} delay={0}>
            <Flex direction="column" h="100%" justify="space-between" gap={6}>
              <Box>
                <Icon as={FiSend} boxSize={6} color={accent} mb={5} />
                <Heading fontSize={{ base: "24px", md: "32px" }} fontWeight="700" letterSpacing="-0.03em" color={fg} lineHeight={1.12}>
                  {t("tz_bento_send_title", "Send value anywhere. Instantly.")}
                </Heading>
                <Text mt={3} fontSize={{ base: "14px", md: "15px" }} color={muted} maxW="440px" lineHeight={1.6}>
                  {t("tz_bento_send_desc", "Across any border, any currency, any chain — settled before you lock your phone.")}
                </Text>
              </Box>
              <Box h={{ base: "90px", md: "120px" }} opacity={0.95}>
                <RouteLine dark={dark} />
              </Box>
            </Flex>
          </BentoTile>

          <BentoTile area="card" dark={dark} delay={0.08}>
            <Flex direction="column" h="100%" justify="space-between" gap={5}>
              <Box>
                <Text fontSize="11px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color={muted}>{t("tz_bento_card_eyebrow", "Virtual card")}</Text>
                <Heading fontSize={{ base: "20px", md: "22px" }} fontWeight="700" letterSpacing="-0.02em" color={fg} mt={1}>{t("tz_bento_card_title", "Spend it like cash.")}</Heading>
              </Box>
              <TiltCard label={t("tz_bento_card_meta", "VIRTUAL · VISA")} />
            </Flex>
          </BentoTile>

          <BentoTile area="link" dark={dark} delay={0.14}>
            <VStack align="start" spacing={3} h="100%" justify="center">
              <Icon as={FiLink} boxSize={6} color={accent} />
              <Heading fontSize={{ base: "20px", md: "22px" }} fontWeight="700" letterSpacing="-0.02em" color={fg}>{t("tz_bento_link_title", "Send with a link.")}</Heading>
              <Text fontSize="14px" color={muted} lineHeight={1.6}>{t("tz_bento_link_desc", "No wallet address, no account number. Just a link they tap to claim.")}</Text>
            </VStack>
          </BentoTile>

          <BentoTile area="secure" dark={dark} delay={0.2}>
            <VStack align="start" spacing={3} h="100%" justify="center">
              <Icon as={FiShield} boxSize={6} color={accent} />
              <Heading fontSize={{ base: "20px", md: "22px" }} fontWeight="700" letterSpacing="-0.02em" color={fg}>{t("tz_bento_secure_title", "Built to be trusted.")}</Heading>
              <Text fontSize="14px" color={muted} lineHeight={1.6}>{t("tz_bento_secure_desc", "Encryption, device binding and step-up checks on every move you make.")}</Text>
            </VStack>
          </BentoTile>
        </Box>
      </Container>
    </Box>
  );
}
