"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Box, Text, VStack, HStack, Flex, Button, Icon, Badge,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiArrowUpRight, FiArrowDownLeft, FiRepeat, FiSend,
  FiTrendingUp, FiTrendingDown, FiEye, FiEyeOff,
  FiCreditCard, FiShoppingBag, FiDollarSign, FiBarChart2,
  FiGift, FiArrowRight, FiZap, FiInbox,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { walletAPI, exchangeAPI } from "@/lib/api";
import {
  PageShell, PageHeader, GlassCard, SectionHeader, StatTile, Sparkline,
  PageSpinner, EmptyState, useDashboardTokens, PairAvatar, COIN_COLOR,
} from "@/components/dashboard/DashboardUI";

const TXN_MAP: Record<string, { icon: any; label: string; dir: "in" | "out" }> = {
  DEPOSIT: { icon: FiArrowDownLeft, label: "Deposit", dir: "in" },
  WITHDRAWAL: { icon: FiArrowUpRight, label: "Withdrawal", dir: "out" },
  BUY: { icon: FiArrowDownLeft, label: "Buy", dir: "in" },
  SELL: { icon: FiArrowUpRight, label: "Sell", dir: "out" },
  TRANSFER_IN: { icon: FiArrowDownLeft, label: "Received", dir: "in" },
  TRANSFER_OUT: { icon: FiArrowUpRight, label: "Sent", dir: "out" },
  AGENT_DEPOSIT: { icon: FiArrowDownLeft, label: "Agent deposit", dir: "in" },
  AGENT_WITHDRAWAL: { icon: FiArrowUpRight, label: "Agent withdrawal", dir: "out" },
};

