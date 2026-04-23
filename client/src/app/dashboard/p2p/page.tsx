"use client";

import { useEffect, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Input, Select,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, ModalFooter, useDisclosure, FormControl, FormLabel,
  Textarea, SimpleGrid, useToast,
} from "@chakra-ui/react";
import {
  FiShoppingBag, FiPlus, FiArrowDownCircle, FiArrowUpCircle, FiShield,
  FiRefreshCw, FiInbox, FiAlertTriangle,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { p2pAPI } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  PageShell, PageHeader, GlassCard, Tabs as InfoTabs, StatTile,
  PageSpinner, EmptyState, useDashboardTokens, PairAvatar, COIN_COLOR,
} from "@/components/dashboard/DashboardUI";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "rgba(0,87,184,0.12)", color: "#0057b8" },
  ESCROW_FUNDED: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  PAYMENT_SENT: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  PAYMENT_CONFIRMED: { bg: "rgba(0,87,184,0.12)", color: "#0057b8" },
  COMPLETED: { bg: "rgba(34,197,94,0.14)", color: "#22c55e" },
  DISPUTED: { bg: "rgba(239,68,68,0.14)", color: "#ef4444" },
  CANCELLED: { bg: "rgba(100,116,139,0.14)", color: "#64748b" },
  PENDING: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  AWAITING_ESCROW: { bg: "rgba(139,92,246,0.14)", color: "#8b5cf6" },
  PAUSED: { bg: "rgba(100,116,139,0.14)", color: "#64748b" },
  SELL: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  BUY: { bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  return (
    <Box px={2} py={0.5} borderRadius="5px" bg={s.bg}>
      <Text fontSize="9.5px" fontWeight="900" color={s.color} letterSpacing=".06em">
        {status.replace(/_/g, " ")}
      </Text>
    </Box>
  );
}

