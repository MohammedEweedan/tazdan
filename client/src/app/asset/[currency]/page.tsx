"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, HStack, VStack, Text, Icon, Spinner, useColorMode,
} from "@chakra-ui/react";
import {
  FiChevronLeft, FiPlus, FiDollarSign, FiSend, FiArrowDownLeft,
  FiCopy, FiCheck, FiArrowUp, FiArrowDown, FiCamera,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { walletAPI, transferAPI } from "@/lib/api";
import { useBinanceLive, useBinanceLivePrice, priceForCurrency } from "@/hooks/useBinanceLive";

/* ─────────────────────────────────────────────────────────────────
   Same palette + meta as AuthenticatedHome — mirrors mobile exactly
   ───────────────────────────────────────────────────────────────── */
function pal(dark: boolean) {
  return {
    bg:        dark ? "#000000" : "#ffffff",
    bgElev:    dark ? "#111111" : "#f4f4f4",
    bg2:       dark ? "#0a0a0a" : "#fafafa",
    border:    dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)",
    fg:        dark ? "#ffffff" : "#000000",
    fgMuted:   dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)",
    fgFaint:   dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)",
    pillBg:    dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    ctaBg:     dark ? "#ffffff" : "#000000",
    ctaFg:     dark ? "#000000" : "#ffffff",
    greenFg:   "#22c55e",
    greenBg:   "rgba(34,197,94,0.14)",
    redFg:     "#ef4444",
    redBg:     "rgba(239,68,68,0.14)",
    brand:     "#4a8fe0",
    cardBg:    dark ? "#0d0d0d" : "#f5f5f7",
  };
}

const ASSET_META: Record<string, { title: string; glyph: string; bg: string; fg: string; dec: number }> = {
  BTC:     { title: "Bitcoin",        glyph: "₿",  bg: "#f7931a", fg: "#fff", dec: 8 },
  ETH:     { title: "Ethereum",       glyph: "Ξ",  bg: "#627eea", fg: "#fff", dec: 6 },
  USDT:    { title: "Tether",         glyph: "₮",  bg: "#26a17b", fg: "#fff", dec: 2 },
  SOL:     { title: "Solana",         glyph: "◎",  bg: "#9945ff", fg: "#fff", dec: 4 },
  BNB:     { title: "BNB",            glyph: "⬡",  bg: "#f3ba2f", fg: "#000", dec: 4 },
  XRP:     { title: "XRP",            glyph: "✕",  bg: "#23292f", fg: "#fff", dec: 4 },
  ADA:     { title: "Cardano",        glyph: "₳",  bg: "#0033ad", fg: "#fff", dec: 4 },
  DOGE:    { title: "Dogecoin",       glyph: "Ð",  bg: "#c3a634", fg: "#fff", dec: 4 },
  USD:     { title: "US Dollar",      glyph: "$",  bg: "#2775ca", fg: "#fff", dec: 2 },
  EUR:     { title: "Euro",           glyph: "€",  bg: "#1a73e8", fg: "#fff", dec: 2 },
  GBP:     { title: "British Pound",  glyph: "£",  bg: "#7c3aed", fg: "#fff", dec: 2 },
  AED:     { title: "UAE Dirham",     glyph: "د",  bg: "#0f766e", fg: "#fff", dec: 2 },
  SAR:     { title: "Saudi Riyal",    glyph: "﷼", bg: "#15803d", fg: "#fff", dec: 2 },
  EGP:     { title: "Egyptian Pound", glyph: "£",  bg: "#dc2626", fg: "#fff", dec: 2 },
  DEFAULT: { title: "Asset",          glyph: "?",  bg: "rgba(120,120,120,0.18)", fg: "#888", dec: 4 },
};

const CRYPTO_CURRENCIES = ["BTC", "ETH", "SOL", "USDT", "BNB", "XRP", "ADA", "DOGE"];

const CHAIN_LABEL: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum (ERC-20)", USDT: "Tron (TRC-20)",
  SOL: "Solana",  BNB: "BNB Smart Chain",   XRP:  "XRP Ledger",
  ADA: "Cardano", DOGE: "Dogecoin",
};

