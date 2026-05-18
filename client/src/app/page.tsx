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
} from "react-icons/fi";
import { FaApple, FaGooglePlay, FaApplePay, FaGooglePay, FaCcVisa, FaCcMastercard, FaPaypal } from "react-icons/fa";
import { SiRevolut } from "react-icons/si";
import {
  motion, useScroll, useTransform, useMotionValue,
  MotionValue, AnimatePresence, useMotionValueEvent,
} from "framer-motion";
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
    accent: "#4a8fe0",
    accentMuted: "rgba(74,143,224,0.15)",
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
          promrkts
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
                  promrkts
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
          <Text style={{ fontSize: s.statusFont }} color="rgba(255,255,255,0.45)" fontWeight="500">
            Swipe up to unlock
          </Text>
          <Box w={s.swipeW} h={s.swipeH} bg="rgba(255,255,255,0.3)" borderRadius="full" />
        </VStack>
      </motion.div>
    </motion.div>
  );
});

/* ═════════════════════════════════════════════════════════════════
   DASHBOARD SCREEN — monochrome, dark/light responsive
   ═════════════════════════════════════════════════════════════════ */
const ScreenDashboard = memo(function ScreenDashboard() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const t = screenTokens(dark);

  const fs = {
    label:    "calc(var(--ph) * 0.019)",
    sub:      "calc(var(--ph) * 0.018)",
    balance:  "calc(var(--ph) * 0.065)",
    delta:    "calc(var(--ph) * 0.021)",
    tab:      "calc(var(--ph) * 0.021)",
    asset:    "calc(var(--ph) * 0.021)",
    assetSub: "calc(var(--ph) * 0.018)",
    val:      "calc(var(--ph) * 0.021)",
    handle:   "calc(var(--ph) * 0.022)",
    btn:      "calc(var(--ph) * 0.018)",
    iconW:    "calc(var(--ph) * 0.064)",
    avatarW:  "calc(var(--ph) * 0.055)",
    actionW:  "calc(var(--ph) * 0.045)",
    settingW: "calc(var(--ph) * 0.092)",
    actionH:  "calc(var(--ph) * 0.047)",
    statusH:  "calc(var(--ph) * 0.040)",
    px:       "calc(var(--pw) * 0.09)",
  };

  const assets = [
    {
      name: "promrkts Balance", sub: null, val: "$444,111.28",
      icon: (
        <Flex
          style={{ width: fs.iconW, height: fs.iconW, borderRadius: "50%", flexShrink: 0 }}
          bg={t.surfaceAlt} border={`1.5px solid ${t.border}`}
          align="center" justify="center"
        >
          <Flex
            style={{ width: `calc(var(--ph)*0.037)`, height: `calc(var(--ph)*0.037)`, borderRadius: "50%" }}
            bg={t.fg} align="center" justify="center"
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.018)` }} fontWeight="900" color={t.bg}>$</Text>
          </Flex>
        </Flex>
      ),
    },
    {
      name: "USDT (SOL)", sub: "USDT", val: "$11,444.28",
      icon: (
        <Box position="relative" style={{ width: fs.iconW, height: fs.iconW, flexShrink: 0 }}>
          <Flex
            style={{ width: fs.iconW, height: fs.iconW, borderRadius: "50%" }}
            bg={t.surface} border={`1px solid ${t.border}`} align="center" justify="center"
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.021)` }} fontWeight="900" color={t.fg}>$</Text>
          </Flex>
          <Flex
            position="absolute" bottom="-1px" right="-1px"
            style={{ width: `calc(var(--ph)*0.03)`, height: `calc(var(--ph)*0.03)`, borderRadius: "50%" }}
            bg={t.fg} align="center" justify="center"
            border={`calc(var(--ph)*0.002) solid ${t.bg}`}
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.012)` }} fontWeight="900" color={t.bg}>◎</Text>
          </Flex>
        </Box>
      ),
    },
    {
      name: "Bitcoin", sub: null, val: "$114,200.20",
      icon: (
        <Flex
          style={{ width: fs.iconW, height: fs.iconW, borderRadius: "50%", flexShrink: 0 }}
          bg={t.surfaceAlt} border={`1px solid ${t.border}`} align="center" justify="center"
        >
          <Text style={{ fontSize: `calc(var(--ph)*0.026)` }} fontWeight="900" color={t.fg}>₿</Text>
        </Flex>
      ),
    },
    {
      name: "Ethereum", sub: null, val: "$4,111.02",
      icon: (
        <Flex
          style={{ width: fs.iconW, height: fs.iconW, borderRadius: "50%", flexShrink: 0 }}
          bg={t.surface} border={`1px solid ${t.border}`} align="center" justify="center"
        >
          <Text style={{ fontSize: `calc(var(--ph)*0.024)` }} fontWeight="700" color={t.fg}>Ξ</Text>
        </Flex>
      ),
    },
  ];

  return (
    <VStack h="100%" w="100%" align="stretch" spacing={0} bg={t.bg} overflow="hidden">
      <Box style={{ height: fs.statusH }} />

      {/* Header — matches mobile app */}
      <HStack px={fs.px} pb={`calc(var(--ph)*0.012)`} justify="space-between" align="center">
        <HStack spacing={`calc(var(--pw)*0.04)`}>
          <Box
            style={{ width: fs.avatarW, height: fs.avatarW, borderRadius: "50%", flexShrink: 0 }}
            bg={t.surfaceAlt} overflow="hidden"
          >
            <Flex w="100%" h="100%" align="center" justify="center">
              <Text style={{ fontSize: `calc(var(--ph)*0.022)` }}>💸</Text>
            </Flex>
          </Box>
          <Text style={{ fontSize: fs.handle }} color={t.fg} fontWeight="700" letterSpacing="-0.01em">
            @moe.ali
          </Text>
        </HStack>
        <HStack spacing={`calc(var(--pw)*0.03)`}>
          <Flex
            style={{ width: fs.actionW, height: fs.actionW, borderRadius: "50%" }}
            bg={t.surface} align="center" justify="center"
            border={`1px solid ${t.border}`}
            position="relative"
          >
            <Icon as={FiBell} color={t.fg}
              style={{ width: `calc(var(--ph)*0.022)`, height: `calc(var(--ph)*0.022)` }} />
            <Box position="absolute" top="-1px" right="-1px"
              w={`calc(var(--ph)*0.016)`} h={`calc(var(--ph)*0.016)`} borderRadius="full" bg="#ef4444" />
          </Flex>
          <Flex
            style={{ width: fs.actionW, height: fs.actionW, borderRadius: "50%" }}
            bg={t.surface} align="center" justify="center"
            border={`1px solid ${t.border}`}
          >
            <Icon as={FiCode} color={t.fg}
              style={{ width: `calc(var(--ph)*0.022)`, height: `calc(var(--ph)*0.022)` }} />
          </Flex>
        </HStack>
      </HStack>

      {/* Balance — centered like mobile */}
      <VStack align="center" spacing={`calc(var(--ph)*0.008)`} px={fs.px} pb={`calc(var(--ph)*0.022)`}>
        <Text
          style={{ fontSize: fs.balance }}
          color={t.fg} fontWeight="700"
          letterSpacing="-0.04em" lineHeight={1}
          fontFamily="'DM Sans', sans-serif"
        >
          $41,120.02
        </Text>
        <HStack spacing={`calc(var(--pw)*0.03)`}>
          <Text style={{ fontSize: fs.delta }} color={t.greenFg} fontWeight="600">+$1,244.02</Text>
          <HStack
            spacing={`calc(var(--pw)*0.015)`}
            bg={t.greenBg}
            px={`calc(var(--pw)*0.03)`} py={`calc(var(--ph)*0.004)`}
            borderRadius={`calc(var(--ph)*0.01)`}
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.016)` }} color={t.greenFg}>▲</Text>
            <Text style={{ fontSize: `calc(var(--ph)*0.018)` }} color={t.greenFg} fontWeight="700">3.12%</Text>
          </HStack>
        </HStack>
      </VStack>

      {/* Action buttons — 5 icon+label columns like mobile */}
      <HStack px={fs.px} pb={`calc(var(--ph)*0.022)`} spacing={`calc(var(--pw)*0.025)`} justify="center">
        {[
          { label: "Buy",     icon: FiPlus },
          { label: "Sell",    icon: FiDollarSign },
          { label: "Send",    icon: FiSend },
          { label: "Receive", icon: FiDownload },
          { label: "Deposit", icon: FiArrowDownLeft },
        ].map((a) => (
          <VStack key={a.label} align="center" spacing={`calc(var(--ph)*0.008)`}>
            <Flex
              style={{ width: fs.actionW, height: fs.actionW, borderRadius: "50%" }}
              bg={t.surface} align="center" justify="center"
              border={`1px solid ${t.border}`}
            >
              <Icon as={a.icon} color={t.fg} style={{ width: `calc(var(--ph)*0.022)`, height: `calc(var(--ph)*0.022)` }} />
            </Flex>
            <Text style={{ fontSize: fs.btn }} color={t.fg} fontWeight="700">{a.label}</Text>
          </VStack>
        ))}
      </HStack>

      {/* Tabs */}
      <HStack px={fs.px} pb={`calc(var(--ph)*0.015)`} spacing={`calc(var(--pw)*0.07)`}>
        {["Assets", "Wallets"].map((tab, i) => (
          <VStack key={tab} spacing={`calc(var(--ph)*0.005)`}>
            <Text style={{ fontSize: fs.tab }} color={i === 0 ? t.fg : t.fgFaint} fontWeight={i === 0 ? 700 : 600}>
              {tab}
            </Text>
            <Box w="100%" h={`calc(var(--ph)*0.003)`} bg={i === 0 ? t.fg : "transparent"} borderRadius="full" />
          </VStack>
        ))}
      </HStack>
      <Box h={`calc(var(--ph)*0.001)`} bg={t.border} />

      {/* Asset list */}
      <VStack align="stretch" spacing={0} flex={1} overflowY="hidden">
        {assets.map((a) => (
          <HStack
            key={a.name} px={fs.px} py={`calc(var(--ph)*0.017)`}
            spacing={`calc(var(--pw)*0.05)`}
            borderBottom={`1px solid ${t.border}`}
          >
            {a.icon}
            <VStack align="start" spacing={0} flex={1}>
              <Text style={{ fontSize: fs.asset }} color={t.fg} fontWeight="600">{a.name}</Text>
              {a.sub && <Text style={{ fontSize: fs.assetSub }} color={t.fgFaint}>{a.sub}</Text>}
            </VStack>
            <Text style={{ fontSize: fs.val }} color={t.fg} fontWeight="600" fontFamily="monospace">
              {a.val}
            </Text>
          </HStack>
        ))}
      </VStack>

      {/* Bottom tab bar — matches mobile app */}
      <HStack
        justify="space-around" align="center"
        borderTop={`1px solid ${t.border}`}
        bg={t.bg}
        px={fs.px} py={`calc(var(--ph)*0.012)`}
        spacing={0}
      >
        {[
          { icon: FiMessageCircle, label: "Messages" },
          { icon: FiCreditCard, label: "Wallet" },
          { icon: null, label: "Home", fab: true },
          { icon: FiRepeat, label: "P2P" },
          { icon: FiUser, label: "Profile" },
        ].map((tab, i) => (
          <VStack key={tab.label} align="center" spacing={`calc(var(--ph)*0.004)`} flex={tab.fab ? 1.4 : 1}>
            {tab.fab ? (
              <Flex
                style={{ width: fs.actionH, height: fs.actionH, borderRadius: "50%" }}
                bg={t.fg} align="center" justify="center"
                boxShadow={dark ? "0 4px 14px rgba(255,255,255,0.2)" : "0 4px 14px rgba(0,0,0,0.2)"}
              >
                <Icon as={FiHome} color={t.bg} style={{ width: `calc(var(--ph)*0.024)`, height: `calc(var(--ph)*0.024)` }} />
              </Flex>
            ) : (
              <>
                <Icon as={tab.icon!} color={i === 0 ? t.fg : t.fgFaint} style={{ width: `calc(var(--ph)*0.022)`, height: `calc(var(--ph)*0.022)` }} />
                <Box w={`calc(var(--ph)*0.008)`} h={`calc(var(--ph)*0.008)`} borderRadius="full" bg={i === 0 ? t.fg : "transparent"} />
              </>
            )}
          </VStack>
        ))}
      </HStack>
    </VStack>
  );
});

