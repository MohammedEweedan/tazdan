"use client";

import { useRef, useEffect, useState, memo, useMemo, useCallback } from "react";
import { useTranslate, useTolgee } from "@tolgee/react";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import NextImage from "next/image";
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Icon,
  SimpleGrid,
  Badge,
  useColorMode,
  useBreakpointValue,
  useDisclosure,
} from "@chakra-ui/react";
import {
  FiArrowRight, FiZap, FiGlobe, FiShield, FiCheck,
  FiBarChart2, FiActivity, FiLock,
  FiSend, FiWifi, FiRepeat, FiCreditCard,
  FiStar, FiBell, FiDollarSign, FiMessageCircle, FiUser,
  FiChevronLeft, FiChevronRight, FiMoreHorizontal, FiSmile, FiArrowUp,
  FiEye, FiSearch, FiChevronDown, FiChevronUp, FiMaximize2, FiClock,
  FiLink,
} from "react-icons/fi";
import { FaApple, FaGooglePlay, FaApplePay, FaGooglePay, FaCcVisa, FaCcMastercard } from "react-icons/fa";
import { SiRevolut } from "react-icons/si";
import {
  motion, useTransform, useMotionValue, useScroll, useSpring,
  MotionValue, AnimatePresence, useAnimationControls,
} from "framer-motion";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
// Lazy-mount the shader so its WebGL setup runs AFTER LCP. Until it
// hydrates the hero shows a static gradient (handled in CSS), keeping
// LCP image-driven instead of canvas-driven.
const ShaderAnimation = dynamic(
  () => import("@/components/ui/shader-lines").then((m) => m.ShaderAnimation),
  { ssr: false, loading: () => null },
);
import { IconLogo } from "@/components/ui/Logo";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import WaitlistModal from "@/components/ui/WaitlistModal";
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

const tazdanShot = (n: number) => `/screenshots/tazdan/${n}.png`;

const TAZDAN_SCREENS = {
  login: [tazdanShot(1)],
  dashboard: [tazdanShot(2), tazdanShot(3), tazdanShot(17)],
  markets: [tazdanShot(4), tazdanShot(5), tazdanShot(6), tazdanShot(7), tazdanShot(8)],
  messages: [tazdanShot(9), tazdanShot(10), tazdanShot(11)],
  profile: [tazdanShot(12), tazdanShot(13)],
  buy: [tazdanShot(14), tazdanShot(15), tazdanShot(16), tazdanShot(18)],
  cards: [
    tazdanShot(19),
    tazdanShot(20),
    tazdanShot(21),
    tazdanShot(22),
    tazdanShot(23),
    tazdanShot(24),
    tazdanShot(25),
    tazdanShot(26),
  ],
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
  const slides = images.length > 0 ? images : TAZDAN_SCREENS.dashboard;
  const slidesKey = slides.join("|");
  const [idx, setIdx] = useState(0);

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

  return (
    <Box position="absolute" inset={0} bg="#000" overflow="hidden">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={src}
          initial={{ opacity: 0, scale: 1.012 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.992 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "absolute", inset: 0, willChange: "opacity, transform" }}
        >
          <NextImage
            src={src}
            alt={alt}
            fill
            priority={priority && idx === 0}
            sizes="(max-width: 480px) 55vw, (max-width: 1024px) 38vw, 340px"
            style={{ objectFit: "cover" }}
          />
        </motion.div>
      </AnimatePresence>
    </Box>
  );
}

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

function LockedPhoneFace() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  const hh = now ? now.getHours().toString().padStart(2, "0") : "09";
  const mm = now ? now.getMinutes().toString().padStart(2, "0") : "41";
  const dateStr = now
    ? now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    : "";

  // Everything sizes off the phone height var (--ph) so the lock face scales
  // perfectly inside the mockup on every viewport — no awkward overflow on
  // small mobile phones.
  const v = (f: number) => `calc(var(--ph) * ${f})`;

  return (
    <Box position="absolute" inset={0} overflow="hidden" bg="#0A0A0B">
      {/* Brand wash — soft blue bloom up top, deep charcoal below */}
      <Box position="absolute" inset={0} style={{ background: "radial-gradient(125% 70% at 50% -6%, rgba(99,161,219,0.30), rgba(20,24,30,0.0) 58%), linear-gradient(180deg, #10141A 0%, #0A0A0B 70%)" }} />

      {/* Status-bar hint line (time-left / battery-right) — pure decoration */}
      <Flex position="absolute" top={v(0.028)} left={v(0.05)} right={v(0.05)} justify="space-between" align="center" opacity={0.75}>
        <Text color="#fff" fontWeight="700" style={{ fontSize: v(0.022) }} sx={{ fontVariantNumeric: "tabular-nums" }}>{hh}:{mm}</Text>
        <Box w={v(0.05)} h={v(0.022)} borderRadius={v(0.006)} border="1px solid rgba(255,255,255,0.55)" position="relative">
          <Box position="absolute" top="14%" bottom="14%" left="12%" w="68%" bg="rgba(255,255,255,0.85)" borderRadius={v(0.003)} />
        </Box>
      </Flex>

      <Flex direction="column" align="center" justify="space-between" position="absolute" inset={0} style={{ paddingTop: v(0.075), paddingBottom: v(0.015) }}>
        {/* Lock glyph */}
        <Flex align="center" justify="center" borderRadius="full" bg="rgba(255,255,255,0.12)" style={{ width: v(0.085), height: v(0.085), marginTop: v(0.05) }}>
          <Icon as={FiLock} color="rgba(255,255,255,0.95)" style={{ width: v(0.04), height: v(0.04) }} />
        </Flex>

        {/* Clock + date */}
        <VStack spacing={v(0.004)} mt={v(-0.03)}>
          <Text fontFamily="'DM Sans', sans-serif" fontWeight="600" color="#fff" lineHeight={0.92}
            style={{ fontSize: v(0.155) }} sx={{ fontVariantNumeric: "tabular-nums" }} letterSpacing="-0.045em">
            {hh}:{mm}
          </Text>
          <Text fontWeight="500" color="rgba(255,255,255,0.62)" style={{ fontSize: v(0.026) }} textTransform="capitalize">{dateStr}</Text>
        </VStack>

        {/* Gentle up-cue + slim home-indicator pinned near the very bottom */}
        <VStack spacing={v(0.022)}>
          <motion.div animate={{ y: ["0%", "-32%", "0%"], opacity: [0.45, 0.95, 0.45] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}>
            <Icon as={FiChevronUp} color="rgba(255,255,255,0.78)" style={{ width: v(0.045), height: v(0.045), display: "block" }} />
          </motion.div>
          <Box borderRadius="full" bg="rgba(255,255,255,0.9)" style={{ width: v(0.17), height: v(0.006) }} />
        </VStack>
      </Flex>
    </Box>
  );
}

