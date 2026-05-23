"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NextLink from "next/link";
import {
  Box, Text, VStack, HStack, Flex, Button, Icon, Badge, Avatar,
  Spinner, useToast,
} from "@chakra-ui/react";
import {
  FiArrowDownLeft, FiArrowUpRight, FiRepeat, FiSend,
  FiTrendingUp, FiTrendingDown, FiBell, FiSettings,
  FiPlus, FiMinus, FiCopy, FiCreditCard, FiInbox,
  FiArrowRight,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { walletAPI, transferAPI, exchangeAPI } from "@/lib/api";
import { useDashboardTokens, PageShell } from "@/components/dashboard/DashboardUI";
import { WalletAddressCard } from "@/components/wallet/WalletAddressCard";

/* ─── Types ─── */
type TabKey = "ASSETS" | "WALLETS" | "ACTIVITY";

/* ─── Currency meta ─── */
const ASSET_META: Record<string, { title: string; decimals: number }> = {
  BTC: { title: "Bitcoin", decimals: 8 },
  ETH: { title: "Ethereum", decimals: 6 },
  USDT: { title: "Tether", decimals: 2 },
  SOL: { title: "Solana", decimals: 4 },
  BNB: { title: "BNB", decimals: 4 },
  XRP: { title: "XRP", decimals: 4 },
  ADA: { title: "Cardano", decimals: 4 },
  DOGE: { title: "Dogecoin", decimals: 4 },
  MATIC: { title: "Polygon", decimals: 4 },
  DOT: { title: "Polkadot", decimals: 4 },
  AVAX: { title: "Avalanche", decimals: 4 },
  USD: { title: "US Dollar", decimals: 2 },
  EUR: { title: "Euro", decimals: 2 },
  GBP: { title: "British Pound", decimals: 2 },
  AED: { title: "UAE Dirham", decimals: 2 },
  SAR: { title: "Saudi Riyal", decimals: 2 },
  EGP: { title: "Egyptian Pound", decimals: 2 },
  DEFAULT: { title: "Asset", decimals: 4 },
};

const ICON_CFG: Record<string, { bg: string; fg: string; glyph: string }> = {
  BTC: { bg: "#f7931a", fg: "#fff", glyph: "₿" },
  ETH: { bg: "#627eea", fg: "#fff", glyph: "Ξ" },
  USDT: { bg: "#26a17b", fg: "#fff", glyph: "₮" },
  SOL: { bg: "#9945ff", fg: "#fff", glyph: "◎" },
  BNB: { bg: "#f3ba2f", fg: "#000", glyph: "B" },
  XRP: { bg: "#23292f", fg: "#fff", glyph: "✕" },
  ADA: { bg: "#0033ad", fg: "#fff", glyph: "₳" },
  DOGE: { bg: "#c3a634", fg: "#fff", glyph: "Ð" },
  MATIC: { bg: "#8247e5", fg: "#fff", glyph: "◆" },
  DOT: { bg: "#e6007a", fg: "#fff", glyph: "●" },
  AVAX: { bg: "#e84142", fg: "#fff", glyph: "▲" },
  USD: { bg: "#2775ca", fg: "#fff", glyph: "$" },
  EUR: { bg: "#1a73e8", fg: "#fff", glyph: "€" },
  GBP: { bg: "#7c3aed", fg: "#fff", glyph: "£" },
  AED: { bg: "#0f766e", fg: "#fff", glyph: "د" },
  SAR: { bg: "#15803d", fg: "#fff", glyph: "﷼" },
  EGP: { bg: "#dc2626", fg: "#fff", glyph: "£" },
  DEFAULT: { bg: "rgba(125,125,125,0.2)", fg: "#888", glyph: "?" },
};

const CHAIN_LABEL: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum (ERC-20)", USDT: "Tron (TRC-20)",
  SOL: "Solana", BNB: "BNB Smart Chain", XRP: "XRP Ledger",
  ADA: "Cardano", DOGE: "Dogecoin", MATIC: "Polygon",
  DOT: "Polkadot", AVAX: "Avalanche C-Chain",
};

