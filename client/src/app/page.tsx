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
// Loaded only when isAuthenticated. Keeps the public landing bundle small,
// improving Lighthouse FCP/TBT/LCP for unauthenticated visitors.
const AuthenticatedHome = dynamic(() => import("@/components/ui/AuthenticatedHome"), {
  ssr: false,
  loading: () => null,
});
import { useAuthStore } from "@/stores/authStore";
import {
  FiArrowRight,
  FiZap,
  FiGlobe,
  FiShield,
  FiCheck,
  FiTrendingUp,
  FiTrendingDown,
  FiBarChart2,
  FiUsers,
  FiCode,
  FiLayers,
  FiActivity,
  FiLock,
  FiCpu,
  FiBox,
  FiFeather,
  FiSend,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiWifi,
  FiRepeat,
  FiPieChart,
  FiHome,
  FiCreditCard,
  FiStar,
  FiMapPin,
  FiAtSign,
  FiSettings,
} from "react-icons/fi";
import { FaApplePay, FaGooglePay, FaCcVisa, FaCcMastercard, FaPaypal } from "react-icons/fa";
import { SiRevolut } from "react-icons/si";
import { motion, useScroll, useTransform, useMotionValue, MotionValue, AnimatePresence, useMotionValueEvent } from "framer-motion";
import { IconLogo } from "@/components/ui/Logo";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { BackgroundPaths } from "@/components/ui/Paths";

/* iPhone frame geometry */
const PHONE_W = 300;
const PHONE_H = 630;
const SCREEN_INSET = { top: 10, bottom: 10, x: 10 };

const BRAND = "#0057b8";
const BRAND_LIGHT = "#4a8fe0";

/* ═════════════════════════════════════════════════════
   PHONE SCREENS
   ═════════════════════════════════════════════════════ */

/* ── Tiny area-chart line used inside phone screens ── */
function MiniChart({ up, height = 110 }: { up: boolean; height?: number }) {
  const stroke = up ? "#22c55e" : "#ef4444";
  const id = up ? "mc-up" : "mc-dn";
  return (
    <Box h={`${height}px`} position="relative">
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
          stroke={stroke}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="240" cy="20" r="3" fill={stroke} />
      </svg>
    </Box>
  );
}

// Slide distance — overshoot generously so the lock ALWAYS clears the screen
// regardless of phone size, scale, or device pixel ratio. PHONE_H is 630, so
// 1000px guarantees full clearance even on 2x scaled viewports.
const LOCK_SLIDE_PX = -1000;

const LockScreen = memo(function LockScreen({ unlockProgress }: { unlockProgress: MotionValue<number> }) {
  const slideY    = useTransform(unlockProgress, [0, 1], [0, LOCK_SLIDE_PX]);
  const fadeNotif = useTransform(unlockProgress, [0, 0.4], [1, 0]);
  // Aggressive opacity safety net — fully invisible by 60% unlock, so even if
  // slide transform under-shoots or scroll measurement stalls, the dashboard
  // is guaranteed to be visible.
  const lockOpacity = useTransform(unlockProgress, [0, 0.5, 0.6], [1, 1, 0]);
  // Pointer-events flip so the (now invisible) lock never blocks dashboard taps
  const lockPointerEvents = useTransform(unlockProgress, (v: number) => (v >= 0.6 ? "none" : "auto"));

  return (
    <motion.div
      style={{
        position: "absolute",
        inset: 0,
        y: slideY,
        opacity: lockOpacity,
        pointerEvents: lockPointerEvents as unknown as "auto" | "none",
        zIndex: 6,
        overflow: "hidden",
        borderRadius: "inherit",
        willChange: "transform, opacity",
      }}
    >
      {/* Wallpaper — static, no animation. Painted once. */}
      <Box
        position="absolute"
        inset={0}
        bg="linear-gradient(180deg, #030818 0%, #071240 35%, #0a1f6e 65%, #050d30 100%)"
      />

      {/* Status bar */}
      <HStack
        position="absolute"
        top="14px"
        left="20px"
        right="20px"
        justify="space-between"
        zIndex={2}
      >
        <Text fontSize="8px" color="white" fontWeight="700" letterSpacing="0.01em">
          promrkts
        </Text>
        <HStack spacing={1.5}>
          {/* Signal bars */}
          <HStack spacing="2px" align="flex-end" h="12px">
            {[5, 7, 9, 11].map((h, i) => (
              <Box key={i} w="3px" h={`${h}px`} bg="white" borderRadius="1px" opacity={i < 3 ? 1 : 0.35} />
            ))}
          </HStack>
          {/* WiFi */}
          <Icon as={FiWifi} color="white" boxSize={3.5} />
          {/* Battery */}
          <HStack spacing="1px" align="center">
            <Box w="20px" h="10px" border="1.5px solid white" borderRadius="2px" position="relative" overflow="hidden">
              <Box position="absolute" inset="1px" right="2px" bg="white" borderRadius="1px" />
            </Box>
            <Box w="2px" h="5px" bg="white" borderRadius="0 1px 1px 0" opacity={0.6} />
          </HStack>
        </HStack>
      </HStack>

      {/* Dynamic Island */}
      <Box
        position="absolute"
        top="10px"
        left="50%"
        transform="translateX(-50%)"
        w="90px"
        h="26px"
        bg="black"
        borderRadius="full"
        zIndex={3}
      />

      {/* Time */}
      <motion.div style={{ opacity: fadeNotif, position: "absolute", top: "80px", left: 0, right: 0, textAlign: "center", zIndex: 2 }}>
        <Text
          fontSize="8px"
          fontWeight="200"
          color="white"
          letterSpacing="-0.04em"
          lineHeight={1}
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}
        >
          <Icon as={FiLock} color="rgba(255,255,255,0.7)" fontSize={30} />
        </Text>
        <Text
          fontSize="78px"
          fontWeight="200"
          color="white"
          letterSpacing="-0.04em"
          lineHeight={1}
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}
        >
          11:44
        </Text>
        <Text fontSize="15px" color="rgba(255,255,255,0.85)" fontWeight="500" mt={1} letterSpacing="0.01em">
          Sunday, April 27
        </Text>
      </motion.div>

      {/* Notifications */}
      <motion.div style={{ opacity: fadeNotif, position: "absolute", top: "230px", left: "16px", right: "16px", zIndex: 2 }}>
        <VStack spacing={2} align="stretch">
          {/* Notification 2 */}
          <Box
            bg="rgba(255,255,255,0.10)"
            borderRadius="16px"
            p={3}
            style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
            border="1px solid rgba(255,255,255,0.08)"
          >
            <HStack spacing={2.5}>
              <Flex w="32px" h="32px" borderRadius="8px" bg="linear-gradient(135deg, #0057b8, #4a6ba5)" align="center" justify="center" flexShrink={0}>
                <Text fontSize="14px">💸</Text>
              </Flex>
              <VStack align="start" spacing={0} flex={1}>
                <HStack justify="space-between" w="100%">
                  <Text fontSize="11px" color="rgba(255,255,255,0.7)" fontWeight="700" letterSpacing="0.04em" textTransform="uppercase">promrkts</Text>
                  <Text fontSize="10px" color="rgba(255,255,255,0.5)">1m ago</Text>
                </HStack>
                <Text fontSize="12px" color="white" fontWeight="600">@rayofsunshine sent you +$1,144.28</Text>
              </VStack>
            </HStack>
          </Box>
        </VStack>
      </motion.div>

      {/* Dock-style home indicator area */}
      <motion.div style={{ opacity: fadeNotif, position: "absolute", bottom: "28px", left: 0, right: 0, zIndex: 2 }}>
        <VStack spacing={2}>
          <Text fontSize="12px" color="rgba(255,255,255,0.55)" fontWeight="500" letterSpacing="0.02em">
            Swipe up to unlock
          </Text>
          <Box w="120px" h="4px" bg="rgba(255,255,255,0.35)" borderRadius="full" />
        </VStack>
      </motion.div>
    </motion.div>
  );
});

