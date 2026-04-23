"use client";

/**
 * AuthenticatedHome — rendered on "/" when the user is logged in.
 *
 * In LandingPage, replace the early return with:
 *   if (isAuthenticated) return <AuthenticatedHome />;
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
} from "@chakra-ui/react";
import {
  FiArrowUpRight,
  FiArrowDownLeft,
  FiRepeat,
  FiSend,
  FiTrendingUp,
  FiTrendingDown,
  FiPlus,
  FiSettings,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import PublicNav from "@/components/ui/PublicNav";
import { walletAPI, transferAPI } from "@/lib/api";

/* ─── Brand ─── */
const BRAND = "#0057b8";
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
  SOLUSDT: { label: "Solana",   color: "#14f195", icon: "◎" },
  BNBUSDT: { label: "BNB",      color: "#f3ba2f", icon: "B" },
  XRPUSDT: { label: "XRP",      color: "#00aae4", icon: "✕" },
};

/* ─── Helpers ─── */
function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(2);
  return n.toFixed(4);
}
function fmtChg(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ─── Live prices hook ─── */
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

/* ─── Tiny sparkline ─── */
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

/* ─── Counting number animation ─── */
function Counter({ to, prefix = "" }: { to: number; prefix?: string }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const dur = 1000;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setVal(to * ease);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [to]);
  return <>{prefix}{val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

/* ══════════════════════════════════════
   COMPONENT
══════════════════════════════════════ */
export default function AuthenticatedHome() {
  const { user } = useAuthStore();
  const prices = useLivePrices();
  const firstName = user?.firstName || user?.email?.split("@")[0] || "there";

  /* Real data from API */
  const [portfolio, setPortfolio] = useState<{ totalValue: number; dailyChange: number } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [portfolioRes, transfersRes] = await Promise.all([
          walletAPI.getPortfolio(),
          transferAPI.getHistory(1)
        ]);

        setPortfolio({
          totalValue: portfolioRes.data.totalValue || 0,
          dailyChange: portfolioRes.data.dailyChange || 0
        });

        setTransactions(transfersRes.data.data || []);
      } catch (err) {
        console.error("Failed to fetch portfolio data:", err);
        setError("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Box minH="100vh" color="white" overflowX="hidden">
        <PublicNav />
        <Flex align="center" justify="center" h="calc(100vh - 56px)">
          <VStack spacing={4}>
            <Spinner size="xl" color={BRAND} />
            <Text color="rgba(255,255,255,0.6)">Loading your portfolio...</Text>
          </VStack>
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" color="white" overflowX="hidden">
        <PublicNav />
        <Flex align="center" justify="center" h="calc(100vh - 56px)">
          <Text color="red.400">{error}</Text>
        </Flex>
      </Box>
    );
  }

  const balance = portfolio?.totalValue || 0;
  const balanceChange = portfolio?.dailyChange || 0;
  const balUp = balanceChange >= 0;

  const quickActions = [
    { icon: FiArrowDownLeft, label: "Deposit",  href: "/dashboard/wallet?action=deposit",  accent: "#22c55e" },
    { icon: FiSend,          label: "Send",     href: "/dashboard/wallet?action=send",     accent: BRAND_LIGHT },
    { icon: FiArrowUpRight,  label: "Withdraw", href: "/dashboard/wallet?action=withdraw", accent: "#f59e0b" },
    { icon: FiRepeat,        label: "Trade",    href: "/dashboard/trade",                  accent: "#a78bfa" },
  ];

  const tiles = [
    { label: "Spot Trade",  sub: "Buy & sell instantly", href: "/dashboard/trade",          icon: FiRepeat,        accent: BRAND       },
    { label: "P2P Market",  sub: "Peer-to-peer",         href: "/dashboard/trade?tab=p2p",  icon: FiArrowUpRight,  accent: "#f59e0b"   },
    { label: "Wallet",      sub: "Balances & history",   href: "/dashboard/wallet",         icon: FiArrowDownLeft, accent: "#22c55e"   },
    { label: "Settings",    sub: "Account & security",   href: "/dashboard/settings",       icon: FiSettings,      accent: "#a78bfa"   },
  ];

  /* staggered animation helper */
  const fade = (i: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: i * 0.075, ease: [0.22, 1, 0.36, 1] as any },
  });

  return (
    <Box minH="100vh" color="white" overflowX="hidden">
      <PublicNav />

      <Box maxW="1000px" mx="auto" px={{ base: 4, md: 8 }} pt={{ base: "80px", md: "100px" }} pb={16}>

        {/* ── GREETING ROW ── */}
        <motion.div {...fade(0)}>
          <HStack justify="space-between" mb={7}>
            <VStack align="start" spacing={0}>
              <Text fontSize="13px" color="rgba(255,255,255,0.38)" letterSpacing="0.06em">
                {greeting()},
              </Text>
              <Heading
                fontSize={{ base: "26px", md: "34px" }}
                fontWeight="800"
                letterSpacing="-0.03em"
                fontFamily="'DM Sans', sans-serif"
              >
                {firstName} 👋
              </Heading>
            </VStack>
            <Avatar
              name={firstName}
              size={{ base: "md", md: "lg" }}
              bg={BRAND}
              color="white"
              fontWeight="800"
              fontSize="16px"
            />
          </HStack>
        </motion.div>

        {/* ── BALANCE CARD ── */}
        <motion.div {...fade(1)}>
          <Box
            borderRadius="28px"
            overflow="hidden"
            position="relative"
            p={{ base: 6, md: 8 }}
            mb={4}
            bg="linear-gradient(140deg, #0057b8 0%, #001636 55%, #000b1a 100%)"
            boxShadow="0 20px 70px rgba(0,87,184,0.3), 0 1px 0 rgba(255,255,255,0.06) inset"
          >
            {/* glows */}
            <Box position="absolute" top="-50%" right="-5%" w="380px" h="380px" borderRadius="full"
              bg="radial-gradient(circle, rgba(74,143,224,0.25) 0%, transparent 65%)" filter="blur(50px)" pointerEvents="none" />
            <Box position="absolute" bottom="-40%" left="-5%" w="280px" h="280px" borderRadius="full"
              bg="radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 65%)" filter="blur(40px)" pointerEvents="none" />
            {/* subtle grid */}
            <Box position="absolute" inset={0} opacity={0.035}
              backgroundImage="radial-gradient(circle at 1px 1px, white 1px, transparent 0)"
              backgroundSize="24px 24px" pointerEvents="none" />

            <Box position="relative">
              <Text fontSize="11px" color="rgba(255,255,255,0.45)" letterSpacing="0.14em" fontWeight="700" mb={3}>
                PORTFOLIO VALUE
              </Text>

              <HStack align="baseline" spacing={2} mb={2}>
                <Heading
                  fontSize={{ base: "38px", md: "52px" }}
                  fontWeight="900"
                  fontFamily="'DM Sans', sans-serif"
                  letterSpacing="-0.04em"
                  lineHeight={1}
                >
                  $<Counter to={balance} />
                </Heading>
                <Text fontSize="15px" color="rgba(255,255,255,0.5)" fontWeight="600" pb={1}>USDT</Text>
              </HStack>

              <Badge
                bg={balUp ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}
                color={balUp ? "#22c55e" : "#ef4444"}
                px={2.5} py={1} borderRadius="full" fontSize="11px" fontWeight="700"
              >
                <Icon as={balUp ? FiTrendingUp : FiTrendingDown} mr={1.5} />
                {fmtChg(balanceChange)} today
              </Badge>

              {/* Quick action row */}
              <SimpleGrid columns={4} spacing={{ base: 2, md: 4 }} mt={8}>
                {quickActions.map(a => (
                  <VStack
                    key={a.label}
                    as={NextLink}
                    href={a.href}
                    spacing={1.5}
                    align="center"
                    role="group"
                    cursor="pointer"
                  >
                    <Flex
                      w={{ base: "46px", md: "54px" }}
                      h={{ base: "46px", md: "54px" }}
                      borderRadius={{ base: "14px", md: "16px" }}
                      bg="rgba(255,255,255,0.08)"
                      border="1px solid rgba(255,255,255,0.1)"
                      align="center" justify="center"
                      transition="all 0.18s"
                      _groupHover={{ bg: "rgba(255,255,255,0.15)", transform: "translateY(-2px)" }}
                    >
                      <Icon as={a.icon} color={a.accent} boxSize={{ base: 4, md: 5 }} />
                    </Flex>
                    <Text fontSize="10.5px" color="rgba(255,255,255,0.55)" fontWeight="600" letterSpacing="0.02em">
                      {a.label}
                    </Text>
                  </VStack>
                ))}
              </SimpleGrid>
            </Box>
          </Box>
        </motion.div>

        {/* ── TWO-COL: MARKETS + ACTIVITY ── */}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>

          {/* Markets */}
          <motion.div {...fade(2)} style={{ height: "100%" }}>
            <Box
              borderRadius="24px"
              bg="rgba(255,255,255,0.025)"
              border="1px solid rgba(255,255,255,0.06)"
              overflow="hidden"
              h="100%"
            >
              <HStack px={5} pt={5} pb={2} justify="space-between">
                <Text fontSize="13px" fontWeight="700">Markets</Text>
                <Box as={NextLink} href="/markets" fontSize="11px" color={BRAND_LIGHT} fontWeight="600" _hover={{ color: "white" }}>
                  All →
                </Box>
              </HStack>

              <VStack align="stretch" spacing={0} px={2} pb={3}>
                {SYMBOLS.map(sym => {
                  const p = prices[sym] ?? SEED[sym];
                  const m = META[sym];
                  const up = p.change >= 0;
                  return (
                    <Box
                      key={sym}
                      as={NextLink}
                      href={`/dashboard/trade?pair=${sym}`}
                      px={3} py={2.5}
                      borderRadius="14px"
                      _hover={{ bg: "rgba(255,255,255,0.04)" }}
                      transition="background 0.15s"
                    >
                      <HStack spacing={3}>
                        <Flex
                          w="34px" h="34px" borderRadius="11px"
                          bg={`${m.color}15`} border={`1px solid ${m.color}28`}
                          align="center" justify="center" flexShrink={0}
                        >
                          <Text fontSize="11px" fontWeight="800" color={m.color}>{m.icon}</Text>
                        </Flex>
                        <VStack align="start" spacing={0} flex={1} minW={0}>
                          <Text fontSize="12.5px" fontWeight="700" color="white">{sym.replace("USDT", "")}</Text>
                          <Text fontSize="9.5px" color="rgba(255,255,255,0.35)" noOfLines={1}>{m.label}</Text>
                        </VStack>
                        <Spark up={up} />
                        <VStack align="end" spacing={0} flexShrink={0}>
                          <Text fontSize="12.5px" fontWeight="700" fontFamily="monospace">${fmt(p.price)}</Text>
                          <Text fontSize="9.5px" color={up ? "#22c55e" : "#ef4444"} fontWeight="600">{fmtChg(p.change)}</Text>
                        </VStack>
                      </HStack>
                    </Box>
                  );
                })}
              </VStack>
            </Box>
          </motion.div>

          {/* Activity */}
          <motion.div {...fade(3)} style={{ height: "100%" }}>
            <Box
              borderRadius="24px"
              bg="rgba(255,255,255,0.025)"
              border="1px solid rgba(255,255,255,0.06)"
              overflow="hidden"
              h="100%"
            >
              <HStack px={5} pt={5} pb={2} justify="space-between">
                <Text fontSize="13px" fontWeight="700">Recent Activity</Text>
                <Box as={NextLink} href="/dashboard/wallet" fontSize="11px" color={BRAND_LIGHT} fontWeight="600" _hover={{ color: "white" }}>
                  All →
                </Box>
              </HStack>

              <VStack align="stretch" spacing={0} px={2} pb={3}>
                {transactions.length === 0 ? (
                  <Text fontSize="11px" color="rgba(255,255,255,0.4)" textAlign="center" py={4}>
                    No recent activity
                  </Text>
                ) : (
                  transactions.slice(0, 5).map((tx) => {
                    const isReceived = tx.type === 'RECEIVED';
                    const icon = isReceived ? '↓' : '↑';
                    const color = isReceived ? '#22c55e' : BRAND_LIGHT;
                    const label = isReceived ? `Received from ${tx.senderUsername || tx.senderEmail || 'Unknown'}` : `Sent to ${tx.recipientUsername || tx.recipientEmail || 'Unknown'}`;
                    const sub = new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const amt = `${isReceived ? '+' : '-'}${tx.amount} ${tx.currency || 'USDT'}`;

                    return (
                      <HStack key={tx.id} px={3} py={2.5} borderRadius="14px" spacing={3}
                        _hover={{ bg: "rgba(255,255,255,0.04)" }} transition="background 0.15s">
                        <Flex
                          w="34px" h="34px" borderRadius="11px"
                          bg={`${color}15`} border={`1px solid ${color}28`}
                          align="center" justify="center" flexShrink={0}
                        >
                          <Text fontSize="12px" fontWeight="800" color={color}>{icon}</Text>
                        </Flex>
                        <VStack align="start" spacing={0} flex={1} minW={0}>
                          <Text fontSize="12.5px" fontWeight="700" color="white" noOfLines={1}>{label}</Text>
                          <Text fontSize="9.5px" color="rgba(255,255,255,0.35)">{sub}</Text>
                        </VStack>
                        <Text
                          fontSize="12.5px" fontWeight="700" fontFamily="monospace" flexShrink={0}
                          color={isReceived ? "#22c55e" : "rgba(255,255,255,0.65)"}
                        >
                          {amt}
                        </Text>
                      </HStack>
                    );
                  })
                )}
              </VStack>
            </Box>
          </motion.div>
        </SimpleGrid>

        {/* ── SHORTCUT TILES ── */}
        <motion.div {...fade(4)}>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
            {tiles.map(tile => (
              <Box
                key={tile.label}
                as={NextLink}
                href={tile.href}
                p={4}
                borderRadius="20px"
                bg="rgba(255,255,255,0.025)"
                border="1px solid rgba(255,255,255,0.06)"
                role="group"
                transition="all 0.18s"
                _hover={{
                  bg: "rgba(255,255,255,0.05)",
                  borderColor: `${tile.accent}40`,
                  transform: "translateY(-2px)",
                  boxShadow: `0 12px 30px ${tile.accent}14`,
                }}
              >
                <Flex
                  w="36px" h="36px" borderRadius="11px"
                  bg={`${tile.accent}15`} border={`1px solid ${tile.accent}28`}
                  align="center" justify="center" mb={3}
                  transition="background 0.18s"
                  _groupHover={{ bg: `${tile.accent}25` }}
                >
                  <Icon as={tile.icon} color={tile.accent} boxSize={3.5} />
                </Flex>
                <Text fontSize="13px" fontWeight="700" mb={0.5}>{tile.label}</Text>
                <Text fontSize="10.5px" color="rgba(255,255,255,0.38)">{tile.sub}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </motion.div>

      </Box>
    </Box>
  );
}