export default function P2PPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const tok = useDashboardTokens();
  const { isOpen: isCreate, onOpen: onCreate, onClose: closeCreate } = useDisclosure();
  const { isOpen: isTrade, onOpen: onTrade, onClose: closeTrade } = useDisclosure();

  const [tab, setTab] = useState<"market" | "listings" | "trades">("market");
  const [listings, setListings] = useState<any[]>([]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [myTrades, setMyTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSide, setFilterSide] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");

  const [form, setForm] = useState({
    side: "SELL" as "BUY" | "SELL",
    currency: "USDT",
    fiatCurrency: "USD",
    price: "",
    amount: "",
    minLimit: "",
    maxLimit: "",
    paymentMethods: ["BANK_TRANSFER"],
    terms: "",
  });
  const [creating, setCreating] = useState(false);

  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [tradeAmount, setTradeAmount] = useState("");
  const [trading, setTrading] = useState(false);

  const loadData = async () => {
    try {
      const [l, ml, mt] = await Promise.all([
        p2pAPI.getListings(1, filterSide || undefined, filterCurrency || undefined),
        p2pAPI.getMyListings(),
        p2pAPI.getMyTrades(1),
      ]);
      setListings(l.data.listings || []);
      setMyListings(ml.data.listings || []);
      setMyTrades(mt.data.trades || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filterSide, filterCurrency]);

  const handleCreate = async () => {
    if (!form.price || !form.amount || !form.minLimit || !form.maxLimit) {
      return toast({ title: "Fill all required fields", status: "error", duration: 3000 });
    }
    setCreating(true);
    try {
      await p2pAPI.createListing({
        ...form,
        price: parseFloat(form.price),
        amount: parseFloat(form.amount),
        minLimit: parseFloat(form.minLimit),
        maxLimit: parseFloat(form.maxLimit),
      });
      toast({ title: "Listing created", status: "success", duration: 3000 });
      closeCreate();
      setForm({ side: "SELL", currency: "USDT", fiatCurrency: "USD", price: "", amount: "", minLimit: "", maxLimit: "", paymentMethods: ["BANK_TRANSFER"], terms: "" });
      loadData();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.response?.data?.error || "Try again", status: "error", duration: 4000 });
    } finally {
      setCreating(false);
    }
  };

  const handleTrade = async () => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      return toast({ title: "Enter a valid amount", status: "error", duration: 3000 });
    }
    setTrading(true);
    try {
      await p2pAPI.initiateTrade({ listingId: selectedListing.id, amount: parseFloat(tradeAmount) });
      toast({ title: "Trade initiated", description: "Escrow funded. Proceed with payment.", status: "success", duration: 4000 });
      closeTrade();
      setTradeAmount("");
      loadData();
      setTab("trades");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.response?.data?.error || "Try again", status: "error", duration: 4000 });
    } finally {
      setTrading(false);
    }
  };

  const handleTradeAction = async (tradeId: string, action: string) => {
    try {
      if (action === "payment-sent") await p2pAPI.markPaymentSent(tradeId);
      else if (action === "confirm") await p2pAPI.confirmPayment(tradeId);
      else if (action === "cancel") await p2pAPI.cancelTrade(tradeId);
      toast({ title: "Updated", status: "success", duration: 3000 });
      loadData();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.response?.data?.error || "Try again", status: "error", duration: 4000 });
    }
  };

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

  const openBuys = listings.filter((l: any) => l.side === "BUY").length;
  const openSells = listings.filter((l: any) => l.side === "SELL").length;
  const activeTrades = myTrades.filter((t: any) => !["COMPLETED", "CANCELLED"].includes(t.status)).length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Peer-to-peer"
        title="P2P Market"
        subtitle="Buy and sell directly with other users — escrow protected."
        right={
          <Button
            onClick={onCreate}
            size="sm"
            h="36px"
            px={4}
            bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
            color="white"
            fontWeight="800"
            borderRadius="10px"
            leftIcon={<FiPlus />}
            _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
            transition="all 0.2s"
          >
            Create listing
          </Button>
        }
      />

      {/* KPIs */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,1fr)", md: "repeat(4,1fr)" }} gap={3} mb={4}>
        <StatTile label="Open offers" value={String(listings.length)} hint="Across all pairs" icon={FiShoppingBag} />
        <StatTile label="Buy orders" value={String(openBuys)} hint="Looking to buy" icon={FiArrowDownCircle} accent={tok.success} />
        <StatTile label="Sell orders" value={String(openSells)} hint="Looking to sell" icon={FiArrowUpCircle} accent={tok.danger} />
        <StatTile label="My active trades" value={String(activeTrades)} hint={`${myListings.length} listings`} icon={FiShield} accent={tok.brand} />
      </Box>

      <GlassCard p={0}>
        <Box px={4} pt={4}>
          <InfoTabs
            options={[
              { value: "market", label: `Marketplace (${listings.length})` },
              { value: "listings", label: `My listings (${myListings.length})` },
              { value: "trades", label: `My trades (${myTrades.length})` },
            ]}
            value={tab}
            onChange={(v) => setTab(v as any)}
          />
        </Box>

        {tab === "market" && (
          <Box p={{ base: 3, md: 4 }}>
            <Flex gap={2} mb={3} flexWrap="wrap">
              <Select value={filterSide} onChange={(e) => setFilterSide(e.target.value)} w={{ base: "100%", sm: "160px" }} {...input}>
                <option value="" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>All sides</option>
                <option value="BUY" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>Buy orders</option>
                <option value="SELL" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>Sell orders</option>
              </Select>
              <Select value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} w={{ base: "100%", sm: "160px" }} {...input}>
                <option value="" style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>All crypto</option>
                {["USDT", "BTC", "ETH", "BNB", "SOL"].map((c) => (
                  <option key={c} value={c} style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>{c}</option>
                ))}
              </Select>
              <Button
                size="sm"
                h="42px"
                variant="ghost"
                color={tok.textSub}
                leftIcon={<FiRefreshCw />}
                onClick={loadData}
                _hover={{ color: tok.textMain, bg: tok.hover }}
              >
                Refresh
              </Button>
            </Flex>

            {listings.length === 0 ? (
              <EmptyState icon={FiShoppingBag} title="No listings yet" hint="Be the first to post an offer — or adjust your filters." />
            ) : (
              <VStack align="stretch" spacing={2}>
                {listings.map((l: any) => {
                  const isSell = l.side === "SELL";
                  const remaining = parseFloat(l.amount) - parseFloat(l.filled || 0);
                  const isOwn = l.userId === user?.id;
                  const color = COIN_COLOR[l.currency] ?? tok.brand;
                  return (
                    <Box
                      key={l.id}
                      p={3.5}
                      bg={tok.panelInner}
                      border="1px solid"
                      borderColor={tok.panelBorder}
                      borderRadius="12px"
                      _hover={{ borderColor: `${tok.brand}44`, transform: "translateY(-1px)" }}
                      transition="all 0.15s"
                    >
                      <Flex justify="space-between" align="flex-start" flexWrap="wrap" gap={3}>
                        <HStack spacing={3}>
                          <PairAvatar symbol={l.currency} color={color} size={38} />
                          <Box>
                            <HStack spacing={2} mb={0.5}>
                              <Text fontSize="13.5px" fontWeight="800" color={tok.textMain}>{l.user?.firstName || "User"}</Text>
                              {l.user?.kycStatus === "APPROVED" && <Icon as={FiShield} color={tok.brand} boxSize={3} />}
                              <StatusPill status={l.side} />
                            </HStack>
                            <Text fontSize="11.5px" color={tok.textMuted}>
                              {remaining.toFixed(4)} {l.currency} · Min {parseFloat(l.minLimit).toFixed(2)} · Max {parseFloat(l.maxLimit).toFixed(2)}
                            </Text>
                          </Box>
                        </HStack>

                        <Box textAlign={{ base: "left", sm: "right" }}>
                          <Text fontSize="18px" fontWeight="900" color={tok.textMain} fontFamily="monospace">
                            {parseFloat(l.price).toFixed(2)}
                            <Text as="span" fontSize="10.5px" color={tok.textMuted} fontWeight="700" ml={1}>
                              {l.fiatCurrency}/{l.currency}
                            </Text>
                          </Text>
                          <HStack spacing={1} justify={{ base: "flex-start", sm: "flex-end" }} mt={1}>
                            {(l.paymentMethods || []).map((m: string) => (
                              <Box key={m} px={1.5} py={0.5} borderRadius="4px" bg={tok.panelBg}>
                                <Text fontSize="9.5px" color={tok.textMuted} fontWeight="700">{m.replace(/_/g, " ")}</Text>
                              </Box>
                            ))}
                          </HStack>
                        </Box>
                      </Flex>
                      {!isOwn && (
                        <Flex justify="flex-end" mt={3}>
                          <Button
                            size="sm"
                            h="34px"
                            bg={isSell ? `linear-gradient(135deg, ${tok.success}, #15803d)` : `linear-gradient(135deg, ${tok.danger}, #b91c1c)`}
                            color="white"
                            fontWeight="800"
                            borderRadius="9px"
                            fontSize="12px"
                            onClick={() => { setSelectedListing(l); setTradeAmount(""); onTrade(); }}
                            _hover={{ transform: "translateY(-1px)" }}
                            transition="all 0.15s"
                          >
                            {isSell ? `Buy ${l.currency}` : `Sell ${l.currency}`}
                          </Button>
                        </Flex>
                      )}
                    </Box>
                  );
                })}
              </VStack>
            )}
          </Box>
        )}

        {tab === "listings" && (
          <Box p={4}>
            {myListings.length === 0 ? (
              <EmptyState icon={FiInbox} title="No listings" hint="Create one to let counterparties trade with you." />
            ) : (
              <VStack align="stretch" spacing={2}>
                {myListings.map((l: any) => (
                  <Box key={l.id} p={3.5} bg={tok.panelInner} border="1px solid" borderColor={tok.panelBorder} borderRadius="12px">
                    <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
                      <Box>
                        <HStack spacing={2} mb={1}>
                          <StatusPill status={l.status} />
                          <Text fontSize="13px" fontWeight="800" color={tok.textMain}>{l.side} {l.currency}</Text>
                        </HStack>
                        <Text fontSize="11.5px" color={tok.textMuted}>
                          {parseFloat(l.price).toFixed(2)} {l.fiatCurrency} · {parseFloat(l.amount).toFixed(4)} total · {parseFloat(l.filled || 0).toFixed(4)} filled
                        </Text>
                        <Text fontSize="10.5px" color={tok.textMuted} mt={0.5}>{formatDate(l.createdAt)}</Text>
                      </Box>
                      {(l.status === "ACTIVE" || l.status === "PAUSED") && (
                        <Button
                          size="xs"
                          variant="ghost"
                          color={tok.danger}
                          fontSize="11px"
                          fontWeight="800"
                          _hover={{ bg: "rgba(239,68,68,0.1)" }}
                          onClick={async () => { await p2pAPI.cancelListing(l.id); loadData(); }}
                        >
                          Cancel
                        </Button>
                      )}
                    </Flex>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        )}

        {tab === "trades" && (
          <Box p={4}>
            {myTrades.length === 0 ? (
              <EmptyState icon={FiInbox} title="No trades yet" hint="Browse the marketplace to start trading." />
            ) : (
              <VStack align="stretch" spacing={2}>
                {myTrades.map((t: any) => {
                  const isBuyer = t.buyerId === user?.id;
                  const cp = isBuyer ? t.seller : t.buyer;
                  return (
                    <Box key={t.id} p={3.5} bg={tok.panelInner} border="1px solid" borderColor={tok.panelBorder} borderRadius="12px">
                      <Flex justify="space-between" align="start" flexWrap="wrap" gap={2} mb={2}>
                        <Box>
                          <HStack spacing={2} mb={1}>
                            <StatusPill status={t.status} />
                            <Text fontSize="13px" fontWeight="800" color={tok.textMain}>
                              {isBuyer ? "Buying" : "Selling"} {parseFloat(t.cryptoAmount).toFixed(4)} {t.currency}
                            </Text>
                          </HStack>
                          <Text fontSize="11.5px" color={tok.textMuted}>
                            For {parseFloat(t.fiatAmount).toFixed(2)} {t.fiatCurrency} @ {parseFloat(t.price).toFixed(2)} · with {cp?.firstName || "User"}
                          </Text>
                          <Text fontSize="10.5px" color={tok.textMuted} mt={0.5} fontFamily="monospace">
                            {t.reference} · {formatDate(t.createdAt)}
                          </Text>
                        </Box>
                      </Flex>
                      <Flex gap={2} flexWrap="wrap">
                        {isBuyer && t.status === "ESCROW_FUNDED" && (
                          <Button size="xs" bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`} color="white" fontWeight="800" borderRadius="8px" fontSize="11px" onClick={() => handleTradeAction(t.id, "payment-sent")}>
                            I've sent payment
                          </Button>
                        )}
                        {!isBuyer && t.status === "PAYMENT_SENT" && (
                          <Button size="xs" bg={`linear-gradient(135deg, ${tok.success}, #15803d)`} color="white" fontWeight="800" borderRadius="8px" fontSize="11px" onClick={() => handleTradeAction(t.id, "confirm")}>
                            Confirm & release
                          </Button>
                        )}
                        {["AWAITING_ESCROW", "ESCROW_FUNDED"].includes(t.status) && (
                          <Button size="xs" variant="ghost" color={tok.danger} fontSize="11px" fontWeight="700" onClick={() => handleTradeAction(t.id, "cancel")} _hover={{ bg: "rgba(239,68,68,0.1)" }}>
                            Cancel trade
                          </Button>
                        )}
                        {["ESCROW_FUNDED", "PAYMENT_SENT"].includes(t.status) && (
                          <Button size="xs" variant="ghost" color={tok.warning} fontSize="11px" fontWeight="700" _hover={{ bg: "rgba(245,158,11,0.1)" }}
                            onClick={async () => {
                              const reason = prompt("Reason for dispute:");
                              if (reason) { await p2pAPI.raiseDispute(t.id, reason); loadData(); }
                            }}
                          >
                            Raise dispute
                          </Button>
                        )}
                      </Flex>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </Box>
        )}
      </GlassCard>

      {/* ── Create Listing Modal ── */}
      <Modal isOpen={isCreate} onClose={closeCreate} size="lg" isCentered>
        <ModalOverlay bg="rgba(0,0,0,0.7)" backdropFilter="blur(8px)" />
        <ModalContent bg={tok.panelBg} border="1px solid" borderColor={tok.panelBorder} borderRadius="16px" color={tok.textMain}>
          <ModalHeader fontSize="16px" fontWeight="900" borderBottom="1px solid" borderColor={tok.panelBorder} pb={3}>
            Create P2P listing
          </ModalHeader>
          <ModalCloseButton color={tok.textMuted} />
          <ModalBody py={5}>
            <VStack spacing={3.5} align="stretch">
              <SimpleGrid columns={2} spacing={3}>
                <FormControl>
                  <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">Side</FormLabel>
                  <Select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as any })} {...input}>
                    <option value="SELL" style={{ background: tok.dark ? "#0b1020" : "white" }}>Sell</option>
                    <option value="BUY" style={{ background: tok.dark ? "#0b1020" : "white" }}>Buy</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">Crypto</FormLabel>
                  <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} {...input}>
                    {["USDT", "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE"].map((c) => (
                      <option key={c} value={c} style={{ background: tok.dark ? "#0b1020" : "white" }}>{c}</option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={2} spacing={3}>
                <FormControl>
                  <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">Fiat</FormLabel>
                  <Select value={form.fiatCurrency} onChange={(e) => setForm({ ...form, fiatCurrency: e.target.value })} {...input}>
                    <option value="USD" style={{ background: tok.dark ? "#0b1020" : "white" }}>USD</option>
                    <option value="EUR" style={{ background: tok.dark ? "#0b1020" : "white" }}>EUR</option>
                    <option value="GBP" style={{ background: tok.dark ? "#0b1020" : "white" }}>GBP</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">Price per unit</FormLabel>
                  <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder="e.g. 7.50" {...input} />
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">Total amount ({form.currency})</FormLabel>
                <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" placeholder="e.g. 100" {...input} />
              </FormControl>

              <SimpleGrid columns={2} spacing={3}>
                <FormControl>
                  <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">Min trade</FormLabel>
                  <Input value={form.minLimit} onChange={(e) => setForm({ ...form, minLimit: e.target.value })} type="number" placeholder="e.g. 10" {...input} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">Max trade</FormLabel>
                  <Input value={form.maxLimit} onChange={(e) => setForm({ ...form, maxLimit: e.target.value })} type="number" placeholder="e.g. 100" {...input} />
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">Terms (optional)</FormLabel>
                <Textarea
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                  placeholder="Payment instructions, conditions…"
                  rows={3}
                  bg={tok.panelInner}
                  border="1px solid"
                  borderColor={tok.panelBorder}
                  color={tok.textMain}
                  fontSize="13px"
                  borderRadius="10px"
                  _hover={{ borderColor: `${tok.brand}66` }}
                  _focus={{ borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` }}
                  _placeholder={{ color: tok.textMuted }}
                />
              </FormControl>

              <Box p={3} bg={`${tok.brand}0a`} border="1px solid" borderColor={`${tok.brand}2a`} borderRadius="10px">
                <HStack spacing={2} align="flex-start">
                  <Icon as={FiShield} color={tok.brand} boxSize={4} mt={0.5} />
                  <Text fontSize="11.5px" color={tok.textSub} lineHeight="1.55">
                    All P2P trades are protected by escrow. Funds are locked until both parties confirm. Disputes are resolved by our team with penalties for bad actors.
                  </Text>
                </HStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={tok.panelBorder} pt={3}>
            <Button variant="ghost" mr={3} onClick={closeCreate} color={tok.textMuted}>Cancel</Button>
            <Button
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              fontWeight="800"
              borderRadius="10px"
              onClick={handleCreate}
              isLoading={creating}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
              transition="all 0.2s"
            >
              Create listing
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Initiate Trade Modal ── */}
      <Modal isOpen={isTrade} onClose={closeTrade} size="md" isCentered>
        <ModalOverlay bg="rgba(0,0,0,0.7)" backdropFilter="blur(8px)" />
        <ModalContent bg={tok.panelBg} border="1px solid" borderColor={tok.panelBorder} borderRadius="16px" color={tok.textMain}>
          <ModalHeader fontSize="16px" fontWeight="900" borderBottom="1px solid" borderColor={tok.panelBorder} pb={3}>
            {selectedListing?.side === "SELL" ? "Buy" : "Sell"} {selectedListing?.currency}
          </ModalHeader>
          <ModalCloseButton color={tok.textMuted} />
          <ModalBody py={5}>
            {selectedListing && (
              <VStack align="stretch" spacing={3.5}>
                <Box p={3} bg={tok.panelInner} borderRadius="10px" border="1px solid" borderColor={tok.panelBorder}>
                  <SimpleGrid columns={2} spacing={2}>
                    <Box>
                      <Text fontSize="10px" color={tok.textMuted} textTransform="uppercase" letterSpacing=".08em" fontWeight="800">Price</Text>
                      <Text fontSize="14.5px" fontWeight="900" color={tok.textMain} fontFamily="monospace">
                        {parseFloat(selectedListing.price).toFixed(2)} {selectedListing.fiatCurrency}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="10px" color={tok.textMuted} textTransform="uppercase" letterSpacing=".08em" fontWeight="800">Available</Text>
                      <Text fontSize="14.5px" fontWeight="900" color={tok.textMain} fontFamily="monospace">
                        {(parseFloat(selectedListing.amount) - parseFloat(selectedListing.filled || 0)).toFixed(4)} {selectedListing.currency}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="10px" color={tok.textMuted} textTransform="uppercase" letterSpacing=".08em" fontWeight="800">Min</Text>
                      <Text fontSize="12.5px" fontWeight="800" color={tok.textMain}>{parseFloat(selectedListing.minLimit).toFixed(2)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="10px" color={tok.textMuted} textTransform="uppercase" letterSpacing=".08em" fontWeight="800">Max</Text>
                      <Text fontSize="12.5px" fontWeight="800" color={tok.textMain}>{parseFloat(selectedListing.maxLimit).toFixed(2)}</Text>
                    </Box>
                  </SimpleGrid>
                </Box>

                {selectedListing.terms && (
                  <Box p={3} bg="rgba(245,158,11,0.08)" border="1px solid" borderColor="rgba(245,158,11,0.25)" borderRadius="10px">
                    <HStack spacing={2} mb={1}>
                      <Icon as={FiAlertTriangle} color={tok.warning} boxSize={3.5} />
                      <Text fontSize="11px" fontWeight="800" color={tok.warning} letterSpacing=".06em" textTransform="uppercase">
                        Seller terms
                      </Text>
                    </HStack>
                    <Text fontSize="12px" color={tok.textSub}>{selectedListing.terms}</Text>
                  </Box>
                )}

                <FormControl>
                  <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">
                    Amount ({selectedListing.currency})
                  </FormLabel>
                  <Input value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} type="number" placeholder="Enter amount" {...input} />
                  {tradeAmount && parseFloat(tradeAmount) > 0 && (
                    <Text fontSize="11.5px" color={tok.brand} mt={1.5} fontWeight="800">
                      You {selectedListing.side === "SELL" ? "pay" : "receive"}: {(parseFloat(tradeAmount) * parseFloat(selectedListing.price)).toFixed(2)} {selectedListing.fiatCurrency}
                    </Text>
                  )}
                </FormControl>

                <Box p={3} bg={`${tok.brand}0a`} border="1px solid" borderColor={`${tok.brand}2a`} borderRadius="10px">
                  <HStack spacing={2} align="flex-start">
                    <Icon as={FiShield} color={tok.brand} boxSize={4} mt={0.5} />
                    <Text fontSize="11.5px" color={tok.textSub} lineHeight="1.55">
                      Crypto will be locked in escrow. You have 30 minutes to complete payment after initiating the trade.
                    </Text>
                  </HStack>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={tok.panelBorder} pt={3}>
            <Button variant="ghost" mr={3} onClick={closeTrade} color={tok.textMuted}>Cancel</Button>
            <Button
              bg={selectedListing?.side === "SELL"
                ? `linear-gradient(135deg, ${tok.success}, #15803d)`
                : `linear-gradient(135deg, ${tok.danger}, #b91c1c)`}
              color="white"
              fontWeight="800"
              borderRadius="10px"
              onClick={handleTrade}
              isLoading={trading}
              _hover={{ transform: "translateY(-1px)" }}
              transition="all 0.15s"
            >
              {selectedListing?.side === "SELL" ? "Buy now" : "Sell now"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageShell>
  );
}