const ScreenDashboard = memo(function ScreenDashboard() {
  const assets = [
    {
      name: "promrkts Balance",
      sub: null,
      val: "$41,120.00",
      icon: (
        <Flex w="40px" h="40px" borderRadius="full" bg="#1a1a1a" border="1.5px solid rgba(255,255,255,0.12)" align="center" justify="center" flexShrink={0}>
          <Flex w="22px" h="22px" borderRadius="full" bg="white" align="center" justify="center">
            <Text fontSize="11px" fontWeight="900" color="black">$</Text>
          </Flex>
        </Flex>
      ),
    },
    {
      name: "USDT (SOL)",
      sub: "USDT",
      val: "$11,444.28",
      icon: (
        <Box position="relative" w="40px" h="40px" flexShrink={0}>
          <Flex w="40px" h="40px" borderRadius="full" bg="#2775ca" align="center" justify="center">
            <Text fontSize="13px" fontWeight="900" color="white">$</Text>
          </Flex>
          <Flex position="absolute" bottom="-1px" right="-1px" w="18px" h="18px" borderRadius="full" bg="#9945ff" align="center" justify="center" border="1.5px solid #050810">
            <Text fontSize="7px" fontWeight="900" color="white">◎</Text>
          </Flex>
        </Box>
      ),
    },
    {
      name: "Bitcoin",
      sub: null,
      val: "$114,200.20",
      icon: (
        <Flex w="40px" h="40px" borderRadius="full" bg="#f7931a" align="center" justify="center" flexShrink={0}>
          <Text fontSize="16px" fontWeight="900" color="white">₿</Text>
        </Flex>
      ),
    },
    {
      name: "Ethereum",
      sub: null,
      val: "$4,111.02",
      icon: (
        <Flex w="40px" h="40px" borderRadius="full" bg="#627eea" align="center" justify="center" flexShrink={0}>
          <Text fontSize="15px" fontWeight="700" color="white">Ξ</Text>
        </Flex>
      ),
    },
  ];

  return (
    <VStack h="100%" w="100%" align="stretch" spacing={0} bg="#0a0a0a" overflow="hidden">

      {/* ── Status bar spacer ── */}
      <Box h="48px" />

      {/* ── Header: avatar + handle + settings ── */}
      <HStack px={5} pb={4} justify="space-between" align="center">
        <HStack spacing={2.5}>
          <Box
            w="34px" h="34px" borderRadius="full"
            bg="linear-gradient(135deg, #667eea, #764ba2)"
            overflow="hidden"
            position="relative"
            flexShrink={0}
          >
            <Flex w="100%" h="100%" align="center" justify="center">
              <Text fontSize="14px">🧑‍💻</Text>
            </Flex>
          </Box>
          <Text fontSize="14px" color="white" fontWeight="700" letterSpacing="-0.01em">
            @rayofsunshine
          </Text>
        </HStack>
        <Flex
          w="32px" h="32px" borderRadius="full"
          bg="rgba(255,255,255,0.07)"
          align="center" justify="center"
        >
          <Icon as={FiSettings} color="rgba(255,255,255,0.7)" boxSize={3.5} />
        </Flex>
      </HStack>

      {/* ── Balance block ── */}
      <VStack align="start" spacing={2} px={5} pb={5}>
        <HStack spacing={1.5}>
          <Text fontSize="12px" color="rgba(255,255,255,0.45)" fontWeight="500">
            Total value
          </Text>
          <Flex
            w="14px" h="14px" borderRadius="full"
            bg="rgba(255,255,255,0.1)"
            align="center" justify="center"
          >
            <Text fontSize="8px" color="rgba(255,255,255,0.5)">i</Text>
          </Flex>
        </HStack>

        <Text
          fontSize="40px" color="white" fontWeight="700"
          letterSpacing="-0.04em" lineHeight={1}
          fontFamily="'DM Sans', sans-serif"
        >
          $41,120.02
        </Text>

        <HStack spacing={2}>
          <Text fontSize="13px" color="#22c55e" fontWeight="600">
            +$1,244.02
          </Text>
          <HStack
            spacing={1}
            bg="rgba(34,197,94,0.15)"
            px={1.5} py={0.5}
            borderRadius="6px"
          >
            <Text fontSize="10px" color="#22c55e">▲</Text>
            <Text fontSize="11px" color="#22c55e" fontWeight="700">3.12%</Text>
          </HStack>
        </HStack>
      </VStack>

      {/* ── Action buttons ── */}
      <HStack px={5} pb={5} spacing={2}>
        {/* Buy — filled pill */}
        <HStack
          flex={1}
          h="42px"
          bg="rgba(255,255,255,0.10)"
          borderRadius="full"
          justify="center"
          spacing={1.5}
          border="1px solid rgba(255,255,255,0.08)"
        >
          <Text fontSize="16px" color="white" fontWeight="300">+</Text>
          <Text fontSize="13px" color="white" fontWeight="700">Buy</Text>
        </HStack>

        {/* Deposit — filled pill */}
        <HStack
          flex={1}
          h="42px"
          bg="rgba(255,255,255,0.10)"
          borderRadius="full"
          justify="center"
          spacing={1.5}
          border="1px solid rgba(255,255,255,0.08)"
        >
          <Icon as={FiArrowDownLeft} color="white" boxSize={3.5} />
          <Text fontSize="13px" color="white" fontWeight="700">Deposit</Text>
        </HStack>

        {/* More — icon pill */}
        <Flex
          w="42px" h="42px"
          bg="rgba(255,255,255,0.10)"
          borderRadius="full"
          align="center" justify="center"
          border="1px solid rgba(255,255,255,0.08)"
          flexShrink={0}
        >
          <Text fontSize="16px" color="white" letterSpacing="0.05em">···</Text>
        </Flex>
      </HStack>

      {/* ── Assets / Wallets tab bar ── */}
      <HStack px={5} pb={3} spacing={5}>
        <VStack spacing={1}>
          <Text fontSize="13px" color="white" fontWeight="700">Assets</Text>
          <Box w="100%" h="2px" bg="white" borderRadius="full" />
        </VStack>
        <VStack spacing={1}>
          <Text fontSize="13px" color="rgba(255,255,255,0.35)" fontWeight="600">Wallets</Text>
          <Box w="100%" h="2px" bg="transparent" borderRadius="full" />
        </VStack>
      </HStack>

      {/* ── Hairline divider ── */}
      <Box h="1px" bg="rgba(255,255,255,0.07)" mx={0} />

      {/* ── Asset list ── */}
      <VStack align="stretch" spacing={0} flex={1} overflowY="hidden">
        {assets.map((a, i) => (
          <HStack
            key={a.name}
            px={5}
            py={3.5}
            spacing={3}
            borderBottom="1px solid rgba(255,255,255,0.05)"
          >
            {a.icon}
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="13px" color="white" fontWeight="600">{a.name}</Text>
              {a.sub && (
                <Text fontSize="11px" color="rgba(255,255,255,0.38)">{a.sub}</Text>
              )}
            </VStack>
            <Text fontSize="13px" color="white" fontWeight="600" fontFamily="monospace">
              {a.val}
            </Text>
          </HStack>
        ))}
      </VStack>

    </VStack>
  );
});

function ScreenP2P() {
  const { t } = useTranslate();
  const offers = [
    { name: "Rayan Z.", flag: "", rate: "67,240.50", lim: "100 – 50,000", orders: 1144, cur: "BTC/USDT" },
    { name: "Rahma A.", flag: "", rate: "3.67", lim: "114.20 – 41,120", orders: 411, cur: "USDT/AED" },
    { name: "Noran G.", flag: "", rate: "3.75", lim: "41.12 – 11,420", orders: 1120, cur: "USDT/SAR" },
  ];
  return (
    <VStack h="100%" w="100%" p={5} align="stretch" spacing={3} bg="#000">
      <HStack pt={8}>
        <Text fontSize="14px" color="white" fontWeight="800" flex={1} textAlign="center">{t("screen_p2p_title")}</Text>
      </HStack>
      <HStack bg="rgba(255,255,255,0.04)" borderRadius="10px" p={1}>
        <Box flex={1} bg="#22c55e" borderRadius="8px" py={1.5} textAlign="center">
          <Text fontSize="11px" color="white" fontWeight="800">{t("screen_p2p_buy")}</Text>
        </Box>
        <Box flex={1} py={1.5} textAlign="center">
          <Text fontSize="11px" color="rgba(255,255,255,0.5)" fontWeight="700">{t("screen_p2p_sell")}</Text>
        </Box>
      </HStack>
      <Text fontSize="9px" color="rgba(255,255,255,0.4)" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase">
        {t("screen_p2p_global_offers")}
      </Text>
      <VStack align="stretch" spacing={2} flex={1}>
        {offers.map((o) => (
          <Box key={o.name} bg="rgba(255,255,255,0.03)" p={2.5} borderRadius="12px" border="1px solid rgba(255,255,255,0.06)">
            <HStack mb={1.5}>
              <Flex w="26px" h="26px" borderRadius="full" bg="rgba(0,87,184,0.3)" align="center" justify="center" fontSize="13px">
                {o.flag}
              </Flex>
              <VStack align="start" spacing={0} flex={1}>
                <Text fontSize="11px" color="white" fontWeight="700">{o.name}</Text>
                <Text fontSize="8px" color="rgba(255,255,255,0.4)">{o.orders} · ⭐ 4.9 · {o.cur}</Text>
              </VStack>
              <Button size="xs" h="24px" bg={BRAND} color="white" borderRadius="8px" fontSize="10px" fontWeight="800">{t("screen_p2p_buy")}</Button>
            </HStack>
            <HStack spacing={4}>
              <Text fontSize="10px" color="white" fontWeight="700" fontFamily="monospace">{o.rate}</Text>
              <Text fontSize="9px" color="rgba(255,255,255,0.4)">{o.lim}</Text>
            </HStack>
          </Box>
        ))}
      </VStack>
    </VStack>
  );
}

