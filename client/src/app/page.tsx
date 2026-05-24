"use client";

import { useRef, useEffect, useState, memo, useMemo } from "react";
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
} from "@chakra-ui/react";
const AuthenticatedHome = dynamic(() => import("@/components/ui/AuthenticatedHome"), {
  ssr: false,
  loading: () => null,
});
import { useAuthStore } from "@/stores/authStore";
import {
  FiArrowRight, FiZap, FiGlobe, FiShield, FiCheck,
  FiTrendingUp, FiTrendingDown, FiBarChart2, FiUsers,
  FiCode, FiLayers, FiActivity, FiLock, FiCpu, FiBox,
  FiFeather, FiSend, FiArrowDownLeft, FiArrowUpRight,
  FiWifi, FiRepeat, FiPieChart, FiHome, FiCreditCard,
  FiStar, FiMapPin, FiAtSign, FiSettings,
  FiBell, FiPlus, FiDownload, FiDollarSign, FiMessageCircle, FiUser,
  FiChevronLeft, FiChevronRight, FiMoreHorizontal, FiSmile, FiArrowUp,
  FiEye, FiSearch, FiChevronDown, FiMaximize2, FiClock,
} from "react-icons/fi";
import { FaApple, FaGooglePlay, FaApplePay, FaGooglePay, FaCcVisa, FaCcMastercard, FaPaypal } from "react-icons/fa";
import { SiRevolut } from "react-icons/si";
import {
  motion, useTransform, useMotionValue, useScroll,
  MotionValue, AnimatePresence,
} from "framer-motion";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { ShaderAnimation } from "@/components/ui/shader-lines";
import { IconLogo } from "@/components/ui/Logo";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import FeeCalculator from "@/components/ui/FeeCalculator";
import WaitlistSection from "@/components/ui/WaitlistSection";

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
    accent: "#226dff",
    accentMuted: "rgba(34,109,255,0.15)",
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

/* ═════════════════════════════════════════════════════════════════
   LOCK SCREEN — monochrome
   ═════════════════════════════════════════════════════════════════ */
const LOCK_SLIDE_PX = -4000;