const LockScreen = memo(function LockScreen({
  unlockProgress,
}: {
  unlockProgress: MotionValue<number>;
}) {
  const [failed, setFailed] = useState(false);
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

  useEffect(() => { ref.current?.play?.().catch(() => {}); }, [failed]);

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
      {failed ? (
        <LockedPhoneFace />
      ) : (
        <Box position="absolute" inset={0} bg="#0A0A0B" overflow="hidden">
          <video
            ref={ref}
            src="/recordings/lock.mp4"
            autoPlay loop muted playsInline preload="auto"
            onError={() => setFailed(true)}
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
        bg: "#16181C", surface: "#1E2127", border: "rgba(255,255,255,0.09)",
        fg: "#F4F5F7", fgMuted: "rgba(244,245,247,0.62)", fgFaint: "rgba(244,245,247,0.36)",
        green: "#3FCF8E", redFg: "#F87171", redBg: "rgba(248,113,113,0.14)",
        accent: "#63A1DB",
        ink: "#F4F5F7", inkFg: "#16181C",
        sheetBg: "#1E2127", sheetCard: "#262A31", sheetBorder: "rgba(255,255,255,0.09)",
        sheetFg: "#F4F5F7", sheetMuted: "rgba(244,245,247,0.62)", sheetFaint: "rgba(244,245,247,0.36)",
        sheetGreen: "#3FCF8E", sheetGreenBg: "rgba(63,207,142,0.14)", sheetGreenBd: "rgba(63,207,142,0.42)",
        sheetChip: "rgba(255,255,255,0.07)",
      }
    : {
        bg: "#FAFAF7", surface: "#F1F0EB", border: "rgba(10,10,11,0.08)",
        fg: "#0A0A0B", fgMuted: "rgba(10,10,11,0.62)", fgFaint: "rgba(10,10,11,0.38)",
        green: "#1F8F58", redFg: "#C0272D", redBg: "rgba(192,39,45,0.10)",
        accent: "#4F8BC4",
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
    { name: "US Dollar", amt: "991,357 USD", val: "$991,357.00", flag: "🇺🇸" },
    { name: "Euro", amt: "8,797 EUR", val: "$9,500.76", flag: "🇪🇺" },
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
              <Text style={{ fontSize: fs.balance }} color={APP.fg} fontWeight="800"
                letterSpacing="-0.04em" lineHeight={1}>{snap.bal}</Text>
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

      {/* Action buttons */}
      <HStack px={fs.px} pb="calc(var(--ph)*0.026)" spacing="calc(var(--pw)*0.03)"
        justify="center" flexShrink={0}>
        {["Buy", "Sell", "Top up"].map((b) => (
          <Flex key={b} style={{ height: fs.actH }} flex={1} bg={APP.ink} borderRadius="full"
            align="center" justify="center" px="calc(var(--pw)*0.02)">
            <Text style={{ fontSize: fs.actLabel }} color={APP.inkFg} fontWeight="700">{b}</Text>
          </Flex>
        ))}
        <Flex style={{ width: fs.actH, height: fs.actH, borderRadius: "50%" }} bg={APP.ink}
          align="center" justify="center" flexShrink={0}>
          <Icon as={FiMoreHorizontal} color={APP.inkFg}
            style={{ width: "calc(var(--ph)*0.024)", height: "calc(var(--ph)*0.024)" }} />
        </Flex>
      </HStack>

      {/* Tabs */}
      <HStack px={fs.px} spacing="calc(var(--pw)*0.06)" flexShrink={0}>
        {["Assets", "Wallets", "Activity"].map((tab, i) => (
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
              <Text style={{ fontSize: "calc(var(--ph)*0.03)" }}>{a.flag}</Text>
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

        {/* quick chips */}
        <HStack spacing="calc(var(--pw)*0.022)">
          {["£25", "£50", "£100", "£250", "£500"].map((c) => {
            const active = c === `£${step.amt}`;
            return (
              <Flex key={c} flex={1} h="calc(var(--ph)*0.04)" borderRadius="full"
                align="center" justify="center"
                bg={active ? APP.ink : APP.sheetCard}
                border={`1px solid ${active ? APP.ink : APP.sheetBorder}`}>
                <Text style={{ fontSize: fs.chip }} fontWeight="700"
                  color={active ? APP.inkFg : APP.sheetFg}>{c}</Text>
              </Flex>
            );
          })}
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
   TOKEN SEARCH SCREEN — matches the in-app "Search any token" sheet
   ═════════════════════════════════════════════════════════════════ */
const ScreenTokenSearch = memo(function ScreenTokenSearch() {
  const APP = appTokens(usePhoneDark());
  const px = "calc(var(--pw)*0.07)";
  const fs = {
    name:  "calc(var(--ph)*0.021)",
    sym:   "calc(var(--ph)*0.0155)",
    price: "calc(var(--ph)*0.019)",
    pct:   "calc(var(--ph)*0.0135)",
    label: "calc(var(--ph)*0.0135)",
    input: "calc(var(--ph)*0.018)",
  };
  const tokens = [
    { name: "Pepe",      sym: "PEPE",  price: "£0.00000381", pct: "+2.42%", up: true,  bg: "#dcefcf", emoji: "🐸" },
    { name: "BONK",      sym: "BONK",  price: "£0.00000625", pct: "+2.80%", up: true,  bg: "#5fd6d3" },
    { name: "Shiba Inu", sym: "SHIB",  price: "£0.00000584", pct: "+0.86%", up: true,  bg: "#f3d9d4", emoji: "🐕" },
    { name: "BTTC",      sym: "BTTC",  price: "£0.00000032", pct: "-3.03%", up: false, bg: "#4cd07d" },
    { name: "LUNC",      sym: "LUNC",  price: "£0.00007937", pct: "+3.32%", up: true,  bg: "#cf5b4e" },
    { name: "FLOKI",     sym: "FLOKI", price: "£0.00003079", pct: "+2.19%", up: true,  bg: "#8fd36b" },
    { name: "DOGS",      sym: "DOGS",  price: "£0.00005830", pct: "-1.69%", up: false, bg: "#6fcf97" },
  ];

  /* staggered result reveal loop */
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const atEnd = shown >= tokens.length;
    const id = setTimeout(() => setShown(atEnd ? 0 : shown + 1), atEnd ? 2600 : 230);
    return () => clearTimeout(id);
  }, [shown, tokens.length]);

  /* live-typing search query */
  const SQ = "Pepe coin (PEPE)".split("");
  const [si, setSi] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setSi((s) => (s > SQ.length + 9 ? 0 : s + 1)), 135);
    return () => clearTimeout(id);
  }, [si]);
  const query = SQ.slice(0, Math.min(si, SQ.length));

  return (
    <SheetScreen title="Search any token" heightFrac={0.88}>
      <Box flexShrink={0} px={px} pb="calc(var(--ph)*0.016)">
        <HStack bg={APP.sheetCard} border={`1px solid ${APP.sheetBorder}`} borderRadius="full"
          px="calc(var(--ph)*0.016)" py="calc(var(--ph)*0.013)" spacing="calc(var(--pw)*0.03)">
          <Icon as={FiSearch} color={APP.sheetFaint}
            style={{ width: "calc(var(--ph)*0.02)", height: "calc(var(--ph)*0.02)" }} />
          <Text style={{ fontSize: fs.input }} color={query ? APP.sheetFg : APP.sheetFaint} fontWeight="500">
            {query || "Bitcoin, ETH, SHIB, PEPE…"}
          </Text>
          <motion.div animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            style={{ width: "1.5px", height: "calc(var(--ph)*0.022)", background: "#63a1db" }} />
        </HStack>
      </Box>
      <Text flexShrink={0} px={px} pb="calc(var(--ph)*0.008)" style={{ fontSize: fs.label }}
        color={APP.sheetFaint} fontWeight="800" letterSpacing="0.08em">FEATURED</Text>
      <VStack align="stretch" spacing={0} flex={1} overflow="hidden">
        <AnimatePresence initial={false}>
          {tokens.slice(0, shown).map((tk) => (
            <motion.div key={tk.sym} layout
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              <HStack px={px} py="calc(var(--ph)*0.013)"
                spacing="calc(var(--pw)*0.04)" borderTop={`1px solid ${APP.sheetBorder}`}>
                <Flex style={{ width: "calc(var(--ph)*0.05)", height: "calc(var(--ph)*0.05)", borderRadius: "50%" }}
                  bg={tk.bg} align="center" justify="center" flexShrink={0}>
                  {tk.emoji && <Text style={{ fontSize: "calc(var(--ph)*0.026)" }}>{tk.emoji}</Text>}
                </Flex>
                <VStack align="start" spacing={0} flex={1} minW={0}>
                  <Text style={{ fontSize: fs.name }} color={APP.sheetFg} fontWeight="800">{tk.name}</Text>
                  <Text style={{ fontSize: fs.sym }} color={APP.sheetMuted} fontWeight="500">{tk.sym}</Text>
                </VStack>
                <VStack align="end" spacing="calc(var(--ph)*0.005)" flexShrink={0}>
                  <Text style={{ fontSize: fs.price }} color={APP.sheetFg} fontWeight="700">{tk.price}</Text>
                  <Box bg={tk.up ? APP.sheetGreenBg : "#fadfdb"} borderRadius="full"
                    px="calc(var(--pw)*0.03)" py="calc(var(--ph)*0.003)">
                    <Text style={{ fontSize: fs.pct }} fontWeight="700"
                      color={tk.up ? APP.sheetGreen : "#d0463a"}>{tk.pct}</Text>
                  </Box>
                </VStack>
              </HStack>
            </motion.div>
          ))}
        </AnimatePresence>
      </VStack>
    </SheetScreen>
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
   PHONE FRAME — screens perfectly inset to match iphone-frame.png
   ═════════════════════════════════════════════════════════════════ */
const PhoneFrame = memo(function PhoneFrame({
  unlockProgress,
}: {
  unlockProgress: MotionValue<number>;
}) {
  const dark = usePhoneDark();

  return (
    <Box
      position="relative"
      style={{ ...phoneVars, width: "var(--pw)", height: "var(--ph)" } as React.CSSProperties}
      mx="auto"
    >
      {/* Screen sits perfectly flush inside the phone frame image */}
      <Box
        position="absolute"
        style={screenInset as React.CSSProperties}
        overflow="hidden"
        bg={dark ? "#000000" : "#ffffff"}
        /* shadow gives depth between screen and frame */
        boxShadow={dark
          ? "inset 0 0 0 1px rgba(255,255,255,0.04)"
          : "inset 0 0 0 1px rgba(0,0,0,0.04)"}
      >
        <Box position="absolute" inset={0}>
          <ScreenDashboard />
        </Box>
        <LockScreen unlockProgress={unlockProgress} />
      </Box>

      <NextImage
        src="/iphone-frame.png"
        alt=""
        fill
        priority
        sizes="(max-width: 480px) 46vw, (max-width: 768px) 38vw, (max-width: 1024px) 28vw, 340px"
        style={{ objectFit: "contain", pointerEvents: "none", zIndex: 10 }}
      />
    </Box>
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
  phOverride?: string;
}) {
  const dark = usePhoneDark();
  const overrideVars = phOverride
    ? ({ "--ph": phOverride } as React.CSSProperties)
    : {};

  return (
    <Box
      position="relative"
      style={{ ...phoneVars, ...overrideVars, width: "var(--pw)", height: "var(--ph)" } as React.CSSProperties}
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
                <ScreenChat />
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
                  <Text fontSize="13px" color={textSub} fontWeight="700" letterSpacing="0.12em">USDT</Text>
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


function SectionBento() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg = dark ? "#242933" : "#FFFFFF";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const brand     = "#63a1db";
  const brandSoft = dark ? "#303744" : "#EEF3F8";
  const heroCardBg = dark
    ? "linear-gradient(145deg, #20242C 0%, #0B0D11 100%)"
    : "linear-gradient(145deg, #1C2027 0%, #050608 100%)";

  const stats = [
    { label: t("bento_security_title"), value: "", sub: t("bento_security_desc"), icon: FiShield, span: 2, hero: true },
    { label: t("bento_speed_title"), value: "<2s", sub: t("bento_speed_desc"), icon: FiZap, span: 1 },
    { label: t("bento_countries_label"), value: "120+", sub: t("bento_countries_desc"), icon: FiGlobe, span: 1 },
    { label: t("bento_pairs_label"), value: "400+", sub: "", icon: FiBarChart2, span: 1 },
    { label: t("bento_rating_label"), value: "4.2/5", sub: "", icon: FiStar, span: 1 },
  ];

  return (
    <Box py={{ base: 16, md: 32 }} px={{ base: 4, md: 10 }} position="relative" overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={1}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <VStack align="center" spacing={3} mb={{ base: 10, md: 16 }} textAlign="center">
            <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "32px", md: "56px", lg: "64px" }} letterSpacing="-0.04em" color={textMain} lineHeight={isAr ? 1.2 : 1.1}>
              {t("bento_title_1")}{" "}
              <Box as="span"><EmphText text={t("bento_title_2")} /></Box>
            </Heading>
          </VStack>
        </motion.div>
        <SimpleGrid columns={{ base: 2, sm: 2, md: 4 }} gap={{ base: 3, md: 4 }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.25 }} transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} style={{ gridColumn: s.span && s.span > 1 ? `span ${s.span}` : undefined }}>
              <Box h="100%" minH={{ base: s.span && s.span > 1 ? "140px" : "110px", md: "auto" }} p={{ base: s.span && s.span > 1 ? 5 : 4, md: 7 }} borderRadius={{ base: "20px", md: "28px" }}
                bg={(s as any).hero ? heroCardBg : cardBg}
                border="1px solid" borderColor={(s as any).hero ? (dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)") : cardBorder}
                color={(s as any).hero ? "white" : textMain}
                boxShadow={dark ? "0 20px 50px rgba(0,0,0,0.4)" : "0 20px 40px rgba(0,0,0,0.06)"}
                position="relative" overflow="hidden"
                transition="all 0.3s ease"
                _hover={{ transform: "translateY(-4px)", boxShadow: dark ? "0 24px 60px rgba(0,0,0,0.5)" : "0 24px 60px rgba(0,0,0,0.12)", borderColor: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}
              >
                <VStack align="start" spacing={{ base: 2, md: 4 }} position="relative">
                  <Flex w={{ base: "36px", md: "44px" }} h={{ base: "36px", md: "44px" }} borderRadius="12px"
                    bg={(s as any).hero ? "rgba(255,255,255,0.10)" : brandSoft}
                    border="1px solid"
                    borderColor={(s as any).hero ? "rgba(255,255,255,0.15)" : (dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)")}
                    align="center" justify="center"
                  >
                    <Icon as={s.icon} color={(s as any).hero ? "#fff" : textMain} boxSize={{ base: 5, md: 6 }} />
                  </Flex>
                  <Box>
                    <Text fontSize={{ base: "10px", md: "12px" }} fontWeight="700" letterSpacing="0.1em" opacity={0.6} mb={0.5} textTransform="uppercase">{s.label}</Text>
                    {s.value && <Heading fontSize={{ base: "28px", md: "44px", lg: "52px" }} fontWeight="900" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif" lineHeight={isAr ? 1.15 : 1}>{s.value}</Heading>}
                    {s.sub && <Text fontSize={{ base: "12px", md: "14px" }} opacity={0.8} mt={1} maxW="260px" fontWeight="500">{s.sub}</Text>}
                  </Box>
                </VStack>
              </Box>
            </motion.div>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}

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
function SectionBand({ children, dark, tone, size }: {
  children: React.ReactNode;
  dark: boolean;
  tone: "tint" | "plain";
  size: string;
}) {
  const tint = tone === "tint";
  const sectionBg = tint
    ? (dark ? "#1B1F25" : "#F5F7FA")
    : (dark ? "#16181C" : "#FFFFFF");

  return (
    <Box
      position="relative"
      borderTop="1px solid"
      borderColor={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.045)"}
      bg={sectionBg}
      // scrollSnapAlign makes each post-hero chapter a gentle snap point
      // (the document sets `scroll-snap-type: y proximity`, so it only
      // nudges into place when you settle near a section — never traps).
      style={{ contentVisibility: "auto", containIntrinsicSize: size, scrollSnapAlign: "start", scrollSnapStop: "normal" } as React.CSSProperties}
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
  const cadences = [t("rb_cad_daily"), t("rb_cad_weekly"), t("rb_cad_biweekly"), t("rb_cad_monthly")];
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
        <Flex gap={2} flexWrap="wrap" justify={{ base: "center", md: "start" }}>
          {cadences.map((c, i) => (
            <HStack key={i} spacing={1.5} px={3} h="32px" borderRadius="full" bg={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)"} border="1px solid" borderColor={cardBorder}>
              <Icon as={FiClock} boxSize="12px" color={textSub} />
              <Text fontSize="13px" fontWeight="600" color={textMain}>{c}</Text>
            </HStack>
          ))}
        </Flex>
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
  const uses = [
    { label: t("bg_use_trips"), icon: FiGlobe },
    { label: t("bg_use_expenses"), icon: FiDollarSign },
    { label: t("bg_use_occasions"), icon: FiStar },
    { label: t("bg_use_targets"), icon: FiBarChart2 },
  ];

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
        <Flex gap={2} flexWrap="wrap" justify={{ base: "center", md: "start" }}>
          {uses.map((u, i) => (
            <HStack key={i} spacing={1.5} px={3} h="32px" borderRadius="full" bg={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)"} border="1px solid" borderColor={cardBorder}>
              <Icon as={u.icon} boxSize="12px" color={textSub} />
              <Text fontSize="13px" fontWeight="600" color={textMain}>{u.label}</Text>
            </HStack>
          ))}
        </Flex>
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

/* ═════════════════════════════════════════════════════════════════
   PATTERN BREAK — full-bleed inverted statement that sits right above
   the footer. Breaks the card-grid rhythm: a black (or white) canvas,
   one oversized line, a slow marquee of every feature, and a single
   restrained CTA. Apple "Hello" closer energy.
   ═════════════════════════════════════════════════════════════════ */
function SectionPatternBreak() {
  const { t } = useTranslate();
  const isAr = useIsAr();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

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
  const loop = [...marqueeItems, ...marqueeItems];

  return (
    <Box position="relative" overflow="hidden" py={{ base: 24, md: 36 }}>
      {/* Monochrome light wash behind the statement — no colour */}
      <motion.div
        animate={{ opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", top: "8%", left: "50%", width: 1100, height: 540,
          transform: "translateX(-50%)", borderRadius: "50%",
          pointerEvents: "none" }}
      />
      <Container maxW="1200px" position="relative" zIndex={1}>
        <VStack spacing={{ base: 8, md: 12 }} align="center" textAlign="center">
          <ScrollFade>
            <VStack spacing={5}>
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="700"
                fontSize={{ base: "48px", md: "88px", lg: "108px" }}
                letterSpacing="-0.05em" lineHeight={isAr ? 1.15 : 0.95} maxW="1000px"
              >
                <EmphText text={t("pb_title")} />
              </Heading>
              <Text fontSize={{ base: "17px", md: "21px" }} maxW="560px" lineHeight={isAr ? 1.75 : 1.5} fontWeight="400">
                {t("pb_sub")}
              </Text>
            </VStack>
          </ScrollFade>
        </VStack>
      </Container>

      {/* Full-bleed feature marquee — RTL-aware (animate the correct way so
          Arabic doesn't scroll the wrong direction / stall). The track itself
          is forced LTR so the duplicated halves tile predictably. */}
      <Box position="relative" mt={{ base: 12, md: 16 }} py={{ base: 5, md: 7 }}
        borderColor="rgba(255,255,255,0.08)"
        dir="ltr"
        style={{
          maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
        }}
      >
        <motion.div
          animate={{ x: isAr ? ["-50%", "0%"] : ["0%", "-50%"] }}
          transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
          style={{ display: "flex", width: "max-content", gap: 0 }}
        >
          {loop.map((item, i) => (
            <HStack
              key={`${item.label}-${i}`}
              spacing={{ base: 2.5, md: 3.5 }}
              h={{ base: "54px", md: "68px" }}
              px={{ base: 4, md: 6 }}
              mx={{ base: 1.5, md: 2 }}
              flexShrink={0}
              borderRadius="full"
              bg={dark ? "#63a1db" : "#63a1db"}
            >
              <Flex
                w={{ base: "30px", md: "36px" }}
                h={{ base: "30px", md: "36px" }}
                borderRadius="full"
                align="center"
                justify="center"
                bg={dark ? "#2A303B" : "#F2F5F8"}
                flexShrink={0}
              >
                <Icon as={item.icon} boxSize={{ base: "15px", md: "18px" }} color={dark ? "#f5f5f7" : "#0a0a0a"} />
              </Flex>
              <Text
                fontFamily="'DM Sans', sans-serif"
                fontWeight="850"
                fontSize={{ base: "19px", md: "28px" }}
                letterSpacing="-0.03em"
                whiteSpace="nowrap"
                color={dark ? "#f5f5f7" : "#0a0a0a"}
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
  const cardBg = dark ? "#20252E" : "#FFFFFF";
  const logoBg = dark ? "#2A303B" : "#F5F7FA";
  const border = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)";
  const mutedBorder = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

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
      py={{ base: 14, md: 18 }}
      overflow="hidden"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 520px" } as React.CSSProperties}
    >
      <Container maxW="1180px" px={0}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 8, lg: 12 }} alignItems="center">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <VStack align={{ base: "center", lg: "start" }} textAlign={{ base: "center", lg: "start" }} spacing={4}>
              <Heading
                fontFamily="'DM Sans', sans-serif"
                fontWeight="850"
                fontSize={{ base: "32px", md: "48px" }}
                letterSpacing="-0.045em"
                lineHeight={isAr ? 1.18 : 1}
                color={textMain}
                maxW="520px"
              >
                {t("partners_title")}
              </Heading>
              <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.6} maxW="560px">
                {t("partners_sub")}
              </Text>
            </VStack>
          </motion.div>

          <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3.5}>
            {partners.map((partner, i) => (
              <motion.div
                key={partner.name}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4 }}
              >
                <Box
                  minH={{ base: "190px", sm: "230px" }}
                  h="100%"
                  bg={cardBg}
                  border="1px solid"
                  borderColor={border}
                  borderRadius="24px"
                  p={{ base: 5, md: 5 }}
                  boxShadow={dark ? "0 22px 54px rgba(0,0,0,0.30)" : "0 22px 54px rgba(0,0,0,0.07)"}
                >
                  <VStack h="100%" align="start" justify="space-between" spacing={5}>
                    <Flex
                      w="100%"
                      h="76px"
                      align="center"
                      justify="center"
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

                    <VStack align="start" spacing={2}>
                      <Heading fontFamily="'DM Sans', sans-serif" fontSize="21px" fontWeight="850" color={textMain} letterSpacing="-0.025em">
                        {partner.name}
                      </Heading>
                      <Text fontSize="12px" fontWeight="850" color={textMain} lineHeight={1.25}>
                        {partner.role}
                      </Text>
                      <Text fontSize="12.5px" color={textSub} lineHeight={isAr ? 1.7 : 1.5}>
                        {partner.tagline}
                      </Text>
                    </VStack>
                  </VStack>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>
        </SimpleGrid>
      </Container>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════════════════
   tazdan BUSINESS — B2B landing teaser linking to /business
   ═════════════════════════════════════════════════════════════════ */
function SectionBusiness() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain  = dark ? "#ffffff" : "#0a0a0a";
  const textSub   = dark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.50)";
  const hairline  = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const surface   = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)";
  const ACCENT    = "#63a1db";

  const pillars = [
    { label: t("biz_f1_title"), value: t("biz_f1_desc") },
    { label: t("biz_f2_title"), value: t("biz_f2_desc") },
    { label: t("biz_f3_title"), value: t("biz_f3_desc") },
    { label: t("biz_f4_title"), value: t("biz_f4_desc") },
  ];

  return (
    <Box
      position="relative" overflow="hidden"
      py={{ base: 24, md: 36 }} px={{ base: 5, md: 10 }}
      borderTop="1px solid" borderColor={hairline}
    >
      <Container maxW="1200px">
        {/* ── Two-col editorial layout ── */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 14, lg: 20 }}>

          {/* LEFT — headline + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <VStack align="start" spacing={{ base: 6, md: 8 }} h="100%" justify="space-between">
              <VStack align="start" spacing={5}>
                {/* Eyebrow label */}
                <Text
                  fontSize="11px" fontWeight="800" letterSpacing="0.14em"
                  textTransform="uppercase"
                >
                  tazdan Business
                </Text>

                <Heading
                  fontFamily="'DM Sans', sans-serif" fontWeight="800"
                  fontSize={{ base: "36px", md: "52px", lg: "64px" }}
                  letterSpacing="-0.04em" lineHeight={isAr ? 1.2 : 1.00} color={textMain}
                >
                  {t("biz_headline_1")}{" "}
                  <Box as="span"><EmphText text={t("biz_headline_2")} /></Box>
                </Heading>

                <Text
                  fontSize={{ base: "15px", md: "17px" }} color={textSub}
                  lineHeight={isAr ? 1.75 : 1.65} maxW="480px"
                >
                  {t("biz_sub")}
                </Text>
              </VStack>

              {/* CTAs */}
              <HStack spacing={3} flexWrap="wrap">
                <NextLink href="/business" passHref legacyBehavior>
                  <HStack as="a" spacing={2} px={5} h="46px" borderRadius="12px"
                    bg={ACCENT} color="#fff" cursor="pointer"
                    transition="all 0.22s ease"
                    _hover={{ transform: "translateY(-1px)", boxShadow: "0 10px 24px rgba(99,161,219,0.40)" }}
                  >
                    <Text fontWeight="800" fontSize="14px">{t("biz_cta_primary")}</Text>
                    <Icon as={FiArrowRight} boxSize="15px" />
                  </HStack>
                </NextLink>
                <NextLink href="/register?type=business" passHref legacyBehavior>
                  <Box as="a" cursor="pointer">
                    <HStack spacing={1.5} color={textSub}
                      _hover={{ color: textMain }}
                      transition="color 0.2s ease"
                    >
                      <Text fontWeight="700" fontSize="14px">{t("biz_cta_secondary")}</Text>
                      <Icon as={FiArrowRight} boxSize="13px" />
                    </HStack>
                  </Box>
                </NextLink>
              </HStack>
            </VStack>
          </motion.div>

          {/* RIGHT — feature list */}
          <VStack align="stretch" spacing={0} divider={<Box h="1px" bg={hairline} />}>
            {pillars.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              >
                <Box
                  py={{ base: 5, md: 6 }}
                  _hover={{ "& .biz-label": { color: textMain } }}
                  transition="all 0.2s ease"
                  cursor="default"
                >
                  <HStack align="start" spacing={6}>
                    <Text
                      className="biz-label"
                      fontSize={{ base: "13px", md: "14px" }} fontWeight="800"
                      color={textSub} letterSpacing="-0.01em"
                      minW={{ base: "120px", md: "160px" }}
                      transition="color 0.2s ease"
                    >
                      {p.label}
                    </Text>
                    <Text fontSize={{ base: "13px", md: "14px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.6} flex={1}>
                      {p.value}
                    </Text>
                  </HStack>
                </Box>
              </motion.div>
            ))}
          </VStack>

        </SimpleGrid>
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

function SectionSocialProof() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const isAr = useIsAr();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobileDevice = typeof window !== "undefined" && window.innerWidth < 768;
  const avatars = [
    { src: "/screenshots/p1.avif", top: "12%", left: "20%", sizeBase: 56, sizeMd: 88,  delay: 0.0,  floatDelay: 0   },
    { src: "/screenshots/p2.avif", top: "8%",  left: "48%", sizeBase: 62, sizeMd: 96,  delay: 0.07, floatDelay: 0.6 },
    { src: "/screenshots/p3.avif", top: "16%", left: "78%", sizeBase: 70, sizeMd: 110, delay: 0.14, floatDelay: 1.2 },
    { src: "/screenshots/p4.avif", top: "58%", left: "10%", sizeBase: 56, sizeMd: 84,  delay: 0.21, floatDelay: 0.4 },
    { src: "/screenshots/p5.avif", top: "60%", left: "84%", sizeBase: 58, sizeMd: 88,  delay: 0.28, floatDelay: 0.9 },
    { src: "/screenshots/p6.avif", top: "86%", left: "50%", sizeBase: 68, sizeMd: 100, delay: 0.35, floatDelay: 0.2 },
  ];
  return (
    <Box position="relative" overflow="hidden" py={{ base: 16, md: 28 }} px={{ base: 4, md: 10 }}>
      {/* Ambient radial glow */}
      <motion.div
        animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", top: "50%", left: "50%",
          width: 700, height: 700, borderRadius: "50%",
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle, rgba(99,161,219,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <Container maxW="1200px" position="relative" zIndex={2}>
        <Box position="relative" w="100%" mx="auto" maxW={{ base: "100%", md: "960px" }} h={{ base: "560px", md: "640px" }}>
          {avatars.map((a) => (
            <motion.div
              key={a.src}
              initial={{ opacity: 0, scale: 0.4, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.65, delay: a.delay, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "absolute", top: a.top, left: a.left, transform: "translate(-50%, -50%)", zIndex: 1 }}
            >
              <motion.div
                animate={(!prefersReducedMotion && !isMobileDevice) ? { y: [0, -12, 0] } : {}}
                transition={{ duration: 4.5 + (a.floatDelay % 2.5), delay: a.floatDelay, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.1, zIndex: 10 }}
              >
                <Box
                  w={{ base: `${a.sizeBase}px`, md: `${a.sizeMd}px` }}
                  h={{ base: `${a.sizeBase}px`, md: `${a.sizeMd}px` }}
                  borderRadius="full" overflow="hidden"
                  border="2px solid"
                  borderColor={dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"}
                  boxShadow={dark
                    ? "0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)"
                    : "0 16px 48px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04)"}
                  transition="all 0.3s ease"
                  _hover={{ borderColor: "#63a1db", boxShadow: "0 20px 60px rgba(99,161,219,0.25)" }}
                  position="relative"
                  bg={dark ? "#111" : "#e8e8e8"}
                >
                  <NextImage src={a.src} alt="" fill style={{ objectFit: "cover" }} sizes="120px" />
                </Box>
              </motion.div>
            </motion.div>
          ))}
          <Box
            position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)"
            zIndex={2} textAlign="center" pointerEvents="none"
            w={{ base: "82%", md: "auto" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="900"
                fontSize={{ base: "28px", md: "44px", lg: "56px" }}
                letterSpacing="-0.04em" lineHeight={isAr ? 1.2 : 1.1}
                color={textMain}
                maxW={{ base: "280px", md: "540px" }}
                mx="auto"
                style={{ textShadow: dark ? "0 2px 40px rgba(0,0,0,0.6)" : "0 2px 20px rgba(255,255,255,0.8)" }}
              >
                {t("socialproof_label")}
              </Heading>
            </motion.div>
          </Box>
        </Box>
      </Container>
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
function useHeroSnap(ref: React.RefObject<HTMLDivElement>, stages: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let snapEndTimer: ReturnType<typeof setTimeout> | null = null;
    let snapping = false;
    let lastY = window.scrollY;
    let lastTime = performance.now();

    const onScroll = () => {
      if (snapping) return;

      const now = performance.now();
      const currentY = window.scrollY;
      const velocity = Math.abs((currentY - lastY) / Math.max(1, now - lastTime));
      lastY = currentY;
      lastTime = now;

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        if (total <= 0) return;
        const scrolled = -rect.top;
        if (scrolled < 0 || scrolled > total) return;
        const seg = total / (stages - 1);
        const idx = Math.round(scrolled / seg);
        const targetScrolled = idx * seg;
        const delta = targetScrolled - scrolled;
        if (Math.abs(delta) < 4) return;
        if (Math.abs(delta) > seg * 0.52) return;
        // Let high-velocity flicks settle before choosing a chapter.
        if (velocity > 1.4) return;
        snapping = true;
        window.scrollTo({ top: window.scrollY + delta, behavior: "smooth" });
        const estDuration = Math.min(620, Math.max(180, Math.abs(delta) * 1.25));
        if (snapEndTimer) clearTimeout(snapEndTimer);
        snapEndTimer = setTimeout(() => { snapping = false; }, estDuration);
      }, 110);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (settleTimer) clearTimeout(settleTimer);
      if (snapEndTimer) clearTimeout(snapEndTimer);
    };
  }, [ref, stages]);
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
     5 pay-with sheet, 6 cards. */

  const tiltX          = useTransform(scrollYProgress, [0, 0.12], [22, 0]);
  const unlockProgress = useTransform(scrollYProgress, [0.04, 0.13], [0, 1]);

  // screen cross-fades — dashboard is always the base layer, other chapters
  // have compact windows so copy and phone never visually stack together.
  const opChat   = useTransform(scrollYProgress, [0.265, 0.300, 0.365, 0.400], [0, 1, 1, 0]);
  const opBuy    = useTransform(scrollYProgress, [0.432, 0.467, 0.532, 0.568], [0, 1, 1, 0]);
  const opSearch = useTransform(scrollYProgress, [0.598, 0.633, 0.698, 0.735], [0, 1, 1, 0]);
  const opPay    = useTransform(scrollYProgress, [0.765, 0.800, 0.865, 0.902], [0, 1, 1, 0]);
  const opCard   = useTransform(scrollYProgress, [0.925, 0.960, 1.000], [0, 1, 1]);

  const yChat   = useTransform(scrollYProgress, [0.265, 0.333, 0.400], [34, 0, -34]);
  const yBuy    = useTransform(scrollYProgress, [0.432, 0.500, 0.568], [34, 0, -34]);
  const ySearch = useTransform(scrollYProgress, [0.598, 0.667, 0.735], [34, 0, -34]);
  const yPay    = useTransform(scrollYProgress, [0.765, 0.833, 0.902], [34, 0, -34]);
  const yCard   = useTransform(scrollYProgress, [0.925, 1.000], [28, 0]);
  const scaleChat   = useTransform(scrollYProgress, [0.265, 0.333, 0.400], [1.035, 1, 1.025]);
  const scaleBuy    = useTransform(scrollYProgress, [0.432, 0.500, 0.568], [1.035, 1, 1.025]);
  const scaleSearch = useTransform(scrollYProgress, [0.598, 0.667, 0.735], [1.035, 1, 1.025]);
  const scalePay    = useTransform(scrollYProgress, [0.765, 0.833, 0.902], [1.035, 1, 1.025]);
  const scaleCard   = useTransform(scrollYProgress, [0.925, 1.000], [1.035, 1]);
  // Visa card slides in from the left (card lives left of the phone on desktop)
  const cardX    = useTransform(scrollYProgress, [0.82, 0.96], [-80,  0]);
  const cardY    = useTransform(scrollYProgress, [0.82, 0.96], [40,   0]);
  const cardRot  = useTransform(scrollYProgress, [0.82, 0.96], [-10, -3]);

  // copy cross-fades — slightly lead the matching screen
  const copyA = useTransform(scrollYProgress, [0.000, 0.070, 0.125, 0.165], [1, 1, 1, 0]);
  const copyB = useTransform(scrollYProgress, [0.100, 0.135, 0.198, 0.235], [0, 1, 1, 0]);
  const copyC = useTransform(scrollYProgress, [0.265, 0.300, 0.365, 0.400], [0, 1, 1, 0]);
  const copyD = useTransform(scrollYProgress, [0.432, 0.467, 0.532, 0.568], [0, 1, 1, 0]);
  const copyE = useTransform(scrollYProgress, [0.598, 0.633, 0.698, 0.735], [0, 1, 1, 0]);
  const copyF = useTransform(scrollYProgress, [0.765, 0.800, 0.865, 0.902], [0, 1, 1, 0]);
  const copyG = useTransform(scrollYProgress, [0.925, 0.960, 1.000], [0, 1, 1]);

  // shader background — present at start, fades gently as journey progresses
  const shaderOp = useTransform(scrollYProgress, [0, 0.25, 0.80, 1], [0.85, 0.60, 0.25, 0.08]);
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
    <Box ref={ref} position="relative" h={{ base: "700vh", md: "700vh" }}>
      <Box position="sticky" top={0} h="100vh" w="100%" overflow="hidden"
        style={{ contain: "layout" } as React.CSSProperties}
      >
        {/* ── Shader background — centered, fills viewport ── */}
        <motion.div
          aria-hidden
          style={{
            position: "absolute", inset: 0, opacity: shaderOp,
            pointerEvents: "none", zIndex: 0,
          }}
        >
          {/* Shader has transparent bg — normal blend works for both light & dark */}
          <Box position="absolute" inset={0}>
            <ShaderAnimation />
          </Box>
        </motion.div>

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
                {/* ── Floating Visa card — large, slides in to the LEFT of phone during stage G ── */}
                <motion.div
                  aria-hidden
                  style={{
                    position: "absolute",
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
                <motion.div animate={flinch}>
                <motion.div style={{ rotateX: tiltX, scale: phoneScale, transformOrigin: "50% 60%" }}>
                <Box
                  position="relative"
                  style={{
                    ...phoneVars,
                    /* Larger phone so it reads well on every viewport */
                    ["--ph" as string]: "clamp(260px, 42vh, 640px)",
                    width: "var(--pw)", height: "var(--ph)",
                  } as React.CSSProperties}
                  mx="auto"
                >
                  <Box
                    position="absolute"
                    style={screenInset as React.CSSProperties}
                    overflow="hidden"
                    bg={phoneDark ? "#000000" : "#ffffff"}
                    boxShadow={phoneDark
                      ? "inset 0 0 0 1px rgba(255,255,255,0.04)"
                      : "inset 0 0 0 1px rgba(0,0,0,0.04)"}
                  >
                    {/* Base: dashboard recording, always rendered (falls back
                        to the screenshot slideshow until a clip is uploaded). */}
                    <Box position="absolute" inset={0}>
                      <ScreenMedia
                        clip="dashboard"
                        images={TAZDAN_SCREENS.dashboard}
                        priority
                        intervalMs={3000}
                        alt="tazdan wallet dashboard recording"
                      />
                    </Box>
                    {/* Feature recordings cross-fade above the dashboard */}
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opChat, y: yChat, scale: scaleChat, willChange: "opacity, transform" }}>
                      <ScreenMedia
                        clip="chat"
                        images={TAZDAN_SCREENS.messages}
                        intervalMs={2800}
                        alt="tazdan payment messages recording"
                      />
                    </motion.div>
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opBuy, y: yBuy, scale: scaleBuy, willChange: "opacity, transform" }}>
                      <ScreenMedia
                        clip="buy"
                        images={TAZDAN_SCREENS.buy}
                        intervalMs={2600}
                        alt="tazdan buy flow recording"
                      />
                    </motion.div>
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opSearch, y: ySearch, scale: scaleSearch, willChange: "opacity, transform" }}>
                      <ScreenMedia
                        clip="markets"
                        images={TAZDAN_SCREENS.markets}
                        intervalMs={2900}
                        alt="tazdan market detail recording"
                      />
                    </motion.div>
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opPay, y: yPay, scale: scalePay, willChange: "opacity, transform" }}>
                      <ScreenMedia
                        clip="pay"
                        images={[tazdanShot(14), tazdanShot(15), tazdanShot(16), tazdanShot(18)]}
                        intervalMs={2500}
                        alt="tazdan pay with balance recording"
                      />
                    </motion.div>
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opCard, y: yCard, scale: scaleCard, willChange: "opacity, transform" }}>
                      <ScreenMedia
                        clip="cards"
                        images={TAZDAN_SCREENS.cards}
                        intervalMs={2400}
                        alt="tazdan card recording"
                      />
                    </motion.div>
                    {/* Lock screen sits on top, slides off with unlockProgress */}
                    <LockScreen unlockProgress={unlockProgress} />
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
    </Box>
  );
}

