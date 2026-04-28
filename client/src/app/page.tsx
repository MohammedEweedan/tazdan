"use client";

import { useRef, useEffect, useState, memo, useMemo } from "react";
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
import { useTranslate } from "@tolgee/react";
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
} from "react-icons/fi";
import { FaApplePay, FaGooglePay, FaCcVisa, FaCcMastercard, FaPaypal } from "react-icons/fa";
import { SiRevolut } from "react-icons/si";
import {
  motion, useScroll, useTransform, useMotionValue,
  MotionValue, AnimatePresence, useMotionValueEvent,
} from "framer-motion";
import { IconLogo } from "@/components/ui/Logo";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

/* ─────────────────────────────────────────────────────────────────
   RESPONSIVE PHONE SIZING SYSTEM
   ─────────────────────────────────────────────────────────────────
   All phone / screen dimensions are expressed as fractions of a
   single CSS custom property --ph (phone height).  The property is
   set on every phone wrapper via the `phoneVars` style object and
   resolves to a fluid value between 480 px (small phones) and
   780 px (large desktops) using clamp().

   Aspect ratio is fixed at 9:19.5 (modern iPhone).

   Usage inside screen components:
     fontSize: "calc(var(--ph) * 0.022)"   →  ~11 px at 500 ph
     w: "calc(var(--ph) * 0.07)"           →  ~35 px at 500 ph

   --ph is inherited, so every descendant can read it directly.
   ───────────────────────────────────────────────────────────────── */

/** CSS vars applied to every phone wrapper. */
const phoneVars: React.CSSProperties = {
  /* fluid height: 380 px on 320-wide screens → 720 px on 1440-wide */
  ["--ph" as string]: "clamp(380px, 48vh, 720px)",
  /* derived width from 9:19.5 aspect ratio */
  ["--pw" as string]: "calc(var(--ph) * 0.4615)",
  /* screen inset (border + bezel) */
  ["--pi" as string]: "calc(var(--ph) * 0.015)",
  /* border radius of the inner screen */
  ["--pr" as string]: "calc(var(--ph) * 0.065)",
};

/** Convenience: w × h for the outer phone shell */
const phoneShellSize = {
  w: "var(--pw)",
  h: "var(--ph)",
} as const;

/** Screen area sits inside the shell with insets on all sides */
const screenInset = {
  top:    "var(--pi)",
  bottom: "var(--pi)",
  left:   "var(--pi)",
  right:  "var(--pi)",
  borderRadius: "var(--pr)",
} as const;

const BRAND       = "#0057b8";
const BRAND_LIGHT = "#4a8fe0";

/* ═════════════════════════════════════════════════════════════════
   PHONE SCREEN COMPONENTS
   All sizes expressed as calc(var(--ph) * N) fractions so they
   scale proportionally with the phone container.
   ═════════════════════════════════════════════════════════════════ */