/* ── Social Wallet (@handle) screen ── */
function ScreenSocialWallet() {
  const { t } = useTranslate();
  const payments = [
    { n: "@rayofsunshine", loc: "Tripoli · 11:44", amt: "+11.44", ini: "R", grad: "linear-gradient(135deg, #facc15, #f59e0b)" },
    { n: "@moe.ali", loc: "Cairo · 1:11", amt: "-41.12", ini: "N", grad: "linear-gradient(135deg, #06b6d4, #0369a1)" },
    { n: "@modi", loc: "London · 4:44", amt: "+114.20", ini: "L", grad: "linear-gradient(135deg, #ec4899, #be185d)" },
  ];
  return (
    <VStack h="100%" w="100%" p={5} align="stretch" spacing={3} bg="#000">
      <HStack pt={8} justify="center">
        <Text fontSize="14px" color="white" fontWeight="800">{t("screen_social_title")}</Text>
      </HStack>
      <Box
        bg="linear-gradient(135deg, rgba(18, 75, 180, 0.9) 0%, rgba(58, 153, 237, 0.28) 100%)"
        border="1px solid rgba(255,255,255,0.08)"
        borderRadius="18px"
        p={4}
      >
        <HStack mb={2}>
          <Flex w="36px" h="36px" borderRadius="full" bg={BRAND} align="center" justify="center">
            <Icon as={FiAtSign} color="white" />
          </Flex>
          <VStack align="start" spacing={0}>
            <Text fontSize="13px" color="white" fontWeight="800">@rayofsunshine</Text>
            <Text fontSize="9px" color="rgba(255,255,255,0.55)">Rayan Z. · {t("screen_social_handle")}</Text>
          </VStack>
        </HStack>
        <Text fontSize="9px" color="rgba(255,255,255,0.55)">{t("screen_social_desc")}</Text>
      </Box>
      <Text fontSize="9px" color="rgba(255,255,255,0.45)" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase">
        {t("screen_social_recent")}
      </Text>
      <VStack align="stretch" spacing={2} flex={1}>
        {payments.map((p) => (
          <HStack key={p.n} bg="rgba(255,255,255,0.03)" p={2.5} borderRadius="12px" border="1px solid rgba(255,255,255,0.05)">
            <Flex w="32px" h="32px" borderRadius="full" bg={p.grad} align="center" justify="center">
              <Text fontSize="11px" color="white" fontWeight="800">{p.ini}</Text>
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="11px" color="white" fontWeight="700">{p.n}</Text>
              <Text fontSize="9px" color="rgba(255,255,255,0.4)">{p.loc}</Text>
            </VStack>
            <Text fontSize="11px" color={p.amt.startsWith("+") ? "#22c55e" : "rgba(255,255,255,0.75)"} fontWeight="800" fontFamily="monospace">
              {p.amt}
            </Text>
          </HStack>
        ))}
      </VStack>
      <HStack spacing={2}>
        <Button flex={1} h="36px" bg={BRAND} color="white" borderRadius="12px" fontSize="12px" fontWeight="800" leftIcon={<Icon as={FiSend} boxSize={3.5} />}>
          {t("screen_social_send")}
        </Button>
        <Button flex={1} h="36px" bg="rgba(255,255,255,0.08)" color="white" border="1px solid rgba(255,255,255,0.1)" borderRadius="12px" fontSize="12px" fontWeight="800" leftIcon={<Icon as={FiArrowDownLeft} boxSize={3.5} />}>
          {t("screen_social_request")}
        </Button>
      </HStack>
    </VStack>
  );
}

/* ── Visa Card screen ── */
function ScreenCard() {
  const { t } = useTranslate();
  return (
    <VStack h="100%" w="100%" p={5} align="stretch" spacing={3} bg="#000">
      <HStack pt={6} justify="center">
        <Text fontSize="14px" color="white" fontWeight="800">{t("screen_card_title")}</Text>
      </HStack>
      {/* Customizable virtual Visa card (painted, not an image) */}
      <Box
        position="relative"
        borderRadius="18px"
        overflow="hidden"
        boxShadow="0 16px 40px rgba(0,87,184,0.45)"
        w="100%"
        style={{ aspectRatio: "1.586 / 1" }}
        bg="linear-gradient(135deg, #0057b8 0%, #001a3d 55%, #050914 100%)"
      >
        {/* Holographic glow */}
        <Box
          position="absolute"
          top="-40%"
          right="-15%"
          w="260px"
          h="260px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(74,143,224,0.55) 0%, rgba(74,143,224,0) 65%)"
          filter="blur(30px)"
        />
        <Box
          position="absolute"
          bottom="-30%"
          left="-10%"
          w="220px"
          h="220px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(124,58,237,0.45) 0%, rgba(124,58,237,0) 65%)"
          filter="blur(28px)"
        />
        {/* Foil hair-line diagonals */}
        <Box
          position="absolute"
          inset={0}
          opacity={0.18}
          bgGradient="linear(135deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)"
        />

        <Box position="absolute" inset={0} p={4} display="flex" flexDirection="column" justifyContent="space-between">
          {/* Top row: brand + contactless */}
          <HStack justify="space-between" align="center">
            <NextImage src="/logo-white.png" width={35} height={25} alt="text"/>
            <Icon as={FiWifi} color="white" boxSize={3.5} transform="rotate(90deg)" opacity={0.9} />
          </HStack>

          {/* Middle: chip + Visa wordmark placeholder */}
          <HStack justify="space-between" align="center" mt={1}>
            {/* EMV chip */}
            <Box
              w="30px"
              h="22px"
              borderRadius="4px"
              bg="linear-gradient(135deg, #e8d48a 0%, #b48a35 50%, #f5e3a2 100%)"
              position="relative"
              boxShadow="inset 0 0 0 0.5px rgba(0,0,0,0.25)"
            >
              <Box position="absolute" inset="2px 3px" borderRadius="2px" border="0.5px solid rgba(0,0,0,0.35)" />
              <Box position="absolute" top="50%" left="2px" right="2px" h="0.5px" bg="rgba(0,0,0,0.35)" transform="translateY(-50%)" />
              <Box position="absolute" top="2px" bottom="2px" left="50%" w="0.5px" bg="rgba(0,0,0,0.35)" transform="translateX(-50%)" />
            </Box>
            {/* Customizable dot: tier ring */}
            <HStack spacing={1}>
              <Box w="6px" h="6px" borderRadius="full" bg="#8ab4f8" />
              <Text fontSize="8px" color="rgba(255,255,255,0.75)" fontWeight="700" letterSpacing="0.1em">MASTER</Text>
            </HStack>
          </HStack>

          {/* PAN */}
          <Text fontSize="15px" color="white" fontFamily="monospace" letterSpacing="0.18em" fontWeight="700">
            1144 4411 1142 1144
          </Text>

          {/* Bottom row */}
          <HStack justify="space-between" align="flex-end">
            <HStack spacing={5}>
              <VStack align="start" spacing={0}>
                <Text fontSize="7.5px" color="rgba(255,255,255,0.7)" letterSpacing="0.1em">
                  {t("screen_card_holder")}
                </Text>
                <Text fontSize="10px" color="white" fontWeight="700">RAYAN Z.</Text>
              </VStack>
              <VStack align="start" spacing={0}>
                <Text fontSize="7.5px" color="rgba(255,255,255,0.7)" letterSpacing="0.1em">
                  {t("screen_card_expires")}
                </Text>
                <Text fontSize="10px" color="white" fontWeight="700">11/44</Text>
              </VStack>
            </HStack>
            {/* VISA wordmark (painted) */}
            <Text fontSize="16px" color="white" fontWeight="900" fontStyle="italic" letterSpacing="-0.02em">
              VISA
            </Text>
          </HStack>
        </Box>
      </Box>
      {/* Customization strip */}
      <HStack spacing={2} justify="center">
        {[
          { c: "#8ab4f8", label: "Starter" },
          { c: "#0057b8", label: "Master" },
          { c: "#0a0f1e", label: "Pro" },
        ].map((t2, i) => (
          <HStack
            key={t2.label}
            bg={i === 1 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"}
            border="1px solid"
            borderColor={i === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}
            borderRadius="full"
            px={2.5}
            py={1}
            spacing={1.5}
          >
            <Box w="10px" h="10px" borderRadius="full" bg={t2.c} boxShadow={`0 0 6px ${t2.c}aa`} />
            <Text fontSize="9px" color="white" fontWeight="700">{t2.label}</Text>
          </HStack>
        ))}
      </HStack>
      {/* Stats */}
      <SimpleGrid columns={3} spacing={2}>
        {[
          { l: t("screen_card_spent"), v: "$4,111.02" },
          { l: t("screen_card_limit"), v: "$41,120" },
          { l: t("screen_card_cashback"), v: "$114.02" },
        ].map((s) => (
          <VStack key={s.l} bg="rgba(255,255,255,0.03)" p={2} borderRadius="10px" spacing={0} border="1px solid rgba(255,255,255,0.05)">
            <Text fontSize="8px" color="rgba(255,255,255,0.5)" letterSpacing="0.08em" textTransform="uppercase">{s.l}</Text>
            <Text fontSize="12px" color="white" fontWeight="800" fontFamily="monospace">{s.v}</Text>
          </VStack>
        ))}
      </SimpleGrid>
      {/* Recent spend */}
      <Text fontSize="9px" color="rgba(255,255,255,0.45)" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase">
        {t("screen_card_recent")}
      </Text>
      <VStack align="stretch" spacing={2} flex={1}>
        {[
          { n: "Apple Store", c: "Dubai · AED", amt: "-114.20" },
          { n: "Carrefour", c: "Riyadh · SAR", amt: "-41.12" },
          { n: "Uber", c: "Cairo · EGP", amt: "-11.44" },
        ].map((s) => (
          <HStack key={s.n} bg="rgba(255,255,255,0.03)" p={2} borderRadius="10px" border="1px solid rgba(255,255,255,0.05)">
            <Flex w="26px" h="26px" borderRadius="full" bg="rgba(255,255,255,0.06)" align="center" justify="center">
              <Icon as={FiCreditCard} color="white" boxSize={3} />
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="11px" color="white" fontWeight="700">{s.n}</Text>
              <Text fontSize="9px" color="rgba(255,255,255,0.4)">{s.c}</Text>
            </VStack>
            <Text fontSize="11px" color="rgba(255,255,255,0.8)" fontWeight="800" fontFamily="monospace">{s.amt}</Text>
          </HStack>
        ))}
      </VStack>
      <Button h="34px" bg="rgba(255,255,255,0.06)" color="white" border="1px solid rgba(255,255,255,0.08)" borderRadius="10px" fontSize="11px" fontWeight="700">
        {t("screen_card_freeze")}
      </Button>
    </VStack>
  );
}

/* ═════════════════════════════════════════════════════
   PHONE FRAME (crossfade across 6 screens)
   ═════════════════════════════════════════════════════ */

const PhoneFrame = memo(function PhoneFrame({
  unlockProgress,
}: {
  progress?: MotionValue<number>;
  unlockProgress: MotionValue<number>;
}) {
  return (
    <Box
      position="relative"
      w={`${PHONE_W}px`}
      h={`${PHONE_H}px`}
      mx="auto"
    >
      <Box
        position="absolute"
        top={`${SCREEN_INSET.top}px`}
        bottom={`${SCREEN_INSET.bottom}px`}
        left={`${SCREEN_INSET.x}px`}
        right={`${SCREEN_INSET.x}px`}
        borderRadius="40px"
        overflow="hidden"
        bg="#000"
        boxShadow={{
          base: "0 20px 50px rgba(0,87,184,0.25)",
          md: "0 40px 100px rgba(0,87,184,0.4)",
        }}
      >
        {/* App screen underneath — always mounted */}
        <Box position="absolute" inset={0}>
          <ScreenDashboard />
        </Box>

        {/* Lock screen slides up over it on scroll */}
        <LockScreen unlockProgress={unlockProgress} />
      </Box>

      <NextImage
        src="/iphone-frame.png"
        alt=""
        fill
        priority
        sizes="(max-width: 768px) 200px, 320px"
        style={{ objectFit: "contain", pointerEvents: "none", zIndex: 10 }}
      />
    </Box>
  );
});

/* ═════════════════════════════════════════════════════
   LAZY BACKGROUND VIDEO
   Pauses when offscreen so we don't burn GPU/battery
   decoding video frames the user can't see.
   ═════════════════════════════════════════════════════ */
function LazyBackgroundVideo({
  src,
  opacity = 1,
  objectFit = "cover",
  filter,
}: {
  src: string;
  opacity?: number;
  objectFit?: "cover" | "contain";
  filter?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.play().catch(() => {});
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      },
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      loop
      muted
      playsInline
      preload="none"
      style={{
        width: "100%",
        height: "100%",
        objectFit,
        opacity,
        filter: filter ?? (opacity < 1 ? "saturate(1.1) blur(0.5px)" : undefined),
      }}
    />
  );
}

