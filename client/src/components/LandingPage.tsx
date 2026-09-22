"use client";

import { useRef, useEffect, useState, memo, useMemo, useCallback } from "react";
import { useTranslate } from "@tolgee/react";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import NextImage from "next/image";
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Icon,
  SimpleGrid,
  useColorMode,
  useDisclosure,
  useBreakpointValue,
} from "@chakra-ui/react";
import {
  FiArrowRight, FiZap, FiGlobe, FiShield, FiCheck,
  FiBarChart2, FiActivity, FiLock,
  FiSend, FiWifi, FiRepeat, FiCreditCard,
  FiStar, FiBell, FiDollarSign, FiMessageCircle, FiUser,
  FiChevronLeft, FiChevronRight, FiMoreHorizontal, FiSmile, FiArrowUp,
  FiEye, FiSearch, FiChevronDown, FiChevronUp, FiMaximize2, FiClock,
  FiLink, FiTrendingUp, FiTrendingDown, FiDownload, FiCamera,
} from "react-icons/fi";
import { FaApplePay, FaGooglePay, FaCcVisa, FaCcMastercard } from "react-icons/fa";
import { SiRevolut } from "react-icons/si";
import {
  motion, useTransform, useMotionValue, useScroll, useSpring,
  MotionValue, AnimatePresence, useAnimationControls,
  useReducedMotion, useMotionValueEvent,
} from "framer-motion";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import WaitlistModal from "@/components/ui/WaitlistModal";
import { VideoHero, ScrollytellingManifesto, AppleBento } from "@/components/ui/AppleShowcase";
import { useChime, SoundToggle, ReceiptOverlay, FeeLedger, TrioSibling } from "@/components/ui/AppleFilm";
import { useIsAr } from "@/hooks/useIsAr";

/* ─────────────────────────────────────────────────────────────────
   RESPONSIVE PHONE SIZING SYSTEM
   ─────────────────────────────────────────────────────────────────
   --ph  = phone height  (clamp-driven, fluid)
   --pw  = phone width   (derived from 9:19.5 aspect ratio)
   --pi  = screen inset  (bezel thickness — matches iphone-frame.png)
   --pr  = screen border-radius

   ALL child elements use calc(var(--ph) * N) for sizes so they
   scale proportionally on every viewport.
   ───────────────────────────────────────────────────────────────── */

/* ── Film phone sizing ───────────────────────────────────────────────────
   `--ph` drives the whole device (width is --ph * 0.47), so it is the single
   knob for how large the phone reads in each film chapter.

   Desktop wants a BIG phone: the sticky stage is a full 100vh and the old
   48vh device left most of it empty. Mobile is the opposite problem — the
   phone shares that same 100vh with the chapter's copy, so it has to stay
   small enough that both fit without the stage overflowing.

   STACKED is shorter because FilmReceipt puts copy ABOVE the phone below
   `lg`; TRIO is shorter again because three phones sit side by side, where
   width runs out before height does. */
const FILM_PH         = { base: "clamp(300px, 54vh, 520px)", md: "clamp(460px, 68vh, 880px)" };
const FILM_PH_STACKED = { base: "clamp(260px, 44vh, 430px)", lg: "clamp(460px, 70vh, 900px)" };
const FILM_PH_TRIO    = { base: "clamp(180px, 32vh, 300px)", md: "clamp(340px, 58vh, 700px)" };
/** Hero device height in the journey. Used by the phone AND by the centre
 *  trio label, which offsets itself from it — keep them one value. */
const JOURNEY_PH = "clamp(300px, 58vh, 820px)";

const phoneVars: React.CSSProperties = {
  ["--ph" as string]: "clamp(380px, 48vh, 720px)",
  ["--pw" as string]: "calc(var(--ph) * 0.47)",
  ["--pi" as string]: "calc(var(--ph) * 0.018)",   // now only left/right reference this
  ["--pr" as string]: "calc(var(--ph) * 0.048)",   // inner screen corner radius
};

const screenInset = {
  top:    "calc(var(--ph) * 0.028)",   // thick — covers Dynamic Island + status bar area
  bottom: "calc(var(--ph) * 0.028)",   // thick — covers home indicator bar
  left:   "calc(var(--ph) * 0.018)",   // thin — iPhone side bezels are very slim
  right:  "calc(var(--ph) * 0.018)",   // thin — same
  borderRadius: "var(--pr)",
} as const;

/* ─────────────────────────────────────────────────────────────────
   BLACK & WHITE PALETTE
   All UI uses only white/black/grey — no colour accents.
   Dark mode  = black bg, white fg
   Light mode = white bg, black fg
   ───────────────────────────────────────────────────────────────── */

// Screen-level theme tokens (passed by colorMode)
function screenTokens(dark: boolean) {
  return {
    bg:         dark ? "#000000" : "#ffffff",
    surface:    dark ? "#111111" : "#f4f4f4",
    surfaceAlt: dark ? "#1a1a1a" : "#ebebeb",
    border:     dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)",
    fg:         dark ? "#ffffff" : "#000000",
    fgMuted:    dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)",
    fgFaint:    dark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)",
    positive:   dark ? "#ffffff" : "#000000",
    negative:   dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
    pillActive: dark ? "#ffffff" : "#000000",
    pillActiveFg: dark ? "#000000" : "#ffffff",
    greenFg:    dark ? "#4ade80" : "#16a34a",
    greenBg:    dark ? "rgba(74,222,128,0.15)" : "rgba(22,163,74,0.10)",
    redFg:      dark ? "#f87171" : "#dc2626",
    redBg:      dark ? "rgba(248,113,113,0.15)" : "rgba(220,38,38,0.10)",
    accent: "#63a1db",
    accentMuted: "rgba(99,161,219,0.15)",
  };
}

/* ═════════════════════════════════════════════════════════════════
   MINI CHART — monochrome
   ═════════════════════════════════════════════════════════════════ */
function MiniChart({ up, dark, heightFrac = 0.155 }: { up: boolean; dark: boolean; heightFrac?: number }) {
  const stroke = dark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";
  const fill   = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const id = up ? "mc-up" : "mc-dn";
  return (
    <Box h={`calc(var(--ph) * ${heightFrac})`} position="relative">
      <svg viewBox="0 0 240 100" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 78 L20 68 L40 74 L60 58 L80 62 L100 46 L120 50 L140 32 L160 38 L180 22 L200 28 L220 14 L240 20 L240 100 L0 100 Z"
          fill={`url(#${id})`}
        />
        <path
          d="M0 78 L20 68 L40 74 L60 58 L80 62 L100 46 L120 50 L140 32 L160 38 L180 22 L200 28 L220 14 L240 20"
          stroke={stroke} strokeWidth="2" fill="none"
          strokeLinecap="round" strokeLinejoin="round"
        />
        <circle cx="240" cy="20" r="3" fill={stroke} />
      </svg>
    </Box>
  );
}

/* ─── Page-visibility hook — returns false when tab is backgrounded ─ */
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return visible;
}

const tazdanShot = (n: number) => `/screenshots/${n}.png`;
const tazdanNewShot = (n: number) => `/screenshots/tazdan/IMG_${n}.PNG`;

const TAZDAN_SCREENS = {
  login: [tazdanShot(1)],
  dashboard: [tazdanNewShot(2134), tazdanNewShot(2135)],
  dashboardLight: [tazdanNewShot(2134)],
  dashboardDark: [tazdanNewShot(2135)],
  messages: [tazdanNewShot(2143)],
  buy: [tazdanNewShot(2136)],
  asset: [tazdanNewShot(2137), tazdanNewShot(2138), tazdanNewShot(2139)],
  budgets: [tazdanNewShot(2140), tazdanNewShot(2141)],
  topup: [tazdanNewShot(2142)],
  cardMain: [tazdanNewShot(2145)],
  cardPin: [tazdanNewShot(2146)],
  markets: [tazdanNewShot(2137), tazdanNewShot(2138), tazdanNewShot(2139)],
  profile: [tazdanNewShot(2140), tazdanNewShot(2141)],
  cards: [tazdanNewShot(2145), tazdanNewShot(2146)],
};

function ScreenshotScreen({
  images,
  intervalMs = 3200,
  priority = false,
  alt = "tazdan app screen",
}: {
  images: string[];
  intervalMs?: number;
  priority?: boolean;
  alt?: string;
}) {
  const pageVisible = usePageVisible();
  const slides = useMemo(() => (images.length > 0 ? images : TAZDAN_SCREENS.dashboard), [images]);
  const slidesKey = useMemo(() => slides.join("|"), [slides]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    slides.forEach((src) => {
      const img = new window.Image();
      img.decoding = "async";
      img.src = src;
    });
  }, [slidesKey, slides]);

  useEffect(() => {
    setIdx(0);
  }, [slidesKey]);

  useEffect(() => {
    if (!pageVisible || slides.length < 2) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [pageVisible, slides.length, slidesKey, intervalMs]);

  const src = slides[idx % slides.length];

  if (slides.length === 1) {
    return (
      <Box position="absolute" inset={0} bg="#000" overflow="hidden">
        <NextImage
          src={src}
          alt={alt}
          fill
          priority={priority}
          loading={priority ? undefined : "eager"}
          sizes="(max-width: 480px) 55vw, (max-width: 1024px) 38vw, 340px"
          style={{ objectFit: "cover" }}
        />
      </Box>
    );
  }

  return (
    <Box position="absolute" inset={0} bg="#000" overflow="hidden">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={src}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "absolute", inset: 0, willChange: "opacity" }}
        >
          <NextImage
            src={src}
            alt={alt}
            fill
            priority={priority && idx === 0}
            loading={priority && idx === 0 ? undefined : "eager"}
            sizes="(max-width: 480px) 55vw, (max-width: 1024px) 38vw, 340px"
            style={{ objectFit: "cover" }}
          />
        </motion.div>
      </AnimatePresence>
    </Box>
  );
}

const ScreenHomeShot = memo(function ScreenHomeShot({ priority = false }: { priority?: boolean }) {
  const phoneDark = usePhoneDark();
  const images = useMemo(
    () => (phoneDark ? TAZDAN_SCREENS.dashboardDark : TAZDAN_SCREENS.dashboardLight),
    [phoneDark],
  );
  return (
    <ScreenshotScreen
      images={images}
      intervalMs={5000}
      priority={priority}
      alt="tazdan home screen"
    />
  );
});

const ScreenChatShot = memo(function ScreenChatShot() {
  const images = useMemo(() => TAZDAN_SCREENS.messages, []);
  return <ScreenshotScreen images={images} intervalMs={7000} alt="tazdan chat screen" />;
});

const ScreenBuyShot = memo(function ScreenBuyShot() {
  const images = useMemo(() => TAZDAN_SCREENS.buy, []);
  return <ScreenshotScreen images={images} intervalMs={7000} alt="tazdan buy screen" />;
});

const ScreenAssetShot = memo(function ScreenAssetShot() {
  const images = useMemo(() => [TAZDAN_SCREENS.asset[0]], []);
  return <ScreenshotScreen images={images} alt="tazdan asset detail screen" />;
});

const ScreenTopUpShot = memo(function ScreenTopUpShot() {
  const images = useMemo(() => TAZDAN_SCREENS.topup, []);
  return <ScreenshotScreen images={images} intervalMs={7000} alt="tazdan top up screen" />;
});

const ScreenCardMainShot = memo(function ScreenCardMainShot() {
  const images = useMemo(() => TAZDAN_SCREENS.cardMain, []);
  return <ScreenshotScreen images={images} alt="tazdan cards screen" />;
});

const ScreenCardPinShot = memo(function ScreenCardPinShot() {
  const images = useMemo(() => TAZDAN_SCREENS.cardPin, []);
  return <ScreenshotScreen images={images} alt="tazdan card PIN screen" />;
});

const ScreenBudgetShot = memo(function ScreenBudgetShot() {
  const images = useMemo(() => TAZDAN_SCREENS.budgets, []);
  return <ScreenshotScreen images={images} intervalMs={9000} alt="tazdan budgets screen" />;
});

/* Single-frame REAL screenshot, for the film chapters.
   Two reasons this is a still and not one of the slideshow variants above:
   those advance on their own setInterval, which fights the scroll-driven
   chapters (scroll has to be the only clock there) — and the DOM screens
   (ScreenDashboard, ScreenBuy, ScreenChat…) are a monochrome recreation that
   has drifted badly from the shipped app, which now runs the blue-accent
   palette. The film shows real captures so it always matches what people
   actually download. */
const ScreenStill = memo(function ScreenStill({ shot, alt }: { shot: string; alt: string }) {
  const images = useMemo(() => [shot], [shot]);
  return <ScreenshotScreen images={images} alt={alt} />;
});

/* ═════════════════════════════════════════════════════════════════
   SCREEN MEDIA — plays an uploaded screen *recording* inside the phone.
   Drop clips in `client/public/recordings/<clip>.mp4` and they auto-play
   (muted, looped, inline). Until a clip exists the component gracefully
   falls back to the screenshot slideshow, so the hero never breaks.
   ═════════════════════════════════════════════════════════════════ */
function ScreenMedia({
  clip,
  images,
  intervalMs = 3200,
  priority = false,
  alt = "tazdan app screen",
}: {
  clip?: string;
  images: string[];
  intervalMs?: number;
  priority?: boolean;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const pageVisible = usePageVisible();

  useEffect(() => {
    const v = ref.current;
    if (!v || failed || !clip) return;
    if (pageVisible) v.play?.().catch(() => {});
    else v.pause?.();
  }, [clip, failed, pageVisible]);

  if (!clip || failed) {
    return <ScreenshotScreen images={images} intervalMs={intervalMs} priority={priority} alt={alt} />;
  }

  return (
    <Box position="absolute" inset={0} bg="#000" overflow="hidden">
      <video
        ref={ref}
        src={`/recordings/${clip}.mp4`}
        autoPlay
        loop
        muted
        playsInline
        preload={priority ? "auto" : "metadata"}
        onError={() => setFailed(true)}
        aria-label={alt}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    </Box>
  );
}

/* ═════════════════════════════════════════════════════════════════
   LOCK SCREEN — a real "locked phone" face. Falls back to a rendered
   lock screen (clock + lock + swipe-up cue) when no `lock.mp4` clip is
   present. Slides up and fades as `unlockProgress` advances.
   ═════════════════════════════════════════════════════════════════ */
const LOCK_SLIDE_PX = -4000;

function IosFlashlightIcon({ color, size }: { color: string; size: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M10.4 3.9h7.2c.65 0 1.18.53 1.18 1.18v2.38c0 .55-.38 1.02-.91 1.15l-.75.18v2.1c0 .75-.2 1.48-.58 2.12l-.88 1.48a4.14 4.14 0 0 0-.58 2.12v5.35a2.08 2.08 0 0 1-4.16 0v-5.35c0-.75-.2-1.48-.58-2.12l-.88-1.48a4.14 4.14 0 0 1-.58-2.12v-2.1l-.75-.18a1.18 1.18 0 0 1-.91-1.15V5.08c0-.65.53-1.18 1.18-1.18Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.35 8.7h9.3M10.9 12.35h6.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LockedPhoneFace() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  const h = now ? now.getHours() : 9;
  const hh = (h % 12 || 12).toString();
  const mm = now ? now.getMinutes().toString().padStart(2, "0") : "41";
  const dateOptions = useMemo<Intl.DateTimeFormatOptions>(
    () => ({ weekday: "long", day: "numeric", month: "long" }),
    [],
  );
  const dateStr = useMemo(
    () => (now ? now.toLocaleDateString(undefined, dateOptions) : "Monday, 8 June"),
    [dateOptions, now],
  );

  // Everything sizes off the phone height var (--ph) so the lock face scales
  // perfectly inside the mockup on every viewport — no awkward overflow on
  // small mobile phones.
  const v = (f: number) => `calc(var(--ph) * ${f})`;
  const statusIcon = "rgba(255,255,255,0.96)";
  const statusBars = useMemo(() => [0.010, 0.014, 0.018, 0.023], []);
  const lockControlStyle = useMemo(
    () => ({
      width: v(0.058),
      height: v(0.058),
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
    }) as React.CSSProperties,
    [],
  );

  return (
    <Box position="absolute" inset={0} overflow="hidden" bg="#111216">
      <Box
        position="absolute"
        inset={0}
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.005) 42%, rgba(0,0,0,0.18) 100%)",
        }}
      />

      {/* iOS-style status cluster: lock screens keep the large clock, so only
          the connectivity/battery cluster sits at the top-right. */}
      <HStack
        position="absolute"
        top={v(0.030)}
        right={v(0.042)}
        spacing={v(0.009)}
        align="center"
        color={statusIcon}
      >
        <HStack spacing={v(0.003)} align="flex-end">
          {statusBars.map((height, i) => (
            <Box
              key={height}
              w={v(0.005)}
              h={v(height)}
              borderRadius="full"
              bg={statusIcon}
              opacity={i === 0 ? 0.7 : 1}
            />
          ))}
        </HStack>
        <Icon as={FiWifi} style={{ width: v(0.027), height: v(0.027) }} />
        <Box
          position="relative"
          w={v(0.047)}
          h={v(0.022)}
          borderRadius={v(0.006)}
          bg="rgba(255,255,255,0.88)"
          color="#111216"
          display="flex"
          alignItems="center"
          justifyContent="center"
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          <Text fontSize={v(0.012)} fontWeight="900" lineHeight={1}>66</Text>
          <Box
            position="absolute"
            right={v(-0.004)}
            top="28%"
            w={v(0.003)}
            h="44%"
            borderRadius="full"
            bg="rgba(255,255,255,0.55)"
          />
        </Box>
      </HStack>

      <VStack position="absolute" top={v(0.086)} left={0} right={0} spacing={v(0.018)}>
        <Icon as={FiLock} color="rgba(255,255,255,0.92)" style={{ width: v(0.021), height: v(0.021) }} />
        <VStack spacing={v(0.004)}>
          <Text
            fontFamily="'DM Sans', sans-serif"
            fontWeight="700"
            color="#fff"
            lineHeight={0.86}
            style={{ fontSize: v(0.126) }}
            sx={{ fontVariantNumeric: "tabular-nums" }}
            letterSpacing="-0.055em"
          >
            {hh}:{mm}
          </Text>
          <Text fontWeight="650" color="rgba(255,255,255,0.78)" style={{ fontSize: v(0.020) }}>
            {dateStr}
          </Text>
        </VStack>
      </VStack>

      <Flex position="absolute" left={v(0.056)} right={v(0.056)} bottom={v(0.064)} justify="space-between" align="center">
        <Flex
          align="center"
          justify="center"
          borderRadius="full"
          bg="rgba(0,0,0,0.36)"
          border="1px solid rgba(255,255,255,0.12)"
          style={lockControlStyle}
        >
          <IosFlashlightIcon color="rgba(255,255,255,0.92)" size={v(0.030)} />
        </Flex>
        <Flex
          align="center"
          justify="center"
          borderRadius="full"
          bg="rgba(0,0,0,0.36)"
          border="1px solid rgba(255,255,255,0.12)"
          style={lockControlStyle}
        >
          <Icon as={FiCamera} color="rgba(255,255,255,0.92)" style={{ width: v(0.025), height: v(0.025) }} />
        </Flex>
      </Flex>

      <VStack position="absolute" left={0} right={0} bottom={v(0.014)} spacing={v(0.008)}>
        <Text color="rgba(255,255,255,0.68)" fontSize={v(0.014)} fontWeight="700">
          Swipe up to open
        </Text>
        <Box borderRadius="full" bg="rgba(255,255,255,0.92)" style={{ width: v(0.15), height: v(0.005) }} />
      </VStack>
    </Box>
  );
}

// Optional lock-screen video. Ships disabled because no clip exists in
// /public/recordings — when missing, a <video> that 404s renders an opaque
// black box in production (onError doesn't always fire reliably across hosts),
// which is exactly the "black phone frame" bug. We default to the fully
// rendered LockedPhoneFace and only attempt the video when a real clip is
// dropped in AND this flag is flipped on.
const LOCK_VIDEO_SRC: string | null = null; // e.g. "/recordings/lock.mp4"

const LockScreen = memo(function LockScreen({
  unlockProgress,
}: {
  unlockProgress: MotionValue<number>;
}) {
  // Start in the rendered-face state; only show the video if it actually loads.
  const [useVideo, setUseVideo] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const slideY = useTransform(
    unlockProgress,
    [0, 0.3, 0.7, 1],
    [0, LOCK_SLIDE_PX * 0.05, LOCK_SLIDE_PX * 0.6, LOCK_SLIDE_PX],
  );
  const lockOpacity = useTransform(unlockProgress, [0, 0.7, 0.8], [1, 1, 0]);
  const lockPointerEvents = useTransform(unlockProgress, (v: number) =>
    v >= 0.8 ? "none" : "auto"
  );

  useEffect(() => { if (useVideo) ref.current?.play?.().catch(() => {}); }, [useVideo]);

  return (
    <motion.div
      style={{
        position: "absolute", inset: 0,
        y: slideY, opacity: lockOpacity,
        pointerEvents: lockPointerEvents as unknown as "auto" | "none",
        zIndex: 6, overflow: "hidden",
        borderRadius: "inherit", willChange: "transform, opacity",
      }}
    >
      {/* Rendered lock face is ALWAYS the base layer — never a black box. */}
      <LockedPhoneFace />
      {LOCK_VIDEO_SRC && useVideo && (
        <Box position="absolute" inset={0} bg="#0A0A0B" overflow="hidden">
          <video
            ref={ref}
            src={LOCK_VIDEO_SRC}
            autoPlay loop muted playsInline preload="auto"
            onError={() => setUseVideo(false)}
            onCanPlay={() => setUseVideo(true)}
            aria-label="tazdan locked phone"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>
      )}
    </motion.div>
  );
});

/* ═════════════════════════════════════════════════════════════════
   APP SCREEN PALETTE — theme-reactive (follows the landing colour mode)
   ═════════════════════════════════════════════════════════════════ */
