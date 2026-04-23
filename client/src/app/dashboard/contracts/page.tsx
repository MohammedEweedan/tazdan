"use client";

import { useEffect, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Input, Textarea, Select,
  useToast, Spinner, SimpleGrid, useColorMode, Badge,
} from "@chakra-ui/react";
import {
  FiCode, FiCheckCircle, FiClock, FiAlertTriangle, FiCopy, FiExternalLink, FiShield, FiLock, FiDollarSign,
} from "react-icons/fi";
import { smartContractAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const brand = "#0057b8";

type Template = { type: string; name: string; description: string; fee: number };

const PARAM_FIELDS: Record<string, { label: string; placeholder: string; key: string }[]> = {
  ESCROW: [
    { label: "Buyer Address", placeholder: "0x...", key: "buyerAddress" },
    { label: "Seller Address", placeholder: "0x...", key: "sellerAddress" },
    { label: "Amount (USDT)", placeholder: "1000", key: "amount" },
    { label: "Release Condition", placeholder: "e.g. Delivery confirmed", key: "releaseCondition" },
  ],
  VESTING: [
    { label: "Beneficiary Address", placeholder: "0x...", key: "beneficiary" },
    { label: "Token Address", placeholder: "0x...", key: "tokenAddress" },
    { label: "Total Amount", placeholder: "1000000", key: "totalAmount" },
    { label: "Vesting Duration (days)", placeholder: "365", key: "durationDays" },
    { label: "Cliff Period (days)", placeholder: "90", key: "cliffDays" },
  ],
  MULTISIG: [
    { label: "Owner 1 Address", placeholder: "0x...", key: "owner1" },
    { label: "Owner 2 Address", placeholder: "0x...", key: "owner2" },
    { label: "Owner 3 Address (optional)", placeholder: "0x...", key: "owner3" },
    { label: "Required Signatures", placeholder: "2", key: "requiredSignatures" },
  ],
  TOKEN_LOCK: [
    { label: "Token Address", placeholder: "0x...", key: "tokenAddress" },
    { label: "Lock Amount", placeholder: "1000000", key: "lockAmount" },
    { label: "Lock Duration (days)", placeholder: "180", key: "lockDays" },
  ],
  PAYMENT_SPLITTER: [
    { label: "Recipient 1 Address", placeholder: "0x...", key: "recipient1" },
    { label: "Recipient 1 Share (%)", placeholder: "50", key: "share1" },
    { label: "Recipient 2 Address", placeholder: "0x...", key: "recipient2" },
    { label: "Recipient 2 Share (%)", placeholder: "50", key: "share2" },
  ],
  CUSTOM: [
    { label: "Contract Description", placeholder: "Describe what you need...", key: "customDescription" },
    { label: "Special Requirements", placeholder: "Any specific logic or conditions", key: "customRequirements" },
  ],
};

const STATUS_STYLE: Record<string, { color: string; icon: any; label: string }> = {
  DRAFT: { color: "#64748b", icon: FiClock, label: "Draft" },
  PENDING_PAYMENT: { color: "#f59e0b", icon: FiClock, label: "Pending Payment" },
  DEPLOYING: { color: "#3b82f6", icon: FiClock, label: "Deploying..." },
  DEPLOYED: { color: "#22c55e", icon: FiCheckCircle, label: "Deployed" },
  FAILED: { color: "#ef4444", icon: FiAlertTriangle, label: "Failed" },
};

export default function ContractsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const { colorMode } = useColorMode();
  const dk = colorMode === "dark";
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [myContracts, setMyContracts] = useState<any[]>([]);
  const [tab, setTab] = useState<"create" | "my">("create");
  const [selectedType, setSelectedType] = useState<string>("");
  const [chain, setChain] = useState("BNB");
  const [contractName, setContractName] = useState("");
  const [contractDesc, setContractDesc] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});

  const cardBg = dk ? "rgba(255,255,255,0.025)" : "white";
  const cardBorder = dk ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.1)";
  const textMain = dk ? "white" : "#0f172a";
  const textSub = dk ? "#94a3b8" : "#64748b";

  const CHAINS = ["BNB", "ETH", "SOL", "AVAX", "MATIC"];
  const CHAIN_COLORS: Record<string, string> = { BNB: "#f3ba2f", ETH: "#627eea", SOL: "#9945ff", AVAX: "#e84142", MATIC: "#8247e5" };

  useEffect(() => {
    const load = async () => {
      try {
        const [feesRes, contractsRes] = await Promise.all([
          smartContractAPI.getFees(),
          smartContractAPI.getMyContracts(),
        ]);
        setTemplates(feesRes.data.templates || []);
        setMyContracts(contractsRes.data.contracts || []);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    load();
  }, []);

  const selectedTemplate = templates.find(t => t.type === selectedType);

  const handleDeploy = async () => {
    if (!selectedType || !contractName) {
      toast({ title: "Select a template and enter a name", status: "warning", duration: 3000 });
      return;
    }
    if (user?.kycStatus !== "APPROVED") {
      toast({ title: "KYC verification required", status: "error", duration: 4000 });
      return;
    }
    setDeploying(true);
    try {
      const res = await smartContractAPI.create({
        type: selectedType, name: contractName, description: contractDesc, chain, parameters: params,
      });
      toast({
        title: "Contract deployment initiated!",
        description: `${res.data.fee} USDT fee charged. Deploying on ${chain}...`,
        status: "success", duration: 5000,
      });
      const contractsRes = await smartContractAPI.getMyContracts();
      setMyContracts(contractsRes.data.contracts || []);
      setTab("my");
      setSelectedType(""); setContractName(""); setContractDesc(""); setParams({});
    } catch (e: any) {
      toast({ title: "Deployment failed", description: e?.response?.data?.error || "Try again", status: "error", duration: 4000 });
    } finally {
      setDeploying(false);
    }
  };

  const inputStyle = {
    bg: dk ? "rgba(255,255,255,0.03)" : "#f8fafc",
    border: "1px solid",
    borderColor: dk ? "rgba(255,255,255,0.07)" : "#e2e8f0",
    color: textMain, fontSize: "13px", borderRadius: "8px", h: "40px",
    _hover: { borderColor: brand + "40" }, _focus: { borderColor: brand },
  };

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" direction="column" gap={4}>
        <Spinner color={brand} size="lg" />
        <Text fontSize="12px" color={textSub}>Loading Contract Studio</Text>
      </Flex>
    );
  }

  const TYPE_ICONS: Record<string, any> = {
    ESCROW: FiShield, VESTING: FiClock, MULTISIG: FiLock, TOKEN_LOCK: FiLock,
    PAYMENT_SPLITTER: FiDollarSign, CUSTOM: FiCode,
  };

  return (
    <Box minH="100vh" color={textMain}>
      {/* Header */}
      <Flex px={{ base: 4, lg: 6 }} py={4} borderBottom="1px solid" borderColor={cardBorder} align="center" justify="space-between"
        bg={dk ? "rgba(5,5,18,0.95)" : "rgba(255,255,255,0.95)"} backdropFilter="blur(16px)" position="sticky" top={0} zIndex={50}>
        <HStack spacing={3}>
          <Icon as={FiCode} color={brand} boxSize={5} />
          <Box>
            <Text fontSize="16px" fontWeight="800">Smart Contract Studio</Text>
            <Text fontSize="11px" color={textSub}>Deploy contracts with escrow integration</Text>
          </Box>
        </HStack>
        <HStack spacing={2}>
          {["create", "my"].map(t => (
            <Button key={t} size="sm" h="32px" px={4} fontSize="12px" fontWeight="700" borderRadius="8px"
              bg={tab === t ? brand : "transparent"} color={tab === t ? "white" : textSub}
              border={tab !== t ? "1px solid" : "none"} borderColor={cardBorder}
              onClick={() => setTab(t as any)} _hover={{ bg: tab === t ? "#003d82" : dk ? "rgba(255,255,255,0.05)" : "#f1f5f9" }}>
              {t === "create" ? "Create Contract" : `My Contracts (${myContracts.length})`}
            </Button>
          ))}
        </HStack>
      </Flex>

      <Box p={{ base: 4, lg: 6 }} maxW="900px" mx="auto">
        {tab === "create" && (
          <>
            {/* Template Selector */}
            <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={5} mb={5}>
              <Text fontSize="14px" fontWeight="800" mb={3}>Choose a Template</Text>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                {templates.map(t => {
                  const active = selectedType === t.type;
                  const TIcon = TYPE_ICONS[t.type] || FiCode;
                  return (
                    <Box key={t.type} as="button" onClick={() => { setSelectedType(t.type); setParams({}); }}
                      p={4} borderRadius="12px" textAlign="left" border="2px solid"
                      bg={active ? brand + "0A" : dk ? "rgba(255,255,255,0.02)" : "#f8fafc"}
                      borderColor={active ? brand : "transparent"} transition="all 0.15s"
                      _hover={{ borderColor: brand + "40" }}>
                      <Flex gap={3} align="flex-start">
                        <Flex w="36px" h="36px" borderRadius="10px" bg={brand + "14"} align="center" justify="center" flexShrink={0}>
                          <Icon as={TIcon} color={brand} boxSize={4} />
                        </Flex>
                        <Box>
                          <Text fontSize="13px" fontWeight="700" color={textMain}>{t.name}</Text>
                          <Text fontSize="11px" color={textSub} mt={0.5} noOfLines={2}>{t.description}</Text>
                          <Text fontSize="13px" fontWeight="800" color={brand} mt={2}>${t.fee} USDT</Text>
                        </Box>
                      </Flex>
                    </Box>
                  );
                })}
              </SimpleGrid>
            </Box>

            {/* Config Form */}
            {selectedType && (
              <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={6} mb={5}>
                <Text fontSize="16px" fontWeight="800" mb={1}>Configure: {selectedTemplate?.name}</Text>
                <Text fontSize="12px" color={textSub} mb={5}>{selectedTemplate?.description}</Text>

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                  <Box>
                    <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Contract Name *</Text>
                    <Input placeholder="My Escrow Contract" value={contractName} onChange={(e) => setContractName(e.target.value)} {...inputStyle} />
                  </Box>
                  <Box>
                    <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Blockchain</Text>
                    <Select value={chain} onChange={(e) => setChain(e.target.value)} {...inputStyle}>
                      {CHAINS.map(c => <option key={c} value={c} style={{ background: dk ? "#0a0a1a" : "white" }}>{c}</option>)}
                    </Select>
                  </Box>
                </SimpleGrid>

                <Box mb={4}>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Description (optional)</Text>
                  <Textarea placeholder="What's this contract for?" value={contractDesc} onChange={(e) => setContractDesc(e.target.value)}
                    bg={dk ? "rgba(255,255,255,0.03)" : "#f8fafc"} border="1px solid" borderColor={dk ? "rgba(255,255,255,0.07)" : "#e2e8f0"}
                    color={textMain} fontSize="13px" borderRadius="8px" rows={2} _hover={{ borderColor: brand + "40" }} _focus={{ borderColor: brand }} />
                </Box>

                {/* Type-specific params */}
                <Text fontSize="12px" fontWeight="700" color={textMain} mb={3}>Contract Parameters</Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mb={5}>
                  {(PARAM_FIELDS[selectedType] || []).map(field => (
                    <Box key={field.key}>
                      <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>{field.label}</Text>
                      <Input placeholder={field.placeholder} value={params[field.key] || ""}
                        onChange={(e) => setParams(prev => ({ ...prev, [field.key]: e.target.value }))} {...inputStyle} />
                    </Box>
                  ))}
                </SimpleGrid>

                {user?.kycStatus !== "APPROVED" && (
                  <Box p={3} bg="rgba(239,68,68,0.06)" border="1px solid rgba(239,68,68,0.15)" borderRadius="10px" mb={4}>
                    <HStack spacing={2}>
                      <Icon as={FiAlertTriangle} color="#ef4444" boxSize={4} />
                      <Text fontSize="12px" color="#ef4444" fontWeight="600">KYC verification required. <Text as="a" href="/dashboard/kyc" color={brand} textDecoration="underline">Verify now</Text></Text>
                    </HStack>
                  </Box>
                )}

                <Button onClick={handleDeploy} isLoading={deploying} isDisabled={!contractName || user?.kycStatus !== "APPROVED"}
                  w="100%" h="48px" bg={brand} color="white" fontSize="14px" fontWeight="700" borderRadius="12px"
                  leftIcon={<FiCode size={16} />}
                  _hover={{ bg: "#003d82", transform: "translateY(-1px)", boxShadow: `0 8px 24px ${brand}44` }}
                  transition="all 0.2s" _disabled={{ opacity: 0.5, cursor: "not-allowed" }}>
                  Deploy Contract — {selectedTemplate?.fee || 0} USDT
                </Button>
              </Box>
            )}
          </>
        )}

        {tab === "my" && (
          <VStack spacing={4} align="stretch">
            {myContracts.length === 0 ? (
              <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={8} textAlign="center">
                <Text fontSize="40px" mb={3}>📜</Text>
                <Text fontSize="16px" fontWeight="800" mb={2}>No Contracts Yet</Text>
                <Text fontSize="13px" color={textSub} mb={4}>Deploy your first smart contract using our templates</Text>
                <Button size="sm" bg={brand} color="white" borderRadius="8px" onClick={() => setTab("create")} leftIcon={<FiCode size={14} />}
                  _hover={{ bg: "#003d82" }}>Create Contract</Button>
              </Box>
            ) : (
              myContracts.map((c: any) => {
                const s = STATUS_STYLE[c.status] || STATUS_STYLE.FAILED;
                return (
                  <Box key={c.id} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={5}>
                    <Flex justify="space-between" align="flex-start" mb={3}>
                      <Box>
                        <HStack spacing={2} mb={1}>
                          <Text fontSize="16px" fontWeight="800">{c.name}</Text>
                          <Badge px={2} py={0.5} borderRadius="4px" fontSize="10px" fontWeight="800" bg={CHAIN_COLORS[c.chain] + "20" || brand + "20"} color={CHAIN_COLORS[c.chain] || brand}>{c.chain}</Badge>
                        </HStack>
                        <Text fontSize="12px" color={textSub}>{c.type.replace(/_/g, " ")}</Text>
                      </Box>
                      <HStack spacing={1.5} px={3} py={1} borderRadius="6px" bg={s.color + "15"}>
                        <Icon as={s.icon} color={s.color} boxSize={3} />
                        <Text fontSize="11px" fontWeight="700" color={s.color}>{s.label}</Text>
                      </HStack>
                    </Flex>

                    {c.description && <Text fontSize="12px" color={textSub} mb={3}>{c.description}</Text>}

                    <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3} mb={3}>
                      <Box>
                        <Text fontSize="10px" color={textSub} fontWeight="600">Fee Paid</Text>
                        <Text fontSize="13px" fontWeight="700">{parseFloat(c.platformFee)} USDT</Text>
                      </Box>
                      <Box>
                        <Text fontSize="10px" color={textSub} fontWeight="600">Created</Text>
                        <Text fontSize="13px" fontWeight="700">{new Date(c.createdAt).toLocaleDateString()}</Text>
                      </Box>
                      {c.deployedAt && (
                        <Box>
                          <Text fontSize="10px" color={textSub} fontWeight="600">Deployed</Text>
                          <Text fontSize="13px" fontWeight="700">{new Date(c.deployedAt).toLocaleDateString()}</Text>
                        </Box>
                      )}
                    </SimpleGrid>

                    {c.contractAddress && (
                      <Flex p={3} bg={dk ? "rgba(255,255,255,0.02)" : "#f8fafc"} borderRadius="8px" align="center" gap={2}>
                        <Text fontSize="10px" color={textSub} fontWeight="700">ADDRESS:</Text>
                        <Text fontSize="11px" fontFamily="'DM Mono'" color={textMain} noOfLines={1} flex={1}>{c.contractAddress}</Text>
                        <Button size="xs" variant="ghost" color={brand} onClick={() => { navigator.clipboard.writeText(c.contractAddress); toast({ title: "Copied!", status: "success", duration: 1500 }); }}>
                          <FiCopy size={12} />
                        </Button>
                      </Flex>
                    )}
                  </Box>
                );
              })
            )}
          </VStack>
        )}
      </Box>
    </Box>
  );
}