const LockScreen = memo(function LockScreen({
  unlockProgress,
}: {
  unlockProgress: MotionValue<number>;
}) {
  const slideY = useTransform(
    unlockProgress,
    [0, 0.3, 0.7, 1],
    [0, LOCK_SLIDE_PX * 0.05, LOCK_SLIDE_PX * 0.6, LOCK_SLIDE_PX],
  );
  const fadeNotif = useTransform(unlockProgress, [0, 0.55], [1, 0]);
  const lockOpacity = useTransform(unlockProgress, [0, 0.7, 0.8], [1, 1, 0]);
  const lockPointerEvents = useTransform(unlockProgress, (v: number) =>
    v >= 0.8 ? "none" : "auto"
  );

  const s = {
    timeFont:   "calc(var(--ph) * 0.125)",
    dateFontSz: "calc(var(--ph) * 0.026)",
    notifFont:  "calc(var(--ph) * 0.022)",
    statusFont: "calc(var(--ph) * 0.016)",
    notifPad:   "calc(var(--ph) * 0.034)",
    notifGap:   "calc(var(--ph) * 0.008)",
    avatarSz:   "calc(var(--ph) * 0.058)",
    avatarR:    "calc(var(--ph) * 0.016)",
    barW:       "calc(var(--ph) * 0.004)",
    diH5:       "calc(var(--ph) * 0.009)",
    diH7:       "calc(var(--ph) * 0.013)",
    diH9:       "calc(var(--ph) * 0.016)",
    diH11:      "calc(var(--ph) * 0.020)",
    batW:       "calc(var(--pw) * 0.07)",
    batH:       "calc(var(--ph) * 0.017)",
    swipeW:     "calc(var(--pw) * 0.35)",
    swipeH:     "calc(var(--ph) * 0.006)",
    islandW:    "calc(var(--pw) * 0.4)",
    islandH:    "calc(var(--ph) * 0.038)",
    topPad:  "calc(var(--ph) * 0.015)",   // was 0.06 — status bar sits just below bezel now
    timePad: "calc(var(--ph) * 0.08)",   // was 0.10
    notifTop:   "calc(var(--ph) * 0.38)",
    notifSide:  "calc(var(--pw) * 0.07)",
    bottomPad:  "calc(var(--ph) * 0.04)",
  };

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
      {/* Pure black lock screen background */}
      <Box position="absolute" inset={0} bg="#000000" />

      {/* Status bar */}
      <HStack
        position="absolute"
        top={s.topPad} left={s.notifSide} right={s.notifSide}
        justify="space-between" zIndex={2}
      >
        <Text style={{ fontSize: s.statusFont }} color="white" fontWeight="700" letterSpacing="0.01em">
          fortuni
        </Text>
        <HStack spacing="calc(var(--pw) * 0.025)">
          <HStack spacing="calc(var(--pw) * 0.008)" align="flex-end" h={s.diH11}>
            {[s.diH5, s.diH7, s.diH9, s.diH11].map((h, i) => (
              <Box key={i} w={s.barW} h={h} bg="white" borderRadius="1px" opacity={i < 3 ? 1 : 0.3} />
            ))}
          </HStack>
          <Icon as={FiWifi} color="white" style={{ width: s.diH9, height: s.diH9 }} />
          <HStack spacing="1px" align="center">
            <Box
              w={s.batW} h={s.batH}
              border="calc(var(--ph)*0.002) solid white" borderRadius="2px"
              position="relative" overflow="hidden"
            >
              <Box position="absolute" inset="1px" right="2px" bg="white" borderRadius="1px" />
            </Box>
          </HStack>
        </HStack>
      </HStack>

      {/* Time */}
      <motion.div style={{
        opacity: fadeNotif,
        position: "absolute", top: s.timePad, left: 0, right: 0,
        textAlign: "center", zIndex: 2,
      }}>
        <Box>
          <Icon as={FiLock} color="rgba(255,255,255,0.5)"
            style={{ width: s.dateFontSz, height: s.dateFontSz, marginBottom: "calc(var(--ph)*0.01)" }} />
        </Box>
        <Text
          style={{ fontSize: s.timeFont }}
          fontWeight="200" color="white"
          letterSpacing="-0.04em" lineHeight={1}
        >
          4:44
        </Text>
        <Text style={{ fontSize: s.dateFontSz }} color="rgba(255,255,255,0.7)" fontWeight="500" mt={1} letterSpacing="0.01em">
          Sunday, November 4th
        </Text>
      </motion.div>

      {/* Notification */}
      <motion.div style={{
        opacity: fadeNotif,
        position: "absolute", top: s.notifTop,
        left: s.notifSide, right: s.notifSide, zIndex: 2,
      }}>
        <Box
          bg="rgba(255,255,255,0.12)" borderRadius={s.avatarR}
          p={s.notifPad}
          style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          border="1px solid rgba(255,255,255,0.15)"
        >
          <HStack spacing={s.notifGap}>
            <Flex
              style={{ width: s.avatarSz, height: s.avatarSz, borderRadius: s.avatarR, flexShrink: 0 }}
              bg="rgba(255,255,255,0.15)"
              align="center" justify="center"
            >
              <Text style={{ fontSize: `calc(var(--ph) * 0.025)` }}>💸</Text>
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <HStack justify="space-between" w="100%">
                <Text style={{ fontSize: s.statusFont }} color="rgba(255,255,255,0.6)" fontWeight="700" letterSpacing="0.04em" textTransform="uppercase">
                  fortuni
                </Text>
                <Text style={{ fontSize: s.statusFont }} color="rgba(255,255,255,0.4)">1m ago</Text>
              </HStack>
              <Text style={{ fontSize: s.notifFont }} color="white" fontWeight="600">
                @robocop sent you +$1,144.28
              </Text>
            </VStack>
          </HStack>
        </Box>
      </motion.div>

      {/* Swipe indicator */}
      <motion.div style={{
        opacity: fadeNotif,
        position: "absolute", bottom: s.bottomPad,
        left: 0, right: 0, zIndex: 2,
      }}>
        <VStack spacing="calc(var(--ph)*0.008)">
          <Text style={{ fontSize: s.statusFont }} color="white" fontWeight="500">
            Swipe up to unlock
          </Text>
          <Box w={s.swipeW} h={s.swipeH} bg="rgba(255,255,255,0.3)" borderRadius="full" />
        </VStack>
      </motion.div>
    </motion.div>
  );
});

/* ═════════════════════════════════════════════════════════════════
   APP SCREEN PALETTE — theme-reactive (follows the landing colour mode)
   ═════════════════════════════════════════════════════════════════ */
function appTokens(dark: boolean) {
  return dark
    ? {
        bg: "#0a0a0c", surface: "#1b1b1f", border: "rgba(255,255,255,0.06)",
        fg: "#ffffff", fgMuted: "#8a8a92", fgFaint: "#5b5b63",
        green: "#3ecf6e", redFg: "#f0564a", redBg: "rgba(240,86,74,0.14)",
        accent: "#226dff",
        ink: "#ffffff", inkFg: "#15140f",
        sheetBg: "#161618", sheetCard: "#1f1f23", sheetBorder: "rgba(255,255,255,0.08)",
        sheetFg: "#ffffff", sheetMuted: "#9a9aa2", sheetFaint: "#5b5b63",
        sheetGreen: "#3ecf6e", sheetGreenBg: "rgba(62,207,110,0.15)", sheetGreenBd: "#34a96a",
        sheetChip: "#2a2a2f",
      }
    : {
        bg: "#ffffff", surface: "#f1f1f3", border: "rgba(0,0,0,0.07)",
        fg: "#15140f", fgMuted: "#6a6a72", fgFaint: "#a6a6ad",
        green: "#1f9d57", redFg: "#d0463a", redBg: "rgba(208,70,58,0.12)",
        accent: "#226dff",
        ink: "#15140f", inkFg: "#ffffff",
        sheetBg: "#f4f2ea", sheetCard: "#fffefb", sheetBorder: "rgba(0,0,0,0.07)",
        sheetFg: "#15140f", sheetMuted: "#8b897e", sheetFaint: "#b6b4a8",
        sheetGreen: "#1f9d57", sheetGreenBg: "#e3f1e6", sheetGreenBd: "#34a96a",
        sheetChip: "#eceae1",
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
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % DASH_SNAPSHOTS.length), 3000);
    return () => clearInterval(id);
  }, []);
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
  const accent = "#226dff";
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
            bg={critical ? "rgba(239,68,68,0.9)" : "rgba(34,109,255,0.92)"}
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
          boxShadow={`0 calc(var(--ph)*0.004) calc(var(--ph)*0.012) rgba(34,109,255,0.5)`}
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