const TXN_ICON: Record<string, { icon: any; label: string; color: string }> = {
  BUY: { icon: FiPlus, label: "Buy", color: "#22c55e" },
  SELL: { icon: FiMinus, label: "Sell", color: "#ef4444" },
  DEPOSIT: { icon: FiArrowDownLeft, label: "Deposit", color: "#22c55e" },
  WITHDRAW: { icon: FiArrowUpRight, label: "Withdraw", color: "#ef4444" },
  SEND: { icon: FiSend, label: "Send", color: "#ef4444" },
  TRANSFER_OUT: { icon: FiSend, label: "Sent", color: "#ef4444" },
  RECEIVE: { icon: FiArrowDownLeft, label: "Received", color: "#22c55e" },
  TRANSFER_IN: { icon: FiArrowDownLeft, label: "Received", color: "#22c55e" },
  AGENT_DEPOSIT: { icon: FiArrowDownLeft, label: "Agent Deposit", color: "#22c55e" },
  AGENT_WITHDRAWAL: { icon: FiArrowUpRight, label: "Agent Withdrawal", color: "#ef4444" },
  DEFAULT: { icon: FiRepeat, label: "Transaction", color: "#94a3b8" },
};

/* ─── Counter animation ─── */
function Counter({ to }: { to: number }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
      setVal(to * ease);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [to]);
  return <>${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

/* ─── Live prices hook (Binance) ─── */
const SEED_PRICES: Record<string, { price: number; change: number }> = {
  BTCUSDT: { price: 114200.20, change: 2.34 },
  ETHUSDT: { price: 4111.02, change: 1.82 },
  SOLUSDT: { price: 162.44, change: 5.12 },
  BNBUSDT: { price: 612.30, change: -0.42 },
  XRPUSDT: { price: 0.612, change: 0.88 },
};

function useLivePrices() {
  const [prices, setPrices] = useState(SEED_PRICES);
  useEffect(() => {
    let alive = true;
    const go = async () => {
      try {
        const symbols = Object.keys(SEED_PRICES);
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data: Array<{ symbol: string; lastPrice: string; priceChangePercent: string }> = await res.json();
        if (!alive) return;
        const next: typeof SEED_PRICES = {};
        for (const d of data) next[d.symbol] = { price: parseFloat(d.lastPrice), change: parseFloat(d.priceChangePercent) };
        setPrices((p) => ({ ...p, ...next }));
      } catch { /* keep seed */ }
    };
    go();
    const id = setInterval(go, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return prices;
}

/* ══════════════════════════════════════
   COMPONENT
══════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuthStore();
  const tok = useDashboardTokens();
  const toast = useToast();
  const prices = useLivePrices();

  const [tab, setTab] = useState<TabKey>("ASSETS");
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    Promise.all([
      walletAPI.getAll().catch(() => ({ data: { wallets: [] } })),
      transferAPI.getHistory(1).catch(() => ({ data: { data: [] } })),
    ]).then(([wRes, tRes]: any[]) => {
      const w = wRes.data.wallets || wRes.data || [];
      setWallets(Array.isArray(w) ? w : []);
      const t = tRes.data.data || tRes.data || [];
      setTransactions(Array.isArray(t) ? t : []);
      setLoading(false);
    });
  }, []);

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [sym, p] of Object.entries(prices)) {
      const cur = sym.replace("USDT", "");
      map[cur] = p.price;
    }
    return map;
  }, [prices]);

  const totalUsd = useMemo(() => {
    return wallets.reduce((sum, w) => {
      const live = priceMap[w.currency];
      if (live !== undefined) return sum + Number(w.balance) * live;
      return sum + Number(w.fiatValueUsd || w.balance * (w.usdRate || 1));
    }, 0);
  }, [wallets, priceMap]);

  const deltaPct = useMemo(() => {
    if (totalUsd <= 0) return 0;
    let weighted = 0;
    wallets.forEach((w) => {
      const sym = `${w.currency}USDT`;
      const p = prices[sym];
      if (!p) return;
      const exposure = Number(w.balance) * p.price;
      weighted += (exposure / totalUsd) * p.change;
    });
    return weighted;
  }, [wallets, prices, totalUsd]);

  const mask = (s: string) => (showBalance ? s : "••••••");
  const positive = deltaPct >= 0;
  const handle = (user as any)?.username ?? user?.email?.split("@")[0] ?? "me";
  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? "P").toUpperCase();
  const userEmoji = (user as any)?.avatarUrl;

  const actions = [
    { href: "/dashboard/trade", icon: FiPlus, label: "Buy", accent: "#22c55e" },
    { href: "/dashboard/trade", icon: FiMinus, label: "Sell", accent: "#ef4444" },
    { href: "/dashboard/send", icon: FiSend, label: "Send", accent: tok.brand },
    { href: "/dashboard/wallet", icon: FiArrowDownLeft, label: "Receive", accent: "#8b5cf6" },
    { href: "/dashboard/deposit", icon: FiArrowDownLeft, label: "Deposit", accent: "#0891b2" },
  ];

  if (loading) {
    return (
      <PageShell>
        <Flex align="center" justify="center" minH="60vh">
          <VStack spacing={4}>
            <Spinner size="xl" color={tok.brand} />
            <Text color={tok.textMuted} fontSize="13px">Loading your portfolio...</Text>
          </VStack>
        </Flex>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* ── Header ── */}
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
          {userEmoji ? (
            <Flex
              w="32px" h="32px" borderRadius="full"
              bg={tok.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
              border="1px solid"
              borderColor={tok.panelBorder}
              align="center" justify="center"
              fontSize="18px"
            >
              {userEmoji}
            </Flex>
          ) : (
            <Avatar size="sm" name={initial} bg="linear-gradient(135deg, #7c3aed, #226dff)" color="white" fontWeight="800" />
          )}
          <Text fontSize="17px" fontWeight="700" color={tok.textMain}>@{handle}</Text>
        </HStack>
        <HStack spacing={2}>
          <Button as={NextLink} href="/dashboard/notifications" size="sm" variant="ghost" borderRadius="full" w="36px" h="36px" p={0} color={tok.textSub} _hover={{ bg: tok.hover }}>
            <Icon as={FiBell} boxSize={4} />
          </Button>
          <Button as={NextLink} href="/dashboard/settings" size="sm" variant="ghost" borderRadius="full" w="36px" h="36px" p={0} color={tok.textSub} _hover={{ bg: tok.hover }}>
            <Icon as={FiSettings} boxSize={4} />
          </Button>
        </HStack>
      </Flex>

      {/* ── Total Balance ── */}
      <Box textAlign="center" mb={2}>
        <Text fontSize={{ base: "38px", md: "52px" }} fontWeight="900" color={tok.textMain} letterSpacing="-0.04em" lineHeight={1} fontFamily="'DM Sans', sans-serif">
          <Counter to={totalUsd} />
        </Text>
      </Box>

      {/* ── 24h Delta ── */}
      <Flex justify="center" align="center" gap={3} mb={8}>
        <Text color={positive ? tok.success : tok.danger} fontSize="14px" fontWeight="600">
          {positive ? "+" : "-"}${Math.abs(totalUsd * deltaPct / 100).toFixed(2)}
        </Text>
        <Badge
          bg={positive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}
          color={positive ? tok.success : tok.danger}
          px={2.5} py={1} borderRadius="full" fontSize="12px" fontWeight="700"
        >
          <Icon as={positive ? FiTrendingUp : FiTrendingDown} mr={1} boxSize={3} />
          {Math.abs(deltaPct).toFixed(2)}%
        </Badge>
      </Flex>

      {/* ── 5 Action Buttons ── */}
      <Flex justify="center" gap={{ base: 2, md: 4 }} mb={8}>
        {actions.map((a) => (
          <VStack key={a.label} as={NextLink} href={a.href} spacing={1.5} align="center" role="group" cursor="pointer">
            <Flex
              w={{ base: "52px", md: "56px" }} h={{ base: "52px", md: "56px" }}
              borderRadius="full"
              bg={tok.dark ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.06)"}
              border="1px solid"
              borderColor={tok.dark ? "rgba(255,255,255,0.1)" : "rgba(0,87,184,0.1)"}
              align="center" justify="center"
              transition="all 0.18s"
              _groupHover={{ bg: `${a.accent}15`, transform: "translateY(-2px)", borderColor: `${a.accent}40` }}
            >
              <Icon as={a.icon} color={a.accent} boxSize={5} />
            </Flex>
            <Text fontSize="11px" fontWeight="700" color={tok.textMain}>{a.label}</Text>
          </VStack>
        ))}
      </Flex>

      {/* ── Tabs: Assets | Wallets | Activity ── */}
      <Flex justify="center" gap={8} mb={2} borderBottom="1px solid" borderColor={tok.panelBorder}>
        {(["ASSETS", "WALLETS", "ACTIVITY"] as TabKey[]).map((t) => (
          <Box key={t} position="relative" pb={3} cursor="pointer" onClick={() => setTab(t)}>
            <Text fontSize="15px" fontWeight={tab === t ? 700 : 600} color={tab === t ? tok.textMain : tok.textMuted}>
              {t}
            </Text>
            {tab === t && (
              <Box position="absolute" bottom="-1px" left={0} right={0} h="2px" bg={tok.brand} borderRadius="full" />
            )}
          </Box>
        ))}
      </Flex>

      {/* ── Tab Content ── */}
      <Box mt={4}>
        {tab === "ACTIVITY" ? (
          <ActivityList items={transactions} tok={tok} />
        ) : tab === "WALLETS" ? (
          <WalletList wallets={wallets} tok={tok} toast={toast} />
        ) : (
          <AssetList wallets={wallets} priceMap={priceMap} tok={tok} mask={mask} />
        )}
      </Box>
    </PageShell>
  );
}

/* ── Asset List ── */
function AssetList({ wallets, priceMap, tok, mask }: { wallets: any[]; priceMap: Record<string, number>; tok: any; mask: (s: string) => string }) {
  if (wallets.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Icon as={FiInbox} boxSize={8} color={tok.textMuted} mb={3} />
        <Text color={tok.textMuted} fontSize="13px">No assets yet.</Text>
        <Button as={NextLink} href="/dashboard/deposit" mt={4} size="sm" borderRadius="full" bg={tok.brand} color="white" fontWeight="700">
          Top up to start
        </Button>
      </Box>
    );
  }
  return (
    <VStack align="stretch" spacing={0}>
      {wallets.map((w) => {
        const meta = ASSET_META[w.currency] ?? ASSET_META.DEFAULT;
        const cfg = ICON_CFG[w.currency] ?? ICON_CFG.DEFAULT;
        const live = priceMap[w.currency];
        const usd = live !== undefined ? Number(w.balance) * live : Number(w.fiatValueUsd || 0);
        return (
          <Flex
            key={w.id}
            as={NextLink}
            href={`/dashboard/wallet`}
            align="center" justify="space-between"
            py={4} px={2}
            borderBottom="1px solid" borderColor={tok.panelBorder}
            _hover={{ bg: tok.hover }} transition="background 0.15s"
          >
            <HStack spacing={3}>
              <CurrencyIcon currency={w.currency} dark={tok.bg === "#0f1117"} />
              <Box>
                <Text fontSize="14px" fontWeight="700" color={tok.textMain}>{meta.title}</Text>
                <Text fontSize="12px" color={tok.textMuted}>
                  {Number(w.balance).toLocaleString("en-US", { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals })} {w.currency}
                </Text>
              </Box>
            </HStack>
            <VStack align="flex-end" spacing={0}>
              <Text fontSize="14px" fontWeight="700" color={tok.textMain} fontFamily="monospace">
                {mask(`$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
              </Text>
            </VStack>
          </Flex>
        );
      })}
    </VStack>
  );
}

/* ── Wallet List (addresses) ── */
function WalletList({ wallets, tok, toast }: { wallets: any[]; tok: any; toast: any }) {
  const crypto = ["BTC", "ETH", "USDT", "SOL", "BNB", "XRP", "ADA", "DOGE", "MATIC", "DOT", "AVAX"];
  if (wallets.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Icon as={FiCreditCard} boxSize={8} color={tok.textMuted} mb={3} />
        <Text color={tok.textMuted} fontSize="13px">No wallets yet.</Text>
      </Box>
    );
  }
  return (
    <VStack align="stretch" spacing={4}>
      {wallets.map((w) => {
        const isCrypto = crypto.includes(w.currency);
        if (!isCrypto) return null;
        
        const network = w.currency === 'USDT' ? 'ERC20' : w.currency;
        return (
          <WalletAddressCard
            key={w.id}
            asset={w.currency as 'ETH' | 'BTC' | 'SOL' | 'USDT'}
            network={network}
            label={`${w.currency} · ${network}`}
          />
        );
      })}
    </VStack>
  );
}

/* ── Activity List ── */
function ActivityList({ items, tok }: { items: any[]; tok: any }) {
  if (items.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Icon as={FiInbox} boxSize={8} color={tok.textMuted} mb={3} />
        <Text color={tok.textMuted} fontSize="13px">No activity yet.</Text>
      </Box>
    );
  }
  return (
    <VStack align="stretch" spacing={0}>
      {items.slice(0, 10).map((t) => {
        const cfg = TXN_ICON[t.type] ?? TXN_ICON.DEFAULT;
        const amt = Number(t.amount);
        const isIn = t.type === "DEPOSIT" || t.type === "RECEIVE" || t.type === "TRANSFER_IN" || t.type === "BUY";
        return (
          <Flex key={t.id} align="center" gap={3} py={3} px={2} borderBottom="1px solid" borderColor={tok.panelBorder} _hover={{ bg: tok.hover }} transition="background 0.15s">
            <CurrencyIcon currency={t.currency || "USD"} dark={tok.bg === "#0f1117"} />
            <Box flex={1} minW={0}>
              <Text fontSize="13px" fontWeight="700" color={tok.textMain} noOfLines={1}>{cfg.label}</Text>
              <Text fontSize="11px" color={tok.textMuted}>{new Date(t.createdAt).toLocaleDateString()} · {t.type}</Text>
            </Box>
            <Text fontSize="13px" fontWeight="700" fontFamily="monospace" flexShrink={0} color={isIn ? tok.success : tok.textMain}>
              {isIn ? "+" : "-"}{Math.abs(amt).toLocaleString("en-US", { maximumFractionDigits: 6 })} {t.currency || "USDT"}
            </Text>
          </Flex>
        );
      })}
      <Button as={NextLink} href="/dashboard/wallet" mt={4} variant="ghost" borderRadius="full" color={tok.brand} fontWeight="700">
        See all transactions <Icon as={FiArrowRight} ml={1} />
      </Button>
    </VStack>
  );
}

/* ── Helpers ── */
function CurrencyIcon({ currency, dark }: { currency: string; dark: boolean }) {
  const cfg = ICON_CFG[currency] ?? ICON_CFG.DEFAULT;
  const fs = (cfg as any).fontSize;
  return (
    <Flex w="38px" h="38px" borderRadius="full" bg="transparent" align="center" justify="center">
      <Text fontSize={fs ? `${fs + 4}px` : "22px"} fontWeight="700" color={dark ? "#f1f0ee" : "#0f172a"}>
        {cfg.glyph}
      </Text>
    </Flex>
  );
}

function deriveAddress(walletId: string, currency: string): string {
  const seed = walletId.replace(/-/g, "");
  if (currency === "BTC") return `bc1q${seed.slice(0, 38)}`;
  if (currency === "SOL") return seed.slice(0, 44);
  if (currency === "XRP") return `r${seed.slice(0, 33)}`;
  if (currency === "ADA") return `addr1${seed.slice(0, 56)}`;
  return `0x${seed.slice(0, 40)}`;
}
