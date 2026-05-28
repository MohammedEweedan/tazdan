"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Input, Select,
  FormControl, FormLabel, Textarea, useToast, Tabs, TabList, Tab, TabPanels, TabPanel, Avatar,
} from "@chakra-ui/react";
import {
  FiSend, FiUser, FiMail, FiPhone, FiAtSign, FiArrowUpRight, FiArrowDownLeft,
  FiCheckCircle, FiInbox, FiAlertTriangle,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { transferAPI, walletAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PageShell, PageHeader, GlassCard, SectionHeader, StatTile,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

type Method = "email" | "phone" | "username";

export default function SendPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const tok = useDashboardTokens();

  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<any[]>([]);
  const [history, setHistory] = useState<{ sent: any[]; received: any[]; totalSent: number; totalReceived: number }>({
    sent: [], received: [], totalSent: 0, totalReceived: 0,
  });

  const [currency, setCurrency] = useState("USDT");
  const [method, setMethod] = useState<Method>("email");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState(0);

  const loadAll = async () => {
    try {
      const [w, h] = await Promise.all([
        walletAPI.getAll(),
        transferAPI.getHistory(1),
      ]);
      const ws = w.data.wallets || [];
      setWallets(ws);
      setHistory({
        sent: h.data.sent || [],
        received: h.data.received || [],
        totalSent: h.data.totalSent || 0,
        totalReceived: h.data.totalReceived || 0,
      });
      if (!ws.find((x: any) => x.currency === currency) && ws[0]) {
        setCurrency(ws[0].currency);
      }
    } catch {
      toast({ title: "Failed to load", status: "error", duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const selectedWallet = wallets.find((w) => w.currency === currency);
  const available = selectedWallet
    ? parseFloat(selectedWallet.balance?.toString() || "0") - parseFloat(selectedWallet.frozen?.toString() || "0")
    : 0;

  const handleSend = async () => {
    const a = parseFloat(amount || "0");
    if (!recipient.trim()) return toast({ title: "Recipient required", status: "error", duration: 3000 });
    if (!a || a <= 0) return toast({ title: "Invalid amount", status: "error", duration: 3000 });
    if (a > available) return toast({
      title: "Insufficient balance",
      description: `Available: ${formatCurrency(available, currency)}`,
      status: "error",
      duration: 3000,
    });

    setSending(true);
    try {
      const payload: any = { amount: a, currency, note: note || undefined };
      if (method === "email") payload.recipientEmail = recipient.trim();
      else if (method === "phone") payload.recipientPhone = recipient.trim();
      else payload.recipientUsername = recipient.trim().replace(/^@/, "").toLowerCase();

      const res = await transferAPI.send(payload);
      const r = res.data.transfer;
      toast({
        title: `Sent ${a} ${currency}`,
        description: `To ${r?.recipient?.firstName || "recipient"} · Ref ${r?.reference || ""}`,
        status: "success",
        duration: 4500,
      });
      setAmount("");
      setNote("");
      setRecipient("");
      await loadAll();
      setTab(1);
    } catch (e: any) {
      toast({
        title: "Transfer failed",
        description: e?.response?.data?.error || e?.response?.data?.message || "Try again",
        status: "error",
        duration: 4000,
      });
    } finally {
      setSending(false);
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
    h: "44px",
    _hover: { borderColor: `${tok.brand}66` },
    _focus: { borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` },
    _placeholder: { color: tok.textMuted },
  } as any;

  const totalMoved = [...history.sent, ...history.received].length;

  const methodMeta: Record<Method, { icon: any; placeholder: string; prefix?: string; label: string }> = {
    email: { icon: FiMail, placeholder: "friend@example.com", label: "Email" },
    phone: { icon: FiPhone, placeholder: "+218 91 234 5678", label: "Phone" },
    username: { icon: FiAtSign, placeholder: "john_doe", prefix: "@", label: "Username" },
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Move money"
        title="Send"
        subtitle="Transfer fiat or crypto instantly to anyone on Fortuni — by email, phone or username."
      />

      {/* KPIs */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,1fr)", md: "repeat(4,1fr)" }} gap={3} mb={4}>
        <StatTile label="Available" value={`$${available.toFixed(2)}`} hint={currency} icon={FiSend} />
        <StatTile label="Sent" value={String(history.totalSent)} hint="All-time transfers" icon={FiArrowUpRight} accent={tok.danger} />
        <StatTile label="Received" value={String(history.totalReceived)} hint="From other users" icon={FiArrowDownLeft} accent={tok.success} />
        <StatTile label="Total moved" value={String(totalMoved)} hint="Sent + received" icon={FiCheckCircle} accent={tok.brand} />
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1.15fr 1fr" }} gap={4}>
        {/* ── Composer ── */}
        <GlassCard p={5}>
          <SectionHeader title="New transfer" subtitle="Instant · zero network fee" />

          <VStack align="stretch" spacing={4} mt={3}>
            {/* Method pill selector */}
            <HStack
              spacing={1}
              p={1}
              bg={tok.panelInner}
              border="1px solid"
              borderColor={tok.panelBorder}
              borderRadius="12px"
              alignSelf="flex-start"
            >
              {(["email", "phone", "username"] as Method[]).map((m) => {
                const active = method === m;
                const meta = methodMeta[m];
                return (
                  <Box
                    key={m}
                    as="button"
                    onClick={() => { setMethod(m); setRecipient(""); }}
                    px={3}
                    py={1.5}
                    borderRadius="9px"
                    fontSize="12px"
                    fontWeight="800"
                    bg={active ? (tok.dark ? "rgba(255,255,255,0.08)" : "white") : "transparent"}
                    color={active ? tok.brand : tok.textSub}
                    boxShadow={active ? (tok.dark ? "0 2px 10px rgba(0,87,184,0.15)" : "0 2px 8px rgba(0,87,184,0.08)") : "none"}
                    transition="all 0.15s"
                    _hover={{ color: tok.textMain }}
                    display="inline-flex"
                    alignItems="center"
                    gap={1.5}
                  >
                    <Icon as={meta.icon} boxSize={3.5} />
                    {meta.label}
                  </Box>
                );
              })}
            </HStack>

            {/* Recipient */}
            <FormControl>
              <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                Recipient · {methodMeta[method].label}
              </FormLabel>
              <Flex align="center" gap={2}>
                {methodMeta[method].prefix && (
                  <Flex
                    w="44px"
                    h="44px"
                    borderRadius="10px"
                    bg={tok.panelInner}
                    border="1px solid"
                    borderColor={tok.panelBorder}
                    align="center"
                    justify="center"
                    color={tok.textSub}
                    fontSize="14px"
                    fontWeight="900"
                  >
                    {methodMeta[method].prefix}
                  </Flex>
                )}
                <Input
                  flex={1}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={methodMeta[method].placeholder}
                  {...input}
                />
              </Flex>
            </FormControl>

            {/* Currency + amount */}
            <Box display="grid" gridTemplateColumns={{ base: "1fr", sm: "160px 1fr" }} gap={3}>
              <FormControl>
                <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                  Currency
                </FormLabel>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)} {...input} iconColor={tok.textMuted}>
                  {wallets.map((w) => (
                    <option key={w.currency} value={w.currency} style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>
                      {w.currency}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                  Amount
                </FormLabel>
                <HStack>
                  <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" {...input} />
                  <Button
                    h="44px"
                    px={3}
                    bg={tok.panelInner}
                    color={tok.brand}
                    border="1px solid"
                    borderColor={tok.panelBorder}
                    fontWeight="800"
                    fontSize="11.5px"
                    onClick={() => setAmount(String(available))}
                    _hover={{ borderColor: tok.brand }}
                  >
                    MAX
                  </Button>
                </HStack>
              </FormControl>
            </Box>

            <Text fontSize="11.5px" color={tok.textMuted}>
              Available: <Text as="span" color={tok.textSub} fontWeight="800">{formatCurrency(available, currency)}</Text>
            </Text>

            <FormControl>
              <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                Note · optional
              </FormLabel>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Dinner last night"
                rows={2}
                bg={tok.panelInner}
                border="1px solid"
                borderColor={tok.panelBorder}
                color={tok.textMain}
                fontSize="13px"
                borderRadius="10px"
                _hover={{ borderColor: `${tok.brand}66` }}
                _focus={{ borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` }}
                _placeholder={{ color: tok.textMuted }}
                maxLength={200}
              />
            </FormControl>

            <Button
              w="100%"
              h="48px"
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              fontWeight="900"
              fontSize="14px"
              borderRadius="12px"
              leftIcon={<FiSend />}
              isLoading={sending}
              isDisabled={!recipient.trim() || !amount || parseFloat(amount) <= 0}
              onClick={handleSend}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 12px 28px ${tok.brand}55` }}
              _disabled={{ opacity: 0.5, cursor: "not-allowed", _hover: {} }}
              transition="all 0.2s"
            >
              Send {amount || 0} {currency}
            </Button>

            <Box
              p={3}
              borderRadius="10px"
              bg={`${tok.brand}0a`}
              border="1px solid"
              borderColor={`${tok.brand}2a`}
            >
              <HStack spacing={2} align="flex-start">
                <Icon as={FiAlertTriangle} color={tok.brand} boxSize={3.5} mt={0.5} />
                <Text fontSize="11px" color={tok.textSub} lineHeight="1.55">
                  Internal transfers are instant and free. Make sure the recipient details are correct — transactions can't be reversed once confirmed.
                </Text>
              </HStack>
            </Box>
          </VStack>
        </GlassCard>

        {/* ── History ── */}
        <GlassCard p={0}>
          <Tabs index={tab} onChange={setTab} variant="unstyled" isLazy>
            <Box px={4} pt={4}>
              <HStack spacing={1} p={1} bg={tok.panelInner} border="1px solid" borderColor={tok.panelBorder} borderRadius="12px" w="fit-content">
                {["All", "Sent", "Received"].map((l, i) => (
                  <Tab
                    key={l}
                    px={3}
                    py={1.5}
                    borderRadius="9px"
                    fontSize="12px"
                    fontWeight="800"
                    color={tok.textSub}
                    _selected={{
                      color: tok.brand,
                      bg: tok.dark ? "rgba(255,255,255,0.08)" : "white",
                      boxShadow: tok.dark ? "0 2px 10px rgba(0,87,184,0.15)" : "0 2px 8px rgba(0,87,184,0.08)",
                    }}
                    _hover={{ color: tok.textMain }}
                  >
                    {l}
                  </Tab>
                ))}
              </HStack>
            </Box>

            <TabPanels>
              <TabPanel px={0} py={0}>
                <TransferList
                  items={[
                    ...history.sent.map((t: any) => ({ ...t, _kind: "sent" })),
                    ...history.received.map((t: any) => ({ ...t, _kind: "received" })),
                  ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
                  tok={tok}
                  emptyHint="Your transfer activity will appear here."
                />
              </TabPanel>
              <TabPanel px={0} py={0}>
                <TransferList
                  items={history.sent.map((t: any) => ({ ...t, _kind: "sent" }))}
                  tok={tok}
                  emptyHint="No transfers sent yet."
                />
              </TabPanel>
              <TabPanel px={0} py={0}>
                <TransferList
                  items={history.received.map((t: any) => ({ ...t, _kind: "received" }))}
                  tok={tok}
                  emptyHint="No transfers received yet."
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GlassCard>
      </Box>
    </PageShell>
  );
}

function TransferList({ items, tok, emptyHint }: { items: any[]; tok: any; emptyHint: string }) {
  if (items.length === 0) {
    return <EmptyState icon={FiInbox} title="Nothing here" hint={emptyHint} />;
  }
  return (
    <VStack
      align="stretch"
      spacing={0}
      borderTop="1px solid"
      borderColor={tok.panelBorder}
      sx={{ "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder } }}
    >
      {items.map((t: any) => {
        const sent = t._kind === "sent";
        const party = sent ? t.receiver : t.sender;
        const initials = `${party?.firstName?.[0] || ""}${party?.lastName?.[0] || ""}`.toUpperCase() || "?";
        const amount = parseFloat(t.amount || 0);
        return (
          <Flex key={t.id} px={5} py={3.5} justify="space-between" align="center" _hover={{ bg: tok.hover }} transition="background 0.15s">
            <HStack spacing={3} minW={0} flex={1}>
              <Avatar
                size="sm"
                name={initials}
                bg={sent ? `linear-gradient(135deg, ${tok.danger}, #b91c1c)` : `linear-gradient(135deg, ${tok.success}, #15803d)`}
                color="white"
                fontSize="11px"
                fontWeight="900"
                icon={<Icon as={sent ? FiArrowUpRight : FiArrowDownLeft} boxSize={4} />}
              />
              <Box minW={0}>
                <Text fontSize="13px" fontWeight="800" color={tok.textMain} noOfLines={1}>
                  {sent ? "To " : "From "} {party?.firstName || "User"} {party?.lastName || ""}
                </Text>
                <Text fontSize="10.5px" color={tok.textMuted} noOfLines={1} fontFamily="monospace">
                  {t.reference} · {formatDate(t.createdAt)}
                </Text>
                {t.note && (
                  <Text fontSize="11px" color={tok.textSub} mt={0.5} noOfLines={1}>
                    “{t.note}”
                  </Text>
                )}
              </Box>
            </HStack>
            <Box textAlign="right">
              <Text fontSize="13.5px" fontWeight="900" color={sent ? tok.danger : tok.success} fontFamily="'DM Mono', monospace" letterSpacing="-0.02em">
                {sent ? "-" : "+"}{formatCurrency(amount, t.currency)}
              </Text>
              {parseFloat(t.fee || 0) > 0 && (
                <Text fontSize="10px" color={tok.textMuted}>
                  fee {formatCurrency(parseFloat(t.fee), t.currency)}
                </Text>
              )}
            </Box>
          </Flex>
        );
      })}
    </VStack>
  );
}