/* ═════════════════════════════════════════════════════════════════
   P2P SCREEN — monochrome
   ═════════════════════════════════════════════════════════════════ */
function ScreenP2P() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const tk = screenTokens(dark);

  const fs = {
    title:  "calc(var(--ph) * 0.022)",
    label:  "calc(var(--ph) * 0.018)",
    micro:  "calc(var(--ph) * 0.014)",
    val:    "calc(var(--ph) * 0.016)",
    px:     "calc(var(--pw) * 0.02)",
    gap:    "calc(var(--ph) * 0.012)",
    avatar: "calc(var(--ph) * 0.042)",
    avatarR:"calc(var(--ph) * 0.008)",
    btn:    "calc(var(--ph) * 0.014)",
    btnH:   "calc(var(--ph) * 0.036)",
    statusH: "calc(var(--ph) * 0.035)",
    cardR:  "calc(var(--ph) * 0.018)",
  };

  const offers = [
    { name: "Rayan Z.",  rate: "67,240.50", lim: "100 – 50,000", orders: 1144, cur: "BTC/USDT" },
    { name: "Rahma A.",  rate: "3.67",      lim: "114.20 – 41,120", orders: 411, cur: "USDT/AED" },
    { name: "Noran G.",  rate: "3.75",      lim: "41.12 – 11,420", orders: 1120, cur: "USDT/SAR" },
  ];

  return (
    <VStack h="100%" w="100%" px={fs.px} align="stretch" spacing={fs.gap} bg={tk.bg}>
      <Box style={{ height: fs.statusH }} />

      {/* Header — matches mobile P2P */}
      <HStack justify="space-between" align="center">
        <Text style={{ fontSize: fs.title }} color={tk.fg} fontWeight="800">
          P2P market
        </Text>
        <HStack spacing={`calc(var(--pw)*0.03)`}>
          <HStack
            bg={tk.surface} border={`1px solid ${tk.border}`} borderRadius="full"
            px={`calc(var(--pw)*0.04)`} py={`calc(var(--ph)*0.008)`}
            spacing={`calc(var(--pw)*0.02)`}
          >
            <Icon as={FiLock} color={tk.fg} style={{ width: `calc(var(--ph)*0.014)`, height: `calc(var(--ph)*0.014)` }} />
            <Text style={{ fontSize: fs.btn }} color={tk.fg} fontWeight="700">Trades</Text>
          </HStack>
          <Flex
            style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%" }}
            bg={tk.fg} align="center" justify="center"
          >
            <Icon as={FiPlus} color={tk.bg} style={{ width: `calc(var(--ph)*0.018)`, height: `calc(var(--ph)*0.018)` }} />
          </Flex>
        </HStack>
      </HStack>

      {/* Buy/Sell toggle — matches mobile */}
      <HStack bg={tk.surface} borderRadius={fs.avatarR} border={`1px solid ${tk.border}`} p={`calc(var(--ph)*0.005)`}>
        <Box flex={1} bg={tk.pillActive} borderRadius={fs.avatarR} textAlign="center" py={`calc(var(--ph)*0.012)`}>
          <Text style={{ fontSize: fs.label }} color={tk.pillActiveFg} fontWeight="800">I want to buy</Text>
        </Box>
        <Box flex={1} textAlign="center" py={`calc(var(--ph)*0.012)`}>
          <Text style={{ fontSize: fs.label }} color={tk.fgMuted} fontWeight="700">I want to sell</Text>
        </Box>
      </HStack>

      {/* Fiat chips — matches mobile */}
      <HStack spacing={`calc(var(--pw)*0.02)`} overflow="hidden">
        {["All", "USD", "AED", "SAR", "EUR", "EGP"].map((f, i) => (
          <HStack key={f}
            bg={i === 0 ? tk.fg : tk.surface} border={`1px solid ${i === 0 ? tk.fg : tk.border}`}
            borderRadius="full" px={`calc(var(--pw)*0.04)`} py={`calc(var(--ph)*0.008)`}
          >
            <Text style={{ fontSize: fs.btn }} color={i === 0 ? tk.bg : tk.fgMuted} fontWeight="700">{f}</Text>
          </HStack>
        ))}
      </HStack>

      {/* Offer cards — matches mobile OfferCard */}
      <VStack align="stretch" spacing={fs.gap} flex={1} overflowY="hidden">
        {offers.map((o) => (
          <Box key={o.name}
            bg={tk.surface} p={`calc(var(--ph)*0.016)`}
            borderRadius={fs.cardR} border={`1px solid ${tk.border}`}
          >
            {/* Trader row */}
            <HStack mb={`calc(var(--ph)*0.008)`} spacing={`calc(var(--pw)*0.04)`}>
              <Flex
                style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%", flexShrink: 0 }}
                bg={tk.surfaceAlt} align="center" justify="center"
              >
                <Text style={{ fontSize: `calc(var(--ph)*0.018)` }} color={tk.fg} fontWeight="700">{o.name.charAt(0)}</Text>
              </Flex>
              <VStack align="start" spacing={0} flex={1}>
                <HStack spacing={`calc(var(--pw)*0.015)`}>
                  <Text style={{ fontSize: fs.label }} color={tk.fg} fontWeight="700">@{o.name.toLowerCase().replace(' ', '')}</Text>
                  <Icon as={FiCheck} color={tk.greenFg} style={{ width: `calc(var(--ph)*0.012)`, height: `calc(var(--ph)*0.012)` }} />
                </HStack>
                <HStack spacing={`calc(var(--pw)*0.015)`}>
                  <Text style={{ fontSize: fs.micro }} color="#f59e0b">★</Text>
                  <Text style={{ fontSize: fs.micro }} color={tk.fgMuted} fontWeight="600">4.9 · {o.orders} orders</Text>
                </HStack>
              </VStack>
              <Box
                bg={tk.greenBg} px={`calc(var(--pw)*0.03)`} py={`calc(var(--ph)*0.004)`}
                borderRadius={`calc(var(--ph)*0.01)`}
              >
                <Text style={{ fontSize: fs.micro }} color={tk.greenFg} fontWeight="800" letterSpacing="0.05em">BUY</Text>
              </Box>
            </HStack>

            {/* Rate */}
            <HStack spacing={`calc(var(--pw)*0.015)`} mt={`calc(var(--ph)*0.014)`}>
              <Text style={{ fontSize: fs.micro }} color={tk.fgFaint} fontWeight="700" letterSpacing="0.06em">RATE</Text>
              <Text style={{ fontSize: `calc(var(--ph)*0.022)`, color: tk.fg, fontWeight: "800", letterSpacing: "-0.02em" }}>{o.rate}</Text>
              <Text style={{ fontSize: fs.micro }} color={tk.fgMuted} fontWeight="600">{o.cur}</Text>
            </HStack>

            {/* Limits & Available */}
            <HStack justify="space-between" mt={`calc(var(--ph)*0.01)`}>
              <VStack align="start" spacing={0}>
                <Text style={{ fontSize: `calc(var(--ph)*0.01)`, color: tk.fgFaint, fontWeight: "700", letterSpacing: "0.06em" }}>LIMITS</Text>
                <Text style={{ fontSize: fs.micro, color: tk.fg, fontWeight: "700", marginTop: `calc(var(--ph)*0.002)` }}>{o.lim}</Text>
              </VStack>
              <VStack align="end" spacing={0}>
                <Text style={{ fontSize: `calc(var(--ph)*0.01)`, color: tk.fgFaint, fontWeight: "700", letterSpacing: "0.06em" }}>AVAILABLE</Text>
                <Text style={{ fontSize: fs.micro, color: tk.fg, fontWeight: "700", marginTop: `calc(var(--ph)*0.002)` }}>1.5 BTC</Text>
              </VStack>
            </HStack>

            {/* Methods */}
            <HStack flexWrap="wrap" spacing={`calc(var(--pw)*0.02)`} mt={`calc(var(--ph)*0.012)`}>
              {["Bank Transfer", "Cash"].map((m) => (
                <Box key={m}
                  bg={tk.surfaceAlt} border={`1px solid ${tk.border}`}
                  px={`calc(var(--pw)*0.03)`} py={`calc(var(--ph)*0.004)`}
                  borderRadius={`calc(var(--ph)*0.008)`}
                >
                  <Text style={{ fontSize: `calc(var(--ph)*0.0105)`, color: tk.fgMuted, fontWeight: "700" }}>{m}</Text>
                </Box>
              ))}
            </HStack>
          </Box>
        ))}
      </VStack>
    </VStack>
  );
}

