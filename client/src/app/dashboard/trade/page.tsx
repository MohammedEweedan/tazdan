"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Text, VStack, HStack, Flex, Button, Input, Icon,
  useToast, InputGroup, InputRightAddon, Badge,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiActivity, FiTrendingUp, FiTrendingDown, FiZap, FiClock } from "react-icons/fi";
import { walletAPI, exchangeAPI, orderAPI } from "@/lib/api";
import TradingViewWidget from "@/components/ui/TradingViewWidget";
import {
  PageShell, PageHeader, GlassCard, SectionHeader, Tabs, HDiv,
  PageSpinner, useDashboardTokens, Sparkline, PairAvatar, COIN_COLOR,
} from "@/components/dashboard/DashboardUI";

export default function TradePage() {
  const { t } = useTranslate();
  const toast = useToast();
  const tok = useDashboardTokens();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [rates, setRates] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      exchangeAPI.getRates().catch(() => ({ data: { rates: [] } })),
      walletAPI.getAll().catch(() => ({ data: { wallets: [] } })),
    ]).then(([rRes, wRes]: any[]) => {
      const r = rRes.data.rates || rRes.data || [];
      const btcRate = (Array.isArray(r) ? r : []).find((x: any) => x.quoteCurrency === "BTC") || { buyPrice: "67240.50", sellPrice: "67180.30" };
      setRates(btcRate);
      const w = wRes.data.wallets || wRes.data || [];
      setWallets(Array.isArray(w) ? w : []);
      setLoading(false);
    });
  }, []);

  const rate = rates ? parseFloat(side === "BUY" ? rates.buyPrice : rates.sellPrice) : 0;
  const effPrice = orderType === "LIMIT" && limitPrice ? parseFloat(limitPrice) : rate;
  const amtNum = parseFloat(amount) || 0;
  const feeRate = 0.005;
  const fee = amtNum * feeRate;
  const total = side === "BUY" ? amtNum * effPrice : amtNum;
  const receive = side === "BUY" ? amtNum - fee : amtNum * effPrice * (1 - feeRate);

  const usdtBalance = wallets.find((w: any) => w.currency === "USDT");
  const btcBalance = wallets.find((w: any) => w.currency === "BTC");
  const buyActive = side === "BUY";

  const handleTrade = async () => {
    if (!amtNum || amtNum <= 0) return;
    setSubmitting(true);
    try {
      await orderAPI.create({
        side,
        type: orderType,
        baseCurrency: "USDT",
        quoteCurrency: "BTC",
        amount: amtNum,
        price: effPrice,
      });
      toast({ title: t("common_success"), status: "success", duration: 3000 });
      setAmount("");
      const wRes: any = await walletAPI.getAll().catch(() => ({ data: { wallets: [] } }));
      setWallets(wRes.data.wallets || wRes.data || []);
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || t("common_error"), status: "error", duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  /* Synthetic order book + recent trades (until the backend exposes them live).
     Deterministic so they don't flicker on re-render. */
  const book = useMemo(() => buildMockBook(rate || 67240.50), [rate]);

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Spot · BTC / USDT"
        title="Trade"
        subtitle="Instant market orders and limit orders on the BTC/USDT pair."
        right={
          <HStack spacing={2}>
            <Badge bg={`${tok.brand}15`} color={tok.brand} px={3} py={1.5} borderRadius="full" fontSize="11px" fontWeight="800" display="flex" alignItems="center" gap={1.5}>
              <Box w="6px" h="6px" borderRadius="full" bg={tok.success} boxShadow={`0 0 6px ${tok.success}`} />
              Live
            </Badge>
          </HStack>
        }
      />

      {/* Ticker strip */}
      <GlassCard p={4} mb={4}>
        <Flex justify="space-between" align="center" gap={4} wrap="wrap">
          <HStack spacing={3}>
            <PairAvatar symbol="₿" color="#f7931a" size={38} />
            <Box>
              <HStack spacing={2}>
                <Text fontSize="14px" fontWeight="900" color={tok.textMain}>BTC / USDT</Text>
                <Badge fontSize="9px" bg={`${tok.brand}1a`} color={tok.brand} px={1.5} py={0.5} borderRadius="4px">SPOT</Badge>
              </HStack>
              <Text fontSize="11px" color={tok.textMuted} mt={0.5}>Bitcoin against Tether</Text>
            </Box>
          </HStack>

          <HStack spacing={6} wrap="wrap">
            <Stat label="Last price" value={`${rate.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT`} accent={tok.textMain} />
            <Stat label="24h change" value="+0.84%" accent={tok.success} />
            <Stat label="24h high" value={(rate * 1.012).toFixed(2)} />
            <Stat label="24h low" value={(rate * 0.987).toFixed(2)} />
            <Stat label="24h vol" value="2.4M USDT" />
            <Box display={{ base: "none", md: "block" }}>
              <Sparkline up w={120} h={30} />
            </Box>
          </HStack>
        </Flex>
      </GlassCard>

      {/* Three-column pro layout */}
      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 260px 340px" }} gap={4}>
        {/* LEFT — chart + open orders */}
        <VStack align="stretch" spacing={4}>
          <GlassCard p={0} overflow="hidden">
            <Box h={{ base: "320px", md: "440px" }}>
              <TradingViewWidget symbol="BINANCE:BTCUSDT" containerId="tv-trade" />
            </Box>
          </GlassCard>

          <GlassCard p={4}>
            <SectionHeader title="My open orders" subtitle="Orders waiting to fill" right={
              <Text as="a" href="/dashboard/orders" fontSize="11px" fontWeight="700" color={tok.brand} _hover={{ textDecoration: "underline" }}>View all</Text>
            } />
            <HStack spacing={2} fontSize="10px" fontWeight="800" color={tok.textMuted} px={2} mb={1} letterSpacing=".1em" textTransform="uppercase">
              <Box flex={1.2}>Market</Box>
              <Box flex={0.8} textAlign="end">Side</Box>
              <Box flex={1} textAlign="end">Price</Box>
              <Box flex={1} textAlign="end">Amount</Box>
              <Box flex={0.8} textAlign="end">Status</Box>
            </HStack>
            <Flex direction="column" py={6} align="center" color={tok.textMuted} gap={2}>
              <Icon as={FiClock} boxSize={4} />
              <Text fontSize="12px">No open orders.</Text>
            </Flex>
          </GlassCard>
        </VStack>

        {/* MIDDLE — order book */}
        <GlassCard p={3}>
          <SectionHeader title="Order book" subtitle="BTC / USDT" />
          {/* Header */}
          <HStack fontSize="9.5px" fontWeight="800" color={tok.textMuted} px={1} mb={1} letterSpacing=".1em" textTransform="uppercase">
            <Box flex={1}>Price</Box>
            <Box flex={1} textAlign="end">Amount</Box>
            <Box flex={1} textAlign="end">Total</Box>
          </HStack>

          {/* Asks (reversed so highest is at the top, lowest touches the middle) */}
          <VStack align="stretch" spacing={0}>
            {book.asks.slice().reverse().map((row) => (
              <BookRow key={`a-${row.price}`} row={row} side="ask" max={book.asksMaxTotal} />
            ))}
          </VStack>

          {/* Spread indicator */}
          <Box
            my={1.5}
            p={2}
            bg={tok.panelInner}
            borderRadius="8px"
            textAlign="center"
          >
            <Text fontSize="15px" fontWeight="900" color={tok.textMain} letterSpacing="-0.01em">
              {(rate).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT
            </Text>
            <Text fontSize="9.5px" color={tok.textMuted} letterSpacing=".1em" fontWeight="700" textTransform="uppercase">
              Mid · spread 0.03
            </Text>
          </Box>

          {/* Bids */}
          <VStack align="stretch" spacing={0}>
            {book.bids.map((row) => (
              <BookRow key={`b-${row.price}`} row={row} side="bid" max={book.bidsMaxTotal} />
            ))}
          </VStack>
        </GlassCard>

        {/* RIGHT — order form + balances + recent trades */}
        <VStack align="stretch" spacing={4}>
          <GlassCard p={4}>
            {/* Side */}
            <HStack mb={3} p={1} bg={tok.panelInner} border="1px solid" borderColor={tok.panelBorder} borderRadius="12px">
              <Button
                flex={1} h="38px" fontSize="12px" fontWeight="800" borderRadius="9px"
                bg={buyActive ? tok.success : "transparent"}
                color={buyActive ? "white" : tok.textSub}
                _hover={{ bg: buyActive ? tok.success : tok.hover }}
                onClick={() => setSide("BUY")}
                leftIcon={<FiTrendingUp />}
              >Buy</Button>
              <Button
                flex={1} h="38px" fontSize="12px" fontWeight="800" borderRadius="9px"
                bg={!buyActive ? tok.danger : "transparent"}
                color={!buyActive ? "white" : tok.textSub}
                _hover={{ bg: !buyActive ? tok.danger : tok.hover }}
                onClick={() => setSide("SELL")}
                leftIcon={<FiTrendingDown />}
              >Sell</Button>
            </HStack>

            {/* Type */}
            <Box mb={3}>
              <Tabs
                value={orderType}
                onChange={(v) => setOrderType(v as "MARKET" | "LIMIT")}
                options={[
                  { value: "MARKET", label: "Market" },
                  { value: "LIMIT", label: "Limit" },
                ]}
              />
            </Box>

            {/* Limit price */}
            {orderType === "LIMIT" && (
              <Box mb={3}>
                <Text fontSize="10.5px" fontWeight="800" color={tok.textMuted} letterSpacing=".1em" textTransform="uppercase" mb={1.5}>
                  Price (USDT)
                </Text>
                <InputGroup>
                  <Input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder={rate.toFixed(2)}
                    bg={tok.panelInner}
                    border="1px solid"
                    borderColor={tok.panelBorder}
                    color={tok.textMain}
                    fontSize="14px"
                    fontWeight="700"
                    h="42px"
                    _focus={{ borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` }}
                  />
                  <InputRightAddon bg={tok.panelInner} borderColor={tok.panelBorder} fontSize="11px" fontWeight="700" color={tok.textSub}>USDT</InputRightAddon>
                </InputGroup>
              </Box>
            )}

            {/* Amount */}
            <Box mb={3}>
              <Flex justify="space-between" mb={1.5}>
                <Text fontSize="10.5px" fontWeight="800" color={tok.textMuted} letterSpacing=".1em" textTransform="uppercase">
                  Amount
                </Text>
                <Text fontSize="10.5px" color={tok.textMuted}>
                  {buyActive
                    ? `${usdtBalance ? parseFloat(usdtBalance.balance).toFixed(2) : "0.00"} USDT`
                    : `${btcBalance ? parseFloat(btcBalance.balance).toFixed(4) : "0.0000"} BTC`}
                </Text>
              </Flex>
              <InputGroup>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  bg={tok.panelInner}
                  border="1px solid"
                  borderColor={tok.panelBorder}
                  color={tok.textMain}
                  fontSize="16px"
                  fontWeight="800"
                  h="46px"
                  _focus={{ borderColor: buyActive ? tok.success : tok.danger, boxShadow: `0 0 0 1px ${buyActive ? tok.success : tok.danger}` }}
                />
                <InputRightAddon bg={tok.panelInner} borderColor={tok.panelBorder} fontSize="11px" fontWeight="700" color={tok.textSub}>USDT</InputRightAddon>
              </InputGroup>

              <HStack spacing={1.5} mt={2}>
                {[25, 50, 75, 100].map((pct) => (
                  <Box
                    key={pct}
                    as="button"
                    flex={1}
                    h="26px"
                    fontSize="10.5px"
                    fontWeight="800"
                    borderRadius="7px"
                    bg={tok.panelInner}
                    border="1px solid"
                    borderColor={tok.panelBorder}
                    color={tok.textSub}
                    _hover={{ color: tok.brand, borderColor: tok.brand }}
                    transition="all 0.15s"
                    onClick={() => {
                      const base = buyActive
                        ? (usdtBalance ? parseFloat(usdtBalance.balance) / (effPrice || 1) : 0)
                        : (btcBalance ? parseFloat(btcBalance.balance) : 0);
                      setAmount(((base * pct) / 100).toFixed(4));
                    }}
                  >
                    {pct}%
                  </Box>
                ))}
              </HStack>
            </Box>

            {/* Summary */}
            <Box bg={tok.panelInner} border="1px solid" borderColor={tok.panelBorder} borderRadius="10px" p={3} mb={3}>
              <Row label="Price" value={`${effPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT`} />
              <Row label={buyActive ? "You pay" : "You receive"} value={`${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${buyActive ? "USDT" : "BTC"}`} />
              <Row label={`Fee (${(feeRate * 100).toFixed(2)}%)`} value={`${fee.toFixed(4)} USDT`} muted />
              <HDiv my={2} />
              <Row
                label={buyActive ? "You receive" : "You pay"}
                value={buyActive ? `${receive.toFixed(4)} BTC` : `${receive.toFixed(2)} USDT`}
                strong
                accent={buyActive ? tok.success : tok.danger}
              />
            </Box>

            <Button
              w="100%"
              h="48px"
              fontSize="14px"
              fontWeight="900"
              borderRadius="12px"
              bg={buyActive
                ? `linear-gradient(135deg, ${tok.success}, #15803d)`
                : `linear-gradient(135deg, ${tok.danger}, #b91c1c)`}
              color="white"
              isLoading={submitting}
              onClick={handleTrade}
              isDisabled={!amtNum || amtNum <= 0}
              leftIcon={<FiZap />}
              _hover={{ transform: "translateY(-1px)", boxShadow: buyActive ? `0 8px 28px ${tok.success}66` : `0 8px 28px ${tok.danger}66` }}
              transition="all 0.2s"
            >
              {buyActive ? "Buy BTC" : "Sell BTC"}
            </Button>
          </GlassCard>

          {/* Recent trades */}
          <GlassCard p={3}>
            <SectionHeader title="Recent trades" />
            <HStack fontSize="9.5px" fontWeight="800" color={tok.textMuted} px={1} mb={1} letterSpacing=".1em" textTransform="uppercase">
              <Box flex={1}>Price</Box>
              <Box flex={1} textAlign="end">Amount</Box>
              <Box flex={1} textAlign="end">Time</Box>
            </HStack>
            <VStack align="stretch" spacing={0}>
              {book.trades.map((tr, i) => (
                <HStack key={i} px={1} py={1} fontSize="11.5px" fontFamily="monospace">
                  <Text flex={1} color={tr.up ? tok.success : tok.danger} fontWeight="700">
                    {tr.price.toFixed(2)}
                  </Text>
                  <Text flex={1} color={tok.textSub} textAlign="end">
                    {tr.amount.toFixed(2)}
                  </Text>
                  <Text flex={1} color={tok.textMuted} textAlign="end">
                    {tr.time}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </GlassCard>
        </VStack>
      </Box>
    </PageShell>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const tok = useDashboardTokens();
  return (
    <Box>
      <Text fontSize="10px" fontWeight="700" color={tok.textMuted} letterSpacing=".1em" textTransform="uppercase" mb={0.5}>
        {label}
      </Text>
      <Text fontSize="13.5px" fontWeight="800" color={accent ?? tok.textMain} fontFamily="monospace">
        {value}
      </Text>
    </Box>
  );
}

function Row({
  label,
  value,
  muted = false,
  strong = false,
  accent,
}: { label: string; value: string; muted?: boolean; strong?: boolean; accent?: string }) {
  const tok = useDashboardTokens();
  return (
    <Flex justify="space-between" py={0.5}>
      <Text fontSize={strong ? "12.5px" : "11.5px"} color={muted ? tok.textMuted : tok.textSub} fontWeight={strong ? "800" : "600"}>
        {label}
      </Text>
      <Text
        fontSize={strong ? "13px" : "11.5px"}
        color={accent ?? (strong ? tok.textMain : tok.textSub)}
        fontWeight={strong ? "900" : "700"}
        fontFamily="monospace"
      >
        {value}
      </Text>
    </Flex>
  );
}

function BookRow({ row, side, max }: { row: { price: number; amount: number; total: number }; side: "bid" | "ask"; max: number }) {
  const tok = useDashboardTokens();
  const color = side === "bid" ? tok.success : tok.danger;
  const pct = Math.min(100, (row.total / max) * 100);
  return (
    <HStack position="relative" px={1} py="3px" fontSize="11.5px" fontFamily="monospace">
      <Box
        position="absolute"
        top={0}
        bottom={0}
        right={0}
        w={`${pct}%`}
        bg={side === "bid" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"}
        pointerEvents="none"
        borderRadius="4px"
      />
      <Text flex={1} color={color} fontWeight="700" zIndex={1}>
        {row.price.toFixed(2)}
      </Text>
      <Text flex={1} textAlign="end" color={tok.textSub} zIndex={1}>
        {row.amount.toFixed(2)}
      </Text>
      <Text flex={1} textAlign="end" color={tok.textMuted} zIndex={1}>
        {row.total.toFixed(2)}
      </Text>
    </HStack>
  );
}

/* ── Mock data generators (deterministic) ───────────────────── */

function buildMockBook(mid: number) {
  const asks: { price: number; amount: number; total: number }[] = [];
  const bids: { price: number; amount: number; total: number }[] = [];
  let seed = 4711;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  let askTotal = 0;
  let bidTotal = 0;
  for (let i = 1; i <= 10; i++) {
    const a = mid + i * 0.01 + rand() * 0.005;
    const b = mid - i * 0.01 - rand() * 0.005;
    const aAmt = 50 + rand() * 950;
    const bAmt = 50 + rand() * 950;
    askTotal += aAmt;
    bidTotal += bAmt;
    asks.push({ price: a, amount: aAmt, total: askTotal });
    bids.push({ price: b, amount: bAmt, total: bidTotal });
  }
  const trades: { price: number; amount: number; time: string; up: boolean }[] = [];
  const now = Date.now();
  for (let i = 0; i < 14; i++) {
    const up = rand() > 0.5;
    const p = mid + (rand() - 0.5) * 0.04;
    const a = 20 + rand() * 300;
    const t = new Date(now - i * 6000);
    trades.push({
      price: p,
      amount: a,
      time: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`,
      up,
    });
  }
  return {
    asks,
    bids,
    trades,
    asksMaxTotal: askTotal,
    bidsMaxTotal: bidTotal,
  };
}
