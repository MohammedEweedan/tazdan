"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Select, Input, Tabs, TabList, TabPanels, Tab, TabPanel,
  useToast, FormControl, FormLabel,
} from "@chakra-ui/react";
import {
  FiDollarSign, FiClock, FiCheckCircle, FiArrowUpCircle,
  FiRefreshCw, FiCreditCard, FiGlobe, FiAlertTriangle, FiInbox,
} from "react-icons/fi";
import { withdrawalAPI, walletAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PageShell, PageHeader, GlassCard, SectionHeader, StatTile, Tabs as InfoTabs,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

const METHODS = [
  { id: "bank", icon: FiCreditCard, title: "Bank transfer", time: "1-3 business days", fee: "Low fees", color: "#0057b8" },
  { id: "card", icon: FiCreditCard, title: "Debit card", time: "3-5 business days", fee: "2.5% fee", color: "#8b5cf6" },
];

export default function WithdrawPage() {
  const toast = useToast();
  const tok = useDashboardTokens();
  const [wallets, setWallets] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [selectedMethod, setSelectedMethod] = useState("bank");
  const [selectedWallet, setSelectedWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ bankName: "", accountNumber: "", accountHolder: "", cryptoAddress: "" });

  const loadAll = async () => {
    try {
      const [w, wd] = await Promise.all([
        walletAPI.getAll(),
        withdrawalAPI.getAll(1),
      ]);
      setWallets(w.data.wallets || []);
      setWithdrawals(wd.data.withdrawals || []);
      if (!selectedWallet && w.data.wallets?.[0]) {
        setSelectedWallet(w.data.wallets[0].currency);
      }
    } catch {
      toast({ title: "Failed to load", status: "error", duration: 3000 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const selectedWalletData = wallets.find((w) => w.currency === selectedWallet);
  const availableBalance = selectedWalletData
    ? parseFloat(selectedWalletData.balance?.toString() || "0") - parseFloat(selectedWalletData.frozen?.toString() || "0")
    : 0;

  const totals = useMemo(() => {
    const total = withdrawals.reduce((s, w) => s + parseFloat(w.amount || 0), 0);
    const pending = withdrawals.filter((w) => w.status === "PENDING").length;
    const completed = withdrawals.filter((w) => w.status === "COMPLETED").length;
    return { total, pending, completed };
  }, [withdrawals]);

  const submit = async () => {
    if (!selectedWallet) return toast({ title: "Select a currency", status: "error", duration: 3000 });
    const a = parseFloat(amount || "0");
    if (!a || a <= 0) return toast({ title: "Invalid amount", status: "error", duration: 3000 });
    if (a > availableBalance) return toast({ title: "Insufficient balance", description: `Available: ${formatCurrency(availableBalance, selectedWallet)}`, status: "error", duration: 3000 });

    if (selectedWallet === "USDT") {
      if (!form.cryptoAddress) return toast({ title: "Wallet address required", status: "error", duration: 3000 });
    } else if (selectedMethod === "bank") {
      if (!form.bankName || !form.accountNumber || !form.accountHolder) {
        return toast({ title: "Bank details required", description: "Fill in all fields", status: "error", duration: 3000 });
      }
    }

    setSubmitting(true);
    try {
      const payload: any = { currency: selectedWallet, amount: a };
      if (selectedWallet === "USDT") {
        payload.walletAddress = form.cryptoAddress;
        payload.network = form.cryptoAddress.startsWith("T") ? "TRC20" : "ERC20";
      } else {
        payload.paymentMethod = "BANK_TRANSFER";
        payload.bankName = form.bankName;
        payload.accountNumber = form.accountNumber;
        payload.accountName = form.accountHolder;
      }
      await withdrawalAPI.create(payload);
      toast({ title: "Withdrawal submitted", description: `${a} ${selectedWallet} is being reviewed.`, status: "success", duration: 4000 });
      setAmount("");
      setForm({ bankName: "", accountNumber: "", accountHolder: "", cryptoAddress: "" });
      await loadAll();
      setActiveTab("history");
    } catch (e: any) {
      toast({ title: "Withdrawal failed", description: e?.response?.data?.error || "Try again.", status: "error", duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  const inputStyle = {
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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Cash out"
        title="Withdraw"
        subtitle="Move your crypto out to your bank or an external wallet."
        right={
          <Button
            size="sm"
            h="36px"
            px={3}
            variant="ghost"
            color={tok.textSub}
            _hover={{ color: tok.textMain, bg: tok.hover }}
            leftIcon={<FiRefreshCw />}
            onClick={() => { setRefreshing(true); loadAll(); }}
            isLoading={refreshing}
          >
            Refresh
          </Button>
        }
      />

      {/* KPIs */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,1fr)", md: "repeat(4,1fr)" }} gap={3} mb={4}>
        <StatTile label="Total withdrawn" value={`$${totals.total.toFixed(2)}`} hint="All-time" icon={FiDollarSign} />
        <StatTile label="Pending" value={String(totals.pending)} hint="Awaiting review" icon={FiClock} accent={tok.warning} />
        <StatTile label="Completed" value={String(totals.completed)} hint="Successful" icon={FiCheckCircle} accent={tok.success} />
        <StatTile label="Available" value={`$${availableBalance.toFixed(2)}`} hint={selectedWallet || "—"} icon={FiArrowUpCircle} accent={tok.brand} />
      </Box>

      <GlassCard p={0}>
        <Box px={4} pt={4}>
          <InfoTabs
            options={[
              { value: "new", label: "New withdrawal" },
              { value: "history", label: `History (${withdrawals.length})` },
            ]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as any)}
          />
        </Box>

        {activeTab === "new" ? (
          <Box p={{ base: 4, md: 5 }}>
            <Box
              display="grid"
              gridTemplateColumns={{ base: "1fr", lg: "1.1fr 1fr" }}
              gap={5}
            >
              {/* Left: method + details */}
              <VStack align="stretch" spacing={4}>
                <Box>
                  <SectionHeader title="Payout method" subtitle="Pick how you want to receive funds" />
                  <Box display="grid" gridTemplateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap={3} mt={2}>
                    {METHODS.map((m) => {
                      const active = selectedMethod === m.id;
                      return (
                        <Box
                          key={m.id}
                          onClick={() => setSelectedMethod(m.id)}
                          cursor="pointer"
                          p={3.5}
                          borderRadius="12px"
                          border="1.5px solid"
                          borderColor={active ? m.color : tok.panelBorder}
                          bg={active ? `${m.color}14` : tok.panelInner}
                          transition="all 0.15s"
                          _hover={{ borderColor: active ? m.color : `${m.color}66`, transform: "translateY(-1px)" }}
                        >
                          <Flex align="center" gap={3}>
                            <Flex w="38px" h="38px" borderRadius="10px" bg={`${m.color}22`} color={m.color} align="center" justify="center">
                              <Icon as={m.icon} boxSize={4.5} />
                            </Flex>
                            <Box>
                              <Text fontSize="13px" fontWeight="800" color={tok.textMain}>{m.title}</Text>
                              <Text fontSize="10.5px" color={tok.textMuted}>{m.time}</Text>
                              <Text fontSize="10.5px" fontWeight="800" color={m.color}>{m.fee}</Text>
                            </Box>
                          </Flex>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>

                <Box>
                  <SectionHeader title="Details" />
                  <VStack align="stretch" spacing={3} mt={2}>
                    <FormControl>
                      <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                        Currency
                      </FormLabel>
                      <Select value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)} {...inputStyle} iconColor={tok.textMuted}>
                        {wallets.map((w) => (
                          <option key={w.currency} value={w.currency} style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>
                            {w.currency} · {formatCurrency(w.available || parseFloat(w.balance || 0), w.currency)}
                          </option>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                        Amount
                      </FormLabel>
                      <HStack>
                        <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" {...inputStyle} />
                        <Button
                          h="44px"
                          px={3}
                          bg={tok.panelInner}
                          color={tok.brand}
                          border="1px solid"
                          borderColor={tok.panelBorder}
                          fontWeight="800"
                          fontSize="12px"
                          onClick={() => setAmount(String(availableBalance))}
                          _hover={{ borderColor: tok.brand }}
                        >
                          MAX
                        </Button>
                      </HStack>
                      <Text fontSize="11px" color={tok.textMuted} mt={1.5}>
                        Available: <Text as="span" fontWeight="800" color={tok.textSub}>{formatCurrency(availableBalance, selectedWallet)}</Text>
                      </Text>
                    </FormControl>

                    {selectedWallet === "USDT" && (
                      <FormControl>
                        <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                          Wallet address (TRC20 or ERC20)
                        </FormLabel>
                        <Input
                          value={form.cryptoAddress}
                          onChange={(e) => setForm({ ...form, cryptoAddress: e.target.value })}
                          placeholder="T… or 0x…"
                          {...inputStyle}
                          fontFamily="monospace"
                        />
                        <Text fontSize="10.5px" color={tok.textMuted} mt={1}>
                          <Icon as={FiGlobe} boxSize={3} mr={1} verticalAlign="middle" />
                          {form.cryptoAddress.startsWith("T")
                            ? "Network: TRC20 (Tron)"
                            : form.cryptoAddress.startsWith("0x")
                              ? "Network: ERC20 (Ethereum)"
                              : "Enter a TRC20 (T…) or ERC20 (0x…) address"}
                        </Text>
                      </FormControl>
                    )}

                    {selectedWallet !== "USDT" && selectedMethod === "bank" && (
                      <>
                        <FormControl>
                          <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                            Bank name
                          </FormLabel>
                          <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Bank name" {...inputStyle} />
                        </FormControl>
                        <FormControl>
                          <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                            Account number
                          </FormLabel>
                          <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="Account number" {...inputStyle} fontFamily="monospace" />
                        </FormControl>
                        <FormControl>
                          <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                            Account holder
                          </FormLabel>
                          <Input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} placeholder="Full name on the account" {...inputStyle} />
                        </FormControl>
                      </>
                    )}
                  </VStack>
                </Box>
              </VStack>

              {/* Right: summary */}
              <VStack align="stretch" spacing={4}>
                <Box
                  p={5}
                  borderRadius="14px"
                  border="1px solid"
                  borderColor={tok.panelBorder}
                  bg={tok.panelInner}
                >
                  <Text fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={2}>
                    You'll receive
                  </Text>
                  <Text fontSize="36px" fontWeight="900" color={tok.textMain} letterSpacing="-0.02em" fontFamily="'DM Sans', sans-serif" lineHeight="1">
                    {amount ? parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : "0.00"}
                    <Text as="span" fontSize="14px" color={tok.textMuted} fontWeight="700" ml={2}>
                      {selectedWallet || ""}
                    </Text>
                  </Text>

                  <Box mt={4} borderTop="1px solid" borderColor={tok.panelBorder} pt={3}>
                    <Row label="Method" value={METHODS.find((m) => m.id === selectedMethod)?.title || "—"} tok={tok} />
                    <Row label="Fee" value={METHODS.find((m) => m.id === selectedMethod)?.fee || "—"} tok={tok} />
                    <Row label="Processing" value={METHODS.find((m) => m.id === selectedMethod)?.time || "—"} tok={tok} />
                    <Row label="Network" value={selectedWallet === "USDT" ? (form.cryptoAddress.startsWith("T") ? "TRC20" : form.cryptoAddress.startsWith("0x") ? "ERC20" : "—") : "—"} tok={tok} />
                  </Box>

                  <Button
                    mt={4}
                    w="100%"
                    h="48px"
                    bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
                    color="white"
                    fontWeight="800"
                    fontSize="14px"
                    borderRadius="12px"
                    leftIcon={<FiArrowUpCircle />}
                    isLoading={submitting}
                    isDisabled={!selectedWallet || !amount || parseFloat(amount) <= 0}
                    onClick={submit}
                    _hover={{ transform: "translateY(-1px)", boxShadow: `0 10px 28px ${tok.brand}66` }}
                    _disabled={{ opacity: 0.5, cursor: "not-allowed", _hover: {} }}
                    transition="all 0.2s"
                  >
                    Submit withdrawal
                  </Button>
                </Box>

                <Box
                  p={3.5}
                  borderRadius="12px"
                  bg="rgba(245,158,11,0.08)"
                  border="1px solid"
                  borderColor="rgba(245,158,11,0.25)"
                >
                  <HStack spacing={2} mb={1}>
                    <Icon as={FiAlertTriangle} color={tok.warning} boxSize={3.5} />
                    <Text fontSize="11px" fontWeight="800" color={tok.warning} letterSpacing=".06em" textTransform="uppercase">
                      Before you withdraw
                    </Text>
                  </HStack>
                  <Text fontSize="11.5px" color={tok.textSub} lineHeight="1.6">
                    Double-check the destination address/account — transactions can't be reversed. Minimum withdrawal is $10.
                  </Text>
                </Box>
              </VStack>
            </Box>
          </Box>
        ) : (
          <Box p={4}>
            {withdrawals.length === 0 ? (
              <EmptyState icon={FiInbox} title="No withdrawals yet" hint="Your withdrawal history will appear here once you make one." />
            ) : (
              <VStack align="stretch" spacing={0} borderTop="1px solid" borderColor={tok.panelBorder}
                sx={{ "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder } }}
              >
                {withdrawals.map((w: any) => (
                  <Flex key={w.id} px={3} py={3} justify="space-between" align="center" _hover={{ bg: tok.hover }} transition="background 0.15s">
                    <HStack spacing={3}>
                      <Flex w="36px" h="36px" borderRadius="10px" bg="rgba(239,68,68,0.12)" color={tok.danger} align="center" justify="center">
                        <Icon as={FiArrowUpCircle} boxSize={4} />
                      </Flex>
                      <Box>
                        <Text fontSize="13px" fontWeight="800" color={tok.textMain} fontFamily="monospace">
                          -{formatCurrency(parseFloat(w.amount), w.currency)}
                        </Text>
                        <Text fontSize="10.5px" color={tok.textMuted}>{formatDate(w.createdAt)}</Text>
                      </Box>
                    </HStack>
                    <Box
                      px={2}
                      py={0.5}
                      borderRadius="4px"
                      bg={
                        w.status === "COMPLETED"
                          ? "rgba(34,197,94,0.12)"
                          : w.status === "PENDING" || w.status === "PROCESSING"
                            ? "rgba(245,158,11,0.12)"
                            : "rgba(239,68,68,0.12)"
                      }
                    >
                      <Text
                        fontSize="9.5px"
                        fontWeight="800"
                        letterSpacing=".06em"
                        color={
                          w.status === "COMPLETED"
                            ? tok.success
                            : w.status === "PENDING" || w.status === "PROCESSING"
                              ? tok.warning
                              : tok.danger
                        }
                      >
                        {w.status}
                      </Text>
                    </Box>
                  </Flex>
                ))}
              </VStack>
            )}
          </Box>
        )}
      </GlassCard>
    </PageShell>
  );
}

function Row({ label, value, tok }: { label: string; value: string; tok: any }) {
  return (
    <Flex justify="space-between" align="center" py={1}>
      <Text fontSize="11.5px" color={tok.textMuted} fontWeight="700">{label}</Text>
      <Text fontSize="12px" color={tok.textMain} fontWeight="800">{value}</Text>
    </Flex>
  );
}