/* ═════════════════════════════════════════════════════════════════
   SOCIAL WALLET SCREEN — matches mobile Public Profile (u/[handle].tsx)
   ═════════════════════════════════════════════════════════════════ */
function ScreenSocialWallet() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const tk = screenTokens(dark);

  const fs = {
    title:   "calc(var(--ph) * 0.022)",
    name:    "calc(var(--ph) * 0.021)",
    sub:     "calc(var(--ph) * 0.014)",
    val:     "calc(var(--ph) * 0.018)",
    micro:   "calc(var(--ph) * 0.014)",
    btn:     "calc(var(--ph) * 0.018)",
    px:      "calc(var(--pw) * 0.09)",
    gap:     "calc(var(--ph) * 0.012)",
    avatar:  "calc(var(--ph) * 0.055)",
    avatarR: "calc(var(--ph) * 0.01)",
    cardR:   "calc(var(--ph) * 0.026)",
    btnH:    "calc(var(--ph) * 0.065)",
    statusH: "calc(var(--ph) * 0.035)",
    tileH:   "calc(var(--ph) * 0.11)",
  };

  const buckets = [
    { label: "Crypto", val: "$52,640.50", accent: "#f7931a", icon: "₿" },
    { label: "Fiat",   val: "$11,444.28", accent: "#22c55e", icon: "$" },
    { label: "Cards",  val: "$4,111.02",  accent: "#7c3aed", icon: "💳" },
  ];

  const assets = [
    { name: "Bitcoin",  sub: "BTC",  val: "$52,640.50",  icon: "₿", color: "#f7931a" },
    { name: "Ethereum", sub: "ETH",  val: "$3,240.50",   icon: "Ξ", color: "#627eea" },
    { name: "USDT",     sub: "SOL",  val: "$11,444.28",  icon: "$", color: "#22c55e" },
  ];

  return (
    <VStack h="100%" w="100%" px={fs.px} align="stretch" spacing={fs.gap} bg={tk.bg}>
      <Box style={{ height: fs.statusH }} />

      {/* Header — Public Profile */}
      <VStack align="start" spacing={0}>
        <Text style={{ fontSize: fs.title }} color={tk.fg} fontWeight="800">
          @rayray
        </Text>
        <Text style={{ fontSize: fs.sub }} color={tk.fgMuted} fontWeight="600">
          Rayoonty
        </Text>
      </VStack>

      {/* Identity card */}
      <VStack
        bg={tk.surface} border={`1px solid ${tk.border}`}
        borderRadius={fs.cardR} p={`calc(var(--ph)*0.02)`}
        align="center" spacing={`calc(var(--ph)*0.008)`}
      >
        <Flex
          style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%" }}
          bg="#7c3aed" align="center" justify="center"
        >
          <Text style={{ fontSize: `calc(var(--ph)*0.040)` }} color="white" fontWeight="800">R</Text>
        </Flex>
        <Text style={{ fontSize: fs.name }} color={tk.fg} fontWeight="800" letterSpacing="-0.02em">itsrondobaby</Text>
        <Text style={{ fontSize: fs.sub }} color={tk.fgMuted} fontWeight="600">@rondorowdy</Text>
        <HStack
          bg={tk.greenBg} border={`1px solid ${tk.greenFg}`}
          borderRadius="12px" px={`calc(var(--ph)*0.012)`} py={`calc(var(--ph)*0.006)`}
          spacing={`calc(var(--pw)*0.015)`} mt={`calc(var(--ph)*0.004)`}
        >
          <Icon as={FiShield} color={tk.greenFg} style={{ width: `calc(var(--ph)*0.016)`, height: `calc(var(--ph)*0.016)` }} />
          <Text style={{ fontSize: `calc(var(--ph)*0.012)` }} color={tk.greenFg} fontWeight="800" letterSpacing="0.04em">VERIFIED</Text>
        </HStack>
      </VStack>

      {/* Stats row */}
      <HStack spacing={`calc(var(--pw)*0.02)`}>
        {[
          { v: "44", l: "P2P trades" },
          { v: "98%", l: "Completion" },
          { v: "2", l: "Open offers" },
        ].map((s) => (
          <VStack key={s.l} flex={1} bg={tk.surface} border={`1px solid ${tk.border}`}
            borderRadius={fs.cardR} p={`calc(var(--ph)*0.014)`} align="center" spacing={`calc(var(--ph)*0.004)`}>
            <Text style={{ fontSize: `calc(var(--ph)*0.020)` }} color={tk.fg} fontWeight="800" fontFamily="monospace">{s.v}</Text>
            <Text style={{ fontSize: `calc(var(--ph)*0.011)` }} color={tk.fgFaint} fontWeight="700" letterSpacing="0.06em" textTransform="uppercase">{s.l}</Text>
          </VStack>
        ))}
      </HStack>

      {/* Accepted currencies */}
      <VStack align="start" spacing={`calc(var(--ph)*0.008)`}>
        <Text style={{ fontSize: `calc(var(--ph)*0.014)` }} color={tk.fgFaint} fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">Accepts</Text>
        <HStack spacing={`calc(var(--pw)*0.015)`} flexWrap="wrap">
          {["USDT","AED","SAR","EGP"].map((c) => (
            <Box key={c} bg={tk.surfaceAlt} border={`1px solid ${tk.border}`}
              borderRadius="10px" px={`calc(var(--ph)*0.010)`} py={`calc(var(--ph)*0.005)`}>
              <Text style={{ fontSize: `calc(var(--ph)*0.012)` }} color={tk.fg} fontWeight="700">{c}</Text>
            </Box>
          ))}
        </HStack>
      </VStack>

      {/* P2P Offers */}
      <VStack align="start" spacing={`calc(var(--ph)*0.008)`} flex={1} overflowY="hidden">
        <Text style={{ fontSize: `calc(var(--ph)*0.014)` }} color={tk.fgFaint} fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">P2P Offers</Text>
        <VStack bg={tk.surface} border={`1px solid ${tk.border}`} borderRadius={fs.cardR}
          p={`calc(var(--ph)*0.014)`} align="stretch" spacing={`calc(var(--ph)*0.010)`}>
          <HStack spacing={`calc(var(--pw)*0.02)`}>
            <Box bg={tk.greenBg} borderRadius="8px" px={`calc(var(--ph)*0.008)`} py={`calc(var(--ph)*0.004)`}>
              <Text style={{ fontSize: `calc(var(--ph)*0.012)` }} color={tk.greenFg} fontWeight="800">BUY</Text>
            </Box>
            <VStack align="start" spacing={0} flex={1}>
              <Text style={{ fontSize: fs.val }} color={tk.fg} fontWeight="700">3.672 AED/USDT</Text>
              <Text style={{ fontSize: fs.micro }} color={tk.fgMuted}>100 – 5,000 AED</Text>
            </VStack>
            <Icon as={FiChevronRight} color={tk.fgFaint} style={{ width: `calc(var(--ph)*0.018)`, height: `calc(var(--ph)*0.018)` }} />
          </HStack>
        </VStack>
      </VStack>

      {/* Send Money CTA */}
      <HStack justify="center" style={{ height: `calc(var(--ph)*0.055)` }}
        bg={tk.accent} borderRadius="full">
        <Icon as={FiSend} color="white" style={{ width: `calc(var(--ph)*0.018)`, height: `calc(var(--ph)*0.018)` }} />
        <Text style={{ fontSize: fs.btn }} color="white" fontWeight="800" ml={`calc(var(--pw)*0.02)`}>Send Money</Text>
      </HStack>
    </VStack>
  );
}