function ScreenBuy() {
  const APP = appTokens(usePhoneDark());
  const px = "calc(var(--pw)*0.07)";
  const [bi, setBi] = useState(3);
  useEffect(() => {
    const id = setInterval(() => setBi((b) => (b + 1) % BUY_STEPS.length), 2400);
    return () => clearInterval(id);
  }, []);
  const step = BUY_STEPS[bi];
  /* live 30s quote countdown — loops, mirrors the real requote timer */
  const [secs, setSecs] = useState(26);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s <= 1 ? 30 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
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
            style={{ width: "2px", height: fs.big, background: "#226dff" }} />
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
}

/* ═════════════════════════════════════════════════════════════════
   TOKEN SEARCH SCREEN — matches the in-app "Search any token" sheet
   ═════════════════════════════════════════════════════════════════ */
function ScreenTokenSearch() {
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
            style={{ width: "1.5px", height: "calc(var(--ph)*0.022)", background: "#226dff" }} />
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
}

/* ═════════════════════════════════════════════════════════════════
   PAY WITH SCREEN — matches the in-app "Pay with" sheet
   ═════════════════════════════════════════════════════════════════ */
function ScreenPayWith() {
  const APP = appTokens(usePhoneDark());
  const px = "calc(var(--pw)*0.07)";
  const fs = {
    name: "calc(var(--ph)*0.02)",
    sub:  "calc(var(--ph)*0.015)",
  };
  /* selection cycles between payment sources */
  const [sel, setSel] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSel((s) => (s + 1) % 4), 2000);
    return () => clearInterval(id);
  }, []);
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
}

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

function ScreenChat() {
  const dark = usePhoneDark();
  const c = dark
    ? { bg: "#0e0e10", headerBg: "#161618", surface: "#1f1f23",
        border: "rgba(255,255,255,0.07)", fg: "#ffffff", muted: "#8a8a92", faint: "#5b5b63" }
    : { bg: "#ffffff", headerBg: "#f6f6f7", surface: "#f0f0f2",
        border: "rgba(0,0,0,0.07)", fg: "#15140f", muted: "#8b897e", faint: "#b6b4a8" };
  const accent = "#226dff";
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
}

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
                    ? (dark ? "rgba(34,109,255,0.35)" : "rgba(34,109,255,0.3)")
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
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const cardBg   = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const chipBg   = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";

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
                <Box as="span" color={dark ? "rgba(255,255,255,0.4)" : "#226dff"}>{t("sec_social_title_2")}</Box>
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

