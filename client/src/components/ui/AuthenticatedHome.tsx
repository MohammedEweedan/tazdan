"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import NextLink from "next/link";
import {
  Box, Flex, HStack, VStack, Text, Icon, Grid, GridItem,
  Spinner, useColorMode, Modal, ModalOverlay, ModalContent,
  ModalCloseButton, ModalBody, Input,
  Menu, MenuButton, MenuList, MenuItem,
} from "@chakra-ui/react";
import {
  FiBell, FiSettings, FiPlus, FiDollarSign, FiSend,
  FiArrowDownLeft, FiDownload, FiCopy, FiCheck,
  FiArrowUp, FiArrowDown, FiChevronRight, FiCamera,
  FiLogOut, FiHome, FiClock, FiBarChart2, FiMaximize2,
  FiMoreHorizontal, FiRepeat,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { walletAPI, transferAPI, orderAPI } from "@/lib/api";
import { BuyWidget } from "@/components/exchange/BuyWidget";
import { useBinanceLive, priceForCurrency, changeForCurrency } from "@/hooks/useBinanceLive";

/* ─────────────────────────────────────────────────────────────────
   PALETTE
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
    greenBg:   "rgba(34,197,94,0.12)",
    redFg:     "#ef4444",
    redBg:     "rgba(239,68,68,0.12)",
    brand:     "#226dff",
    cardBg:    dark ? "#0d0d0d" : "#f5f5f7",
    sidebarBg: dark ? "#050505" : "#f8f8f8",
  };
}

/* ─────────────────────────────────────────────────────────────────
   METADATA
   ───────────────────────────────────────────────────────────────── */
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
const FIAT_CURRENCIES   = ["USD", "EUR", "GBP", "AED", "SAR", "EGP"];
const CHAIN_LABEL: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum (ERC-20)", USDT: "Tron (TRC-20)",
  SOL: "Solana",  BNB: "BNB Smart Chain",   XRP:  "XRP Ledger",
  ADA: "Cardano", DOGE: "Dogecoin",
};

type Tab = "ASSETS" | "WALLETS" | "ACTIVITY";

/* ─────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────── */
function fmtFiat(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)         return n.toFixed(2);
  return n.toFixed(4);
}

function deriveAddress(walletId: string, currency: string): string {
  const s = walletId.replace(/-/g, "");
  if (currency === "BTC")  return `bc1q${s.slice(0, 38)}`;
  if (currency === "SOL")  return s.slice(0, 44);
  if (currency === "XRP")  return `r${s.slice(0, 33)}`;
  if (currency === "ADA")  return `addr1${s.slice(0, 56)}`;
  return `0x${s.slice(0, 40)}`;
}

/* MarketTick — derived from live WebSocket feed for the right-rail panel */
interface MarketTick { base: string; price: number; changePct24h: number }

/* ─────────────────────────────────────────────────────────────────
   ANIMATED BALANCE
   ───────────────────────────────────────────────────────────────── */