/* ═════════════════════════════════════════════════════════════════
   VISA CARD SCREEN — monochrome
   ═════════════════════════════════════════════════════════════════ */
function ScreenCard() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const tk = screenTokens(dark);

  const fs = {
    title:   "calc(var(--ph) * 0.022)",
    pan:     "calc(var(--ph) * 0.014)",
    label:   "calc(var(--ph) * 0.012)",
    holder:  "calc(var(--ph) * 0.016)",
    stat:    "calc(var(--ph) * 0.010)",
    statVal: "calc(var(--ph) * 0.012)",
    txName:  "calc(var(--ph) * 0.018)",
    txSub:   "calc(var(--ph) * 0.015)",
    txVal:   "calc(var(--ph) * 0.018)",
    btn:     "calc(var(--ph) * 0.018)",
    btnH:    "calc(var(--ph) * 0.052)",
    visa:    "calc(var(--ph) * 0.016)",
    chipW:   "calc(var(--pw) * 0.11)",
    chipH:   "calc(var(--ph) * 0.035)",
    avatar:  "calc(var(--ph) * 0.042)",
    avatarR: "calc(var(--ph) * 0.01)",
    px:      "calc(var(--pw) * 0.09)",
    gap: "calc(var(--ph) * 0.018)",
    statusH: "calc(var(--ph) * 0.02)",
    cardR:   "calc(var(--ph) * 0.028)",
  };

  const txns = [
    { n: "Apple Store", c: "Dubai · AED",   amt: "-114.20" },
    { n: "Carrefour",   c: "Riyadh · SAR",  amt: "-41.12" },
    { n: "Uber",        c: "Cairo · EGP",   amt: "-11.44" },
  ];

  return (
    <VStack h="100%" w="100%" px={fs.px} align="stretch" spacing={fs.gap} bg={tk.bg}>
      <Box style={{ height: fs.statusH }} />

      {/* Header — matches mobile Cards screen */}
      <VStack align="start" spacing={`calc(var(--ph)*0.004)`} mb={`calc(var(--ph)*0.01)`}>
        <Text style={{ fontSize: fs.title }} color={tk.fg} fontWeight="800">
          Cards
        </Text>
        <Text style={{ fontSize: fs.label }} color={tk.fgMuted} fontWeight="600">
          1 active card
        </Text>
      </VStack>

      {/* Card face — black card always for visual impact */}
      <Box
        position="relative" borderRadius={fs.cardR} overflow="hidden"
        bg={dark ? "#ffffff" : "#000000"}
        boxShadow={dark
          ? "0 calc(var(--ph)*0.025) calc(var(--ph)*0.06) rgba(255,255,255,0.12)"
          : "0 calc(var(--ph)*0.025) calc(var(--ph)*0.06) rgba(0,0,0,0.35)"}
        style={{ aspectRatio: "1.586 / 1" }}
      >
        <Box position="absolute" inset={0} p={`calc(var(--pw)*0.07)`}
          display="flex" flexDirection="column" justifyContent="space-between"
        >
          <HStack justify="space-between" align="center">
            <NextImage src={dark ? "/logo-black.png" : "/logo-white.png"} width={15} height={15} alt="logo" />
            <Icon as={FiWifi} color={dark ? "black" : "white"}
              style={{ width: `calc(var(--ph)*0.022)`, height: `calc(var(--ph)*0.022)`, transform: "rotate(90deg)" }}
              opacity={0.9}
            />
          </HStack>
          <HStack justify="space-between" align="center">
            <Text style={{ fontSize: fs.label }} color={dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)"} fontWeight="700" letterSpacing="0.1em">MASTER</Text>
          </HStack>
          <Text style={{ fontSize: fs.pan }} color={dark ? "black" : "white"} fontFamily="monospace" letterSpacing="0.18em" fontWeight="700">
            1144 4411 1142 1144
          </Text>
          <HStack justify="space-between" align="flex-end">
            <HStack spacing={`calc(var(--pw)*0.008)`}>
              {[{ l: "CARD HOLDER", v: "RAYAN Z." }, { l: "EXPIRES", v: "11/44" }].map((d) => (
                <VStack key={d.l} align="start" spacing={0}>
                  <Text style={{ fontSize: fs.label }} color={dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)"} letterSpacing="0.1em">{d.l}</Text>
                  <Text style={{ fontSize: fs.holder }} color={dark ? "black" : "white"} fontWeight="700">{d.v}</Text>
                </VStack>
              ))}
            </HStack>
            <Text style={{ fontSize: fs.visa }} color={dark ? "black" : "white"} fontWeight="900" fontStyle="italic">VISA</Text>
          </HStack>
        </Box>
      </Box>

      {/* Tier pills */}
      <HStack spacing={`calc(var(--pw)*0.02)`} justify="center">
        {[{ label: "Starter", active: false }, { label: "Master", active: true }, { label: "Pro", active: false }].map((t2) => (
          <HStack
            key={t2.label}
            bg={t2.active ? tk.fg : tk.surface}
            border={`1px solid ${tk.border}`}
            borderRadius="full"
            px={`calc(var(--pw)*0.05)`} py={`calc(var(--ph)*0.008)`}
            spacing={`calc(var(--pw)*0.025)`}
          >
            <Box w={`calc(var(--ph)*0.016)`} h={`calc(var(--ph)*0.016)`} borderRadius="full" bg={t2.active ? tk.bg : tk.fg} />
            <Text style={{ fontSize: fs.label }} color={t2.active ? tk.bg : tk.fg} fontWeight="700">{t2.label}</Text>
          </HStack>
        ))}
      </HStack>

      {/* Stats */}
      <SimpleGrid columns={3} spacing={`calc(var(--pw)*0.003)`}>
        {[{ l: "Spent", v: "$4,111.02" }, { l: "Limit", v: "$41,120" }, { l: "Cashback", v: "$114.02" }].map((s) => (
          <VStack key={s.l} bg={tk.surface} p={`calc(var(--ph)*0.001)`}
            borderRadius={`calc(var(--ph)*0.015)`} spacing={0}
            border={`1px solid ${tk.border}`}
          >
            <Text style={{ fontSize: fs.stat }} color={tk.fgFaint} letterSpacing="0.08em" textTransform="uppercase">{s.l}</Text>
            <Text style={{ fontSize: fs.statVal }} color={tk.fg} fontWeight="800" fontFamily="monospace">{s.v}</Text>
          </VStack>
        ))}
      </SimpleGrid>

      {/* Txns */}
      <VStack align="stretch" spacing={`calc(var(--ph)*0.008)`} flex={1}>
        {txns.map((s) => (
          <HStack key={s.n}
            bg={tk.surface} p={`calc(var(--ph)*0.009)`}
            borderRadius={`calc(var(--ph)*0.014)`}
            border={`1px solid ${tk.border}`}
            spacing={`calc(var(--pw)*0.04)`}
          >
            <Flex
              style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%", flexShrink: 0 }}
              bg={tk.surfaceAlt} align="center" justify="center"
            >
              <Icon as={FiCreditCard} color={tk.fgMuted} style={{ width: `calc(var(--ph)*0.018)`, height: `calc(var(--ph)*0.018)` }} />
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <Text style={{ fontSize: fs.txName }} color={tk.fg} fontWeight="700">{s.n}</Text>
              <Text style={{ fontSize: fs.txSub }} color={tk.fgFaint}>{s.c}</Text>
            </VStack>
            <Text style={{ fontSize: fs.txVal }} color={tk.fgMuted} fontWeight="800" fontFamily="monospace">{s.amt}</Text>
          </HStack>
        ))}
      </VStack>

      <HStack
        justify="center" style={{ height: fs.btnH }}
        bg={tk.surface}
        border={`1px solid ${tk.border}`}
        borderRadius={`calc(var(--ph)*0.015)`}
        cursor="pointer"
      >
        <Text style={{ fontSize: fs.btn }} color={tk.fg} fontWeight="700">❄ Freeze Card</Text>
      </HStack>
    </VStack>
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
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

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
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
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
   MESSAGE THREAD SCREEN — matches mobile messages/[id].tsx
   ═════════════════════════════════════════════════════════════════ */
function PhoneSendScreen() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const tk = screenTokens(dark);

  const fs = {
    title:    "calc(var(--ph) * 0.002)",
    name:     "calc(var(--ph) * 0.018)",
    sub:      "calc(var(--ph) * 0.014)",
    bubble:   "calc(var(--ph) * 0.015)",
    time:     "calc(var(--ph) * 0.012)",
    btn:      "calc(var(--ph) * 0.019)",
    btnH:     "calc(var(--ph) * 0.055)",
    avatar:   "calc(var(--ph) * 0.055)",
    avatarH:  "calc(var(--ph) * 0.035)",
    emoji:    "calc(var(--ph) * 0.038)",
    px:       "calc(var(--pw) * 0.09)",
    statusH:  "calc(var(--ph) * 0.028)",
    gap:      "calc(var(--ph) * 0.010)",
  };

  return (
    <VStack h="100%" w="100%" align="stretch" bg={tk.bg}>
      <Box style={{ height: fs.statusH }} />

      {/* Header */}
      <HStack px={fs.px} justify="space-between" align="center">
        <Flex
          style={{ width: fs.avatarH, height: fs.avatarH, borderRadius: "50%" }}
          bg={tk.surfaceAlt} border={`1px solid ${tk.border}`} align="center" justify="center"
        >
          <Icon as={FiChevronLeft} color={tk.fg} style={{ width: `calc(var(--ph)*0.020)`, height: `calc(var(--ph)*0.020)` }} />
        </Flex>
        <HStack spacing={`calc(var(--pw)*0.020)`}>
          <Flex
            style={{ width: fs.avatarH, height: fs.avatarH, borderRadius: "50%" }}
            bg="#7c3aed" align="center" justify="center"
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.018)` }} color="white" fontWeight="800">R</Text>
          </Flex>
          <VStack align="start" spacing={0}>
            <HStack spacing={`calc(var(--pw)*0.008)`}>
              <Text style={{ fontSize: fs.name }} color={tk.fg} fontWeight="700">Rayan Z.</Text>
            </HStack>
            <Text style={{ fontSize: fs.sub }} color={tk.fgMuted}>@rayofsunshine</Text>
          </VStack>
        </HStack>
        <Flex
          style={{ width: fs.avatarH, height: fs.avatarH, borderRadius: "50%" }}
          bg={tk.surfaceAlt} border={`1px solid ${tk.border}`} align="center" justify="center"
        >
          <Icon as={FiMoreHorizontal} color={tk.fg} style={{ width: `calc(var(--ph)*0.020)`, height: `calc(var(--ph)*0.020)` }} />
        </Flex>
      </HStack>

      {/* Date chip */}
      <HStack justify="center" py={`calc(var(--ph)*0.010)`}>
        <Box bg={tk.surfaceAlt} border={`1px solid ${tk.border}`} borderRadius="12px"
          px={`calc(var(--ph)*0.012)`} py={`calc(var(--ph)*0.005)`}>
          <Text style={{ fontSize: fs.time }} color={tk.fgMuted} fontWeight="600">Today</Text>
        </Box>
      </HStack>

      {/* Message bubbles */}
      <VStack flex={1} px={fs.px} spacing={`calc(var(--ph)*0.008)`} overflowY="hidden" justify="flex-end">
        {/* Left bubble */}
        <HStack align="flex-end" spacing={`calc(var(--pw)*0.020)`} alignSelf="flex-start">
          <Flex
            style={{ width: `calc(var(--ph)*0.030)`, height: `calc(var(--ph)*0.030)`, borderRadius: "50%" }}
            bg="#7c3aed" align="center" justify="center" flexShrink={0}
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.014)` }} color="white" fontWeight="800">R</Text>
          </Flex>
          <Box bg={tk.surface} border={`1px solid ${tk.border}`}
            borderRadius="18px" borderBottomLeftRadius="6px"
            px={`calc(var(--ph)*0.014)`} py={`calc(var(--ph)*0.010)`}
            maxW="78%"
          >
            <Text style={{ fontSize: fs.bubble }} color={tk.fg} fontWeight="500" lineHeight={1.4}>Hey! Do you still have USDT?</Text>
          </Box>
        </HStack>

        {/* Right bubble */}
        <Box alignSelf="flex-end" bg={tk.accent}
          borderRadius="18px" borderBottomRightRadius="6px"
          px={`calc(var(--ph)*0.014)`} py={`calc(var(--ph)*0.010)`}
          maxW="78%"
        >
          <Text style={{ fontSize: fs.bubble }} color="white" fontWeight="500" lineHeight={1.4}>Yes, I can send $1,144 right now</Text>
        </Box>

        {/* Payment bubble */}
        <HStack alignSelf="flex-end" bg={tk.accentMuted} border={`1px solid ${tk.accent}`}
          borderRadius="18px" px={`calc(var(--ph)*0.014)`} py={`calc(var(--ph)*0.010)`}
          spacing={`calc(var(--pw)*0.020)`} maxW="78%"
        >
          <VStack align="start" spacing={0}>
            <Text style={{ fontSize: fs.bubble }} color={tk.fg} fontWeight="700">You sent $1,144.28</Text>
            <Text style={{ fontSize: fs.time }} color={tk.fgMuted}>USDT</Text>
          </VStack>
          <Icon as={FiCheck} color={tk.accent} style={{ width: `calc(var(--ph)*0.016)`, height: `calc(var(--ph)*0.016)` }} />
        </HStack>

        {/* Emoji */}
        <Text alignSelf="flex-end" style={{ fontSize: fs.emoji, lineHeight: 1.2 }}>🎉</Text>
      </VStack>

      {/* Sticker row */}
      <HStack px={fs.px} py={`calc(var(--ph)*0.008)`} spacing={`calc(var(--pw)*0.018)`} overflow="hidden">
        {["😂","❤️","🔥","👍","🎉","😭","😍","🙏"].map((e) => (
          <Text key={e} style={{ fontSize: `calc(var(--ph)*0.028)` }}>{e}</Text>
        ))}
      </HStack>

      {/* Composer */}
      <HStack px={fs.px} py={`calc(var(--ph)*0.010)`} spacing={`calc(var(--pw)*0.018)`} align="center">
        <Flex
          style={{ width: `calc(var(--ph)*0.035)`, height: `calc(var(--ph)*0.035)`, borderRadius: "50%" }}
          bg={tk.surfaceAlt} align="center" justify="center"
        >
          <Icon as={FiDollarSign} color={tk.fg} style={{ width: `calc(var(--ph)*0.018)`, height: `calc(var(--ph)*0.018)` }} />
        </Flex>
        <Flex
          style={{ width: `calc(var(--ph)*0.035)`, height: `calc(var(--ph)*0.035)`, borderRadius: "50%" }}
          bg={tk.surfaceAlt} align="center" justify="center"
        >
          <Icon as={FiSmile} color={tk.fg} style={{ width: `calc(var(--ph)*0.018)`, height: `calc(var(--ph)*0.018)` }} />
        </Flex>
        <Box flex={1} bg={tk.surface} border={`1px solid ${tk.border}`}
          borderRadius="full" px={`calc(var(--ph)*0.012)`} py={`calc(var(--ph)*0.008)`}>
          <Text style={{ fontSize: fs.bubble }} color={tk.fgFaint}>Message...</Text>
        </Box>
        <Flex
          style={{ width: `calc(var(--ph)*0.040)`, height: `calc(var(--ph)*0.040)`, borderRadius: "50%" }}
          bg={tk.accent} align="center" justify="center"
        >
          <Icon as={FiArrowUp} color="white" style={{ width: `calc(var(--ph)*0.020)`, height: `calc(var(--ph)*0.020)` }} />
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
                    ? (dark ? "rgba(74,143,224,0.35)" : "rgba(74,143,224,0.3)")
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
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <StaticPhone phOverride="clamp(320px, 42vh, 640px)">
                <PhoneSendScreen />
              </StaticPhone>
            </motion.div>
          </Flex>
          <motion.div
            initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <VStack align={{ base: "center", lg: "start" }} spacing={{ base: 6, md: 8 }} order={{ base: 1, lg: 1 }} textAlign={{ base: "center", lg: "start" }}>
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "40px", md: "64px", xl: "80px" }} letterSpacing="-0.04em">
                <Box as="span" color={textMain}>{t("sec_social_title_1")}</Box>
                <br />
                <Box as="span" color={dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)"}>{t("sec_social_title_2")}</Box>
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

  return (
    <Box className="snap-section-normal" position="relative" py={{ base: 16, md: 24 }} px={{ base: 4, md: 10 }} overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={2}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
          <Flex justify="center" order={{ base: 2, lg: imageSide === "left" ? 1 : 2 }}>
            <motion.div
              initial={{ opacity: 0, y: 48, scale: 0.93 }} whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <StaticPhone phOverride="clamp(320px, 42vh, 640px)">{phoneScreen}</StaticPhone>
            </motion.div>
          </Flex>
          <motion.div
            initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ order: imageSide === "left" ? 2 : 1 }}
          >
            <VStack align={{ base: "center", lg: "start" }} spacing={{ base: 5, md: 7 }} textAlign={{ base: "center", lg: "start" }}>
              <HStack spacing={3}>
                <Text fontSize={{ base: "11px", md: "12px" }} fontWeight="900" color={dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"} letterSpacing="0.16em" textTransform="uppercase">{eyebrow}</Text>
                {comingSoon && (
                  <Box px={2.5} py={0.5} borderRadius="full"
                    bg={dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
                    border={`1px solid ${dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`}
                    color={textMain} fontWeight="900" fontSize="10px" letterSpacing="0.05em" textTransform="uppercase"
                  >
                    {t("coming_soon")}
                  </Box>
                )}
              </HStack>
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "36px", md: "56px", xl: "72px" }} letterSpacing="-0.04em" lineHeight={1.05} color={textMain}>
                {title}
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">{desc}</Text>
              {extraBelow ? (
                <Box w="100%" maxW="460px">{extraBelow}</Box>
              ) : features.length > 0 && (
                <SimpleGrid columns={2} spacing={3} w="100%" maxW="460px">
                  {features.map((f, i) => (
                    <motion.div key={f.label} initial={{ opacity: 0, y: 12, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.4, delay: 0.08 * i }}>
                      <HStack h="64px" bg={tileBg} border="1px solid" borderColor={tileBorder} borderRadius="16px" px={4} spacing={3}
                        transition="all 0.2s ease"
                        _hover={{ transform: "translateY(-3px)", borderColor: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)" }}
                      >
                        <Flex w="36px" h="36px" borderRadius="10px" border="1px solid" borderColor={tileBorder} align="center" justify="center" flexShrink={0} bg={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}>
                          <Icon as={f.icon} color={dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)"} />
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
  const heroCardBg = dark
    ? "linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)"
    : "linear-gradient(145deg, #111111 0%, #000000 100%)";

  const stats = [
    { label: t("bento_security_title"), value: "", sub: t("bento_security_desc"), icon: FiShield, span: 2, hero: true },
    { label: t("bento_speed_title"), value: "<2s", sub: t("bento_speed_desc"), icon: FiZap, span: 1 },
    { label: t("bento_countries_label"), value: "120+", sub: t("bento_countries_desc"), icon: FiGlobe, span: 1 },
    { label: t("bento_pairs_label"), value: "400+", sub: "", icon: FiBarChart2, span: 1 },
    { label: "Waitlisted", value: "2,400+", sub: "early access members", icon: FiUsers, span: 1 },
    { label: t("bento_rating_label"), value: "4.2/5", sub: "", icon: FiStar, span: 1 },
  ];

  return (
    <Box py={{ base: 16, md: 32 }} px={{ base: 4, md: 10 }} position="relative" overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={1}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <VStack align="center" spacing={3} mb={{ base: 10, md: 16 }} textAlign="center">
            <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "32px", md: "56px", lg: "64px" }} letterSpacing="-0.04em" color={textMain} lineHeight={1.1}>
              {t("bento_title_1")}{" "}
              <Box as="span" color={dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)"}>{t("bento_title_2")}</Box>
            </Heading>
          </VStack>
        </motion.div>
        <SimpleGrid columns={{ base: 2, sm: 2, md: 4 }} gap={{ base: 3, md: 4 }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 30, scale: 0.95 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.25 }} transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} style={{ gridColumn: s.span && s.span > 1 ? `span ${s.span}` : undefined }}>
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
                    bg={(s as any).hero ? "rgba(255,255,255,0.12)" : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)")}
                    align="center" justify="center"
                  >
                    <Icon as={s.icon} color={(s as any).hero ? "white" : (dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)")} boxSize={{ base: 5, md: 6 }} />
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
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6 }}>
            <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "36px", md: "52px", lg: "64px" }} letterSpacing="-0.04em" color={textMain} lineHeight={1.1} maxW="720px">{t("onramp_headline")}</Heading>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15 }}>
            <Flex gap={{ base: 2, md: 3 }} flexWrap="wrap" justify="center" maxW="800px">
              {methods.map((m, i) => (
                <motion.div key={m.label} initial={{ opacity: 0, y: 8, scale: 0.92 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.35, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -2 }}>
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
              <motion.div key={c.title} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}>
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
            <motion.div key={a.src} initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, delay: a.delay, type: "spring", stiffness: 180, damping: 16 }} style={{ position: "absolute", top: a.top, left: a.left, transform: "translate(-50%, -50%)", zIndex: 1 }}>
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
            <motion.div initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
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

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: totalProgress } = useScroll({ target: scrollRef, offset: ["start start", "end end"] });

  const titleOpacity   = useTransform(totalProgress, [0, 0.18, 0.08], [1, 1, 0]);
  const titleY         = useTransform(totalProgress, [0, 0.08], [0, -40]);
  const phoneOpacity   = useTransform(totalProgress, [0, 0.05], [1, 1]);
  const phoneY         = useTransform(totalProgress, [0, 0.15], [0, 0]);
  const heroCTAOpacity = useTransform(totalProgress, [0, 0.07], [1, 0]);

  const unlockProgress     = useMotionValue(0);
  const stageOverlayOpacity = useMotionValue(0);

  useEffect(() => {
  const compute = () => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrolledPast = Math.max(0, -rect.top);
    // Much slower unlock: starts at 120px scrolled, completes at 600px
    unlockProgress.set(Math.min(1, Math.max(0, (scrolledPast - 120) / 480)));
    stageOverlayOpacity.set(Math.max(0, Math.min(1, (scrolledPast - 400) / 300)));
  };
  compute();
  window.addEventListener("scroll", compute, { passive: true });
  window.addEventListener("resize", compute);
  return () => { window.removeEventListener("scroll", compute); window.removeEventListener("resize", compute); };
}, [unlockProgress, stageOverlayOpacity]);

  useEffect(() => { fetchUser(); }, []);

  /* Title gradient — strictly b&w */
  const titleGradient = dark
    ? "linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)"
    : "linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)";

  const stages: Stage[] = [{ eyebrow: t("feat_dashboard_eyebrow"), title: t("feat_dashboard_title"), desc: t("feat_dashboard_desc"), widget: null }];

  if (isLoading) return null;
  if (isAuthenticated) return (<><PublicNav /><AuthenticatedHome /></>);

  return (
    <Box minH="100vh" overflowX="clip" color={textMain} bg={pageBg}>
      {/* ── Risk warning banner ─────────────────────────────────────────── */}
      <Box
        id="risk-banner"
        bg={dark ? "#111111" : "#f4f4f4"}
        borderBottom="1px solid"
        borderColor={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
        py={2.5} px={4}
        textAlign="center"
      >
        <Text fontSize={{ base: "11px", md: "12px" }} color={dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)"} lineHeight="1.5">
          <Box as="span" fontWeight="700" color={dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)"}>
            {t("risk_banner_bold")}
          </Box>{" "}
          {t("risk_banner_text")}{" "}
          <Box
            as={NextLink}
            href="/risk"
            fontWeight="700"
            color={dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)"}
            textDecoration="underline"
            _hover={{ opacity: 0.75 }}
          >
            {t("risk_banner_cta")}
          </Box>
        </Text>
      </Box>
      <PublicNav />

      {/* ══ HERO ══ */}
      <Box ref={scrollRef} id="features" position="relative" h={{ base: "200vh", md: "300vh" }} className="snap-none">
        <Box position="sticky" top={0} h={{ base: "calc(100vh - 44px)", md: "100vh" }} overflow="hidden">

          {/* Title */}
          <motion.div style={{ opacity: titleOpacity, y: titleY, position: "absolute", top: -25, left: 0, right: 0, paddingTop: "clamp(88px, 14vh, 180px)", zIndex: 4 }}>
            <Container maxW="1200px" position="relative">
              <VStack spacing={{ base: 3, md: 4 }} align="center">

                {/* Main headline */}
                <Flex
                  justify="center"
                  align="baseline"
                  wrap="nowrap"
                  gap={{ base: "0.42em", md: "0.925em" }}
                  dir={isAr ? "rtl" : "ltr"}
                  style={{ pointerEvents: "none" }}
                >
                  {[t("hero_line1"), t("hero_line2")].map((line, idx) => (
                    <Heading
                      key={idx}
                      as="h1"
                      fontWeight="900"
                      fontSize={{ base: "38px", sm: "44px", md: "54px", xl: "62px" }}
                      color={idx === 1 ? (dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)") : textMain}
                    >
                      {line}
                    </Heading>
                  ))}
                </Flex>
              </VStack>
            </Container>
          </motion.div>

          {/* Phone */}
          <Flex position="absolute" inset={0} align="center" justify="center" zIndex={2} pointerEvents="none">
            <motion.div style={{ opacity: phoneOpacity, y: phoneY, willChange: "opacity, transform" }}>
              <PhoneFrame unlockProgress={unlockProgress} />
            </motion.div>
          </Flex>

          {/* Stage overlay */}
          <motion.div style={{ opacity: stageOverlayOpacity, position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
            <StageOverlay stages={stages} />
          </motion.div>

          {/* Apple-style bottom CTA strip — visible at rest, fades on scroll */}
          <Box position="absolute" bottom={{ base: 5, md: 12 }} left={0} right={0} zIndex={5} style={{ pointerEvents: "none" }}>
            <motion.div style={{ opacity: heroCTAOpacity }}>
              <VStack spacing={{ base: 3, md: 4 }} align="center" style={{ pointerEvents: "auto" }}>

                {/* App store badges */}
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
                      <Icon as={b.icon} boxSize="18px" color={textMain} flexShrink={0} />
                      <VStack spacing={0} align="start">
                        <Text fontSize="13px" color={textMain} fontWeight="800" letterSpacing="-0.01em">{b.store}</Text>
                      </VStack>
                    </HStack>
                  ))}
                </HStack>
              </VStack>
            </motion.div>
          </Box>
        </Box>
      </Box>

      <SectionBento />
      <SectionOnRamp />
      <SectionSocialProof />
      <SectionSocialFinance />

      <AlternatingFeatureSection imageSide="left" eyebrow={t("feat_p2p_eyebrow")} title={t("feat_p2p_title")} desc={t("feat_p2p_desc")}
        features={[{ icon: FiGlobe, label: "120+ countries" }, { icon: FiShield, label: "Escrow protected" }, { icon: FiUsers, label: "Verified traders" }, { icon: FiZap, label: "Instant settle" }]}
        phoneScreen={<ScreenP2P />}
      />
      <AlternatingFeatureSection imageSide="right" eyebrow={t("feat_wallet_eyebrow")} title={t("feat_wallet_title")} desc={t("feat_wallet_desc")}
        features={[{ icon: FiAtSign, label: "Personal @handle" }, { icon: FiSend, label: "One-tap send" }, { icon: FiUsers, label: "Friends list" }, { icon: FiLock, label: "Privacy first" }]}
        phoneScreen={<ScreenSocialWallet />}
      />
      <AlternatingFeatureSection imageSide="left" eyebrow={t("feat_card_eyebrow")} title={t("feat_card_title")} desc={t("feat_card_desc")} comingSoon features={[]}
        phoneScreen={<ScreenCard />}
        extraBelow={
          <Box position="relative" w="100%" style={{ aspectRatio: "1024 / 720" }}>
            <NextImage src="/visa.png" alt="promrkts Visa cards" fill sizes="(max-width: 768px) 90vw, 460px" style={{ objectFit: "contain" }} />
          </Box>
        }
      />

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
                border: dark ? "1.5px solid rgba(74,143,224,0.5)" : "1.5px solid rgba(74,143,224,0.35)",
                boxShadow: dark ? "0 0 90px rgba(74,143,224,0.2)" : "0 0 90px rgba(74,143,224,0.12)",
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
              <HStack spacing={3} justify="center" pt={2}>
                {[
                  { store: "App Store", icon: FaApple },
                  { store: "Google Play", icon: FaGooglePlay },
                ].map((b) => (
                  <HStack key={b.store}
                    bg={dark ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.14)"}
                    border="1px solid"
                    borderColor={dark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)"}
                    borderRadius="4px" px={4} h={8} spacing={2.5} cursor="pointer"
                    _hover={{ bg: dark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)" }}
                    transition="background 0.15s"
                  >
                    <Icon as={b.icon} color={dark ? "#000000" : "#ffffff"} flexShrink={0} />
                    <VStack spacing={0} align="start">
                      <Text color={dark ? "#000000" : "#ffffff"} fontWeight="800" letterSpacing="-0.01em">{b.store}</Text>
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
              <Text
                fontSize="11px" fontWeight="800" letterSpacing="0.14em"
                color={dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)"} textTransform="uppercase"
              >
                {t("calc_section_eyebrow")}
              </Text>
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
              name: 'promrkts',
              description:
                'Crypto exchange and money transfer platform for MENA — Libya, Egypt, UAE, Saudi Arabia.',
              url: 'https://promrkts.com',
              areaServed: ['LY', 'EG', 'AE', 'SA', 'GB', 'US', 'EU'],
              currenciesAccepted: 'USD, EUR, GBP, LYD, EGP, AED, SAR, BTC, ETH, USDT, SOL',
              serviceType: ['Cryptocurrency Exchange', 'Money Transfer', 'Virtual Card Issuance'],
              sameAs: [
                'https://twitter.com/promrkts',
                'https://t.me/promrkts',
              ],
            }),
          }}
        />

        <Box position="relative" zIndex={1}><PublicFooter /></Box>
      </Box>
    </Box>
  );
}