function AlternatingFeatureSection({
  imageSide, eyebrow, title, desc, features, phoneScreen, comingSoon = false, extraBelow,
}: {
  imageSide: "left" | "right"; eyebrow: string; title: string; desc: string;
  features: { icon: React.ElementType; label: string }[];
  phoneScreen: React.ReactNode; comingSoon?: boolean; extraBelow?: React.ReactNode;
}) {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const tileBg   = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const tileBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  /* monochrome eyebrow + tile chrome; brand accent is reserved for the dot */
  const brand     = "#226dff";
  const brandSoft = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const brandLine = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)";

  return (
    <Box className="snap-section-normal" position="relative" py={{ base: 16, md: 24 }} px={{ base: 4, md: 10 }} overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={2}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
          <Flex justify="center" order={{ base: 2, lg: imageSide === "left" ? 1 : 2 }} position="relative">
            {/* deliberate brand accent halo */}
            <Box
              position="absolute" zIndex={0} pointerEvents="none"
              w={{ base: "300px", md: "440px" }} h={{ base: "300px", md: "440px" }}
              borderRadius="full"
              bg="rgba(34,109,255,0.18)"
              filter="blur(110px)"
              top="50%" left="50%" transform="translate(-50%, -50%)"
            />
            <motion.div
              initial={{ opacity: 0, y: 48, scale: 0.93 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "relative", zIndex: 1 }}
            >
              <StaticPhone phOverride="clamp(320px, 42vh, 640px)">{phoneScreen}</StaticPhone>
            </motion.div>
          </Flex>
          <motion.div
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ order: imageSide === "left" ? 2 : 1 }}
          >
            <VStack align={{ base: "center", lg: "start" }} spacing={{ base: 5, md: 7 }} textAlign={{ base: "center", lg: "start" }}>
              {comingSoon && (
                <Box px={3} py={1} borderRadius="full" display="inline-flex"
                  bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                  border={`1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)"}`}
                  color={textMain} fontWeight="600" fontSize="11px" letterSpacing="0.02em"
                >
                  {t("coming_soon")}
                </Box>
              )}
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "36px", md: "56px", xl: "72px" }} letterSpacing="-0.04em" lineHeight={1.05} color={textMain}>
                {title}
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">{desc}</Text>
              {extraBelow ? (
                <Box w="100%" maxW="460px">{extraBelow}</Box>
              ) : features.length > 0 && (
                <SimpleGrid columns={2} spacing={3} w="100%" maxW="460px">
                  {features.map((f, i) => (
                    <motion.div key={f.label} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.4, delay: 0.08 * i }}>
                      <HStack h="64px" bg={tileBg} border="1px solid" borderColor={tileBorder} borderRadius="16px" px={4} spacing={3}
                        transition="all 0.2s ease"
                        _hover={{ transform: "translateY(-3px)", borderColor: brand,
                          boxShadow: `0 8px 28px rgba(34,109,255,0.18)` }}
                      >
                        <Flex w="36px" h="36px" borderRadius="10px" border="1px solid" borderColor={brandLine} align="center" justify="center" flexShrink={0} bg={brandSoft}>
                          <Icon as={f.icon} color={textMain} />
                        </Flex>
                        <Text fontSize="13px" fontWeight="700" color={textMain}>{f.label}</Text>
                      </HStack>
                    </motion.div>
                  ))}
                </SimpleGrid>
              )}
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
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const brand     = "#226dff";
  const brandSoft = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const heroCardBg = dark
    ? "linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)"
    : "linear-gradient(145deg, #111111 0%, #000000 100%)";

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
            <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "32px", md: "56px", lg: "64px" }} letterSpacing="-0.04em" color={textMain} lineHeight={1.1}>
              {t("bento_title_1")}{" "}
              <Box as="span" color={dark ? "#226dff" : "#226dff"}>{t("bento_title_2")}</Box>
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
                    {s.value && <Heading fontSize={{ base: "28px", md: "44px", lg: "52px" }} fontWeight="900" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif" lineHeight={1}>{s.value}</Heading>}
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
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.5)" : "#64748b";
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const methods: { label: string; icon?: React.ElementType; iconSize?: number; showLabel?: boolean }[] = [
    { label: "Apple Pay",  icon: FaApplePay,     iconSize: 36 },
    { label: "Google Pay", icon: FaGooglePay,    iconSize: 34 },
    { label: "Visa",       icon: FaCcVisa,       iconSize: 30 },
    { label: "Mastercard", icon: FaCcMastercard, iconSize: 30 },
    { label: "Revolut",    icon: SiRevolut,      iconSize: 22, showLabel: true },
  ];
  const cards = [
    { title: t("onramp_buy_title"), desc: t("onramp_buy_desc"), cta: t("onramp_buy_cta"), video: "/videos/Consumer_UIAnims_Desktop-Buy.mp4" },
    { title: t("onramp_sell_title"), desc: t("onramp_sell_desc"), cta: t("onramp_sell_cta"), video: "/videos/Consumer_UIAnims_Desktop-Sell.mp4" },
    { title: t("onramp_send_title"), desc: t("onramp_send_desc"), cta: t("onramp_send_cta"), video: "/videos/Consumer_UIAnims_Desktop-SendReceive.mp4" },
  ];
  return (
    <Box py={{ base: 20, md: 28 }} px={{ base: 4, md: 10 }} position="relative" overflow="hidden">
      <Container maxW="1200px">
        <VStack spacing={{ base: 12, md: 16 }} align="center" textAlign="center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6 }}>
            <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "36px", md: "52px", lg: "64px" }} letterSpacing="-0.04em" color={textMain} lineHeight={1.1} maxW="720px">{t("onramp_headline")}</Heading>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15 }}>
            <Flex gap={{ base: 2, md: 3 }} flexWrap="wrap" justify="center" maxW="800px">
              {methods.map((m, i) => (
                <motion.div key={m.label} initial={{ opacity: 0, y: 8, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.35, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -2 }}>
                  <HStack spacing={2} px={{ base: 3, md: 4 }} h={{ base: "38px", md: "42px" }} borderRadius="full"
                    bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                    color={dark ? "white" : "#0a0f1e"}
                    border="1px solid" borderColor={dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)"}
                    boxShadow={dark ? "0 4px 14px rgba(0,0,0,0.3)" : "0 4px 14px rgba(0,0,0,0.06)"}
                    transition="box-shadow 0.2s ease" _hover={{ boxShadow: dark
                      ? "0 8px 22px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2)"
                      : "0 8px 22px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.2)"
                    }}
                  >
                    {m.icon && <Icon as={m.icon} boxSize={`${m.iconSize ?? 24}px`} />}
                    {(m.showLabel || !m.icon) && <Text fontSize={{ base: "12px", md: "13.5px" }} fontWeight="900">{m.label}</Text>}
                  </HStack>
                </motion.div>
              ))}
            </Flex>
          </motion.div>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 4, md: 5 }} w="100%">
            {cards.map((c, i) => (
              <motion.div key={c.title} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}>
                <VStack bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius={{ base: "24px", md: "32px" }} overflow="hidden" align="stretch" spacing={0} transition="all 0.3s ease" _hover={{ transform: { md: "translateY(-6px)" }, boxShadow: dark ? "0 24px 60px rgba(0,0,0,0.4)" : "0 24px 60px rgba(0,0,0,0.10)" }}>
                  <Box display={{ base: "none", md: "block" }} position="relative" w="100%" style={{ aspectRatio: "4 / 3" }} overflow="hidden">
                    <LazyBackgroundVideo src={c.video} objectFit="cover" />
                  </Box>
                  <VStack p={{ base: 5, md: 7 }} align="center">
                    <Heading fontWeight="800" color={textMain} fontFamily="'DM Sans', sans-serif">{c.title}</Heading>
                    <Text color={textSub} lineHeight={1.5}>{c.desc}</Text>
                  </VStack>
                  <Box display={{ base: "block", md: "none" }} position="relative" w="100%" style={{ aspectRatio: "4 / 3" }} bg={dark ? "#111" : "#e8e8e8"} overflow="hidden" borderTop="1px solid" borderColor={cardBorder}>
                    <LazyBackgroundVideo src={c.video} objectFit="contain" />
                  </Box>
                </VStack>
              </motion.div>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
}

function SectionSocialProof() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobileDevice = typeof window !== "undefined" && window.innerWidth < 768;
  const avatars = [
    { src: "/screenshots/p1.avif", top: "12%", left: "20%", sizeBase: 56, sizeMd: 88,  delay: 0.05, floatDelay: 0   },
    { src: "/screenshots/p2.avif", top: "8%",  left: "48%", sizeBase: 62, sizeMd: 96,  delay: 0.1,  floatDelay: 0.6 },
    { src: "/screenshots/p3.avif", top: "16%", left: "78%", sizeBase: 70, sizeMd: 110, delay: 0.15, floatDelay: 1.2 },
    { src: "/screenshots/p4.avif", top: "58%", left: "10%", sizeBase: 56, sizeMd: 84,  delay: 0.2,  floatDelay: 0.4 },
    { src: "/screenshots/p5.avif", top: "60%", left: "84%", sizeBase: 58, sizeMd: 88,  delay: 0.25, floatDelay: 0.9 },
    { src: "/screenshots/p6.avif", top: "86%", left: "50%", sizeBase: 68, sizeMd: 100, delay: 0.3,  floatDelay: 0.2 },
  ];
  return (
    <Box position="relative" overflow="hidden" py={{ base: 16, md: 28 }} px={{ base: 4, md: 10 }}>
      <Container maxW="1200px" position="relative" zIndex={2}>
        <Box position="relative" w="100%" mx="auto" maxW={{ base: "100%", md: "960px" }} h={{ base: "560px", md: "640px" }}>
          {avatars.map((a) => (
            <motion.div key={a.src} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, delay: a.delay, type: "spring", stiffness: 180, damping: 16 }} style={{ position: "absolute", top: a.top, left: a.left, transform: "translate(-50%, -50%)", zIndex: 1 }}>
              <motion.div animate={(!prefersReducedMotion && !isMobileDevice) ? { y: [0, -10, 0] } : {}} transition={{ duration: 5 + (a.floatDelay % 2), delay: a.floatDelay, repeat: Infinity, ease: "easeInOut" }}>
                <Box w={{ base: `${a.sizeBase}px`, md: `${a.sizeMd}px` }} h={{ base: `${a.sizeBase}px`, md: `${a.sizeMd}px` }} borderRadius="full" overflow="hidden"
                  border="3px solid" borderColor={dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)"}
                  boxShadow="0 16px 40px rgba(0,0,0,0.25)"
                  transition="transform 0.3s ease, border-color 0.3s ease"
                  _hover={{ transform: "scale(1.08)", borderColor: dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}
                  position="relative" bg={dark ? "#111" : "#e8e8e8"}
                >
                  <NextImage src={a.src} alt="" fill style={{ objectFit: "cover" }} sizes="120px" />
                </Box>
              </motion.div>
            </motion.div>
          ))}
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" zIndex={2} textAlign="center" pointerEvents="none" w={{ base: "78%", md: "auto" }}>
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="900"
                fontSize={{ base: "28px", md: "44px", lg: "56px" }}
                letterSpacing="-0.04em" lineHeight={1.1}
                color={dark ? "#ffffff" : "#0a0f1e"}
                maxW={{ base: "280px", md: "540px" }}
                mx="auto"
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
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const s = stages[0];
  return (
    <Box position="absolute" inset={0} zIndex={3} pointerEvents="none">
      <Box display={{ base: "block", md: "none" }} position="absolute" top={{ base: "120px", sm: "130px" }} left={0} right={0} textAlign="center" px={5}>
        <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "22px", sm: "28px" }} letterSpacing="-0.03em" color={textMain} lineHeight={1.15}>{s.title}</Heading>
      </Box>
      <Box display={{ base: "block", md: "none" }} position="absolute" bottom={{ base: "20px", sm: "32px" }} left={0} right={0} px={5}>
        <LiveTxFeed />
      </Box>
      <Box display={{ base: "none", md: "block" }} position="absolute" top="50%" left={{ md: "5%" }} transform="translateY(-50%)" w={{ md: "28%" }} maxW={{ md: "320px", xl: "380px" }}>
        <VStack align="start" spacing={5}>
          <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ md: "30px", lg: "40px", xl: "52px" }} letterSpacing="-0.04em" color={textMain} lineHeight={1.1}>{s.title}</Heading>
          <Text fontSize={{ md: "13px", lg: "15px" }} color={textSub} lineHeight={1.5}>{s.desc}</Text>
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
   driven motion. No gradients on text. Brand accent (#226dff) is used
   only as a deliberate pop — one dot, one word, one halo.
   ═════════════════════════════════════════════════════════════════ */

type StageCopyProps = {
  op: MotionValue<number>;
  eyebrow: string;
  title: React.ReactNode;
  desc?: string;
  features?: { icon: React.ElementType; label: string }[];
  accent: string;
  textMain: string;
  textMuted: string;
  hairline: string;
  tileBg: string;
};

function StageCopy({ op, title, desc, features, textMain, textMuted, hairline, tileBg }: StageCopyProps) {
  const y = useTransform(op, [0, 1], [10, 0]);
  return (
    <motion.div
      style={{
        opacity: op, y,
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", justifyContent: "center",
        gap: 20, willChange: "opacity, transform",
        pointerEvents: "none",
      }}
    >
      <Heading as="h2" fontFamily="'DM Sans', sans-serif" fontWeight="800"
        fontSize={{ base: "32px", sm: "40px", md: "60px", xl: "84px" }}
        letterSpacing="-0.05em" lineHeight={0.94} color={textMain}
        sx={{ fontFeatureSettings: '"ss01", "cv11", "kern"' }}
      >
        {title}
      </Heading>
      {desc && (
        <Text fontSize={{ base: "15px", md: "18px" }} color={textMuted}
          maxW="480px" lineHeight={1.5} fontWeight="400"
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
 * fade(a,b,c,d): opacity is 0 outside [a,d], ramps 0→1 on [a,b], holds 1 on [b,c], ramps 1→0 on [c,d].
 * Returned MotionValue is wired to the journey's scrollYProgress.
 */

function PhoneJourney() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const phoneDark = usePhoneDark();
  const { t } = useTranslate();

  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const textMain  = dark ? "#ffffff" : "#0a0a0a";
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
  const hairline  = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const tileBg    = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const ACCENT = "#226dff";

  /* Stage layout (out of 1 progress).
     6 stages × ~87vh each fits in 520vh of scroll runway. */
  // A 0.00 – 0.16  lock → unlock + tilt to upright
  // B 0.16 – 0.32  dashboard
  // C 0.32 – 0.48  chat / socialised
  // D 0.48 – 0.64  buy
  // E 0.64 – 0.80  search
  // F 0.80 – 1.00  pay-with

  const tiltX          = useTransform(scrollYProgress, [0, 0.14], [22, 0]);
  const unlockProgress = useTransform(scrollYProgress, [0.04, 0.15], [0, 1]);

  // screen cross-fades — dashboard is always the base layer
  const opChat   = useTransform(scrollYProgress, [0.28, 0.34, 0.46, 0.51], [0, 1, 1, 0]);
  const opBuy    = useTransform(scrollYProgress, [0.44, 0.50, 0.62, 0.67], [0, 1, 1, 0]);
  const opSearch = useTransform(scrollYProgress, [0.60, 0.66, 0.78, 0.83], [0, 1, 1, 0]);
  const opPay    = useTransform(scrollYProgress, [0.76, 0.82, 1.00, 1.00], [0, 1, 1, 1]);

  // copy cross-fades — slightly lead the matching screen
  const copyA = useTransform(scrollYProgress, [0,    0.10, 0.17], [1, 1, 0]);
  const copyB = useTransform(scrollYProgress, [0.13, 0.20, 0.28, 0.34], [0, 1, 1, 0]);
  const copyC = useTransform(scrollYProgress, [0.30, 0.36, 0.46, 0.52], [0, 1, 1, 0]);
  const copyD = useTransform(scrollYProgress, [0.46, 0.52, 0.62, 0.68], [0, 1, 1, 0]);
  const copyE = useTransform(scrollYProgress, [0.62, 0.68, 0.78, 0.84], [0, 1, 1, 0]);
  const copyF = useTransform(scrollYProgress, [0.78, 0.84, 1.00], [0, 1, 1]);

  // shader background — strong at top, fades through the journey
  const shaderOp = useTransform(scrollYProgress, [0, 0.3, 0.85, 1], [0.70, 0.50, 0.30, 0.10]);
  // ambient halo follows the phone, gently breathing
  const phoneScale = useTransform(scrollYProgress, [0, 0.16], [0.96, 1]);

  return (
    <Box ref={ref} position="relative" h={{ base: "520vh", md: "520vh" }}>
      <Box position="sticky" top={0} h="100vh" w="100%" overflow="hidden"
        bg={dark ? "#000" : "#fff"}
      >
        {/* ── Shader background — centered, fills viewport ── */}
        <motion.div
          aria-hidden
          style={{
            position: "absolute", inset: 0, opacity: shaderOp,
            pointerEvents: "none", zIndex: 0,
          }}
        >
          <Box position="absolute" inset={0}
            style={{ mixBlendMode: dark ? "screen" : "multiply" } as React.CSSProperties}
          >
            <ShaderAnimation />
          </Box>
        </motion.div>

        {/* ── Vignette — focus the centre of the canvas ── */}
        <Box position="absolute" inset={0} pointerEvents="none" aria-hidden zIndex={0}
          bg={dark
            ? "radial-gradient(ellipse 80% 80% at center, transparent 30%, rgba(0,0,0,0.45) 80%, #000 100%)"
            : "radial-gradient(ellipse 80% 80% at center, transparent 30%, rgba(255,255,255,0.5) 80%, #fff 100%)"}
        />

        {/* ── Subtle brand-colour halo behind the phone ── */}
        <motion.div
          animate={{ opacity: [0.08, 0.16, 0.08] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", top: "50%", left: "50%",
            width: 560, height: 560, transform: "translate(-50%,-50%)",
            borderRadius: "50%", background: ACCENT, filter: "blur(180px)",
            pointerEvents: "none", zIndex: 0,
          }}
        />

        {/* ── Layout grid ── */}
        <Container maxW="1300px" h="100%" position="relative" zIndex={1} px={{ base: 4, md: 10 }}>
          <SimpleGrid columns={{ base: 1, lg: 2 }} h="100%"
            alignItems="center" gap={{ base: 0, lg: 12 }}>

            {/* COPY column — sits LEFT on desktop, BELOW phone on mobile */}
            <Box position="relative" order={{ base: 2, lg: 1 }}
              h={{ base: "200px", sm: "240px", lg: "520px" }}
              w="100%" maxW={{ base: "100%", lg: "560px" }}
              textAlign={{ base: "center", lg: "left" } as any}
              pt={{ base: 2, lg: 0 }}
            >
              <StageCopy op={copyA} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg}
                eyebrow={t("coming_soon")}
                title={
                  <>
                    {t("hero_line1")}{" "}
                    <Box as="span" color={ACCENT}>{t("hero_line2")}</Box>
                  </>
                }
                desc={t("hero_sub")}
              />
              <StageCopy op={copyB} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg}
                eyebrow={t("bento_countries_label")}
                title={<>{t("bento_title_1")} <Box as="span" color={ACCENT}>{t("bento_title_2")}</Box></>}
              />
              <StageCopy op={copyC} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg}
                eyebrow={t("sec_social_title_1")}
                title={<>{t("sec_social_title_1")}<br /><Box as="span" color={ACCENT}>{t("sec_social_title_2")}</Box></>}
                desc={t("sec_social_desc")}
              />
              <StageCopy op={copyD} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg}
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
              <StageCopy op={copyE} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg}
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
              <StageCopy op={copyF} accent={ACCENT} textMain={textMain} textMuted={textMuted} hairline={hairline} tileBg={tileBg}
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
            </Box>

            {/* PHONE column — sits RIGHT on desktop, ABOVE copy on mobile */}
            <Flex order={{ base: 1, lg: 2 }} justify="center" align={{ base: "flex-end", lg: "center" }} position="relative"
              style={{ perspective: "1500px" }}
              pb={{ base: 2, lg: 0 }}
            >
              <motion.div style={{ rotateX: tiltX, scale: phoneScale, transformOrigin: "50% 60%", willChange: "transform" }}>
                <Box
                  position="relative"
                  style={{ ...phoneVars,
                    ["--ph" as string]: "clamp(260px, 44vh, 720px)",
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
                    {/* Base: dashboard, always rendered */}
                    <Box position="absolute" inset={0}><ScreenDashboard /></Box>
                    {/* Feature screens cross-fade above the dashboard */}
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opChat, willChange: "opacity" }}>
                      <ScreenChat />
                    </motion.div>
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opBuy, willChange: "opacity" }}>
                      <ScreenBuy />
                    </motion.div>
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opSearch, willChange: "opacity" }}>
                      <ScreenTokenSearch />
                    </motion.div>
                    <motion.div style={{ position: "absolute", inset: 0, opacity: opPay, willChange: "opacity" }}>
                      <ScreenPayWith />
                    </motion.div>
                    {/* Lock screen sits on top, slides off with unlockProgress */}
                    <LockScreen unlockProgress={unlockProgress} />
                  </Box>
                  <NextImage
                    src="/iphone-frame.png"
                    alt=""
                    fill priority
                    sizes="(max-width: 480px) 70vw, (max-width: 1024px) 42vw, 360px"
                    style={{ objectFit: "contain", pointerEvents: "none", zIndex: 10 }}
                  />
                </Box>
              </motion.div>
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

