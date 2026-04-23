"use client";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Select, Input, InputGroup, useToast,
} from "@chakra-ui/react";
import {
  FiSearch, FiRefreshCw, FiArrowDownCircle, FiArrowUpCircle,
  FiClock, FiCheckCircle, FiXCircle, FiDollarSign, FiCalendar, FiZap, FiInbox,
} from "react-icons/fi";
import { orderAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PageShell, PageHeader, GlassCard, Tabs as InfoTabs, StatTile,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

const STATUS_META: Record<string, { color: string; icon: any }> = {
  FILLED: { color: "#22c55e", icon: FiCheckCircle },
  PENDING: { color: "#f59e0b", icon: FiClock },
  CANCELLED: { color: "#ef4444", icon: FiXCircle },
};

function StatusPill({ status, tok }: { status: string; tok: any }) {
  const s = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <HStack spacing={1} px={2} py={0.5} borderRadius="5px" bg={`${s.color}14`}>
      <Icon as={s.icon} color={s.color} boxSize={2.5} />
      <Text fontSize="9.5px" fontWeight="800" color={s.color} letterSpacing=".06em">{status}</Text>
    </HStack>
  );
}

export default function OrdersPage() {
  const toast = useToast();
  const tok = useDashboardTokens();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [tab, setTab] = useState<"all" | "FILLED" | "PENDING" | "CANCELLED">("all");

  const load = async (withSpinner = true) => {
    if (withSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await orderAPI.getAll(1);
      setOrders(res.data.orders || []);
    } catch {
      toast({ title: "Failed to load orders", status: "error", duration: 3000 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => orders.filter((o: any) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || o.id.toLowerCase().includes(q) || o.baseCurrency?.toLowerCase().includes(q) || o.quoteCurrency?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    const matchesType = typeFilter === "ALL" || o.side === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  }), [orders, searchTerm, statusFilter, typeFilter]);

  const grouped = {
    all: filtered,
    FILLED: filtered.filter((o: any) => o.status === "FILLED"),
    PENDING: filtered.filter((o: any) => o.status === "PENDING"),
    CANCELLED: filtered.filter((o: any) => o.status === "CANCELLED"),
  };

  const totals = useMemo(() => {
    const vol = filtered.reduce((sum, o: any) => sum + parseFloat(o.total || 0), 0);
    const filledCount = filtered.filter((o: any) => o.status === "FILLED").length;
    const pendingCount = filtered.filter((o: any) => o.status === "PENDING").length;
    const rate = filtered.length > 0 ? (filledCount / filtered.length) * 100 : 0;
    return { vol, filledCount, pendingCount, rate };
  }, [filtered]);

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  const input = {
    bg: tok.panelInner,
    border: "1px solid",
    borderColor: tok.panelBorder,
    color: tok.textMain,
    fontSize: "13px",
    borderRadius: "10px",
    h: "42px",
    _hover: { borderColor: `${tok.brand}66` },
    _focus: { borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` },
    _placeholder: { color: tok.textMuted },
  } as any;

  const currentList: any[] = (grouped as any)[tab];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Trading"
        title="Order history"
        subtitle="All your spot and instant trades in one place."
        right={
          <HStack spacing={2}>
            <Button
              as={NextLink}
              href="/dashboard/trade"
              size="sm"
              h="36px"
              px={3}
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              borderRadius="10px"
              fontWeight="800"
              leftIcon={<FiZap />}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
              transition="all 0.2s"
            >
              New trade
            </Button>
            <Button
              size="sm"
              h="36px"
              px={3}
              variant="ghost"
              color={tok.textSub}
              _hover={{ color: tok.textMain, bg: tok.hover }}
              leftIcon={<FiRefreshCw />}
              onClick={() => load(false)}
              isLoading={refreshing}
            >
              Refresh
            </Button>
          </HStack>
        }
      />

      {/* KPIs */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,1fr)", md: "repeat(4,1fr)" }} gap={3} mb={4}>
        <StatTile label="Total volume" value={`$${totals.vol.toFixed(2)}`} hint={`${filtered.length} orders`} icon={FiDollarSign} />
        <StatTile label="Filled" value={String(totals.filledCount)} hint="Completed" icon={FiCheckCircle} accent={tok.success} />
        <StatTile label="Pending" value={String(totals.pendingCount)} hint="Awaiting match" icon={FiClock} accent={tok.warning} />
        <StatTile label="Success rate" value={`${totals.rate.toFixed(1)}%`} hint="Filled / total" icon={FiCalendar} accent={tok.brand} />
      </Box>

      <GlassCard p={0}>
        {/* Filters */}
        <Box p={4} borderBottom="1px solid" borderColor={tok.panelBorder}>
          <Flex gap={2} direction={{ base: "column", md: "row" }}>
            <InputGroup flex={1}>
              <Box as={FiSearch} color={tok.textMuted} position="absolute" left={3} top="50%" transform="translateY(-50%)" zIndex={2} />
              <Input placeholder="Search by ID or currency…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} {...input} pl={10} />
            </InputGroup>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} {...input} w={{ base: "100%", md: "170px" }}>
              <option value="ALL" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>All status</option>
              <option value="FILLED" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>Filled</option>
              <option value="PENDING" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>Pending</option>
              <option value="CANCELLED" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>Cancelled</option>
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} {...input} w={{ base: "100%", md: "140px" }}>
              <option value="ALL" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>All sides</option>
              <option value="BUY" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>Buy</option>
              <option value="SELL" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>Sell</option>
            </Select>
          </Flex>
        </Box>

        {/* Tabs */}
        <Box px={4} pt={4}>
          <InfoTabs
            options={[
              { value: "all", label: `All (${grouped.all.length})` },
              { value: "FILLED", label: `Filled (${grouped.FILLED.length})` },
              { value: "PENDING", label: `Pending (${grouped.PENDING.length})` },
              { value: "CANCELLED", label: `Cancelled (${grouped.CANCELLED.length})` },
            ]}
            value={tab}
            onChange={(v) => setTab(v as any)}
          />
        </Box>

        {/* Rows */}
        <Box p={4}>
          {currentList.length === 0 ? (
            <EmptyState
              icon={FiInbox}
              title="No orders found"
              hint={searchTerm || statusFilter !== "ALL" || typeFilter !== "ALL" ? "Try adjusting your filters." : "Start trading to build history."}
            />
          ) : (
            <VStack align="stretch" spacing={2}>
              {currentList.map((o: any) => {
                const sideColor = o.side === "BUY" ? tok.success : tok.danger;
                return (
                  <Flex
                    key={o.id}
                    p={3.5}
                    bg={tok.panelInner}
                    border="1px solid"
                    borderColor={tok.panelBorder}
                    borderRadius="12px"
                    justify="space-between"
                    align="center"
                    flexWrap="wrap"
                    gap={3}
                    _hover={{ borderColor: `${tok.brand}33`, transform: "translateY(-1px)" }}
                    transition="all 0.15s"
                  >
                    <HStack spacing={3}>
                      <Flex w="38px" h="38px" borderRadius="10px" bg={`${sideColor}18`} color={sideColor} align="center" justify="center">
                        <Icon as={o.side === "BUY" ? FiArrowDownCircle : FiArrowUpCircle} boxSize={4} />
                      </Flex>
                      <Box>
                        <HStack spacing={2} mb={0.5}>
                          <Text fontSize="13px" fontWeight="900" color={tok.textMain}>{o.side}</Text>
                          <Text fontSize="13px" fontWeight="800" color={sideColor} fontFamily="monospace">
                            {formatCurrency(parseFloat(o.amount), o.baseCurrency)}
                          </Text>
                          <StatusPill status={o.status} tok={tok} />
                        </HStack>
                        <Text fontSize="10.5px" color={tok.textMuted} fontFamily="monospace">
                          {o.id.slice(0, 10)}… · {formatDate(o.createdAt)}
                        </Text>
                      </Box>
                    </HStack>
                    <Box textAlign={{ base: "left", sm: "right" }}>
                      <Text fontSize="13.5px" fontWeight="900" color={tok.textMain} fontFamily="'DM Mono', monospace">
                        {formatCurrency(parseFloat(o.total), o.quoteCurrency)}
                      </Text>
                      <Text fontSize="10.5px" color={tok.textMuted}>
                        @ {formatCurrency(parseFloat(o.price), o.quoteCurrency)}
                      </Text>
                    </Box>
                  </Flex>
                );
              })}
            </VStack>
          )}
        </Box>
      </GlassCard>
    </PageShell>
  );
}
