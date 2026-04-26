"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Icon,
  Divider,
  Spinner,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Select,
  Input,
  Avatar,
  IconButton,
} from "@chakra-ui/react";
import {
  FiArrowDownRight,
  FiArrowUpRight,
  FiDollarSign,
  FiCreditCard,
  FiCopy,
  FiCheckCircle,
  FiRefreshCw,
  FiClock,
  FiTrendingUp,
  FiInfo,
  FiAlertTriangle,
  FiShield,
  FiSmartphone,
  FiGlobe,
  FiBell,
  FiZap,
  FiChevronRight,
  FiBarChart2,
} from "react-icons/fi";
import NextLink from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { walletAPI, depositAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

// ── Stat cell ─────────────────────────────────────────────────────────
function StatCell({
  label,
  value,
  sub,
  subColor = "#0057b8",
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  accent?: string;
}) {
  return (
    <Box
      px={5}
      py={4}
      borderRight="1px solid"
      borderColor="rgba(255,255,255,0.05)"
      _last={{ borderRight: "none" }}
    >
      {accent && (
        <Box w="24px" h="1.5px" bg={accent} borderRadius="full" mb={3} />
      )}
      <Text
        fontSize="22px"
        fontWeight="800"
        letterSpacing="-.03em"
        fontFamily="'DM Mono', monospace"
        
        lineHeight={1}
      >
        {value}
      </Text>
      <Text
        fontSize="10px"
        fontWeight="600"
        color="#475569"
        letterSpacing=".08em"
        textTransform="uppercase"
        mt={1.5}
        mb={0.5}
      >
        {label}
      </Text>
      {sub && (
        <Text fontSize="11px" fontWeight="600" color={subColor}>
          {sub}
        </Text>
      )}
    </Box>
  );
}

// ── Method card ───────────────────────────────────────────────────────
function MethodCard({
  id,
  name,
  description,
  icon,
  selected,
  onClick,
}: {
  id: string;
  name: string;
  description: string;
  icon: any;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      p={4}
      borderRadius="12px"
      border="1px solid"
      borderColor={selected ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.06)"}
      bg={selected ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)"}
      cursor="pointer"
      transition="all 0.2s"
      onClick={onClick}
      _hover={{
        borderColor: "rgba(59,130,246,0.3)",
        bg: "rgba(255,255,255,0.03)",
      }}
    >
      <Flex align="center" gap={3}>
        <Box
          w="40px"
          h="40px"
          borderRadius="10px"
          bg={selected ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)"}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon as={icon} color={selected ? "#3b82f6" : "#64748b"} boxSize={5} />
        </Box>
        <Box flex={1}>
          <Text fontSize="13px" fontWeight="700" >
            {name}
          </Text>
          <Text fontSize="11px" color="#64748b">
            {description}
          </Text>
        </Box>
        {selected && (
          <Box
            w="6px"
            h="6px"
            borderRadius="full"
            bg="#3b82f6"
          />
        )}
      </Flex>
    </Box>
  );
}

// ── Deposit row ────────────────────────────────────────────────────────
function DepositRow({ deposit }: { deposit: any }) {
  const statusColors: Record<string, string> = {
    COMPLETED: "#0057b8",
    PENDING: "#f59e0b",
    FAILED: "#ef4444",
  };

  return (
    <Flex
      align="center"
      gap={3}
      px={4}
      py={3}
      borderBottom="1px solid"
      borderColor="rgba(255,255,255,0.04)"
      transition="background 0.15s"
      _hover={{ bg: "rgba(255,255,255,0.02)" }}
      _last={{ borderBottom: "none" }}
    >
      <Box
        w="5px"
        h="5px"
        borderRadius="full"
        bg={statusColors[deposit.status] || "#475569"}
        flexShrink={0}
      />
      <Text
        fontSize="11px"
        fontWeight="700"
        
        w="60px"
        fontFamily="'DM Mono', monospace"
      >
        {deposit.currency}
      </Text>
      <Text
        fontSize="11px"
        color="#94a3b8"
        flex={1}
        fontFamily="'DM Mono', monospace"
      >
        {formatCurrency(parseFloat(deposit.amount || 0), deposit.currency)}
      </Text>
      <Box
        px={2}
        py="1px"
        borderRadius="3px"
        bg={(statusColors[deposit.status] || "#475569") + "18"}
        border="1px solid"
        borderColor={(statusColors[deposit.status] || "#475569") + "30"}
      >
        <Text
          fontSize="9px"
          fontWeight="700"
          letterSpacing=".06em"
          color={statusColors[deposit.status] || "#475569"}
        >
          {deposit.status}
        </Text>
      </Box>
      <Text fontSize="10px" color="#334155" w="70px" textAlign="right">
        {formatDate(deposit.createdAt)}
      </Text>
    </Flex>
  );
}

// ══ DEPOSIT PAGE ════════════════════════════════════════════════════════
export default function DepositPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [wallets, setWallets] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("bank");
  const [selectedWallet, setSelectedWallet] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cardBg = "rgba(255,255,255,0.03)";
  const cardBorder = "rgba(255,255,255,0.07)";
  const muted = "#64748b";
  const textSub = "#94a3b8";

  useEffect(() => {
    const load = async () => {
      try {
        const [w, d] = await Promise.all([
          walletAPI.getAll(),
          depositAPI.getAll(1),
        ]);
        setWallets(w.data.wallets || []);
        setDeposits(d.data.deposits || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [w, d] = await Promise.all([
        walletAPI.getAll(),
        depositAPI.getAll(1),
      ]);
      setWallets(w.data.wallets || []);
      setDeposits(d.data.deposits || []);
    } finally {
      setRefreshing(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount", status: "error", duration: 3000, isClosable: true });
      return;
    }

    // Map method IDs to backend PaymentMethod values
    const methodMap: Record<string, string> = {
      bank: "BANK_TRANSFER",
      card: "BANK_TRANSFER",
      mobile: "SADAD",
      crypto: "CASH_DEPOSIT",
    };

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("currency", selectedWallet);
      formData.append("amount", amount);
      formData.append("paymentMethod", methodMap[selectedMethod] || "BANK_TRANSFER");

      await depositAPI.create(formData);

      toast({ title: "Deposit Request Created", description: `Deposit of ${amount} ${selectedWallet} has been submitted`, status: "success", duration: 4000, isClosable: true });

      setAmount("");
      // Refresh data
      const [w, d] = await Promise.all([walletAPI.getAll(), depositAPI.getAll(1)]);
      setWallets(w.data.wallets || []);
      setDeposits(d.data.deposits || []);
      setActiveTab(1);
    } catch (e: any) {
      toast({ title: "Deposit Failed", description: e?.response?.data?.error || "Please try again", status: "error", duration: 4000, isClosable: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast({
      title: "Address copied",
      description: "Wallet address copied to clipboard",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const totalDeposits = useMemo(
    () => deposits.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0),
    [deposits]
  );
  const pendingDeposits = deposits.filter((d) => d.status === "PENDING").length;
  const completedDeposits = deposits.filter((d) => d.status === "COMPLETED").length;

  const depositMethods = [
    {
      id: "bank",
      name: "Bank Transfer",
      description: "1-3 business days · Low fees",
      icon: FiCreditCard,
    },
    {
      id: "card",
      name: "Credit/Debit Card",
      description: "Instant · 3.5% fee",
      icon: FiCreditCard,
    },
    {
      id: "mobile",
      name: "Mobile Money",
      description: "Instant · 1.5% fee",
      icon: FiSmartphone,
    },
    {
      id: "crypto",
      name: "Crypto Transfer",
      description: "Network speed · Network fee",
      icon: FiGlobe,
    },
  ];

  if (loading) {
    return (
      <Flex
        minH="100vh"
        align="center"
        justify="center"
        direction="column"
        gap={4}
      >
        <Box
          w="32px"
          h="32px"
          borderRadius="full"
          border="2px solid"
          borderColor="#3b82f6"
          borderTopColor="transparent"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Text
          fontSize="12px"
          color="#475569"
          letterSpacing=".08em"
          textTransform="uppercase"
        >
          Loading deposits
        </Text>
      </Flex>
    );
  }

  return (
    <Box
      minH="100vh"
      fontFamily="'DM Sans', system-ui, sans-serif"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
      `}</style>
      {/* ── Stats strip ── */}
      <Box
        borderBottom="1px solid"
        borderColor="rgba(255,255,255,0.05)"
      >
        <Flex>
          <StatCell
            label="Total Deposited"
            value={`$${totalDeposits.toFixed(2)}`}
            sub="↑ +15.3%"
            accent="#3b82f6"
          />
          <StatCell
            label="Pending"
            value={String(pendingDeposits)}
            sub="Awaiting confirmation"
            subColor="#f59e0b"
            accent="#f59e0b"
          />
          <StatCell
            label="Completed"
            value={String(completedDeposits)}
            sub="Successfully processed"
            accent="#0057b8"
          />
          <StatCell
            label="Methods"
            value="4"
            sub="Available options"
            accent="#8b5cf6"
          />
        </Flex>
      </Box>

      {/* ── Main content ── */}
      <Box p={6} maxW="1200px" mx="auto">
        <Tabs index={activeTab} onChange={setActiveTab} variant="unstyled">
          <TabList gap={2} mb={6}>
            {["New Deposit", "Deposit History"].map((label, i) => (
              <Tab
                key={label}
                px={4}
                py={2}
                borderRadius="8px"
                fontSize="13px"
                fontWeight="600"
                bg={i === activeTab ? "rgba(59,130,246,0.15)" : "transparent"}
                border="1px solid"
                borderColor={
                  i === activeTab ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)"
                }
                _hover={{
                  bg: i === activeTab ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.03)",
                }}
                transition="all 0.15s"
              >
                {label}
              </Tab>
            ))}
          </TabList>

          <TabPanels>
            {/* ── New Deposit Tab ── */}
            <TabPanel p={0}>
              <Flex gap={6} direction={{ base: "column", lg: "row" }}>
                {/* Left: Method selection */}
                <Box flex={1}>
                  <Text
                    fontSize="10px"
                    fontWeight="700"
                    color="#334155"
                    letterSpacing=".1em"
                    textTransform="uppercase"
                    mb={4}
                  >
                    Select Method
                  </Text>
                  <VStack spacing={3} align="stretch">
                    {depositMethods.map((method) => (
                      <MethodCard
                        key={method.id}
                        {...method}
                        selected={selectedMethod === method.id}
                        onClick={() => setSelectedMethod(method.id)}
                      />
                    ))}
                  </VStack>
                </Box>

                {/* Right: Deposit form */}
                <Box
                  w={{ base: "100%", lg: "400px" }}
                  bg={cardBg}
                  border="1px solid"
                  borderColor={cardBorder}
                  borderRadius="16px"
                  p={6}
                >
                  <Text
                    fontSize="14px"
                    fontWeight="700"
                    
                    mb={5}
                  >
                    Deposit Details
                  </Text>

                  <VStack spacing={4} align="stretch">
                    <Box>
                      <Text
                        fontSize="10px"
                        fontWeight="700"
                        letterSpacing=".1em"
                        textTransform="uppercase"
                        mb={2}
                      >
                        Currency
                      </Text>
                      <Select
                        value={selectedWallet}
                        onChange={(e) => setSelectedWallet(e.target.value)}
                        bg="rgba(255,255,255,0.03)"
                        border="1px solid rgba(255,255,255,0.07)"
                        
                        fontSize="13px"
                        borderRadius="8px"
                        h="40px"
                        _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                        _focus={{ borderColor: "#3b82f6" }}
                      >
                        {wallets.map((wallet) => (
                          <option
                            key={wallet.currency}
                            value={wallet.currency}
                            style={{ background: "#0d0d1f" }}
                          >
                            {wallet.currency}
                          </option>
                        ))}
                      </Select>
                    </Box>

                    <Box>
                      <Text
                        fontSize="10px"
                        fontWeight="700"
                        color="#334155"
                        letterSpacing=".1em"
                        textTransform="uppercase"
                        mb={2}
                      >
                        Amount
                      </Text>
                      <Input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        type="number"
                        bg="rgba(255,255,255,0.03)"
                        border="1px solid rgba(255,255,255,0.07)"
                        
                        fontSize="14px"
                        fontFamily="'DM Mono', monospace"
                        borderRadius="8px"
                        h="40px"
                        _placeholder={{ color: "#1e293b" }}
                        _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
                        _focus={{ borderColor: "#3b82f6" }}
                      />
                    </Box>

                    {/* Wallet-specific deposit details */}
                    {selectedMethod === "crypto" && (
                      <Box p={4} bg="rgba(0,87,184,0.06)" border="1px solid rgba(0,87,184,0.15)" borderRadius="10px">
                        <Text fontSize="12px" fontWeight="700" mb={2}>{selectedWallet} Deposit Address</Text>
                        {(() => {
                          const wallet = wallets.find((w) => w.currency === selectedWallet);
                          const address = wallet?.address || "Contact support to generate deposit address";
                          return (
                            <Flex align="center" gap={2} p={2} bg="rgba(255,255,255,0.03)" borderRadius="6px" border="1px solid rgba(255,255,255,0.06)">
                              <Text fontSize="11px" fontFamily="'DM Mono'" color="#94a3b8" flex={1} noOfLines={1}>{address}</Text>
                              <Icon as={copied ? FiCheckCircle : FiCopy} color={copied ? "#22c55e" : "#64748b"} boxSize={3.5} cursor="pointer"
                                onClick={() => handleCopyAddress(address)} />
                            </Flex>
                          );
                        })()}
                        <Text fontSize="10px" color="#ffaa18" mt={2}>⚠️ Only send {selectedWallet} to this address. Wrong currency/network = lost funds.</Text>
                      </Box>
                    )}

                    {selectedMethod === "bank" && (
                      <Box p={4} bg="rgba(0,87,184,0.06)" border="1px solid rgba(0,87,184,0.15)" borderRadius="10px">
                        <Text fontSize="12px" fontWeight="700"  mb={2}>Bank Transfer Details</Text>
                        {[
                          { label: "Bank Name", value: "Revolut Bank" },
                          { label: "Account Name", value: "promrkts Ltd" },
                          { label: "Account Number", value: "0119-0001-2345-6789" },
                          { label: "Currency", value: selectedWallet },
                          { label: "Reference", value: `DEP-${user?.id?.slice(0,8).toUpperCase() || "USER"}` },
                        ].map(row => (
                          <Flex key={row.label} justify="space-between" py={1.5} borderBottom="1px solid rgba(255,255,255,0.04)" _last={{ borderBottom: "none" }}>
                            <Text fontSize="11px" color="#475569">{row.label}</Text>
                            <Flex align="center" gap={1}>
                              <Text fontSize="11px" fontWeight="600" color="#94a3b8" fontFamily="'DM Mono'">{row.value}</Text>
                              <Icon as={FiCopy} color="#475569" boxSize={3} cursor="pointer" onClick={() => handleCopyAddress(row.value)} />
                            </Flex>
                          </Flex>
                        ))}
                        <Text fontSize="10px" color="#f59e0b" mt={2}>⚠️ Include the reference in your transfer description for faster processing.</Text>
                      </Box>
                    )}

                    {selectedMethod === "mobile" && (
                      <Box p={4} bg="rgba(0,87,184,0.06)" border="1px solid rgba(0,87,184,0.15)" borderRadius="10px">
                        <Text fontSize="12px" fontWeight="700"  mb={2}>Mobile Payment</Text>
                        <Text fontSize="11px" color="#94a3b8" mb={1}>Send via <Text as="span" fontWeight="700" >Sadad</Text>, <Text as="span" fontWeight="700" >Masrefy</Text>, <Text as="span" fontWeight="700" >Moamalat</Text>, or <Text as="span" fontWeight="700" >Tadawul</Text></Text>
                        <Flex justify="space-between" py={1.5}>
                          <Text fontSize="11px" color="#475569">Phone Number</Text>
                          <Flex align="center" gap={1}>
                            <Text fontSize="11px" fontWeight="600" color="#94a3b8" fontFamily="'DM Mono'">+218 91 234 5678</Text>
                            <Icon as={FiCopy} color="#475569" boxSize={3} cursor="pointer" onClick={() => handleCopyAddress("+218912345678")} />
                          </Flex>
                        </Flex>
                        <Text fontSize="10px" color="#22c55e" mt={1}>✓ Fiat deposits via local gateways are confirmed instantly</Text>
                      </Box>
                    )}

                    {/* Info box */}
                    <Box p={3} bg="rgba(59,130,246,0.06)" border="1px solid rgba(59,130,246,0.15)" borderRadius="8px">
                      <Flex gap={2} align="flex-start">
                        <Icon as={FiInfo} color="#3b82f6" boxSize={3.5} mt="2px" flexShrink={0} />
                        <Text fontSize="11px" color={textSub} lineHeight={1.6}>
                          {selectedMethod === "bank" ? "Bank transfers typically take 1-3 business days. Include the reference for fast processing." :
                           selectedMethod === "mobile" ? "Fiat deposits via mobile money are confirmed instantly." :
                           selectedMethod === "crypto" ? "Send USDT to the address above. Funds credited after network confirmation." :
                           "Card deposits are processed instantly with a 3.5% fee."}
                          {" "}Minimum deposit: $10
                        </Text>
                      </Flex>
                    </Box>

                    <Button
                      onClick={handleDeposit}
                      isLoading={submitting}
                      isDisabled={!amount || parseFloat(amount) <= 0}
                      h="44px"
                      bg="linear-gradient(135deg,#2563eb,#1d4ed8)"
                      
                      fontSize="13px"
                      fontWeight="700"
                      borderRadius="10px"
                      transition="opacity 0.2s, transform 0.2s"
                      _hover={{
                        opacity: 0.92,
                        transform: "translateY(-1px)",
                        boxShadow: "0 8px 24px rgba(37,99,235,0.4)",
                      }}
                      leftIcon={<FiArrowDownRight />}
                    >
                      Create Deposit Request
                    </Button>
                  </VStack>
                </Box>
              </Flex>
            </TabPanel>

            {/* ── History Tab ── */}
            <TabPanel p={0}>
              <Box
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="16px"
                overflow="hidden"
              >
                {/* Header */}
                <Flex
                  px={4}
                  py={3}
                  bg="rgba(255,255,255,0.015)"
                  borderBottom="1px solid"
                  borderColor="rgba(255,255,255,0.04)"
                >
                  {["Currency", "Amount", "Status", "Date"].map((h, i) => (
                    <Text
                      key={h}
                      fontSize="9px"
                      fontWeight="700"
                      color="#1e293b"
                      letterSpacing=".1em"
                      textTransform="uppercase"
                      flex={
                        i === 0 ? "0 0 70px" : i === 2 ? "0 0 80px" : i === 3 ? "0 0 80px" : 1
                      }
                    >
                      {h}
                    </Text>
                  ))}
                </Flex>

                {/* Rows */}
                {deposits.length === 0 ? (
                  <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    h="200px"
                    gap={3}
                  >
                    <Icon as={FiArrowDownRight} color="#1e293b" boxSize={8} />
                    <Text fontSize="12px" color="#334155">
                      No deposits yet
                    </Text>
                    <Button
                      size="sm"
                      bg="rgba(37,99,235,0.15)"
                      color="#3b82f6"
                      fontSize="12px"
                      border="1px solid rgba(37,99,235,0.25)"
                      _hover={{ bg: "rgba(37,99,235,0.22)" }}
                      onClick={() => setActiveTab(0)}
                    >
                      Make First Deposit
                    </Button>
                  </Flex>
                ) : (
                  deposits.map((deposit) => (
                    <DepositRow key={deposit.id} deposit={deposit} />
                  ))
                )}
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
}