// Mirrors the real mobile app's Palette (mobile/src/store/themeStore.ts) 1:1 so
// the rendered phone screens match the shipping app exactly — warm charcoal
// ramp on dark, paper off-white on light, #63A1DB brand accent.
function appTokens(dark: boolean) {
  return dark
    ? {
        bg: "#16181C", surface: "#1E2127", bgRaised: "#262A31", border: "rgba(255,255,255,0.09)", divider: "rgba(255,255,255,0.15)",
        fg: "#F4F5F7", fgMuted: "rgba(244,245,247,0.62)", fgFaint: "rgba(244,245,247,0.36)",
        green: "#3FCF8E", redFg: "#F87171", redBg: "rgba(248,113,113,0.14)",
        accent: "#63A1DB", accentFg: "#16181C", accentSoft: "rgba(99,161,219,0.16)", accentBorder: "rgba(99,161,219,0.42)", accentText: "#8BBCE8",
        ctaBg: "#F4F5F7", ctaFg: "#16181C", pillBg: "rgba(255,255,255,0.07)",
        ink: "#F4F5F7", inkFg: "#16181C",
        sheetBg: "#1E2127", sheetCard: "#262A31", sheetBorder: "rgba(255,255,255,0.09)",
        sheetFg: "#F4F5F7", sheetMuted: "rgba(244,245,247,0.62)", sheetFaint: "rgba(244,245,247,0.36)",
        sheetGreen: "#3FCF8E", sheetGreenBg: "rgba(63,207,142,0.14)", sheetGreenBd: "rgba(63,207,142,0.42)",
        sheetChip: "rgba(255,255,255,0.07)",
      }
    : {
        bg: "#FAFAF7", surface: "#F1F0EB", bgRaised: "#FFFFFF", border: "rgba(10,10,11,0.08)", divider: "rgba(10,10,11,0.14)",
        fg: "#0A0A0B", fgMuted: "rgba(10,10,11,0.62)", fgFaint: "rgba(10,10,11,0.38)",
        green: "#1F8F58", redFg: "#C0272D", redBg: "rgba(192,39,45,0.10)",
        accent: "#4F8BC4", accentFg: "#FFFFFF", accentSoft: "rgba(79,139,196,0.12)", accentBorder: "rgba(79,139,196,0.38)", accentText: "#3E78AE",
        ctaBg: "#0A0A0B", ctaFg: "#FAFAFA", pillBg: "rgba(10,10,11,0.06)",
        ink: "#0A0A0B", inkFg: "#FAFAFA",
        sheetBg: "#F1F0EB", sheetCard: "#FFFFFF", sheetBorder: "rgba(10,10,11,0.08)",
        sheetFg: "#0A0A0B", sheetMuted: "rgba(10,10,11,0.62)", sheetFaint: "rgba(10,10,11,0.38)",
        sheetGreen: "#1F8F58", sheetGreenBg: "rgba(31,143,88,0.10)", sheetGreenBd: "rgba(31,143,88,0.42)",
        sheetChip: "rgba(10,10,11,0.06)",
      };
}

/* ─────────────────────────────────────────────────────────────────
   PHONE THEME INVERSION
   The device mockups intentionally render in the OPPOSITE colour mode
   of the website — a light website shows a dark app, a dark website
   shows a light app. This makes the device pop against the page and
   demonstrates that the product supports both modes.
   ───────────────────────────────────────────────────────────────── */
function usePhoneDark(): boolean {
  const { colorMode } = useColorMode();
  return colorMode !== "dark";
}

/* ── QR glyph (header icon) ── */
function QrGlyph({ size, color }: { size: string; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8 0h3v3h-3v-3zm5-2h3v3h-3v-3zm0 5h3v3h-3v-3zm-5 0h3v3h-3v-3z" />
    </svg>
  );
}

/* ── coloured sparkline ── */
function Spark({ id, line, area, h, color = "#3ecf6e" }: {
  id: string; line: string; area?: string; h: string; color?: string;
}) {
  return (
    <Box h={h} w="100%">
      <svg viewBox="0 0 100 40" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${id})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth="2.4"
          strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </Box>
  );
}

const CRYPTO_ICON_BASE = "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color";

function WebCoinIcon({ symbol, size = "calc(var(--ph)*0.052)" }: { symbol: string; size?: string }) {
  return (
    <Box position="relative" style={{ width: size, height: size }} flexShrink={0}>
      <NextImage
        src={`${CRYPTO_ICON_BASE}/${symbol.toLowerCase()}.png`}
        alt={`${symbol} icon`}
        fill
        unoptimized
        sizes="64px"
        style={{ objectFit: "contain" }}
      />
    </Box>
  );
}

function WebFiatSymbol({ symbol, color, size = "calc(var(--ph)*0.052)" }: { symbol: string; color: string; size?: string }) {
  return (
    <Flex style={{ width: size, height: size }} align="center" justify="center" flexShrink={0}>
      <Text style={{ fontSize: `calc(${size} * 0.62)` }} color={color} fontWeight="900" lineHeight={1}>
        {symbol}
      </Text>
    </Flex>
  );
}

/* ═════════════════════════════════════════════════════════════════
   DASHBOARD SCREEN — matches the app home screen 1:1
   ═════════════════════════════════════════════════════════════════ */
const DASH_SNAPSHOTS = [
  { bal: "$1,228,898.36", deltaAmt: "-$75.04", down: true, deltaPct: "0.01%",
    prices: ["$7,797.00", "$473.92", "$238.37", "$482.06"],
    pcts: ["+0.00%", "+0.34%", "+0.25%", "+1.04%"] },
  { bal: "$1,229,140.20", deltaAmt: "+$166.80", down: false, deltaPct: "0.02%",
    prices: ["$7,797.00", "$475.18", "$239.06", "$486.41"],
    pcts: ["+0.00%", "+0.61%", "+0.54%", "+1.93%"] },
  { bal: "$1,228,664.88", deltaAmt: "-$308.52", down: true, deltaPct: "0.04%",
    prices: ["$7,797.00", "$472.40", "$237.55", "$478.92"],
    pcts: ["+0.00%", "-0.27%", "-0.10%", "+0.27%"] },
];