/* ═════════════════════════════════════════════════════════════════
   LANDING PAGE
   ═════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const pageBg = dark ? "#000000" : "#ffffff";
  const { t } = useTranslate();
  const tolgee = useTolgee(["language"]);
  const isAr = tolgee.getLanguage() === "ar";

  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();

  const textMain = dark ? "#ffffff" : "#0a0a0a";
  const textMuted = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
  const hairline = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const ACCENT = "#226dff";

  useEffect(() => { fetchUser(); }, []);

  // Force body to match page background so blank gaps never show Chakra's
  // default surface colour through. (overflowX:clip was breaking sticky
  // paint in deep scroll — we use overflowX:hidden on the wrapper instead.)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.background;
    document.body.style.background = pageBg;
    return () => { document.body.style.background = prev; };
  }, [pageBg]);

  if (isLoading) return null;
  if (isAuthenticated) return (<><PublicNav /><AuthenticatedHome /></>);

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

      <SectionBento />
      <SectionOnRamp />
      <SectionSocialProof />

      {/* ══ CTA + FOOTER ══ */}
      <Box position="relative" overflow="hidden">
        <Box position="absolute" inset={0} pointerEvents="none" aria-hidden="true">
          <Box position="absolute" top="75%" left="50%" transform="translate(-50%, -50%)" w="100%" h="100%" display="flex" alignItems="center" justifyContent="center">
            <Box position="absolute" top="0" left="50%" w="1600px" h="1600px" borderRadius="full"
              border={`1.5px solid ${dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}`}
              style={{ transform: "translate(-50%, 0)", clipPath: "inset(0 0 50% 0)", boxShadow: dark ? "0 0 40px rgba(255,255,255,0.08)" : "0 0 40px rgba(0,0,0,0.06)" }}
            />
            <motion.div animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "absolute", top: "0", left: "50%", width: "1600px", height: "1600px",
                transform: "translate(-50%, 0)",
                border: dark ? "1.5px solid rgba(34,109,255,0.5)" : "1.5px solid rgba(34,109,255,0.35)",
                boxShadow: dark ? "0 0 90px rgba(34,109,255,0.2)" : "0 0 90px rgba(34,109,255,0.12)",
                borderRadius: "50%", clipPath: "inset(0 0 50% 0)",
                willChange: "opacity" }}
            />
          </Box>
        </Box>
        <Box className="snap-section" id="cta" position="relative" zIndex={1} py={{ base: 16, md: 28 }} px={{ base: 6, md: 12 }} minH="100vh" display="flex" alignItems="center" justifyContent="center">
          {/* CTA box — inverted from page bg for max contrast */}
          <Box maxW="1100px" mx="auto" borderRadius="40px" overflow="hidden" position="relative"
            bg={dark ? "#ffffff" : "#000000"}
            p={{ base: 10, md: 20 }} textAlign="center"
            boxShadow={dark ? "0 40px 100px rgba(255,255,255,0.08)" : "0 40px 100px rgba(0,0,0,0.25)"}
          >
            <Box position="absolute" inset={0} opacity={0.04}
              backgroundImage="radial-gradient(circle at 2px 2px, currentColor 2px, transparent 0)"
              backgroundSize="36px 36px" pointerEvents="none"
              color={dark ? "black" : "white"}
            />
            <VStack spacing={7} position="relative" zIndex={2}>
              <Heading fontSize={{ base: "36px", md: "64px" }} fontWeight="800"
                color={dark ? "#000000" : "#ffffff"}
                letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif"
              >
                {t("cta_title")}
              </Heading>
              <Text fontSize={{ base: "15px", md: "19px" }}
                color={dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.8)"}
                maxW="520px"
              >
                {t("cta_sub")}
              </Text>
              {/* App store download badges */}
              <HStack spacing={2.5} justify="center">
                  {[
                    { store: "App Store", icon: FaApple },
                    { store: "Google Play", icon: FaGooglePlay },
                  ].map((b) => (
                    <HStack key={b.store}
                      bg={dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)"}
                      border="1px solid"
                      borderColor={dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)"}
                      borderRadius="12px" px={4} h="42px" spacing={2.5} cursor="pointer"
                      _hover={{ bg: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)" }}
                      transition="background 0.15s"
                    >
                      <Icon as={b.icon} boxSize="18px" color={dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.8)"} flexShrink={0} />
                      <VStack spacing={0} align="start">
                        <Text fontSize="13px" color={dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.8)"} fontWeight="800" letterSpacing="-0.01em">{b.store}</Text>
                      </VStack>
                    </HStack>
                  ))}
                </HStack>
            </VStack>
          </Box>
        </Box>
        {/* ── Fee Calculator section ───────────────────────────────── */}
        <Box py={{ base: 20, md: 28 }} px={6} position="relative" zIndex={1}>
          <VStack spacing={10} maxW="1100px" mx="auto">
            <VStack spacing={3} textAlign="center">
              <Heading
                fontSize={{ base: "30px", md: "44px" }} fontWeight="900"
                letterSpacing="-0.04em" color={dark ? "#ffffff" : "#000000"}
              >
                {t("calc_section_title")}
              </Heading>
              <Text fontSize={{ base: "15px", md: "17px" }} color={dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)"} maxW="460px">
                {t("calc_section_sub")}
              </Text>
            </VStack>
            <FeeCalculator />
          </VStack>
        </Box>

        {/* ── Waitlist section ─────────────────────────────────────── */}
        <WaitlistSection />

        {/* ── JSON-LD structured data ──────────────────────────────── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FinancialService',
              name: 'fortuni',
              description:
                'Crypto exchange and money transfer platform for MENA — Libya, Egypt, UAE, Saudi Arabia.',
              url: 'https://fortuni.com',
              areaServed: ['LY', 'EG', 'AE', 'SA', 'GB', 'US', 'EU'],
              currenciesAccepted: 'USD, EUR, GBP, LYD, EGP, AED, SAR, BTC, ETH, USDT, SOL',
              serviceType: ['Cryptocurrency Exchange', 'Money Transfer', 'Virtual Card Issuance'],
              sameAs: [
                'https://twitter.com/fortuni',
                'https://t.me/fortuni',
              ],
            }),
          }}
        />

        <Box position="relative" zIndex={1}><PublicFooter /></Box>
      </Box>
    </Box>
  );
}