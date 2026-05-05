"use client";

/**
 * AuthenticatedHome — rendered on "/" when the user is logged in.
 * Design mirrors the mobile home screen: @handle header, animated
 * balance hero, 5 action buttons, and Assets / Activity tabs.
 */

import { useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Heading,
  Icon,
  Badge,
  SimpleGrid,
  Avatar,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/react";
import {
  FiArrowUpRight,
  FiArrowDownLeft,
  FiRepeat,
  FiSend,
  FiTrendingUp,
  FiTrendingDown,
  FiShoppingCart,
  FiDollarSign,
  FiBell,
  FiSettings,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import PublicNav from "@/components/ui/PublicNav";
import { walletAPI, transferAPI } from "@/lib/api";
import { BuyWidget } from "@/components/exchange/BuyWidget";

/* ─── Brand ─── */
const BRAND = "#4A8FE0";
const BRAND_LIGHT = "#4a8fe0";

/* ─── Types ─── */
type Ticker = { price: number; change: number };
type TickerMap = Record<string, Ticker>;

const SEED: TickerMap = {
  BTCUSDT: { price: 114200.20, change:  2.34 },
  ETHUSDT: { price:   4111.02, change:  1.82 },
  SOLUSDT: { price:    162.44, change:  5.12 },
  BNBUSDT: { price:    612.30, change: -0.42 },
  XRPUSDT: { price:      0.612, change:  0.88 },
};
const SYMBOLS = Object.keys(SEED);
const META: Record<string, { label: string; color: string; icon: string }> = {
  BTCUSDT: { label: "Bitcoin",  color: "#f7931a", icon: "₿" },
  ETHUSDT: { label: "Ethereum", color: "#627eea", icon: "Ξ" },
  SOLUSDT: { label: "Solana",   color: "#9945ff", icon: "◎" },
  BNBUSDT: { label: "BNB",      color: "#f3ba2f", icon: "⬡" },
  XRPUSDT: { label: "XRP",      color: "#00aae4", icon: "✕" },
};

/* ─── Helpers ─── */
function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(2);
  return n.toFixed(4);
}
function fmtChg(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }

/* ─── Live prices ─── */
function useLivePrices(): TickerMap {
  const [prices, setPrices] = useState<TickerMap>(SEED);
  useEffect(() => {
    let alive = true;
    const go = async () => {
      try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(SYMBOLS))}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data: Array<{ symbol: string; lastPrice: string; priceChangePercent: string }> = await res.json();
        if (!alive) return;
        const next: TickerMap = {};
        for (const d of data) next[d.symbol] = { price: parseFloat(d.lastPrice), change: parseFloat(d.priceChangePercent) };
        setPrices(p => ({ ...p, ...next }));
      } catch { /* keep seed */ }
    };
    go();
    const id = setInterval(go, 8000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return prices;
}

/* ─── Animated balance (mirrors mobile AnimatedTotal) ─── */
function AnimatedBalance({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  const fromRef = useRef(0);
  const targetRef = useRef(value);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = displayed;
    targetRef.current = value;
    startRef.current = Date.now();
    const isFirst = displayed === 0;
    const dur = isFirst ? 2400 : 1400;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      const t = Math.min(1, elapsed / dur);
      const eased = t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
      const next = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplayed(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const str = displayed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const digits = str.replace(/[^0-9]/g, "").length;
  const fs = digits <= 7 ? "52px" : digits <= 9 ? "42px" : digits <= 11 ? "36px" : "28px";
  return (
    <Text
      fontSize={fs}
      fontWeight="800"
      letterSpacing="-0.05em"
      lineHeight={1}
      fontFamily="'DM Sans', sans-serif"
    >
      ${str}
    </Text>
  );
}

/* ─── Sparkline ─── */
function Spark({ up }: { up: boolean }) {
  const c = up ? "#22c55e" : "#ef4444";
  return (
    <svg viewBox="0 0 56 24" width="56" height="24" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sp${up}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 18 L7 14 L14 16 L21 9 L28 11 L35 5 L42 7 L49 2 L56 4 L56 24 L0 24 Z" fill={`url(#sp${up})`} />
      <path d="M0 18 L7 14 L14 16 L21 9 L28 11 L35 5 L42 7 L49 2 L56 4" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export default function AuthenticatedHome() {
  const { user } = useAuthStore();
  const prices = useLivePrices();
  const handle = user?.username || user?.email?.split("@")[0] || "me";
  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? "P").toUpperCase();

  const [portfolio, setPortfolio]     = useState<{ totalValue: number; dailyChange: number } | null>(null);
  const [wallets, setWallets]         = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [tab, setTab]                 = useState<"ASSETS" | "ACTIVITY">("ASSETS");
  const [buyModalOpen, setBuyModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [portfolioRes, transfersRes] = await Promise.all([
          walletAPI.getPortfolio(),
          transferAPI.getHistory(1),
        ]);
        setPortfolio({
          totalValue:   portfolioRes.data.totalValue  || 0,
          dailyChange:  portfolioRes.data.dailyChange || 0,
        });
        setWallets(portfolioRes.data.wallets || []);
        setTransactions(transfersRes.data.data || []);
      } catch {
        /* silently fall through — show zeros */
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const balance      = portfolio?.totalValue  || 0;
  const deltaUsd     = portfolio?.dailyChange || 0;
  const deltaPct     = balance > 0 ? (deltaUsd / balance) * 100 : 0;
  const positive     = deltaUsd >= 0;

  /* 5 action buttons — mirrors mobile exactly */
  const ACTIONS = [
    { icon: FiShoppingCart, label: "Buy",     onPress: () => setBuyModalOpen(true), accent: BRAND         },
    { icon: FiDollarSign,   label: "Sell",    href: "/dashboard/trade?tab=sell",         accent: "#f59e0b"     },
    { icon: FiSend,         label: "Send",    href: "/dashboard/wallet?action=send",     accent: "#a78bfa"     },
    { icon: FiArrowDownLeft,label: "Receive", href: "/dashboard/wallet?action=receive",  accent: "#22c55e"     },
    { icon: FiArrowUpRight, label: "Deposit", href: "/dashboard/wallet?action=deposit",  accent: "#22c55e"     },
  ];

  const fade = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as any },
  });

  if (isLoading) {
    return (
      <Box minH="100vh" color="white">
        <PublicNav />
        <Flex align="center" justify="center" h="calc(100vh - 56px)">
          <VStack spacing={4}>
            <Spinner size="xl" color={BRAND} />
            <Text color="rgba(255,255,255,0.5)" fontSize="13px">Loading your portfolio…</Text>
          </VStack>
        </Flex>
      </Box>
    );
  }

  return (
    <>
      <Box minH="100vh" color="white" overflowX="hidden">
        <PublicNav />

        <Box maxW="680px" mx="auto" px={{ base: 5, md: 6 }} pt={{ base: "76px", md: "96px" }} pb={20}>

        {/* ── HEADER: @handle + icons ── */}
        <motion.div {...fade(0)}>
          <HStack justify="space-between" mb={6}>
            {/* left: avatar + @handle */}
            <HStack
              as={NextLink}
              href="/dashboard/settings"
              spacing={2.5}
              cursor="pointer"
              _hover={{ opacity: 0.8 }}
              transition="opacity 0.15s"
            >
              <Flex
                w="36px" h="36px" borderRadius="full"
                bg={BRAND}
                align="center" justify="center"
                fontSize="15px" fontWeight="800" color="white"
                flexShrink={0}
              >
                {initial}
              </Flex>
              <Text fontSize="17px" fontWeight="700" letterSpacing="-0.3px">
                @{handle}
              </Text>
            </HStack>

            {/* right: notification + settings */}
            <HStack spacing={2}>
              <Flex
                as={NextLink}
                href="/dashboard/notifications"
                w="36px" h="36px" borderRadius="full"
                bg="rgba(255,255,255,0.06)"
                border="1px solid rgba(255,255,255,0.08)"
                align="center" justify="center"
                cursor="pointer"
                _hover={{ bg: "rgba(255,255,255,0.1)" }}
                transition="background 0.15s"
              >
                <Icon as={FiBell} boxSize={4} />
              </Flex>
              <Flex
                as={NextLink}
                href="/dashboard/settings"
                w="36px" h="36px" borderRadius="full"
                bg="rgba(255,255,255,0.06)"
                border="1px solid rgba(255,255,255,0.08)"
                align="center" justify="center"
                cursor="pointer"
                _hover={{ bg: "rgba(255,255,255,0.1)" }}
                transition="background 0.15s"
              >
                <Icon as={FiSettings} boxSize={4} />
              </Flex>
            </HStack>
          </HStack>
        </motion.div>

        {/* ── BALANCE HERO ── */}
        <motion.div {...fade(1)}>
          <VStack align="center" spacing={2} mb={2}>
            <AnimatedBalance value={balance} />

            {/* 24h delta */}
            <HStack spacing={2}>
              <Text
                fontSize="14px" fontWeight="600"
                color={positive ? "#22c55e" : "#ef4444"}
                style={{ fontVariant: "tabular-nums" }}
              >
                {positive ? "+" : "-"}${Math.abs(deltaUsd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Badge
                px={2} py={0.5} borderRadius="7px" fontSize="11px" fontWeight="700"
                bg={positive ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.16)"}
                color={positive ? "#22c55e" : "#ef4444"}
                display="flex" alignItems="center" gap="3px"
              >
                <Icon as={positive ? FiTrendingUp : FiTrendingDown} boxSize={3} mr={1} />
                {Math.abs(deltaPct).toFixed(2)}%
              </Badge>
            </HStack>
          </VStack>
        </motion.div>

        {/* ── 5 ACTION BUTTONS ── */}
        <motion.div {...fade(2)}>
          <SimpleGrid columns={5} spacing={{ base: 1, md: 3 }} mt={8} mb={2}>
            {ACTIONS.map(a => (
              <VStack
                key={a.label}
                as={a.href ? NextLink : "div"}
                {...(a.href && { href: a.href })}
                onClick={a.onPress}
                spacing={2}
                align="center"
                role="group"
                cursor={a.onPress ? "pointer" : "default"}
              >
                <Flex
                  w={{ base: "52px", md: "56px" }}
                  h={{ base: "52px", md: "56px" }}
                  borderRadius="full"
                  bg="rgba(255,255,255,0.07)"
                  border="1px solid rgba(255,255,255,0.1)"
                  align="center" justify="center"
                  transition="all 0.18s"
                  _groupHover={{ bg: "rgba(255,255,255,0.13)", transform: "translateY(-2px)" }}
                >
                  <Icon as={a.icon} boxSize={5} color="white" />
                </Flex>
                <Text fontSize="11px" fontWeight="700" color="rgba(255,255,255,0.65)">
                  {a.label}
                </Text>
              </VStack>
            ))}
          </SimpleGrid>
        </motion.div>

        {/* ── TABS ── */}
        <motion.div {...fade(3)}>
          <HStack spacing={8} mt={10} mb={0} justify="center">
            {(["ASSETS", "ACTIVITY"] as const).map(t => (
              <Box
                key={t}
                onClick={() => setTab(t)}
                cursor="pointer"
                pb={2.5}
                position="relative"
              >
                <Text
                  fontSize="17px"
                  fontWeight={tab === t ? "700" : "600"}
                  color={tab === t ? "white" : "rgba(255,255,255,0.35)"}
                  transition="color 0.15s"
                >
                  {t === "ASSETS" ? "Assets" : "Activity"}
                </Text>
                {tab === t && (
                  <Box
                    position="absolute" bottom={0} left={0} right={0}
                    h="2px" bg="white" borderRadius="2px"
                  />
                )}
              </Box>
            ))}
          </HStack>
          <Box h="1px" bg="rgba(255,255,255,0.07)" mt={0} />
        </motion.div>

        {/* ── TAB CONTENT ── */}
        <motion.div {...fade(4)}>
          {tab === "ASSETS" ? (
            <>
              {wallets.length === 0 ? (
                <VStack py={12} spacing={3}>
                  <Text fontSize="28px">💼</Text>
                  <Text fontSize="13px" color="rgba(255,255,255,0.4)" fontWeight="500">No assets yet.</Text>
                  <Box
                    as={NextLink}
                    href="/dashboard/wallet?action=deposit"
                    px={5} py={2.5}
                    borderRadius="full"
                    bg={BRAND}
                    fontSize="13px" fontWeight="700"
                    _hover={{ opacity: 0.85 }}
                    transition="opacity 0.15s"
                  >
                    Top up to start
                  </Box>
                </VStack>
              ) : (
                wallets.map((w: any) => {
                  const cfg = ASSET_ICON[w.currency] ?? ASSET_ICON.DEFAULT;
                  return (
                    <Box
                      key={w.id}
                      as={NextLink}
                      href={`/dashboard/wallet?asset=${w.currency}`}
                      display="flex"
                      alignItems="center"
                      px={1} py={4}
                      borderBottom="1px solid rgba(255,255,255,0.06)"
                      _hover={{ bg: "rgba(255,255,255,0.025)" }}
                      transition="background 0.15s"
                      cursor="pointer"
                      gap={3}
                    >
                      <Flex
                        w="44px" h="44px" borderRadius="full"
                        bg={cfg.bg} align="center" justify="center" flexShrink={0}
                      >
                        <Text fontSize="17px" fontWeight="700" color={cfg.fg}>{cfg.glyph}</Text>
                      </Flex>
                      <Box flex={1} minW={0}>
                        <Text fontSize="15px" fontWeight="700" noOfLines={1}>{cfg.name}</Text>
                        <Text fontSize="12px" color="rgba(255,255,255,0.4)" fontWeight="500" mt={0.5}>
                          {Number(w.balance).toLocaleString("en-US", { maximumFractionDigits: cfg.dec })} {w.currency}
                        </Text>
                      </Box>
                      <Text fontSize="15px" fontWeight="700" style={{ fontVariant: 'tabular-nums' }}>
                        ${Number(w.fiatValueUsd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </Box>
                  );
                })
              )}

              {/* Markets strip */}
              <Box mt={8}>
                <HStack justify="space-between" mb={3}>
                  <Text fontSize="13px" fontWeight="700" color="rgba(255,255,255,0.5)" letterSpacing="0.06em">MARKETS</Text>
                  <Box as={NextLink} href="/markets" fontSize="11px" color={BRAND_LIGHT} fontWeight="600" _hover={{ color: "white" }}>
                    All →
                  </Box>
                </HStack>
                {SYMBOLS.map(sym => {
                  const p = prices[sym] ?? SEED[sym];
                  const m = META[sym];
                  const up = p.change >= 0;
                  return (
                    <Box
                      key={sym}
                      as={NextLink}
                      href={`/dashboard/trade?pair=${sym}`}
                      display="flex" alignItems="center"
                      py={3.5}
                      borderBottom="1px solid rgba(255,255,255,0.05)"
                      _hover={{ bg: "rgba(255,255,255,0.025)" }}
                      transition="background 0.15s"
                      cursor="pointer"
                      gap={3}
                    >
                      <Flex
                        w="40px" h="40px" borderRadius="full"
                        bg={`${m.color}18`}
                        align="center" justify="center" flexShrink={0}
                      >
                        <Text fontSize="14px" fontWeight="800" color={m.color}>{m.icon}</Text>
                      </Flex>
                      <Box flex={1} minW={0}>
                        <Text fontSize="14px" fontWeight="700">{sym.replace("USDT", "")}</Text>
                        <Text fontSize="11px" color="rgba(255,255,255,0.35)" fontWeight="500">{m.label}</Text>
                      </Box>
                      <Spark up={up} />
                      <Box textAlign="right" flexShrink={0}>
                        <Text fontSize="14px" fontWeight="700" fontFamily="monospace">${fmt(p.price)}</Text>
                        <Text fontSize="11px" color={up ? "#22c55e" : "#ef4444"} fontWeight="600">{fmtChg(p.change)}</Text>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : (
            /* Activity tab */
            <>
              {transactions.length === 0 ? (
                <VStack py={12} spacing={3}>
                  <Text fontSize="28px">🧾</Text>
                  <Text fontSize="13px" color="rgba(255,255,255,0.4)" fontWeight="500">No activity yet.</Text>
                </VStack>
              ) : (
                <>
                  {transactions.slice(0, 10).map((tx: any) => {
                    const isIn = ["RECEIVE", "DEPOSIT", "TRANSFER_IN"].includes(tx.type);
                    const color = isIn ? "#22c55e" : "#ef4444";
                    const icon = isIn ? "↓" : "↑";
                    const label = tx.description || (isIn ? `Received` : `Sent`) + ` · ${tx.type}`;
                    const sub = new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                    const amt = `${isIn ? "+" : "-"}${Math.abs(Number(tx.amount)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tx.currency || "USDT"}`;
                    return (
                      <HStack
                        key={tx.id}
                        py={3.5} px={1}
                        borderBottom="1px solid rgba(255,255,255,0.06)"
                        spacing={3}
                        _hover={{ bg: "rgba(255,255,255,0.025)" }}
                        transition="background 0.15s"
                      >
                        <Flex
                          w="40px" h="40px" borderRadius="full"
                          bg={`${color}18`}
                          align="center" justify="center" flexShrink={0}
                        >
                          <Text fontSize="14px" fontWeight="800" color={color}>{icon}</Text>
                        </Flex>
                        <VStack align="start" spacing={0} flex={1} minW={0}>
                          <Text fontSize="14px" fontWeight="700" noOfLines={1}>{label}</Text>
                          <Text fontSize="11px" color="rgba(255,255,255,0.35)" fontWeight="500">{sub}</Text>
                        </VStack>
                        <Text
                          fontSize="14px" fontWeight="700"
                          style={{ fontVariant: 'tabular-nums' }}
                          flexShrink={0}
                          color={isIn ? "#22c55e" : "rgba(255,255,255,0.65)"}
                        >
                          {amt}
                        </Text>
                      </HStack>
                    );
                  })}
                  <Box
                    as={NextLink}
                    href="/dashboard/wallet"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    gap={2}
                    mt={5}
                    h="44px"
                    borderRadius="full"
                    bg="rgba(255,255,255,0.05)"
                    border="1px solid rgba(255,255,255,0.1)"
                    fontSize="13px"
                    fontWeight="700"
                    cursor="pointer"
                    _hover={{ bg: "rgba(255,255,255,0.09)" }}
                    transition="background 0.15s"
                  >
                    See all transactions →
                  </Box>
                </>
              )}
            </>
          )}
        </motion.div>

      </Box>
      </Box>

      {/* Buy Widget Modal */}
      <Modal isOpen={buyModalOpen} onClose={() => setBuyModalOpen(false)} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Buy Crypto</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <BuyWidget />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

/* ─── Asset icon config ─── */
const ASSET_ICON: Record<string, { bg: string; fg: string; glyph: string; name: string; dec: number }> = {
  BTC:   { bg: "#f7931a", fg: "#fff", glyph: "₿", name: "Bitcoin",       dec: 8 },
  ETH:   { bg: "#627eea", fg: "#fff", glyph: "Ξ", name: "Ethereum",      dec: 6 },
  USDT:  { bg: "#26a17b", fg: "#fff", glyph: "₮", name: "Tether",        dec: 2 },
  SOL:   { bg: "#9945ff", fg: "#fff", glyph: "◎", name: "Solana",        dec: 4 },
  BNB:   { bg: "#f3ba2f", fg: "#000", glyph: "⬡", name: "BNB",           dec: 4 },
  XRP:   { bg: "#23292f", fg: "#fff", glyph: "✕", name: "XRP",           dec: 4 },
  ADA:   { bg: "#0033ad", fg: "#fff", glyph: "₳", name: "Cardano",       dec: 4 },
  DOGE:  { bg: "#c3a634", fg: "#fff", glyph: "Ð", name: "Dogecoin",      dec: 4 },
  MATIC: { bg: "#8247e5", fg: "#fff", glyph: "◆", name: "Polygon",       dec: 4 },
  DOT:   { bg: "#e6007a", fg: "#fff", glyph: "●", name: "Polkadot",      dec: 4 },
  AVAX:  { bg: "#e84142", fg: "#fff", glyph: "▲", name: "Avalanche",     dec: 4 },
  USD:   { bg: "#2775ca", fg: "#fff", glyph: "$", name: "US Dollar",     dec: 2 },
  EUR:   { bg: "#1a73e8", fg: "#fff", glyph: "€", name: "Euro",          dec: 2 },
  GBP:   { bg: "#7c3aed", fg: "#fff", glyph: "£", name: "British Pound", dec: 2 },
  AED:   { bg: "#0f766e", fg: "#fff", glyph: "د", name: "UAE Dirham",    dec: 2 },
  SAR:   { bg: "#15803d", fg: "#fff", glyph: "﷼", name: "Saudi Riyal",   dec: 2 },
  EGP:   { bg: "#dc2626", fg: "#fff", glyph: "£", name: "Egyptian Pound",dec: 2 },
  DEFAULT: { bg: "rgba(120,120,120,0.2)", fg: "#888", glyph: "?", name: "Asset", dec: 4 },
};