/* ═════════════════════════════════════════════════════
   STATIC PHONE (used in feature sections below)
   ═════════════════════════════════════════════════════ */

function StaticPhone({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  return (
    <Box
      position="relative"
      w={`${PHONE_W}px`}
      h={`${PHONE_H}px`}
      mx="auto"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      <Box
        position="absolute"
        top={`${SCREEN_INSET.top}px`}
        bottom={`${SCREEN_INSET.bottom}px`}
        left={`${SCREEN_INSET.x}px`}
        right={`${SCREEN_INSET.x}px`}
        borderRadius="40px"
        overflow="hidden"
        bg="#000"
        boxShadow={{
          base: "0 20px 50px rgba(0,87,184,0.25)",
          md: "0 40px 100px rgba(0,87,184,0.4)",
        }}
      >
        {children}
      </Box>
      <NextImage 
        src="/iphone-frame.png" 
        alt="" 
        fill 
        loading="lazy"
        sizes="(max-width: 768px) 200px, 320px"
        placeholder="blur"
        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        style={{ objectFit: "contain", pointerEvents: "none", zIndex: 10 }} 
      />
    </Box>
  );
}

/* ── Send-money screen (social payments) ── */
function PhoneSendScreen() {
  const { t } = useTranslate();
  const nums = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];
  return (
    <VStack h="100%" w="100%" align="stretch" spacing={3} p={6}>
      <HStack pt={8}>
        <Text fontSize="14px" color="rgba(255,255,255,0.55)">←</Text>
        <Text fontSize="14px" color="white" fontWeight="700" flex={1} textAlign="center">{t("sec_social_screen_send")}</Text>
        <Box w="10px" />
      </HStack>
      {/* Recipient */}
      <HStack bg="rgba(255,255,255,0.05)" border="1px solid rgba(255,255,255,0.08)" borderRadius="14px" p={3}>
        <Flex w="38px" h="38px" borderRadius="full" bg="linear-gradient(135deg, #facc15, #f59e0b)" align="center" justify="center">
          <Text fontSize="13px" color="white" fontWeight="800">R</Text>
        </Flex>
        <VStack align="start" spacing={0} flex={1}>
          <Text fontSize="10px" color="rgba(255,255,255,0.5)" fontWeight="700" letterSpacing="0.1em">{t("sec_social_to")}</Text>
          <Text fontSize="13px" color="white" fontWeight="800">@rayofsunshine · Rayan Z.</Text>
        </VStack>
        <Icon as={FiCheck} color="#22c55e" />
      </HStack>
      {/* Amount */}
      <VStack spacing={0} py={3}>
        <HStack align="baseline" spacing={1.5}>
          <Text fontSize="11px" color="rgba(255,255,255,0.5)" fontWeight="700" letterSpacing="0.12em">USDT</Text>
          <Heading color="white" fontSize="58px" fontWeight="800" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif">
            11.44
          </Heading>
        </HStack>
      </VStack>
      <Button bg="white" color="black" borderRadius="full" h="36px" fontSize="12px" fontWeight="800" mx={4}>
        {t("sec_social_screen_preview")}
      </Button>
      <SimpleGrid columns={3} spacing={2.5} pt={1}>
        {nums.map((n) => (
          <Flex key={n} h="40px" align="center" justify="center">
            <Text fontSize="20px" fontWeight="600" color={n === "⌫" ? "rgba(255,255,255,0.55)" : "white"} fontFamily="'DM Sans', sans-serif">
              {n}
            </Text>
          </Flex>
        ))}
      </SimpleGrid>
    </VStack>
  );
}

const TX_POOL = [
  { name: "@noran.g",  icon: "🌙" },
  { name: "@rahma.a",  icon: "⚡" },
  { name: "@rayan.z",  icon: "💫" },
  { name: "@sam.v",    icon: "💎" },
  { name: "@amira.h",  icon: "🔥" },
  { name: "@omar.s",   icon: "🚀" },
  { name: "@kylie.m",  icon: "✨" },
  { name: "@keiran",   icon: "🌐" },
];