const ScreenDashboard = memo(function ScreenDashboard() {
  const APP = appTokens(usePhoneDark());
  const pageVisible = usePageVisible();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!pageVisible) return;
    const id = setInterval(() => setTick((t) => (t + 1) % DASH_SNAPSHOTS.length), 3000);
    return () => clearInterval(id);
  }, [pageVisible]);
  const snap = DASH_SNAPSHOTS[tick];

  const fs = {
    statusH:  "calc(var(--ph) * 0.052)",
    px:       "calc(var(--pw) * 0.065)",
    handle:   "calc(var(--ph) * 0.023)",
    avatar:   "calc(var(--ph) * 0.052)",
    hdrBtn:   "calc(var(--ph) * 0.05)",
    hdrIcon:  "calc(var(--ph) * 0.022)",
    balance:  "calc(var(--ph) * 0.05)",
    eye:      "calc(var(--ph) * 0.022)",
    delta:    "calc(var(--ph) * 0.02)",
    pill:     "calc(var(--ph) * 0.019)",
    actLabel: "calc(var(--ph) * 0.021)",
    actH:     "calc(var(--ph) * 0.055)",
    tab:      "calc(var(--ph) * 0.023)",
    section:  "calc(var(--ph) * 0.0145)",
    coinIcon: "calc(var(--ph) * 0.052)",
    asset:    "calc(var(--ph) * 0.021)",
    assetSub: "calc(var(--ph) * 0.0165)",
    pct:      "calc(var(--ph) * 0.0165)",
    price:    "calc(var(--ph) * 0.021)",
    chartW:   "calc(var(--pw) * 0.4)",
    chartH:   "calc(var(--ph) * 0.044)",
    navIcon:  "calc(var(--ph) * 0.024)",
    navLabel: "calc(var(--ph) * 0.013)",
    fab:      "calc(var(--ph) * 0.066)",
  };

  const crypto = [
    { name: "Tether", amt: "7,797 USDT", pct: "+0.00%", val: "$7,797.00",
      icon: <Text style={{ fontSize: "calc(var(--ph)*0.04)" }} fontWeight="900" color="#26A17B">₮</Text>,
      spark: {
        line: "M0,8 L21,8 L21,33 L31,33 L31,8 L52,8 L52,33 L62,33 L62,8 L100,8",
        area: "M0,8 L21,8 L21,33 L31,33 L31,8 L52,8 L52,33 L62,33 L62,8 L100,8 L100,40 L0,40 Z",
      } },
    { name: "Ethereum", amt: "0.221906 ETH", pct: "+0.34%", val: "$473.92",
      icon: <Text style={{ fontSize: "calc(var(--ph)*0.038)" }} fontWeight="800" color="#7b8af0">Ξ</Text>,
      spark: {
        line: "M0,30 L11,16 L22,26 L33,11 L44,22 L55,8 L66,20 L77,10 L88,18 L100,12",
        area: "M0,30 L11,16 L22,26 L33,11 L44,22 L55,8 L66,20 L77,10 L88,18 L100,12 L100,40 L0,40 Z",
      } },
    { name: "Bitcoin", amt: "0.00306776 BTC", pct: "+0.25%", val: "$238.37",
      icon: <Text style={{ fontSize: "calc(var(--ph)*0.04)" }} fontWeight="900" color="#F7931A">₿</Text>,
      spark: {
        line: "M0,24 L12,13 L24,24 L36,10 L48,21 L60,12 L72,25 L84,13 L100,19",
        area: "M0,24 L12,13 L24,24 L36,10 L48,21 L60,12 L72,25 L84,13 L100,19 L100,40 L0,40 Z",
      } },
    { name: "Shiba Inu", amt: "82,403,651 SHIB", pct: "+1.04%", val: "$482.06",
      icon: <Text style={{ fontSize: "calc(var(--ph)*0.034)" }}>🐕</Text>,
      spark: { line: "M0,28 L100,28" } },
  ];

  const fiat = [
    { name: "US Dollar", amt: "991,357 USD", val: "$991,357.00", flag: "$" },
    { name: "Euro", amt: "8,797 EUR", val: "$9,500.76", flag: "€" },
  ];

  return (
    <VStack h="100%" w="100%" align="stretch" spacing={0} bg={APP.bg} overflow="hidden">
      <Box style={{ height: fs.statusH }} flexShrink={0} />

      {/* Header */}
      <HStack px={fs.px} pb="calc(var(--ph)*0.018)" justify="space-between" flexShrink={0}>
        <HStack spacing="calc(var(--pw)*0.04)">
          <Flex style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%" }}
            bg="#232327" align="center" justify="center" flexShrink={0}>
            <Text style={{ fontSize: "calc(var(--ph)*0.024)" }}>⚡</Text>
          </Flex>
          <Text style={{ fontSize: fs.handle }} color={APP.fg} fontWeight="800" letterSpacing="-0.02em">@jack.green</Text>
        </HStack>
        <HStack spacing="calc(var(--pw)*0.035)">
          {[
            <QrGlyph key="qr" size={fs.hdrIcon} color={APP.fg} />,
            <Icon key="bell" as={FiBell} color={APP.fg} style={{ width: fs.hdrIcon, height: fs.hdrIcon }} />,
            <Icon key="scan" as={FiMaximize2} color={APP.fg} style={{ width: fs.hdrIcon, height: fs.hdrIcon }} />,
          ].map((node, i) => (
            <Flex key={i} style={{ width: fs.hdrBtn, height: fs.hdrBtn, borderRadius: "50%" }}
              bg={APP.surface} align="center" justify="center" flexShrink={0}>{node}</Flex>
          ))}
        </HStack>
      </HStack>

      {/* Balance */}
      <HStack px={fs.px} spacing="calc(var(--pw)*0.03)" align="center" flexShrink={0}>
        <Box overflow="hidden" style={{ height: fs.balance }}>
          <AnimatePresence mode="wait">
            <motion.div key={tick}
              initial={{ y: "55%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-55%", opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
              <Text style={{ fontSize: fs.balance }} color={APP.fg} fontWeight="600"
                letterSpacing="-0.02em" lineHeight={1}>{snap.bal}</Text>
            </motion.div>
          </AnimatePresence>
        </Box>
        <Icon as={FiEye} color={APP.fgFaint} style={{ width: fs.eye, height: fs.eye }} />
      </HStack>

      {/* Delta */}
      <HStack px={fs.px} pt="calc(var(--ph)*0.016)" pb="calc(var(--ph)*0.026)"
        spacing="calc(var(--pw)*0.035)" flexShrink={0}>
        <AnimatePresence mode="wait">
          <motion.div key={tick}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}>
            <HStack spacing="calc(var(--pw)*0.035)">
              <Text style={{ fontSize: fs.delta }}
                color={snap.down ? APP.redFg : APP.green} fontWeight="600">{snap.deltaAmt}</Text>
              <HStack bg={snap.down ? APP.redBg : "rgba(62,207,110,0.14)"} borderRadius="full"
                px="calc(var(--pw)*0.04)" py="calc(var(--ph)*0.006)" spacing="calc(var(--pw)*0.018)">
                <Text style={{ fontSize: "calc(var(--ph)*0.013)" }}
                  color={snap.down ? APP.redFg : APP.green}>{snap.down ? "▼" : "▲"}</Text>
                <Text style={{ fontSize: fs.pill }}
                  color={snap.down ? APP.redFg : APP.green} fontWeight="700">{snap.deltaPct}</Text>
              </HStack>
            </HStack>
          </motion.div>
        </AnimatePresence>
      </HStack>

      {/* Action buttons — vertical icon chips + labels (matches the app) */}
      <HStack px={fs.px} pb="calc(var(--ph)*0.026)" spacing="calc(var(--pw)*0.02)"
        justify="space-between" align="flex-start" flexShrink={0}>
        {[
          { label: "Buy",    icon: FiTrendingUp,   tone: "accent" },
          { label: "Sell",   icon: FiTrendingDown, tone: "raised" },
          { label: "Send",   icon: FiSend,         tone: "raised" },
          { label: "Top up", icon: FiDownload,     tone: "accentSoft" },
          { label: "More",   icon: FiMoreHorizontal, tone: "raised" },
        ].map((b) => {
          const bg = b.tone === "accent" ? APP.accent : b.tone === "accentSoft" ? "rgba(99,161,219,0.16)" : APP.surface;
          const fg = b.tone === "accent" ? "#FFFFFF" : b.tone === "accentSoft" ? "#8BBCE8" : APP.fg;
          return (
            <VStack key={b.label} spacing="calc(var(--ph)*0.008)" flex={1} minW={0} align="center">
              <Flex style={{ width: "calc(var(--ph)*0.062)", height: "calc(var(--ph)*0.062)", borderRadius: "50%" }}
                bg={bg} align="center" justify="center">
                <Icon as={b.icon} color={fg} style={{ width: "calc(var(--ph)*0.026)", height: "calc(var(--ph)*0.026)" }} />
              </Flex>
              <Text style={{ fontSize: "calc(var(--ph)*0.0145)", whiteSpace: "nowrap" }} color={APP.fgMuted} fontWeight="600">{b.label}</Text>
            </VStack>
          );
        })}
      </HStack>

      {/* Tabs */}
      <HStack px={fs.px} spacing="calc(var(--pw)*0.06)" flexShrink={0}>
        {["Assets", "Activity"].map((tab, i) => (
          <VStack key={tab} spacing="calc(var(--ph)*0.007)" align="center">
            <Text style={{ fontSize: fs.tab }} color={i === 0 ? APP.fg : APP.fgFaint}
              fontWeight={i === 0 ? 800 : 600}>{tab}</Text>
            <Box w="62%" h="calc(var(--ph)*0.0035)" borderRadius="full"
              bg={i === 0 ? APP.fg : "transparent"} />
          </VStack>
        ))}
      </HStack>
      <Box h="1px" bg={APP.border} flexShrink={0} mt="calc(var(--ph)*0.012)" />

      {/* Asset list (clips like the app) */}
      <VStack align="stretch" spacing={0} flex={1} overflow="hidden">
        <Text style={{ fontSize: fs.section }} color={APP.fgMuted} fontWeight="800"
          letterSpacing="0.08em" px={fs.px} pt="calc(var(--ph)*0.02)" pb="calc(var(--ph)*0.012)">
          CRYPTO ASSETS
        </Text>
        {crypto.map((a, i) => (
          <HStack key={a.name} px={fs.px} py="calc(var(--ph)*0.013)"
            spacing="calc(var(--pw)*0.04)" borderTop={`1px solid ${APP.border}`}>
            <Flex style={{ width: fs.coinIcon, height: fs.coinIcon }}
              align="center" justify="center" flexShrink={0}>{a.icon}</Flex>
            <VStack align="start" spacing="calc(var(--ph)*0.002)" flex={1} minW={0}>
              <Text style={{ fontSize: fs.asset, whiteSpace: "nowrap" }} color={APP.fg} fontWeight="700">{a.name}</Text>
              <Text style={{ fontSize: fs.assetSub, whiteSpace: "nowrap" }} color={APP.fgMuted} fontWeight="500">{a.amt}</Text>
              <motion.span key={`p${tick}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                style={{ fontSize: fs.pct, fontWeight: 600,
                  color: snap.pcts[i].startsWith("-") ? APP.redFg : APP.green }}>
                {snap.pcts[i]}
              </motion.span>
            </VStack>
            <VStack align="end" spacing="calc(var(--ph)*0.007)" flexShrink={0}>
              <motion.span key={`v${tick}`}
                initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                style={{ fontSize: fs.price, fontWeight: 700, color: APP.fg }}>
                {snap.prices[i]}
              </motion.span>
              <Box style={{ width: fs.chartW }}>
                <Spark id={`spk-${i}`} h={fs.chartH} line={a.spark.line} area={a.spark.area} />
              </Box>
            </VStack>
          </HStack>
        ))}
        <Text style={{ fontSize: fs.section }} color={APP.fgMuted} fontWeight="800"
          letterSpacing="0.08em" px={fs.px} pt="calc(var(--ph)*0.022)" pb="calc(var(--ph)*0.012)">
          FIAT ASSETS
        </Text>
        {fiat.map((a) => (
          <HStack key={a.name} px={fs.px} py="calc(var(--ph)*0.017)"
            spacing="calc(var(--pw)*0.04)" borderTop={`1px solid ${APP.border}`}>
            <Flex style={{ width: fs.coinIcon, height: fs.coinIcon }}
              align="center" justify="center" flexShrink={0}>
              <Text style={{ fontSize: "calc(var(--ph)*0.032)" }} color={APP.fg} fontWeight="700">{a.flag}</Text>
            </Flex>
            <VStack align="start" spacing="calc(var(--ph)*0.002)" flex={1} minW={0}>
              <Text style={{ fontSize: fs.asset }} color={APP.fg} fontWeight="700">{a.name}</Text>
              <Text style={{ fontSize: fs.assetSub }} color={APP.fgMuted} fontWeight="500">{a.amt}</Text>
            </VStack>
            <Text style={{ fontSize: fs.price }} color={APP.fg} fontWeight="700">{a.val}</Text>
          </HStack>
        ))}
      </VStack>

      {/* Bottom nav */}
      <Box flexShrink={0} borderTop={`1px solid ${APP.border}`} bg={APP.bg}
        px={fs.px} pt="calc(var(--ph)*0.012)" pb="calc(var(--ph)*0.016)">
        <HStack justify="space-between" align="flex-start">
          {[
            { icon: FiMessageCircle, label: "Chat" },
            { icon: FiCreditCard, label: "Wallet" },
            { fab: true, label: "" },
            { icon: FiRepeat, label: "P2P" },
            { icon: FiUser, label: "Profile" },
          ].map((tab, i) => (
            <VStack key={i} spacing="calc(var(--ph)*0.006)" flex={1} align="center">
              {tab.fab ? (
                <Flex style={{ width: fs.fab, height: fs.fab, borderRadius: "50%" }}
                  bg={APP.fg} align="center" justify="center"
                  mt="calc(var(--ph)*-0.026)"
                  boxShadow="0 calc(var(--ph)*0.006) calc(var(--ph)*0.02) rgba(0,0,0,0.45)">
                  <Flex align="center" justify="center">
                      <NextImage src="/icon-color.png" alt="+" width={60} height={60} />
                  </Flex>
                </Flex>
              ) : (
                <>
                  <Icon as={tab.icon!} color={APP.fgMuted}
                    style={{ width: fs.navIcon, height: fs.navIcon }} />
                  <Text style={{ fontSize: fs.navLabel }} color={APP.fgFaint} fontWeight="500">{tab.label}</Text>
                </>
              )}
            </VStack>
          ))}
        </HStack>
      </Box>
    </VStack>
  );
});

/* ═════════════════════════════════════════════════════════════════
   BOTTOM-SHEET WRAPPER — dimmed dashboard + light sheet
   ═════════════════════════════════════════════════════════════════ */
function SheetScreen({ title, heightFrac, children }: {
  title?: string; heightFrac: number; children: React.ReactNode;
}) {
  const APP = appTokens(usePhoneDark());
  return (
    <Box position="relative" h="100%" w="100%" overflow="hidden" bg={APP.bg}>
      <Box position="absolute" inset={0}><ScreenDashboard /></Box>
      <Box position="absolute" inset={0} bg="rgba(0,0,0,0.55)" />
      <VStack
        position="absolute" left={0} right={0} bottom={0} align="stretch" spacing={0}
        style={{ height: `calc(var(--ph) * ${heightFrac})` }}
        bg={APP.sheetBg}
        borderTopRadius="calc(var(--ph)*0.042)"
        overflow="hidden"
        boxShadow="0 calc(var(--ph)*-0.02) calc(var(--ph)*0.06) rgba(0,0,0,0.4)"
      >
        <Flex justify="center" pt="calc(var(--ph)*0.012)" pb="calc(var(--ph)*0.004)" flexShrink={0}>
          <Box w="calc(var(--pw)*0.12)" h="calc(var(--ph)*0.005)" borderRadius="full" bg={APP.sheetFaint} />
        </Flex>
        {title && (
          <Text flexShrink={0} px="calc(var(--pw)*0.07)" pt="calc(var(--ph)*0.01)" pb="calc(var(--ph)*0.014)"
            style={{ fontSize: "calc(var(--ph)*0.03)" }} color={APP.sheetFg} fontWeight="800" letterSpacing="-0.02em">
            {title}
          </Text>
        )}
        <VStack align="stretch" spacing={0} flex={1} overflow="hidden">
          {children}
        </VStack>
      </VStack>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════════════════
   SLIDE-TO-CONFIRM CTA — mirrors the in-app SlideToConfirm component
   Brand-coloured track + thumb, looping slide animation, live timer
   badge that tints red as the countdown runs down.
   ═════════════════════════════════════════════════════════════════ */
function SlideCTA({
  APP, label, seconds,
}: {
  APP: ReturnType<typeof appTokens>;
  label: string;
  seconds?: number;
}) {
  const accent = "#63a1db";
  const critical = seconds !== undefined && seconds <= 10;
  return (
    <Box
      position="relative"
      h="calc(var(--ph)*0.06)"
      borderRadius="calc(var(--ph)*0.02)"
      bg={APP.sheetCard}
      border={`1px solid ${critical ? "rgba(239,68,68,0.5)" : APP.sheetBorder}`}
      overflow="hidden"
      mt="calc(var(--ph)*0.002)"
    >
      {/* brand progress fill — pulses with the thumb */}
      <motion.div
        animate={{ width: ["24%", "58%", "24%"], opacity: [0.14, 0.22, 0.14] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          background: accent, borderRadius: "calc(var(--ph)*0.02)",
        }}
      />

      {/* danger overlay — bleeds red in the last 10 s */}
      {critical && (
        <Box position="absolute" inset={0} bg="rgba(239,68,68,0.4)" />
      )}

      {/* centred label */}
      <Flex position="absolute" inset={0} align="center" justify="center" px="calc(var(--ph)*0.06)">
        <Text style={{ fontSize: "calc(var(--ph)*0.02)" }} color={APP.sheetFg} fontWeight="700" noOfLines={1}>
          {label}
        </Text>
      </Flex>

      {/* live countdown badge — anchored right, on the slider surface */}
      {seconds !== undefined && (
        <motion.div
          animate={{ scale: critical ? [1, 1.16, 1] : [1, 1.08, 1] }}
          transition={{ duration: critical ? 0.8 : 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", right: "calc(var(--ph)*0.012)",
            top: "50%", translateY: "-50%",
          }}
        >
          <Flex
            align="center" justify="center"
            bg={critical ? "rgba(239,68,68,0.9)" : "rgba(99,161,219,0.92)"}
            borderRadius="calc(var(--ph)*0.01)"
            px="calc(var(--pw)*0.035)" py="calc(var(--ph)*0.005)"
          >
            <Text style={{ fontSize: "calc(var(--ph)*0.014)" }} color="#fff" fontWeight="800">
              {seconds}s
            </Text>
          </Flex>
        </motion.div>
      )}

      {/* draggable thumb — slides + springs back on a loop */}
      <motion.div
        animate={{ x: ["0%", "320%", "0%"] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: "absolute",
          left: "calc(var(--ph)*0.005)",
          top: "calc(var(--ph)*0.005)",
        }}
      >
        <Flex
          align="center" justify="center"
          style={{ width: "calc(var(--ph)*0.05)", height: "calc(var(--ph)*0.05)" }}
          borderRadius="calc(var(--ph)*0.014)"
          bg={accent}
          boxShadow={`0 calc(var(--ph)*0.004) calc(var(--ph)*0.012) rgba(99,161,219,0.5)`}
        >
          <Icon as={FiChevronRight} color="#fff"
            style={{ width: "calc(var(--ph)*0.022)", height: "calc(var(--ph)*0.022)", marginRight: "calc(var(--ph)*-0.012)" }} />
          <Icon as={FiChevronRight} color="rgba(255,255,255,0.5)"
            style={{ width: "calc(var(--ph)*0.022)", height: "calc(var(--ph)*0.022)" }} />
        </Flex>
      </motion.div>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════════════════
   BUY SCREEN — matches the in-app Buy bottom sheet
   ═════════════════════════════════════════════════════════════════ */
const BUY_STEPS = [
  { amt: "25",  recv: "0.0003203", fee: "0.13", total: "£25.00" },
  { amt: "100", recv: "0.0012812", fee: "0.50", total: "£100.00" },
  { amt: "250", recv: "0.0032030", fee: "1.25", total: "£250.00" },
  { amt: "500", recv: "0.0062483", fee: "2.50", total: "£500.00" },
];

const ScreenBuy = memo(function ScreenBuy() {
  const APP = appTokens(usePhoneDark());
  const px = "calc(var(--pw)*0.07)";
  const pageVisible = usePageVisible();
  const [bi, setBi] = useState(3);
  useEffect(() => {
    if (!pageVisible) return;
    const id = setInterval(() => setBi((b) => (b + 1) % BUY_STEPS.length), 2400);
    return () => clearInterval(id);
  }, [pageVisible]);
  const step = BUY_STEPS[bi];
  /* live 30s quote countdown — loops, mirrors the real requote timer */
  const [secs, setSecs] = useState(26);
  useEffect(() => {
    if (!pageVisible) return;
    const id = setInterval(() => setSecs((s) => (s <= 1 ? 30 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [pageVisible]);
  const fs = {
    big:   "calc(var(--ph)*0.038)",
    name:  "calc(var(--ph)*0.022)",
    sub:   "calc(var(--ph)*0.0155)",
    label: "calc(var(--ph)*0.0135)",
    body:  "calc(var(--ph)*0.018)",
    chip:  "calc(var(--ph)*0.0165)",
    btn:   "calc(var(--ph)*0.022)",
    card:  "calc(var(--ph)*0.022)",
  };
  return (
    <SheetScreen heightFrac={0.89}>
      <VStack align="stretch" spacing="calc(var(--ph)*0.0105)" px={px} pt="calc(var(--ph)*0.004)">
        {/* asset selector */}
        <HStack bg={APP.sheetCard} border={`1px solid ${APP.sheetBorder}`} borderRadius={fs.card}
          px="calc(var(--ph)*0.016)" py="calc(var(--ph)*0.014)" spacing="calc(var(--pw)*0.04)">
          <Flex style={{ width: "calc(var(--ph)*0.05)", height: "calc(var(--ph)*0.05)", borderRadius: "50%" }}
            bg="#fbe6c8" align="center" justify="center" flexShrink={0}>
            <Text style={{ fontSize: "calc(var(--ph)*0.026)" }} fontWeight="900" color="#F7931A">₿</Text>
          </Flex>
          <VStack align="start" spacing={0} flex={1} minW={0}>
            <Text style={{ fontSize: fs.name }} color={APP.sheetFg} fontWeight="800">Bitcoin</Text>
            <HStack spacing="calc(var(--pw)*0.02)">
              <Text style={{ fontSize: fs.sub }} color={APP.sheetMuted} fontWeight="500">BTC · £77,612.62</Text>
              <Box bg={APP.sheetGreenBg} borderRadius="full" px="calc(var(--pw)*0.025)" py="calc(var(--ph)*0.002)">
                <Text style={{ fontSize: "calc(var(--ph)*0.013)" }} color={APP.sheetGreen} fontWeight="700">+0.08%</Text>
              </Box>
            </HStack>
          </VStack>
          <HStack spacing="calc(var(--pw)*0.01)" flexShrink={0}>
            <Text style={{ fontSize: fs.sub }} color={APP.sheetMuted} fontWeight="600">Change</Text>
            <Icon as={FiChevronDown} color={APP.sheetMuted}
              style={{ width: "calc(var(--ph)*0.018)", height: "calc(var(--ph)*0.018)" }} />
          </HStack>
        </HStack>

        {/* you pay */}
        <Text style={{ fontSize: fs.label }} color={APP.sheetMuted} fontWeight="800"
          letterSpacing="0.06em" pt="calc(var(--ph)*0.004)">YOU PAY</Text>
        <HStack bg={APP.sheetCard} border={`1px solid ${APP.sheetBorder}`} borderRadius={fs.card}
          px="calc(var(--ph)*0.018)" py="calc(var(--ph)*0.016)" spacing="calc(var(--pw)*0.02)">
          <Text style={{ fontSize: fs.big }} color={APP.sheetMuted} fontWeight="500">£</Text>
          <AnimatePresence mode="wait">
            <motion.span key={bi}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
              style={{ fontSize: fs.big, fontWeight: 800, color: APP.sheetFg }}>
              {step.amt}
            </motion.span>
          </AnimatePresence>
          <motion.div animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            style={{ width: "2px", height: fs.big, background: "#63a1db" }} />
        </HStack>

        {/* you receive */}
        <VStack align="stretch" spacing="calc(var(--ph)*0.008)" bg={APP.sheetCard}
          border={`1px solid ${APP.sheetBorder}`} borderRadius={fs.card}
          px="calc(var(--ph)*0.016)" py="calc(var(--ph)*0.014)">
          <HStack justify="space-between">
            <Text style={{ fontSize: fs.label }} color={APP.sheetMuted} fontWeight="800"
              letterSpacing="0.06em">YOU RECEIVE</Text>
            <HStack bg={APP.sheetChip} borderRadius="full" px="calc(var(--pw)*0.03)"
              py="calc(var(--ph)*0.003)" spacing="calc(var(--pw)*0.012)">
              <Icon as={FiClock} color={secs <= 10 ? "#ef4444" : APP.sheetMuted}
                style={{ width: "calc(var(--ph)*0.014)", height: "calc(var(--ph)*0.014)" }} />
              <Text style={{ fontSize: "calc(var(--ph)*0.013)" }}
                color={secs <= 10 ? "#ef4444" : APP.sheetMuted} fontWeight="700">{secs}s</Text>
            </HStack>
          </HStack>
          <HStack align="baseline" spacing="calc(var(--pw)*0.02)">
            <AnimatePresence mode="wait">
              <motion.span key={bi}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
                style={{ fontSize: "calc(var(--ph)*0.03)", fontWeight: 800, color: APP.sheetFg }}>
                {step.recv}
              </motion.span>
            </AnimatePresence>
            <Text style={{ fontSize: fs.body }} color="#F7931A" fontWeight="800">BTC</Text>
          </HStack>
          <Box h="1px" bg={APP.sheetBorder} />
          {[
            ["Platform fee (0.5%)", step.fee],
            ["Network fee", "10.00"],
            ["Exchange rate", "1 BTC = £78,021.22"],
          ].map(([k, v]) => (
            <HStack key={k} justify="space-between">
              <Text style={{ fontSize: fs.sub }} color={APP.sheetMuted} fontWeight="500">{k}</Text>
              <Text style={{ fontSize: fs.sub }} color={APP.sheetFg} fontWeight="600">{v}</Text>
            </HStack>
          ))}
          <HStack justify="space-between">
            <Text style={{ fontSize: fs.sub }} color={APP.sheetFg} fontWeight="800">Total you pay</Text>
            <Text style={{ fontSize: fs.sub }} color={APP.sheetFg} fontWeight="800">{step.total}</Text>
          </HStack>
        </VStack>

        {/* pay with */}
        <HStack bg={APP.sheetCard} border={`1px solid ${APP.sheetBorder}`}
          borderRadius="calc(var(--ph)*0.018)"
          px="calc(var(--ph)*0.016)" py="calc(var(--ph)*0.013)" justify="space-between">
          <Text style={{ fontSize: fs.sub }} color={APP.sheetMuted} fontWeight="600">Pay with</Text>
          <HStack spacing="calc(var(--pw)*0.015)">
            <Text style={{ fontSize: fs.sub }} color={APP.sheetFg} fontWeight="700">USDT · 7,797.00 USDT</Text>
            <Icon as={FiChevronRight} color={APP.sheetMuted}
              style={{ width: "calc(var(--ph)*0.016)", height: "calc(var(--ph)*0.016)" }} />
          </HStack>
        </HStack>

        {/* wallet / address toggle */}
        <HStack bg={APP.sheetChip} borderRadius="calc(var(--ph)*0.016)" p="calc(var(--ph)*0.004)" spacing={0}>
          <Flex flex={1} h="calc(var(--ph)*0.042)" borderRadius="calc(var(--ph)*0.013)"
            align="center" justify="center" bg={APP.ink}>
            <Text style={{ fontSize: fs.sub }} color={APP.inkFg} fontWeight="700">To my wallet</Text>
          </Flex>
          <Flex flex={1} h="calc(var(--ph)*0.042)" align="center" justify="center">
            <Text style={{ fontSize: fs.sub }} color={APP.sheetMuted} fontWeight="600">To address</Text>
          </Flex>
        </HStack>

        {/* CTA — slide to confirm */}
        <SlideCTA APP={APP} label="Slide to buy BTC" seconds={secs} />
      </VStack>
    </SheetScreen>
  );
});

/* ═════════════════════════════════════════════════════════════════
   ASSET DETAIL SCREEN — matches the redesigned in-app currency page
   ═════════════════════════════════════════════════════════════════ */
const ScreenAssetDetail = memo(function ScreenAssetDetail() {
  const APP = appTokens(usePhoneDark());
  const fs = {
    statusH: "calc(var(--ph) * 0.052)",
    px: "calc(var(--pw) * 0.065)",
    title: "calc(var(--ph) * 0.022)",
    price: "calc(var(--ph) * 0.056)",
    gain: "calc(var(--ph) * 0.021)",
    chartH: "calc(var(--ph) * 0.245)",
    name: "calc(var(--ph) * 0.022)",
    sub: "calc(var(--ph) * 0.016)",
    stat: "calc(var(--ph) * 0.013)",
    statVal: "calc(var(--ph) * 0.0145)",
    tab: "calc(var(--ph) * 0.015)",
    btn: "calc(var(--ph) * 0.052)",
  };
  const tabs = ["Activity", "News", "Discussions"];

  return (
    <VStack h="100%" w="100%" align="stretch" spacing={0} bg={APP.bg} overflow="hidden">
      <Box style={{ height: fs.statusH }} flexShrink={0} />

      <HStack px={fs.px} h="calc(var(--ph)*0.056)" align="center" justify="space-between" flexShrink={0}>
        <Icon as={FiChevronLeft} color={APP.fg} style={{ width: "calc(var(--ph)*0.026)", height: "calc(var(--ph)*0.026)" }} />
        <Text style={{ fontSize: fs.title }} color={APP.fg} fontWeight="900">Bitcoin</Text>
        <HStack spacing="calc(var(--pw)*0.018)">
          <Flex w="calc(var(--ph)*0.036)" h="calc(var(--ph)*0.036)" borderRadius="full" align="center" justify="center" bg={APP.surface}>
            <QrGlyph size="calc(var(--ph)*0.017)" color={APP.fg} />
          </Flex>
          <HStack p="calc(var(--ph)*0.003)" borderRadius="full" bg={APP.surface} border={`1px solid ${APP.border}`}>
            <Flex w="calc(var(--ph)*0.027)" h="calc(var(--ph)*0.027)" borderRadius="full" bg={APP.ink} align="center" justify="center">
              <Icon as={FiActivity} color={APP.inkFg} style={{ width: "calc(var(--ph)*0.014)", height: "calc(var(--ph)*0.014)" }} />
            </Flex>
            <Flex w="calc(var(--ph)*0.027)" h="calc(var(--ph)*0.027)" borderRadius="full" align="center" justify="center">
              <Icon as={FiBarChart2} color={APP.fgMuted} style={{ width: "calc(var(--ph)*0.014)", height: "calc(var(--ph)*0.014)" }} />
            </Flex>
          </HStack>
        </HStack>
      </HStack>

      <VStack align="center" spacing="calc(var(--ph)*0.006)" px={fs.px} pt="calc(var(--ph)*0.01)" flexShrink={0}>
        <Text style={{ fontSize: fs.price }} color={APP.fg} fontWeight="900" letterSpacing="-0.06em" lineHeight={1}>
          $107,612.62
        </Text>
        <HStack spacing="calc(var(--pw)*0.02)">
          <Text style={{ fontSize: fs.gain }} color={APP.green} fontWeight="900">↑ $2,406.22 (2.29%)</Text>
        </HStack>
      </VStack>

      <Box h={fs.chartH} w="100%" pt="calc(var(--ph)*0.018)" flexShrink={0}>
        <svg viewBox="0 0 320 160" width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="assetHeroLine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={APP.fg} stopOpacity="0.18" />
              <stop offset="100%" stopColor={APP.fg} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 118 C14 118 12 70 28 72 C42 74 38 98 54 88 C72 78 70 110 88 112 C105 114 104 92 120 98 C139 105 134 52 152 58 C170 64 165 82 184 76 C202 70 198 44 218 36 C236 28 232 15 250 24 C268 33 262 74 282 70 C300 66 300 86 320 76 L320 160 L0 160 Z"
            fill="url(#assetHeroLine)"
          />
          <path
            d="M0 118 C14 118 12 70 28 72 C42 74 38 98 54 88 C72 78 70 110 88 112 C105 114 104 92 120 98 C139 105 134 52 152 58 C170 64 165 82 184 76 C202 70 198 44 218 36 C236 28 232 15 250 24 C268 33 262 74 282 70 C300 66 300 86 320 76"
            stroke={APP.fg}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>

      <HStack px={fs.px} justify="space-between" flexShrink={0} pb="calc(var(--ph)*0.016)">
        {["1H", "24H", "7D", "30D", "1Y", "ALL"].map((r) => (
          <Flex key={r} minW="calc(var(--pw)*0.10)" h="calc(var(--ph)*0.032)" borderRadius="full"
            align="center" justify="center" bg={r === "24H" ? APP.ink : "transparent"}>
            <Text style={{ fontSize: fs.sub }} color={r === "24H" ? APP.inkFg : APP.fgMuted} fontWeight="900">{r}</Text>
          </Flex>
        ))}
      </HStack>

      <HStack px={fs.px} py="calc(var(--ph)*0.014)" spacing="calc(var(--pw)*0.04)" flexShrink={0}>
        <Flex style={{ width: "calc(var(--ph)*0.056)", height: "calc(var(--ph)*0.056)", borderRadius: "50%" }}
          align="center" justify="center" flexShrink={0}>
          <Text style={{ fontSize: "calc(var(--ph)*0.044)" }} fontWeight="900" color="#F7931A">₿</Text>
        </Flex>
        <VStack align="start" spacing={0} flex={1} minW={0}>
          <Text style={{ fontSize: fs.name }} color={APP.fg} fontWeight="900">Bitcoin</Text>
          <Text style={{ fontSize: fs.sub }} color={APP.fgMuted} fontWeight="600">BTC</Text>
        </VStack>
        <VStack align="end" spacing={0}>
          <Text style={{ fontSize: fs.name }} color={APP.fg} fontWeight="900">$238.37</Text>
          <Text style={{ fontSize: fs.sub }} color={APP.fgMuted} fontWeight="600">0.00306776 BTC</Text>
        </VStack>
      </HStack>

      <HStack mx={fs.px} py="calc(var(--ph)*0.012)" borderTop={`1px solid ${APP.border}`} borderBottom={`1px solid ${APP.border}`} flexShrink={0}>
        {[
          ["Market Cap", "$2.13T"],
          ["Volume", "$48.2B"],
          ["Supply", "19.8M"],
          ["ATH", "$111K"],
        ].map(([label, value], i) => (
          <VStack key={label} flex={1} align="start" spacing="calc(var(--ph)*0.004)"
            px="calc(var(--pw)*0.012)" borderRight={i === 3 ? "0" : `1px solid ${APP.border}`}>
            <Text style={{ fontSize: fs.stat }} color={APP.fgMuted} fontWeight="900" whiteSpace="nowrap">{label}</Text>
            <Text style={{ fontSize: fs.statVal }} color={APP.fg} fontWeight="900" whiteSpace="nowrap">{value}</Text>
          </VStack>
        ))}
      </HStack>

      <HStack mx={fs.px} mt="calc(var(--ph)*0.014)" p="calc(var(--ph)*0.004)" borderRadius="full" bg={APP.surface} flexShrink={0}>
        {tabs.map((tab, i) => (
          <Flex key={tab} flex={1} h="calc(var(--ph)*0.038)" borderRadius="full"
            align="center" justify="center" bg={i === 0 ? APP.ink : "transparent"}>
            <Text style={{ fontSize: fs.tab }} color={i === 0 ? APP.inkFg : APP.fgMuted} fontWeight="900">{tab}</Text>
          </Flex>
        ))}
      </HStack>

      <VStack flex={1} px={fs.px} pt="calc(var(--ph)*0.012)" spacing="calc(var(--ph)*0.01)" overflow="hidden">
        {[
          ["Buy BTC", "+0.0012 BTC", "Today"],
          ["Sell BTC", "-0.0004 BTC", "Yesterday"],
        ].map(([title, amt, time], i) => (
          <HStack key={title} w="100%" py="calc(var(--ph)*0.01)" borderBottom={`1px solid ${APP.border}`}>
            <Flex w="calc(var(--ph)*0.036)" h="calc(var(--ph)*0.036)" borderRadius="full" bg={i === 0 ? APP.sheetGreenBg : APP.redBg} align="center" justify="center">
              <Icon as={i === 0 ? FiArrowUp : FiArrowRight} color={i === 0 ? APP.green : APP.redFg} style={{ width: "calc(var(--ph)*0.016)", height: "calc(var(--ph)*0.016)" }} />
            </Flex>
            <VStack align="start" flex={1} spacing={0} pl="calc(var(--pw)*0.025)">
              <Text style={{ fontSize: fs.sub }} color={APP.fg} fontWeight="800">{title}</Text>
              <Text style={{ fontSize: fs.stat }} color={APP.fgMuted} fontWeight="600">{time}</Text>
            </VStack>
            <Text style={{ fontSize: fs.sub }} color={i === 0 ? APP.green : APP.redFg} fontWeight="900">{amt}</Text>
          </HStack>
        ))}
      </VStack>

      <HStack px={fs.px} py="calc(var(--ph)*0.014)" spacing="calc(var(--pw)*0.03)" flexShrink={0}>
        <Flex flex={1} h={fs.btn} borderRadius="full" bg={APP.surface} align="center" justify="center">
          <Text style={{ fontSize: fs.name }} color={APP.fg} fontWeight="900">Sell</Text>
        </Flex>
        <Flex flex={1} h={fs.btn} borderRadius="full" bg={APP.ink} align="center" justify="center">
          <Text style={{ fontSize: fs.name }} color={APP.inkFg} fontWeight="900">Buy</Text>
        </Flex>
      </HStack>
    </VStack>
  );
});

/* ═════════════════════════════════════════════════════════════════
   PAY WITH SCREEN — matches the in-app "Pay with" sheet
   ═════════════════════════════════════════════════════════════════ */
const ScreenPayWith = memo(function ScreenPayWith() {
  const APP = appTokens(usePhoneDark());
  const px = "calc(var(--pw)*0.07)";
  const fs = {
    name: "calc(var(--ph)*0.02)",
    sub:  "calc(var(--ph)*0.015)",
  };
  /* selection cycles between payment sources */
  const pageVisible = usePageVisible();
  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (!pageVisible) return;
    const id = setInterval(() => setSel((s) => (s + 1) % 4), 2000);
    return () => clearInterval(id);
  }, [pageVisible]);
  const opts = [
    { sym: "USDT", amt: "7,797.00 USDT", sub: "Crypto balance",
      iconBg: "#cdeede", glyph: <Text style={{ fontSize: "calc(var(--ph)*0.024)" }} fontWeight="900" color="#26A17B">₮</Text> },
    { sym: "USD", amt: "$991,357.00", sub: "Fiat wallet",
      iconBg: "#dfe6f5", glyph: <Text style={{ fontSize: "calc(var(--ph)*0.022)" }}>💵</Text> },
    { sym: "EUR", amt: "€8,797.00", sub: "Fiat wallet",
      iconBg: "#dfe6f5", glyph: <Text style={{ fontSize: "calc(var(--ph)*0.022)" }}>💵</Text> },
    { sym: "GBP", amt: "£8,797.00", sub: "Fiat wallet",
      iconBg: "#dfe6f5", glyph: <Text style={{ fontSize: "calc(var(--ph)*0.022)" }}>💵</Text> },
    { sym: "AED", amt: "8,797.00 د.إ", sub: "Fiat wallet",
      iconBg: "#dfe6f5", glyph: <Text style={{ fontSize: "calc(var(--ph)*0.022)" }}>💵</Text> },
  ];
  return (
    <SheetScreen title="Pay with" heightFrac={0.82}>
      <VStack align="stretch" spacing="calc(var(--ph)*0.012)" px={px} pt="calc(var(--ph)*0.004)">
        {opts.map((o, i) => {
          const selected = i === sel;
          return (
            <motion.div key={o.sym} animate={{ scale: selected ? 1 : 0.985 }}
              transition={{ duration: 0.25 }}>
              <HStack
                bg={selected ? APP.sheetGreenBg : APP.sheetCard}
                border={`1.5px solid ${selected ? APP.sheetGreenBd : APP.sheetBorder}`}
                borderRadius="calc(var(--ph)*0.02)"
                px="calc(var(--ph)*0.014)" py="calc(var(--ph)*0.014)"
                spacing="calc(var(--pw)*0.04)">
                <Flex style={{ width: "calc(var(--ph)*0.05)", height: "calc(var(--ph)*0.05)", borderRadius: "50%" }}
                  bg={o.iconBg} align="center" justify="center" flexShrink={0}>
                  {o.glyph}
                </Flex>
                <VStack align="start" spacing={0} flex={1} minW={0}>
                  <Text style={{ fontSize: fs.name }} color={APP.sheetFg} fontWeight="800">
                    {o.sym} · {o.amt}
                  </Text>
                  <Text style={{ fontSize: fs.sub }} color={APP.sheetMuted} fontWeight="500">{o.sub}</Text>
                </VStack>
                {selected && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}>
                    <Flex style={{ width: "calc(var(--ph)*0.032)", height: "calc(var(--ph)*0.032)", borderRadius: "50%" }}
                      bg={APP.sheetGreen} align="center" justify="center" flexShrink={0}>
                      <Icon as={FiCheck} color="#fff"
                        style={{ width: "calc(var(--ph)*0.02)", height: "calc(var(--ph)*0.02)" }} />
                    </Flex>
                  </motion.div>
                )}
              </HStack>
            </motion.div>
          );
        })}
      </VStack>
    </SheetScreen>
  );
});

/* ═════════════════════════════════════════════════════════════════
   STATIC PHONE  (feature sections)
   ═════════════════════════════════════════════════════════════════ */
function StaticPhone({
  children,
  phOverride,
}: {
  children: React.ReactNode;
  /** Phone height. A plain string sets `--ph` inline; a responsive object
   *  (e.g. `{ base: "40vh", md: "64vh" }`) goes through Chakra's `sx` so the
   *  film chapters can run a big phone on desktop and a smaller one that
   *  still fits inside a 100vh stage on a handset. */
  phOverride?: string | Partial<Record<string, string>>;
}) {
  const dark = usePhoneDark();
  const responsive = phOverride !== undefined && typeof phOverride !== "string";
  // An inline style always beats a generated class, so when the caller wants a
  // RESPONSIVE height `--ph` must be left OUT of the inline vars entirely —
  // otherwise the sx breakpoints below are silently dead.
  const { ["--ph" as string]: defaultPh, ...varsNoPh } = phoneVars as Record<string, string>;
  const baseVars = responsive ? varsNoPh : { ...varsNoPh, "--ph": (phOverride as string) ?? defaultPh };

  return (
    <Box
      position="relative"
      style={{ ...baseVars, width: "var(--pw)", height: "var(--ph)" } as React.CSSProperties}
      sx={responsive ? { "--ph": phOverride } : undefined}
      mx="auto"
    >
      <Box
        position="absolute"
        style={screenInset as React.CSSProperties}
        overflow="hidden"
        bg={dark ? "#000000" : "#ffffff"}
        boxShadow={dark
          ? "inset 0 0 0 1px rgba(255,255,255,0.04)"
          : "inset 0 0 0 1px rgba(0,0,0,0.04)"}
      >
        {children}
      </Box>
      <NextImage
        src="/iphone-frame.png"
        alt=""
        fill
        loading="lazy"
        sizes="(max-width: 480px) 46vw, (max-width: 768px) 38vw, (max-width: 1024px) 28vw, 340px"
        style={{ objectFit: "contain", pointerEvents: "none", zIndex: 10 }}
      />
    </Box>
  );
}

/* ═════════════════════════════════════════════════════════════════
   CHAT THREAD SCREEN — animated, loops like a live conversation
   ═════════════════════════════════════════════════════════════════ */
type ChatItem =
  | { type: "day"; text: string; delay: number }
  | { type: "in" | "out"; text: string; time: string; delay: number }
  | { type: "emoji"; side: "in" | "out"; text: string; delay: number }
  | { type: "card"; big: string; unit: string; sub: string; ref: string; time: string; delay: number }
  | { type: "typing"; delay: number };

const CHAT_TIMELINE: ChatItem[] = [
  { type: "day", text: "FRI, MAY 15", delay: 700 },
  { type: "in", text: "Hi", time: "11:57 PM", delay: 1100 },
  { type: "out", text: "hey", time: "11:57 PM", delay: 900 },
  { type: "emoji", side: "out", text: "🔥", delay: 850 },
  { type: "emoji", side: "in", text: "❤️", delay: 950 },
  { type: "card", big: "250", unit: "USDT", sub: "250 USDT", ref: "TRF-C21F2CA1", time: "11:58 PM", delay: 1500 },
  { type: "day", text: "SAT, MAY 16", delay: 1000 },
  { type: "in", text: "Pleasure trading with you 🙏", time: "12:03 AM", delay: 1300 },
  { type: "card", big: "2,500", unit: "USD", sub: "2,500 USD", ref: "TRF-022ACF5A", time: "12:04 AM", delay: 1700 },
  { type: "typing", delay: 2600 },
];

const ScreenChat = memo(function ScreenChat() {
  const dark = usePhoneDark();
  const c = dark
    ? { bg: "#0e0e10", headerBg: "#161618", surface: "#1f1f23",
        border: "rgba(255,255,255,0.07)", fg: "#ffffff", muted: "#8a8a92", faint: "#5b5b63" }
    : { bg: "#ffffff", headerBg: "#f6f6f7", surface: "#f0f0f2",
        border: "rgba(0,0,0,0.07)", fg: "#15140f", muted: "#8b897e", faint: "#b6b4a8" };
  const accent = "#63a1db";
  const green = "#3ecf6e";

  const fs = {
    px:     "calc(var(--pw) * 0.07)",
    statusH:"calc(var(--ph) * 0.05)",
    name:   "calc(var(--ph) * 0.02)",
    sub:    "calc(var(--ph) * 0.0145)",
    bubble: "calc(var(--ph) * 0.018)",
    time:   "calc(var(--ph) * 0.012)",
    chip:   "calc(var(--ph) * 0.012)",
    emoji:  "calc(var(--ph) * 0.05)",
    avatar: "calc(var(--ph) * 0.044)",
    hdrBtn: "calc(var(--ph) * 0.042)",
  };

  /* sequential reveal loop */
  const [n, setN] = useState(0);
  useEffect(() => {
    const atEnd = n >= CHAT_TIMELINE.length;
    const delay = atEnd ? 2800 : CHAT_TIMELINE[n].delay;
    const id = setTimeout(() => setN(atEnd ? 0 : n + 1), delay);
    return () => clearTimeout(id);
  }, [n]);

  /* live-typing composer */
  const PHRASE = "Sending the rest now";
  const [ti, setTi] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setTi((t) => (t > PHRASE.length + 10 ? 0 : t + 1)), 150);
    return () => clearTimeout(id);
  }, [ti]);
  const typed = PHRASE.slice(0, Math.min(ti, PHRASE.length));

  const reveal = {
    initial: { opacity: 0, y: 14, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  };

  return (
    <VStack h="100%" w="100%" align="stretch" spacing={0} bg={c.bg} overflow="hidden">
      <Box style={{ height: fs.statusH }} bg={c.headerBg} flexShrink={0} />

      {/* Header */}
      <HStack px={fs.px} pb="calc(var(--ph)*0.014)" justify="space-between"
        bg={c.headerBg} borderBottom={`1px solid ${c.border}`} flexShrink={0}>
        <Flex style={{ width: fs.hdrBtn, height: fs.hdrBtn, borderRadius: "50%" }}
          bg={c.surface} align="center" justify="center" flexShrink={0}>
          <Icon as={FiChevronLeft} color={c.fg}
            style={{ width: "calc(var(--ph)*0.02)", height: "calc(var(--ph)*0.02)" }} />
        </Flex>
        <HStack spacing="calc(var(--pw)*0.03)" flex={1} px="calc(var(--pw)*0.04)">
          <Flex style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%" }}
            bg="#232327" align="center" justify="center" flexShrink={0}>
            <Text style={{ fontSize: "calc(var(--ph)*0.022)" }}>♾️</Text>
          </Flex>
          <VStack align="start" spacing={0}>
            <Text style={{ fontSize: fs.name }} color={c.fg} fontWeight="800">Jack Green</Text>
            <Text style={{ fontSize: fs.sub }} color={c.muted} fontWeight="500">@jack.green</Text>
          </VStack>
        </HStack>
        <Flex style={{ width: fs.hdrBtn, height: fs.hdrBtn, borderRadius: "50%" }}
          bg={c.surface} align="center" justify="center" flexShrink={0}>
          <Icon as={FiMoreHorizontal} color={c.fg}
            style={{ width: "calc(var(--ph)*0.02)", height: "calc(var(--ph)*0.02)" }} />
        </Flex>
      </HStack>

      {/* Thread */}
      <VStack flex={1} px={fs.px} py="calc(var(--ph)*0.016)" spacing="calc(var(--ph)*0.011)"
        align="stretch" justify="flex-end" overflow="hidden">
        <AnimatePresence initial={false}>
          {CHAT_TIMELINE.slice(0, n).map((it, i) => {
            if (it.type === "day") {
              return (
                <motion.div key={i} {...reveal} layout style={{ alignSelf: "center" }}>
                  <Box bg={c.surface} border={`1px solid ${c.border}`} borderRadius="full"
                    px="calc(var(--ph)*0.014)" py="calc(var(--ph)*0.005)">
                    <Text style={{ fontSize: fs.chip }} color={c.muted}
                      fontWeight="800" letterSpacing="0.06em">{it.text}</Text>
                  </Box>
                </motion.div>
              );
            }
            if (it.type === "emoji") {
              return (
                <motion.div key={i} {...reveal} layout
                  style={{ alignSelf: it.side === "out" ? "flex-end" : "flex-start" }}>
                  <Text style={{ fontSize: fs.emoji, lineHeight: 1 }}>{it.text}</Text>
                </motion.div>
              );
            }
            if (it.type === "typing") {
              return (
                <motion.div key={i} {...reveal} layout style={{ alignSelf: "flex-start" }}>
                  <HStack bg={c.surface} border={`1px solid ${c.border}`}
                    borderRadius="calc(var(--ph)*0.022)" borderBottomLeftRadius="calc(var(--ph)*0.006)"
                    px="calc(var(--ph)*0.016)" py="calc(var(--ph)*0.013)" spacing="calc(var(--pw)*0.02)">
                    {[0, 1, 2].map((d) => (
                      <motion.div key={d}
                        animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.18 }}
                        style={{ width: "calc(var(--ph)*0.008)", height: "calc(var(--ph)*0.008)",
                          borderRadius: "50%", background: c.muted }} />
                    ))}
                  </HStack>
                </motion.div>
              );
            }
            if (it.type === "card") {
              return (
                <motion.div key={i} {...reveal} layout style={{ alignSelf: "flex-start", width: "78%" }}>
                  <VStack bg={c.surface} border={`1px solid ${c.border}`}
                    borderRadius="calc(var(--ph)*0.022)" align="stretch" spacing="calc(var(--ph)*0.012)"
                    p="calc(var(--ph)*0.016)">
                    <HStack spacing="calc(var(--pw)*0.05)">
                      <Flex style={{ width: "calc(var(--ph)*0.066)", height: "calc(var(--ph)*0.066)",
                          borderRadius: "50%" }}
                        border={`calc(var(--ph)*0.004) solid ${green}`}
                        bg={dark ? "rgba(62,207,110,0.12)" : "rgba(62,207,110,0.14)"}
                        align="center" justify="center" flexShrink={0}>
                        <Icon as={FiCheck} color={green}
                          style={{ width: "calc(var(--ph)*0.03)", height: "calc(var(--ph)*0.03)" }} />
                      </Flex>
                      <VStack align="start" spacing="calc(var(--ph)*0.002)">
                        <Text style={{ fontSize: fs.chip }} color={c.muted}
                          fontWeight="800" letterSpacing="0.06em">YOU RECEIVED</Text>
                        <HStack align="baseline" spacing="calc(var(--pw)*0.015)">
                          <Text style={{ fontSize: "calc(var(--ph)*0.03)" }} color={c.fg} fontWeight="800">{it.big}</Text>
                          <Text style={{ fontSize: fs.sub }} color={c.muted} fontWeight="700">{it.unit}</Text>
                        </HStack>
                      </VStack>
                    </HStack>
                    <Text style={{ fontSize: fs.bubble }} color={c.fg} fontWeight="700">{it.sub}</Text>
                    <Box h="1px" bg={c.border} />
                    <HStack justify="space-between">
                      <HStack spacing="calc(var(--pw)*0.02)">
                        <Box w="calc(var(--ph)*0.008)" h="calc(var(--ph)*0.008)"
                          borderRadius="50%" bg={green} />
                        <Text style={{ fontSize: fs.time }} color={c.faint}
                          fontWeight="700" letterSpacing="0.04em">{it.ref}</Text>
                      </HStack>
                      <Text style={{ fontSize: fs.time }} color={c.faint}>{it.time}</Text>
                    </HStack>
                  </VStack>
                </motion.div>
              );
            }
            return (
              <motion.div key={i} {...reveal} layout
                style={{ alignSelf: it.type === "out" ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                <VStack align={it.type === "out" ? "flex-end" : "flex-start"} spacing="calc(var(--ph)*0.003)">
                  <Box
                    bg={it.type === "out" ? accent : c.surface}
                    border={it.type === "in" ? `1px solid ${c.border}` : "none"}
                    borderRadius="calc(var(--ph)*0.022)"
                    borderBottomRightRadius={it.type === "out" ? "calc(var(--ph)*0.006)" : undefined}
                    borderBottomLeftRadius={it.type === "in" ? "calc(var(--ph)*0.006)" : undefined}
                    px="calc(var(--ph)*0.016)" py="calc(var(--ph)*0.011)"
                  >
                    <Text style={{ fontSize: fs.bubble }}
                      color={it.type === "out" ? "#fff" : c.fg} fontWeight="500" lineHeight={1.35}>
                      {it.text}
                    </Text>
                  </Box>
                  <Text style={{ fontSize: fs.time }} color={c.faint} px="calc(var(--ph)*0.004)">{it.time}</Text>
                </VStack>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </VStack>

      {/* Composer with live typing */}
      <HStack px={fs.px} py="calc(var(--ph)*0.012)" spacing="calc(var(--pw)*0.03)" align="center"
        borderTop={`1px solid ${c.border}`} bg={c.bg} flexShrink={0}>
        <Icon as={FiDollarSign} color={c.muted}
          style={{ width: "calc(var(--ph)*0.022)", height: "calc(var(--ph)*0.022)" }} />
        <Icon as={FiSmile} color={c.muted}
          style={{ width: "calc(var(--ph)*0.022)", height: "calc(var(--ph)*0.022)" }} />
        <HStack flex={1} bg={c.surface} border={`1px solid ${c.border}`} borderRadius="full"
          px="calc(var(--ph)*0.016)" py="calc(var(--ph)*0.011)" spacing={0}>
          <Text style={{ fontSize: fs.bubble }} color={typed ? c.fg : c.faint} fontWeight="500">
            {typed || "Message"}
          </Text>
          <motion.div animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ width: "1.5px", height: "calc(var(--ph)*0.02)", background: accent,
              marginLeft: "2px" }} />
        </HStack>
        <Flex style={{ width: "calc(var(--ph)*0.044)", height: "calc(var(--ph)*0.044)", borderRadius: "50%" }}
          bg={accent} align="center" justify="center" flexShrink={0}>
          <Icon as={FiArrowUp} color="#fff"
            style={{ width: "calc(var(--ph)*0.022)", height: "calc(var(--ph)*0.022)" }} />
        </Flex>
      </HStack>
    </VStack>
  );
});

/* ═════════════════════════════════════════════════════════════════
   LAZY BACKGROUND VIDEO
   ═════════════════════════════════════════════════════════════════ */
function LazyBackgroundVideo({
  src, opacity = 1, objectFit = "cover", filter,
}: {
  src: string; opacity?: number; objectFit?: "cover" | "contain"; filter?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { el.play().catch(() => {}); return; }
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) e.isIntersecting ? el.play().catch(() => {}) : el.pause(); },
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <video ref={ref} src={src} loop muted playsInline preload="none"
      style={{ width: "100%", height: "100%", objectFit, opacity, filter: filter ?? (opacity < 1 ? "saturate(0) blur(0.5px)" : undefined) }}
    />
  );
}

/* ═════════════════════════════════════════════════════════════════
   LIVE TX FEED — monochrome
   ═════════════════════════════════════════════════════════════════ */
const TX_POOL = [
  { name: "@george_saad",  icon: "🌙" }, { name: "@aesha.ali", icon: "⚡" },
  { name: "@carolina",  icon: "💫" }, { name: "@sam.veil",   icon: "💎" },
  { name: "@sarah_44",  icon: "🔥" }, { name: "@omar.sherif",  icon: "🚀" },
  { name: "@kylie.white",  icon: "✨" }, { name: "@keiran_ollie",  icon: "🌐" },
];

function LiveTxFeed() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const [txns, setTxns] = useState([
    { id: 1, name: "@moe.ali",       amt: "+$1,114.20",  positive: true,  icon: "⚡", ts: "just now" },
    { id: 2, name: "@rayray", amt: "+$40,141.28", positive: true,  icon: "🌍", ts: "2s ago" },
    { id: 3, name: "@selma123",       amt: "-$11.44",     positive: false, icon: "💸", ts: "5s ago" },
    { id: 4, name: "@yourfav",       amt: "+$280.00",    positive: true,  icon: "🌙", ts: "8s ago" },
  ]);
  const nextId = useRef(10);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let visible = false;
    const tick = () => {
      if (document.hidden) return;
      const p = TX_POOL[Math.floor(Math.random() * TX_POOL.length)];
      const up = Math.random() > 0.3;
      const val = (Math.random() * 900 + 11).toFixed(2);
      setTxns(prev => [{
        id: nextId.current++, name: p.name,
        amt: `${up ? "+" : "-"}$${val}`,
        positive: up, icon: p.icon, ts: "just now",
      }, ...prev].slice(0, 6));
    };
    const start = () => { if (interval) return; interval = setInterval(tick, 3000); };
    const stop  = () => { if (interval) { clearInterval(interval); interval = null; } };
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { start(); return stop; }
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) { visible = e.isIntersecting; visible && !document.hidden ? start() : stop(); } },
      { threshold: 0.1 }
    );
    io.observe(el);
    const onVis = () => { document.hidden ? stop() : visible && start(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); stop(); };
  }, []);

  return (
    <VStack ref={containerRef} align="stretch" spacing={3}
      w={{ base: "100%", lg: "300px" }} maxW={{ base: "100%", lg: "300px" }}
      mx={{ base: "auto", lg: 0 }}
    >
      <VStack align="stretch" spacing={2} position="relative">
        <AnimatePresence initial={false}>
          {txns.slice(0, 5).map((tx, i) => (
            <Box key={tx.id} display={i >= 2 ? { base: "none", lg: "block" } : "block"}>
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.93 }}
                animate={{ opacity: 1 - i * 0.18, y: 0, scale: 1 - i * 0.015 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                layout
              >
                <HStack
                  bg={i === 0
                    ? (dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)")
                    : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")}
                  border="1px solid"
                  borderColor={i === 0
                    ? (dark ? "rgba(99,161,219,0.35)" : "rgba(99,161,219,0.3)")
                    : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}
                  borderRadius="14px" px={{ base: 3, lg: 4 }} py={{ base: 2.5, lg: 3 }} spacing={3}
                  boxShadow={i === 0 ? (dark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 8px 24px rgba(0,0,0,0.08)") : "none"}
                >
                  <Flex w={{ base: "30px", lg: "36px" }} h={{ base: "30px", lg: "36px" }}
                    borderRadius="full"
                    bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
                    align="center" justify="center" flexShrink={0}
                    fontSize={{ base: "13px", lg: "16px" }}
                  >
                    {tx.icon}
                  </Flex>
                  <VStack align="start" spacing={0} flex={1} minW={0}>
                    <Text
                      fontSize={{ base: "12px", lg: "13px" }}
                      fontWeight="700"
                      color={dark ? "white" : "#0a0f1e"}
                      isTruncated w="100%"
                    >
                      {tx.name}
                    </Text>
                    <Text fontSize={{ base: "9px", lg: "10px" }} fontWeight="500" opacity={0.5}
                      color={dark ? "white" : "#0a0f1e"}
                    >
                      {tx.ts}
                    </Text>
                  </VStack>
                  <Text fontSize={{ base: "12px", lg: "14px" }}
                    color={tx.positive
                      ? (dark ? "white" : "#000000")
                      : (dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)")}
                    fontWeight="800" fontFamily="monospace" flexShrink={0}
                  >
                    {tx.amt}
                  </Text>
                </HStack>
              </motion.div>
            </Box>
          ))}
        </AnimatePresence>
      </VStack>
    </VStack>
  );
}

/* ═════════════════════════════════════════════════════════════════
   SECTION COMPONENTS — monochrome palette
   ═════════════════════════════════════════════════════════════════ */

function SectionSocialFinance() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const cardBg   = dark ? "#242933" : "#FFFFFF";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const chipBg   = dark ? "#1B2028" : "#F3F5F8";

  return (
    <Box position="relative" py={{ base: 16, md: 24 }} px={{ base: 4, md: 10 }} overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={2}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
          <Flex justify="center" order={{ base: 2, lg: 2 }}>
            <motion.div
              initial={{ opacity: 0, y: 48, scale: 0.93 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <StaticPhone phOverride="clamp(320px, 42vh, 640px)">
                <ScreenChatShot />
              </StaticPhone>
            </motion.div>
          </Flex>
          <motion.div
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <VStack align={{ base: "center", lg: "start" }} spacing={{ base: 6, md: 8 }} order={{ base: 1, lg: 1 }} textAlign={{ base: "center", lg: "start" }}>
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "40px", md: "64px", xl: "80px" }} letterSpacing="-0.04em">
                <Box as="span" color={textMain}>{t("sec_social_title_1")}</Box>
                <br />
                <Box as="span" color="#63a1db">{t("sec_social_title_2")}</Box>
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">{t("sec_social_desc")}</Text>
              <Box w="100%" maxW="460px" bg={cardBg} border="1px solid" borderColor={cardBorder}
                boxShadow={dark ? "0 20px 50px rgba(0,0,0,0.3)" : "0 20px 50px rgba(0,0,0,0.07)"}
                borderRadius="24px" p={6}
              >
                <HStack align="baseline" spacing={2} mb={4}>
                  <Text fontSize="13px" color={textSub} fontWeight="700" letterSpacing="0.12em">LYD</Text>
                  <Heading color={textMain} fontSize={{ base: "36px", md: "44px" }} fontWeight="800" letterSpacing="-0.03em" fontFamily="'DM Sans', sans-serif">50.00</Heading>
                </HStack>
                <HStack bg={chipBg} border="1px solid" borderColor={cardBorder} borderRadius="full" px={4} py={2} spacing={2}>
                  <Text fontSize="13px" color={textSub} flex={1}>{t("sec_social_add_note")}</Text>
                  <Flex w="30px" h="30px" borderRadius="full" bg={dark ? "white" : "#0a0f1e"} color={dark ? "black" : "white"} align="center" justify="center">
                    <Icon as={FiSend} />
                  </Flex>
                </HStack>
              </Box>
            </VStack>
          </motion.div>
        </SimpleGrid>
      </Container>
    </Box>
  );
}


/* (SectionBento removed — the old stat-grid bento was replaced by the
   restrained bento inside <AppleShowcase />.) */

function SectionOnRamp() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.5)" : "#64748b";
  const cardBg = dark ? "#222730" : "#FFFFFF";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const methods: { label: string; icon?: React.ElementType; iconSize?: number; showLabel?: boolean; color: string; gradient?: [string, string] }[] = [
    { label: "Apple Pay",  icon: FaApplePay,     iconSize: 36, color: "#000000" },
    { label: "Google Pay", icon: FaGooglePay,    iconSize: 34, color: "#4285F4" },
    { label: "Visa",       icon: FaCcVisa,       iconSize: 30, color: "#1A1F71" },
    { label: "Mastercard", icon: FaCcMastercard, iconSize: 30, color: "#F79E1B", gradient: ["#EB001B", "#F79E1B"] },
    { label: "Revolut",    icon: SiRevolut,      iconSize: 22, showLabel: true, color: "#0075EB" },
  ];
  const cards = [
    { title: t("onramp_buy_title"), desc: t("onramp_buy_desc"), video: "/videos/Consumer_UIAnims_Desktop-Buy.mp4" },
    { title: t("onramp_sell_title"), desc: t("onramp_sell_desc"), video: "/videos/Consumer_UIAnims_Desktop-Sell.mp4" },
    { title: t("onramp_send_title"), desc: t("onramp_send_desc"), video: "/videos/Consumer_UIAnims_Desktop-SendReceive.mp4" },
  ];
  return (
    <Box py={{ base: 20, md: 28 }} px={{ base: 4, md: 10 }} position="relative" overflow="hidden">
      {/* Ambient background glow */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", top: "30%", left: "50%", width: 900, height: 400,
          transform: "translate(-50%,-50%)", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(99,161,219,0.06) 0%, transparent 70%)",
          pointerEvents: "none" }}
      />
      <Container maxW="1200px" position="relative" zIndex={1}>
        <VStack spacing={{ base: 14, md: 20 }} align="center" textAlign="center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <VStack spacing={5}>
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800"
                fontSize={{ base: "36px", md: "52px", lg: "64px" }}
                letterSpacing="-0.04em" color={textMain} lineHeight={isAr ? 1.2 : 1.05} maxW="720px"
              >
                <EmphText text={t("onramp_headline")} />
              </Heading>
              {/* Payment method pills */}
              <Flex gap={{ base: 2, md: 3 }} flexWrap="wrap" justify="center" maxW="700px" pt={2}>
                {methods.map((m, i) => (
                  <motion.div key={m.label}
                    initial={{ opacity: 0, scale: 0.88, y: 8 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.1 + 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -3, scale: 1.04 }}
                  >
                    <HStack spacing={2} px={{ base: 3, md: 4 }} h={{ base: "36px", md: "40px" }} borderRadius="full"
                      style={m.gradient ? {
                        background: `linear-gradient(135deg, ${m.gradient[0]}${dark ? "38" : "22"}, ${m.gradient[1]}${dark ? "38" : "22"})`,
                      } : undefined}
                      bg={m.gradient ? undefined : (dark ? `${m.color}28` : `${m.color}18`)}
                      color={dark && m.color === "#000000" ? "white" : m.color}
                      border="1px solid" borderColor={m.gradient ? (dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)") : (dark ? `${m.color}55` : `${m.color}40`)}
                      boxShadow={dark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.04)"}
                      transition="all 0.2s ease"
                      _hover={{ borderColor: m.gradient ? (dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)") : (dark ? `${m.color}85` : `${m.color}65`),
                        boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.08)" }}
                    >
                      {m.icon && <Icon as={m.icon} boxSize={`${m.iconSize ?? 24}px`} />}
                      {(m.showLabel || !m.icon) && <Text fontSize={{ base: "12px", md: "13px" }} fontWeight="900">{m.label}</Text>}
                    </HStack>
                  </motion.div>
                ))}
              </Flex>
            </VStack>
          </motion.div>

          {/* Cards */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 4, md: 5 }} w="100%">
            {cards.map((c, i) => (
              <motion.div key={c.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.65, delay: 0.1 + i * 0.14, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
              >
                <Box
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius={{ base: "24px", md: "28px" }} overflow="hidden"
                  transition="box-shadow 0.35s ease"
                  _hover={{ boxShadow: dark ? "0 28px 70px rgba(0,0,0,0.5)" : "0 28px 70px rgba(0,0,0,0.10)" }}
                >
                  <Box position="relative" w="100%" style={{ aspectRatio: "4 / 3" }} overflow="hidden">
                    {/* Subtle brand glow behind the video */}
                    <Box position="absolute" inset={0} zIndex={0} pointerEvents="none"
                      style={{
                        background: dark
                          ? "radial-gradient(circle at 50% 60%, rgba(99,161,219,0.12) 0%, transparent 70%)"
                          : "radial-gradient(circle at 50% 60%, rgba(99,161,219,0.08) 0%, transparent 70%)",
                      }}
                    />
                    <Box position="relative" zIndex={1} w="100%" h="100%">
                      <LazyBackgroundVideo src={c.video} objectFit="cover" />
                    </Box>
                    {/* Fade bottom of video into card */}
                    <Box position="absolute" bottom={0} left={0} right={0} h="60px" zIndex={2}
                      bgGradient={dark ? "linear(to-t, rgba(20,20,20,1), transparent)" : "linear(to-t, rgba(248,248,248,1), transparent)"}
                    />
                  </Box>
                  <VStack p={{ base: 5, md: 7 }} align="center" spacing={2}>
                    <Heading fontSize={{ base: "18px", md: "20px" }} fontWeight="800" color={textMain} fontFamily="'DM Sans', sans-serif">{c.title}</Heading>
                    <Text fontSize={{ base: "13.5px", md: "14.5px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.6}>{c.desc}</Text>
                  </VStack>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}

/* SectionBand — wraps a landing section to give it a distinct background
   "chapter" feel. `tone="tint"` gets a faint surface + a soft brand-accent
   corner glow; `tone="plain"` stays on the page bg. A hairline top rule
   separates bands. Purely additive — the section's own layout is untouched. */
function SectionBand({ children, dark, tone, size, bleed = false }: {
  children: React.ReactNode;
  dark: boolean;
  tone: "tint" | "plain";
  size: string;
  bleed?: boolean;
}) {
  const tint = tone === "tint";
  const sectionBg = tint
    ? (dark ? "#1B1F25" : "#F5F7FA")
    : (dark ? "#16181C" : "#FFFFFF");

  return (
    <Box
      position="relative"
      zIndex={bleed ? 4 : 0}
      overflow={bleed ? "visible" : undefined}
      borderTop="1px solid"
      borderColor={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.045)"}
      bg={sectionBg}
      // contentVisibility defers offscreen paint for perf. No CSS scroll-snap
      // here — native momentum scrolling is smoother and reveals are driven by
      // framer-motion as each band enters the viewport.
      style={bleed ? undefined : ({ contentVisibility: "auto", containIntrinsicSize: size } as React.CSSProperties)}
    >
      {/* Whole-band scroll reveal — a gentle fade + rise as each chapter
          enters the viewport, layered over the sections' own inner motion. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: "relative", zIndex: 1 }}
      >
        {children}
      </motion.div>
    </Box>
  );
}

/* EmphText — renders a translated string where the word(s) wrapped in
   *asterisks* become italic emphasis IN THE BRAND ACCENT. Keeps emphasis
   i18n-aware: each locale marks its own word. e.g. "Invest on *autopilot*." */
function EmphText({ text }: { text: string }) {
  const { colorMode } = useColorMode();
  // Accent the emphasised words — lifted a touch in dark mode for contrast.
  const accent = colorMode === "dark" ? "#7DB4E4" : "#3E78AE";
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") ? (
          <Box as="span" key={i} fontStyle="italic" fontWeight="600" color={accent}>
            {p.slice(1, -1)}
          </Box>
        ) : (
          <Box as="span" key={i}>{p}</Box>
        )
      )}
    </>
  );
}

/* Viewport-driven fade — text appears / disappears as the element enters
   or leaves the viewport. Uses IntersectionObserver (via whileInView)
   instead of scroll listeners for much lower runtime cost. */
function ScrollFade({ children, range = 0.5 }: { children: React.ReactNode; range?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 * range }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   CLAIMLINK — send crypto to anyone with a link. Monochrome, Apple-grade:
   restrained type, scroll-driven fades, italic display line, one hero
   interaction (a link "packet" gliding sender → recipient).
   ═════════════════════════════════════════════════════════════════ */
function SectionClaimLink() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "#f5f5f7" : "#1d1d1f";
  const textSub = dark ? "rgba(245,245,247,0.60)" : "rgba(29,29,31,0.58)";

  const steps = [
    { icon: FiLink,  title: t("cl_s1_title"), desc: t("cl_s1_desc") },
    { icon: FiSend,  title: t("cl_s2_title"), desc: t("cl_s2_desc") },
    { icon: FiCheck, title: t("cl_s3_title"), desc: t("cl_s3_desc") },
  ];

  return (
    <Box py={{ base: 32, md: 48 }} px={{ base: 5, md: 10 }} position="relative" overflow="hidden">
      {/* Monochrome ambient grid — subtle, no colour */}
      <Box position="absolute" inset={0} pointerEvents="none" opacity={dark ? 0.4 : 0.28}
        style={{
          backgroundImage: dark
            ? "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)"
            : "linear-gradient(rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.045) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "radial-gradient(ellipse 75% 55% at 50% 38%, #000 28%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 55% at 50% 38%, #000 28%, transparent 72%)",
        }}
      />

      <Container maxW="1080px" position="relative" zIndex={1}>
        <VStack spacing={{ base: 16, md: 24 }} align="center" textAlign="center">
          <ScrollFade>
            <VStack spacing={6}>
              {/* Display line — one word set in italic, editorial register */}
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="700"
                fontSize={{ base: "42px", md: "68px", lg: "82px" }}
                letterSpacing="-0.045em" color={textMain} lineHeight={isAr ? 1.15 : 1.0} maxW="900px"
              >
                <EmphText text={t("cl_title")} />
              </Heading>
              <Text fontSize={{ base: "17px", md: "21px" }} color={textSub} maxW="600px" lineHeight={isAr ? 1.75 : 1.5} fontWeight="400">
                {t("cl_sub")}
              </Text>
            </VStack>
          </ScrollFade>

          {/* ── Centerpiece — a real claim-link object on a clean stage ──
              A glassy, shareable link card lifts in; a subtle pulse ring
              and a single travelling spark read as "money in motion."
              No explainer boxes — the artifact itself does the talking. */}
          <ClaimLinkStage dark={dark} textMain={textMain} textSub={textSub}
            youLabel={t("cl_node_you")} claimedLabel={t("cl_node_claimed")}
            amountLabel={t("cl_card_amount")} statusLabel={t("cl_card_status")} />

          {/* Steps as an understated inline numbered line — editorial, not boxed */}
          <ScrollFade>
            <Flex direction={{ base: "column", md: "row" }} gap={{ base: 8, md: 0 }}
              w="100%" maxW="940px" justify="space-between"
            >
              {steps.map((s, i) => (
                <HStack key={i} align="start" spacing={4} flex={1}
                  px={{ base: 0, md: 6 }}
                  borderLeft={{ base: "none", md: i === 0 ? "none" : "1px solid" }}
                  borderColor={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}
                >
                  <Text fontFamily="'DM Sans', sans-serif" fontWeight="700" fontStyle="italic"
                    fontSize={{ base: "22px", md: "24px" }} color={textSub} lineHeight={isAr ? 1.4 : 1} mt="2px" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    0{i + 1}
                  </Text>
                  <VStack align="start" spacing={1.5} textAlign="left">
                    <Text fontWeight="600" fontSize={{ base: "16px", md: "17px" }} color={textMain} letterSpacing="-0.01em">
                      {s.title}
                    </Text>
                    <Text fontSize={{ base: "13.5px", md: "14px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.55}>{s.desc}</Text>
                  </VStack>
                </HStack>
              ))}
            </Flex>
          </ScrollFade>
        </VStack>
      </Container>
    </Box>
  );
}

/* ClaimLinkStage — the premium centerpiece. A glassy, shareable claim-link
   card sits on a clean stage. It lifts in on scroll, a soft halo breathes
   behind it, and a single spark travels the link bar (money → claimed).
   This replaces the boxy "explainer cards" with one credible artifact. */
function ClaimLinkStage({ dark, textMain, textSub, youLabel, claimedLabel, amountLabel, statusLabel }: {
  dark: boolean; textMain: string; textSub: string;
  youLabel: string; claimedLabel: string; amountLabel: string; statusLabel: string;
}) {
  const glass = dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.82)";
  const glassBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const fg = dark ? "#f5f5f7" : "#0a0a0a";
  const subtle = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";

  return (
    <Box position="relative" w="100%" maxW="560px" py={{ base: 4, md: 6 }}>
      {/* Breathing halo behind the card — monochrome light */}
      <motion.div
        animate={{ opacity: [0.4, 0.75, 0.4], scale: [0.96, 1.02, 0.96] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", inset: "-12% -6%", borderRadius: "40px",
          background: dark
            ? "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.08), transparent 70%)"
            : "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.05), transparent 70%)",
          pointerEvents: "none" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 32, rotateX: 8 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: "relative", perspective: 1200 }}
      >
        <Box position="relative" borderRadius="28px" overflow="hidden"
          bg={glass} border="1px solid" borderColor={glassBorder}
          backdropFilter="blur(20px)"
          boxShadow={dark ? "0 40px 100px rgba(0,0,0,0.55)" : "0 40px 100px rgba(0,0,0,0.12)"}
          p={{ base: 6, md: 8 }}
        >
          {/* top hairline sheen */}
          <Box position="absolute" top={0} left={0} right={0} h="1px"
            bg={dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.9)"} />

          {/* Header — link glyph + monospace-ish link string */}
          <Flex align="center" gap={3} mb={6}>
            <Flex w="40px" h="40px" borderRadius="12px" align="center" justify="center" flexShrink={0}
              bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}>
              <Icon as={FiLink} boxSize="18px" color={fg} />
            </Flex>
            <Box flex={1} minW={0}>
              <Text fontSize={{ base: "14px", md: "15px" }} fontWeight="600" color={fg} noOfLines={1}
                sx={{ fontVariantNumeric: "tabular-nums" }}>
                tazdan.com/claim/x7f2a9
              </Text>
              <Text fontSize="12px" color={textSub}>{statusLabel}</Text>
            </Box>
            <Flex w="28px" h="28px" borderRadius="full" align="center" justify="center"
              bg={dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)"}>
              <Icon as={FiCheck} boxSize="14px" color={fg} />
            </Flex>
          </Flex>

          {/* Amount */}
          <Text fontFamily="'DM Sans', sans-serif" fontWeight="700"
            fontSize={{ base: "40px", md: "52px" }} letterSpacing="-0.04em" color={fg} lineHeight={1}
            sx={{ fontVariantNumeric: "tabular-nums" }}>
            {amountLabel}
          </Text>

          {/* Transit bar — you → spark → claimed */}
          <Flex align="center" mt={7} gap={3}>
            <Text fontSize="12px" fontWeight="600" color={textSub} flexShrink={0}>{youLabel}</Text>
            <Box flex={1} h="2px" position="relative" borderRadius="full" bg={subtle}>
              <motion.div
                initial={{ left: "0%", opacity: 0 }}
                whileInView={{ left: "100%", opacity: [0, 1, 1, 0] }}
                viewport={{ once: false, amount: 0.5 }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }}
                style={{ position: "absolute", top: "50%", width: 8, height: 8, borderRadius: 999,
                  transform: "translate(-50%,-50%)", background: fg,
                  boxShadow: dark ? "0 0 14px rgba(255,255,255,0.7)" : "0 0 14px rgba(0,0,0,0.4)" }}
              />
            </Box>
            <Text fontSize="12px" fontWeight="600" color={fg} flexShrink={0}>{claimedLabel}</Text>
          </Flex>
        </Box>
      </motion.div>
    </Box>
  );
}


/* ═════════════════════════════════════════════════════════════════
   GROW & SAVE — two paired views: "Invest on autopilot" (DCA into
   top-tier crypto) and "Budgets" (save towards a goal). On desktop the
   section divides into two columns split by a hairline. On mobile the
   two views become a horizontal swipe (slide to the side to reveal
   budgets) before the page scrolls down normally.
   ═════════════════════════════════════════════════════════════════ */
function AutopilotView() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "#f5f5f7" : "#1d1d1f";
  const textSub = dark ? "rgba(245,245,247,0.60)" : "rgba(29,29,31,0.58)";
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.022)";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const bars = [40, 55, 48, 70, 62, 85, 78, 96];

  return (
    <VStack spacing={7} align={{ base: "center", md: "start" }} textAlign={{ base: "center", md: "left" }} w="100%">
      <VStack spacing={4} align={{ base: "center", md: "start" }}>
        <Heading fontFamily="'DM Sans', sans-serif" fontWeight="700"
          fontSize={{ base: "36px", md: "44px", lg: "52px" }}
          letterSpacing="-0.045em" color={textMain} lineHeight={isAr ? 1.15 : 1.02} maxW="460px"
        >
          <EmphText text={t("rb_title")} />
        </Heading>
        <Text fontSize={{ base: "16px", md: "18px" }} color={textSub} maxW="460px" lineHeight={isAr ? 1.75 : 1.55} fontWeight="400">
          {t("rb_sub")}
        </Text>
      </VStack>

      {/* Auto-buy product card */}
      <Box w="100%" minH={{ base: "auto", md: "330px" }} display="flex" flexDirection="column" justifyContent="space-between" bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="26px" p={{ base: 6, md: 7 }}
        boxShadow={dark ? "0 24px 60px rgba(0,0,0,0.34)" : "0 24px 60px rgba(0,0,0,0.05)"}>
        <Flex justify="space-between" align="center" mb={6}>
          <VStack align="start" spacing={0.5}>
            <Text fontSize="13px" fontWeight="600" color={textSub}>{t("rb_card_label")}</Text>
            <Text fontSize={{ base: "23px", md: "26px" }} fontWeight="700" color={textMain} sx={{ fontVariantNumeric: "tabular-nums" }}>{t("rb_card_amount")}</Text>
          </VStack>
          <motion.div transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
            <Flex w="44px" h="44px" borderRadius="13px" align="center" justify="center" bg={dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"}>
              <Icon as={FiRepeat} boxSize="20px" color={textMain} />
            </Flex>
          </motion.div>
        </Flex>
        <Flex align="flex-end" justify="space-between" gap={2} h={{ base: "120px", md: "140px" }}>
          {bars.map((hh, i) => (
            <motion.div key={i} initial={{ height: "8%" }} whileInView={{ height: `${hh}%` }} viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.07 * i, ease: [0.22, 1, 0.36, 1] }}
              style={{ flex: 1, borderRadius: 9, background: i === bars.length - 1 ? (dark ? "#ffffff" : "#63a1db") : (dark ? "#ffffff" : "#63a1db") }}
            />
          ))}
        </Flex>
        <Text mt={5} fontSize="13px" color={textSub} textAlign="center" lineHeight={isAr ? 1.75 : 1.5}>{t("rb_card_footer")}</Text>
      </Box>
    </VStack>
  );
}

function BudgetsView() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "#f5f5f7" : "#1d1d1f";
  const textSub = dark ? "rgba(245,245,247,0.60)" : "rgba(29,29,31,0.58)";
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.022)";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const ACCENT = "#63a1db";

  return (
    <VStack spacing={7} align={{ base: "center", md: "start" }} textAlign={{ base: "center", md: "left" }} w="100%" h="100%" justify="space-between">
      <VStack spacing={4} align={{ base: "center", md: "start" }}>
        <Heading fontFamily="'DM Sans', sans-serif" fontWeight="700"
          fontSize={{ base: "36px", md: "44px", lg: "52px" }}
          letterSpacing="-0.045em" color={textMain} lineHeight={isAr ? 1.15 : 1.02} maxW="460px"
        >
          <EmphText text={t("bg_title")} />
        </Heading>
        <Text fontSize={{ base: "16px", md: "18px" }} color={textSub} maxW="460px" lineHeight={isAr ? 1.75 : 1.55} fontWeight="400">
          {t("bg_sub")}
        </Text>
      </VStack>

      {/* Savings-goal product card */}
      <Box w="100%" minH={{ base: "auto", md: "330px" }} display="flex" flexDirection="column" justifyContent="space-between" bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="26px" p={{ base: 6, md: 7 }}
        boxShadow={dark ? "0 24px 60px rgba(0,0,0,0.34)" : "0 24px 60px rgba(0,0,0,0.05)"}>
        <Flex justify="space-between" align="center" mb={6}>
          <HStack spacing={3}>
            <Flex w="44px" h="44px" borderRadius="13px" align="center" justify="center" fontSize="23px" bg={dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"}>🏖️</Flex>
            <VStack align="start" spacing={0.5}>
              <Text fontSize={{ base: "17px", md: "18px" }} fontWeight="700" color={textMain}>{t("bg_card_name")}</Text>
              <Text fontSize="13px" fontWeight="600" color={textSub}>{t("bg_card_sub")}</Text>
            </VStack>
          </HStack>
          <HStack spacing={1.5} px={3} h="30px" borderRadius="full" bg={dark ? "rgba(99,161,219,0.12)" : "rgba(99,161,219,0.10)"} border="1px solid" borderColor="rgba(99,161,219,0.30)">
            <Icon as={FiLock} boxSize="12px" color={ACCENT} />
            <Text fontSize="12px" fontWeight="700" color={ACCENT}>{t("bg_card_lock")}</Text>
          </HStack>
        </Flex>
        <Box h="14px" borderRadius="full" bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"} overflow="hidden">
          <motion.div initial={{ width: "6%" }} whileInView={{ width: "64%" }} viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} style={{ height: "100%", borderRadius: 999, background: ACCENT }} />
        </Box>
        <Flex justify="space-between" mt={3}>
          <Text fontSize="15px" fontWeight="700" color={textMain} sx={{ fontVariantNumeric: "tabular-nums" }}>{t("bg_card_saved")}</Text>
          <Text fontSize="15px" fontWeight="600" color={textSub} sx={{ fontVariantNumeric: "tabular-nums" }}>{t("bg_card_target")}</Text>
        </Flex>
        <Text mt={5} fontSize="13px" color={textSub} textAlign="center" lineHeight={isAr ? 1.75 : 1.5}>{t("bg_card_footer")}</Text>
      </Box>
    </VStack>
  );
}

function SectionGrowSave() {
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const divider = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)";

  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Drive the mobile horizontal track from the section's vertical scroll: as
  // the visitor scrolls DOWN through the section, the track auto-slides from
  // autopilot to budgets. Manual side-swipe still works between scrolls.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  useEffect(() => {
    const unsub = scrollYProgress.on("change", (p) => {
      const track = trackRef.current;
      if (!track) return;
      // Desktop lays the two views side by side — no auto-scroll there.
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 48em)").matches) return;
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 1) return;
      // Map the middle band of the section's travel [0.30 → 0.70] onto the full
      // horizontal sweep, so the reveal happens while the section is centred.
      const t = Math.max(0, Math.min(1, (p - 0.3) / 0.4));
      const target = (isAr ? (1 - t) : t) * max;
      track.scrollLeft = target;
    });
    return () => unsub();
  }, [scrollYProgress, isAr]);

  return (
    <Box ref={sectionRef} py={{ base: 24, md: 44 }} px={{ base: 0, md: 10 }} position="relative" overflow="hidden">
      <Container maxW="1180px" position="relative" zIndex={1} px={{ base: 0, md: 4 }}>
        {/* Desktop: two views side by side, split by a vertical hairline.
            Mobile: a horizontal track — each view fills ~88% so the next one
            peeks at the edge. It auto-slides as you scroll down, and you can
            also swipe it by hand. */}
        <Flex
          ref={trackRef}
          dir={isAr ? "rtl" : "ltr"}
          align="stretch"
          gap={{ base: 4, md: 12 }}
          overflowX={{ base: "auto", md: "visible" }}
          px={{ base: 5, md: 0 }}
          sx={{
            scrollSnapType: { base: "x proximity", md: "none" } as never,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            scrollPaddingInline: "20px",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Box flex={{ base: "0 0 88%", md: "1" }} minW={0} sx={{ scrollSnapAlign: "center" }}>
            <AutopilotView />
          </Box>
          {/* Vertical hairline divider — desktop only */}
          <Box display={{ base: "none", md: "block" }} w="1px" bg={divider} alignSelf="stretch" />
          <Box flex={{ base: "0 0 88%", md: "1" }} minW={0} sx={{ scrollSnapAlign: "center" }}>
            <BudgetsView />
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}

function TazdanWordmarkInline({ dark }: { dark: boolean }) {
  const [src, setSrc] = useState("/text-logo-color.png");

  return (
    <Box
      as="span"
      display="inline-flex"
      position="relative"
      w="2.72em"
      h="0.68em"
      mx="0.06em"
      verticalAlign="-0.07em"
      filter={dark ? "drop-shadow(0 10px 28px rgba(99,161,219,0.22))" : "none"}
    >
      <NextImage
        src={src}
        alt="tazdan"
        fill
        sizes="340px"
        onError={() => setSrc("/logo-color.png")}
        style={{ objectFit: "contain" }}
      />
    </Box>
  );
}

function RotatingEverythingHeading({ dark }: { dark: boolean }) {
  const { t } = useTranslate();
  const isAr = useIsAr();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  const words = [
    {
      key: "money",
      prefix: t("pb_phrase_money_prefix"),
      node: <Box as="span" color="#63a1db">{t("pb_word_money")}</Box>,
      suffix: t("pb_phrase_money_suffix"),
    },
    {
      key: "tazdan",
      prefix: t("pb_phrase_tazdan_prefix"),
      node: <TazdanWordmarkInline dark={dark} />,
      suffix: t("pb_phrase_tazdan_suffix"),
    },
    {
      key: "crypto",
      prefix: t("pb_phrase_crypto_prefix"),
      node: <Box as="span" color="#63a1db">{t("pb_word_crypto")}</Box>,
      suffix: t("pb_phrase_crypto_suffix"),
    },
    {
      key: "you",
      prefix: t("pb_phrase_you_prefix"),
      node: <Box as="span" color="#63a1db">{t("pb_word_you")}</Box>,
      suffix: t("pb_phrase_you_suffix"),
    },
  ];

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [words.length]);

  return (
    <Heading
      fontFamily="'DM Sans', sans-serif"
      fontWeight="700"
      fontSize={isAr
        ? { base: "clamp(23px, 6.4vw, 34px)", md: "clamp(46px, 6.5vw, 84px)", lg: "clamp(60px, 6.1vw, 94px)" }
        : { base: "clamp(31px, 8.8vw, 44px)", md: "clamp(56px, 7vw, 88px)", lg: "clamp(70px, 6.3vw, 100px)" }}
      letterSpacing={isAr ? "-0.01em" : "-0.05em"}
      lineHeight={isAr ? 1.16 : 0.98}
      maxW="96vw"
      display="inline-flex"
      alignItems="baseline"
      justifyContent="center"
      whiteSpace="nowrap"
      dir={isAr ? "rtl" : "ltr"}
    >
      <Box as="span" whiteSpace="pre">{words[index].prefix}</Box>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={words[index].key}
          initial={reducedMotion ? false : { opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -22, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap" }}
        >
          {words[index].node}
        </motion.span>
      </AnimatePresence>
      <Box as="span" whiteSpace="pre">{words[index].suffix}</Box>
    </Heading>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PATTERN BREAK — a quiet sentence closer with one rotating word.
   ═════════════════════════════════════════════════════════════════ */
function SectionPatternBreak() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const isAr = useIsAr();
  const reducedMotion = useReducedMotion();
  const marqueeItems: { label: string; icon: React.ElementType }[] = [
    { label: t("pb_f_buy"), icon: FiArrowUp },
    { label: t("pb_f_sell"), icon: FiChevronDown },
    { label: t("pb_f_send"), icon: FiSend },
    { label: t("pb_f_claimlink"), icon: FiLink },
    { label: t("pb_f_recurring"), icon: FiRepeat },
    { label: t("pb_f_p2p"), icon: FiRepeat },
    { label: t("pb_f_cards"), icon: FiCreditCard },
    { label: t("pb_f_multichain"), icon: FiGlobe },
    { label: t("pb_f_selfcustody"), icon: FiShield },
    { label: t("pb_f_applepay"), icon: FaApplePay },
    { label: t("pb_f_chat"), icon: FiMessageCircle },
    { label: t("pb_f_global"), icon: FiGlobe },
  ];
  const marqueeTrack = [...marqueeItems, ...marqueeItems];
  const marqueeX = isAr ? ["-50%", "0%"] : ["0%", "-50%"];
  const accent = "#63a1db";
  const pillText = "#05070a";
  const pillIconBg = "#ffffff";

  return (
    <Box
      position="relative"
      overflow="hidden"
      minH={{ base: "610px", md: "720px" }}
      py={{ base: 12, md: 16 }}
      zIndex={1}
      display="flex"
      alignItems="center"
    >
      <motion.div
        animate={{ opacity: [0.18, 0.32, 0.18] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", top: "8%", left: "50%", width: 1100, height: 540,
          transform: "translateX(-50%)", borderRadius: "50%",
          background: dark
            ? "radial-gradient(circle, rgba(99,161,219,0.10), transparent 64%)"
            : "radial-gradient(circle, rgba(99,161,219,0.12), transparent 64%)",
          pointerEvents: "none" }}
      />
      <Container maxW="1200px" position="relative" zIndex={1} transform={{ base: "translateY(-34px)", md: "translateY(-48px)" }}>
        <VStack spacing={{ base: 4, md: 5 }} align="center" textAlign="center">
          <ScrollFade>
            <VStack spacing={5}>
              <RotatingEverythingHeading dark={dark} />
              <Text fontSize={{ base: "17px", md: "21px" }} maxW="560px" lineHeight={isAr ? 1.75 : 1.5} fontWeight="400">
                {t("pb_sub")}
              </Text>
            </VStack>
          </ScrollFade>
        </VStack>
      </Container>

      <Box
        position="absolute"
        left={0}
        right={0}
        bottom={{ base: "26px", md: "34px" }}
        w="100vw"
        overflow="hidden"
        py={{ base: 2, md: 3 }}
        sx={{
          maskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)",
        }}
        dir="ltr"
        aria-hidden
      >
        <motion.div
          animate={reducedMotion ? undefined : { x: marqueeX }}
          transition={reducedMotion ? undefined : { duration: 34, repeat: Infinity, ease: "linear" }}
          style={{ display: "flex", width: "max-content", gap: 0, willChange: "transform" }}
        >
          {marqueeTrack.map((item, i) => (
            <HStack
              key={`${item.label}-${i}`}
              dir={isAr ? "rtl" : "ltr"}
              spacing={{ base: 3, md: 4.5 }}
              h={{ base: "64px", md: "82px" }}
              px={{ base: 5, md: 7.5 }}
              mx={{ base: 1.75, md: 3 }}
              flexShrink={0}
              borderRadius="full"
              bg={accent}
              // boxShadow={dark ? "0 20px 50px rgba(99,161,219,0.24)" : "0 22px 56px rgba(99,161,219,0.22)"}
            >
              <Flex
                w={{ base: "40px", md: "54px" }}
                h={{ base: "40px", md: "54px" }}
                borderRadius="full"
                align="center"
                justify="center"
                bg={pillIconBg}
                flexShrink={0}
              >
                <Icon as={item.icon} boxSize={{ base: "18px", md: "24px" }} color={pillText} />
              </Flex>
              <Text
                fontFamily="'DM Sans', sans-serif"
                fontWeight="900"
                fontSize={{ base: "24px", md: "38px" }}
                letterSpacing={isAr ? "0" : "-0.04em"}
                lineHeight={1}
                whiteSpace="nowrap"
                color={pillText}
              >
                {item.label}
              </Text>
            </HStack>
          ))}
        </motion.div>
      </Box>
    </Box>
  );
}

function SectionPartners() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "#f5f5f7" : "#0a0a0a";
  const textSub = dark ? "#A7AFBC" : "#5F6874";
  const sectionBg = dark ? "#16181C" : "#FFFFFF";
  const cardBg = dark ? "rgba(255,255,255,0.035)" : "rgba(10,15,30,0.025)";
  const border = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)";

  const partners = [
    {
      name: "Banxa",
      logo: dark ? "/Banxa-Logo-Light.webp" : "/Banxa-Logo-Dark.webp",
      role: t("partner_banxa_role"),
      tagline: t("partner_banxa_tagline"),
      logoW: 118,
      logoH: 34,
    },
    {
      name: "Crypto.com",
      logo: "/crypto.com.png",
      role: t("partner_crypto_role"),
      tagline: t("partner_crypto_tagline"),
      logoW: 62,
      logoH: 62,
    },
    {
      name: "Visa",
      logo: "/visa-logo.webp",
      role: t("partner_visa_role"),
      tagline: t("partner_visa_tagline"),
      logoW: 94,
      logoH: 34,
    },
  ];

  return (
    <Box
      position="relative"
      bg={sectionBg}
      px={{ base: 4, md: 10 }}
      py={{ base: 10, md: 13 }}
      overflow="hidden"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 360px" } as React.CSSProperties}
    >
      <Container maxW="1180px" px={0}>
        <Box
          borderTop="1px solid"
          borderBottom="1px solid"
          borderColor={border}
          py={{ base: 7, md: 8 }}
        >
        <SimpleGrid
          columns={{ base: 1, lg: 2 }}
          gridTemplateColumns={{ base: "1fr", lg: "0.88fr 1.12fr" }}
          spacing={{ base: 7, lg: 10 }}
          alignItems="center"
        >
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <VStack align={{ base: "start", lg: "start" }} textAlign="start" spacing={3}>
              <Heading
                fontFamily="'DM Sans', sans-serif"
                fontWeight="850"
                fontSize={{ base: "26px", md: "38px" }}
                letterSpacing="-0.045em"
                lineHeight={isAr ? 1.25 : 1.04}
                color={textMain}
                maxW="500px"
              >
                {t("partners_title")}
              </Heading>
              <Text fontSize={{ base: "14px", md: "15px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.6} maxW="570px">
                {t("partners_sub")}
              </Text>
            </VStack>
          </motion.div>

          <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
            {partners.map((partner, i) => (
              <motion.div
                key={partner.name}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2 }}
              >
                <Box
                  minH={{ base: "124px", sm: "156px" }}
                  h="100%"
                  bg={cardBg}
                  border="1px solid"
                  borderColor={border}
                  borderRadius="18px"
                  p={{ base: 4, md: 4 }}
                >
                  <VStack h="100%" align="start" justify="space-between" spacing={4}>
                    <Flex
                      w="100%"
                      h="38px"
                      align="center"
                      justify="flex-start"
                    >
                      <Box position="relative" w={`${partner.logoW}px`} h={`${partner.logoH}px`}>
                        <NextImage
                          src={partner.logo}
                          alt={`${partner.name} logo`}
                          fill
                          sizes="190px"
                          style={{ objectFit: "contain" }}
                        />
                      </Box>
                    </Flex>

                    <VStack align="start" spacing={1.5}>
                      <Heading fontFamily="'DM Sans', sans-serif" fontSize="15px" fontWeight="850" color={textMain} letterSpacing="-0.015em">
                        {partner.name}
                      </Heading>
                      <Text fontSize="11px" fontWeight="800" color={textMain} lineHeight={1.3}>
                        {partner.role}
                      </Text>
                      <Text fontSize="11.5px" color={textSub} lineHeight={isAr ? 1.7 : 1.45}>
                        {partner.tagline}
                      </Text>
                    </VStack>
                  </VStack>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>
        </SimpleGrid>
        </Box>
      </Container>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PREPAID CARDS — virtual & physical Visa cards.
   Monochrome, editorial: one line, one paragraph, one CTA. The image
   and the wallet sketch do the rest.
   ═════════════════════════════════════════════════════════════════ */
function SectionPrepaidCards() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "#f5f5f7" : "#1d1d1f";
  const textSub  = dark ? "rgba(245,245,247,0.60)" : "rgba(29,29,31,0.58)";
  const hairline = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  return (
    <Box py={{ base: 32, md: 48 }} px={{ base: 5, md: 10 }} position="relative" overflow="hidden">
      {/* Monochrome ambient grid */}
      <Box position="absolute" inset={0} pointerEvents="none" opacity={dark ? 0.4 : 0.28}
        style={{
          backgroundImage: dark
            ? "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)"
            : "linear-gradient(rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.045) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "radial-gradient(ellipse 75% 55% at 50% 38%, #000 28%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 55% at 50% 38%, #000 28%, transparent 72%)",
        }}
      />

      <Container maxW="1080px" position="relative" zIndex={1}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 14, md: 20 }} alignItems="center">

          {/* LEFT — copy */}
          <ScrollFade>
            <VStack spacing={6} align={{ base: "center", md: "start" }} textAlign={{ base: "center", md: "left" }}>

              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="700"
                fontSize={{ base: "40px", md: "58px", lg: "66px" }}
                letterSpacing="-0.045em" color={textMain} lineHeight={isAr ? 1.15 : 1.0} maxW="540px"
              >
                {t("cards_title_1")}{" "}
                <Box as="span"><EmphText text={t("cards_title_2")} /></Box>
              </Heading>

              <Text fontSize={{ base: "17px", md: "19px" }} color={textSub} maxW="500px" lineHeight={isAr ? 1.75 : 1.55} fontWeight="400">
                {t("cards_desc")}
              </Text>

              {/* Inline features — editorial, not boxed */}
              <Flex gap={2.5} flexWrap="wrap" justify={{ base: "center", md: "start" }}>
                {[t("cards_b1"), t("cards_b2"), t("cards_b3"), t("cards_b4")].map((label, i) => (
                  <HStack key={i} spacing={1.5} px={3.5} h="34px" borderRadius="full"
                    bg={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)"}
                    border="1px solid" borderColor={hairline}>
                    <Box w="5px" h="5px" borderRadius="full" bg={textMain} opacity={0.5} />
                    <Text fontSize="13px" fontWeight="600" color={textMain}>{label}</Text>
                  </HStack>
                ))}
              </Flex>
            </VStack>
          </ScrollFade>

          {/* RIGHT — card image + wallet sketch */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <Box position="relative" w="100%" maxW="420px" mx="auto">
              <Box
                position="relative"
                w="100%"
                style={{ aspectRatio: "843 / 1264" }}
                borderRadius="28px"
                overflow="hidden"
                boxShadow={dark
                  ? "0 50px 100px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.06)"
                  : "0 50px 100px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)"
                }
              >
                <NextImage
                  src="/visa-hand.png"
                  alt={t("cards_alt")}
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="(max-width: 768px) 80vw, 420px"
                />
              </Box>
            </Box>
          </motion.div>

        </SimpleGrid>
      </Container>
    </Box>
  );
}

type SocialAvatarSpec = {
  src: string;
  stackX: number;
  stackY: number;
  orbitAX: number;
  orbitAY: number;
  orbitBX: number;
  orbitBY: number;
  burstX: number;
  burstY: number;
  sizeBase: number;
  sizeMd: number;
  floatDelay: number;
};

function SocialProofAvatar({
  avatar,
  progress,
  dark,
  reducedMotion,
  index,
}: {
  avatar: SocialAvatarSpec;
  progress: MotionValue<number>;
  dark: boolean;
  reducedMotion: boolean;
  index: number;
}) {
  const x = useTransform(
    progress,
    [0, 0.08, 0.50, 0.68, 0.82, 0.92, 1],
    [avatar.stackX, avatar.stackX, avatar.orbitAX, avatar.orbitBX, avatar.orbitAX, avatar.burstX, avatar.burstX],
  );
  const y = useTransform(
    progress,
    [0, 0.08, 0.50, 0.68, 0.82, 0.92, 1],
    [avatar.stackY, avatar.stackY, avatar.orbitAY, avatar.orbitBY, avatar.orbitAY, avatar.burstY, avatar.burstY],
  );
  const opacity = useTransform(progress, [0, 0.08, 0.34, 0.80, 0.91, 0.97], [0.96, 1, 1, 1, 0.42, 0]);
  const scale = useTransform(progress, [0, 0.12, 0.50, 0.82, 0.94], [0.92, 0.94, 1, 1.04, 1.14]);

  return (
    <motion.div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        x: reducedMotion ? avatar.orbitAX : x,
        y: reducedMotion ? avatar.orbitAY : y,
        opacity: reducedMotion ? 1 : opacity,
        scale: reducedMotion ? 1 : scale,
        zIndex: 20 - index,
        willChange: "transform, opacity",
      }}
    >
      <motion.div whileHover={{ scale: 1.08, zIndex: 10 }}>
        <Box
          w={{ base: `${avatar.sizeBase}px`, md: `${avatar.sizeMd}px` }}
          h={{ base: `${avatar.sizeBase}px`, md: `${avatar.sizeMd}px` }}
          borderRadius="full"
          overflow="hidden"
          border="2px solid"
          borderColor={dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.86)"}
          boxShadow={dark
            ? "0 18px 54px rgba(0,0,0,0.52), 0 0 0 1px rgba(99,161,219,0.12)"
            : "0 18px 54px rgba(10,15,30,0.16), 0 0 0 1px rgba(99,161,219,0.10)"}
          transition="border-color 0.3s ease, box-shadow 0.3s ease"
          _hover={{ borderColor: "#63a1db", boxShadow: "0 20px 60px rgba(99,161,219,0.25)" }}
          position="relative"
          bg={dark ? "#111" : "#e8e8e8"}
          style={{ transform: "translate(-50%, -50%)" }}
        >
          <NextImage src={avatar.src} alt="" fill style={{ objectFit: "cover" }} sizes="120px" />
        </Box>
      </motion.div>
    </motion.div>
  );
}

function SectionSocialProof() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const reducedMotion = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const avatarProgress = useSpring(scrollYProgress, {
    stiffness: 95,
    damping: 24,
    mass: 0.22,
    restDelta: 0.0008,
  });
  const [viewport, setViewport] = useState({ w: 1200, h: 820 });
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth || 1200, h: window.innerHeight || 820 });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const clampNum = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));
  const vw = (pct: number, min: number, max: number) => clampNum(min, viewport.w * pct / 100, max);
  const vh = (pct: number, min: number, max: number) => clampNum(min, viewport.h * pct / 100, max);

  const titleOpacity = useTransform(avatarProgress, [0.38, 0.52, 0.78, 0.90], [0, 1, 1, 0]);
  const titleY = useTransform(avatarProgress, [0.38, 0.52, 0.78, 0.90], [18, 0, 0, -20]);
  const avatars: SocialAvatarSpec[] = [
    { src: "/screenshots/p1.avif", stackX: 0, stackY: 0, orbitAX: vw(-29, -236, -126), orbitAY: vw(-14, -108, -68),  orbitBX: vw(-10, -72, -42),   orbitBY: vw(-27, -212, -122), burstX: vw(-62, -520, -270), burstY: vh(-42, -330, -190), sizeBase: 50, sizeMd: 78, floatDelay: 0 },
    { src: "/screenshots/p2.avif", stackX: 0, stackY: 0, orbitAX: vw(-9, -66, -38),    orbitAY: vw(-26, -196, -114), orbitBX: vw(17, 120, 164),     orbitBY: vw(-21, -162, -98),  burstX: vw(-17, -122, -62),  burstY: vh(-58, -470, -255), sizeBase: 56, sizeMd: 88, floatDelay: 0.7 },
    { src: "/screenshots/p3.avif", stackX: 0, stackY: 0, orbitAX: vw(26, 126, 238),    orbitAY: vw(-13, -104, -64),  orbitBX: vw(30, 214, 292),     orbitBY: vw(9, 50, 94),       burstX: vw(62, 295, 560),    burstY: vh(-42, -330, -185), sizeBase: 60, sizeMd: 96, floatDelay: 1.4 },
    { src: "/screenshots/p4.avif", stackX: 0, stackY: 0, orbitAX: vw(-31, -238, -132), orbitAY: vw(12, 76, 122),     orbitBX: vw(-28, -218, -138), orbitBY: vw(-4, -28, -16),    burstX: vw(-66, -560, -295), burstY: vh(42, 220, 380),     sizeBase: 50, sizeMd: 76, floatDelay: 0.4 },
    { src: "/screenshots/p5.avif", stackX: 0, stackY: 0, orbitAX: vw(29, 142, 256),    orbitAY: vw(13, 78, 126),     orbitBX: vw(7, 24, 76),        orbitBY: vw(22, 156, 202),    burstX: vw(66, 310, 590),    burstY: vh(42, 225, 395),    sizeBase: 52, sizeMd: 80, floatDelay: 1.0 },
    { src: "/screenshots/p6.avif", stackX: 0, stackY: 0, orbitAX: vw(1, -16, 10),      orbitAY: vw(22, 132, 180),    orbitBX: vw(-23, -178, -114), orbitBY: vw(12, 70, 116),     burstX: vw(13, 40, 112),     burstY: vh(54, 285, 470),    sizeBase: 60, sizeMd: 90, floatDelay: 0.2 },
  ];
  return (
    <Box
      ref={ref}
      position="relative"
      h={{ base: "220vh", md: "230vh" }}
      overflow="visible"
      zIndex={5}
      scrollSnapAlign="start"
      scrollSnapStop="always"
    >
      <Box position="sticky" top={0} h="100vh" w="100%" overflow="visible" display="flex" alignItems="center" px={{ base: 4, md: 10 }}>
      <motion.div
        animate={{ opacity: [0.26, 0.52, 0.26], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", top: "50%", left: "50%",
          width: 600, height: 600, borderRadius: "50%",
          transform: "translate(-50%,-50%)",
          // background: "radial-gradient(circle, rgba(99,161,219,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <Container maxW="1200px" position="relative" zIndex={2} overflow="visible">
        <Box position="relative" w="100%" mx="auto" maxW={{ base: "100%", md: "940px" }} h={{ base: "560px", md: "640px" }} overflow="visible">
          {avatars.map((a, index) => (
            <SocialProofAvatar
              key={a.src}
              avatar={a}
              progress={avatarProgress}
              dark={dark}
              reducedMotion={reducedMotion}
              index={index}
            />
          ))}
          <Box
            position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)"
            zIndex={3} textAlign="center" pointerEvents="none"
            w={{ base: "82%", md: "auto" }}
          >
            <motion.div
              style={reducedMotion ? undefined : { opacity: titleOpacity, y: titleY }}
            >
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="900"
                fontSize={{ base: "27px", md: "40px", lg: "50px" }}
                letterSpacing="-0.04em" lineHeight={isAr ? 1.2 : 1.1}
                color={textMain}
                maxW={{ base: "280px", md: "540px" }}
                mx="auto"
                style={{ textShadow: dark ? "0 2px 40px rgba(0,0,0,0.6)" : "0 2px 20px rgba(255,255,255,0.8)" }}
              >
                <EmphText text={t("socialproof_label")} />
              </Heading>
            </motion.div>
          </Box>
        </Box>
      </Container>
      </Box>
    </Box>
  );
}

/* ── Stage overlay ── */
interface Stage { eyebrow: string; title: string; desc: string; widget?: React.ReactNode; }
function StageOverlay({ stages }: { stages: Stage[] }) {
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const s = stages[0];
  return (
    <Box position="absolute" inset={0} zIndex={3} pointerEvents="none">
      <Box display={{ base: "block", md: "none" }} position="absolute" top={{ base: "120px", sm: "130px" }} left={0} right={0} textAlign="center" px={5}>
        <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "22px", sm: "28px" }} letterSpacing="-0.03em" color={textMain} lineHeight={isAr ? 1.25 : 1.15}>{s.title}</Heading>
      </Box>
      <Box display={{ base: "block", md: "none" }} position="absolute" bottom={{ base: "20px", sm: "32px" }} left={0} right={0} px={5}>
        <LiveTxFeed />
      </Box>
      <Box display={{ base: "none", md: "block" }} position="absolute" top="50%" left={{ md: "5%" }} transform="translateY(-50%)" w={{ md: "28%" }} maxW={{ md: "320px", xl: "380px" }}>
        <VStack align="start" spacing={5}>
          <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ md: "30px", lg: "40px", xl: "52px" }} letterSpacing="-0.04em" color={textMain} lineHeight={isAr ? 1.2 : 1.1}>{s.title}</Heading>
          <Text fontSize={{ md: "13px", lg: "15px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.5}>{s.desc}</Text>
        </VStack>
      </Box>
      <Box display={{ base: "none", md: "block" }} position="absolute" top="50%" right={{ md: "4%" }} transform="translateY(-50%)" w={{ md: "28%" }} maxW={{ md: "260px", xl: "320px" }}>
        <LiveTxFeed />
      </Box>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PHONE JOURNEY
   One continuous scroll-driven sequence inside a single sticky frame.
   Phone starts tilted forward & locked, untilts as it unlocks to
   reveal the dashboard, then the on-screen view cross-fades through
   each feature surface (chat → buy → search → pay-with). Side copy
   fades in lockstep. Every label comes from the Tolgee i18n catalog.

   Easing follows Apple's house curve: cubic-bezier(0.22, 1, 0.36, 1)
   for opacity/position transitions and a slow linear scrub for scroll-
   driven motion. No gradients on text. Brand accent (#63a1db) is used
   only as a deliberate pop — one dot, one word, one halo.
   ═════════════════════════════════════════════════════════════════ */

type StageCopyProps = {
  op: MotionValue<number>;
  eyebrow?: string;   // accepted but not rendered (eyebrow removed by design)
  title: React.ReactNode;
  desc?: string;
  features?: { icon: React.ElementType; label: string }[];
  accent: string;
  textMain: string;
  textMuted: string;
  hairline: string;
  tileBg: string;
  isAr?: boolean;
};

function StageCopy({ op, title, desc, features, textMain, textMuted, hairline, tileBg, isAr }: StageCopyProps) {
  const y = useTransform(op, [0, 1], [10, 0]);
  return (
    <motion.div
      style={{
        opacity: op, y,
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", justifyContent: "center",
        gap: 20,
        pointerEvents: "none",
      }}
    >
      <Heading as="h2" fontFamily="'DM Sans', sans-serif" fontWeight="800"
        fontSize={{ base: "30px", sm: "40px", md: "68px", xl: "92px" }}
        letterSpacing="-0.05em" lineHeight={isAr ? 1.15 : 0.94} color={textMain}
        sx={{ fontFeatureSettings: '"ss01", "cv11", "kern"' }}
      >
        {title}
      </Heading>
      {desc && (
        <Text fontSize={{ base: "16px", md: "20px" }} color={textMuted}
          maxW="520px" lineHeight={isAr ? 1.75 : 1.5} fontWeight="400"
        >
          {desc}
        </Text>
      )}
      {features && features.length > 0 && (
        <SimpleGrid columns={2} spacing={2.5} maxW="460px" w="100%">
          {features.map((f) => (
            <HStack key={f.label} h={{ base: "44px", md: "52px" }} bg={tileBg}
              border="1px solid" borderColor={hairline}
              borderRadius="12px" px={3} spacing={2.5}
            >
              <Flex w={{ base: "26px", md: "30px" }} h={{ base: "26px", md: "30px" }}
                borderRadius="8px" border="1px solid" borderColor={hairline}
                align="center" justify="center" flexShrink={0}
              >
                <Icon as={f.icon} color={textMain} boxSize={{ base: "12px", md: "13px" }} />
              </Flex>
              <Text fontSize={{ base: "11.5px", md: "12.5px" }} fontWeight="700" color={textMain} noOfLines={1}>
                {f.label}
              </Text>
            </HStack>
          ))}
        </SimpleGrid>
      )}
    </motion.div>
  );
}

/**
 * useHeroSnap — gentle scroll-snap for the hero phone-screen journey.
 *
 * The journey is a tall (600vh) runway with a sticky frame; the OS scrolls
 * `window`, so CSS scroll-snap (which needs a scroll *container*) can't be
 * scoped here without snapping the whole page. Instead we listen for the
 * scroll to settle and, only while the runway is the active region, smooth-
 * scroll to the nearest of `stages` evenly-spaced anchors. It's proximity-
 * style: it never fires mid-scroll, respects reduced-motion, and bails if
 * the user is already moving away.
 */
function useHeroSnap(_ref: React.RefObject<HTMLDivElement>, _stages: number) {
  useEffect(() => {
    // Intentionally a no-op. The previous implementation called
    // `window.scrollTo({ behavior: "smooth" })` mid-scroll to snap to the
    // nearest journey chapter. It fought the user's own momentum AND collided
    // with the document-level CSS `scroll-snap-type: y proximity`, producing
    // the jittery, "fighting back" feel. The journey's spring-smoothed
    // scrollYProgress already eases the screen transitions, so no discrete
    // JS snapping is needed — removing it is the fix.
    return;
  }, []);
}

/**
 * fade(a,b,c,d): opacity is 0 outside [a,d], ramps 0→1 on [a,b], holds 1 on [b,c], ramps 1→0 on [c,d].
 * Returned MotionValue is wired to the journey's scrollYProgress.
 */

function PhoneJourney() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const phoneDark = usePhoneDark();
  const { t } = useTranslate();
  const isAr = useIsAr();

  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: rawProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Smooth the raw scroll value through a spring so the ~20 derived transforms
  // below glide instead of snapping to each discrete scroll event — this is the
  // fix for the jittery journey. Tuned for a responsive-but-buttery feel.
  const scrollYProgress = useSpring(rawProgress, {
    stiffness: 260,
    damping: 38,
    mass: 0.24,
    restDelta: 0.0005,
  });

  const textMain  = dark ? "#ffffff" : "#0a0a0a";
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
  const hairline  = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tileBg    = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const ACCENT = "#63a1db";

  /* Stage layout (out of 1 progress).
     7 exact chapters, each separated by a narrow fade band:
     0 login, 1 dashboard, 2 messages, 3 buy, 4 market detail,
     5 top up, 6 card/top-up close. */
  /* One timeline for the whole story. The beats that used to live in the
     separate AppleFilm sections are now stages 9–11 of THIS journey, so the
     visitor never meets a second phone or a second sticky stage:

       lock → 360° unlock → home → chat (+ receipt, +chime) → buy → asset
       → top-up → card → trio fan → zoom into the screen → black. */
  const journeyTiming = useMemo(() => ({
    unlock: [0.03, 0.10],
    introCopy: [0.000, 0.028, 0.100, 0.140],
    homeCopy: [0.115, 0.148, 0.224, 0.260],
    chat: [0.244, 0.276, 0.364, 0.396],
    buy: [0.380, 0.412, 0.500, 0.532],
    asset: [0.516, 0.548, 0.636, 0.668],
    topUp: [0.652, 0.684, 0.744, 0.772],
    card: [0.750, 0.772, 0.812, 0.836],
    /* Fan out, then HOLD from .900 to .935 — dead air on purpose, so there is
       time to actually read all three screens before anything else moves. */
    trio: [0.836, 0.900],
    /* Screens power off first (the phones visibly go dark), THEN the zoom
       drives into them, and only then does the stage finish to black. */
    screensOff: [0.935, 0.962],
    zoomOut: [0.952, 1.000],
  }), []);
  /* The transfer lands mid-chat — the one moment the sound belongs to. */
  const RECEIPT_AT = 0.318;
  const stageLayerStyle = useMemo(
    () => ({ position: "absolute", inset: 0, willChange: "opacity" }) as const,
    [],
  );

  const tiltX          = useTransform(scrollYProgress, [0, 0.12], [22, 0]);
  const unlockProgress = useTransform(scrollYProgress, journeyTiming.unlock, [0, 1]);

  // screen cross-fades — dashboard is the base layer during unlock/home,
  // then fades to black so feature screenshots sit on a black canvas.
  const opHome   = useTransform(scrollYProgress, journeyTiming.chat, [1, 1, 0, 0]);
  const opChat   = useTransform(scrollYProgress, journeyTiming.chat, [0, 1, 1, 0]);
  const opBuy    = useTransform(scrollYProgress, journeyTiming.buy, [0, 1, 1, 0]);
  const opSearch = useTransform(scrollYProgress, journeyTiming.asset, [0, 1, 1, 0]);
  const opPay    = useTransform(scrollYProgress, journeyTiming.topUp, [0, 1, 1, 0]);
  const opCard   = useTransform(scrollYProgress, journeyTiming.card, [0, 1, 1, 0]);
  /* Finale layer: comes up for the trio and NEVER fades, so the closing zoom
     drives into a live wallet rather than a dead black rectangle. */
  const opFinale = useTransform(scrollYProgress, [0.846, 0.872], [0, 1]);
  // Legacy floating card transforms are kept inert; the real card/top-up UI now
  // lives inside the screenshot stage so the mockup matches the app.
  const cardX    = useTransform(scrollYProgress, [0.82, 0.96], [-80,  0]);
  const cardY    = useTransform(scrollYProgress, [0.82, 0.96], [40,   0]);
  const cardRot  = useTransform(scrollYProgress, [0.82, 0.96], [-10, -3]);

  // copy cross-fades — slightly lead the matching screen
  const copyA = useTransform(scrollYProgress, journeyTiming.introCopy, [1, 1, 1, 0]);
  const copyB = useTransform(scrollYProgress, journeyTiming.homeCopy, [0, 1, 1, 0]);
  const copyC = useTransform(scrollYProgress, journeyTiming.chat, [0, 1, 1, 0]);
  const copyD = useTransform(scrollYProgress, journeyTiming.buy, [0, 1, 1, 0]);
  const copyE = useTransform(scrollYProgress, journeyTiming.asset, [0, 1, 1, 0]);
  const copyF = useTransform(scrollYProgress, journeyTiming.topUp, [0, 1, 1, 0]);
  const copyG = useTransform(scrollYProgress, journeyTiming.card, [0, 1, 1, 0]);

  // shader background — stays alive through the journey instead of fading out
  // so the line field keeps visibly moving behind every phone chapter.
  /* ── 360° unlock spin ──────────────────────────────────────────────
     The phone turns a full revolution as the lock screen slides away, so
     unlocking reads as one physical gesture rather than a crossfade. It is
     driven by `unlockProgress` (not raw scroll) so the spin and the lock
     come apart at exactly the same rate, forwards or backwards. */
  /* Eased rather than linear (a constant-rate spin reads mechanical), then
     lightly sprung so it glides instead of tracking the wheel tick-for-tick. */
  const spinRaw = useTransform(unlockProgress, [0, 0.2, 0.5, 0.8, 1], [0, 42, 180, 318, 360]);
  const spinY = useSpring(spinRaw, { stiffness: 70, damping: 18, mass: 0.5 });

  /* ── Zoom into the screen, then to black ───────────────────────────
     The closing move: the device rushes at the viewer, the screen fills the
     frame, and the stage blacks out just as the next section arrives — so
     the journey ENDS rather than just scrolling away. */
  const zoomScale   = useTransform(scrollYProgress, journeyTiming.zoomOut, [1, 9]);
  const zoomOpacity = useTransform(scrollYProgress, [journeyTiming.zoomOut[0], 0.986, 1], [1, 1, 0]);
  /* Screens dim to black BEFORE the zoom — the devices power off, then rush
     the viewer. Applied to the screen stack, not the stage. */
  const screensOff  = useTransform(scrollYProgress, journeyTiming.screensOff, [1, 0]);
  /* The stage finishes to black last, so the next section arrives out of it. */
  const blackout    = useTransform(scrollYProgress, [0.972, 0.998], [0, 1]);

  /* The phone lives in the RIGHT grid column. For the trio finale the copy is
     gone, so the group slides to true viewport centre and the three screens
     sit balanced instead of crowding one side. */
  const trioLabelOp = useTransform(scrollYProgress, [0.878, 0.900, 0.932, 0.948], [0, 1, 1, 0]);
  const trioShiftVw = useBreakpointValue({ base: 0, lg: -22 }) ?? 0;
  const groupX = useTransform(
    scrollYProgress,
    journeyTiming.trio,
    ["0vw", `${trioShiftVw}vw`],
  );

  const reducedMotion = !!useReducedMotion();

  /* Trio geometry. The fan spans roughly phoneWidth * (1 + 2 * spread), so a
     desktop spread would push the outer two clean off a handset — it comes in
     and they shrink a little more to buy the room back. Chakra's default
     `ssr: true` matters here: `{ ssr: false }` reads window.matchMedia during
     render and throws on the server. */
  const trioSpread   = useBreakpointValue({ base: 62, md: 100, lg: 116 }) ?? 116;
  const trioEndScale = useBreakpointValue({ base: 0.66, md: 0.82 }) ?? 0.82;

  /* Chime — fires once on the downward crossing of the receipt beat, and
     re-arms if the visitor scrolls back out and in again. */
  const chime = useChime();
  const chimeFired = useRef(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (v >= RECEIPT_AT && !chimeFired.current) {
      chimeFired.current = true;
      if (chime.armed) chime.play();
    } else if (v < RECEIPT_AT - 0.02) {
      chimeFired.current = false;
    }
  });
  // ambient halo follows the phone, gently breathing
  const phoneScale = useTransform(scrollYProgress, [0, 0.16], [0.96, 1]);

  // Snap-assist the hero phone screens. While the journey is the active
  // scroll region, a settle after scrolling glides to the nearest stage so
  // each screen lands cleanly. Proximity-style: only nudges when you're
  // already close, never hijacks a deliberate scroll past the section.
  useHeroSnap(ref, 7);

  // ── "Scroll to explore" cue ──────────────────────────────────────
  // The first screen is a locked phone. If the visitor hasn't scrolled
  // after a beat, the phone gives a little upward "flinch" and a
  // Scroll-to-explore arrow appears — nudging them to scroll and unlock
  // the journey. Both vanish the moment they actually scroll.
  const flinch = useAnimationControls();
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    let scrolled = false;
    let idle: ReturnType<typeof setTimeout>;
    let repeat: ReturnType<typeof setInterval>;
    const doFlinch = () => {
      if (scrolled || (typeof document !== "undefined" && document.hidden)) return;
      flinch.start({ y: [0, -22, 0], transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] } });
    };
    const arm = () => {
      idle = setTimeout(() => { if (!scrolled) { setShowHint(true); doFlinch(); } }, 3400);
      repeat = setInterval(doFlinch, 4600);
    };
    const stop = () => { clearTimeout(idle); clearInterval(repeat); };
    const unsub = rawProgress.on("change", (v) => {
      if (v > 0.012 && !scrolled) { scrolled = true; setShowHint(false); stop(); flinch.start({ y: 0 }); }
    });
    arm();
    return () => { stop(); unsub(); };
  }, [flinch, rawProgress]);

  return (
    <Box ref={ref} position="relative" zIndex={1} h={{ base: "1500vh", md: "1560vh" }}>
      <Box position="sticky" top={0} h="100vh" w="100%" overflow="visible"
        style={{ contain: "layout" } as React.CSSProperties}
      >
        <Box position="absolute" inset={0} overflow="hidden" zIndex={1}>
        {/* ── Layout grid ── */}
        <Container maxW="1300px" h="100%" position="relative" zIndex={1} px={{ base: 4, md: 10 }}>
          <SimpleGrid columns={{ base: 1, lg: 2 }} h="100%"
            alignItems="center" gap={{ base: 0, lg: 12 }}>

            {/* COPY column — sits LEFT on desktop, BELOW phone on mobile */}
            <Box position="relative" order={{ base: 2, lg: 1 }}
              h={{ base: "180px", sm: "220px", lg: "520px" }}
              w="100%" maxW={{ base: "100%", lg: "620px" }}
              textAlign={{ base: "center", lg: "left" } as any}
              pt={{ base: 0, lg: 0 }}
            >
              <StageCopy op={copyA} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg} isAr={isAr}
                eyebrow={t("coming_soon")}
                title={
                  <>
                    {t("hero_line1")}{" "}
                    <Box as="span" color={ACCENT}>{t("hero_line2")}</Box>
                  </>
                }
                desc={t("hero_sub")}
              />
              <StageCopy op={copyB} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg} isAr={isAr}
                eyebrow={t("bento_countries_label")}
                title={<>{t("bento_title_1")} <Box as="span"><EmphText text={t("bento_title_2")} /></Box></>}
              />
              <StageCopy op={copyC} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg} isAr={isAr}
                eyebrow={t("sec_social_title_1")}
                title={<>{t("sec_social_title_1")}<br /><Box as="span" color={ACCENT}>{t("sec_social_title_2")}</Box></>}
                desc={t("sec_social_desc")}
              />
              {/* Rides the same beat as the transfer landing on the phone:
                  the fee strikes through to zero, and the sound the app
                  actually plays is offered (opt-in — browsers block
                  un-gestured audio, and a marketing page shouldn't ambush
                  anyone with noise). */}
              <motion.div
                style={{
                  opacity: copyC, position: "absolute", left: 0, right: 0, bottom: "-16px",
                  pointerEvents: "auto",
                }}
              >
                <HStack spacing="12px" flexWrap="wrap" justify={{ base: "center", lg: "flex-start" }}>
                  <FeeLedger
                    progress={scrollYProgress} at={RECEIPT_AT}
                    before="$2.40" after="$0.00" dark={dark} reduced={reducedMotion}
                  />
                  <SoundToggle
                    armed={chime.armed}
                    dark={dark}
                    onToggle={() => {
                      if (chime.armed) chime.disarm();
                      else if (chime.arm()) chime.play(); // confirm the choice audibly
                    }}
                  />
                </HStack>
              </motion.div>
              <StageCopy op={copyD} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg} isAr={isAr}
                eyebrow={t("feat_buy_eyebrow")}
                title={<Box as="span" color={textMain}>{t("feat_buy_title")}</Box>}
                desc={t("feat_buy_desc")}
                features={[
                  { icon: FiZap, label: t("feat_buy_f1") },
                  { icon: FiShield, label: t("feat_buy_f2") },
                  { icon: FiCreditCard, label: t("feat_buy_f3") },
                  { icon: FiGlobe, label: t("feat_buy_f4") },
                ]}
              />
              <StageCopy op={copyE} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg} isAr={isAr}
                eyebrow={t("feat_search_eyebrow")}
                title={<Box as="span" color={textMain}>{t("feat_search_title")}</Box>}
                desc={t("feat_search_desc")}
                features={[
                  { icon: FiSearch, label: t("feat_search_f1") },
                  { icon: FiActivity, label: t("feat_search_f2") },
                  { icon: FiBarChart2, label: t("feat_search_f3") },
                  { icon: FiZap, label: t("feat_search_f4") },
                ]}
              />
              <StageCopy op={copyF} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg} isAr={isAr}
                eyebrow={t("feat_pay_eyebrow")}
                title={<Box as="span" color={textMain}>{t("feat_pay_title")}</Box>}
                desc={t("feat_pay_desc")}
                features={[
                  { icon: FiCreditCard, label: t("feat_pay_f1") },
                  { icon: FiRepeat, label: t("feat_pay_f2") },
                  { icon: FiGlobe, label: t("feat_pay_f3") },
                  { icon: FiCheck, label: t("feat_pay_f4") },
                ]}
              />
              <StageCopy op={copyG} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg} isAr={isAr}
                eyebrow={t("feat_card_eyebrow")}
                title={<Box as="span" color={textMain}>{t("card_title")}</Box>}
                desc={t("card_desc")}
                features={[
                  { icon: FiGlobe,      label: t("card_f1") },
                  { icon: FiZap,        label: t("card_f2") },
                  { icon: FiShield,     label: t("card_f3") },
                  { icon: FiCreditCard, label: t("card_f4") },
                ]}
              />
            </Box>

            {/* PHONE column — sits RIGHT on desktop, ABOVE copy on mobile */}
            <Flex order={{ base: 1, lg: 2 }} justify="center"
              align={{ base: "center", lg: "center" }}
              position="relative"
              style={{ perspective: "1500px" }}
              pt={{ base: 10, sm: 8, lg: 0 }}
              pb={{ base: 2, lg: 0 }}
            >
              <Box position="relative" mx="auto" w="fit-content">
                {/* The old floating Visa art is hidden: screenshot stages now
                    carry the exact in-app card/top-up UI. */}
                <motion.div
                  aria-hidden
                  style={{
                    position: "absolute",
                    display: "none",
                    /* right: 102% puts the card's right edge flush with phone's left edge */
                    right: "108%",
                    top: "16%",
                    opacity: opCard,
                    x: cardX,
                    y: cardY,
                    rotate: cardRot,
                    zIndex: 5,
                    pointerEvents: "none",
                  }}
                >
                  {/* Desktop: large card beside phone */}
                  <Box
                    display={{ base: "none", lg: "block" }}
                    position="relative"
                    w="clamp(260px, 24vw, 420px)"
                    style={{ aspectRatio: "1.586" }}
                  >
                    <NextImage
                      src="/wallet.svg" alt="tazdan Wallet"
                      fill style={{ objectFit: "contain" }}
                      sizes="420px"
                    />
                  </Box>
                </motion.div>

                {/* Mobile visa card — appears below phone during stage G */}
                <motion.div
                  aria-hidden
                  style={{
                    position: "absolute",
                    display: "none",
                    bottom: "-26%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    opacity: opCard,
                    y: cardY,
                    rotate: cardRot,
                    zIndex: 5,
                    pointerEvents: "none",
                  }}
                >
                  <Box
                    display={{ base: "block", lg: "none" }}
                    position="relative"
                    w={{ base: "200px", sm: "240px", md: "280px" }}
                    style={{ aspectRatio: "1.586" }}
                  >
                    <NextImage
                      src="/wallet.svg" alt="tazdan Wallet"
                      fill style={{ objectFit: "contain" }}
                      sizes="280px"
                    />
                  </Box>
                </motion.div>

                {/* Flinch wrapper — gives the locked phone a little upward
                    bounce when the visitor lingers, nudging them to scroll. */}
                {/* ZOOM-OUT layer — the closing move. Everything inside rushes
                    at the viewer while `blackout` (rendered over the stage
                    below) takes the frame to black. */}
                <motion.div style={{ x: groupX, scale: zoomScale, opacity: zoomOpacity, transformOrigin: "50% 44%" }}>
                {/* Positioned wrapper: the trio siblings centre on THIS box, so
                    they start exactly behind the hero phone and fan out of it. */}
                <Box position="relative" style={{ perspective: "1600px", ["--ph" as string]: JOURNEY_PH } as React.CSSProperties}>

                <TrioSibling
                  progress={scrollYProgress} range={journeyTiming.trio as [number, number]}
                  exit={journeyTiming.screensOff as [number, number]}
                  side={-1} spread={trioSpread} endScale={trioEndScale}
                  label={t("tz_trio_a", "Budgets")} caption={t("tz_trio_a_sub", "Every plan its own pocket")}
                  dark={dark} reduced={reducedMotion}
                >
                  <StaticPhone phOverride={FILM_PH_TRIO}>
                    <ScreenStill shot={tazdanNewShot(2140)} alt="tazdan budgets" />
                  </StaticPhone>
                </TrioSibling>
                <TrioSibling
                  progress={scrollYProgress} range={journeyTiming.trio as [number, number]}
                  exit={journeyTiming.screensOff as [number, number]}
                  side={1} spread={trioSpread} endScale={trioEndScale}
                  label={t("tz_trio_c", "Card PIN")} caption={t("tz_trio_c_sub", "Biometric, auto-hides")}
                  dark={dark} reduced={reducedMotion}
                >
                  <StaticPhone phOverride={FILM_PH_TRIO}>
                    <ScreenStill shot={tazdanNewShot(2146)} alt="tazdan card PIN" />
                  </StaticPhone>
                </TrioSibling>

                <motion.div animate={flinch}>
                {/* rotateY carries the 360° unlock spin. `preserve-3d` plus the
                    back face below means the phone genuinely TURNS OVER —
                    without them you just see a mirrored screenshot sweep past. */}
                {/* Sizing + CSS vars live on a plain Box; the motion element
                    below carries only transforms, so the style object stays a
                    valid MotionStyle. */}
                <Box
                  style={{
                    ...phoneVars,
                    /* Big device — the sticky stage is a full 100vh and the old
                       42vh phone left most of it empty. Still clamped so it
                       fits a handset alongside the copy column. */
                    ["--ph" as string]: JOURNEY_PH,
                    width: "var(--pw)", height: "var(--ph)",
                    margin: "0 auto", position: "relative",
                  } as React.CSSProperties}
                >
                <motion.div
                  style={{
                    position: "absolute", inset: 0,
                    rotateX: tiltX, rotateY: spinY, scale: phoneScale,
                    transformOrigin: "50% 60%", transformStyle: "preserve-3d",
                  }}
                >
                {/* ── BACK OF THE PHONE ── only visible while the device is
                    turned away from the viewer mid-spin. The real product
                    render, trimmed of its transparent margin so its silhouette
                    lines up with the front frame (`objectFit: fill` closes the
                    last ~5% of aspect difference; imperceptible at spin speed
                    and better than the back visibly shrinking). */}
                <Box
                  aria-hidden
                  position="absolute"
                  inset={0}
                  style={{
                    transform: "rotateY(180deg)",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  } as React.CSSProperties}
                >
                  <NextImage
                    src="/iphone-18-pro-back.png"
                    alt=""
                    fill
                    sizes="(max-width: 480px) 55vw, (max-width: 1024px) 38vw, 320px"
                    style={{ objectFit: "fill" }}
                  />
                </Box>

                {/* ── FRONT OF THE PHONE ── */}
                <Box
                  position="absolute"
                  inset={0}
                  zIndex={3}
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  } as React.CSSProperties}
                >
                  <Box
                    position="absolute"
                    style={screenInset as React.CSSProperties}
                    overflow="hidden"
                    bg="#000000"
                    boxShadow="inset 0 0 0 1px rgba(255,255,255,0.04)"
                  >
                    {/* Whole screen stack dims to black BEFORE the closing zoom
                        — the device visibly powers off, then rushes forward. */}
                    <motion.div style={{ position: "absolute", inset: 0, opacity: screensOff }}>
                    {/* Dashboard fades to black after the home section so gaps
                        between feature stages never flash the home screen. */}
                    <motion.div style={{ ...stageLayerStyle, opacity: opHome }}>
                      <ScreenHomeShot priority />
                    </motion.div>
                    {/* Feature screens cross-fade above the dashboard */}
                    <motion.div style={{ ...stageLayerStyle, opacity: opChat }}>
                      <ScreenChatShot />
                    </motion.div>
                    <motion.div style={{ ...stageLayerStyle, opacity: opBuy }}>
                      <ScreenBuyShot />
                    </motion.div>
                    <motion.div style={{ ...stageLayerStyle, opacity: opSearch }}>
                      <ScreenAssetShot />
                    </motion.div>
                    <motion.div style={{ ...stageLayerStyle, opacity: opPay }}>
                      <ScreenTopUpShot />
                    </motion.div>
                    <motion.div style={{ ...stageLayerStyle, opacity: opCard }}>
                      <ScreenCardMainShot />
                    </motion.div>
                    {/* Lock screen sits on top, slides off with unlockProgress */}
                    {/* Centre of the trio — a screen the journey above never
                        showed, so the finale adds something instead of
                        repeating itself. */}
                    <motion.div style={{ ...stageLayerStyle, opacity: opFinale }}>
                      <ScreenStill shot={tazdanNewShot(2141)} alt="tazdan savings goal" />
                    </motion.div>
                    {/* The transfer lands ON the phone already on stage —
                        this is the beat the chime fires with. */}
                    <ReceiptOverlay
                      progress={scrollYProgress}
                      at={RECEIPT_AT}
                      amount="250"
                      asset="USDT"
                      dark={dark}
                      reduced={reducedMotion}
                    />
                    {/* Lock screen sits on top, slides off with unlockProgress */}
                    <LockScreen unlockProgress={unlockProgress} />
                    </motion.div>
                  </Box>
                  <NextImage
                    src="/iphone-frame.png"
                    alt=""
                    fill priority
                    sizes="(max-width: 480px) 55vw, (max-width: 1024px) 38vw, 320px"
                    style={{ objectFit: "contain", pointerEvents: "none", zIndex: 10 }}
                  />
                </Box>
              </motion.div>
              </Box>

              {/* Centre label — matches the two siblings so the finale reads as
                  three peers, not one phone with two accessories. */}
              <motion.div
                style={{
                  opacity: trioLabelOp,
                  position: "absolute", left: 0, right: 0,
                  top: "calc(50% + var(--ph) * 0.52)",
                  textAlign: "center", zIndex: 4, pointerEvents: "none",
                }}
              >
                <Text fontFamily="'DM Sans', sans-serif" fontSize={{ base: "12px", md: "14px" }} fontWeight={700} letterSpacing="-0.01em" color={textMain}>
                  {t("tz_trio_b", "Savings goals")}
                </Text>
                <Text fontFamily="'DM Sans', sans-serif" fontSize={{ base: "10px", md: "12px" }} color={textMuted} mt="2px">
                  {t("tz_trio_b_sub", "Auto-saving, every week")}
                </Text>
              </motion.div>
              </motion.div>
              </Box>
              </motion.div>

              {/* Scroll-to-explore cue — appears if the visitor lingers on the
                  locked phone, then vanishes the instant they scroll. The outer
                  Box spans the phone width and flex-centres the cue, so the
                  motion transform never fights the centering. */}
              <Box position="absolute" bottom="-13%" left={0} right={0} zIndex={11} display="flex" justifyContent="center" pointerEvents="none">
                <AnimatePresence>
                  {showHint && (
                    <motion.div
                      key="scroll-hint"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Flex direction="column" align="center" gap={2}>
                        <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
                          <Icon as={FiChevronUp} boxSize="22px" color={ACCENT} />
                        </motion.div>
                        <Box px={3.5} py={1.5} borderRadius="full" whiteSpace="nowrap"
                          bg={dark ? "rgba(20,24,30,0.55)" : "rgba(255,255,255,0.65)"}
                          border="1px solid" borderColor={dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
                          style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                          <Text fontSize="13px" fontWeight="700" letterSpacing="0.01em" color={textMain}>
                            {t("hero_scroll_explore")}
                          </Text>
                        </Box>
                      </Flex>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
              </Box>
            </Flex>
          </SimpleGrid>
        </Container>

        {/* ── Scroll-progress rail ── */}
        <Box position="absolute" left={0} right={0} bottom={0} h="2px"
          bg={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} zIndex={2}>
          <motion.div style={{
            width: useTransform(scrollYProgress, [0, 1], ["0%", "100%"]),
            height: "100%", background: ACCENT,
          }} />
        </Box>
        </Box>

        {/* ── Blackout ──────────────────────────────────────────────────
            The last thing that happens. As the phone rushes toward the
            viewer the stage fades to black, so the journey ends on a cut
            rather than sliding limply out of frame — and the section below
            arrives out of that black. pointerEvents stays off so it never
            swallows a click on the way past. */}
        <motion.div
          aria-hidden
          style={{
            position: "absolute", inset: 0, zIndex: 40,
            background: "#000", opacity: blackout, pointerEvents: "none",
          }}
        />
      </Box>
    </Box>
  );
}

function MinimalCtaSection({ dark, onJoinWaitlist }: { dark: boolean; onJoinWaitlist: () => void }) {
  const { t } = useTranslate();
  const isAr = useIsAr();
  const textMain = dark ? "#f5f5f7" : "#0a0a0a";
  const textSub = dark ? "rgba(245,245,247,0.62)" : "rgba(0,0,0,0.58)";
  const hairline = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const accent = "#63a1db";

  return (
    <Box as="section" px={{ base: 4, md: 10 }} py={{ base: 12, md: 16 }} position="relative" zIndex={1}>
      <Container maxW="900px" px={0}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <Box
            py={{ base: 9, md: 12 }}
          >
            <VStack spacing={5} textAlign="center" mx="auto">
              <Heading
                fontFamily="'DM Sans', sans-serif"
                fontWeight="800"
                fontSize={{ base: "32px", md: "54px" }}
                letterSpacing="-0.045em"
                lineHeight={isAr ? 1.18 : 1}
                color={textMain}
                maxW="700px"
              >
                {t("minimal_cta_title")}
              </Heading>
              <Text fontSize={{ base: "16px", md: "19px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.55} maxW="560px">
                {t("minimal_cta_desc")}
              </Text>
              <HStack
                as="button"
                type="button"
                onClick={onJoinWaitlist}
                h="46px"
                px={5}
                borderRadius="full"
                bg={accent}
                color="#fff"
                spacing={2}
                fontWeight="850"
                border="0"
                cursor="pointer"
                _hover={{ transform: "translateY(-1px)", boxShadow: "0 14px 30px rgba(99,161,219,0.28)" }}
                transition="all 0.2s ease"
              >
                <Text fontSize="14px">{t("minimal_cta_primary")}</Text>
                <Icon as={FiArrowRight} boxSize="15px" />
              </HStack>
            </VStack>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════════════════
   LANDING PAGE
   ═════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { colorMode } = useColorMode();
  const { t } = useTranslate();
  const dark = colorMode === "dark";
  const { isOpen: isWaitlistOpen, onOpen: onWaitlistOpen, onClose: onWaitlistClose } = useDisclosure();
  // Dark mode is a soft charcoal (matches the mobile app), not pitch black —
  // easier on the eyes and lets sections/cards read with depth.
  const pageBg = dark ? "#16181C" : "#ffffff";

  const textMain = dark ? "#ffffff" : "#0a0a0a";

  // No web app to redirect into — the landing page is marketing-only. Banking
  // lives in the mobile app; conversion happens through the waitlist.

  // Force body to match page background so blank gaps never show Chakra's
  // default surface colour through. (overflowX:clip was breaking sticky
  // paint in deep scroll — we use overflowX:hidden on the wrapper instead.)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.background;
    document.body.style.background = pageBg;
    // NOTE: document-level `scroll-snap-type: y proximity` was removed — it
    // collided with the hero's scroll-driven journey and the JS snap, causing
    // jank. Native momentum scrolling is smoother; section reveals are handled
    // by framer-motion + contentVisibility, not CSS snap.
    return () => {
      document.body.style.background = prev;
    };
  }, [pageBg]);

  return (
    <Box minH="100vh" color={textMain} bg={pageBg}>
      <PublicNav />

      {/* ── Hero: full-bleed looping video with a text overlay ── */}
      <VideoHero />

      {/* ── Manifesto: a pinned crossfade of three statements; the final line
          holds (sticks) as the last slide before you scroll on. ── */}
      <ScrollytellingManifesto />

      {/* ══════════════════════════════════════════════════════════════
          PHONE JOURNEY — the product shown in motion, immediately before the
          feature bento. Tilt → unlock → dashboard → chat → buy → pay.
          All copy is i18n — no hard-coded labels.
          ══════════════════════════════════════════════════════════════ */}
      <Box id="features">
        <PhoneJourney />
      </Box>

      {/* ── Feature bento: restrained, asymmetric outline cards on the page
          background — no generic grid boxes. ── */}
      <AppleBento />

      {/* One continuous background. Every band sits on the page colour (no
          alternating tint) — separated only by the sections' own rhythm and a
          faint hairline. contentVisibility: auto still skips off-screen paint. */}
      <SectionBand dark={dark} tone="plain" size="0 700px"><SectionOnRamp /></SectionBand>
      <SectionBand dark={dark} tone="plain" size="0 800px"><SectionPrepaidCards /></SectionBand>
      <SectionBand dark={dark} tone="plain" size="0 760px"><SectionClaimLink /></SectionBand>
      <SectionBand dark={dark} tone="plain" size="0 820px"><SectionGrowSave /></SectionBand>
      <SectionBand dark={dark} tone="plain" size="0 720px"><SectionSocialProof /></SectionBand>

      {/* ── Pattern-break closer — sits right above the footer ── */}
      <Box style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", scrollSnapAlign: "start", scrollSnapStop: "normal" } as React.CSSProperties}>
        <SectionPatternBreak />
      </Box>

      {/* ══ FOOTER ══ */}
      <Box position="relative" overflow="hidden">
        <MinimalCtaSection dark={dark} onJoinWaitlist={onWaitlistOpen} />
        <WaitlistModal isOpen={isWaitlistOpen} onClose={onWaitlistClose} />

        {/* ── JSON-LD structured data ──────────────────────────────── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FinancialService',
              name: 'tazdan',
              description:
                'Proposed LYD wallet, supported crypto services and international remittances for Libya.',
              url: 'https://tazdan.com',
              areaServed: ['LY'],
              currenciesAccepted: 'LYD',
              serviceType: ['Planned LYD wallet', 'Planned crypto services', 'Planned international remittances'],
              sameAs: [
                'https://twitter.com/tazdan',
                'https://t.me/tazdan',
              ],
            }),
          }}
        />

        <Box position="relative" zIndex={1}><PublicFooter /></Box>
      </Box>
    </Box>
  );
}