function AnimatedBalance({ value, fg }: { value: number; fg: string }) {
  const [displayed, setDisplayed] = useState(0);
  const fromRef  = useRef(0);
  const tgtRef   = useRef(value);
  const startRef = useRef<number | null>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    fromRef.current  = displayed;
    tgtRef.current   = value;
    startRef.current = Date.now();
    const dur        = firstRef.current ? 2400 : 1400;
    firstRef.current = false;
    let raf: number;
    const tick = () => {
      const t      = Math.min(1, (Date.now() - (startRef.current ?? Date.now())) / dur);
      const eased  = t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
      setDisplayed(fromRef.current + (tgtRef.current - fromRef.current) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]); // eslint-disable-line

  const str    = displayed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const digits = str.replace(/[^0-9]/g, "").length;
  const fs     = digits <= 7 ? "56px" : digits <= 9 ? "46px" : digits <= 11 ? "38px" : "30px";

  return (
    <Text fontSize={fs} fontWeight="800" letterSpacing="-0.05em" lineHeight={1}
      color={fg} style={{ fontVariant: "tabular-nums" }}>
      ${str}
    </Text>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SPARKLINE — deterministic, SSR-safe
   ───────────────────────────────────────────────────────────────── */
function Sparkline({ up, idx = 0 }: { up: boolean; idx?: number }) {
  const c = up ? "#22c55e" : "#ef4444";
  const n = 16;
  const pts = Array.from({ length: n }, (_, i) => {
    const x     = (i / (n - 1)) * 60;
    const trend = (up ? 1 : -1) * (i / (n - 1)) * 16;
    const wave  = Math.sin(i * 1.9 + idx) * 4 + Math.sin(i * 0.8 + idx * 1.3) * 2.5;
    return [x, Math.max(2, Math.min(26, 22 - trend - wave))] as [number, number];
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L60 28 L0 28 Z`;
  const gid  = `sp-${up ? "u" : "d"}-${idx}`;
  return (
    <svg viewBox="0 0 60 28" width="60" height="28" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.22" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CURRENCY ICON
   ───────────────────────────────────────────────────────────────── */
function CurrencyIcon({ currency, size = 44 }: { currency: string; size?: number }) {
  const m = ASSET_META[currency] ?? ASSET_META.DEFAULT;
  return (
    <Flex w={`${size}px`} h={`${size}px`} borderRadius="full" flexShrink={0}
      bg={m.bg} align="center" justify="center">
      <Text fontSize={`${Math.round(size * 0.38)}px`} fontWeight="700" color={m.fg} lineHeight={1}>{m.glyph}</Text>
    </Flex>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SIDEBAR
   ───────────────────────────────────────────────────────────────── */
function Sidebar({ p, handle, initial, emoji, onLogout }: {
  p: ReturnType<typeof pal>;
  handle: string;
  initial: string;
  emoji?: string;
  onLogout: () => void;
}) {
  const NAV = [
    { label: "Home",     href: "/",                   icon: FiHome },
    { label: "Trade",    href: "/dashboard/trade",    icon: FiBarChart2 },
    { label: "History",  href: "/dashboard/wallet",   icon: FiClock },
    { label: "Deposit",  href: "/dashboard/deposit",  icon: FiArrowDownLeft },
    { label: "Settings", href: "/dashboard/settings", icon: FiSettings },
  ];

  return (
    <Box
      display={{ base: "none", lg: "flex" }}
      flexDir="column"
      w="220px"
      minH="100vh"
      bg={p.sidebarBg}
      borderRight={`1px solid ${p.border}`}
      flexShrink={0}
      position="sticky"
      top={0}
      h="100vh"
      overflow="hidden"
    >
      {/* Wordmark */}
      <Box px={6} pt={7} pb={7}>
        <Text fontSize="19px" fontWeight="900" letterSpacing="-0.04em" color={p.fg}>
          Fortuni
        </Text>
      </Box>

      {/* Nav */}
      <VStack spacing={0.5} px={3} flex={1} align="stretch">
        {NAV.map(l => (
          <Box
            key={l.label}
            as={NextLink}
            href={l.href}
            display="flex" alignItems="center" gap={3}
            px={3} py={2.5} borderRadius="12px"
            color={p.fgMuted} fontSize="14px" fontWeight="600"
            _hover={{ bg: p.pillBg, color: p.fg }}
            transition="all 0.12s"
          >
            <Icon as={l.icon} boxSize={4} flexShrink={0} />
            {l.label}
          </Box>
        ))}
      </VStack>

      {/* User + logout */}
      <Box px={3} py={4} borderTop={`1px solid ${p.border}`}>
        <HStack
          as={NextLink} href="/dashboard/profile"
          spacing={2.5} px={2} mb={1} cursor="pointer"
          _hover={{ opacity: 0.75 }} transition="opacity 0.15s"
        >
          <Flex
            w="32px" h="32px" borderRadius="full"
            bg={emoji ? p.bgElev : "#7c3aed"}
            border={emoji ? `1px solid ${p.border}` : "none"}
            align="center" justify="center" flexShrink={0} overflow="hidden"
          >
            {emoji
              ? <Text fontSize="16px" lineHeight={1}>{emoji}</Text>
              : <Text color="#fff" fontWeight="800" fontSize="13px" lineHeight={1}>{initial}</Text>
            }
          </Flex>
          <Text fontSize="13px" fontWeight="700" color={p.fg} noOfLines={1}>@{handle}</Text>
        </HStack>

        <Box
          as="button" onClick={onLogout}
          display="flex" alignItems="center" gap={3}
          w="full" px={3} py={2.5} borderRadius="12px"
          color={p.fgMuted} fontSize="14px" fontWeight="600"
          _hover={{ bg: p.redBg, color: p.redFg }}
          transition="all 0.12s"
        >
          <Icon as={FiLogOut} boxSize={4} />
          Sign out
        </Box>
      </Box>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CARD PRIMITIVES
   ───────────────────────────────────────────────────────────────── */
function Card({ children, p, ...rest }: { children: React.ReactNode; p: ReturnType<typeof pal>; [k: string]: any }) {
  return (
    <Box bg={p.cardBg} border={`1px solid ${p.border}`} borderRadius="20px" overflow="hidden" {...rest}>
      {children}
    </Box>
  );
}

function CardHeader({ title, action, p }: { title: string; action?: React.ReactNode; p: ReturnType<typeof pal> }) {
  return (
    <HStack px={5} py={4} justify="space-between" borderBottom={`1px solid ${p.border}`}>
      <Text fontSize="10.5px" fontWeight="700" letterSpacing="0.08em" color={p.fgFaint} textTransform="uppercase">
        {title}
      </Text>
      {action}
    </HStack>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SECTION LABEL
   ───────────────────────────────────────────────────────────────── */
function SectionLabel({ label, p }: { label: string; p: ReturnType<typeof pal> }) {
  return (
    <Text px={5} pt={4} pb={1.5} fontSize="10.5px" fontWeight="700"
      letterSpacing="0.08em" color={p.fgFaint} textTransform="uppercase">
      {label}
    </Text>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ASSET ROW
   ───────────────────────────────────────────────────────────────── */
function AssetRow({ wallet, usdValue, changePct, idx, p, href }: {
  wallet: any; usdValue: number; changePct?: number; idx: number;
  p: ReturnType<typeof pal>; href: string;
}) {
  const m  = ASSET_META[wallet.currency] ?? ASSET_META.DEFAULT;
  const up = (changePct ?? 0) >= 0;
  return (
    <Box
      as={NextLink} href={href}
      display="flex" alignItems="center"
      px={5} py={3.5}
      borderBottom={`1px solid ${p.border}`}
      _hover={{ bg: p.bg2 }} transition="background 0.12s"
      cursor="pointer" gap={3}
      _last={{ borderBottom: "none" }}
    >
      <CurrencyIcon currency={wallet.currency} size={40} />
      <VStack align="start" spacing={0} flex={1} minW={0}>
        <Text fontSize="14px" fontWeight="700" color={p.fg} noOfLines={1}>{m.title}</Text>
        <Text fontSize="11.5px" color={p.fgMuted} fontWeight="500" mt={0.5} noOfLines={1}>
          {Number(wallet.balance).toLocaleString("en-US", {
            minimumFractionDigits: m.dec, maximumFractionDigits: m.dec,
          })} {wallet.currency}
        </Text>
      </VStack>
      <Sparkline up={up} idx={idx} />
      <VStack align="end" spacing={0} flexShrink={0} minW="80px">
        <Text fontSize="14px" fontWeight="700" color={p.fg} style={{ fontVariant: "tabular-nums" }}>
          ${fmtFiat(usdValue)}
        </Text>
        <Text fontSize="11px" fontWeight="600" mt={0.5}
          color={changePct !== undefined ? (up ? p.greenFg : p.redFg) : p.fgMuted}>
          {changePct !== undefined ? `${up ? "+" : ""}${changePct.toFixed(2)}%` : m.title}
        </Text>
      </VStack>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────────
   WALLET ROW
   ───────────────────────────────────────────────────────────────── */
function WalletRow({ wallet, p }: { wallet: any; p: ReturnType<typeof pal> }) {
  const m        = ASSET_META[wallet.currency] ?? ASSET_META.DEFAULT;
  const isCrypto = CRYPTO_CURRENCIES.includes(wallet.currency);
  const addr     = isCrypto
    ? deriveAddress(wallet.id, wallet.currency)
    : `PRMK-${wallet.currency}-${wallet.id.slice(0, 8).toUpperCase()}`;
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }, [addr]);

  return (
    <Box px={5} py={4} borderBottom={`1px solid ${p.border}`} _last={{ borderBottom: "none" }}>
      <HStack spacing={3} mb={2.5}>
        <CurrencyIcon currency={wallet.currency} size={40} />
        <VStack align="start" spacing={0} flex={1} minW={0}>
          <Text fontSize="14px" fontWeight="700" color={p.fg} noOfLines={1}>{m.title}</Text>
          <Text fontSize="11px" color={p.fgMuted} fontWeight="500" mt={0.5}>
            {CHAIN_LABEL[wallet.currency] ?? wallet.currency}
          </Text>
        </VStack>
        <Text fontSize="14px" fontWeight="600" color={p.fg} style={{ fontVariant: "tabular-nums" }}>
          ${fmtFiat(Number(wallet.fiatValueUsd || 0))}
        </Text>
      </HStack>
      <Flex
        bg={p.pillBg} border={`1px solid ${p.border}`} borderRadius="12px"
        px={3} py={2.5} align="center" gap={2}
        cursor="pointer" _hover={{ bg: p.bgElev }} transition="background 0.12s"
        onClick={copy}
      >
        <Icon as={isCrypto ? FiCamera : FiDownload} boxSize={3.5} color={p.fgMuted} flexShrink={0} />
        <Text fontSize="11.5px" fontWeight="600" color={p.fg} fontFamily="monospace" flex={1} noOfLines={1}>
          {addr}
        </Text>
        <Icon as={copied ? FiCheck : FiCopy} boxSize={3.5}
          color={copied ? p.greenFg : p.fgMuted} transition="color 0.15s" />
      </Flex>
    </Box>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ACTIVITY ROW
   ───────────────────────────────────────────────────────────────── */
function ActivityRow({ tx, p, compact = false }: { tx: any; p: ReturnType<typeof pal>; compact?: boolean }) {
  const isIn  = ["RECEIVE", "DEPOSIT", "TRANSFER_IN", "BUY"].includes(tx.type);
  const amt   = Math.abs(Number(tx.amount));
  const label = tx.description || (tx.type.charAt(0) + tx.type.slice(1).toLowerCase());
  const date  = new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <HStack
      px={5} py={compact ? 2.5 : 3.5} spacing={3}
      borderBottom={`1px solid ${p.border}`}
      _hover={{ bg: p.bg2 }} transition="background 0.12s"
      _last={{ borderBottom: "none" }}
    >
      <Flex
        w="34px" h="34px" borderRadius="full" flexShrink={0}
        bg={isIn ? p.greenBg : p.redBg} align="center" justify="center"
      >
        <Icon as={isIn ? FiArrowDown : FiArrowUp} boxSize={3.5}
          color={isIn ? p.greenFg : p.redFg} />
      </Flex>
      <VStack align="start" spacing={0} flex={1} minW={0}>
        <Text fontSize="13px" fontWeight="700" color={p.fg} noOfLines={1}>{label}</Text>
        <Text fontSize="11px" color={p.fgMuted} fontWeight="500" mt={0.5}>{date} · {tx.currency}</Text>
      </VStack>
      <Text fontSize="13px" fontWeight="700" flexShrink={0}
        color={isIn ? p.greenFg : p.fg}
        style={{ fontVariant: "tabular-nums" }}>
        {isIn ? "+" : "-"}{fmtFiat(amt)} {tx.currency}
      </Text>
    </HStack>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MARKET MOVER ROW
   ───────────────────────────────────────────────────────────────── */
function MarketMoverRow({ ticker, idx, p }: { ticker: MarketTick; idx: number; p: ReturnType<typeof pal> }) {
  const up = ticker.changePct24h >= 0;
  const m  = ASSET_META[ticker.base] ?? ASSET_META.DEFAULT;
  return (
    <HStack
      px={5} py={3} spacing={3}
      borderBottom={`1px solid ${p.border}`}
      _last={{ borderBottom: "none" }}
      _hover={{ bg: p.bg2 }} transition="background 0.12s"
    >
      <CurrencyIcon currency={ticker.base} size={36} />
      <VStack align="start" spacing={0} flex={1} minW={0}>
        <Text fontSize="13px" fontWeight="700" color={p.fg}>{ticker.base}</Text>
        <Text fontSize="11px" color={p.fgMuted} fontWeight="500">{m.title}</Text>
      </VStack>
      <Sparkline up={up} idx={idx + 20} />
      <VStack align="end" spacing={0} flexShrink={0} minW="70px">
        <Text fontSize="13px" fontWeight="700" color={p.fg} style={{ fontVariant: "tabular-nums" }}>
          ${fmtFiat(ticker.price)}
        </Text>
        <Text fontSize="11px" fontWeight="700" color={up ? p.greenFg : p.redFg}>
          {up ? "+" : ""}{ticker.changePct24h.toFixed(2)}%
        </Text>
      </VStack>
    </HStack>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MODAL — RECEIVE
   ───────────────────────────────────────────────────────────────── */
function ReceiveModal({ isOpen, onClose, wallets, p }: {
  isOpen: boolean; onClose: () => void; wallets: any[]; p: ReturnType<typeof pal>;
}) {
  const cryptoWallets = wallets.filter(w => CRYPTO_CURRENCIES.includes(w.currency));
  const [selected, setSelected] = useState(cryptoWallets[0]?.currency ?? "");
  const [copied, setCopied]     = useState(false);

  const wallet = cryptoWallets.find(w => w.currency === selected) ?? cryptoWallets[0];
  const addr   = wallet ? deriveAddress(wallet.id, wallet.currency) : "";
  const chain  = wallet ? (CHAIN_LABEL[wallet.currency] ?? wallet.currency) : "";
  const qrUrl  = addr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(addr)}&bgcolor=ffffff&color=000000`
    : "";

  const copy = useCallback(async () => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }, [addr]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(8px)" bg="rgba(0,0,0,0.6)" />
      <ModalContent bg={p.bg} border={`1px solid ${p.border}`} borderRadius="24px" mx={4}>
        <ModalCloseButton color={p.fgMuted} top={4} right={4} />
        <ModalBody p={6}>
          <Text fontSize="18px" fontWeight="800" color={p.fg} mb={4} letterSpacing="-0.3px">Receive</Text>

          {cryptoWallets.length > 1 && (
            <Box mb={4}>
              <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Network</Text>
              <HStack spacing={2} flexWrap="wrap">
                {cryptoWallets.map(w => (
                  <Box key={w.currency} as="button" onClick={() => setSelected(w.currency)}
                    px={3} py={1.5} borderRadius="full"
                    bg={selected === w.currency ? p.ctaBg : p.pillBg}
                    color={selected === w.currency ? p.ctaFg : p.fg}
                    border={`1px solid ${selected === w.currency ? "transparent" : p.border}`}
                    fontSize="12px" fontWeight="700" _hover={{ opacity: 0.8 }}>
                    {w.currency}
                  </Box>
                ))}
              </HStack>
            </Box>
          )}

          {qrUrl && (
            <Flex justify="center" mb={4}>
              <Box bg="#ffffff" borderRadius="18px" p={3} border={`1px solid ${p.border}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR Code" width={176} height={176} style={{ display: "block", borderRadius: "8px" }} />
              </Box>
            </Flex>
          )}

          <Box bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="14px" px={4} py={3} mb={3}>
            <Text fontSize="10px" fontWeight="700" color={p.fgFaint} letterSpacing="0.08em" textTransform="uppercase" mb={1.5}>
              {chain} Address
            </Text>
            <Text fontSize="11.5px" fontWeight="600" color={p.fg} fontFamily="monospace" wordBreak="break-all">
              {addr}
            </Text>
          </Box>

          <Box as="button" onClick={copy} w="full" h="44px" borderRadius="full"
            bg={copied ? p.greenBg : p.ctaBg} color={copied ? p.greenFg : p.ctaFg}
            fontSize="14px" fontWeight="800"
            display="flex" alignItems="center" justifyContent="center" gap={2}
            _hover={{ opacity: 0.85 }} transition="all 0.15s">
            <Icon as={copied ? FiCheck : FiCopy} boxSize={4} />
            {copied ? "Copied!" : "Copy address"}
          </Box>

          <Text fontSize="11px" color={p.fgFaint} textAlign="center" mt={3} fontWeight="500">
            Only send {wallet?.currency} on the {chain} network.
          </Text>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MODAL — SEND
   ───────────────────────────────────────────────────────────────── */
function SendModal({ isOpen, onClose, wallets, p }: {
  isOpen: boolean; onClose: () => void; wallets: any[]; p: ReturnType<typeof pal>;
}) {
  const ownedAll = wallets.filter(w => Number(w.balance) > 0);
  const [currency, setCurrency] = useState(ownedAll[0]?.currency ?? "BTC");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount]     = useState("");
  const [note, setNote]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  const wallet = wallets.find(w => w.currency === currency);
  const bal    = Number(wallet?.balance ?? 0);
  const m      = ASSET_META[currency] ?? ASSET_META.DEFAULT;

  const submit = async () => {
    setError("");
    if (!recipient.trim()) { setError("Enter a recipient."); return; }
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount."); return; }
    if (Number(amount) > bal) { setError("Insufficient balance."); return; }
    setLoading(true);
    try {
      const field = recipient.includes("@") ? "recipientEmail"
        : /^\+?\d{7,15}$/.test(recipient.trim()) ? "recipientPhone"
        : "recipientUsername";
      await transferAPI.send({ [field]: recipient.trim(), currency, amount: Number(amount), note: note || undefined });
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Transfer failed. Please try again.");
    } finally { setLoading(false); }
  };

  const reset = () => { setDone(false); setRecipient(""); setAmount(""); setNote(""); setError(""); };

  if (done) return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} isCentered size="sm">
      <ModalOverlay backdropFilter="blur(8px)" bg="rgba(0,0,0,0.6)" />
      <ModalContent bg={p.bg} border={`1px solid ${p.border}`} borderRadius="24px" mx={4}>
        <ModalBody p={8}>
          <VStack spacing={4} align="center">
            <Flex w="56px" h="56px" borderRadius="full" bg={p.greenBg} align="center" justify="center">
              <Icon as={FiCheck} boxSize={6} color={p.greenFg} />
            </Flex>
            <Text fontSize="18px" fontWeight="800" color={p.fg} letterSpacing="-0.3px">Transfer sent!</Text>
            <Text fontSize="13px" color={p.fgMuted} textAlign="center">
              {amount} {currency} sent to {recipient}
            </Text>
            <Box as="button" onClick={() => { onClose(); reset(); }} w="full" h="44px" borderRadius="full"
              bg={p.ctaBg} color={p.ctaFg} fontSize="14px" fontWeight="800" _hover={{ opacity: 0.85 }}>
              Done
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(8px)" bg="rgba(0,0,0,0.6)" />
      <ModalContent bg={p.bg} border={`1px solid ${p.border}`} borderRadius="24px" mx={4}>
        <ModalCloseButton color={p.fgMuted} top={4} right={4} />
        <ModalBody p={6}>
          <Text fontSize="18px" fontWeight="800" color={p.fg} mb={5} letterSpacing="-0.3px">Send</Text>

          <Box mb={4}>
            <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Asset</Text>
            <HStack spacing={2} flexWrap="wrap">
              {ownedAll.map(w => (
                <Box key={w.currency} as="button" onClick={() => { setCurrency(w.currency); setAmount(""); }}
                  px={3} py={1.5} borderRadius="full"
                  bg={currency === w.currency ? p.ctaBg : p.pillBg}
                  color={currency === w.currency ? p.ctaFg : p.fg}
                  border={`1px solid ${currency === w.currency ? "transparent" : p.border}`}
                  fontSize="12px" fontWeight="700" _hover={{ opacity: 0.8 }}>
                  {w.currency}
                </Box>
              ))}
            </HStack>
            <Text fontSize="11px" color={p.fgMuted} mt={1.5} fontWeight="500">
              Balance: {bal.toFixed(m.dec)} {currency}
            </Text>
          </Box>

          <Box mb={3}>
            <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>
              Recipient (email, phone, or @username)
            </Text>
            <Input value={recipient} onChange={e => setRecipient(e.target.value)}
              placeholder="user@email.com  or  @username"
              bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
              color={p.fg} _placeholder={{ color: p.fgFaint }}
              fontSize="14px" h="44px" px={4}
              _focus={{ borderColor: p.brand, boxShadow: "none" }} />
          </Box>

          <Box mb={5}>
            <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Amount</Text>
            <HStack spacing={2}>
              <Input value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" type="number" step="any"
                bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
                color={p.fg} _placeholder={{ color: p.fgFaint }}
                fontSize="14px" h="44px" px={4} flex={1}
                _focus={{ borderColor: p.brand, boxShadow: "none" }} />
              <Box as="button" onClick={() => setAmount(bal.toFixed(m.dec))}
                px={3} py={1.5} borderRadius="8px"
                bg={p.pillBg} border={`1px solid ${p.border}`}
                fontSize="12px" fontWeight="700" color={p.fgMuted}
                _hover={{ color: p.fg }}>
                MAX
              </Box>
            </HStack>
          </Box>

          {error && <Text fontSize="12px" color={p.redFg} mb={3} fontWeight="600">{error}</Text>}

          <Box as="button" onClick={submit} w="full" h="48px" borderRadius="full"
            bg={loading ? p.pillBg : p.ctaBg} color={loading ? p.fgMuted : p.ctaFg}
            fontSize="14px" fontWeight="800"
            display="flex" alignItems="center" justifyContent="center"
            _hover={{ opacity: 0.85 }} transition="all 0.15s"
            {...(loading ? { disabled: true } : {})}>
            {loading ? <Spinner size="sm" /> : `Send ${currency}`}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MODAL — SELL
   ───────────────────────────────────────────────────────────────── */
function SellModal({ isOpen, onClose, wallets, priceMap, p }: {
  isOpen: boolean; onClose: () => void; wallets: any[];
  priceMap: Record<string, number>; p: ReturnType<typeof pal>;
}) {
  const ownedCrypto = wallets.filter(w => CRYPTO_CURRENCIES.includes(w.currency) && Number(w.balance) > 0);
  const [currency, setCurrency] = useState(ownedCrypto[0]?.currency ?? "BTC");
  const [amount, setAmount]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  const wallet  = wallets.find(w => w.currency === currency);
  const bal     = Number(wallet?.balance ?? 0);
  const price   = priceMap[currency] ?? 0;
  const usdVal  = Number(amount || 0) * price;
  const m       = ASSET_META[currency] ?? ASSET_META.DEFAULT;

  const submit = async () => {
    setError("");
    if (!amount || Number(amount) <= 0) { setError("Enter an amount."); return; }
    if (Number(amount) > bal) { setError("Insufficient balance."); return; }
    setLoading(true);
    try {
      await orderAPI.create({ type: "MARKET", side: "SELL", baseCurrency: currency, quoteCurrency: "USD", amount: Number(amount) });
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Order failed. Please try again.");
    } finally { setLoading(false); }
  };

  const reset = () => { setDone(false); setAmount(""); setError(""); };

  if (done) return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); reset(); }} isCentered size="sm">
      <ModalOverlay backdropFilter="blur(8px)" bg="rgba(0,0,0,0.6)" />
      <ModalContent bg={p.bg} border={`1px solid ${p.border}`} borderRadius="24px" mx={4}>
        <ModalBody p={8}>
          <VStack spacing={4} align="center">
            <Flex w="56px" h="56px" borderRadius="full" bg={p.greenBg} align="center" justify="center">
              <Icon as={FiCheck} boxSize={6} color={p.greenFg} />
            </Flex>
            <Text fontSize="18px" fontWeight="800" color={p.fg} letterSpacing="-0.3px">Sell order placed!</Text>
            <Text fontSize="13px" color={p.fgMuted} textAlign="center">
              {amount} {currency} ≈ ${fmtFiat(usdVal)} USD
            </Text>
            <Box as="button" onClick={() => { onClose(); reset(); }} w="full" h="44px" borderRadius="full"
              bg={p.ctaBg} color={p.ctaFg} fontSize="14px" fontWeight="800" _hover={{ opacity: 0.85 }}>
              Done
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(8px)" bg="rgba(0,0,0,0.6)" />
      <ModalContent bg={p.bg} border={`1px solid ${p.border}`} borderRadius="24px" mx={4}>
        <ModalCloseButton color={p.fgMuted} top={4} right={4} />
        <ModalBody p={6}>
          <Text fontSize="18px" fontWeight="800" color={p.fg} mb={5} letterSpacing="-0.3px">Sell</Text>

          <Box mb={4}>
            <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Asset to sell</Text>
            <HStack spacing={2} flexWrap="wrap">
              {ownedCrypto.map(w => (
                <Box key={w.currency} as="button" onClick={() => { setCurrency(w.currency); setAmount(""); }}
                  px={3} py={1.5} borderRadius="full"
                  bg={currency === w.currency ? p.ctaBg : p.pillBg}
                  color={currency === w.currency ? p.ctaFg : p.fg}
                  border={`1px solid ${currency === w.currency ? "transparent" : p.border}`}
                  fontSize="12px" fontWeight="700" _hover={{ opacity: 0.8 }}>
                  {w.currency}
                </Box>
              ))}
            </HStack>
            {price > 0 && (
              <Text fontSize="11px" color={p.fgMuted} mt={1.5} fontWeight="500">
                Market: ${fmtFiat(price)} · Balance: {bal.toFixed(m.dec)} {currency}
              </Text>
            )}
          </Box>

          <Box mb={5}>
            <Text fontSize="10.5px" fontWeight="700" color={p.fgFaint} letterSpacing="0.07em" textTransform="uppercase" mb={2}>Amount ({currency})</Text>
            <HStack spacing={2}>
              <Input value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" type="number" step="any"
                bg={p.bgElev} border={`1px solid ${p.border}`} borderRadius="12px"
                color={p.fg} _placeholder={{ color: p.fgFaint }}
                fontSize="14px" h="44px" px={4} flex={1}
                _focus={{ borderColor: p.brand, boxShadow: "none" }} />
              <Box as="button" onClick={() => setAmount(bal.toFixed(m.dec))}
                px={3} py={1.5} borderRadius="8px"
                bg={p.pillBg} border={`1px solid ${p.border}`}
                fontSize="12px" fontWeight="700" color={p.fgMuted}
                _hover={{ color: p.fg }}>
                MAX
              </Box>
            </HStack>
            {Number(amount) > 0 && price > 0 && (
              <Text fontSize="11px" color={p.fgMuted} mt={1.5} fontWeight="500">
                ≈ ${fmtFiat(usdVal)} USD
              </Text>
            )}
          </Box>

          {error && <Text fontSize="12px" color={p.redFg} mb={3} fontWeight="600">{error}</Text>}

          <Box as="button" onClick={submit} w="full" h="48px" borderRadius="full"
            bg={loading ? p.pillBg : p.redFg} color={loading ? p.fgMuted : "#fff"}
            fontSize="14px" fontWeight="800"
            display="flex" alignItems="center" justifyContent="center"
            _hover={{ opacity: 0.85 }} transition="all 0.15s"
            {...(loading ? { disabled: true } : {})}>
            {loading ? <Spinner size="sm" /> : `Sell ${currency}`}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────────── */
export default function AuthenticatedHome() {
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const p    = pal(dark);

  const { user, logout } = useAuthStore();
  const handle  = user?.username || user?.email?.split("@")[0] || "me";
  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? "P").toUpperCase();
  const emoji   = (user as any)?.avatarUrl as string | undefined;

  const [tab, setTab]               = useState<Tab>("ASSETS");
  const [buyOpen, setBuyOpen]       = useState(false);
  const [sellOpen, setSellOpen]     = useState(false);
  const [sendOpen, setSendOpen]     = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [wallets, setWallets]       = useState<any[]>([]);
  const [transactions, setTxns]     = useState<any[]>([]);

  /* Live price feed — Binance WebSocket, sub-second updates */
  const live = useBinanceLive();

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(live).forEach(([base, lp]) => { m[base] = lp.price; });
    return m;
  }, [live]);

  const changeMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(live).forEach(([base, lp]) => { m[base] = lp.changePct24h; });
    return m;
  }, [live]);

  /* Initial wallet + transaction load */
  useEffect(() => {
    (async () => {
      try {
        const [walRes, txRes] = await Promise.all([
          walletAPI.getAll(),
          transferAPI.getHistory(1),
        ]);
        setWallets(walRes.data.wallets || []);
        // Server may return transactions under .data, .items, or .transactions
        const txList = txRes.data?.data ?? txRes.data?.items ?? txRes.data?.transactions ?? [];
        setTxns(Array.isArray(txList) ? txList : []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  /* Live total — re-derived from current WS prices on every tick */
  const totalUsd = useMemo(() => {
    if (!wallets.length) return 0;
    return wallets.reduce((sum, w) => {
      const px = priceForCurrency(w.currency, live);
      if (px !== undefined) return sum + Number(w.balance) * px;
      return sum + Number(w.fiatValueUsd || 0);
    }, 0);
  }, [wallets, live]);

  /* 24h delta — weighted by USD exposure, mirrors mobile aggregation */
  const deltaPct = useMemo(() => {
    if (totalUsd <= 0) return 0;
    let weighted = 0;
    wallets.forEach(w => {
      const px = priceForCurrency(w.currency, live);
      const pc = changeForCurrency(w.currency, live);
      if (px === undefined || pc === undefined) return;
      const exposure = Number(w.balance) * px;
      weighted += (exposure / totalUsd) * pc;
    });
    return weighted;
  }, [wallets, live, totalUsd]);

  const deltaUsd = (totalUsd * deltaPct) / 100;
  const positive = deltaUsd >= 0;

  const ownedWallets  = wallets.filter(w => Number(w.balance) > 0);
  const cryptoAssets  = ownedWallets.filter(w => CRYPTO_CURRENCIES.includes(w.currency));
  const fiatAssets    = ownedWallets.filter(w => FIAT_CURRENCIES.includes(w.currency));
  const cryptoWallets = wallets.filter(w => CRYPTO_CURRENCIES.includes(w.currency));
  const fiatWallets   = wallets.filter(w => FIAT_CURRENCIES.includes(w.currency));

  /* Market movers — sorted by biggest absolute 24h move */
  const marketMovers: MarketTick[] = useMemo(() =>
    Object.entries(live)
      .map(([base, lp]) => ({ base, price: lp.price, changePct24h: lp.changePct24h }))
      .sort((a, b) => Math.abs(b.changePct24h) - Math.abs(a.changePct24h))
      .slice(0, 7),
    [live]
  );

  const btnBg  = dark ? "#ffffff" : "#000000";
  const btnFg  = dark ? "#000000" : "#ffffff";

  if (loading) {
    return (
      <Flex minH="100vh" bg={p.bg} align="center" justify="center">
        <VStack spacing={4}>
          <Spinner size="xl" color={p.brand} thickness="3px" />
          <Text color={p.fgMuted} fontSize="13px" fontWeight="500">Loading portfolio…</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <>
      <Flex minH="100vh" bg={p.bg}>

        {/* ══ SIDEBAR ══ */}
        <Sidebar p={p} handle={handle} initial={initial} emoji={emoji} onLogout={logout} />

        {/* ══ MAIN SCROLL AREA ══ */}
        <Box flex={1} minH="100vh" overflow="auto">

          {/* Sticky top bar */}
          <HStack
            h="58px" px={{ base: 5, lg: 8 }}
            justify="space-between"
            borderBottom={`1px solid ${p.border}`}
            bg={p.bg} position="sticky" top={0} zIndex={10}
            backdropFilter="blur(12px)"
          >
            {/* Mobile: user pill */}
            <HStack
              as={NextLink} href="/dashboard/profile"
              spacing={2.5} cursor="pointer"
              _hover={{ opacity: 0.75 }} transition="opacity 0.15s"
              display={{ base: "flex", lg: "none" }}
            >
              <Flex w="30px" h="30px" borderRadius="full"
                bg={emoji ? p.bgElev : "#7c3aed"}
                border={emoji ? `1px solid ${p.border}` : "none"}
                align="center" justify="center" overflow="hidden">
                {emoji
                  ? <Text fontSize="16px" lineHeight={1}>{emoji}</Text>
                  : <Text color="#fff" fontWeight="800" fontSize="12px" lineHeight={1}>{initial}</Text>
                }
              </Flex>
              <Text fontSize="15px" fontWeight="700" color={p.fg}>@{handle}</Text>
            </HStack>

            {/* Desktop: date */}
            <Text
              fontSize="13px" color={p.fgMuted} fontWeight="600"
              display={{ base: "none", lg: "block" }}
            >
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </Text>

            <HStack spacing={2}>
              <Flex as={NextLink} href="/dashboard/notifications"
                w="36px" h="36px" borderRadius="full"
                bg={p.pillBg} border={`1px solid ${p.border}`}
                align="center" justify="center" cursor="pointer"
                _hover={{ bg: p.bgElev }} transition="background 0.12s">
                <Icon as={FiBell} boxSize={4} color={p.fg} />
              </Flex>
              <Flex as={NextLink} href="/dashboard/settings"
                w="36px" h="36px" borderRadius="full"
                bg={p.pillBg} border={`1px solid ${p.border}`}
                align="center" justify="center" cursor="pointer"
                _hover={{ bg: p.bgElev }} transition="background 0.12s">
                <Icon as={FiSettings} boxSize={4} color={p.fg} />
              </Flex>
            </HStack>
          </HStack>

          {/* ══ BALANCE HERO ══ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Box
              bg="#226dff"
              px={{ base: 6, lg: 10 }}
              pt={{ base: 10, lg: 14 }}
              pb={{ base: 10, lg: 14 }}
              borderBottomRadius={{ base: "32px", lg: "40px" }}
              position="relative"
              overflow="hidden"
            >
              {/* Decorative glows */}
              <Box position="absolute" top="-80px" right="-80px" w="280px" h="280px"
                borderRadius="full" bg="rgba(255,255,255,0.07)" pointerEvents="none" />
              <Box position="absolute" bottom="-60px" right="15%" w="200px" h="200px"
                borderRadius="full" bg="rgba(255,255,255,0.05)" pointerEvents="none" />
              <Box position="absolute" top="30%" left="-40px" w="120px" h="120px"
                borderRadius="full" bg="rgba(255,255,255,0.04)" pointerEvents="none" />

              <HStack spacing={2} mb={3} align="center">
                <Text fontSize="11px" fontWeight="700" color="rgba(255,255,255,0.65)"
                  letterSpacing="0.09em" textTransform="uppercase">
                  Total Portfolio Value
                </Text>
                {Object.keys(live).length > 0 && (
                  <HStack spacing={1.5} px={2} py={0.5} borderRadius="6px"
                    bg="rgba(255,255,255,0.15)">
                    <Box w="6px" h="6px" borderRadius="full" bg="#4ade80"
                      style={{ animation: "pulse 1.6s ease-in-out infinite" }} />
                    <Text fontSize="9px" fontWeight="800" color="#fff" letterSpacing="0.08em">LIVE</Text>
                    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
                  </HStack>
                )}
              </HStack>

              <AnimatedBalance value={totalUsd} fg="#ffffff" />

              <HStack spacing={3} mt={3} flexWrap="wrap">
                <Text fontSize="15px" fontWeight="600"
                  color={positive ? "#4ade80" : "#f87171"}
                  style={{ fontVariant: "tabular-nums" }}>
                  {positive ? "+" : "-"}${Math.abs(deltaUsd).toLocaleString("en-US", {
                    minimumFractionDigits: 2, maximumFractionDigits: 2,
                  })}
                </Text>
                <HStack spacing={1} px={2} py={1} borderRadius="8px"
                  bg={positive ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}>
                  <Icon as={positive ? FiArrowUp : FiArrowDown} boxSize={3}
                    color={positive ? "#4ade80" : "#f87171"} />
                  <Text fontSize="12px" fontWeight="700"
                    color={positive ? "#4ade80" : "#f87171"}>
                    {Math.abs(deltaPct).toFixed(2)}%
                  </Text>
                </HStack>
                <Text fontSize="12px" color="rgba(255,255,255,0.50)" fontWeight="500">24h change</Text>
              </HStack>

              {/* Action strip */}
              <HStack spacing={3} mt={9} flexWrap="wrap">
                {/* Buy */}
                <Box as="button" onClick={() => setBuyOpen(true)}
                  h="46px" px={6} borderRadius="full"
                  bg={btnBg} color={btnFg}
                  fontSize="14px" fontWeight="700"
                  display="flex" alignItems="center" gap={2}
                  cursor="pointer" _hover={{ opacity: 0.85 }} transition="opacity 0.15s"
                  flexShrink={0}>
                  <Icon as={FiPlus} boxSize={4} /> Buy
                </Box>
                {/* Sell */}
                <Box as="button" onClick={() => setSellOpen(true)}
                  h="46px" px={6} borderRadius="full"
                  bg={btnBg} color={btnFg}
                  fontSize="14px" fontWeight="700"
                  display="flex" alignItems="center" gap={2}
                  cursor="pointer" _hover={{ opacity: 0.85 }} transition="opacity 0.15s"
                  flexShrink={0}>
                  <Icon as={FiDollarSign} boxSize={4} /> Sell
                </Box>
                {/* Receive */}
                <Box as="button" onClick={() => setReceiveOpen(true)}
                  h="46px" px={6} borderRadius="full"
                  bg={btnBg} color={btnFg}
                  fontSize="14px" fontWeight="700"
                  display="flex" alignItems="center" gap={2}
                  cursor="pointer" _hover={{ opacity: 0.85 }} transition="opacity 0.15s"
                  flexShrink={0}>
                  <Icon as={FiArrowDownLeft} boxSize={4} /> Receive
                </Box>
                {/* Three-dot menu */}
                <Menu>
                  <MenuButton
                    as={Box}
                    w="46px" h="46px" borderRadius="full"
                    bg={btnBg} color={btnFg}
                    display="flex" alignItems="center" justifyContent="center"
                    cursor="pointer" _hover={{ opacity: 0.85 }} transition="opacity 0.15s"
                    flexShrink={0}
                  >
                    <Icon as={FiMoreHorizontal} boxSize={5} />
                  </MenuButton>
                  <MenuList
                    bg={p.bg} border={`1px solid ${p.border}`}
                    borderRadius="18px" py={2} minW="180px"
                    boxShadow="0 12px 40px rgba(0,0,0,0.18)"
                    zIndex={20}
                  >
                    <MenuItem
                      bg="transparent" color={p.fg}
                      _hover={{ bg: p.pillBg }}
                      fontSize="14px" fontWeight="600"
                      px={4} py={3}
                      as={NextLink} href="/dashboard/trade"
                    >
                      <HStack spacing={2.5}>
                        <Icon as={FiRepeat} boxSize={4} color={p.fgMuted} />
                        <Text>Swap</Text>
                      </HStack>
                    </MenuItem>
                    <MenuItem
                      bg="transparent" color={p.fg}
                      _hover={{ bg: p.pillBg }}
                      fontSize="14px" fontWeight="600"
                      px={4} py={3}
                      as={NextLink} href="/dashboard/deposit"
                    >
                      <HStack spacing={2.5}>
                        <Icon as={FiArrowDownLeft} boxSize={4} color={p.fgMuted} />
                        <Text>Deposit</Text>
                      </HStack>
                    </MenuItem>
                    <MenuItem
                      bg="transparent" color={p.fg}
                      _hover={{ bg: p.pillBg }}
                      fontSize="14px" fontWeight="600"
                      px={4} py={3}
                      onClick={() => setSendOpen(true)}
                    >
                      <HStack spacing={2.5}>
                        <Icon as={FiSend} boxSize={4} color={p.fgMuted} />
                        <Text>Withdraw</Text>
                      </HStack>
                    </MenuItem>
                  </MenuList>
                </Menu>
              </HStack>
            </Box>
          </motion.div>

          {/* ══ CONTENT GRID ══ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <Grid
              templateColumns={{ base: "1fr", xl: "1fr 300px" }}
              gap={4}
              px={{ base: 4, lg: 8 }}
              pt={{ base: 5, lg: 6 }}
              pb={12}
            >

              {/* ── LEFT: tabbed card ── */}
              <GridItem>
                <Card p={p}>
                  {/* Tab bar */}
                  <HStack spacing={0} px={5} borderBottom={`1px solid ${p.border}`}>
                    {(["ASSETS", "WALLETS", "ACTIVITY"] as Tab[]).map(t => (
                      <Box key={t} onClick={() => setTab(t)}
                        cursor="pointer" px={3} py={4} position="relative" mr={1}>
                        <Text
                          fontSize="13.5px"
                          fontWeight={tab === t ? "700" : "600"}
                          color={tab === t ? p.fg : p.fgFaint}
                          transition="color 0.15s"
                        >
                          {t === "ASSETS" ? "Assets" : t === "WALLETS" ? "Wallets" : "Activity"}
                        </Text>
                        {tab === t && (
                          <Box position="absolute" bottom={0} left={3} right={3}
                            h="2px" bg={p.fg} borderRadius="2px" />
                        )}
                      </Box>
                    ))}
                  </HStack>

                  {/* Tab content */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                    >
                      {/* ASSETS */}
                      {tab === "ASSETS" && (
                        ownedWallets.length === 0 ? (
                          <VStack py={16} spacing={3} align="center">
                            <Flex w="52px" h="52px" borderRadius="full"
                              bg={p.pillBg} border={`1px solid ${p.border}`}
                              align="center" justify="center">
                              <Icon as={FiMaximize2} boxSize={5} color={p.fgMuted} />
                            </Flex>
                            <Text fontSize="16px" fontWeight="800" color={p.fg} letterSpacing="-0.2px">
                              No assets owned
                            </Text>
                            <Text fontSize="13px" color={p.fgMuted}>Buy or deposit to get started.</Text>
                            <HStack spacing={2.5} mt={1}>
                              <Box as="button" onClick={() => setBuyOpen(true)}
                                px={5} py={2.5} borderRadius="full"
                                bg={p.ctaBg} color={p.ctaFg}
                                fontSize="13px" fontWeight="800"
                                display="flex" alignItems="center" gap={1.5}
                                _hover={{ opacity: 0.85 }}>
                                <Icon as={FiPlus} boxSize={3.5} /> Buy crypto
                              </Box>
                              <Box as={NextLink} href="/dashboard/deposit"
                                px={5} py={2.5} borderRadius="full"
                                bg={p.pillBg} border={`1px solid ${p.border}`}
                                fontSize="13px" fontWeight="800" color={p.fg}
                                display="flex" alignItems="center" gap={1.5}
                                _hover={{ bg: p.bgElev }}>
                                <Icon as={FiArrowDownLeft} boxSize={3.5} /> Deposit
                              </Box>
                            </HStack>
                          </VStack>
                        ) : (
                          <>
                            {cryptoAssets.length > 0 && (
                              <>
                                <SectionLabel label="Crypto Assets" p={p} />
                                {cryptoAssets.map((w, i) => {
                                  const live = priceMap[w.currency];
                                  const usd  = live !== undefined ? Number(w.balance) * live : Number(w.fiatValueUsd || 0);
                                  return (
                                    <AssetRow key={w.id} wallet={w} usdValue={usd}
                                      changePct={changeMap[w.currency]} idx={i} p={p}
                                      href={`/asset/${w.currency}`} />
                                  );
                                })}
                              </>
                            )}
                            {fiatAssets.length > 0 && (
                              <>
                                <SectionLabel label="Fiat Assets" p={p} />
                                {fiatAssets.map((w, i) => (
                                  <AssetRow key={w.id} wallet={w}
                                    usdValue={Number(w.fiatValueUsd || 0)}
                                    idx={i + 10} p={p}
                                    href={`/asset/${w.currency}`} />
                                ))}
                              </>
                            )}
                          </>
                        )
                      )}

                      {/* WALLETS */}
                      {tab === "WALLETS" && (
                        wallets.length === 0 ? (
                          <VStack py={16} spacing={2} align="center">
                            <Text fontSize="14px" color={p.fgMuted}>No wallets yet.</Text>
                          </VStack>
                        ) : (
                          <>
                            {cryptoWallets.length > 0 && (
                              <>
                                <SectionLabel label="Crypto Wallets" p={p} />
                                {cryptoWallets.map(w => <WalletRow key={w.id} wallet={w} p={p} />)}
                              </>
                            )}
                            {fiatWallets.length > 0 && (
                              <>
                                <SectionLabel label="Fiat Wallets" p={p} />
                                {fiatWallets.map(w => <WalletRow key={w.id} wallet={w} p={p} />)}
                              </>
                            )}
                          </>
                        )
                      )}

                      {/* ACTIVITY */}
                      {tab === "ACTIVITY" && (
                        transactions.length === 0 ? (
                          <VStack py={16} spacing={2} align="center">
                            <Text fontSize="14px" color={p.fgMuted}>No activity yet.</Text>
                          </VStack>
                        ) : (
                          <>
                            {transactions.slice(0, 15).map(tx => <ActivityRow key={tx.id} tx={tx} p={p} />)}
                            <Box
                              as={NextLink} href="/dashboard/wallet"
                              display="flex" alignItems="center" justifyContent="center" gap={2}
                              mx={5} my={4} h="42px" borderRadius="full"
                              bg={p.pillBg} border={`1px solid ${p.border}`}
                              fontSize="13px" fontWeight="700" color={p.fg}
                              _hover={{ bg: p.bgElev }} cursor="pointer">
                              See all transactions
                              <Icon as={FiChevronRight} boxSize={4} />
                            </Box>
                          </>
                        )
                      )}
                    </motion.div>
                  </AnimatePresence>
                </Card>
              </GridItem>

              {/* ── RIGHT: market movers + activity ── */}
              <GridItem display={{ base: "none", xl: "block" }}>
                <VStack spacing={4} align="stretch">

                  {/* Market movers */}
                  <Card p={p}>
                    <CardHeader title="Market Movers" p={p}
                      action={
                        <Box as={NextLink} href="/dashboard/trade"
                          fontSize="11px" fontWeight="700" color={p.brand}
                          _hover={{ opacity: 0.7 }}>
                          Trade →
                        </Box>
                      }
                    />
                    {marketMovers.length === 0 ? (
                      <VStack py={8} spacing={2} align="center">
                        <Spinner size="sm" color={p.brand} />
                        <Text fontSize="12px" color={p.fgMuted}>Loading…</Text>
                      </VStack>
                    ) : (
                      marketMovers.map((t, i) => (
                        <MarketMoverRow key={t.base} ticker={t} idx={i} p={p} />
                      ))
                    )}
                  </Card>

                  {/* Recent activity */}
                  {transactions.length > 0 && (
                    <Card p={p}>
                      <CardHeader title="Recent Activity" p={p}
                        action={
                          <Box as="button" onClick={() => setTab("ACTIVITY")}
                            fontSize="11px" fontWeight="700" color={p.brand}
                            _hover={{ opacity: 0.7 }}>
                            View all →
                          </Box>
                        }
                      />
                      {transactions.slice(0, 5).map(tx => (
                        <ActivityRow key={tx.id} tx={tx} p={p} compact />
                      ))}
                    </Card>
                  )}

                </VStack>
              </GridItem>

            </Grid>
          </motion.div>
        </Box>
      </Flex>

      {/* ══ MODALS ══ */}

      <Modal isOpen={buyOpen} onClose={() => setBuyOpen(false)} size="xl" isCentered>
        <ModalOverlay backdropFilter="blur(8px)" bg="rgba(0,0,0,0.55)" />
        <ModalContent bg={p.bg} border={`1px solid ${p.border}`} borderRadius="24px" mx={4}>
          <ModalCloseButton color={p.fgMuted} top={4} right={4} />
          <ModalBody p={6}><BuyWidget /></ModalBody>
        </ModalContent>
      </Modal>

      <SellModal isOpen={sellOpen} onClose={() => setSellOpen(false)} wallets={wallets} priceMap={priceMap} p={p} />
      <SendModal isOpen={sendOpen} onClose={() => setSendOpen(false)} wallets={wallets} p={p} />
      <ReceiveModal isOpen={receiveOpen} onClose={() => setReceiveOpen(false)} wallets={wallets} p={p} />
    </>
  );
}
