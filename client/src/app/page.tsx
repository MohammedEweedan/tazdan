"use client";

import { useRef, useEffect, useState, memo, useMemo } from "react";
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
import AuthenticatedHome from "@/components/ui/AuthenticatedHome";
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
} from "react-icons/fi";
import { motion, useScroll, useTransform, MotionValue, AnimatePresence, useMotionValueEvent } from "framer-motion";
import { IconLogo } from "@/components/ui/Logo";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { BackgroundPaths } from "@/components/ui/Paths";

/* iPhone frame geometry */
const PHONE_W = 340;
const PHONE_H = 690;
const SCREEN_INSET = { top: 10, bottom: 10, x: 10 };

const BRAND = "#0057b8";
const BRAND_LIGHT = "#4a8fe0";

/* ═════════════════════════════════════════════════════
   LIVE PRICES (Binance public REST, TradingView-grade data)
   ═════════════════════════════════════════════════════ */

type TickerMap = Record<string, { price: number; change: number }>;

const TRACKED_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT",
];

/* Seed values so first paint is not empty while the request is in-flight */
const SEED_PRICES: TickerMap = {
  BTCUSDT: { price: 114200.2, change: 2.34 },
  ETHUSDT: { price: 4111.02, change: 1.82 },
  SOLUSDT: { price: 162.44, change: 5.12 },
  BNBUSDT: { price: 612.30, change: -0.42 },
  XRPUSDT: { price: 0.612, change: 0.88 },
  ADAUSDT: { price: 0.445, change: -1.20 },
};