function LiveTxFeed() {
  const [txns, setTxns] = useState([
    { id: 1, name: "@moe.ali",       amt: "+$1,114.20", color: "#22c55e", icon: "⚡", ts: "just now" },
    { id: 2, name: "@rayofsunshine", amt: "+$40,141.28", color: "#22c55e", icon: "🌍", ts: "2s ago" },
    { id: 3, name: "@noran.g",       amt: "-$11.44",    color: "#ef4444", icon: "💸", ts: "5s ago" },
    { id: 4, name: "@rahma.a",       amt: "+$280.00",   color: "#22c55e", icon: "🌙", ts: "8s ago" },
  ]);
  const nextId = useRef(10);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only run the interval when the feed is visible AND the tab is active.
  // Previous version ran every 1.6s constantly — re-rendering the feed mid-scroll
  // even when it was offscreen, which caused massive jank on mobile production.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let visible = false;

    const tick = () => {
      if (document.hidden) return;
      const p = TX_POOL[Math.floor(Math.random() * TX_POOL.length)];
      const up = Math.random() > 0.3;
      const val = (Math.random() * 900 + 11).toFixed(2);
      setTxns(prev => [
        {
          id: nextId.current++,
          name: p.name,
          amt: `${up ? "+" : "-"}$${val}`,
          color: up ? "#22c55e" : "#ef4444",
          icon: p.icon,
          ts: "just now",
        },
        ...prev,
      ].slice(0, 6));
    };

    const start = () => {
      if (interval) return;
      // Slower cadence (3s) on mobile — fast updates aren't worth the scroll cost
      interval = setInterval(tick, 3000);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      start();
      return stop;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (visible && !document.hidden) start();
          else stop();
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);

    const onVis = () => {
      if (document.hidden) stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, []);

  return (
    <VStack
      ref={containerRef}
      align="stretch"
      spacing={3}
      w={{ base: "100%", lg: "300px" }}
      maxW={{ base: "100%", lg: "300px" }}
      mx={{ base: "auto", lg: 0 }}
    >
      {/* Transaction cards. Mobile shows 2, desktop shows 5 — controlled via
          Chakra responsive `display` prop (CSS-only, no useBreakpointValue
          re-render storm during scroll). */}
      <VStack align="stretch" spacing={2} position="relative">
        <AnimatePresence initial={false}>
          {txns.slice(0, 5).map((tx, i) => (
            <Box
              key={tx.id}
              // Cards beyond index 1 hidden on mobile via CSS — replaces previous
              // useBreakpointValue+slice() which was triggering re-renders during scroll.
              display={i >= 2 ? { base: "none", lg: "block" } : "block"}
            >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.93 }}
              animate={{
                opacity: 1 - i * 0.18,
                y: 0,
                scale: 1 - i * 0.015,
              }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              layout
            >
              <HStack
                bg={i === 0 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)"}
                border="1px solid"
                borderColor={i === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}
                borderRadius="14px"
                px={{ base: 3, lg: 4 }}
                py={{ base: 2.5, lg: 3 }}
                spacing={3}
                boxShadow={i === 0 ? "0 8px 24px rgba(0,0,0,0.3)" : "none"}
              >
                <Flex
                  w={{ base: "30px", lg: "36px" }}
                  h={{ base: "30px", lg: "36px" }}
                  borderRadius="full"
                  bg="rgba(255,255,255,0.08)"
                  align="center"
                  justify="center"
                  flexShrink={0}
                  fontSize={{ base: "13px", lg: "16px" }}
                >
                  {tx.icon}
                </Flex>
                <VStack align="start" spacing={0} flex={1} minW={0}>
                  <Text fontSize={{ base: "12px", lg: "13px" }} fontWeight="700" isTruncated w="100%">
                    {tx.name}
                  </Text>
                  <Text fontSize={{ base: "9px", lg: "10px" }} fontWeight="500" opacity={0.5}>
                    {tx.ts}
                  </Text>
                </VStack>
                <Text
                  fontSize={{ base: "12px", lg: "14px" }}
                  color={tx.color}
                  fontWeight="800"
                  fontFamily="monospace"
                  flexShrink={0}
                >
                  {tx.amt}
                </Text>
              </HStack>
            </motion.div>
            </Box>
          ))}
        </AnimatePresence>
      </VStack>

      <style>{`
        @keyframes liveping {
          75%, 100% { transform: scale(2.6); opacity: 0; }
        }
      `}</style>
    </VStack>
  );
}

/* ── Social Finance section (text left / phone right) ── */
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
              <StaticPhone scale={0.85}>
                <PhoneSendScreen />
              </StaticPhone>
            </motion.div>
          </Flex>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <VStack
              align={{ base: "center", lg: "start" }}
              spacing={{ base: 6, md: 8 }}
              order={{ base: 1, lg: 1 }}
              textAlign={{ base: "center", lg: "start" }}
            >
              <Heading
                fontFamily="'DM Sans', sans-serif"
                fontWeight="800"
                fontSize={{ base: "40px", md: "64px", xl: "80px" }}
                letterSpacing="-0.04em"
              >
                <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">
                  {t("sec_social_title_1")}
                </Box>
                <br />
                <Box as="span" color={textMain}>{t("sec_social_title_2")}</Box>
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">
                {t("sec_social_desc")}
              </Text>
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

/* ─────────────────────────────────────────────────────
   ALTERNATING FEATURE SECTION (phone + copy)
   Used for P2P, Social Wallet (Handles), Visa Card.
   ───────────────────────────────────────────────────── */