type Range = "1H" | "24H" | "7D" | "30D";

const RANGE_TO_BINANCE: Record<Range, { interval: string; limit: number }> = {
  "1H":  { interval: "1m",  limit: 60  },
  "24H": { interval: "15m", limit: 96  },
  "7D":  { interval: "1h",  limit: 168 },
  "30D": { interval: "4h",  limit: 180 },
};

/* ─────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────── */
function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtFiat(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)         return n.toFixed(2);
  return n.toFixed(4);
}

function deriveAddress(walletId: string, currency: string): string {
  const s = walletId.replace(/-/g, "");
  if (currency === "BTC") return `bc1q${s.slice(0, 38)}`;
  if (currency === "SOL") return s.slice(0, 44);
  if (currency === "XRP") return `r${s.slice(0, 33)}`;
  if (currency === "ADA") return `addr1${s.slice(0, 56)}`;
  return `0x${s.slice(0, 40)}`;
}

/* ─────────────────────────────────────────────────────────────────
   BINANCE OHLC HOOK — real klines from public REST
   ───────────────────────────────────────────────────────────────── */
function useKlines(symbol: string, range: Range): { data: number[]; loading: boolean } {
  const [data, setData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const { interval, limit } = RANGE_TO_BINANCE[range];
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`;
    fetch(url)
      .then(r => r.json())
      .then((rows: any[]) => {
        if (!alive || !Array.isArray(rows)) return;
        // Each kline = [openTime, open, high, low, close, volume, ...]
        setData(rows.map(r => parseFloat(r[4])));  // closing prices
      })
      .catch(() => { if (alive) setData([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [symbol, range]);

  return { data, loading };
}

/* ─────────────────────────────────────────────────────────────────
   CHART
   ───────────────────────────────────────────────────────────────── */
function Chart({ values, color, height = 200, p }: {
  values: number[]; color: string; height?: number; p: ReturnType<typeof pal>;
}) {
  const W = 600;
  if (!values.length) return <Box h={`${height}px`} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 8;
  const innerH = height - pad * 2;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = pad + (1 - (v - min) / span) * innerH;
    return [x, y] as [number, number];
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${height} L0 ${height} Z`;
  const gid = `chart-${color.replace("#", "")}`;

  return (
    <Box w="full" overflow="hidden" borderRadius="14px" bg={p.bgElev}
      border={`1px solid ${p.border}`}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none"
        style={{ display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} stroke={color} strokeWidth="2" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────────────────────────── */
export default function AssetDetailPage() {
  const router  = useRouter();
  const params  = useParams<{ currency: string }>();
  const sym     = (params?.currency ?? "BTC").toString().toUpperCase();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const p    = pal(dark);

  const meta     = ASSET_META[sym] ?? ASSET_META.DEFAULT;
  const isCrypto = CRYPTO_CURRENCIES.includes(sym) && sym !== "USDT";

  /* Live price feed — re-renders on every WS tick */
  const lp     = useBinanceLivePrice(sym);
  const live   = useBinanceLive();
  const price  = lp?.price ?? 0;
  const change = lp?.changePct24h ?? 0;
  const isLive = lp !== null && sym !== "USDT" && Date.now() - (lp?.ts ?? 0) < 10_000;

  /* Range + chart */
  const [range, setRange] = useState<Range>("24H");
  const { data: chartData, loading: chartLoading } = useKlines(sym, range);

  /* Wallet — fetched once */
  const [wallet, setWallet]   = useState<any | null>(null);
  const [txs, setTxs]         = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [walRes, txRes] = await Promise.all([
          walletAPI.getAll(),
          transferAPI.getHistory(1),
        ]);
        const allWallets = walRes.data.wallets || [];
        const w = allWallets.find((x: any) => x.currency === sym);
        setWallet(w ?? null);
        const txList = txRes.data?.data ?? txRes.data?.items ?? txRes.data?.transactions ?? [];
        setTxs(Array.isArray(txList) ? txList.filter((t: any) => t.currency === sym) : []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [sym]);

  const balance     = wallet ? Number(wallet.balance) : 0;
  const holdingsUsd = balance * price;
  const positive    = change >= 0;

  const addr = wallet
    ? (isCrypto
        ? deriveAddress(wallet.id, sym)
        : `PRMK-${sym}-${wallet.id.slice(0, 8).toUpperCase()}`)
    : "";

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }, [addr]);

  if (loading) {
    return (
      <Flex minH="60vh" align="center" justify="center" bg={p.bg}>
        <Spinner size="xl" color={p.brand} thickness="3px" />
      </Flex>
    );
  }

  const chartColor = positive ? "#22c55e" : "#ef4444";

  return (
    <Box bg={p.bg} minH="100vh" pb={16}>
      <Box maxW="720px" mx="auto" px={{ base: 5, lg: 6 }} pt={6}>

        {/* ── Header bar ── */}
        <HStack spacing={3} mb={6}>
          <Flex
            as="button"
            onClick={() => router.back()}
            w="38px" h="38px" borderRadius="full"
            bg={p.pillBg} border={`1px solid ${p.border}`}
            align="center" justify="center"
            _hover={{ bg: p.bgElev }} transition="background 0.12s"
          >
            <Icon as={FiChevronLeft} boxSize={4.5} color={p.fg} />
          </Flex>

          <HStack spacing={2.5} flex={1}>
            <Flex w="38px" h="38px" borderRadius="full" bg={meta.bg}
              align="center" justify="center">
              <Text fontSize="16px" fontWeight="700" color={meta.fg} lineHeight={1}>{meta.glyph}</Text>
            </Flex>
            <VStack align="start" spacing={0}>
              <Text fontSize="16px" fontWeight="800" color={p.fg} letterSpacing="-0.2px">
                {meta.title}
              </Text>
              <Text fontSize="11px" color={p.fgMuted} fontWeight="600">{sym} / USD</Text>
            </VStack>
          </HStack>
        </HStack>

        {/* ── Hero price ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <VStack spacing={2} align="center" py={6}>
            <HStack spacing={2.5} align="center">
              <Text
                fontSize={{ base: "44px", md: "54px" }}
                fontWeight="800" letterSpacing="-0.05em" lineHeight={1}
                color={p.fg} style={{ fontVariant: "tabular-nums" }}
              >
                ${formatPrice(price)}
              </Text>
              {/* LIVE badge */}
              <HStack spacing={1.5} px={2} py={1} borderRadius="6px"
                bg={isLive ? p.greenBg : p.pillBg}>
                <Box w="6px" h="6px" borderRadius="full"
                  bg={isLive ? p.greenFg : p.fgFaint}
                  style={isLive ? { animation: "pulse 1.6s ease-in-out infinite" } : {}} />
                <Text fontSize="9px" fontWeight="800" letterSpacing="0.08em"
                  color={isLive ? p.greenFg : p.fgMuted}>
                  {isLive ? "LIVE" : "DELAYED"}
                </Text>
                <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
              </HStack>
            </HStack>

            <HStack spacing={1} px={2.5} py={1} borderRadius="9px"
              bg={positive ? p.greenBg : p.redBg}>
              <Icon as={positive ? FiArrowUp : FiArrowDown} boxSize={3}
                color={positive ? p.greenFg : p.redFg} />
              <Text fontSize="12px" fontWeight="700"
                color={positive ? p.greenFg : p.redFg}>
                {positive ? "+" : ""}{change.toFixed(2)}% · 24H
              </Text>
            </HStack>
          </VStack>
        </motion.div>

        {/* ── Chart ── */}
        {isCrypto ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Box mt={4}>
              {chartLoading ? (
                <Flex h="200px" borderRadius="14px" bg={p.bgElev}
                  border={`1px solid ${p.border}`} align="center" justify="center">
                  <Spinner size="md" color={p.fgMuted} />
                </Flex>
              ) : (
                <Chart values={chartData} color={chartColor} height={200} p={p} />
              )}

              {/* Range selector */}
              <Flex mt={3} p={1} borderRadius="14px" bg={p.bgElev}
                border={`1px solid ${p.border}`} gap={1}>
                {(["1H", "24H", "7D", "30D"] as Range[]).map(r => (
                  <Box
                    key={r} as="button" onClick={() => setRange(r)}
                    flex={1} py={2} borderRadius="10px"
                    bg={range === r ? p.fg : "transparent"}
                    color={range === r ? p.bg : p.fgMuted}
                    fontSize="11px" fontWeight="700" letterSpacing="0.5px"
                    textAlign="center" cursor="pointer"
                    transition="all 0.15s"
                  >
                    {r}
                  </Box>
                ))}
              </Flex>
            </Box>
          </motion.div>
        ) : (
          <Flex mt={4} py={8} px={5} borderRadius="14px" bg={p.bgElev}
            border={`1px solid ${p.border}`} direction="column" align="center">
            <Text fontSize="11px" fontWeight="700" color={p.fgFaint}
              letterSpacing="0.08em" textTransform="uppercase">
              Stable asset
            </Text>
            <Text fontSize="13px" color={p.fgMuted} mt={2} textAlign="center">
              Price fixed at ${formatPrice(price)} — no chart.
            </Text>
          </Flex>
        )}

        {/* ── Holdings card ── */}
        <Box mt={5} p={5} borderRadius="20px"
          bg={p.cardBg} border={`1px solid ${p.border}`}>
          <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint}
            letterSpacing="0.08em" textTransform="uppercase" mb={3}>
            Your Holdings
          </Text>

          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Text fontSize="22px" fontWeight="800" color={p.fg}
                style={{ fontVariant: "tabular-nums" }} letterSpacing="-0.02em">
                {balance.toLocaleString("en-US", {
                  minimumFractionDigits: meta.dec, maximumFractionDigits: meta.dec,
                })}{" "}{sym}
              </Text>
              <Text fontSize="13px" color={p.fgMuted} fontWeight="600"
                style={{ fontVariant: "tabular-nums" }}>
                ≈ ${fmtFiat(holdingsUsd)} USD
              </Text>
            </VStack>

            {balance === 0 && (
              <Text fontSize="12px" color={p.fgFaint} fontWeight="600">No balance yet</Text>
            )}
          </HStack>
        </Box>

        {/* ── Action buttons ── */}
        <HStack spacing={3} mt={4}>
          <Box as={NextLink} href={`/dashboard/trade?asset=${sym}&side=BUY`}
            flex={1} h="48px" borderRadius="full"
            bg={p.ctaBg} color={p.ctaFg}
            fontSize="14px" fontWeight="800"
            display="flex" alignItems="center" justifyContent="center" gap={1.5}
            _hover={{ opacity: 0.85 }} transition="opacity 0.15s">
            <Icon as={FiPlus} boxSize={4} /> Buy
          </Box>
          <Box as={NextLink} href={`/dashboard/trade?asset=${sym}&side=SELL`}
            flex={1} h="48px" borderRadius="full"
            bg={p.pillBg} border={`1px solid ${p.border}`} color={p.fg}
            fontSize="14px" fontWeight="800"
            display="flex" alignItems="center" justifyContent="center" gap={1.5}
            _hover={{ bg: p.bgElev }} transition="background 0.15s">
            <Icon as={FiDollarSign} boxSize={4} /> Sell
          </Box>
          <Box as={NextLink} href={`/dashboard/send?asset=${sym}`}
            flex={1} h="48px" borderRadius="full"
            bg={p.pillBg} border={`1px solid ${p.border}`} color={p.fg}
            fontSize="14px" fontWeight="800"
            display="flex" alignItems="center" justifyContent="center" gap={1.5}
            _hover={{ bg: p.bgElev }} transition="background 0.15s">
            <Icon as={FiSend} boxSize={4} /> Send
          </Box>
        </HStack>

        {/* ── Wallet address ── */}
        {wallet && (
          <Box mt={5} p={5} borderRadius="20px"
            bg={p.cardBg} border={`1px solid ${p.border}`}>
            <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint}
              letterSpacing="0.08em" textTransform="uppercase" mb={3}>
              {isCrypto ? `${CHAIN_LABEL[sym] ?? sym} Address` : "Reference"}
            </Text>
            <Flex
              bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
              px={3} py={2.5} align="center" gap={2}
              cursor="pointer" _hover={{ bg: p.pillBg }}
              transition="background 0.12s" onClick={copy}
            >
              <Icon as={isCrypto ? FiCamera : FiArrowDownLeft}
                boxSize={3.5} color={p.fgMuted} flexShrink={0} />
              <Text fontSize="11.5px" fontWeight="600" color={p.fg}
                fontFamily="monospace" flex={1} noOfLines={1}>
                {addr}
              </Text>
              <Icon as={copied ? FiCheck : FiCopy} boxSize={3.5}
                color={copied ? p.greenFg : p.fgMuted} transition="color 0.15s" />
            </Flex>
            {isCrypto && (
              <Text fontSize="11px" color={p.fgFaint} mt={2.5} fontWeight="500">
                Send only {sym} on the {CHAIN_LABEL[sym] ?? sym} network.
              </Text>
            )}
          </Box>
        )}

        {/* ── Stats grid ── */}
        {lp && isCrypto && (
          <Flex mt={5} gap={3} flexWrap="wrap">
            {[
              { label: "24h High", value: `$${formatPrice(lp.high24h)}` },
              { label: "24h Low",  value: `$${formatPrice(lp.low24h)}` },
              { label: "24h Open", value: `$${formatPrice(lp.open24h)}` },
              { label: "Volume",   value: `$${fmtFiat(lp.volume24h)}` },
            ].map(s => (
              <Box key={s.label} flex="1 1 calc(50% - 8px)" minW="140px"
                p={4} borderRadius="14px"
                bg={p.cardBg} border={`1px solid ${p.border}`}>
                <Text fontSize="10px" fontWeight="700" color={p.fgFaint}
                  letterSpacing="0.08em" textTransform="uppercase" mb={1.5}>
                  {s.label}
                </Text>
                <Text fontSize="14px" fontWeight="700" color={p.fg}
                  style={{ fontVariant: "tabular-nums" }}>
                  {s.value}
                </Text>
              </Box>
            ))}
          </Flex>
        )}

        {/* ── Recent activity ── */}
        {txs.length > 0 && (
          <Box mt={5} borderRadius="20px"
            bg={p.cardBg} border={`1px solid ${p.border}`} overflow="hidden">
            <Text px={5} pt={4} pb={3} fontSize="10.5px" fontWeight="700"
              color={p.fgFaint} letterSpacing="0.08em" textTransform="uppercase">
              Recent {sym} Activity
            </Text>
            {txs.slice(0, 8).map(tx => {
              const isIn  = ["RECEIVE", "DEPOSIT", "TRANSFER_IN", "BUY"].includes(tx.type);
              const amt   = Math.abs(Number(tx.amount));
              const label = tx.description || (tx.type.charAt(0) + tx.type.slice(1).toLowerCase());
              const date  = new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <HStack
                  key={tx.id} px={5} py={3} spacing={3}
                  borderTop={`1px solid ${p.border}`}
                  _hover={{ bg: p.bg2 }} transition="background 0.12s"
                >
                  <Flex w="32px" h="32px" borderRadius="full" flexShrink={0}
                    bg={isIn ? p.greenBg : p.redBg} align="center" justify="center">
                    <Icon as={isIn ? FiArrowDown : FiArrowUp} boxSize={3.5}
                      color={isIn ? p.greenFg : p.redFg} />
                  </Flex>
                  <VStack align="start" spacing={0} flex={1} minW={0}>
                    <Text fontSize="13px" fontWeight="700" color={p.fg} noOfLines={1}>{label}</Text>
                    <Text fontSize="11px" color={p.fgMuted} fontWeight="500" mt={0.5}>{date}</Text>
                  </VStack>
                  <Text fontSize="13px" fontWeight="700" flexShrink={0}
                    color={isIn ? p.greenFg : p.fg}
                    style={{ fontVariant: "tabular-nums" }}>
                    {isIn ? "+" : "-"}{fmtFiat(amt)} {sym}
                  </Text>
                </HStack>
              );
            })}
          </Box>
        )}

      </Box>
    </Box>
  );
}