function useLivePrices(symbols: string[] = TRACKED_SYMBOLS, intervalMs = 8000): TickerMap {
  const [prices, setPrices] = useState<TickerMap>(SEED_PRICES);
  useEffect(() => {
    let alive = true;
    const fetchPrices = async () => {
      try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
          JSON.stringify(symbols)
        )}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data: Array<{ symbol: string; lastPrice: string; priceChangePercent: string }> =
          await res.json();
        if (!alive) return;
        const next: TickerMap = {};
        for (const d of data) {
          next[d.symbol] = {
            price: parseFloat(d.lastPrice),
            change: parseFloat(d.priceChangePercent),
          };
        }
        setPrices((prev) => ({ ...prev, ...next }));
      } catch {
        /* network/CORS error — keep last-good state */
      }
    };
    fetchPrices();
    const id = setInterval(fetchPrices, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [symbols.join(","), intervalMs]);
  return prices;
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function fmtChange(n: number): string {
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

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

/* ── Brand logo screen (first state of the sticky-scroll phone) ── */
const ScreenLogo = memo(function ScreenLogo() {
  const { t } = useTranslate();
  return (
    <VStack
      h="100%"
      w="100%"
      bg="linear-gradient(180deg, #05060c 0%, #0a1024 55%, #0b2260 100%)"
      align="center"
      justify="center"
      spacing={5}
      position="relative"
      overflow="hidden"
    >
      {/* ambient glow behind logo */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w="110%"
        h="60%"
        bg="radial-gradient(ellipse, rgba(74,143,224,0.45) 0%, rgba(0,87,184,0.15) 40%, transparent 70%)"
        filter="blur(40px)"
        pointerEvents="none"
      />
      <Box position="relative" w="140px" h="140px" zIndex={2}>
        <NextImage 
          src="/icon.gif" 
          alt="promrkts" 
          fill 
          priority 
          sizes="140px"
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          style={{ objectFit: "contain" }} 
        />
      </Box>
    </VStack>
  );
});

function ScreenSpot() {
  const { t } = useTranslate();
  const prices = useLivePrices();
  const btc = prices.BTCUSDT ?? SEED_PRICES.BTCUSDT;
  const up = btc.change >= 0;
  const ranges = ["1H", "1D", "1W", "1M", "1Y"];
  return (
    <VStack h="100%" w="100%" p={5} align="stretch" spacing={3} bg="#000">
      <HStack justify="space-between" pt={8}>
        <HStack spacing={2}>
          <Flex w="28px" h="28px" borderRadius="full" bg="#f7931a22" border="1px solid #f7931a55" align="center" justify="center">
            <Text fontSize="11px" fontWeight="900" color="#f7931a">₿</Text>
          </Flex>
          <VStack align="start" spacing={0}>
            <Text fontSize="12px" color="white" fontWeight="800">BTC/USDT</Text>
            <Text fontSize="8px" color="rgba(255,255,255,0.4)">{t("screen_spot_spot")}</Text>
          </VStack>
        </HStack>
        <Badge
          bg={up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}
          color={up ? "#22c55e" : "#ef4444"}
          px={2}
          py={1}
          borderRadius="full"
          fontSize="9px"
          fontWeight="800"
        >
          {fmtChange(btc.change)}
        </Badge>
      </HStack>
      <VStack align="start" spacing={0}>
        <Heading color="white" fontFamily="'DM Sans', sans-serif" fontWeight="700" fontSize="30px" letterSpacing="-0.03em">
          ${fmtPrice(btc.price)}
        </Heading>
        <Text fontSize="10px" color="rgba(255,255,255,0.45)">
          {t("screen_spot_last_24h")} · {up ? "+" : ""}
          {(btc.price * (btc.change / 100)).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT
        </Text>
      </VStack>
      {/* Line chart (no order book) */}
      <MiniChart up={up} height={150} />
      {/* Range selector */}
      <HStack bg="rgba(255,255,255,0.04)" borderRadius="10px" p={1}>
        {ranges.map((r, i) => (
          <Box key={r} flex={1} py={1.5} textAlign="center" bg={i === 1 ? BRAND : "transparent"} borderRadius="8px">
            <Text fontSize="10px" fontWeight="700" color={i === 1 ? "white" : "rgba(255,255,255,0.5)"}>{r}</Text>
          </Box>
        ))}
      </HStack>
      <Box flex={1} />
      <HStack spacing={2}>
        <Button flex={1} h="40px" bg="#22c55e" color="white" borderRadius="12px" fontSize="12px" fontWeight="800">{t("screen_spot_buy")}</Button>
        <Button flex={1} h="40px" bg="#ef4444" color="white" borderRadius="12px" fontSize="12px" fontWeight="800">{t("screen_spot_sell")}</Button>
      </HStack>
    </VStack>
  );
}

function ScreenMarkets() {
  const { t } = useTranslate();
  const live = useLivePrices();
  const meta = [
    { sym: "BTC", k: "BTCUSDT", name: "Bitcoin", c: "#f7931a" },
    { sym: "ETH", k: "ETHUSDT", name: "Ethereum", c: "#627eea" },
    { sym: "SOL", k: "SOLUSDT", name: "Solana", c: "#14f195" },
    { sym: "BNB", k: "BNBUSDT", name: "BNB", c: "#f3ba2f" },
    { sym: "XRP", k: "XRPUSDT", name: "XRP", c: "#23292f" },
    { sym: "ADA", k: "ADAUSDT", name: "Cardano", c: "#0033ad" },
  ];
  const coins = meta.map((m) => {
    const p = live[m.k] ?? SEED_PRICES[m.k];
    return {
      sym: m.sym,
      name: m.name,
      c: m.c,
      price: fmtPrice(p.price),
      chg: fmtChange(p.change),
      up: p.change >= 0,
    };
  });
  return (
    <VStack h="100%" w="100%" p={5} align="stretch" spacing={3} bg="#000">
      <HStack pt={8}>
        <Text fontSize="14px" color="white" fontWeight="800" flex={1}>{t("screen_markets_title")}</Text>
        <Badge bg="rgba(34,197,94,0.15)" color="#22c55e" px={2} py={0.5} borderRadius="full" fontSize="8px" fontWeight="800">● {t("screen_markets_live")}</Badge>
      </HStack>
      <HStack bg="rgba(255,255,255,0.04)" borderRadius="10px" p={1}>
        {["All", "Gainers", "New"].map((tab, i) => (
          <Box key={tab} flex={1} py={1.5} textAlign="center" bg={i === 0 ? BRAND : "transparent"} borderRadius="8px">
            <Text fontSize="10px" fontWeight="700" color={i === 0 ? "white" : "rgba(255,255,255,0.5)"}>{tab}</Text>
          </Box>
        ))}
      </HStack>
      <VStack align="stretch" spacing={1.5} flex={1} overflow="hidden">
        {coins.map((c) => (
          <HStack key={c.sym} bg="rgba(255,255,255,0.03)" p={2.5} borderRadius="12px" border="1px solid rgba(255,255,255,0.05)">
            <Flex w="28px" h="28px" borderRadius="full" bg={`${c.c}22`} border={`1px solid ${c.c}55`} align="center" justify="center" flexShrink={0}>
              <Text fontSize="10px" fontWeight="800" color={c.c}>{c.sym[0]}</Text>
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="11px" color="white" fontWeight="700">{c.sym}</Text>
              <Text fontSize="8px" color="rgba(255,255,255,0.4)">{c.name}</Text>
            </VStack>
            <VStack align="end" spacing={0}>
              <Text fontSize="11px" color="white" fontWeight="700" fontFamily="monospace">${c.price}</Text>
              <Text fontSize="9px" color={c.up ? "#22c55e" : "#ef4444"} fontWeight="700">{c.chg}</Text>
            </VStack>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

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

function ScreenMint() {
  const { t } = useTranslate();
  return (
    <VStack h="100%" w="100%" p={5} align="stretch" spacing={3} bg="#000">
      <HStack pt={6}>
        <Text fontSize="14px" color="white" fontWeight="800" flex={1} textAlign="center">{t("screen_mint_title")}</Text>
      </HStack>
      <Box
        borderRadius="18px"
        p={4}
        bg="linear-gradient(135deg, #0057b8 0%, #1e63b2 100%)"
        position="relative"
        overflow="hidden"
      >
        <HStack>
          <Flex w="40px" h="40px" borderRadius="full" bg="rgba(255,255,255,0.2)" align="center" justify="center">
            <Text fontSize="20px">🚀</Text>
          </Flex>
          <VStack align="start" spacing={0}>
            <Text fontSize="13px" color="white" fontWeight="800">MOON</Text>
            <Text fontSize="9px" color="rgba(255,255,255,0.7)">MoonCoin · BNB Chain</Text>
          </VStack>
        </HStack>
        <HStack mt={3} spacing={3}>
          <VStack align="start" spacing={0}>
            <Text fontSize="8px" color="rgba(255,255,255,0.6)" letterSpacing="0.1em">{t("screen_mint_supply")}</Text>
            <Text fontSize="11px" color="white" fontWeight="800">1,000,000,000</Text>
          </VStack>
          <VStack align="start" spacing={0}>
            <Text fontSize="8px" color="rgba(255,255,255,0.6)" letterSpacing="0.1em">{t("screen_mint_decimals")}</Text>
            <Text fontSize="11px" color="white" fontWeight="800">18</Text>
          </VStack>
        </HStack>
      </Box>
      <Text fontSize="9px" color="rgba(255,255,255,0.4)" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase">
        {t("screen_mint_chain")}
      </Text>
      <SimpleGrid columns={4} spacing={1.5}>
        {[
          { n: "BNB", c: "#f3ba2f", active: true },
          { n: "ETH", c: "#627eea" },
          { n: "SOL", c: "#14f195" },
          { n: "AVAX", c: "#e84142" },
        ].map((c) => (
          <VStack
            key={c.n}
            py={2}
            spacing={0.5}
            borderRadius="10px"
            bg={c.active ? `${c.c}22` : "rgba(255,255,255,0.03)"}
            border="1px solid"
            borderColor={c.active ? `${c.c}66` : "rgba(255,255,255,0.06)"}
          >
            <Box w="14px" h="14px" borderRadius="full" bg={c.c} />
            <Text fontSize="9px" color="white" fontWeight="700">{c.n}</Text>
          </VStack>
        ))}
      </SimpleGrid>
      <Box flex={1} />
      <VStack align="stretch" spacing={1.5} bg="rgba(255,255,255,0.03)" p={3} borderRadius="12px">
        <HStack justify="space-between">
          <Text fontSize="10px" color="rgba(255,255,255,0.5)">{t("screen_mint_fee")}</Text>
          <Text fontSize="10px" color="white" fontWeight="700" fontFamily="monospace">25 USDT</Text>
        </HStack>
        <HStack justify="space-between">
          <Text fontSize="10px" color="rgba(255,255,255,0.5)">{t("screen_mint_gas")}</Text>
          <Text fontSize="10px" color="white" fontWeight="700" fontFamily="monospace">~$0.08</Text>
        </HStack>
      </VStack>
      <Button h="38px" bg={BRAND} color="white" borderRadius="12px" fontSize="12px" fontWeight="800">
        {t("screen_mint_deploy")}
      </Button>
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
            <Text fontSize="12px" color="white" fontWeight="900" letterSpacing="0.06em">
              promrkts
            </Text>
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

const PHONE_SCREENS = [
  <ScreenSpot key="0" />,
  <ScreenMarkets key="1" />,
  <ScreenP2P key="2" />,
  <ScreenSocialWallet key="3" />,
  <ScreenCard key="4" />,
  <ScreenMint key="5" />,
];


/* ═════════════════════════════════════════════════════
   PHONE FRAME (crossfade across 6 screens)
   ═════════════════════════════════════════════════════ */

function PhoneFrame({
  progress,
  scale = 1,
  logoOpacity,
}: {
  progress: MotionValue<number>;
  scale?: number;
  logoOpacity?: MotionValue<number>;
}) {
  /* 6 equal slices of [0,1], ~0.167 each, with 0.03 crossfade */
  const opacities = [
    useTransform(progress, [0.0, 0.03, 0.137, 0.167], [1, 1, 1, 0]),
    useTransform(progress, [0.137, 0.167, 0.303, 0.333], [0, 1, 1, 0]),
    useTransform(progress, [0.303, 0.333, 0.470, 0.500], [0, 1, 1, 0]),
    useTransform(progress, [0.470, 0.500, 0.637, 0.667], [0, 1, 1, 0]),
    useTransform(progress, [0.637, 0.667, 0.803, 0.833], [0, 1, 1, 0]),
    useTransform(progress, [0.803, 0.833, 0.970, 1.0], [0, 1, 1, 1]),
  ];
  return (
    <Box
      position="relative"
      w={`${PHONE_W}px`}
      h={`${PHONE_H}px`}
      mx="auto"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        filter: "drop-shadow(0 40px 100px rgba(0,87,184,0.4))",
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
      >
        {PHONE_SCREENS.map((s, i) => (
          <motion.div key={i} style={{ position: "absolute", inset: 0, opacity: opacities[i] }}>
            {s}
          </motion.div>
        ))}
        {/* Logo "home/lock" screen on top — driven by logoOpacity; fades to reveal the app */}
        {logoOpacity && (
          <motion.div
            style={{ position: "absolute", inset: 0, opacity: logoOpacity, zIndex: 5 }}
          >
            <ScreenLogo />
          </motion.div>
        )}
      </Box>
      <NextImage 
        src="/iphone-frame.png" 
        alt="" 
        fill 
        priority 
        sizes="100vw"
        placeholder="blur"
        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        style={{ objectFit: "contain", pointerEvents: "none", zIndex: 10 }} 
      />
    </Box>
  );
}

/* ═════════════════════════════════════════════════════
   RIGHT-SIDE STAGE WIDGETS
   ═════════════════════════════════════════════════════ */

const StageSpot = memo(function StageSpot() {
  const { t } = useTranslate();
  const live = useLivePrices();
  const btc = live.BTCUSDT ?? SEED_PRICES.BTCUSDT;
  const up = btc.change >= 0;
  const stroke = up ? "#22c55e" : "#ef4444";
  return (
    <Box
      w={{ base: "260px", md: "320px" }}
      p={5}
      borderRadius="24px"
      border="1px solid rgba(0,87,184,0.3)"
      backdropFilter="blur(16px)"
      boxShadow="0 20px 60px rgba(0,87,184,0.25)"
    >
      <HStack mb={3}>
        <Flex w="32px" h="32px" borderRadius="full" border="1px solid #f7931a55" align="center" justify="center">
          <Text fontSize="13px" color="#f7931a" fontWeight="900">₿</Text>
        </Flex>
        <VStack align="start" spacing={0}>
          <Text fontSize="13px" fontWeight="800">BTC/USDT</Text>
          <Text fontSize="10px" opacity={0.6}>{t("stage_spot_spot_market")}</Text>
        </VStack>
        <Box flex={1} />
        <Badge bg={up ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"} color={stroke} px={2.5} py={1} borderRadius="full" fontSize="10px" fontWeight="800">
          {fmtChange(btc.change)}
        </Badge>
      </HStack>
      <Heading fontWeight="700" fontSize={{ base: "28px", md: "34px" }} letterSpacing="-0.03em" fontFamily="'DM Sans', sans-serif">
        ${fmtPrice(btc.price)}
      </Heading>
      {/* mini-sparkline */}
      <Box h="56px" mt={2} position="relative">
        <svg viewBox="0 0 200 60" width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 45 L20 40 L40 48 L60 32 L80 36 L100 22 L120 26 L140 14 L160 18 L180 8 L200 12 L200 60 L0 60 Z" fill="url(#sparkfill)" />
          <path d="M0 45 L20 40 L40 48 L60 32 L80 36 L100 22 L120 26 L140 14 L160 18 L180 8 L200 12" stroke={stroke} strokeWidth="2" fill="none" />
        </svg>
      </Box>
      <HStack mt={3} spacing={2}>
        <Button flex={1} h="36px" bg="#22c55e" color="white" borderRadius="10px" fontSize="12px" fontWeight="800">{t("stage_spot_buy")}</Button>
        <Button flex={1} h="36px" bg="rgba(239,68,68,0.15)" color="#ef4444" border="1px solid rgba(239,68,68,0.3)" borderRadius="10px" fontSize="12px" fontWeight="800">{t("stage_spot_sell")}</Button>
      </HStack>
    </Box>
  );
});

const StageMarkets = memo(function StageMarkets() {
  const live = useLivePrices();
  const meta = [
    { sym: "BTC", k: "BTCUSDT", n: "Bitcoin", c: "#f7931a" },
    { sym: "ETH", k: "ETHUSDT", n: "Ethereum", c: "#627eea" },
    { sym: "SOL", k: "SOLUSDT", n: "Solana", c: "#14f195" },
    { sym: "BNB", k: "BNBUSDT", n: "BNB", c: "#f3ba2f" },
  ];
  const rows = meta.map((m) => {
    const p = live[m.k] ?? SEED_PRICES[m.k];
    return {
      sym: m.sym,
      n: m.n,
      c: m.c,
      p: fmtPrice(p.price),
      chg: fmtChange(p.change),
      up: p.change >= 0,
    };
  });
  return (
    <VStack w={{ base: "260px", md: "320px" }} spacing={2} align="stretch">
      {rows.map((r, i) => (
        <HStack
          key={r.sym}
          p={3}
          borderRadius="16px"
          bg="rgba(255,255,255,0.04)"
          border="1px solid rgba(255,255,255,0.08)"
          backdropFilter="blur(14px)"
          boxShadow="0 8px 24px rgba(0,0,0,0.25)"
          style={{ transform: `translateX(${i % 2 === 0 ? -8 : 8}px)` }}
        >
          <Flex w="30px" h="30px" borderRadius="full" bg={`${r.c}22`} border={`1px solid ${r.c}55`} align="center" justify="center" flexShrink={0}>
            <Text fontSize="11px" fontWeight="800" color={r.c}>{r.sym[0]}</Text>
          </Flex>
          <VStack align="start" spacing={0} flex={1}>
            <Text fontSize="12px" fontWeight="800">{r.sym}/USDT</Text>
            <Text fontSize="10px" opacity={0.55}>{r.n}</Text>
          </VStack>
          <VStack align="end" spacing={0}>
            <Text fontSize="12px" fontWeight="800" fontFamily="monospace">${r.p}</Text>
            <HStack spacing={1}>
              <Icon as={r.up ? FiTrendingUp : FiTrendingDown} boxSize={3} color={r.up ? "#22c55e" : "#ef4444"} />
              <Text fontSize="10px" color={r.up ? "#22c55e" : "#ef4444"} fontWeight="700">{r.chg}</Text>
            </HStack>
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
})

const StageP2P = memo(function StageP2P() {
  const { t } = useTranslate();
  const offers = [
    { n: "Rayan G.", flag: "RG", rate: "67,240.50", lim: "100 – 50,000 USD", grad: "linear-gradient(135deg, #facc15, #b45309)" },
    { n: "Ali A.", flag: "AA", rate: "3.67", lim: "114.20 – 41,120 AED", grad: "linear-gradient(135deg, #06b6d4, #0369a1)" },
    { n: "Moe A.", flag: "MA", rate: "3.75", lim: "41.12 – 11,420 SAR", grad: "linear-gradient(135deg, #ec4899, #be185d)" },
  ];
  return (
    <VStack w={{ base: "260px", md: "320px" }} spacing={2.5} align="stretch">
      {offers.map((o, i) => (
        <HStack
          key={i}
          p={3}
          borderRadius="18px"
          bg="rgba(255,255,255,0.04)"
          border="1px solid rgb(31, 77, 169)"
          backdropFilter="blur(14px)"
          boxShadow="0 8px 24px rgba(0,0,0,0.25)"
          style={{ transform: `translateX(${i % 2 === 0 ? -10 : 10}px)` }}
        >
          <Flex w="38px" h="38px" borderRadius="full" bg={o.grad} align="center" justify="center" flexShrink={0} fontSize="16px">
            {o.flag}
          </Flex>
          <VStack align="start" spacing={0} flex={1}>
            <Text fontSize="12px" fontWeight="800">{o.n}</Text>
            <HStack spacing={2}>
              <Text fontSize="10px" fontFamily="monospace">{o.rate}</Text>
              <Text fontSize="10px" opacity={0.5}>·</Text>
              <Text fontSize="10px" opacity={0.65}>{o.lim}</Text>
            </HStack>
          </VStack>
          <Button size="xs" h="26px" bg={BRAND} color="white" borderRadius="8px" fontSize="10px" fontWeight="800" flexShrink={0}>
            {t("stage_p2p_trade")}
          </Button>
        </HStack>
      ))}
    </VStack>
  );
})

const StageMint = memo(function StageMint() {
  const { t } = useTranslate();
  const chains = [
    { n: "BNB", c: "#f3ba2f", angle: 0 },
    { n: "ETH", c: "#627eea", angle: 72 },
    { n: "SOL", c: "#1b563d", angle: 144 },
    { n: "AVAX", c: "#e84142", angle: 216 },
    { n: "MATIC", c: "#0057b8", angle: 288 },
  ];
  const scale = useBreakpointValue({ base: 0.8, md: 1 }) ?? 1;
  const WRAP = 360;
  return (
    <Box position="relative" w={`${WRAP}px`} h={`${WRAP}px`} style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
      <Box
        position="absolute"
        inset={0}
        borderRadius="full"
        bg="radial-gradient(circle, rgba(58, 103, 237, 0.3) 0%, rgba(12, 102, 206, 0.12) 45%, transparent 70%)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        top="50%"
        left="50%"
        w="220px"
        h="220px"
        border="1.5px dashed rgba(58, 127, 237, 0.45)"
        borderRadius="full"
        style={{ transform: "translate(-50%, -50%)" }}
      />
      {/* Chain orbit */}
      {chains.map((c, idx) => {
        const rad = (c.angle * Math.PI) / 180;
        const x = Math.cos(rad) * 140;
        const y = Math.sin(rad) * 140;
        return (
          <motion.div
            key={c.n}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1, y: [y, y - 6, y] }}
            transition={{
              opacity: { duration: 0.8, delay: idx * 0.1 },
              scale: { duration: 0.8, delay: idx * 0.1, type: "spring", stiffness: 40 },
              y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: idx * 0.15 },
            }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              x: x - 28,
              marginTop: -28,
            }}
          >
            <Flex
              w="56px"
              h="56px"
              borderRadius="full"
              bg={`${c.c}22`}
              border={`2px solid ${c.c}77`}
              align="center"
              justify="center"
              boxShadow={`0 8px 22px ${c.c}55`}
              backdropFilter="blur(8px)"
            >
              <Text fontSize="11px" fontWeight="900" color={c.c} letterSpacing="-0.02em">{c.n}</Text>
            </Flex>
          </motion.div>
        );
      })}
    </Box>
  );
});

const StageHandles = memo(function StageHandles() {
  const { t } = useTranslate();
  const rows = [
    { h: "@rayofsunshine", loc: "Tripoli", col: "#facc15" },
    { h: "@noor.dxb", loc: "UAE", col: "#06b6d4" },
    { h: "@layla_k", loc: "KSA", col: "#ec4899" },
    { h: "@ines_casa", loc: "Morocco", col: "#f59e0b" },
  ];
  return (
    <VStack w={{ base: "260px", md: "320px" }} spacing={2.5} align="stretch">
      <Box
        bg="linear-gradient(135deg, rgba(0,87,184,0.25), rgba(124,58,237,0.2))"
        border="1px solid rgba(255,255,255,0.1)"
        borderRadius="20px"
        p={4}
        backdropFilter="blur(14px)"
      >
        <HStack>
          <Flex w="40px" h="40px" borderRadius="full" bg={BRAND} align="center" justify="center">
            <Icon as={FiAtSign} color="white" />
          </Flex>
          <VStack align="start" spacing={0}>
            <Text fontSize="14px" fontWeight="900">@rayofsunshine</Text>
            <Text fontSize="10px" opacity={0.6}>{t("stage_handles_your_tag")}</Text>
          </VStack>
        </HStack>
      </Box>
      {rows.map((r, i) => (
        <HStack
          key={r.h}
          p={2.5}
          borderRadius="14px"
          bg="rgba(255,255,255,0.04)"
          border="1px solid rgba(255,255,255,0.08)"
          backdropFilter="blur(12px)"
          style={{ transform: `translateX(${i % 2 === 0 ? -6 : 6}px)` }}
        >
          <Flex w="28px" h="28px" borderRadius="full" bg={`${r.col}33`} border={`1px solid ${r.col}66`} align="center" justify="center">
            <Icon as={FiAtSign} color={r.col} boxSize={3} />
          </Flex>
          <Text fontSize="12px" fontWeight="700" flex={1}>{r.h}</Text>
          <Text fontSize="10px" opacity={0.6}>{r.loc}</Text>
        </HStack>
      ))}
    </VStack>
  );
})

const StageCards = memo(function StageCards() {
  const { t } = useTranslate();
  const tiers = [
    { n: "Starter", c: "#8ab4f8" },
    { n: "Master", c: "#0057b8" },
    { n: "Pro", c: "#0a0f1e" },
  ];
  return (
    <VStack w={{ base: "280px", md: "380px" }} spacing={4} align="stretch">
      {/* 3-card marketing shot */}
      <Box
        position="relative"
        w="100%"
        style={{ aspectRatio: "1024 / 720" }}
        filter="drop-shadow(0 32px 60px rgba(0,87,184,0.45))"
      >
        <NextImage
          src="/visa.png"
          alt="promrkts Visa cards — Starter, Master, Pro"
          fill
          sizes="380px"
          style={{ objectFit: "contain" }}
          priority
        />
      </Box>
      {/* Tier chips */}
      <HStack spacing={2}>
        {tiers.map((tier) => (
          <HStack
            key={tier.n}
            flex={1}
            bg="rgba(255,255,255,0.05)"
            border="1px solid rgba(255,255,255,0.1)"
            borderRadius="full"
            px={3}
            py={1.5}
            spacing={2}
          >
            <Box w="10px" h="10px" borderRadius="full" bg={tier.c} boxShadow={`0 0 10px ${tier.c}aa`} />
            <Text fontSize="11px" fontWeight="800">{tier.n}</Text>
          </HStack>
        ))}
      </HStack>
      {/* perks row */}
      <HStack spacing={2}>
        {[
          { l: t("screen_card_cashback"), v: "1%", c: "#22c55e" },
          { l: t("stage_card_fx"), v: "0%", c: BRAND_LIGHT },
          { l: t("stage_card_accepted"), v: "200+", c: "#a78bfa" },
        ].map((s) => (
          <VStack
            key={s.l}
            flex={1}
            p={2.5}
            borderRadius="12px"
            bg="rgba(255,255,255,0.04)"
            border="1px solid rgba(255,255,255,0.08)"
            spacing={0}
          >
            <Text fontSize="13px" fontWeight="900" color={s.c} fontFamily="monospace">{s.v}</Text>
            <Text fontSize="9px" opacity={0.7} textAlign="center">{s.l}</Text>
          </VStack>
        ))}
      </HStack>
    </VStack>
  );
});

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
        filter: "drop-shadow(0 40px 100px rgba(0,87,184,0.4))",
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
      >
        {children}
      </Box>
      <NextImage 
        src="/iphone-frame.png" 
        alt="" 
        fill 
        priority 
        sizes="100vw"
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

/* ── Balance-home screen (Pay / Transfer / Invest) ── */
function PhoneBalanceScreen() {
  const { t } = useTranslate();
  return (
    <VStack h="100%" w="100%" align="stretch" p={6} spacing={3}>
      <HStack pt={8}>
        <Box w="18px" h="14px" bg="rgba(255,255,255,0.12)" borderRadius="3px" />
        <Box flex={1} />
        <HStack spacing={1.5}>
          <Box w="6px" h="6px" bg="rgba(255,255,255,0.6)" borderRadius="full" />
          <Box w="6px" h="6px" bg="rgba(255,255,255,0.6)" borderRadius="full" />
        </HStack>
      </HStack>
      <Text fontSize="11.5px" color="rgba(255,255,255,0.55)" fontWeight="600" textAlign="center">
        {t("sec_pay_home_title")}
      </Text>
      <HStack justify="center" align="baseline" spacing={2}>
        <Text fontSize="13px" color="rgba(255,255,255,0.6)" fontWeight="700" letterSpacing="0.12em">USDT</Text>
        <Heading color="white" fontSize="46px" fontWeight="800" letterSpacing="-0.035em" fontFamily="'DM Sans', sans-serif">
          41,120
        </Heading>
        <Text fontSize="16px" color="rgba(255,255,255,0.7)" fontWeight="700">.02</Text>
      </HStack>
      <Flex justify="center">
        <Box bg="rgba(255,255,255,0.08)" border="1px solid rgba(255,255,255,0.1)" px={3} py={1} borderRadius="full">
          <Text fontSize="10px" color="rgba(255,255,255,0.75)" fontWeight="700" letterSpacing="0.08em">USDT · AED · SAR</Text>
        </Box>
      </Flex>
      <SimpleGrid columns={3} spacing={3} pt={8}>
        {[
          { icon: FiArrowDownLeft, label: t("sec_pay_home_deposit") },
          { icon: FiSend, label: t("sec_pay_home_send") },
          { icon: FiArrowUpRight, label: t("sec_pay_home_withdraw") },
        ].map((a) => (
          <VStack key={a.label} spacing={1.5}>
            <Flex w="44px" h="44px" borderRadius="14px" bg="rgba(255,255,255,0.06)" border="1px solid rgba(255,255,255,0.08)" align="center" justify="center">
              <Icon as={a.icon} color="white" boxSize={4} />
            </Flex>
            <Text fontSize="10px" color="rgba(255,255,255,0.7)" fontWeight="600">{a.label}</Text>
          </VStack>
        ))}
      </SimpleGrid>
      <HStack pt={8}>
        <Text fontSize="11px" color="white" fontWeight="700">{t("sec_pay_home_recent")}</Text>
        <Box flex={1} />
        <Text fontSize="10px" color={BRAND_LIGHT} fontWeight="600">{t("sec_pay_home_view_all")}</Text>
      </HStack>
      <VStack align="stretch" spacing={2}>
        {[
          { n: "@rayofsunshine", d: "Today · 11:44 am", amt: "-USDT 11.44", neg: true, ini: "R", grad: "linear-gradient(135deg, #facc15, #f59e0b)" },
          { n: "Bought BTC", d: "Today · 1:11 am", amt: "+114,200.2", neg: false, ini: "₿", grad: "linear-gradient(135deg, #f7931a, #b86508)" },
          { n: "Bought ETH", d: "Today · 4:44 am", amt: "+4,111.02", neg: false, ini: "Ξ", grad: "linear-gradient(135deg, #627eea, #3b5ac9)" },
        ].map((r) => (
          <HStack key={r.n} bg="rgba(255,255,255,0.03)" p={2.5} borderRadius="12px" border="1px solid rgba(255,255,255,0.05)">
            <Flex w="32px" h="32px" borderRadius="full" bg={r.grad} align="center" justify="center">
              <Text fontSize="11px" color="white" fontWeight="800">{r.ini}</Text>
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="11px" color="white" fontWeight="700">{r.n}</Text>
              <Text fontSize="9px" color="rgba(255,255,255,0.4)">{r.d}</Text>
            </VStack>
            <Text fontSize="11px" color={r.neg ? "rgba(255,255,255,0.85)" : "#22c55e"} fontWeight="800" fontFamily="monospace">
              {r.amt}
            </Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

/* ── Social Finance section (phone left / copy right) ── */
function SectionSocialFinance() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.7)" : "#64748b";
  // More opaque backgrounds for better readability
  const cardBg = dark 
    ? "linear-gradient(145deg, rgba(25,35,60,0.95) 0%, rgba(15,25,45,0.98) 100%)" 
    : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)";
  const cardBorder = dark ? "rgba(100,130,200,0.2)" : "rgba(0,87,184,0.15)";
  const chipBg = dark ? "rgba(255,255,255,0.12)" : "rgba(0,87,184,0.06)";
  const phoneScale = useBreakpointValue({ base: 0.55, sm: 0.7, md: 0.85, lg: 0.95 }) ?? 0.9;

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const phoneY = useTransform(scrollYProgress, [0, 1], ["18%", "-18%"]);
  const phoneRotate = useTransform(scrollYProgress, [0, 0.5, 1], [-4, 0, 4]);
  const copyY = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"]);
  const cardY = useTransform(scrollYProgress, [0, 1], ["14%", "-14%"]);

  return (
    <Box ref={sectionRef} position="relative" py={{ base: 16, md: 24 }} px={{ base: 4, md: 10 }} overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={2}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
          <Flex justify="center" order={{ base: 2, lg: 1 }}>
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div style={{ y: phoneY, rotate: phoneRotate, willChange: "transform" }}>
                <Box style={{ transform: `scale(${phoneScale})`, transformOrigin: "center center" }}>
                  <StaticPhone>
                    <PhoneSendScreen />
                  </StaticPhone>
                </Box>
              </motion.div>
            </motion.div>
          </Flex>
          <motion.div style={{ y: copyY }}>
            <VStack align={{ base: "center", lg: "start" }} spacing={{ base: 6, md: 8 }} order={{ base: 1, lg: 2 }} textAlign={{ base: "center", lg: "start" }}>
              <Heading
                fontFamily="'DM Sans', sans-serif"
                fontWeight="800"
                fontSize={{ base: "40px", md: "64px", xl: "80px" }}
                letterSpacing="-0.04em"
              >
                <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">{t("sec_social_title_1")}</Box>
                <br />
                <Box as="span" color={textMain}>{t("sec_social_title_2")}</Box>
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">
                {t("sec_social_desc")}
              </Text>
              <motion.div
                style={{ y: cardY, willChange: "transform", width: "100%", maxWidth: "460px" }}
                initial={{ opacity: 0, y: 40, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <Box
                  w="100%"
                  bg={cardBg}
                  border="1px solid"
                  borderColor={cardBorder}
                  borderRadius="24px"
                  p={6}
                  backdropFilter="blur(14px)"
                  boxShadow={dark ? "0 20px 50px rgba(0,0,0,0.3)" : "0 20px 50px rgba(0,87,184,0.08)"}
                >
                  <HStack align="baseline" spacing={2} mb={4}>
                    <Text fontSize="13px" color={textSub} fontWeight="700" letterSpacing="0.12em">USDT</Text>
                    <Heading color={textMain} fontSize={{ base: "36px", md: "44px" }} fontWeight="800" letterSpacing="-0.03em" fontFamily="'DM Sans', sans-serif">
                      50.00
                    </Heading>
                  </HStack>
                  <HStack
                    bg={chipBg}
                    border="1px solid"
                    borderColor={cardBorder}
                    borderRadius="full"
                    px={4}
                    py={2}
                    spacing={2}
                  >
                    <Text fontSize="13px" color={textSub} flex={1}>
                      {t("sec_social_add_note")}
                    </Text>
                    <Flex
                      w="30px"
                      h="30px"
                      borderRadius="full"
                      bg={dark ? "white" : "#0a0f1e"}
                      color={dark ? "black" : "white"}
                      align="center"
                      justify="center"
                      cursor="pointer"
                      _hover={{ transform: "scale(1.05)" }}
                      transition="transform 0.15s"
                    >
                      <Icon as={FiSend} />
                    </Flex>
                  </HStack>
                </Box>
              </motion.div>
            </VStack>
          </motion.div>
        </SimpleGrid>
      </Container>
    </Box>
  );
}

/* ── Pay / Transfer / Invest section ── */
function SectionPayTransferInvest() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.7)" : "#64748b";
  // Better tile backgrounds with more opacity
  const tileBg = dark 
    ? "linear-gradient(145deg, rgba(25,35,60,0.9) 0%, rgba(15,25,45,0.95) 100%)" 
    : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)";
  const tileBorder = dark ? "rgba(100,130,200,0.2)" : "rgba(0,87,184,0.12)";
  const phoneScale = useBreakpointValue({ base: 0.55, sm: 0.7, md: 0.85, lg: 0.95 }) ?? 0.9;

  const features = [
    { icon: FiWifi, label: t("sec_pay_feat_tap") },
    { icon: FiRepeat, label: t("sec_pay_feat_transfer") },
    { icon: FiPieChart, label: t("sec_pay_feat_invest") },
    { icon: FiHome, label: t("sec_pay_feat_bank") },
  ];

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const phoneY = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"]);
  const phoneRotate = useTransform(scrollYProgress, [0, 0.5, 1], [5, 0, -5]);
  const copyY = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"]);

  return (
    <Box ref={sectionRef} position="relative" py={{ base: 16, md: 24 }} px={{ base: 4, md: 10 }} overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={2}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
          <motion.div style={{ y: copyY }}>
            <VStack align={{ base: "center", lg: "start" }} spacing={{ base: 6, md: 8 }} textAlign={{ base: "center", lg: "start" }}>
              <Heading
                as="h2"
                fontFamily="'DM Sans', sans-serif"
                fontWeight="800"
                fontSize={{ base: "44px", md: "68px", xl: "88px" }}
                letterSpacing="-0.04em"
              >
                {[t("sec_pay_title_1"), t("sec_pay_title_2"), t("sec_pay_title_3")].map((line, i) => (
                  <motion.span
                    key={i}
                    style={{ display: "block" }}
                    initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">{line}</Box>
                  </motion.span>
                ))}
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="420px">
                {t("sec_pay_desc")}
              </Text>
              <SimpleGrid columns={2} spacing={3} w="100%" maxW="420px">
                {features.map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, y: 24, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.55, delay: 0.5 + 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <HStack
                      h="70px"
                      bg={tileBg}
                      border="1px solid"
                      borderColor={tileBorder}
                      borderRadius="18px"
                      px={4}
                      backdropFilter="blur(12px)"
                      spacing={3}
                      transition="all 0.25s ease"
                      _hover={{ transform: "translateY(-3px)", borderColor: "#0057b8", boxShadow: dark ? "0 10px 30px rgba(0,0,0,0.3)" : "0 10px 30px rgba(0,87,184,0.18)" }}
                    >
                      <Flex w="40px" h="40px" borderRadius="12px" border="1px solid rgba(0,87,184,0.25)" align="center" justify="center" flexShrink={0} bg={dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.06)"}>
                        <Icon as={f.icon} color={BRAND_LIGHT} />
                      </Flex>
                      <Text fontSize="13.5px" fontWeight="700" color={textMain}>{f.label}</Text>
                    </HStack>
                  </motion.div>
                ))}
              </SimpleGrid>
            </VStack>
          </motion.div>
          <Flex justify="center">
            <motion.div
              initial={{ opacity: 0, y: 80, scale: 0.88 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div style={{ y: phoneY, rotate: phoneRotate, willChange: "transform" }}>
                <Box style={{ transform: `scale(${phoneScale})`, transformOrigin: "center center" }}>
                  <StaticPhone>
                    <PhoneBalanceScreen />
                  </StaticPhone>
                </Box>
              </motion.div>
            </motion.div>
          </Flex>
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
    { label: t("bento_stat_volume_label"), value: "$80M", sub: "+18.4% " + t("bento_vs_last_month"), icon: FiActivity, span: 2, gradient: "linear-gradient(135deg, #0057b8 0%, #001a3d 100%)", color: "white" },
    { label: t("bento_countries_label"), value: "120+", sub: t("bento_countries_desc"), icon: FiGlobe, span: 1, accent: "#4a8fe0" },
    { label: t("bento_traders_label"), value: "36K", sub: "", icon: FiUsers, span: 1, accent: "#22c55e" },
    { label: t("bento_pairs_label"), value: "400+", sub: "", icon: FiBarChart2, span: 1, accent: "#f59e0b" },
    { label: t("bento_security_title"), value: "", sub: t("bento_security_desc"), icon: FiShield, span: 1, accent: "#a78bfa", bg: dark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.08)", border: "rgba(167,139,250,0.3)" },
    { label: t("bento_speed_title"), value: "<2s", sub: t("bento_speed_desc"), icon: FiZap, span: 1, accent: "#facc15" },
    { label: t("bento_rating_label"), value: "4.9/5", sub: "", icon: FiStar, span: 1, accent: "#f59e0b" },
  ];

  return (
    <Box py={{ base: 16, md: 32 }} px={{ base: 4, md: 10 }} position="relative" overflow="hidden">
      {/* Background glow effect */}
      <Box 
        position="absolute" 
        top="20%" 
        left="50%" 
        transform="translateX(-50%)" 
        w="800px" 
        h="600px" 
        bg={dark ? "rgba(0,87,184,0.08)" : "rgba(0,87,184,0.04)"} 
        filter="blur(120px)" 
        borderRadius="full" 
        pointerEvents="none" 
      />
      
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
                backdropFilter="blur(14px)"
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
                    w="60%" 
                    h="60%" 
                    bg="linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)" 
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
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const methods = ["Apple Pay", "Google Pay", "Visa", "Mastercard", "Revolut", "SEPA", "PayPal"];

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

          {/* Payment methods */}
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.15 }}>
            <HStack spacing={{ base: 4, md: 6 }} flexWrap="wrap" justify="center" opacity={0.7}>
              {methods.map((m) => (
                <Text key={m} fontSize={{ base: "13px", md: "15px" }} fontWeight="700" color={textSub} letterSpacing="-0.01em">{m}</Text>
              ))}
            </HStack>
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
                    bg={dark ? "#0a0f1e" : "#f8f9fc"} 
                    overflow="hidden"
                  >
                    <video
                      src={c.video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </Box>
                  
                  {/* Text content */}
                  <VStack p={{ base: 5, md: 7 }} align="start" spacing={3}>
                    <Heading fontSize={{ base: "20px", md: "24px" }} fontWeight="800" color={textMain} fontFamily="'DM Sans', sans-serif">{c.title}</Heading>
                    <Text fontSize={{ base: "13px", md: "15px" }} color={textSub} lineHeight={1.5}>{c.desc}</Text>
                    <Button
                      variant="ghost"
                      px={0}
                      h="auto"
                      py={1}
                      color={BRAND}
                      fontWeight="800"
                      fontSize="14px"
                      rightIcon={<Icon as={FiArrowRight} boxSize={4} />}
                      _hover={{ bg: "transparent", transform: "translateX(3px)" }}
                      transition="all 0.2s"
                    >
                      {c.cta}
                    </Button>
                  </VStack>
                  
                  {/* Mobile: video at bottom, full width, not background */}
                  <Box 
                    display={{ base: "block", md: "none" }}
                    position="relative" 
                    w="100%" 
                    h="200px"
                    bg={dark ? "#0a0f1e" : "#f8f9fc"} 
                    overflow="hidden"
                    borderTop="1px solid"
                    borderColor={cardBorder}
                  >
                    <video
                      src={c.video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
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
  const textSub = dark ? "rgba(255,255,255,0.5)" : "#64748b";

  // Bigger avatars on desktop
  const avatarBaseSizes = { base: 56, md: 72, lg: 88 };
  const avatars = [
    { src: "/screenshots/p1.avif", pos: { top: "5%", left: "12%" }, mobilePos: { top: "5%", left: "5%" }, sizeScale: 1 },
    { src: "/screenshots/p2.avif", pos: { top: "18%", left: "5%" }, mobilePos: { top: "15%", left: "0%" }, sizeScale: 0.8 },
    { src: "/screenshots/p3.avif", pos: { top: "8%", right: "10%" }, mobilePos: { top: "3%", right: "5%" }, sizeScale: 0.95 },
    { src: "/screenshots/p4.avif", pos: { top: "22%", right: "4%" }, mobilePos: { top: "18%", right: "0%" }, sizeScale: 0.75 },
    { src: "/screenshots/p5.avif", pos: { bottom: "12%", left: "8%" }, mobilePos: { bottom: "10%", left: "3%" }, sizeScale: 0.9 },
    { src: "/screenshots/p6.avif", pos: { bottom: "8%", right: "14%" }, mobilePos: { bottom: "5%", right: "8%" }, sizeScale: 1.1 },
  ];

  return (
    <Box
      position="relative"
      overflow="hidden"
      py={{ base: 20, md: 32 }}
      px={{ base: 4, md: 10 }}
      minH={{ base: "500px", md: "640px" }}
    >

      <Container maxW="1200px" position="relative" zIndex={2}>
        <VStack
          spacing={{ base: 10, md: 12 }}
          align="center"
          textAlign="center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <Heading
              fontFamily="'DM Sans', sans-serif"
              fontWeight="900"
              fontSize={{ base: "64px", md: "96px", lg: "120px" }}
              letterSpacing="-0.04em"
              color="#0057b8"
              lineHeight={1}
              style={{ textShadow: "0 4px 30px rgba(0,0,0,0.4)" }}
            >
              35,000+
            </Heading>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Text
              fontSize={{ base: "16px", md: "20px" }}
              color="#0057b8"
              fontWeight="600"
              letterSpacing="-0.01em"
              style={{ textShadow: "0 2px 16px rgba(0,0,0,0.35)" }}
            >
              {t("socialproof_label")}
            </Text>
          </motion.div>

          {/* Orbiting circular avatars - larger on desktop */}
          <Box
            position="relative"
            w="100%"
            maxW={{ base: "100%", md: "720px" }}
            h={{ base: "400px", md: "380px" }}
            mt={{ base: 6, md: 10 }}
          >
            {avatars.map((a, i) => (
              <motion.div
                key={a.src}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.5,
                  delay: 0.3 + i * 0.1,
                  type: "spring",
                  stiffness: 200,
                }}
              >
                <Box
                  position="absolute"
                  {...(a.mobilePos || a.pos)}
                  w={{
                    base: `${56 * a.sizeScale}px`,
                    md: `${72 * a.sizeScale}px`,
                    lg: `${88 * a.sizeScale}px`,
                  }}
                  h={{
                    base: `${56 * a.sizeScale}px`,
                    md: `${72 * a.sizeScale}px`,
                    lg: `${88 * a.sizeScale}px`,
                  }}
                  borderRadius="full"
                  overflow="hidden"
                  border="3px solid"
                  borderColor="rgba(255,255,255,0.4)"
                  boxShadow="0 12px 40px rgba(0,0,0,0.4)"
                  _hover={{
                    transform: "scale(1.15)",
                    zIndex: 10,
                    borderColor: "rgba(255,255,255,0.8)",
                  }}
                  transition="all 0.3s ease"
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
            ))}
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}

/* ── Token mint screen used by "Mint anything" section ── */
function PhoneMintBuilderScreen() {
  const { t } = useTranslate();
  return (
    <VStack h="100%" w="100%" p={6} align="stretch" spacing={3.5}>
      <HStack pt={8}>
        <Text fontSize="14px" color="rgba(255,255,255,0.55)">←</Text>
        <Text fontSize="14px" color="white" fontWeight="700" flex={1} textAlign="center">{t("sec_mint_screen_title")}</Text>
        <Box w="10px" />
      </HStack>
      {/* Name */}
      <VStack align="stretch" spacing={1}>
        <Text fontSize="10px" color="rgba(255,255,255,0.5)" fontWeight="700" letterSpacing="0.1em">{t("sec_mint_name")}</Text>
        <Box bg="rgba(255,255,255,0.05)" border="1px solid rgba(255,255,255,0.08)" borderRadius="12px" px={3} py={2.5}>
          <Text fontSize="13px" color="white" fontWeight="700">MoonCoin</Text>
        </Box>
      </VStack>
      {/* Symbol */}
      <VStack align="stretch" spacing={1}>
        <Text fontSize="10px" color="rgba(255,255,255,0.5)" fontWeight="700" letterSpacing="0.1em">{t("sec_mint_symbol")}</Text>
        <Box bg="rgba(255,255,255,0.05)" border="1px solid rgba(255,255,255,0.08)" borderRadius="12px" px={3} py={2.5}>
          <Text fontSize="13px" color="white" fontWeight="700" fontFamily="monospace">$MOON</Text>
        </Box>
      </VStack>
      {/* Supply */}
      <VStack align="stretch" spacing={1}>
        <Text fontSize="10px" color="rgba(255,255,255,0.5)" fontWeight="700" letterSpacing="0.1em">{t("sec_mint_total_supply")}</Text>
        <Box bg="rgba(255,255,255,0.05)" border="1px solid rgba(255,255,255,0.08)" borderRadius="12px" px={3} py={2.5}>
          <Text fontSize="13px" color="white" fontWeight="700" fontFamily="monospace">1,000,000,000</Text>
        </Box>
      </VStack>
      {/* Chain select */}
      <VStack align="stretch" spacing={1}>
        <Text fontSize="10px" color="rgba(255,255,255,0.5)" fontWeight="700" letterSpacing="0.1em">{t("sec_mint_chain")}</Text>
        <SimpleGrid columns={4} spacing={1.5}>
          {[
            { n: "BNB", c: "#f3ba2f", active: true },
            { n: "ETH", c: "#627eea" },
            { n: "SOL", c: "#14f195" },
            { n: "AVAX", c: "#e84142" },
          ].map((c) => (
            <VStack
              key={c.n}
              py={2}
              spacing={0.5}
              borderRadius="10px"
              bg={c.active ? `${c.c}22` : "rgba(255,255,255,0.03)"}
              border="1px solid"
              borderColor={c.active ? `${c.c}77` : "rgba(255,255,255,0.06)"}
            >
              <Box w="14px" h="14px" borderRadius="full" bg={c.c} />
              <Text fontSize="9px" color="white" fontWeight="700">{c.n}</Text>
            </VStack>
          ))}
        </SimpleGrid>
      </VStack>
      <Box flex={1} />
      <Button h="42px" bg="white" color="black" borderRadius="12px" fontSize="13px" fontWeight="800" rightIcon={<Icon as={FiZap} />}>
        {t("sec_mint_deploy_btn")}
      </Button>
    </VStack>
  );
}

/* ── Smart contract screen for "Deploy contracts" section ── */
function PhoneContractScreen() {
  const { t } = useTranslate();
  const templates = [
    { icon: FiLock, name: t("sec_contract_tpl_escrow"), desc: t("sec_contract_tpl_escrow_d"), active: true },
    { icon: FiFeather, name: t("sec_contract_tpl_vesting"), desc: t("sec_contract_tpl_vesting_d") },
    { icon: FiUsers, name: t("sec_contract_tpl_multisig"), desc: t("sec_contract_tpl_multisig_d") },
    { icon: FiBox, name: t("sec_contract_tpl_lock"), desc: t("sec_contract_tpl_lock_d") },
  ];
  return (
    <VStack h="100%" w="100%" p={6} align="stretch" spacing={3}>
      <HStack pt={8}>
        <Text fontSize="14px" color="rgba(255,255,255,0.55)">←</Text>
        <Text fontSize="14px" color="white" fontWeight="700" flex={1} p={2} textAlign="center">{t("sec_contract_screen_title")}</Text>
        <Box w="10px" />
      </HStack>
      <Text fontSize="10px" color="rgba(255,255,255,0.45)" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase">
        {t("sec_contract_choose")}
      </Text>
      <VStack align="stretch" spacing={2} flex={1}>
        {templates.map((tpl) => (
          <HStack
            key={tpl.name}
            p={3}
            bg={tpl.active ? "rgba(0,87,184,0.18)" : "rgba(255,255,255,0.03)"}
            border="1px solid"
            borderColor={tpl.active ? "rgba(0,87,184,0.5)" : "rgba(255,255,255,0.06)"}
            borderRadius="14px"
          >
            <Flex
              w="36px"
              h="36px"
              borderRadius="10px"
              bg={tpl.active ? BRAND : "rgba(255,255,255,0.06)"}
              align="center"
              justify="center"
              flexShrink={0}
            >
              <Icon as={tpl.icon} color="white" boxSize={4} />
            </Flex>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="12px" color="white" fontWeight="800">{tpl.name}</Text>
              <Text fontSize="9px" color="rgba(255,255,255,0.55)">{tpl.desc}</Text>
            </VStack>
            {tpl.active && (
              <Flex w="18px" h="18px" borderRadius="full" bg={BRAND} align="center" justify="center">
                <Icon as={FiCheck} color="white" boxSize={2.5} />
              </Flex>
            )}
          </HStack>
        ))}
      </VStack>
      <Button h="42px" bg="white" color="black" borderRadius="12px" fontSize="13px" fontWeight="800" rightIcon={<Icon as={FiArrowRight} />}>
        {t("sec_contract_deploy_btn")}
      </Button>
    </VStack>
  );
}

/* ═════════════════════════════════════════════════════
   SECTION — Mint tokens
   ═════════════════════════════════════════════════════ */

function SectionMint() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.55)" : "#64748b";
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const phoneScale = useBreakpointValue({ base: 0.55, sm: 0.7, md: 0.85, lg: 0.95 }) ?? 0.9;

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const phoneY = useTransform(scrollYProgress, [0, 1], ["18%", "-18%"]);
  const phoneRotate = useTransform(scrollYProgress, [0, 0.5, 1], [-4, 0, 4]);
  const copyY = useTransform(scrollYProgress, [0, 1], ["8%", "-8%"]);
  const cardY = useTransform(scrollYProgress, [0, 1], ["14%", "-14%"]);

  return (
    <Box ref={sectionRef} position="relative" py={{ base: 16, md: 24 }} px={{ base: 4, md: 10 }} overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={2}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
          <Flex justify="center" order={{ base: 2, lg: 1 }}>
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div style={{ y: phoneY, rotate: phoneRotate, willChange: "transform" }}>
                <Box style={{ transform: `scale(${phoneScale})`, transformOrigin: "center center" }}>
                  <StaticPhone>
                    <PhoneMintBuilderScreen />
                  </StaticPhone>
                </Box>
              </motion.div>
            </motion.div>
          </Flex>
          <motion.div style={{ y: copyY }}>
            <VStack align={{ base: "center", lg: "start" }} spacing={{ base: 6, md: 8 }} order={{ base: 1, lg: 2 }} textAlign={{ base: "center", lg: "start" }}>
              <Heading
                fontFamily="'DM Sans', sans-serif"
                fontWeight="800"
                fontSize={{ base: "40px", md: "64px", xl: "80px" }}
                letterSpacing="-0.04em"
              >
                <Box as="span" bgGradient="linear(to-r, #0057b8, #367ed1)" bgClip="text">{t("sec_mint_title_1")}</Box>
                <br />
                <Box as="span" color={textMain}>{t("sec_mint_title_2")}</Box>
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="460px">
                {t("sec_mint_desc")}
              </Text>
              <motion.div style={{ y: cardY, width: "100%", maxWidth: "460px" }}>
                <SimpleGrid columns={2} spacing={3} w="100%">
                  {[
                    { icon: FiZap, label: t("sec_mint_feat_fast") },
                    { icon: FiCode, label: t("sec_mint_feat_nocode") },
                    { icon: FiLayers, label: t("sec_mint_feat_chains") },
                    { icon: FiShield, label: t("sec_mint_feat_audited") },
                  ].map((f) => (
                    <HStack
                      key={f.label}
                      h="64px"
                      bg={cardBg}
                      border="1px solid"
                      borderColor={cardBorder}
                      borderRadius="16px"
                      px={4}
                      spacing={3}
                    >
                      <Flex w="36px" h="36px" borderRadius="10px" border="1px solid rgb(26, 82, 186)" align="center" justify="center" flexShrink={0}>
                        <Icon as={f.icon} color="#0057b8" />
                      </Flex>
                      <Text fontSize="13px" fontWeight="700" color={textMain}>{f.label}</Text>
                    </HStack>
                  ))}
                </SimpleGrid>
              </motion.div>
            </VStack>
          </motion.div>
        </SimpleGrid>
      </Container>
    </Box>
  );
}

/* ═════════════════════════════════════════════════════
   SECTION — Smart contracts
   ═════════════════════════════════════════════════════ */

function SectionContracts() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.55)" : "#64748b";
  const tileBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.08)";
  const phoneScale = useBreakpointValue({ base: 0.55, sm: 0.7, md: 0.85, lg: 0.95 }) ?? 0.9;

  const features = [
    { icon: FiLock, label: t("sec_contract_feat_escrow") },
    { icon: FiFeather, label: t("sec_contract_feat_vesting") },
    { icon: FiUsers, label: t("sec_contract_feat_multisig") },
    { icon: FiCpu, label: t("sec_contract_feat_custom") },
  ];

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const phoneY = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"]);
  const phoneRotate = useTransform(scrollYProgress, [0, 0.5, 1], [5, 0, -5]);
  const copyY = useTransform(scrollYProgress, [0, 1], ["10%", "-10%"]);

  return (
    <Box ref={sectionRef} position="relative" py={{ base: 16, md: 24 }} px={{ base: 4, md: 10 }} overflow="hidden">
      <Container maxW="1200px" position="relative" zIndex={2}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: 12, lg: 16 }} alignItems="center">
          <motion.div style={{ y: copyY }}>
            <VStack align={{ base: "center", lg: "start" }} spacing={{ base: 6, md: 8 }} textAlign={{ base: "center", lg: "start" }}>
              <Heading
                as="h2"
                fontFamily="'DM Sans', sans-serif"
                fontWeight="800"
                fontSize={{ base: "44px", md: "68px", xl: "88px" }}
                letterSpacing="-0.04em"
              >
                {[t("sec_contract_title_1"), t("sec_contract_title_2"), t("sec_contract_title_3")].map((line, i) => (
                  <motion.span
                    key={i}
                    style={{ display: "block" }}
                    initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.12 }}
                  >
                    <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">
                      {line}
                    </Box>
                  </motion.span>
                ))}
              </Heading>
              <Text fontSize={{ base: "14.5px", md: "16.5px" }} color={textSub} maxW="420px">
                {t("sec_contract_desc")}
              </Text>
              <SimpleGrid columns={2} spacing={3} w="100%" maxW="420px">
                {features.map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, y: 24, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.55, delay: 0.4 + 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <HStack
                      h="70px"
                      border="1px solid"
                      borderColor={tileBorder}
                      borderRadius="18px"
                      px={4}
                      spacing={3}
                      transition="all 0.25s ease"
                      _hover={{ transform: "translateY(-3px)", borderColor: "#0057b8", boxShadow: "0 10px 30px rgba(0,87,184,0.18)" }}
                    >
                      <Flex w="40px" h="40px" borderRadius="12px" border="1px solid rgba(0,87,184,0.25)" align="center" justify="center" flexShrink={0}>
                        <Icon as={f.icon} color={BRAND_LIGHT} />
                      </Flex>
                      <Text fontSize="13.5px" fontWeight="700" color={textMain}>{f.label}</Text>
                    </HStack>
                  </motion.div>
                ))}
              </SimpleGrid>
            </VStack>
          </motion.div>
          <Flex justify="center">
            <motion.div
              initial={{ opacity: 0, y: 80, scale: 0.88 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div style={{ y: phoneY, rotate: phoneRotate, willChange: "transform" }}>
                <Box style={{ transform: `scale(${phoneScale})`, transformOrigin: "center center" }}>
                  <StaticPhone>
                    <PhoneContractScreen />
                  </StaticPhone>
                </Box>
              </motion.div>
            </motion.div>
          </Flex>
        </SimpleGrid>
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
  widget: React.ReactNode;
}

function StageOverlay({ stages, progress }: { stages: Stage[]; progress: MotionValue<number> }) {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const textMain = dark ? "white" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0); // ← add ref to avoid stale closure

  useMotionValueEvent(progress, "change", (latest) => {
    const newIndex = Math.min(
      Math.floor(latest * stages.length),
      stages.length - 1
    );
    // Only call setState when the index actually changes
    if (newIndex !== activeIndexRef.current) {
      activeIndexRef.current = newIndex;
      setActiveIndex(newIndex);
    }
  });

  return (
    <>
      {/* DESKTOP: left copy col */}
      <Box display={{ base: "none", lg: "block" }} position="absolute" top="50%" left="6%" transform="translateY(-50%)" w="32%" maxW="440px" zIndex={3} pointerEvents="none">
        <Box position="relative" minH="280px">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{ position: "absolute", inset: 0 }}
            >
              <VStack align="start" spacing={5}>
                <Heading fontFamily="'DM Sans', sans-serif" fontWeight="800" fontSize={{ lg: "44px", xl: "56px" }} letterSpacing="-0.04em" color={textMain}>
                  {stages[activeIndex].title}
                </Heading>
                <Text fontSize="16px" color={textSub} maxW="420px">
                  {stages[activeIndex].desc}
                </Text>
              </VStack>
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>

      {/* DESKTOP: right widget col */}
      <Box display={{ base: "none", lg: "block" }} position="absolute" top="50%" right="4%" transform="translateY(-50%)" zIndex={3} w="440px">
        <Box position="relative" minH="420px" minW="440px">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{ position: "absolute", top: "50%", right: 0, transform: "translateY(-50%)" }}
            >
              {stages[activeIndex].widget}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>

      {/* MOBILE */}
      <Flex display={{ base: "flex", lg: "none" }} direction="column" align="center" h="100%" justify="space-between" px={5} pt="80px" pb={5} zIndex={3} position="relative" pointerEvents="none">
        <Box position="relative" w="100%" minH="150px" textAlign="center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ position: "absolute", inset: 0 }}
            >
              <VStack spacing={2}>
                <Heading fontSize="26px" fontWeight="800" color={textMain} letterSpacing="-0.03em" fontFamily="'DM Sans', sans-serif" maxW="320px">
                  {stages[activeIndex].title}
                </Heading>
                <Text fontSize="13px" color={textSub} maxW="320px" noOfLines={3}>
                  {stages[activeIndex].desc}
                </Text>
              </VStack>
            </motion.div>
          </AnimatePresence>
        </Box>
        <Box position="relative" w="100%" minH="320px" display="flex" justifyContent="center" alignItems="center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              {stages[activeIndex].widget}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Flex>
    </>
  );
}

// At module level (outside LandingPage):
const STAGE_WIDGETS = [
  <StageSpot key="spot" />,
  <StageMarkets key="markets" />,
  <StageP2P key="p2p" />,
  <StageHandles key="handles" />,
  <StageCards key="cards" />,
  <StageMint key="mint" />,
];

/* ═════════════════════════════════════════════════════
   LANDING PAGE
   ═════════════════════════════════════════════════════ */

export default function LandingPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();

  const phoneScaleResp =
    useBreakpointValue({ base: 0.5, sm: 0.6, md: 0.72, lg: 0.82, xl: 0.92 }) ?? 0.9;

  const pageBg = dark ? "#000000" : "#fafbfe";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.55)" : "#64748b";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const glow = dark ? "rgba(0,87,184,0.22)" : "rgba(0,87,184,0.08)";
  const arcColor = dark ? "rgba(0,87,184,0.35)" : "rgba(0,87,184,0.25)";

  const scrollRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: totalProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  const TILT_END = 0.08;
  const STAGE_START = 0.12;

  const titleOpacity = useTransform(totalProgress, [0, TILT_END * 0.7, TILT_END], [1, 1, 0]);
  const titleY = useTransform(totalProgress, [0, TILT_END], [0, -80]);
  const phoneRotateX = useTransform(totalProgress, [0, TILT_END], [32, 0], { clamp: true });
  const phoneLiftY = useTransform(totalProgress, [0, TILT_END], [40, 0], { clamp: true });
  const phoneScaleMV = useTransform(totalProgress, [0, TILT_END], [0.94, 1], { clamp: true });

  const logoOpacity = useTransform(
    totalProgress,
    [STAGE_START - 0.03, STAGE_START],
    [1, 0],
    { clamp: true }
  );

  const stageProgress = useTransform(totalProgress, [STAGE_START, 1], [0, 1], { clamp: true });

  const stageOverlayOpacity = useTransform(
    totalProgress,
    [STAGE_START - 0.02, STAGE_START + 0.01],
    [0, 1]
  );

  const phoneParallaxY = useTransform(stageProgress, [0, 1], ["-2vh", "2vh"]);
  const pathsOpacity = useTransform(totalProgress, [0, 0.75, 1], [1, 1, 0]);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("snap-landing");
    return () => html.classList.remove("snap-landing");
  }, []);

  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 95%, rgba(255,255,255,0.4) 100%)"
    : "linear(to-b, #0057b8 0%, #bbbbbb 95%, rgba(10,15,30,0.35) 100%)";

  const stages: Stage[] = [
    { eyebrow: t("feat_spot_eyebrow"),    title: t("feat_spot_title"),    desc: t("feat_spot_desc"),    widget: STAGE_WIDGETS[0] },
    { eyebrow: t("feat_markets_eyebrow"), title: t("feat_markets_title"), desc: t("feat_markets_desc"), widget: STAGE_WIDGETS[1] },
    { eyebrow: t("feat_p2p_eyebrow"),     title: t("feat_p2p_title"),     desc: t("feat_p2p_desc"),     widget: STAGE_WIDGETS[2] },
    { eyebrow: t("feat_wallet_eyebrow"),  title: t("feat_wallet_title"),  desc: t("feat_wallet_desc"),  widget: STAGE_WIDGETS[3] },
    { eyebrow: t("feat_card_eyebrow"),    title: t("feat_card_title"),    desc: t("feat_card_desc"),    widget: STAGE_WIDGETS[4] },
    { eyebrow: t("feat_mint_eyebrow"),    title: t("feat_mint_title"),    desc: t("feat_mint_desc"),    widget: STAGE_WIDGETS[5] },
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
    <Box minH="100vh" bg={pageBg} overflowX="clip" color={textMain}>
      <PublicNav />

      <motion.div
        style={{
          opacity: pathsOpacity,
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
        }}
      >
        <BackgroundPaths />
      </motion.div>

      {/* ══ HERO + STICKY STAGES (one phone — unlocks & cycles) ══ */}
      <Box
        ref={scrollRef}
        className="snap-section"
        id="features"
        position="relative"
        h={{ base: "1020vh", md: "1080vh" }}
      >
        <Box position="sticky" top={0} h="100vh" overflow="hidden">
          {/* Glow */}
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" w="800px" h="800px" bg={glow} filter="blur(140px)" borderRadius="full" pointerEvents="none" />

          {/* Hero title (fades out as phone uprights) */}
          <motion.div
            style={{
              opacity: titleOpacity,
              y: titleY,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              paddingTop: "120px",
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <Container maxW="1200px" position="relative">
              
              <VStack textAlign="center" spacing={0} px={6}>
                <Heading
                  as="h2"
                  fontFamily="'DM Sans', sans-serif"
                  fontWeight="900"
                  fontSize={{ base: "52px", sm: "54px", md: "104px", xl: "102px" }}
                  letterSpacing="-0.075em"
                  bgGradient={titleGradient}
                  bgClip="text"
                >
                  {t("hero_line1")}
                  <br />
                  <Heading 
                  fontStyle={"italic"}
                  fontSize={{ base: "52px", sm: "54px", md: "92px", xl: "92px" }}
                  bgGradient={titleGradient}
                  bgClip="text"
                  minW={1100}
                  >
                  {t("hero_line2")}
                  </Heading>
                </Heading>
              </VStack>
            </Container>
          </motion.div>

          {/* Single phone — tilts back→upright, then its logo screen fades to reveal the stage screens */}
          <Flex
            position="absolute"
            inset={0}
            align="center"
            justify="center"
            zIndex={2}
            pointerEvents="none"
            style={{ perspective: "1200px" }}
          >
            <motion.div
              style={{
                rotateX: phoneRotateX,
                y: phoneLiftY,
                scale: phoneScaleMV,
                transformOrigin: "50% 100%",
                transformStyle: "preserve-3d",
              }}
              transition={{ type: "tween", ease: "easeOut", duration: 0.1 }}
            >
              <motion.div 
                style={{ y: phoneParallaxY }}
                transition={{ type: "tween", ease: "linear", duration: 0.1 }}
              >
                <PhoneFrame progress={stageProgress} scale={phoneScaleResp} logoOpacity={logoOpacity} />
              </motion.div>
            </motion.div>
          </Flex>

          {/* Stage copy + widgets — fade in once the phone is upright/unlocked */}
          <motion.div
            style={{
              opacity: stageOverlayOpacity,
              position: "absolute",
              inset: 0,
              zIndex: 3,
              pointerEvents: "none",
            }}
          >
            <StageOverlay stages={stages} progress={stageProgress} />
          </motion.div>
        </Box>
      </Box>

      {/* ══ BENTO GRID — flex stats & features ══ */}
      <SectionBento />

      {/* ══ ONRAMP (Buy / Sell / Send) — MoonPay-style videos ══ */}
      <SectionOnRamp />

      {/* ══ SOCIAL PROOF — stat + photo collage ══ */}
      <SectionSocialProof />

      {/* ══ SOCIAL PAYMENTS SECTION ══ */}
      <SectionSocialFinance />

      {/* ══ MINT TOKEN SECTION ══ */}
      <SectionMint />

      {/* ══ SMART CONTRACTS SECTION ══ */}
      <SectionContracts />

      {/* ══ CONNECTED ARCS ══ */}
      <Box className="snap-section" id="connect" py={{ base: 16, md: 24 }} position="relative" overflow="hidden" minH="100vh" display="flex" alignItems="center">
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" w="100%" h="600px" pointerEvents="none">
          <Box position="absolute" top="0" left="50%" transform="translateX(-50%)" w="1400px" h="1400px" border="1px solid" borderColor={arcColor} borderRadius="full" style={{ clipPath: "inset(0 0 50% 0)", boxShadow: `0 0 60px ${glow}` }} />
          <Box position="absolute" bottom="0" left="50%" transform="translateX(-50%)" w="1400px" h="1400px" border="1px solid" borderColor={arcColor} borderRadius="full" style={{ clipPath: "inset(50% 0 0 0)", boxShadow: `0 0 60px ${glow}` }} />
        </Box>
        <VStack position="relative" zIndex={2} spacing={8} maxW="720px" mx="auto" textAlign="center" px={6}>
          <Box bg={dark ? "#000" : "white"} p={6} borderRadius="28px" border="1px solid" borderColor={cardBorder} boxShadow={`0 0 60px ${glow}`}>
            <IconLogo size={56} />
          </Box>
          <Heading fontSize={{ base: "36px", md: "64px" }} fontWeight="800" letterSpacing="-0.04em" fontFamily="'DM Sans', sans-serif" color={textMain}>
            {t("connect_title_1")}{" "}
            <Box as="span" bgGradient="linear(to-r, #4a8fe0, #0057b8)" bgClip="text">{t("connect_title_2")}</Box>
          </Heading>
          <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="560px">
            {t("connect_desc")}
          </Text>
          <HStack spacing={3} flexWrap="wrap" justify="center" pt={2}>
            {[
              { icon: FiZap, label: t("connect_pill_speed") },
              { icon: FiGlobe, label: t("connect_pill_access") },
              { icon: FiShield, label: t("connect_pill_security") },
            ].map((p, i) => (
              <HStack key={i} bg={dark ? "rgba(255,255,255,0.04)" : "white"} border="1px solid" borderColor={cardBorder} px={4} py={2.5} borderRadius="full">
                <Icon as={p.icon} color={BRAND_LIGHT} boxSize={4} />
                <Text fontSize="13px" color={textMain} fontWeight="700">{p.label}</Text>
              </HStack>
            ))}
          </HStack>
        </VStack>
      </Box>

      {/* ══ CTA ══ */}
      <Box className="snap-section" id="cta" py={{ base: 16, md: 28 }} px={{ base: 6, md: 12 }} minH="100vh" display="flex" alignItems="center" justifyContent="center">
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
          <Box position="absolute" inset={0} opacity={0.08} backgroundImage="radial-gradient(circle at 2px 2px, white 1px, transparent 0)" backgroundSize="36px 36px" pointerEvents="none" />
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

      <PublicFooter />
    </Box>
  );
}