/* ─── Device OS detection — runs once on mount ──────────────────── */
const IOS_URL     = "https://apps.apple.com/app/tazdan/id0000000000";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.tazdan.app";

function useDeviceOS(): "ios" | "android" | "other" {
  const [os, setOS] = useState<"ios" | "android" | "other">("other");
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) setOS("ios");
    else if (/Android/i.test(ua)) setOS("android");
  }, []);
  return os;
}

function FinalCtaSection({
  dark,
  deviceOS,
}: {
  dark: boolean;
  deviceOS: "ios" | "android" | "other";
}) {
  const { t } = useTranslate();
  const isAr = useIsAr();
  const textMain = dark ? "#f5f5f7" : "#0a0a0a";
  const textSub = dark ? "rgba(245,245,247,0.62)" : "rgba(0,0,0,0.58)";
  const panelBg = dark ? "#20252E" : "#FFFFFF";
  const tileBg = dark ? "#2A303B" : "#F5F7FA";
  const hairline = dark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.09)";
  const accent = "#63a1db";

  const capabilities = [
    { icon: FiBarChart2, label: t("cta_cap_spot") },
    { icon: FiRepeat, label: t("cta_cap_p2p") },
    { icon: FiSend, label: t("cta_cap_handles") },
    { icon: FiLink, label: t("cta_cap_claimlinks") },
    { icon: FiCreditCard, label: t("cta_cap_cards") },
    { icon: FiShield, label: t("cta_cap_wallets") },
  ];

  const steps = [
    {
      step: "01",
      title: t("cta_step1_title"),
      desc: t("cta_step1_desc"),
    },
    {
      step: "02",
      title: t("cta_step2_title"),
      desc: t("cta_step2_desc"),
    },
    {
      step: "03",
      title: t("cta_step3_title"),
      desc: t("cta_step3_desc"),
    },
  ];

  const stores =
    deviceOS === "ios"
      ? [{ label: t("cta_on_ios"), icon: FaApple, href: IOS_URL }]
      : deviceOS === "android"
        ? [{ label: t("cta_on_android"), icon: FaGooglePlay, href: ANDROID_URL }]
        : [
            { label: t("cta_on_ios"), icon: FaApple, href: IOS_URL },
            { label: t("cta_on_android"), icon: FaGooglePlay, href: ANDROID_URL },
          ];

  return (
    <Box px={{ base: 4, md: 10 }} py={{ base: 14, md: 20 }} position="relative" zIndex={1}>
      <Container maxW="1180px" px={0}>
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <Box
            position="relative"
            overflow="hidden"
            borderRadius={{ base: "28px", md: "36px" }}
            border="1px solid"
            borderColor={hairline}
            bg={panelBg}
            boxShadow={dark ? "0 34px 90px rgba(0,0,0,0.36)" : "0 34px 90px rgba(0,0,0,0.10)"}
            p={{ base: 6, md: 9 }}
          >
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 9, lg: 12 }} position="relative" zIndex={1}>
              <VStack align={{ base: "center", lg: "start" }} textAlign={{ base: "center", lg: "left" }} spacing={6}>

                <VStack align={{ base: "center", lg: "start" }} spacing={3}>
                  <Heading
                    fontFamily="'DM Sans', sans-serif"
                    fontWeight="850"
                    fontSize={{ base: "34px", md: "54px", lg: "64px" }}
                    letterSpacing="-0.05em"
                    lineHeight={isAr ? 1.18 : 0.96}
                    color={textMain}
                    maxW="620px"
                  >
                    {t("cta_title")}
                  </Heading>
                  <Text fontSize={{ base: "16px", md: "19px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.55} maxW="560px">
                    {t("cta_desc")}
                  </Text>
                </VStack>

                <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={2.5} w="100%" maxW="560px">
                  {capabilities.map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.035, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <HStack
                        h="44px"
                        borderRadius="14px"
                        px={3}
                        bg={tileBg}
                        border="1px solid"
                        borderColor={hairline}
                        spacing={2.5}
                      >
                        <Icon as={item.icon} boxSize="15px" color={textMain} />
                        <Text fontSize="13px" fontWeight="800" color={textMain} noOfLines={1}>
                          {item.label}
                        </Text>
                      </HStack>
                    </motion.div>
                  ))}
                </SimpleGrid>

                <Flex gap={3} flexWrap="wrap" justify={{ base: "center", lg: "start" }}>
                  <NextLink href="/register" passHref legacyBehavior>
                    <HStack
                      as="a"
                      h="48px"
                      px={5}
                      borderRadius="full"
                      bg={accent}
                      color="#fff"
                      spacing={2}
                      fontWeight="850"
                      _hover={{ transform: "translateY(-1px)", boxShadow: "0 14px 30px rgba(99,161,219,0.36)" }}
                      transition="all 0.2s ease"
                    >
                      <Text fontSize="14px">{t("cta_primary")}</Text>
                      <Icon as={FiArrowRight} boxSize="15px" />
                    </HStack>
                  </NextLink>

                  {stores.map((store) => (
                    <HStack
                      key={store.label}
                      as="a"
                      href={store.href}
                      target="_blank"
                      rel="noopener"
                      h="48px"
                      px={4}
                      borderRadius="full"
                      bg={dark ? "rgba(255,255,255,0.09)" : "#0a0a0a"}
                      color={dark ? "#fff" : "#fff"}
                      border="1px solid"
                      borderColor={dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.18)"}
                      spacing={2.5}
                      cursor="pointer"
                      _hover={{ transform: "translateY(-1px)", opacity: 0.88 }}
                      transition="all 0.2s ease"
                    >
                      <Icon as={store.icon} boxSize={store.icon === FaGooglePlay ? "14px" : "17px"} />
                      <Text fontSize="13px" fontWeight="850">{store.label}</Text>
                    </HStack>
                  ))}
                </Flex>
              </VStack>

              <VStack align="stretch" spacing={3.5}>
                {steps.map((item, i) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: 18 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ delay: 0.08 + i * 0.08, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <HStack
                      align="start"
                      spacing={4}
                      p={{ base: 4, md: 5 }}
                      borderRadius="22px"
                      bg={tileBg}
                      border="1px solid"
                      borderColor={hairline}
                    >
                      <Flex
                        w="42px"
                        h="42px"
                        borderRadius="14px"
                        align="center"
                        justify="center"
                        bg={i === 0 ? accent : (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.055)")}
                        color={i === 0 ? "#fff" : textMain}
                        flexShrink={0}
                      >
                        <Text fontSize="12px" fontWeight="900">{item.step}</Text>
                      </Flex>
                      <VStack align="start" spacing={1.5} textAlign="left">
                        <Text fontSize={{ base: "16px", md: "18px" }} fontWeight="850" color={textMain}>
                          {item.title}
                        </Text>
                        <Text fontSize={{ base: "13.5px", md: "14.5px" }} color={textSub} lineHeight={isAr ? 1.75 : 1.55}>
                          {item.desc}
                        </Text>
                      </VStack>
                    </HStack>
                  </motion.div>
                ))}
              </VStack>
            </SimpleGrid>
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
  const dark = colorMode === "dark";
  // Dark mode is a soft charcoal (matches the mobile app), not pitch black —
  // easier on the eyes and lets sections/cards read with depth.
  const pageBg = dark ? "#16181C" : "#ffffff";
  const { t } = useTranslate();
  const tolgee = useTolgee(["language"]);
  const isAr = tolgee.getLanguage() === "ar";
  const deviceOS = useDeviceOS();

  const textMain = dark ? "#ffffff" : "#0a0a0a";
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
  const hairline = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const ACCENT = "#63a1db";

  const { isOpen: isWaitlistOpen, onOpen: onWaitlistOpen, onClose: onWaitlistClose } = useDisclosure();

  // No web app to redirect into — the landing page is marketing-only. Banking
  // lives in the mobile app; the only CTA is "register".

  // Force body to match page background so blank gaps never show Chakra's
  // default surface colour through. (overflowX:clip was breaking sticky
  // paint in deep scroll — we use overflowX:hidden on the wrapper instead.)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.background;
    document.body.style.background = pageBg;
    // Proximity snap for the chapters past the hero — gentle, never traps
    // scroll (the hero has no snap points so its scroll-driven journey is
    // untouched). Cleaned up on unmount so other pages scroll normally.
    const prevSnap = document.documentElement.style.scrollSnapType;
    document.documentElement.style.scrollSnapType = "y proximity";
    return () => {
      document.body.style.background = prev;
      document.documentElement.style.scrollSnapType = prevSnap;
    };
  }, [pageBg]);

  return (
    <Box minH="100vh" color={textMain} bg={pageBg}>
      <PublicNav />

      {/* ══════════════════════════════════════════════════════════════
          ONE CONTINUOUS PHONE JOURNEY
          Tilt → unlock → dashboard → chat → buy → search → pay
          All copy is i18n — no hard-coded labels.
          ══════════════════════════════════════════════════════════════ */}
      <Box id="features">
        <PhoneJourney />
      </Box>

      {/* Alternating background BANDS give each section its own identity — a
          faint surface tint on every other one, separated by hairline rules,
          so the page reads as distinct "chapters" instead of one flat scroll.
          (contentVisibility: auto still skips off-screen layout+paint.) */}
      <SectionBand dark={dark} tone="tint"  size="0 700px"><SectionBento /></SectionBand>
      <SectionBand dark={dark} tone="plain" size="0 700px"><SectionOnRamp /></SectionBand>
      <SectionBand dark={dark} tone="tint"  size="0 800px"><SectionPrepaidCards /></SectionBand>
      <SectionBand dark={dark} tone="plain" size="0 760px"><SectionClaimLink /></SectionBand>
      <SectionBand dark={dark} tone="tint"  size="0 820px"><SectionGrowSave /></SectionBand>
      <SectionBand dark={dark} tone="plain" size="0 600px"><SectionSocialProof /></SectionBand>
      <SectionBand dark={dark} tone="tint"  size="0 600px"><SectionBusiness /></SectionBand>

      {/* ── Pattern-break closer — sits right above the footer ── */}
      <Box style={{ contentVisibility: "auto", containIntrinsicSize: "0 800px", scrollSnapAlign: "start", scrollSnapStop: "normal" } as React.CSSProperties}>
        <SectionPatternBreak />
      </Box>
      <SectionPartners />

      {/* ══ FOOTER ══ */}
      <Box position="relative" overflow="hidden">
        <FinalCtaSection dark={dark} deviceOS={deviceOS} />

        {/* ── JSON-LD structured data ──────────────────────────────── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FinancialService',
              name: 'tazdan',
              description:
                'Crypto exchange and money transfer platform for MENA — Libya, Egypt, UAE, Saudi Arabia.',
              url: 'https://tazdan.com',
              areaServed: ['LY', 'EG', 'AE', 'SA', 'GB', 'US', 'EU'],
              currenciesAccepted: 'USD, EUR, GBP, LYD, EGP, AED, SAR, BTC, ETH, USDT, SOL',
              serviceType: ['Cryptocurrency Exchange', 'Money Transfer', 'Virtual Card Issuance'],
              sameAs: [
                'https://twitter.com/tazdan',
                'https://t.me/tazdan',
              ],
            }),
          }}
        />

        <WaitlistModal isOpen={isWaitlistOpen} onClose={onWaitlistClose} />
        <Box position="relative" zIndex={1}><PublicFooter /></Box>
      </Box>
    </Box>
  );
}