export default function DashboardPage() {
  const { t } = useTranslate();
  const { user } = useAuthStore();
  const tok = useDashboardTokens();
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [rates, setRates] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    Promise.all([
      walletAPI.getAll().catch(() => ({ data: { wallets: [] } })),
      exchangeAPI.getRates().catch(() => ({ data: { rates: [] } })),
    ]).then(([wRes, rRes]: any[]) => {
      const w = wRes.data.wallets || wRes.data || [];
      setWallets(Array.isArray(w) ? w : []);
      const r = rRes.data.rates || rRes.data || [];
      const btcRate = (Array.isArray(r) ? r : []).find((x: any) => x.quoteCurrency === "BTC") || { buyPrice: "67240.50", sellPrice: "67180.30" };
      setRates(btcRate);

      const usdtWallet = (Array.isArray(w) ? w : []).find((x: any) => x.currency === "USDT");
      if (usdtWallet) {
        walletAPI.getTransactions("USDT", 1).then((tRes: any) => {
          setTransactions((tRes.data.transactions || tRes.data || []).slice(0, 8));
        }).catch(() => {});
      }
      setLoading(false);
    });
  }, []);

  const mask = (s: string) => (showBalance ? s : "••••••");
  const totalUSD = wallets.reduce((sum, w) => sum + parseFloat(w.balance || 0) * (w.usdRate || 1), 0);
  const totalFrozen = wallets.reduce((sum, w) => sum + parseFloat(w.frozen || 0) * (w.usdRate || 1), 0);
  const available = totalUSD - totalFrozen;

  const quickActions = [
    { href: "/dashboard/deposit", icon: FiArrowDownLeft, label: "Deposit", color: tok.success },
    { href: "/dashboard/withdraw", icon: FiArrowUpRight, label: "Withdraw", color: tok.danger },
    { href: "/dashboard/trade", icon: FiRepeat, label: "Trade", color: tok.brand },
    { href: "/dashboard/p2p", icon: FiShoppingBag, label: "P2P", color: "#8b5cf6" },
    { href: "/dashboard/wallet", icon: FiSend, label: "Send", color: "#0891b2" },
    { href: "/dashboard/referrals", icon: FiGift, label: "Refer", color: "#f59e0b" },
  ];

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        eyebrow={`Welcome back, ${user?.firstName || "trader"}`}
        title="Dashboard"
        subtitle="Your portfolio at a glance."
        right={
          <HStack spacing={2}>
            <Button
              size="sm"
              h="36px"
              px={3}
              variant="ghost"
              color={tok.textSub}
              _hover={{ color: tok.textMain, bg: tok.hover }}
              leftIcon={showBalance ? <FiEyeOff /> : <FiEye />}
              onClick={() => setShowBalance((v) => !v)}
            >
              {showBalance ? "Hide" : "Show"}
            </Button>
            <Button
              as={NextLink}
              href="/dashboard/trade"
              size="sm"
              h="36px"
              px={4}
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              fontWeight="800"
              borderRadius="10px"
              leftIcon={<FiZap />}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
              transition="all 0.2s"
            >
              Trade
            </Button>
          </HStack>
        }
      />

      {/* Portfolio hero */}
      <Box
        mb={4}
        p={{ base: 5, md: 6 }}
        borderRadius="18px"
        position="relative"
        overflow="hidden"
        bg={tok.dark
          ? "linear-gradient(135deg, rgba(0,87,184,0.25), rgba(0,87,184,0.06))"
          : "linear-gradient(135deg, rgba(0,87,184,0.14), rgba(0,87,184,0.04))"}
        border="1px solid"
        borderColor={`${tok.brand}33`}
      >
        {/* Blobs */}
        <Box position="absolute" top="-40%" right="-5%" w="260px" h="260px" borderRadius="full"
          bg={`radial-gradient(circle, ${tok.brand}44, transparent 65%)`} filter="blur(40px)" pointerEvents="none" />
        <Box position="absolute" bottom="-40%" left="-5%" w="220px" h="220px" borderRadius="full"
          bg={`radial-gradient(circle, ${tok.brandLight}33, transparent 65%)`} filter="blur(40px)" pointerEvents="none" />

        <Flex direction={{ base: "column", md: "row" }} gap={6} justify="space-between" align={{ base: "stretch", md: "center" }} position="relative" zIndex={1}>
          <Box>
            <Text fontSize="10.5px" fontWeight="800" color={tok.textMuted} letterSpacing=".14em" textTransform="uppercase" mb={1}>
              Total portfolio value
            </Text>
            <HStack spacing={3} align="flex-end">
              <Text fontSize={{ base: "36px", md: "48px" }} fontWeight="900" color={tok.textMain} letterSpacing="-0.03em" lineHeight="1" fontFamily="'DM Sans', sans-serif">
                {mask(`$${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
              </Text>
              <Badge bg="rgba(34,197,94,0.15)" color={tok.success} fontSize="11px" fontWeight="900" px={2.5} py={1} borderRadius="full" mb={1}>
                ▲ 2.14%
              </Badge>
            </HStack>
            <HStack mt={2} spacing={5}>
              <Box>
                <Text fontSize="10px" color={tok.textMuted} fontWeight="700" letterSpacing=".1em" textTransform="uppercase">
                  Available
                </Text>
                <Text fontSize="13px" fontWeight="800" color={tok.textMain} fontFamily="monospace">
                  {mask(`$${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="10px" color={tok.textMuted} fontWeight="700" letterSpacing=".1em" textTransform="uppercase">
                  Locked
                </Text>
                <Text fontSize="13px" fontWeight="800" color={tok.warning} fontFamily="monospace">
                  {mask(`$${totalFrozen.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                </Text>
              </Box>
            </HStack>
          </Box>
          <Box display={{ base: "none", md: "block" }}>
            <Sparkline up w={260} h={70} />
          </Box>
        </Flex>
      </Box>

      {/* Quick actions */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(3, 1fr)", md: "repeat(6, 1fr)" }} gap={3} mb={4}>
        {quickActions.map((a) => (
          <GlassCard key={a.label} hover p={4}>
            <Box as={NextLink} href={a.href} display="block" textAlign="center">
              <Flex
                w="40px"
                h="40px"
                mx="auto"
                borderRadius="12px"
                bg={`${a.color}15`}
                color={a.color}
                align="center"
                justify="center"
                mb={2}
              >
                <Icon as={a.icon} />
              </Flex>
              <Text fontSize="12px" fontWeight="800" color={tok.textMain}>{a.label}</Text>
            </Box>
          </GlassCard>
        ))}
      </Box>

      {/* KPI row */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={3} mb={4}>
        <StatTile
          label="BTC / USDT"
          value={rates ? `${parseFloat(rates.buyPrice).toFixed(2)}` : "—"}
          hint="Live rate"
          icon={FiBarChart2}
          delta={{ value: "0.84%", positive: true }}
        />
        <StatTile
          label="Assets"
          value={String(wallets.length)}
          hint="Active wallets"
          icon={FiCreditCard}
        />
        <StatTile
          label="24h volume"
          value="$—"
          hint="Coming soon"
          icon={FiTrendingUp}
        />
        <StatTile
          label="Realised P/L"
          value="$0.00"
          hint="Last 30 days"
          icon={FiDollarSign}
        />
      </Box>

      {/* Two columns */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }}
        gap={4}
      >
        {/* Holdings */}
        <GlassCard p={0}>
          <Box px={4} pt={4}>
            <SectionHeader
              title="Your holdings"
              subtitle={`${wallets.length} assets`}
              right={
                <Button as={NextLink} href="/dashboard/wallet" size="xs" variant="ghost" color={tok.brand} fontWeight="700" rightIcon={<FiArrowRight />} _hover={{ bg: tok.hover }}>
                  Wallet
                </Button>
              }
            />
          </Box>
          <HDivList>
            {wallets.length === 0 ? (
              <Box p={4}><EmptyState icon={FiInbox} title="No holdings yet" hint="Deposit funds to start trading." /></Box>
            ) : (
              wallets.slice(0, 6).map((w) => {
                const color = COIN_COLOR[w.currency] ?? tok.brand;
                const bal = parseFloat(w.balance || 0);
                const usd = bal * (w.usdRate || 1);
                return (
                  <Flex
                    key={w.currency}
                    px={4}
                    py={3}
                    as={NextLink}
                    href="/dashboard/wallet"
                    align="center"
                    justify="space-between"
                    _hover={{ bg: tok.hover }}
                    transition="background 0.15s"
                  >
                    <HStack spacing={3}>
                      <PairAvatar symbol={w.currency} color={color} size={34} />
                      <Box>
                        <Text fontSize="13px" fontWeight="800" color={tok.textMain}>{w.currency}</Text>
                        <Text fontSize="10.5px" color={tok.textMuted}>
                          {(w.usdRate ?? 1) >= 1 ? `$${(w.usdRate ?? 1).toFixed(2)}` : `$${(w.usdRate ?? 1).toFixed(4)}`}
                        </Text>
                      </Box>
                    </HStack>
                    <HStack spacing={3}>
                      <Sparkline up={Math.random() > 0.5} w={60} h={20} />
                      <VStack align="flex-end" spacing={0}>
                        <Text fontSize="12.5px" fontWeight="800" color={tok.textMain} fontFamily="monospace">
                          {mask(bal.toLocaleString(undefined, { maximumFractionDigits: 6 }))}
                        </Text>
                        <Text fontSize="10.5px" color={tok.textMuted} fontFamily="monospace">
                          {mask(`$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                        </Text>
                      </VStack>
                    </HStack>
                  </Flex>
                );
              })
            )}
          </HDivList>
        </GlassCard>

        {/* Recent activity */}
        <GlassCard p={0}>
          <Box px={4} pt={4}>
            <SectionHeader
              title="Recent activity"
              subtitle="Last 8 transactions"
              right={
                <Button as={NextLink} href="/dashboard/wallet" size="xs" variant="ghost" color={tok.brand} fontWeight="700" rightIcon={<FiArrowRight />} _hover={{ bg: tok.hover }}>
                  All
                </Button>
              }
            />
          </Box>
          <HDivList>
            {transactions.length === 0 ? (
              <Box p={4}><EmptyState icon={FiInbox} title="No activity yet" hint="Your transactions will appear here." /></Box>
            ) : (
              transactions.map((tx: any) => {
                const m = TXN_MAP[tx.type] ?? TXN_MAP.TRANSFER_OUT;
                const isIn = m.dir === "in";
                return (
                  <Flex key={tx.id} px={4} py={3} align="center" justify="space-between" _hover={{ bg: tok.hover }} transition="background 0.15s">
                    <HStack spacing={3}>
                      <Flex
                        w="34px"
                        h="34px"
                        borderRadius="10px"
                        bg={isIn ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}
                        color={isIn ? tok.success : tok.danger}
                        align="center"
                        justify="center"
                      >
                        <Icon as={m.icon} boxSize={4} />
                      </Flex>
                      <Box>
                        <Text fontSize="12.5px" fontWeight="700" color={tok.textMain}>{m.label}</Text>
                        <Text fontSize="10.5px" color={tok.textMuted}>
                          {new Date(tx.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </Box>
                    </HStack>
                    <Text fontSize="12.5px" fontWeight="800" color={isIn ? tok.success : tok.danger} fontFamily="monospace">
                      {isIn ? "+" : "-"}{parseFloat(tx.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} {tx.currency}
                    </Text>
                  </Flex>
                );
              })
            )}
          </HDivList>
        </GlassCard>
      </Box>

      {/* Market highlights */}
      <Box mt={4}>
        <GlassCard p={4}>
          <SectionHeader
            title="Market highlights"
            subtitle="Top movers this hour"
            right={
              <Button as={NextLink} href="/markets" size="xs" variant="ghost" color={tok.brand} fontWeight="700" rightIcon={<FiArrowRight />} _hover={{ bg: tok.hover }}>
                Markets
              </Button>
            }
          />
          <Box display="grid" gridTemplateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={3} mt={2}>
            {MOCK_MOVERS.map((m) => (
              <Box key={m.sym} p={3} borderRadius="12px" border="1px solid" borderColor={tok.panelBorder} bg={tok.panelInner}>
                <HStack spacing={2} mb={2}>
                  <PairAvatar symbol={m.sym} color={m.color} size={28} />
                  <Box flex={1}>
                    <Text fontSize="12px" fontWeight="800" color={tok.textMain}>{m.sym}/USDT</Text>
                    <Text fontSize="10px" color={tok.textMuted}>{m.name}</Text>
                  </Box>
                </HStack>
                <Text fontSize="15px" fontWeight="900" color={tok.textMain} fontFamily="'DM Sans', sans-serif" letterSpacing="-0.01em">
                  ${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <HStack spacing={2} mt={0.5}>
                  <Icon as={m.up ? FiTrendingUp : FiTrendingDown} color={m.up ? tok.success : tok.danger} boxSize={3} />
                  <Text fontSize="11px" fontWeight="800" color={m.up ? tok.success : tok.danger}>
                    {m.up ? "+" : ""}{m.change}%
                  </Text>
                  <Box flex={1} />
                  <Sparkline up={m.up} w={60} h={18} />
                </HStack>
              </Box>
            ))}
          </Box>
        </GlassCard>
      </Box>
    </PageShell>
  );
}

/* Small helper: bordered list with dividers (used by the two lists above). */
function HDivList({ children }: { children: React.ReactNode }) {
  const tok = useDashboardTokens();
  return (
    <VStack align="stretch" spacing={0} mt={2} borderTop="1px solid" borderColor={tok.panelBorder}
      sx={{ "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder } }}>
      {children}
    </VStack>
  );
}

const MOCK_MOVERS = [
  { sym: "BTC", name: "Bitcoin", price: 67240.5, change: 2.34, up: true, color: COIN_COLOR.BTC },
  { sym: "ETH", name: "Ethereum", price: 3520.8, change: -0.87, up: false, color: COIN_COLOR.ETH },
  { sym: "SOL", name: "Solana", price: 172.4, change: 5.67, up: true, color: COIN_COLOR.SOL },
  { sym: "DOGE", name: "Dogecoin", price: 0.1547, change: 8.92, up: true, color: COIN_COLOR.DOGE },
];
