"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box, Flex, Text, VStack, HStack, Button, Icon, Select, Badge,
} from "@chakra-ui/react";
import {
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiBarChart2,
  FiDownload, FiPieChart, FiInbox,
} from "react-icons/fi";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { exportAPI, walletAPI } from "@/lib/api";
import {
  PageShell, PageHeader, GlassCard, SectionHeader, StatTile,
  PageSpinner, EmptyState, useDashboardTokens, PairAvatar, COIN_COLOR,
} from "@/components/dashboard/DashboardUI";

const PALETTE = ["#0057b8", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function PortfolioPage() {
  const tok = useDashboardTokens();
  const [wallets, setWallets] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      walletAPI.getAll().catch(() => ({ data: {} })),
      exportAPI.portfolioHistory(days).catch(() => ({ data: { history: [] } })),
    ])
      .then(([w, h]: any[]) => {
        setWallets(w.data?.wallets || w.data || []);
        setHistory(h.data.history || []);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const totals = useMemo(() => {
    const deposits = history.reduce((s, h) => s + (h.deposits || 0), 0);
    const withdrawals = history.reduce((s, h) => s + (h.withdrawals || 0), 0);
    const volume = history.reduce((s, h) => s + (h.trades || 0), 0);
    const fees = history.reduce((s, h) => s + (h.fees || 0), 0);
    return { deposits, withdrawals, volume, fees };
  }, [history]);

  const pnl = totals.deposits - totals.withdrawals - totals.fees;
  const pnlPct = totals.deposits > 0 ? (pnl / totals.deposits) * 100 : 0;

  const allocation = useMemo(
    () =>
      wallets
        .filter((w: any) => parseFloat(w.balance) > 0)
        .map((w: any) => ({
          name: w.currency,
          value: parseFloat(w.balance) * (w.usdRate || 1),
          color: COIN_COLOR[w.currency] ?? tok.brand,
        })),
    [wallets, tok.brand],
  );

  const totalAllocation = allocation.reduce((s, a) => s + a.value, 0);

  const downloadCSV = async () => {
    try {
      const r = await exportAPI.csv();
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `tazdan-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Analytics"
        title="Portfolio"
        subtitle="Net flows, realised P/L and asset allocation."
        right={
          <HStack spacing={2}>
            <Select
              size="sm"
              h="36px"
              w="120px"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              bg={tok.panelInner}
              border="1px solid"
              borderColor={tok.panelBorder}
              color={tok.textMain}
              borderRadius="10px"
              fontWeight="700"
              fontSize="12px"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </Select>
            <Button
              size="sm"
              h="36px"
              px={4}
              leftIcon={<FiDownload />}
              bg={tok.panelInner}
              color={tok.textMain}
              border="1px solid"
              borderColor={tok.panelBorder}
              _hover={{ bg: tok.hover, borderColor: tok.brand }}
              fontWeight="700"
              fontSize="12px"
              borderRadius="10px"
              onClick={downloadCSV}
            >
              Export CSV
            </Button>
          </HStack>
        }
      />

      {/* P/L hero */}
      <Box
        mb={4}
        p={{ base: 5, md: 6 }}
        borderRadius="18px"
        position="relative"
        overflow="hidden"
        bg={tok.dark
          ? `linear-gradient(135deg, ${pnl >= 0 ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}, rgba(255,255,255,0.02))`
          : `linear-gradient(135deg, ${pnl >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"}, rgba(0,0,0,0.01))`}
        border="1px solid"
        borderColor={pnl >= 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}
      >
        <Flex direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "stretch", md: "center" }} gap={5}>
          <Box>
            <Text fontSize="10.5px" fontWeight="800" color={tok.textMuted} letterSpacing=".14em" textTransform="uppercase" mb={1}>
              Net P/L · last {days} days
            </Text>
            <HStack spacing={3} align="flex-end">
              <Text fontSize={{ base: "36px", md: "48px" }} fontWeight="900" color={pnl >= 0 ? tok.success : tok.danger} letterSpacing="-0.03em" lineHeight="1" fontFamily="'DM Sans', sans-serif">
                {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Badge
                bg={pnl >= 0 ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"}
                color={pnl >= 0 ? tok.success : tok.danger}
                fontSize="11px"
                fontWeight="900"
                px={2.5}
                py={1}
                borderRadius="full"
                mb={1}
                display="flex"
                alignItems="center"
                gap={1}
              >
                <Icon as={pnl >= 0 ? FiTrendingUp : FiTrendingDown} boxSize={3} />
                {Math.abs(pnlPct).toFixed(2)}%
              </Badge>
            </HStack>
            <Text fontSize="11.5px" color={tok.textMuted} mt={1}>
              Net of deposits, withdrawals and fees.
            </Text>
          </Box>

          {/* Mini breakdown */}
          <Box display="grid" gridTemplateColumns="repeat(3, auto)" gap={{ base: 3, md: 5 }}>
            <Mini label="Deposits" value={`$${totals.deposits.toFixed(2)}`} color={tok.success} />
            <Mini label="Withdrawals" value={`$${totals.withdrawals.toFixed(2)}`} color={tok.danger} />
            <Mini label="Fees" value={`$${totals.fees.toFixed(2)}`} color={tok.warning} />
          </Box>
        </Flex>
      </Box>

      {/* KPI tiles */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={3} mb={4}>
        <StatTile label="Deposits" value={`$${totals.deposits.toFixed(2)}`} hint={`Last ${days}d`} icon={FiTrendingUp} accent={tok.success} />
        <StatTile label="Withdrawals" value={`$${totals.withdrawals.toFixed(2)}`} hint={`Last ${days}d`} icon={FiTrendingDown} accent={tok.danger} />
        <StatTile label="Trading vol" value={`$${totals.volume.toFixed(2)}`} hint="Realised" icon={FiBarChart2} />
        <StatTile label="Fees paid" value={`$${totals.fees.toFixed(2)}`} hint="All assets" icon={FiDollarSign} accent={tok.warning} />
      </Box>

      {/* Charts row */}
      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1.4fr 1fr" }} gap={4} mb={4}>
        {/* Activity area chart */}
        <GlassCard p={4}>
          <SectionHeader title="Activity" subtitle={`Deposits vs. withdrawals — last ${days} days`} />
          <Box h="300px" mt={2}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-dep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tok.success} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={tok.success} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-wd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tok.danger} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={tok.danger} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tok.divider} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: tok.textMuted }}
                  tickFormatter={(v) => (v || "").slice(5)}
                  stroke={tok.divider}
                />
                <YAxis tick={{ fontSize: 10, fill: tok.textMuted }} width={50} stroke={tok.divider} />
                <Tooltip
                  contentStyle={{
                    background: tok.dark ? "#0b1020" : "white",
                    border: `1px solid ${tok.panelBorder}`,
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
                <Area type="monotone" dataKey="deposits" stroke={tok.success} fill="url(#g-dep)" strokeWidth={2} name="Deposits" />
                <Area type="monotone" dataKey="withdrawals" stroke={tok.danger} fill="url(#g-wd)" strokeWidth={2} name="Withdrawals" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </GlassCard>

        {/* Allocation donut */}
        <GlassCard p={4}>
          <SectionHeader title="Allocation" subtitle="By USD value" />
          {allocation.length > 0 ? (
            <Flex mt={2} gap={4} align="center" direction={{ base: "column", sm: "row" }}>
              <Box w="180px" h="180px" position="relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocation}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={82}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="transparent"
                    >
                      {allocation.map((a, i) => (
                        <Cell key={i} fill={a.color || PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: tok.dark ? "#0b1020" : "white",
                        border: `1px solid ${tok.panelBorder}`,
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                      formatter={(v: any) => `$${Number(v).toFixed(2)}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <Box position="absolute" inset={0} display="flex" alignItems="center" justifyContent="center" flexDirection="column" pointerEvents="none">
                  <Text fontSize="10px" color={tok.textMuted} letterSpacing=".1em" fontWeight="700" textTransform="uppercase">
                    Total
                  </Text>
                  <Text fontSize="16px" fontWeight="900" color={tok.textMain} fontFamily="'DM Sans', sans-serif">
                    ${totalAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                </Box>
              </Box>
              <VStack align="stretch" spacing={1.5} flex={1} minW={0} w="100%">
                {allocation.map((a, i) => {
                  const pct = totalAllocation > 0 ? (a.value / totalAllocation) * 100 : 0;
                  return (
                    <Flex key={i} align="center" gap={2}>
                      <PairAvatar symbol={a.name} color={a.color || PALETTE[i % PALETTE.length]} size={22} />
                      <Text fontSize="12px" fontWeight="800" color={tok.textMain} flex={1}>
                        {a.name}
                      </Text>
                      <Text fontSize="11.5px" color={tok.textSub} fontFamily="monospace">
                        ${a.value.toFixed(2)}
                      </Text>
                      <Text fontSize="11px" fontWeight="800" color={tok.textMuted} w="44px" textAlign="right" fontFamily="monospace">
                        {pct.toFixed(1)}%
                      </Text>
                    </Flex>
                  );
                })}
              </VStack>
            </Flex>
          ) : (
            <EmptyState icon={FiPieChart} title="No holdings yet" hint="Make a deposit or trade to populate your allocation." />
          )}
        </GlassCard>
      </Box>

      {/* Holdings table */}
      <GlassCard p={0}>
        <Box px={4} pt={4}>
          <SectionHeader title="Holdings" subtitle={`${wallets.length} assets`} />
        </Box>
        {wallets.length === 0 ? (
          <Box p={4}><EmptyState icon={FiInbox} title="No holdings" hint="Once you deposit funds they'll appear here." /></Box>
        ) : (
          <Box overflowX="auto">
            <Box minW="560px">
              <HStack fontSize="10px" fontWeight="800" color={tok.textMuted} letterSpacing=".1em" textTransform="uppercase" px={4} py={2.5} borderBottom="1px solid" borderColor={tok.panelBorder}>
                <Box flex={1.5}>Asset</Box>
                <Box flex={1} textAlign="end">Amount</Box>
                <Box flex={1} textAlign="end">Price</Box>
                <Box flex={1} textAlign="end">Value</Box>
                <Box flex={0.8} textAlign="end">Weight</Box>
              </HStack>
              {wallets.map((w: any) => {
                const bal = parseFloat(w.balance || 0);
                const value = bal * (w.usdRate || 1);
                const pct = totalAllocation > 0 ? (value / totalAllocation) * 100 : 0;
                const color = COIN_COLOR[w.currency] ?? tok.brand;
                return (
                  <HStack
                    key={w.currency}
                    fontSize="12.5px"
                    px={4}
                    py={2.5}
                    borderBottom="1px solid"
                    borderColor={tok.panelBorder}
                    _last={{ borderBottom: "none" }}
                    _hover={{ bg: tok.hover }}
                    transition="background 0.15s"
                  >
                    <HStack flex={1.5} spacing={3}>
                      <PairAvatar symbol={w.currency} color={color} size={28} />
                      <Box>
                        <Text fontWeight="800" color={tok.textMain}>{w.currency}</Text>
                        <Text fontSize="10.5px" color={tok.textMuted}>{w.network || "—"}</Text>
                      </Box>
                    </HStack>
                    <Text flex={1} textAlign="end" color={tok.textMain} fontFamily="monospace" fontWeight="700">
                      {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </Text>
                    <Text flex={1} textAlign="end" color={tok.textSub} fontFamily="monospace">
                      ${(w.usdRate || 1).toFixed(2)}
                    </Text>
                    <Text flex={1} textAlign="end" color={tok.textMain} fontFamily="monospace" fontWeight="800">
                      ${value.toFixed(2)}
                    </Text>
                    <Text flex={0.8} textAlign="end" color={tok.textMuted} fontFamily="monospace" fontWeight="700">
                      {pct.toFixed(1)}%
                    </Text>
                  </HStack>
                );
              })}
            </Box>
          </Box>
        )}
      </GlassCard>
    </PageShell>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  const tok = useDashboardTokens();
  return (
    <Box>
      <Text fontSize="9.5px" fontWeight="800" color={tok.textMuted} letterSpacing=".14em" textTransform="uppercase" mb={0.5}>
        {label}
      </Text>
      <Text fontSize="14px" fontWeight="900" color={color} fontFamily="monospace">
        {value}
      </Text>
    </Box>
  );
}