function AlternatingFeatureSection({
  imageSide,
  eyebrow,
  title,
  desc,
  features,
  phoneScreen,
  comingSoon = false,
  extraBelow,
}: {
  imageSide: "left" | "right";
  eyebrow: string;
  title: string;
  desc: string;
  features: { icon: React.ElementType; label: string }[];
  phoneScreen: React.ReactNode;
  comingSoon?: boolean;
  /** When provided, replaces the 4-feature grid (e.g. an image showcase). */
  extraBelow?: React.ReactNode;
}) {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.7)" : "#64748b";
  const tileBg = dark ? "rgba(20,28,48,0.9)" : "#ffffff";
  const tileBorder = dark ? "rgba(100,130,200,0.2)" : "rgba(0,87,184,0.12)";

  const phoneOrder = imageSide === "left" ? 1 : 2;
  const textOrder = imageSide === "left" ? 2 : 1;

  return (
    <Box className="snap-section-normal" position="relative" py={{ base: 16, md: 24 }} px={{ base: 4, md: 10 }} overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={2}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
          <Flex justify="center" order={{ base: 2, lg: phoneOrder }}>
            <motion.div
              initial={{ opacity: 0, y: 48, scale: 0.93 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              <StaticPhone scale={0.85}>{phoneScreen}</StaticPhone>
            </motion.div>
          </Flex>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ order: textOrder }}
          >
            <VStack
              align={{ base: "center", lg: "start" }}
              spacing={{ base: 5, md: 7 }}
              textAlign={{ base: "center", lg: "start" }}
            >
              <HStack spacing={3}>
                <Text
                  fontSize={{ base: "11px", md: "12px" }}
                  fontWeight="900"
                  color={BRAND_LIGHT}
                  letterSpacing="0.16em"
                  textTransform="uppercase"
                >
                  {eyebrow}
                </Text>
                {comingSoon && (
                  <Box
                    px={2.5}
                    py={0.5}
                    borderRadius="full"
                    bg="linear-gradient(135deg, #facc15, #f59e0b)"
                    color="#0a0f1e"
                    fontWeight="900"
                    fontSize="10px"
                    letterSpacing="0.05em"
                    textTransform="uppercase"
                    boxShadow="0 4px 14px rgba(250,204,21,0.4)"
                  >
                    {t("coming_soon")}
                  </Box>
                )}
              </HStack>
              <Heading
                fontFamily="'DM Sans', sans-serif"
                fontWeight="800"
                fontSize={{ base: "36px", md: "56px", xl: "72px" }}
                letterSpacing="-0.04em"
                lineHeight={1.05}
              >
                <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">
                  {title}
                </Box>
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">
                {desc}
              </Text>
              {extraBelow ? (
                <Box w="100%" maxW="460px">{extraBelow}</Box>
              ) : features.length > 0 && (
                <SimpleGrid columns={2} spacing={3} w="100%" maxW="460px">
                  {features.map((f, i) => (
                    <motion.div
                      key={f.label}
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      whileInView={{ opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.4, delay: 0.08 * i }}
                    >
                      <HStack
                        h="64px"
                        bg={tileBg}
                        border="1px solid"
                        borderColor={tileBorder}
                        borderRadius="16px"
                        px={4}
                        spacing={3}
                        transition="all 0.2s ease"
                        _hover={{ transform: "translateY(-3px)", borderColor: BRAND_LIGHT }}
                      >
                        <Flex
                          w="36px"
                          h="36px"
                          borderRadius="10px"
                          border="1px solid rgba(0,87,184,0.25)"
                          align="center"
                          justify="center"
                          flexShrink={0}
                          bg={dark ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.05)"}
                        >
                          <Icon as={f.icon} color={BRAND_LIGHT} />
                        </Flex>
                        <Text fontSize="13px" fontWeight="700" color={textMain}>
                          {f.label}
                        </Text>
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

/* ── Bento grid: sleek MoonPay-style stats ── */
function SectionBento() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  // Better contrast for mobile
  const cardBg = dark 
    ? "linear-gradient(145deg, rgba(20,25,40,0.9) 0%, rgba(10,15,30,0.95) 100%)" 
    : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)";
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
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ gridColumn: s.span && s.span > 1 ? `span ${s.span}` : undefined }}
            >
              <Box
                h="100%"
                minH={{ base: s.span && s.span > 1 ? "140px" : "110px", md: "auto" }}
                p={{ base: s.span && s.span > 1 ? 5 : 4, md: 7 }}
                borderRadius={{ base: "20px", md: "28px" }}
                bg={s.gradient || s.bg || cardBg}
                border="1px solid"
                borderColor={s.border || cardBorder}
                color={s.color || textMain}
                position="relative"
                overflow="hidden"
                transition="all 0.3s ease"
                _hover={{ 
                  transform: "translateY(-4px)", 
                  boxShadow: s.gradient 
                    ? "0 24px 60px rgba(0,87,184,0.4)" 
                    : dark 
                      ? "0 20px 50px rgba(0,0,0,0.4)" 
                      : "0 20px 50px rgba(0,87,184,0.15)",
                  borderColor: s.border ? s.border : dark ? "rgba(100,130,200,0.3)" : "rgba(0,87,184,0.25)"
                }}
              >
                {/* Gradient orb for featured card */}
                {s.gradient && (
                  <>
                    <Box position="absolute" top="-40%" right="-15%" w="300px" h="300px" borderRadius="full" bg="rgba(74,143,224,0.3)" filter="blur(70px)" pointerEvents="none" />
                    <Box position="absolute" bottom="-30%" left="-15%" w="200px" h="200px" borderRadius="full" bg="rgba(34,197,94,0.15)" filter="blur(60px)" pointerEvents="none" />
                  </>
                )}
                
                {/* Subtle shine effect on non-gradient cards */}
                {!s.gradient && (
                  <Box 
                    position="absolute" 
                    top="0" 
                    right="0" 
                    w="100%" 
                    h="100%" 
                    bg="linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 60%)" 
                    pointerEvents="none"
                    borderTopRightRadius="20px"
                  />
                )}
                
                <VStack align="start" spacing={{ base: 2, md: 4 }} position="relative">
                  <Flex
                    w={{ base: "36px", md: "44px" }}
                    h={{ base: "36px", md: "44px" }}
                    borderRadius="12px"
                    bg={s.gradient ? "rgba(255,255,255,0.15)" : dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.08)"}
                    align="center"
                    justify="center"
                  >
                    <Icon as={s.icon} color={s.accent || (s.gradient ? "white" : BRAND_LIGHT)} boxSize={{ base: 5, md: 6 }} />
                  </Flex>
                  <Box>
                    <Text fontSize={{ base: "10px", md: "12px" }} fontWeight="700" letterSpacing="0.1em" opacity={0.6} mb={0.5} textTransform="uppercase">{s.label}</Text>
                    {s.value && (
                      <Heading fontSize={{ base: "28px", md: "44px", lg: "52px" }} fontWeight="900" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif" lineHeight={1}>
                        {s.value}
                      </Heading>
                    )}
                    {s.sub && (
                      <Text fontSize={{ base: "12px", md: "14px" }} opacity={0.8} mt={1} maxW="260px" fontWeight="500">{s.sub}</Text>
                    )}
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

/* ═════════════════════════════════════════════════════
   SECTION — OnRamp (MoonPay-style Buy/Sell/Send videos)
   ═════════════════════════════════════════════════════ */

function SectionOnRamp() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.5)" : "#64748b";
  const cardBg = dark ? "rgba(0,0,0)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const methods: {
    label: string;
    icon?: React.ElementType;
    iconSize?: number;
    bg: string;
    color: string;
    border?: string;
    showLabel?: boolean;
  }[] = [
    { label: "Apple Pay",   icon: FaApplePay,     iconSize: 36, bg: "#000",     color: "#fff",     border: "rgba(255,255,255,0.18)" },
    { label: "Google Pay",  icon: FaGooglePay,    iconSize: 34, bg: "#fff",     color: "#5f6368",  border: "rgba(0,0,0,0.08)" },
    { label: "Visa",        icon: FaCcVisa,       iconSize: 30, bg: "#1a1f71",  color: "#fff" },
    { label: "Mastercard",  icon: FaCcMastercard, iconSize: 30, bg: "#0a0a0a",  color: "#ff5f00",  border: "rgba(255,255,255,0.12)" },
    { label: "Revolut",     icon: SiRevolut,      iconSize: 22, bg: "#0075eb",  color: "#fff", showLabel: true },
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
            <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ base: "36px", md: "52px", lg: "64px" }} letterSpacing="-0.04em" color={textMain} lineHeight={1.1} maxW="720px">
              {t("onramp_headline")}
            </Heading>
          </motion.div>

          {/* Payment methods — colorful brand chips */}
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15 }}>
            <Flex gap={{ base: 2, md: 3 }} flexWrap="wrap" justify="center" maxW="800px">
              {methods.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 8, scale: 0.92 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.35, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -2 }}
                >
                  <HStack
                    spacing={2}
                    px={{ base: 3, md: 4 }}
                    h={{ base: "38px", md: "42px" }}
                    borderRadius="full"
                    bg={m.bg}
                    color={m.color}
                    border={m.border ? `1px solid ${m.border}` : "none"}
                    boxShadow="0 4px 14px rgba(0,0,0,0.12)"
                    transition="box-shadow 0.2s ease"
                    _hover={{ boxShadow: "0 8px 22px rgba(0,0,0,0.2)" }}
                  >
                    {m.icon && (
                      <Icon as={m.icon} boxSize={`${m.iconSize ?? 24}px`} />
                    )}
                    {(m.showLabel || !m.icon) && (
                      <Text
                        fontSize={{ base: "12px", md: "13.5px" }}
                        fontWeight="900"
                      >
                        {m.label}
                      </Text>
                    )}
                  </HStack>
                </motion.div>
              ))}
            </Flex>
          </motion.div>

          {/* Video cards */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 4, md: 5 }} w="100%">
            {cards.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <VStack
                  bg={cardBg}
                  border="1px solid"
                  borderColor={cardBorder}
                  borderRadius={{ base: "24px", md: "32px" }}
                  overflow="hidden"
                  align="stretch"
                  spacing={0}
                  transition="all 0.3s ease"
                  _hover={{ transform: { md: "translateY(-6px)" }, boxShadow: dark ? "0 24px 60px rgba(0,0,0,0.4)" : "0 24px 60px rgba(0,87,184,0.12)" }}
                >
                  {/* Desktop: video on top with 4:3 ratio */}
                  <Box 
                    display={{ base: "none", md: "block" }}
                    position="relative" 
                    w="100%" 
                    style={{ aspectRatio: "4 / 3" }} 
                    overflow="hidden"
                  >
                    <LazyBackgroundVideo src={c.video} objectFit="cover" />
                  </Box>
                  
                  {/* Text content */}
                  <VStack p={{ base: 5, md: 7 }} align="center" >
                    <Heading fontWeight="800" color={textMain} fontFamily="'DM Sans', sans-serif">{c.title}</Heading>
                    <Text color={textSub} lineHeight={1.5}>{c.desc}</Text>
                  </VStack>
                  
                  {/* Mobile: full uncropped video */}
                  <Box
                    display={{ base: "block", md: "none" }}
                    position="relative"
                    w="100%"
                    style={{ aspectRatio: "4 / 3" }}
                    bg={dark ? "#0a0f1e" : "#f8f9fc"}
                    overflow="hidden"
                    borderTop="1px solid"
                    borderColor={cardBorder}
                  >
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

/* ═════════════════════════════════════════════════════
   SECTION — Social Proof (MoonPay-style stat + collage)
   ═════════════════════════════════════════════════════ */

function SectionSocialProof() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const prefersReducedMotion = typeof window !== "undefined" 
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobileDevice = typeof window !== "undefined" && window.innerWidth < 768;


  // Avatars positioned around the centered "35,000+" headline.
  // Each entry holds top/left in % of the wrapping stage. Sizes use responsive Chakra props.
  const avatars: {
    src: string;
    top: string;
    left: string;
    sizeBase: number;
    sizeMd: number;
    delay: number;
    floatDelay: number;
  }[] = [
    { src: "/screenshots/p1.avif", top: "12%", left: "20%", sizeBase: 56, sizeMd: 88,  delay: 0.05, floatDelay: 0   },
    { src: "/screenshots/p2.avif", top: "8%",  left: "48%", sizeBase: 62, sizeMd: 96,  delay: 0.1,  floatDelay: 0.6 },
    { src: "/screenshots/p3.avif", top: "16%", left: "78%", sizeBase: 70, sizeMd: 110, delay: 0.15, floatDelay: 1.2 },
    { src: "/screenshots/p4.avif", top: "58%", left: "10%", sizeBase: 56, sizeMd: 84,  delay: 0.2,  floatDelay: 0.4 },
    { src: "/screenshots/p5.avif", top: "60%", left: "84%", sizeBase: 58, sizeMd: 88,  delay: 0.25, floatDelay: 0.9 },
    { src: "/screenshots/p6.avif", top: "86%", left: "50%", sizeBase: 68, sizeMd: 100, delay: 0.3,  floatDelay: 0.2 },
  ];

  return (
    <Box
      position="relative"
      overflow="hidden"
      py={{ base: 16, md: 28 }}
      px={{ base: 4, md: 10 }}
    >
      <Container maxW="1200px" position="relative" zIndex={2}>
        <Box
          position="relative"
          w="100%"
          mx="auto"
          maxW={{ base: "100%", md: "960px" }}
          h={{ base: "560px", md: "640px" }}
        >
          {/* Floating avatars layer */}
          {avatars.map((a) => (
            <motion.div
              key={a.src}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.55,
                delay: a.delay,
                type: "spring",
                stiffness: 180,
                damping: 16,
              }}
              style={{
                position: "absolute",
                top: a.top,
                left: a.left,
                transform: "translate(-50%, -50%)",
                zIndex: 1,
              }}
            >
              <motion.div
                animate={(!prefersReducedMotion && !isMobileDevice) ? { y: [0, -10, 0] } : {}}
                transition={{
                  duration: 5 + (a.floatDelay % 2),
                  delay: a.floatDelay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Box
                  w={{ base: `${a.sizeBase}px`, md: `${a.sizeMd}px` }}
                  h={{ base: `${a.sizeBase}px`, md: `${a.sizeMd}px` }}
                  borderRadius="full"
                  overflow="hidden"
                  border="3px solid"
                  borderColor={dark ? "rgba(255,255,255,0.18)" : "rgba(0,87,184,0.18)"}
                  boxShadow="0 16px 40px rgba(0,0,0,0.45)"
                  transition="transform 0.3s ease, border-color 0.3s ease"
                  _hover={{
                    transform: "scale(1.08)",
                    borderColor: dark ? "rgba(255,255,255,0.55)" : "#0057b8",
                  }}
                  position="relative"
                  bg={dark ? "#0a0f1e" : "#f1f5f9"}
                >
                  <NextImage
                    src={a.src}
                    alt=""
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="120px"
                  />
                </Box>
              </motion.div>
            </motion.div>
          ))}

          {/* Centered headline */}
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            zIndex={2}
            textAlign="center"
            pointerEvents="none"
            w={{ base: "78%", md: "auto" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <Heading
                fontFamily="'DM Sans', sans-serif"
                fontWeight="900"
                fontSize={{ base: "56px", md: "104px", lg: "128px" }}
                letterSpacing="-0.04em"
                lineHeight={1}
                color={textMain}
                style={{ textShadow: dark ? "0 8px 40px rgba(0,87,184,0.55)" : "0 8px 40px rgba(0,87,184,0.25)" }}
              >
                <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">
                  35,000+
                </Box>
              </Heading>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <Text
                mt={{ base: 3, md: 4 }}
                fontSize={{ base: "13px", md: "17px" }}
                color={dark ? "rgba(255,255,255,0.7)" : "#64748b"}
                fontWeight="600"
                letterSpacing="-0.01em"
                maxW={{ base: "260px", md: "420px" }}
                mx="auto"
              >
                {t("socialproof_label")}
              </Text>
            </motion.div>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════
   STAGE OVERLAY (rotating copy + widgets around sticky phone)
   ═════════════════════════════════════════════════════ */

interface Stage {
  eyebrow: string;
  title: string;
  desc: string;
  widget?: React.ReactNode; // optional, no longer required
}

function StageOverlay({
  stages,
}: {
  stages: Stage[];
  progress?: MotionValue<number>;
}) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.6)" : "#64748b";

  const s = stages[0];

  // Layout:
  //   • Mobile (base / sm): title stacked ABOVE phone, live tx feed BELOW phone
  //   • Desktop (md+):      title to the LEFT of phone, live tx feed to the RIGHT
  return (
    <Box
      position="absolute"
      inset={0}
      zIndex={3}
      pointerEvents="none"
    >
      {/* ── MOBILE: title above phone ── */}
      <Box
        display={{ base: "block", md: "none" }}
        position="absolute"
        top={{ base: "90px", sm: "110px" }}
        left={0}
        right={0}
        textAlign="center"
        px={5}
      >
        <Heading
          fontFamily="'DM Sans', sans-serif"
          fontWeight="800"
          fontSize={{ base: "22px", sm: "28px" }}
          letterSpacing="-0.03em"
          color={textMain}
          lineHeight={1.15}
        >
          {s.title}
        </Heading>
      </Box>

      {/* ── MOBILE: live tx feed below phone ── */}
      <Box
        display={{ base: "block", md: "none" }}
        position="absolute"
        bottom={{ base: "20px", sm: "32px" }}
        left={0}
        right={0}
        px={5}
      >
        <LiveTxFeed />
      </Box>

      {/* ── DESKTOP: left text column ── */}
      <Box
        display={{ base: "none", md: "block" }}
        position="absolute"
        top="50%"
        left={{ md: "5%" }}
        transform="translateY(-50%)"
        w={{ md: "28%" }}
        maxW={{ md: "320px", xl: "380px" }}
      >
        <VStack align="start" spacing={5}>
          <Heading
            fontFamily="'DM Sans', sans-serif"
            fontWeight="800"
            fontSize={{ md: "30px", lg: "40px", xl: "52px" }}
            letterSpacing="-0.04em"
            color={textMain}
            lineHeight={1.1}
          >
            {s.title}
          </Heading>
          <Text
            fontSize={{ md: "13px", lg: "15px" }}
            color={textSub}
            lineHeight={1.5}
          >
            {s.desc}
          </Text>
        </VStack>
      </Box>

      {/* ── DESKTOP: right live feed ── */}
      <Box
        display={{ base: "none", md: "block" }}
        position="absolute"
        top="50%"
        right={{ md: "4%" }}
        transform="translateY(-50%)"
        w={{ md: "28%" }}
        maxW={{ md: "260px", xl: "320px" }}
      >
        <LiveTxFeed />
      </Box>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════
   LANDING PAGE
   ═════════════════════════════════════════════════════ */

export default function LandingPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();

  // NOTE: previously used useBreakpointValue for phoneScaleResp — on iOS Safari,
  // the URL bar collapse triggers media query changes which re-fires useBreakpointValue
  // mid-scroll, re-rendering the entire LandingPage tree and causing severe jank in
  // production builds. Switched to pure CSS responsive scale (no JS subscription).

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const glow = dark ? "rgba(0,87,184,0.22)" : "rgba(0,87,184,0.08)";

  const scrollRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: totalProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  // Hero height: desktop 300vh (3 segments), mobile 200vh (2 compressed segments).
  // useScroll travel = (height - viewport). On desktop: 200vh travel, each 100vh = 0.5 progress.
  // On mobile: 100vh travel, so progress moves faster. Adjust timeline for mobile.
  const STAGE_START = 0.45;
  const TILT_END = 0.40; // kept for logoOpacity / stageOverlayOpacity references below

  // Phone fades in from slightly below — pure opacity+translate, compositor-only
  const titleOpacity = useTransform(totalProgress, [0, 0.28, 0.38], [1, 1, 0]);
  const titleY = useTransform(totalProgress, [0, 0.38], [0, -40]);
  const phoneOpacity = useTransform(totalProgress, [0, 0.05], [1, 1]); // always 1
  const phoneY = useTransform(totalProgress, [0, 0.15], [0, 0]);       

  // unlockProgress: 0 = fully locked, 1 = fully unlocked.
  // Bulletproof implementation: a vanilla scroll listener that measures
  // pixel-distance scrolled past the hero's top in viewport pixels.
  // Why not useScroll? In production builds + Chrome mobile inspect, useScroll
  // with `target` and `offset` was returning stale/clamped values causing the
  // lock to "stop midway". Measuring with getBoundingClientRect on every scroll
  // tick is dead-simple and works on every browser.
  const unlockProgress = useMotionValue(0);
  const stageOverlayOpacity = useMotionValue(0);

  useEffect(() => {
    const compute = () => {
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // pixels scrolled past the hero's top (clamped to >= 0)
      const scrolledPast = Math.max(0, -rect.top);
      // Full unlock after just 60px of scroll past hero start
      const u = Math.min(1, scrolledPast / 60);
      unlockProgress.set(u);
      // Stage overlay fades in between 80px and 280px of scroll
      const s = Math.max(0, Math.min(1, (scrolledPast - 80) / 200));
      stageOverlayOpacity.set(s);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [unlockProgress, stageOverlayOpacity]);


  // For StageOverlay, single stage progress is just stageOverlayOpacity — 
  // pass a static MotionValue since there's only one stage now
  const staticProgress = useTransform(totalProgress, [0], [0]); // always 0

  // Removed phoneParallaxY — subtle parallax effect that added scroll cost without visible benefit

  useEffect(() => {
    fetchUser();
  }, []);

  // Removed snap-landing class — scroll-snap was fighting with smooth scroll-driven animations,
  // causing jank on mobile. Hero now scrolls freely without forced snapping.

  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 95%, rgba(255,255,255,0.4) 100%)"
    : "linear(to-b, #0057b8 0%, #bbbbbb 95%, rgba(10,15,30,0.35) 100%)";

  const stages: Stage[] = [
    {
      eyebrow: t("feat_dashboard_eyebrow"),
      title: t("feat_dashboard_title"),
      desc: t("feat_dashboard_desc"),
      widget: null, // no longer used
    },
  ];

  // ✅ SAFE: all hooks already ran
  if (isLoading) return null;

  if (isAuthenticated) {
    return (
      <>
        <PublicNav />
        <AuthenticatedHome />
      </>
    );
  }

  return (
    <Box minH="100vh" overflowX="clip" color={textMain}>
      <PublicNav />
{/* 
      <motion.div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
        }}
      >
        <BackgroundPaths />
      </motion.div> */} 

      {/* ══ HERO + STICKY STAGES (one phone — unlocks & cycles) ══
           Desktop: 300vh = 3 × 100vh (intro + 2 stages).
           Mobile: 200vh to reduce scroll distance and lag (intro + 2 stages compressed).
           P2P / Handles / Cards now live in dedicated alternating sections below. */}
      <Box
        ref={scrollRef}
        id="features"
        position="relative"
        h={{ base: "200vh", md: "300vh" }}
        className="snap-none"
      >
        <Box position="sticky" top={0} h="100vh" overflow="hidden">

          {/* Hero title (fades out as phone uprights) */}
          <motion.div
            style={{
              opacity: titleOpacity,
              y: titleY,
              position: "absolute",
              top: -25,
              left: 0,
              right: 0,
              paddingTop: "120px",
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <Container maxW="1200px" position="relative">
              
              <VStack spacing={1}>
                <Heading
                  as="h1"
                  fontFamily="'DM Sans', sans-serif"
                  fontWeight="900"
                  fontSize={{ base: "28px", sm: "34px", md: "44px", xl: "52px" }}
                  letterSpacing="-0.05em"
                  bgGradient={titleGradient}
                  bgClip="text"
                  color="transparent"
                  whiteSpace="nowrap"
                >
                  {t("hero_line1")} {t("hero_line2")}
                </Heading>
              </VStack>
            </Container>
          </motion.div>

          {/* Single phone — tilts back→upright on desktop, static on mobile */}
          <Flex
            position="absolute"
            inset={0}
            align="center"
            justify="center"
            zIndex={2}
            pointerEvents="none"
          >
            <motion.div
              style={{
                opacity: phoneOpacity,
                y: phoneY,
                willChange: "opacity, transform",
              }}
            >
              {/* CSS-only responsive scale wrapper — replaces useBreakpointValue.
                  No JS subscription = no re-render on iOS Safari URL-bar resize. */}
              <Box
                transform={{
                  base: "scale(0.5)",
                  sm: "scale(0.6)",
                  md: "scale(0.72)",
                  lg: "scale(0.82)",
                  xl: "scale(0.92)",
                }}
                transformOrigin="center center"
                style={{ willChange: "transform" }}
              >
                <PhoneFrame
                  progress={staticProgress}
                  unlockProgress={unlockProgress}
                />
              </Box>
            </motion.div>
          </Flex>

          {/* Stage copy + widgets — fade in once the phone is upright/unlocked */}
          <motion.div style={{ opacity: stageOverlayOpacity, position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
            <StageOverlay stages={stages} progress={staticProgress}/>
          </motion.div>
        </Box>
      </Box>


      {/* ══ CONNECTED — text only; arches now live behind the CTA + footer ══ */}
      <Box className="snap-section" id="connect" py={{ base: 16, md: 24 }} position="relative" minH="100vh" display="flex" alignItems="center">
        {/* Background hero video — only plays when section is on-screen (saves mobile GPU/battery) */}
          <Box
            position="absolute"
            inset={0}
            zIndex={0}
            pointerEvents="none"
            style={{
              maskImage: "radial-gradient(ellipse at center, black 1%, transparent 60%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 15%, transparent 60%)",
            }}
          >
            <LazyBackgroundVideo
              src="/videos/WebHeader.mp4"
              opacity={0.95}
            />
            <Box
              position="absolute"
              inset={0}
              bg={dark
                ? "radial-gradient(ellipse at center, rgba(10,15,30,0) 0%, rgba(10,15,30,0.55) 70%, rgba(10,15,30,0.95) 100%)"
                : "radial-gradient(ellipse at center, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0.95) 100%)"}
            />
          </Box>
        <VStack position="relative" zIndex={20} spacing={8} maxW="720px" mx="auto" textAlign="center" px={6}>
          <Box p={6} borderColor={cardBorder} >
            <NextImage src={"/icon-black.png"} alt="Gif" width={60} height={60} />
          </Box>
          <Heading fontSize={{ base: "36px", md: "64px" }} fontWeight="800" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif" color={textMain}>
            {t("connect_title_1")}{" "}
            <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">{t("connect_title_2")}</Box>
          </Heading>
          <HStack spacing={3} flexWrap="wrap" justify="center" pt={2}>
            {[
              { icon: FiZap, label: t("connect_pill_speed") },
              { icon: FiGlobe, label: t("connect_pill_access") },
              { icon: FiShield, label: t("connect_pill_security") },
            ].map((p, i) => (
              <HStack key={i} bg={dark ? "rgba(0,0,0,0.4)" : "white"} border="1px solid" borderColor={cardBorder} px={4} py={2.5} borderRadius="full">
                <Icon as={p.icon} color={BRAND_LIGHT} boxSize={4} />
                <Text fontSize="13px" color={textMain} fontWeight="700">{p.label}</Text>
              </HStack>
            ))}
          </HStack>
        </VStack>
      </Box>
      
      {/* ══ BENTO GRID — flex stats & features ══ */}
      <SectionBento />

      {/* ══ ONRAMP (Buy / Sell / Send) — MoonPay-style videos ══ */}
      <SectionOnRamp />

      {/* ══ SOCIAL PROOF — stat + photo collage ══ */}
      <SectionSocialProof />

      {/* ══ SOCIAL PAYMENTS SECTION (text left / phone right) ══ */}
      <SectionSocialFinance />

      {/* ══ STAGE 3 — P2P MARKETPLACE (phone left / text right) ══ */}
      <AlternatingFeatureSection
        imageSide="left"
        eyebrow={t("feat_p2p_eyebrow")}
        title={t("feat_p2p_title")}
        desc={t("feat_p2p_desc")}
        features={[
          { icon: FiGlobe,   label: "120+ countries" },
          { icon: FiShield,  label: "Escrow protected" },
          { icon: FiUsers,   label: "Verified traders" },
          { icon: FiZap,     label: "Instant settle" },
        ]}
        phoneScreen={<ScreenP2P />}
      />

      {/* ══ STAGE 4 — SOCIAL WALLET / @HANDLES (phone right / text left) ══ */}
      <AlternatingFeatureSection
        imageSide="right"
        eyebrow={t("feat_wallet_eyebrow")}
        title={t("feat_wallet_title")}
        desc={t("feat_wallet_desc")}
        features={[
          { icon: FiAtSign,  label: "Personal @handle" },
          { icon: FiSend,    label: "One-tap send" },
          { icon: FiUsers,   label: "Friends list" },
          { icon: FiLock,    label: "Privacy first" },
        ]}
        phoneScreen={<ScreenSocialWallet />}
      />

      {/* ══ STAGE 5 — VISA CARD (phone left / text right) ══ */}
      <AlternatingFeatureSection
        imageSide="left"
        eyebrow={t("feat_card_eyebrow")}
        title={t("feat_card_title")}
        desc={t("feat_card_desc")}
        comingSoon
        features={[]}
        phoneScreen={<ScreenCard />}
        extraBelow={
          <Box
            position="relative"
            w="100%"
            style={{ aspectRatio: "1024 / 720" }}
          >
            <NextImage
              src="/visa.png"
              alt="promrkts Visa cards — Starter, Master, Pro"
              fill
              sizes="(max-width: 768px) 90vw, 460px"
              style={{ objectFit: "contain" }}
            />
          </Box>
        }
      />

      {/* ══ CTA + FOOTER (with electrified arches behind) ══ */}
      <Box position="relative" overflow="hidden">
        {/* Electric arches — pulse + traveling spark */}
        <Box position="absolute" inset={0} pointerEvents="none" aria-hidden="true">
          <Box
            position="absolute"
            top="75%"
            left="50%"
            transform="translate(-50%, -50%)"
            w="100%"
            h="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {/* Top arc — static dim base */}
            <Box
              position="absolute"
              top="0"
              left="50%"
              w="1600px"
              h="1600px"
              borderRadius="full"
              border="1.5px solid rgba(0,87,184,0.4)"
              style={{
                transform: "translate(-50%, 0)",
                clipPath: "inset(0 0 50% 0)",
                boxShadow: "0 0 40px rgba(0,87,184,0.35)",
              }}
            />
            {/* Top arc — bright pulse layer (animated opacity only — composited, no paint) */}
            <motion.div
              animate={{ opacity: [0.2, 0.95, 0.2] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                top: "0",
                left: "50%",
                width: "1600px",
                height: "1600px",
                transform: "translate(-50%, 0)",
                border: "1.5px solid rgba(74,143,224,0.95)",
                borderRadius: "50%",
                clipPath: "inset(0 0 50% 0)",
                boxShadow: "0 0 90px rgba(0,87,184,0.85)",
                willChange: "opacity",
              }}
            />
          </Box>
        </Box>

      {/* ══ CTA ══ */}
      <Box className="snap-section" id="cta" position="relative" zIndex={1} py={{ base: 16, md: 28 }} px={{ base: 6, md: 12 }} minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <Box
          maxW="1100px"
          mx="auto"
          borderRadius="40px"
          overflow="hidden"
          position="relative"
          bg="linear-gradient(135deg, #0057b8 0%, #001a3d 100%)"
          p={{ base: 10, md: 20 }}
          textAlign="center"
          boxShadow="0 40px 100px rgba(0,87,184,0.3)"
        >
          <Box position="absolute" inset={0} opacity={0.08} backgroundImage="radial-gradient(circle at 2px 2px, white 2px, transparent 0)" backgroundSize="36px 36px" pointerEvents="none" />
          <VStack spacing={7} position="relative" zIndex={2}>
            <Heading fontSize={{ base: "36px", md: "64px" }} fontWeight="800" color="white" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif">
              {t("cta_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "19px" }} color="rgba(255,255,255,0.85)" maxW="520px">
              {t("cta_sub")}
            </Text>
            <Button
              as={NextLink}
              href="/register"
              h="60px"
              px={12}
              bg="white"
              color={BRAND}
              borderRadius="18px"
              fontWeight="800"
              fontSize="15px"
              rightIcon={<Icon as={FiArrowRight} boxSize={5} />}
              _hover={{ transform: "scale(1.04)", boxShadow: "0 16px 40px rgba(255,255,255,0.25)" }}
              transition="all 0.2s"
            >
              {t("cta_btn")}
            </Button>
          </VStack>
        </Box>
      </Box>

        <Box position="relative" zIndex={1}>
          <PublicFooter />
        </Box>
      </Box>
    </Box>
  );
}