/* ── Mini area-chart ── */
function MiniChart({ up, heightFrac = 0.155 }: { up: boolean; heightFrac?: number }) {
  const stroke = up ? "#22c55e" : "#ef4444";
  const id = up ? "mc-up" : "mc-dn";
  return (
    <Box h={`calc(var(--ph) * ${heightFrac})`} position="relative">
      <svg viewBox="0 0 240 100" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
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

/* ─────────────────── LOCK SCREEN ─────────────────── */
const LOCK_SLIDE_PX = -2000;

const LockScreen = memo(function LockScreen({
  unlockProgress,
}: {
  unlockProgress: MotionValue<number>;
}) {
  const slideY      = useTransform(unlockProgress, [0, 1], [0, LOCK_SLIDE_PX]);
  const fadeNotif   = useTransform(unlockProgress, [0, 0.4], [1, 0]);
  const lockOpacity = useTransform(unlockProgress, [0, 0.5, 0.6], [1, 1, 0]);
  const lockPointerEvents = useTransform(unlockProgress, (v: number) =>
    v >= 0.6 ? "none" : "auto"
  );

  /* All text/icon sizes are fractions of --ph so they scale with the frame */
  const s = {
    timeFont:   "calc(var(--ph) * 0.125)",   // ~63px @ 500ph
    dateFontSz: "calc(var(--ph) * 0.026)",   // ~13px
    notifFont:  "calc(var(--ph) * 0.022)",   // ~11px
    statusFont: "calc(var(--ph) * 0.016)",   // ~8px
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
    topPad:     "calc(var(--ph) * 0.06)",
    timePad:    "calc(var(--ph) * 0.12)",
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
      <Box
        position="absolute" inset={0}
        bg="linear-gradient(180deg, #030818 0%, #071240 35%, #0a1f6e 65%, #050d30 100%)"
      />

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
              <Box key={i} w={s.barW} h={h} bg="white" borderRadius="1px" opacity={i < 3 ? 1 : 0.35} />
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

      {/* Dynamic Island */}
      <Box
        position="absolute"
        top={s.topPad}
        left="50%" transform="translateX(-50%)"
        w={s.islandW} h={s.islandH}
        bg="black" borderRadius="full" zIndex={3}
      />

      {/* Time */}
      <motion.div style={{
        opacity: fadeNotif,
        position: "absolute", top: s.timePad, left: 0, right: 0,
        textAlign: "center", zIndex: 2,
      }}>
        <Box>
          <Icon as={FiLock} color="rgba(255,255,255,0.7)"
            style={{ width: s.dateFontSz, height: s.dateFontSz, marginBottom: "calc(var(--ph)*0.01)" }} />
        </Box>
        <Text
          style={{ fontSize: s.timeFont }}
          fontWeight="200" color="white"
          letterSpacing="-0.04em" lineHeight={1}
        >
          11:44
        </Text>
        <Text style={{ fontSize: s.dateFontSz }} color="rgba(255,255,255,0.85)" fontWeight="500" mt={1} letterSpacing="0.01em">
          Sunday, April 27
        </Text>
      </motion.div>

      {/* Notification */}
      <motion.div style={{
        opacity: fadeNotif,
        position: "absolute", top: s.notifTop,
        left: s.notifSide, right: s.notifSide, zIndex: 2,
      }}>
        <Box
          bg="rgba(255,255,255,0.10)" borderRadius={s.avatarR}
          p={s.notifPad}
          style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          border="1px solid rgba(255,255,255,0.08)"
        >
          <HStack spacing={s.notifGap}>
            <Flex
              style={{ width: s.avatarSz, height: s.avatarSz, borderRadius: s.avatarR, flexShrink: 0 }}
              bg="linear-gradient(135deg, #0057b8, #4a6ba5)"
              align="center" justify="center"
            >
              <Text style={{ fontSize: `calc(var(--ph) * 0.025)` }}>💸</Text>
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <HStack justify="space-between" w="100%">
                <Text style={{ fontSize: s.statusFont }} color="rgba(255,255,255,0.7)" fontWeight="700" letterSpacing="0.04em" textTransform="uppercase">
                  promrkts
                </Text>
                <Text style={{ fontSize: s.statusFont }} color="rgba(255,255,255,0.5)">1m ago</Text>
              </HStack>
              <Text style={{ fontSize: s.notifFont }} color="white" fontWeight="600">
                @rayofsunshine sent you +$1,144.28
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
          <Text style={{ fontSize: s.statusFont }} color="rgba(255,255,255,0.55)" fontWeight="500">
            Swipe up to unlock
          </Text>
          <Box w={s.swipeW} h={s.swipeH} bg="rgba(255,255,255,0.35)" borderRadius="full" />
        </VStack>
      </motion.div>
    </motion.div>
  );
});

/* ─────────────────── DASHBOARD SCREEN ─────────────────── */
const ScreenDashboard = memo(function ScreenDashboard() {
  /* All sizes expressed as clamp-driven fractions of --ph / --pw */
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
    btn:      "calc(var(--ph) * 0.021)",
    iconW:    "calc(var(--ph) * 0.064)",  /* asset icon size */
    avatarW:  "calc(var(--ph) * 0.055)",
    settingW: "calc(var(--ph) * 0.052)",
    actionH:  "calc(var(--ph) * 0.067)",
    statusH:  "calc(var(--ph) * 0.075)",
    px:       "calc(var(--pw) * 0.09)",
  };

  const assets = [
    {
      name: "promrkts Balance", sub: null, val: "$41,120.00",
      icon: (
        <Flex
          style={{ width: fs.iconW, height: fs.iconW, borderRadius: "50%", flexShrink: 0 }}
          bg="#1a1a1a" border="1.5px solid rgba(255,255,255,0.12)"
          align="center" justify="center"
        >
          <Flex
            style={{ width: `calc(var(--ph)*0.037)`, height: `calc(var(--ph)*0.037)`, borderRadius: "50%" }}
            bg="white" align="center" justify="center"
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.018)` }} fontWeight="900" color="black">$</Text>
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
            bg="#2775ca" align="center" justify="center"
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.021)` }} fontWeight="900" color="white">$</Text>
          </Flex>
          <Flex
            position="absolute" bottom="-1px" right="-1px"
            style={{ width: `calc(var(--ph)*0.03)`, height: `calc(var(--ph)*0.03)`, borderRadius: "50%" }}
            bg="#9945ff" align="center" justify="center"
            border="calc(var(--ph)*0.002) solid #050810"
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.012)` }} fontWeight="900" color="white">◎</Text>
          </Flex>
        </Box>
      ),
    },
    {
      name: "Bitcoin", sub: null, val: "$114,200.20",
      icon: (
        <Flex
          style={{ width: fs.iconW, height: fs.iconW, borderRadius: "50%", flexShrink: 0 }}
          bg="#f7931a" align="center" justify="center"
        >
          <Text style={{ fontSize: `calc(var(--ph)*0.026)` }} fontWeight="900" color="white">₿</Text>
        </Flex>
      ),
    },
    {
      name: "Ethereum", sub: null, val: "$4,111.02",
      icon: (
        <Flex
          style={{ width: fs.iconW, height: fs.iconW, borderRadius: "50%", flexShrink: 0 }}
          bg="#627eea" align="center" justify="center"
        >
          <Text style={{ fontSize: `calc(var(--ph)*0.024)` }} fontWeight="700" color="white">Ξ</Text>
        </Flex>
      ),
    },
  ];

  return (
    <VStack h="100%" w="100%" align="stretch" spacing={0} bg="#0a0a0a" overflow="hidden">
      <Box style={{ height: fs.statusH }} />

      {/* Header */}
      <HStack px={fs.px} pb={`calc(var(--ph)*0.022)`} justify="space-between" align="center">
        <HStack spacing={`calc(var(--pw)*0.04)`}>
          <Box
            style={{ width: fs.avatarW, height: fs.avatarW, borderRadius: "50%", flexShrink: 0 }}
            bg="linear-gradient(135deg, #667eea, #764ba2)" overflow="hidden"
          >
            <Flex w="100%" h="100%" align="center" justify="center">
              <Text style={{ fontSize: `calc(var(--ph)*0.022)` }}>🧑‍💻</Text>
            </Flex>
          </Box>
          <Text style={{ fontSize: fs.handle }} color="white" fontWeight="700" letterSpacing="-0.01em">
            @rayofsunshine
          </Text>
        </HStack>
        <Flex
          style={{ width: fs.settingW, height: fs.settingW, borderRadius: "50%" }}
          bg="rgba(255,255,255,0.07)" align="center" justify="center"
        >
          <Icon as={FiSettings} color="rgba(255,255,255,0.7)"
            style={{ width: `calc(var(--ph)*0.022)`, height: `calc(var(--ph)*0.022)` }} />
        </Flex>
      </HStack>

      {/* Balance */}
      <VStack align="start" spacing={`calc(var(--ph)*0.008)`} px={fs.px} pb={`calc(var(--ph)*0.022)`}>
        <HStack spacing={`calc(var(--pw)*0.025)`}>
          <Text style={{ fontSize: fs.label }} color="rgba(255,255,255,0.45)" fontWeight="500">
            Total value
          </Text>
        </HStack>
        <Text
          style={{ fontSize: fs.balance }}
          color="white" fontWeight="700"
          letterSpacing="-0.04em" lineHeight={1}
          fontFamily="'DM Sans', sans-serif"
        >
          $41,120.02
        </Text>
        <HStack spacing={`calc(var(--pw)*0.03)`}>
          <Text style={{ fontSize: fs.delta }} color="#22c55e" fontWeight="600">+$1,244.02</Text>
          <HStack
            spacing={`calc(var(--pw)*0.015)`}
            bg="rgba(34,197,94,0.15)"
            px={`calc(var(--pw)*0.03)`} py={`calc(var(--ph)*0.004)`}
            borderRadius={`calc(var(--ph)*0.01)`}
          >
            <Text style={{ fontSize: `calc(var(--ph)*0.016)` }} color="#22c55e">▲</Text>
            <Text style={{ fontSize: `calc(var(--ph)*0.018)` }} color="#22c55e" fontWeight="700">3.12%</Text>
          </HStack>
        </HStack>
      </VStack>

      {/* Action buttons */}
      <HStack px={fs.px} pb={`calc(var(--ph)*0.022)`} spacing={`calc(var(--pw)*0.03)`}>
        {[
          { label: "Buy",     icon: null, pre: "+" },
          { label: "Deposit", icon: FiArrowDownLeft },
        ].map((a) => (
          <HStack
            key={a.label}
            flex={1} justify="center"
            spacing={`calc(var(--pw)*0.025)`}
            style={{ height: fs.actionH }}
            bg="rgba(255,255,255,0.10)" borderRadius="full"
            border="1px solid rgba(255,255,255,0.08)"
          >
            {a.pre && <Text style={{ fontSize: `calc(var(--ph)*0.026)` }} color="white" fontWeight="300">{a.pre}</Text>}
            {a.icon && <Icon as={a.icon} color="white" style={{ width: `calc(var(--ph)*0.022)`, height: `calc(var(--ph)*0.022)` }} />}
            <Text style={{ fontSize: fs.btn }} color="white" fontWeight="700">{a.label}</Text>
          </HStack>
        ))}
        <Flex
          style={{ width: fs.actionH, height: fs.actionH, flexShrink: 0 }}
          bg="rgba(255,255,255,0.10)" borderRadius="full"
          align="center" justify="center"
          border="1px solid rgba(255,255,255,0.08)"
        >
          <Text style={{ fontSize: `calc(var(--ph)*0.026)` }} color="white">···</Text>
        </Flex>
      </HStack>

      {/* Tabs */}
      <HStack px={fs.px} pb={`calc(var(--ph)*0.015)`} spacing={`calc(var(--pw)*0.07)`}>
        {["Assets", "Wallets"].map((tab, i) => (
          <VStack key={tab} spacing={`calc(var(--ph)*0.005)`}>
            <Text style={{ fontSize: fs.tab }} color={i === 0 ? "white" : "rgba(255,255,255,0.35)"} fontWeight={i === 0 ? 700 : 600}>
              {tab}
            </Text>
            <Box w="100%" h={`calc(var(--ph)*0.003)`} bg={i === 0 ? "white" : "transparent"} borderRadius="full" />
          </VStack>
        ))}
      </HStack>
      <Box h={`calc(var(--ph)*0.001)`} bg="rgba(255,255,255,0.07)" />

      {/* Asset list */}
      <VStack align="stretch" spacing={0} flex={1} overflowY="hidden">
        {assets.map((a) => (
          <HStack
            key={a.name} px={fs.px} py={`calc(var(--ph)*0.017)`}
            spacing={`calc(var(--pw)*0.05)`}
            borderBottom="1px solid rgba(255,255,255,0.05)"
          >
            {a.icon}
            <VStack align="start" spacing={0} flex={1}>
              <Text style={{ fontSize: fs.asset }} color="white" fontWeight="600">{a.name}</Text>
              {a.sub && <Text style={{ fontSize: fs.assetSub }} color="rgba(255,255,255,0.38)">{a.sub}</Text>}
            </VStack>
            <Text style={{ fontSize: fs.val }} color="white" fontWeight="600" fontFamily="monospace">
              {a.val}
            </Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
});

/* ─────────────────── P2P SCREEN ─────────────────── */
function ScreenP2P() {
  const { t } = useTranslate();
  const fs = {
    title:  "calc(var(--ph) * 0.022)",
    label:  "calc(var(--ph) * 0.018)",
    micro:  "calc(var(--ph) * 0.014)",
    val:    "calc(var(--ph) * 0.016)",
    px:     "calc(var(--pw) * 0.09)",
    gap:    "calc(var(--ph) * 0.012)",
    rowH:   "calc(var(--ph) * 0.04)",
    avatar: "calc(var(--ph) * 0.042)",
    avatarR:"calc(var(--ph) * 0.008)",
    btn:    "calc(var(--ph) * 0.014)",
    btnH:   "calc(var(--ph) * 0.036)",
    statusH:"calc(var(--ph) * 0.08)",
    cardR:  "calc(var(--ph) * 0.018)",
  };

  const offers = [
    { name: "Rayan Z.",  rate: "67,240.50", lim: "100 – 50,000", orders: 1144, cur: "BTC/USDT" },
    { name: "Rahma A.",  rate: "3.67",      lim: "114.20 – 41,120", orders: 411, cur: "USDT/AED" },
    { name: "Noran G.",  rate: "3.75",      lim: "41.12 – 11,420", orders: 1120, cur: "USDT/SAR" },
  ];

  return (
    <VStack h="100%" w="100%" px={fs.px} align="stretch" spacing={fs.gap} bg="#000">
      <Box style={{ height: fs.statusH }} />
      <Text style={{ fontSize: fs.title }} color="white" fontWeight="800" textAlign="center">
        P2P Market
      </Text>
      <HStack bg="rgba(255,255,255,0.04)" borderRadius={fs.avatarR} p={`calc(var(--ph)*0.005)`}>
        <Box flex={1} bg="#22c55e" borderRadius={fs.avatarR} textAlign="center" py={`calc(var(--ph)*0.012)`}>
          <Text style={{ fontSize: fs.label }} color="white" fontWeight="800">Buy</Text>
        </Box>
        <Box flex={1} textAlign="center" py={`calc(var(--ph)*0.012)`}>
          <Text style={{ fontSize: fs.label }} color="rgba(255,255,255,0.5)" fontWeight="700">Sell</Text>
        </Box>
      </HStack>

      <Text style={{ fontSize: `calc(var(--ph)*0.014)` }} color="rgba(255,255,255,0.4)" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase">
        Global offers
      </Text>

      <VStack align="stretch" spacing={fs.gap} flex={1}>
        {offers.map((o) => (
          <Box key={o.name}
            bg="rgba(255,255,255,0.03)" p={`calc(var(--ph)*0.016)`}
            borderRadius={fs.cardR} border="1px solid rgba(255,255,255,0.06)"
          >
            <HStack mb={`calc(var(--ph)*0.008)`}>
              <Flex
                style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%", flexShrink: 0 }}
                bg="rgba(0,87,184,0.3)" align="center" justify="center"
              >
                <Text style={{ fontSize: `calc(var(--ph)*0.018)` }}>🌐</Text>
              </Flex>
              <VStack align="start" spacing={0} flex={1}>
                <Text style={{ fontSize: fs.label }} color="white" fontWeight="700">{o.name}</Text>
                <Text style={{ fontSize: fs.micro }} color="rgba(255,255,255,0.4)">{o.orders} · ⭐ 4.9 · {o.cur}</Text>
              </VStack>
              <Box
                as="button"
                style={{ height: fs.btnH, fontSize: fs.btn }}
                bg={BRAND} color="white"
                px={`calc(var(--pw)*0.06)`}
                borderRadius={`calc(var(--ph)*0.012)`}
                fontWeight="800"
              >
                Buy
              </Box>
            </HStack>
            <HStack spacing={`calc(var(--pw)*0.08)`}>
              <Text style={{ fontSize: fs.val }} color="white" fontWeight="700" fontFamily="monospace">{o.rate}</Text>
              <Text style={{ fontSize: fs.micro }} color="rgba(255,255,255,0.4)">{o.lim}</Text>
            </HStack>
          </Box>
        ))}
      </VStack>
    </VStack>
  );
}

/* ─────────────────── SOCIAL WALLET SCREEN ─────────────────── */
function ScreenSocialWallet() {
  const { t } = useTranslate();
  const fs = {
    title:   "calc(var(--ph) * 0.022)",
    name:    "calc(var(--ph) * 0.021)",
    sub:     "calc(var(--ph) * 0.014)",
    val:     "calc(var(--ph) * 0.018)",
    micro:   "calc(var(--ph) * 0.014)",
    btn:     "calc(var(--ph) * 0.019)",
    px:      "calc(var(--pw) * 0.09)",
    gap:     "calc(var(--ph) * 0.012)",
    avatar:  "calc(var(--ph) * 0.055)",
    avatarR: "calc(var(--ph) * 0.01)",
    cardR:   "calc(var(--ph) * 0.026)",
    btnH:    "calc(var(--ph) * 0.055)",
    statusH: "calc(var(--ph) * 0.08)",
  };

  const payments = [
    { n: "@rayofsunshine", loc: "Tripoli · 11:44", amt: "+11.44", ini: "R", grad: "linear-gradient(135deg, #facc15, #f59e0b)" },
    { n: "@moe.ali",       loc: "Cairo · 1:11",    amt: "-41.12", ini: "N", grad: "linear-gradient(135deg, #06b6d4, #0369a1)" },
    { n: "@modi",          loc: "London · 4:44",   amt: "+114.20",ini: "L", grad: "linear-gradient(135deg, #ec4899, #be185d)" },
  ];

  return (
    <VStack h="100%" w="100%" px={fs.px} align="stretch" spacing={fs.gap} bg="#000">
      <Box style={{ height: fs.statusH }} />
      <Text style={{ fontSize: fs.title }} color="white" fontWeight="800" textAlign="center">
        Social Wallet
      </Text>

      {/* Handle card */}
      <Box
        bg="linear-gradient(135deg, rgba(18,75,180,0.9) 0%, rgba(58,153,237,0.28) 100%)"
        border="1px solid rgba(255,255,255,0.08)"
        borderRadius={fs.cardR} p={`calc(var(--ph)*0.022)`}
      >
        <HStack mb={`calc(var(--ph)*0.008)`} spacing={`calc(var(--pw)*0.04)`}>
          <Flex
            style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%", flexShrink: 0 }}
            bg={BRAND} align="center" justify="center"
          >
            <Icon as={FiAtSign} color="white" style={{ width: `calc(var(--ph)*0.024)`, height: `calc(var(--ph)*0.024)` }} />
          </Flex>
          <VStack align="start" spacing={0}>
            <Text style={{ fontSize: fs.name }} color="white" fontWeight="800">@rayofsunshine</Text>
            <Text style={{ fontSize: fs.micro }} color="rgba(255,255,255,0.55)">Rayan Z. · Your handle</Text>
          </VStack>
        </HStack>
        <Text style={{ fontSize: fs.micro }} color="rgba(255,255,255,0.55)">
          Send money to anyone with just an @handle
        </Text>
      </Box>

      <Text style={{ fontSize: `calc(var(--ph)*0.014)` }} color="rgba(255,255,255,0.45)" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase">
        Recent
      </Text>

      <VStack align="stretch" spacing={`calc(var(--ph)*0.01)`} flex={1}>
        {payments.map((p) => (
          <HStack
            key={p.n}
            bg="rgba(255,255,255,0.03)" p={`calc(var(--ph)*0.014)`}
            borderRadius={fs.avatarR} border="1px solid rgba(255,255,255,0.05)"
            spacing={`calc(var(--pw)*0.04)`}
          >
            <Flex
              style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%", flexShrink: 0 }}
              bg={p.grad} align="center" justify="center"
            >
              <Text style={{ fontSize: `calc(var(--ph)*0.018)` }} color="white" fontWeight="800">{p.ini}</Text>
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <Text style={{ fontSize: fs.sub }} color="white" fontWeight="700">{p.n}</Text>
              <Text style={{ fontSize: fs.micro }} color="rgba(255,255,255,0.4)">{p.loc}</Text>
            </VStack>
            <Text
              style={{ fontSize: fs.val }}
              color={p.amt.startsWith("+") ? "#22c55e" : "rgba(255,255,255,0.75)"}
              fontWeight="800" fontFamily="monospace"
            >
              {p.amt}
            </Text>
          </HStack>
        ))}
      </VStack>

      <HStack spacing={`calc(var(--pw)*0.04)`}>
        {[
          { icon: FiSend, label: "Send" },
          { icon: FiArrowDownLeft, label: "Request" },
        ].map((b) => (
          <HStack
            key={b.label} flex={1} justify="center"
            style={{ height: fs.btnH }}
            bg={b.label === "Send" ? BRAND : "rgba(255,255,255,0.08)"}
            border={b.label === "Send" ? "none" : "1px solid rgba(255,255,255,0.1)"}
            borderRadius={`calc(var(--ph)*0.018)`}
            spacing={`calc(var(--pw)*0.03)`}
          >
            <Icon as={b.icon} color="white" style={{ width: `calc(var(--ph)*0.02)`, height: `calc(var(--ph)*0.02)` }} />
            <Text style={{ fontSize: fs.btn }} color="white" fontWeight="800">{b.label}</Text>
          </HStack>
        ))}
      </HStack>
    </VStack>
  );
}

/* ─────────────────── VISA CARD SCREEN ─────────────────── */
function ScreenCard() {
  const { t } = useTranslate();
  const fs = {
    title:   "calc(var(--ph) * 0.022)",
    pan:     "calc(var(--ph) * 0.024)",
    label:   "calc(var(--ph) * 0.012)",
    holder:  "calc(var(--ph) * 0.016)",
    stat:    "calc(var(--ph) * 0.014)",
    statVal: "calc(var(--ph) * 0.019)",
    txName:  "calc(var(--ph) * 0.018)",
    txSub:   "calc(var(--ph) * 0.015)",
    txVal:   "calc(var(--ph) * 0.018)",
    btn:     "calc(var(--ph) * 0.018)",
    btnH:    "calc(var(--ph) * 0.052)",
    visa:    "calc(var(--ph) * 0.026)",
    chipW:   "calc(var(--pw) * 0.11)",
    chipH:   "calc(var(--ph) * 0.035)",
    avatar:  "calc(var(--ph) * 0.042)",
    avatarR: "calc(var(--ph) * 0.01)",
    px:      "calc(var(--pw) * 0.09)",
    gap:     "calc(var(--ph) * 0.012)",
    statusH: "calc(var(--ph) * 0.06)",
    cardR:   "calc(var(--ph) * 0.028)",
  };

  const txns = [
    { n: "Apple Store", c: "Dubai · AED",   amt: "-114.20" },
    { n: "Carrefour",   c: "Riyadh · SAR",  amt: "-41.12" },
    { n: "Uber",        c: "Cairo · EGP",   amt: "-11.44" },
  ];

  return (
    <VStack h="100%" w="100%" px={fs.px} align="stretch" spacing={fs.gap} bg="#000">
      <Box style={{ height: fs.statusH }} />
      <Text style={{ fontSize: fs.title }} color="white" fontWeight="800" textAlign="center">
        My Card
      </Text>

      {/* Card face */}
      <Box
        position="relative" borderRadius={fs.cardR} overflow="hidden"
        boxShadow="0 calc(var(--ph)*0.025) calc(var(--ph)*0.06) rgba(0,87,184,0.45)"
        bg="linear-gradient(135deg, #0057b8 0%, #001a3d 55%, #050914 100%)"
        style={{ aspectRatio: "1.586 / 1" }}
      >
        <Box position="absolute" top="-40%" right="-15%" w="200%" h="200%"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(74,143,224,0.55) 0%, rgba(74,143,224,0) 65%)"
          filter="blur(30px)"
        />
        <Box position="absolute" inset={0} p={`calc(var(--pw)*0.07)`}
          display="flex" flexDirection="column" justifyContent="space-between"
        >
          <HStack justify="space-between" align="center">
            <NextImage src="/logo-white.png" width={35} height={25} alt="logo" />
            <Icon as={FiWifi} color="white"
              style={{ width: `calc(var(--ph)*0.022)`, height: `calc(var(--ph)*0.022)`, transform: "rotate(90deg)" }}
              opacity={0.9}
            />
          </HStack>
          <HStack justify="space-between" align="center">
            {/* EMV chip */}
            <Box
              style={{ width: fs.chipW, height: fs.chipH }}
              borderRadius={`calc(var(--ph)*0.006)`}
              bg="linear-gradient(135deg, #e8d48a 0%, #b48a35 50%, #f5e3a2 100%)"
              boxShadow="inset 0 0 0 0.5px rgba(0,0,0,0.25)"
            />
            <HStack spacing={`calc(var(--pw)*0.02)`}>
              <Box w={`calc(var(--pw)*0.025)`} h={`calc(var(--pw)*0.025)`} borderRadius="full" bg="#8ab4f8" />
              <Text style={{ fontSize: fs.label }} color="rgba(255,255,255,0.75)" fontWeight="700" letterSpacing="0.1em">MASTER</Text>
            </HStack>
          </HStack>
          <Text style={{ fontSize: fs.pan }} color="white" fontFamily="monospace" letterSpacing="0.18em" fontWeight="700">
            1144 4411 1142 1144
          </Text>
          <HStack justify="space-between" align="flex-end">
            <HStack spacing={`calc(var(--pw)*0.08)`}>
              {[{ l: "CARD HOLDER", v: "RAYAN Z." }, { l: "EXPIRES", v: "11/44" }].map((d) => (
                <VStack key={d.l} align="start" spacing={0}>
                  <Text style={{ fontSize: fs.label }} color="rgba(255,255,255,0.7)" letterSpacing="0.1em">{d.l}</Text>
                  <Text style={{ fontSize: fs.holder }} color="white" fontWeight="700">{d.v}</Text>
                </VStack>
              ))}
            </HStack>
            <Text style={{ fontSize: fs.visa }} color="white" fontWeight="900" fontStyle="italic">VISA</Text>
          </HStack>
        </Box>
      </Box>

      {/* Tier pills */}
      <HStack spacing={`calc(var(--pw)*0.03)`} justify="center">
        {[{ c: "#8ab4f8", label: "Starter" }, { c: "#0057b8", label: "Master" }, { c: "#0a0f1e", label: "Pro" }].map((t2, i) => (
          <HStack
            key={t2.label}
            bg={i === 1 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"}
            border="1px solid" borderColor={i === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}
            borderRadius="full"
            px={`calc(var(--pw)*0.05)`} py={`calc(var(--ph)*0.008)`}
            spacing={`calc(var(--pw)*0.025)`}
          >
            <Box w={`calc(var(--ph)*0.016)`} h={`calc(var(--ph)*0.016)`} borderRadius="full" bg={t2.c} boxShadow={`0 0 6px ${t2.c}aa`} />
            <Text style={{ fontSize: fs.label }} color="white" fontWeight="700">{t2.label}</Text>
          </HStack>
        ))}
      </HStack>

      {/* Stats */}
      <SimpleGrid columns={3} spacing={`calc(var(--pw)*0.03)`}>
        {[{ l: "Spent", v: "$4,111.02" }, { l: "Limit", v: "$41,120" }, { l: "Cashback", v: "$114.02" }].map((s) => (
          <VStack key={s.l} bg="rgba(255,255,255,0.03)" p={`calc(var(--ph)*0.012)`}
            borderRadius={`calc(var(--ph)*0.015)`} spacing={0}
            border="1px solid rgba(255,255,255,0.05)"
          >
            <Text style={{ fontSize: fs.stat }} color="rgba(255,255,255,0.5)" letterSpacing="0.08em" textTransform="uppercase">{s.l}</Text>
            <Text style={{ fontSize: fs.statVal }} color="white" fontWeight="800" fontFamily="monospace">{s.v}</Text>
          </VStack>
        ))}
      </SimpleGrid>

      {/* Txns */}
      <VStack align="stretch" spacing={`calc(var(--ph)*0.008)`} flex={1}>
        {txns.map((s) => (
          <HStack key={s.n}
            bg="rgba(255,255,255,0.03)" p={`calc(var(--ph)*0.012)`}
            borderRadius={`calc(var(--ph)*0.014)`}
            border="1px solid rgba(255,255,255,0.05)"
            spacing={`calc(var(--pw)*0.04)`}
          >
            <Flex
              style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%", flexShrink: 0 }}
              bg="rgba(255,255,255,0.06)" align="center" justify="center"
            >
              <Icon as={FiCreditCard} color="white" style={{ width: `calc(var(--ph)*0.018)`, height: `calc(var(--ph)*0.018)` }} />
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <Text style={{ fontSize: fs.txName }} color="white" fontWeight="700">{s.n}</Text>
              <Text style={{ fontSize: fs.txSub }} color="rgba(255,255,255,0.4)">{s.c}</Text>
            </VStack>
            <Text style={{ fontSize: fs.txVal }} color="rgba(255,255,255,0.8)" fontWeight="800" fontFamily="monospace">{s.amt}</Text>
          </HStack>
        ))}
      </VStack>

      <HStack
        justify="center" style={{ height: fs.btnH }}
        bg="rgba(255,255,255,0.06)"
        border="1px solid rgba(255,255,255,0.08)"
        borderRadius={`calc(var(--ph)*0.015)`}
        cursor="pointer"
      >
        <Text style={{ fontSize: fs.btn }} color="white" fontWeight="700">❄ Freeze Card</Text>
      </HStack>
    </VStack>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PHONE FRAME
   Width = var(--pw), Height = var(--ph) — both driven by --ph clamp
   ═════════════════════════════════════════════════════════════════ */

const PhoneFrame = memo(function PhoneFrame({
  unlockProgress,
}: {
  unlockProgress: MotionValue<number>;
}) {
  return (
    /* phoneVars injects --ph / --pw / --pi / --pr onto this element
       and all descendants can reference them. */
    <Box
      position="relative"
      style={{ ...phoneVars, width: "var(--pw)", height: "var(--ph)" } as React.CSSProperties}
      mx="auto"
    >
      {/* Screen area */}
      <Box
        position="absolute"
        style={screenInset as React.CSSProperties}
        overflow="hidden"
        bg="#000"
        boxShadow="0 calc(var(--ph)*0.05) calc(var(--ph)*0.14) rgba(0,87,184,0.4)"
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
  /* optional override: pass a CSS value e.g. "clamp(320px,40vh,600px)"
     to use a different phone height for a particular section */
  phOverride,
}: {
  children: React.ReactNode;
  phOverride?: string;
}) {
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
        bg="#000"
        boxShadow="0 calc(var(--ph)*0.05) calc(var(--ph)*0.14) rgba(0,87,184,0.4)"
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
   SEND SCREEN (social payments section)
   ═════════════════════════════════════════════════════════════════ */
function PhoneSendScreen() {
  const { t } = useTranslate();
  const fs = {
    title:  "calc(var(--ph) * 0.022)",
    label:  "calc(var(--ph) * 0.016)",
    amount: "calc(var(--ph) * 0.09)",
    cur:    "calc(var(--ph) * 0.018)",
    num:    "calc(var(--ph) * 0.032)",
    btn:    "calc(var(--ph) * 0.019)",
    btnH:   "calc(var(--ph) * 0.055)",
    avatar: "calc(var(--ph) * 0.06)",
    check:  "calc(var(--ph) * 0.022)",
    name:   "calc(var(--ph) * 0.021)",
    px:     "calc(var(--pw) * 0.09)",
    statusH:"calc(var(--ph) * 0.08)",
    gap:    "calc(var(--ph) * 0.016)",
  };

  const nums = ["1","2","3","4","5","6","7","8","9",".","0","⌫"];

  return (
    <VStack h="100%" w="100%" align="stretch" px={fs.px} spacing={fs.gap} bg="#000">
      <Box style={{ height: fs.statusH }} />
      <HStack>
        <Text style={{ fontSize: fs.label }} color="rgba(255,255,255,0.55)">←</Text>
        <Text style={{ fontSize: fs.title }} color="white" fontWeight="700" flex={1} textAlign="center">Send Money</Text>
      </HStack>

      {/* Recipient */}
      <HStack
        bg="rgba(255,255,255,0.05)" border="1px solid rgba(255,255,255,0.08)"
        borderRadius={`calc(var(--ph)*0.022)`} p={`calc(var(--ph)*0.018)`}
        spacing={`calc(var(--pw)*0.04)`}
      >
        <Flex
          style={{ width: fs.avatar, height: fs.avatar, borderRadius: "50%", flexShrink: 0 }}
          bg="linear-gradient(135deg, #facc15, #f59e0b)" align="center" justify="center"
        >
          <Text style={{ fontSize: `calc(var(--ph)*0.021)` }} color="white" fontWeight="800">R</Text>
        </Flex>
        <VStack align="start" spacing={0} flex={1}>
          <Text style={{ fontSize: `calc(var(--ph)*0.016)` }} color="rgba(255,255,255,0.5)" fontWeight="700" letterSpacing="0.1em">TO</Text>
          <Text style={{ fontSize: fs.name }} color="white" fontWeight="800">@rayofsunshine · Rayan Z.</Text>
        </VStack>
        <Icon as={FiCheck} color="#22c55e"
          style={{ width: fs.check, height: fs.check }} />
      </HStack>

      {/* Amount */}
      <VStack spacing={0} py={`calc(var(--ph)*0.016)`}>
        <HStack align="baseline" spacing={`calc(var(--pw)*0.025)`}>
          <Text style={{ fontSize: fs.cur }} color="rgba(255,255,255,0.5)" fontWeight="700" letterSpacing="0.12em">USDT</Text>
          <Text
            style={{ fontSize: fs.amount }}
            color="white" fontWeight="800"
            letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif"
          >
            11.44
          </Text>
        </HStack>
      </VStack>

      {/* Preview button */}
      <HStack
        justify="center" mx={`calc(var(--pw)*0.1)`}
        style={{ height: fs.btnH }}
        bg="white" borderRadius="full" cursor="pointer"
      >
        <Text style={{ fontSize: fs.btn }} color="black" fontWeight="800">Preview</Text>
      </HStack>

      {/* Numpad */}
      <SimpleGrid columns={3} spacing={`calc(var(--ph)*0.008)`} flex={1}>
        {nums.map((n) => (
          <Flex key={n} align="center" justify="center" style={{ height: `calc(var(--ph)*0.062)` }}>
            <Text
              style={{ fontSize: fs.num }}
              fontWeight="600"
              color={n === "⌫" ? "rgba(255,255,255,0.55)" : "white"}
              fontFamily="'DM Sans', sans-serif"
            >
              {n}
            </Text>
          </Flex>
        ))}
      </SimpleGrid>
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
      style={{ width: "100%", height: "100%", objectFit, opacity, filter: filter ?? (opacity < 1 ? "saturate(1.1) blur(0.5px)" : undefined) }}
    />
  );
}

/* ═════════════════════════════════════════════════════════════════
   LIVE TX FEED
   ═════════════════════════════════════════════════════════════════ */
const TX_POOL = [
  { name: "@noran.g",  icon: "🌙" }, { name: "@rahma.a", icon: "⚡" },
  { name: "@rayan.z",  icon: "💫" }, { name: "@sam.v",   icon: "💎" },
  { name: "@amira.h",  icon: "🔥" }, { name: "@omar.s",  icon: "🚀" },
  { name: "@kylie.m",  icon: "✨" }, { name: "@keiran",  icon: "🌐" },
];

function LiveTxFeed() {
  const [txns, setTxns] = useState([
    { id: 1, name: "@moe.ali",       amt: "+$1,114.20",  color: "#22c55e", icon: "⚡", ts: "just now" },
    { id: 2, name: "@rayofsunshine", amt: "+$40,141.28", color: "#22c55e", icon: "🌍", ts: "2s ago" },
    { id: 3, name: "@noran.g",       amt: "-$11.44",     color: "#ef4444", icon: "💸", ts: "5s ago" },
    { id: 4, name: "@rahma.a",       amt: "+$280.00",    color: "#22c55e", icon: "🌙", ts: "8s ago" },
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
        color: up ? "#22c55e" : "#ef4444", icon: p.icon, ts: "just now",
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
                  bg={i === 0 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)"}
                  border="1px solid"
                  borderColor={i === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}
                  borderRadius="14px" px={{ base: 3, lg: 4 }} py={{ base: 2.5, lg: 3 }} spacing={3}
                  boxShadow={i === 0 ? "0 8px 24px rgba(0,0,0,0.3)" : "none"}
                >
                  <Flex w={{ base: "30px", lg: "36px" }} h={{ base: "30px", lg: "36px" }}
                    borderRadius="full" bg="rgba(255,255,255,0.08)"
                    align="center" justify="center" flexShrink={0}
                    fontSize={{ base: "13px", lg: "16px" }}
                  >
                    {tx.icon}
                  </Flex>
                  <VStack align="start" spacing={0} flex={1} minW={0}>
                    <Text fontSize={{ base: "12px", lg: "13px" }} fontWeight="700" isTruncated w="100%">{tx.name}</Text>
                    <Text fontSize={{ base: "9px", lg: "10px" }} fontWeight="500" opacity={0.5}>{tx.ts}</Text>
                  </VStack>
                  <Text fontSize={{ base: "12px", lg: "14px" }} color={tx.color}
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
   SECTION COMPONENTS  (unchanged logic, but StaticPhone no longer
   needs a scale prop — sizing comes from --ph CSS var)
   ═════════════════════════════════════════════════════════════════ */

function SectionSocialFinance() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.7)" : "#64748b";
  const cardBg   = dark ? "rgba(20,28,48,0.95)" : "#ffffff";
  const cardBorder = dark ? "rgba(100,130,200,0.2)" : "rgba(0,87,184,0.15)";
  const chipBg   = dark ? "rgba(255,255,255,0.1)" : "rgba(0,87,184,0.06)";

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
              {/* Feature section uses a slightly smaller phone than the hero */}
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
                <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">{t("sec_social_title_1")}</Box>
                <br />
                <Box as="span" color={textMain}>{t("sec_social_title_2")}</Box>
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">{t("sec_social_desc")}</Text>
              <Box w="100%" maxW="460px" bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="24px" p={6} boxShadow={dark ? "0 20px 50px rgba(0,0,0,0.3)" : "0 20px 50px rgba(0,87,184,0.08)"}>
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
  const textSub  = dark ? "rgba(255,255,255,0.7)" : "#64748b";
  const tileBg   = dark ? "rgba(20,28,48,0.9)" : "#ffffff";
  const tileBorder = dark ? "rgba(100,130,200,0.2)" : "rgba(0,87,184,0.12)";

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
                <Text fontSize={{ base: "11px", md: "12px" }} fontWeight="900" color={BRAND_LIGHT} letterSpacing="0.16em" textTransform="uppercase">{eyebrow}</Text>
                {comingSoon && (
                  <Box px={2.5} py={0.5} borderRadius="full" bg="linear-gradient(135deg, #facc15, #f59e0b)" color="#0a0f1e" fontWeight="900" fontSize="10px" letterSpacing="0.05em" textTransform="uppercase" boxShadow="0 4px 14px rgba(250,204,21,0.4)">
                    {t("coming_soon")}
                  </Box>
                )}
              </HStack>
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "36px", md: "56px", xl: "72px" }} letterSpacing="-0.04em" lineHeight={1.05}>
                <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">{title}</Box>
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">{desc}</Text>
              {extraBelow ? (
                <Box w="100%" maxW="460px">{extraBelow}</Box>
              ) : features.length > 0 && (
                <SimpleGrid columns={2} spacing={3} w="100%" maxW="460px">
                  {features.map((f, i) => (
                    <motion.div key={f.label} initial={{ opacity: 0, y: 12, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.4, delay: 0.08 * i }}>
                      <HStack h="64px" bg={tileBg} border="1px solid" borderColor={tileBorder} borderRadius="16px" px={4} spacing={3} transition="all 0.2s ease" _hover={{ transform: "translateY(-3px)", borderColor: BRAND_LIGHT }}>
                        <Flex w="36px" h="36px" borderRadius="10px" border="1px solid rgba(0,87,184,0.25)" align="center" justify="center" flexShrink={0} bg={dark ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.05)"}>
                          <Icon as={f.icon} color={BRAND_LIGHT} />
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

/* ── Bento, OnRamp, SocialProof — unchanged, omitted for brevity ── */
function SectionBento() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg = dark ? "linear-gradient(145deg, rgba(20,25,40,0.9) 0%, rgba(10,15,30,0.95) 100%)" : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)";
  const cardBorder = dark ? "rgba(100,130,200,0.15)" : "rgba(0,87,184,0.12)";

  const stats = [
    { label: t("bento_stat_volume_label"), value: "$280,000,000", sub: t("bento_vs_last_month"), icon: FiActivity, span: 2, gradient: "linear-gradient(135deg, #0057b8 0%, #001a3d 100%)", color: "white" },
    { label: t("bento_countries_label"), value: "120+", sub: t("bento_countries_desc"), icon: FiGlobe, span: 1, accent: "#4a8fe0" },
    { label: t("bento_traders_label"), value: "35K", sub: "", icon: FiUsers, span: 1, accent: "#22c55e" },
    { label: t("bento_pairs_label"), value: "400+", sub: "", icon: FiBarChart2, span: 1, accent: "#f59e0b" },
    { label: t("bento_security_title"), value: "", sub: t("bento_security_desc"), icon: FiShield, span: 1, accent: "#a78bfa", bg: dark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.08)", border: "rgba(167,139,250,0.3)" },
    { label: t("bento_speed_title"), value: "<2s", sub: t("bento_speed_desc"), icon: FiZap, span: 1, accent: "#facc15" },
    { label: t("bento_rating_label"), value: "4.2/5", sub: "", icon: FiStar, span: 1, accent: "#f59e0b" },
  ];

  return (
    <Box py={{ base: 16, md: 32 }} px={{ base: 4, md: 10 }} position="relative" overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={1}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <VStack align="center" spacing={3} mb={{ base: 10, md: 16 }} textAlign="center">
            <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "32px", md: "56px", lg: "64px" }} letterSpacing="-0.04em" color={textMain} lineHeight={1.1}>
              {t("bento_title_1")}{" "}
              <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">{t("bento_title_2")}</Box>
            </Heading>
          </VStack>
        </motion.div>
        <SimpleGrid columns={{ base: 2, sm: 2, md: 4 }} gap={{ base: 3, md: 4 }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 30, scale: 0.95 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.25 }} transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} style={{ gridColumn: s.span && s.span > 1 ? `span ${s.span}` : undefined }}>
              <Box h="100%" minH={{ base: s.span && s.span > 1 ? "140px" : "110px", md: "auto" }} p={{ base: s.span && s.span > 1 ? 5 : 4, md: 7 }} borderRadius={{ base: "20px", md: "28px" }} bg={s.gradient || (s as any).bg || cardBg} border="1px solid" borderColor={(s as any).border || cardBorder} color={(s as any).color || textMain} position="relative" overflow="hidden" transition="all 0.3s ease" _hover={{ transform: "translateY(-4px)", boxShadow: s.gradient ? "0 24px 60px rgba(0,87,184,0.4)" : dark ? "0 20px 50px rgba(0,0,0,0.4)" : "0 20px 50px rgba(0,87,184,0.15)", borderColor: (s as any).border ? (s as any).border : dark ? "rgba(100,130,200,0.3)" : "rgba(0,87,184,0.25)" }}>
                {s.gradient && (<><Box position="absolute" top="-40%" right="-15%" w="300px" h="300px" borderRadius="full" bg="rgba(74,143,224,0.3)" filter="blur(70px)" pointerEvents="none" /><Box position="absolute" bottom="-30%" left="-15%" w="200px" h="200px" borderRadius="full" bg="rgba(34,197,94,0.15)" filter="blur(60px)" pointerEvents="none" /></>)}
                <VStack align="start" spacing={{ base: 2, md: 4 }} position="relative">
                  <Flex w={{ base: "36px", md: "44px" }} h={{ base: "36px", md: "44px" }} borderRadius="12px" bg={s.gradient ? "rgba(255,255,255,0.15)" : dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.08)"} align="center" justify="center">
                    <Icon as={s.icon} color={(s as any).accent || (s.gradient ? "white" : BRAND_LIGHT)} boxSize={{ base: 5, md: 6 }} />
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
  const cardBg = dark ? "rgba(0,0,0)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const methods: { label: string; icon?: React.ElementType; iconSize?: number; bg: string; color: string; border?: string; showLabel?: boolean }[] = [
    { label: "Apple Pay",  icon: FaApplePay,     iconSize: 36, bg: "#000", color: "#fff", border: "rgba(255,255,255,0.18)" },
    { label: "Google Pay", icon: FaGooglePay,    iconSize: 34, bg: "#fff", color: "#5f6368", border: "rgba(0,0,0,0.08)" },
    { label: "Visa",       icon: FaCcVisa,       iconSize: 30, bg: "#1a1f71", color: "#fff" },
    { label: "Mastercard", icon: FaCcMastercard, iconSize: 30, bg: "#0a0a0a", color: "#ff5f00", border: "rgba(255,255,255,0.12)" },
    { label: "Revolut",    icon: SiRevolut,      iconSize: 22, bg: "#0075eb", color: "#fff", showLabel: true },
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
                  <HStack spacing={2} px={{ base: 3, md: 4 }} h={{ base: "38px", md: "42px" }} borderRadius="full" bg={m.bg} color={m.color} border={m.border ? `1px solid ${m.border}` : "none"} boxShadow="0 4px 14px rgba(0,0,0,0.12)" transition="box-shadow 0.2s ease" _hover={{ boxShadow: "0 8px 22px rgba(0,0,0,0.2)" }}>
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
                <VStack bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius={{ base: "24px", md: "32px" }} overflow="hidden" align="stretch" spacing={0} transition="all 0.3s ease" _hover={{ transform: { md: "translateY(-6px)" }, boxShadow: dark ? "0 24px 60px rgba(0,0,0,0.4)" : "0 24px 60px rgba(0,87,184,0.12)" }}>
                  <Box display={{ base: "none", md: "block" }} position="relative" w="100%" style={{ aspectRatio: "4 / 3" }} overflow="hidden">
                    <LazyBackgroundVideo src={c.video} objectFit="cover" />
                  </Box>
                  <VStack p={{ base: 5, md: 7 }} align="center">
                    <Heading fontWeight="800" color={textMain} fontFamily="'DM Sans', sans-serif">{c.title}</Heading>
                    <Text color={textSub} lineHeight={1.5}>{c.desc}</Text>
                  </VStack>
                  <Box display={{ base: "block", md: "none" }} position="relative" w="100%" style={{ aspectRatio: "4 / 3" }} bg={dark ? "#0a0f1e" : "#f8f9fc"} overflow="hidden" borderTop="1px solid" borderColor={cardBorder}>
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
                <Box w={{ base: `${a.sizeBase}px`, md: `${a.sizeMd}px` }} h={{ base: `${a.sizeBase}px`, md: `${a.sizeMd}px` }} borderRadius="full" overflow="hidden" border="3px solid" borderColor={dark ? "rgba(255,255,255,0.18)" : "rgba(0,87,184,0.18)"} boxShadow="0 16px 40px rgba(0,0,0,0.45)" transition="transform 0.3s ease, border-color 0.3s ease" _hover={{ transform: "scale(1.08)", borderColor: dark ? "rgba(255,255,255,0.55)" : "#0057b8" }} position="relative" bg={dark ? "#0a0f1e" : "#f1f5f9"}>
                  <NextImage src={a.src} alt="" fill style={{ objectFit: "cover" }} sizes="120px" />
                </Box>
              </motion.div>
            </motion.div>
          ))}
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" zIndex={2} textAlign="center" pointerEvents="none" w={{ base: "78%", md: "auto" }}>
            <motion.div initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
              <Heading fontFamily="'DM Sans', sans-serif" fontWeight="900" fontSize={{ base: "56px", md: "104px", lg: "128px" }} letterSpacing="-0.04em" lineHeight={1} color={textMain} style={{ textShadow: dark ? "0 8px 40px rgba(0,87,184,0.55)" : "0 8px 40px rgba(0,87,184,0.25)" }}>
                <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">35,000+</Box>
              </Heading>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.25 }}>
              <Text mt={{ base: 3, md: 4 }} fontSize={{ base: "13px", md: "17px" }} color={dark ? "rgba(255,255,255,0.7)" : "#64748b"} fontWeight="600" letterSpacing="-0.01em" maxW={{ base: "260px", md: "420px" }} mx="auto">{t("socialproof_label")}</Text>
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
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: totalProgress } = useScroll({ target: scrollRef, offset: ["start start", "end end"] });

  const titleOpacity = useTransform(totalProgress, [0, 0.18, 0.08], [1, 1, 0]);
  const titleY       = useTransform(totalProgress, [0, 0.08], [0, -40]);
  const phoneOpacity = useTransform(totalProgress, [0, 0.05], [1, 1]);
  const phoneY       = useTransform(totalProgress, [0, 0.15], [0, 0]);

  const unlockProgress     = useMotionValue(0);
  const stageOverlayOpacity = useMotionValue(0);

  useEffect(() => {
    const compute = () => {
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrolledPast = Math.max(0, -rect.top);
      unlockProgress.set(Math.min(1, scrolledPast / 60));
      stageOverlayOpacity.set(Math.max(0, Math.min(1, (scrolledPast - 80) / 200)));
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => { window.removeEventListener("scroll", compute); window.removeEventListener("resize", compute); };
  }, [unlockProgress, stageOverlayOpacity]);

  useEffect(() => { fetchUser(); }, []);

  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 95%, rgba(255,255,255,0.4) 100%)"
    : "linear(to-b, #0057b8 0%, #bbbbbb 95%, rgba(10,15,30,0.35) 100%)";

  const stages: Stage[] = [{ eyebrow: t("feat_dashboard_eyebrow"), title: t("feat_dashboard_title"), desc: t("feat_dashboard_desc"), widget: null }];

  if (isLoading) return null;
  if (isAuthenticated) return (<><PublicNav /><AuthenticatedHome /></>);

  return (
    <Box minH="100vh" overflowX="clip" color={textMain}>
      <PublicNav />

      {/* ══ HERO ══ */}
      <Box ref={scrollRef} id="features" position="relative" h={{ base: "200vh", md: "300vh" }} className="snap-none">
        <Box position="sticky" top={0} h="100vh" overflow="hidden">

          {/* Title */}
          <motion.div style={{ opacity: titleOpacity, y: titleY, position: "absolute", top: -25, left: 0, right: 0, paddingTop: "120px", zIndex: 4, pointerEvents: "none" }}>
            <Container maxW="1200px" position="relative">
              <VStack spacing={1}>
                <Heading as="h1" fontFamily="'DM Sans', sans-serif" fontWeight="900"
                  fontSize={{ base: "38px", sm: "44px", md: "54px", xl: "62px" }}
                  letterSpacing="-0.05em" bgGradient={titleGradient} bgClip="text" color="transparent" whiteSpace="nowrap"
                >
                  {t("hero_line1")} {t("hero_line2")}
                </Heading>
              </VStack>
            </Container>
          </motion.div>

          {/* Phone — no scale() hack. The phone sizes itself via --ph clamp(). */}
          <Flex position="absolute" inset={0} align="center" justify="center" zIndex={2} pointerEvents="none">
            <motion.div style={{ opacity: phoneOpacity, y: phoneY, willChange: "opacity, transform" }}>
              <PhoneFrame unlockProgress={unlockProgress} />
            </motion.div>
          </Flex>

          {/* Stage overlay */}
          <motion.div style={{ opacity: stageOverlayOpacity, position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
            <StageOverlay stages={stages} />
          </motion.div>
        </Box>
      </Box>

      {/* ══ CONNECTED ══ */}
      <Box className="snap-section" id="connect" py={{ base: 16, md: 24 }} position="relative" minH="100vh" display="flex" alignItems="center">
        <Box position="absolute" inset={0} zIndex={0} pointerEvents="none" style={{ maskImage: "radial-gradient(ellipse at center, black 1%, transparent 60%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 15%, transparent 60%)" }}>
          <LazyBackgroundVideo src="/videos/WebHeader.mp4" opacity={0.95} />
          <Box position="absolute" inset={0} bg={dark ? "radial-gradient(ellipse at center, rgba(10,15,30,0) 0%, rgba(10,15,30,0.55) 70%, rgba(10,15,30,0.95) 100%)" : "radial-gradient(ellipse at center, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0.95) 100%)"} />
        </Box>
        <VStack position="relative" zIndex={20} spacing={8} maxW="720px" mx="auto" textAlign="center" px={6}>
          <Box p={6} borderColor={cardBorder}>
            <NextImage src="/icon-black.png" alt="Logo" width={60} height={60} />
          </Box>
          <Heading fontSize={{ base: "36px", md: "64px" }} fontWeight="800" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif" color={textMain}>
            {t("connect_title_1")}{" "}
            <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">{t("connect_title_2")}</Box>
          </Heading>
          <HStack spacing={3} flexWrap="wrap" justify="center" pt={2}>
            {[{ icon: FiZap, label: t("connect_pill_speed") }, { icon: FiGlobe, label: t("connect_pill_access") }, { icon: FiShield, label: t("connect_pill_security") }].map((p, i) => (
              <HStack key={i} bg={dark ? "rgba(0,0,0,0.4)" : "white"} border="1px solid" borderColor={cardBorder} px={4} py={2.5} borderRadius="full">
                <Icon as={p.icon} color={BRAND_LIGHT} boxSize={4} />
                <Text fontSize="13px" color={textMain} fontWeight="700">{p.label}</Text>
              </HStack>
            ))}
          </HStack>
        </VStack>
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
            <Box position="absolute" top="0" left="50%" w="1600px" h="1600px" borderRadius="full" border="1.5px solid rgba(0,87,184,0.4)" style={{ transform: "translate(-50%, 0)", clipPath: "inset(0 0 50% 0)", boxShadow: "0 0 40px rgba(0,87,184,0.35)" }} />
            <motion.div animate={{ opacity: [0.2, 0.95, 0.2] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} style={{ position: "absolute", top: "0", left: "50%", width: "1600px", height: "1600px", transform: "translate(-50%, 0)", border: "1.5px solid rgba(74,143,224,0.95)", borderRadius: "50%", clipPath: "inset(0 0 50% 0)", boxShadow: "0 0 90px rgba(0,87,184,0.85)", willChange: "opacity" }} />
          </Box>
        </Box>
        <Box className="snap-section" id="cta" position="relative" zIndex={1} py={{ base: 16, md: 28 }} px={{ base: 6, md: 12 }} minH="100vh" display="flex" alignItems="center" justifyContent="center">
          <Box maxW="1100px" mx="auto" borderRadius="40px" overflow="hidden" position="relative" bg="linear-gradient(135deg, #0057b8 0%, #001a3d 100%)" p={{ base: 10, md: 20 }} textAlign="center" boxShadow="0 40px 100px rgba(0,87,184,0.3)">
            <Box position="absolute" inset={0} opacity={0.08} backgroundImage="radial-gradient(circle at 2px 2px, white 2px, transparent 0)" backgroundSize="36px 36px" pointerEvents="none" />
            <VStack spacing={7} position="relative" zIndex={2}>
              <Heading fontSize={{ base: "36px", md: "64px" }} fontWeight="800" color="white" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif">{t("cta_title")}</Heading>
              <Text fontSize={{ base: "15px", md: "19px" }} color="rgba(255,255,255,0.85)" maxW="520px">{t("cta_sub")}</Text>
              <Button as={NextLink} href="/register" h="60px" px={12} bg="white" color={BRAND} borderRadius="18px" fontWeight="800" fontSize="15px" rightIcon={<Icon as={FiArrowRight} boxSize={5} />} _hover={{ transform: "scale(1.04)", boxShadow: "0 16px 40px rgba(255,255,255,0.25)" }} transition="all 0.2s">
                {t("cta_btn")}
              </Button>
            </VStack>
          </Box>
        </Box>
        <Box position="relative" zIndex={1}><PublicFooter /></Box>
      </Box>
    </Box>
  );
}