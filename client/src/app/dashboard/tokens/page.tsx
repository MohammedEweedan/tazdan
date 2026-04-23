"use client";

import { useEffect, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Input, Textarea, Select,
  useToast, Spinner, SimpleGrid, useColorMode, Badge,
} from "@chakra-ui/react";
import {
  FiZap, FiDollarSign, FiLink, FiCheckCircle, FiClock, FiAlertTriangle, FiPlus, FiCopy, FiExternalLink,
} from "react-icons/fi";
import { memeTokenAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const brand = "#0057b8";
const CHAINS = ["BNB", "ETH", "SOL", "AVAX", "MATIC"];

const CHAIN_INFO: Record<string, { name: string; color: string; explorer: string }> = {
  BNB: { name: "BNB Smart Chain", color: "#f3ba2f", explorer: "https://bscscan.com" },
  ETH: { name: "Ethereum", color: "#627eea", explorer: "https://etherscan.io" },
  SOL: { name: "Solana", color: "#9945ff", explorer: "https://solscan.io" },
  AVAX: { name: "Avalanche", color: "#e84142", explorer: "https://snowtrace.io" },
  MATIC: { name: "Polygon", color: "#8247e5", explorer: "https://polygonscan.com" },
};

const STATUS_STYLE: Record<string, { color: string; icon: any; label: string }> = {
  PENDING_PAYMENT: { color: "#f59e0b", icon: FiClock, label: "Pending Payment" },
  DEPLOYING: { color: "#3b82f6", icon: FiClock, label: "Deploying..." },
  DEPLOYED: { color: "#22c55e", icon: FiCheckCircle, label: "Deployed" },
  FAILED: { color: "#ef4444", icon: FiAlertTriangle, label: "Failed" },
  REVOKED: { color: "#64748b", icon: FiAlertTriangle, label: "Revoked" },
};

export default function TokensPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const { colorMode } = useColorMode();
  const dk = colorMode === "dark";
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [myTokens, setMyTokens] = useState<any[]>([]);
  const [tab, setTab] = useState<"create" | "my">("create");

  // Form
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [totalSupply, setTotalSupply] = useState("1000000000");
  const [chain, setChain] = useState("BNB");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");

  const cardBg = dk ? "rgba(255,255,255,0.025)" : "white";
  const cardBorder = dk ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.1)";
  const textMain = dk ? "white" : "#0f172a";
  const textSub = dk ? "#94a3b8" : "#64748b";

  useEffect(() => {
    const load = async () => {
      try {
        const [feesRes, tokensRes] = await Promise.all([
          memeTokenAPI.getFees(),
          memeTokenAPI.getMyTokens(),
        ]);
        setFees(feesRes.data.fees || {});
        setMyTokens(tokensRes.data.tokens || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDeploy = async () => {
    if (!name || !symbol) {
      toast({ title: "Name and symbol are required", status: "warning", duration: 3000 });
      return;
    }
    if (user?.kycStatus !== "APPROVED") {
      toast({ title: "KYC verification required", description: "Complete identity verification to mint tokens", status: "error", duration: 4000 });
      return;
    }

    setDeploying(true);
    try {
      const res = await memeTokenAPI.create({
        name, symbol, description, totalSupply, decimals: 18, chain,
        website: website || undefined, twitter: twitter || undefined, telegram: telegram || undefined,
      });
      toast({
        title: "Token deployment initiated!",
        description: `${res.data.fee} USDT fee charged. Deploying ${symbol} on ${chain}...`,
        status: "success",
        duration: 5000,
      });
      // Refresh
      const tokensRes = await memeTokenAPI.getMyTokens();
      setMyTokens(tokensRes.data.tokens || []);
      setTab("my");
      setName(""); setSymbol(""); setDescription(""); setTotalSupply("1000000000"); setWebsite(""); setTwitter(""); setTelegram("");
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
    color: textMain,
    fontSize: "13px",
    borderRadius: "8px",
    h: "40px",
    _hover: { borderColor: brand + "40" },
    _focus: { borderColor: brand },
  };

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" direction="column" gap={4}>
        <Spinner color={brand} size="lg" />
        <Text fontSize="12px" color={textSub}>Loading Token Studio</Text>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" color={textMain}>
      {/* Header */}
      <Flex px={{ base: 4, lg: 6 }} py={4} borderBottom="1px solid" borderColor={cardBorder} align="center" justify="space-between"
        bg={dk ? "rgba(5,5,18,0.95)" : "rgba(255,255,255,0.95)"} backdropFilter="blur(16px)" position="sticky" top={0} zIndex={50}>
        <HStack spacing={3}>
          <Icon as={FiZap} color={brand} boxSize={5} />
          <Box>
            <Text fontSize="16px" fontWeight="800">Token Studio</Text>
            <Text fontSize="11px" color={textSub}>Mint your own memecoin on any chain</Text>
          </Box>
        </HStack>
        <HStack spacing={2}>
          {["create", "my"].map(t => (
            <Button key={t} size="sm" h="32px" px={4} fontSize="12px" fontWeight="700" borderRadius="8px"
              bg={tab === t ? brand : "transparent"} color={tab === t ? "white" : textSub}
              border={tab !== t ? "1px solid" : "none"} borderColor={cardBorder}
              onClick={() => setTab(t as any)} _hover={{ bg: tab === t ? "#003d82" : dk ? "rgba(255,255,255,0.05)" : "#f1f5f9" }}>
              {t === "create" ? "Create Token" : `My Tokens (${myTokens.length})`}
            </Button>
          ))}
        </HStack>
      </Flex>

      <Box p={{ base: 4, lg: 6 }} maxW="900px" mx="auto">
        {tab === "create" && (
          <>
            {/* Fee Schedule */}
            <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={5} mb={5}>
              <Text fontSize="14px" fontWeight="800" mb={3}>Deployment Fees</Text>
              <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3}>
                {CHAINS.map(c => {
                  const info = CHAIN_INFO[c];
                  const fee = fees[c] || 0;
                  const active = chain === c;
                  return (
                    <Box key={c} as="button" onClick={() => setChain(c)} p={3} borderRadius="12px" textAlign="center"
                      bg={active ? info.color + "15" : dk ? "rgba(255,255,255,0.02)" : "#f8fafc"}
                      border="2px solid" borderColor={active ? info.color : "transparent"} transition="all 0.15s"
                      _hover={{ borderColor: info.color + "60" }}>
                      <Text fontSize="16px" fontWeight="800" color={info.color}>{c}</Text>
                      <Text fontSize="10px" color={textSub} mt={0.5}>{info.name}</Text>
                      <Text fontSize="14px" fontWeight="800" color={textMain} mt={1}>${fee}</Text>
                      <Text fontSize="9px" color={textSub}>USDT</Text>
                    </Box>
                  );
                })}
              </SimpleGrid>
            </Box>

            {/* Create Form */}
            <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={6} mb={5}>
              <Text fontSize="16px" fontWeight="800" mb={1}>Create Your Token</Text>
              <Text fontSize="12px" color={textSub} mb={5}>Fill in details for your new memecoin</Text>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                <Box>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Token Name *</Text>
                  <Input placeholder="e.g. DogeCash" value={name} onChange={(e) => setName(e.target.value)} {...inputStyle} />
                </Box>
                <Box>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Symbol *</Text>
                  <Input placeholder="e.g. DOGEC" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))} {...inputStyle} />
                </Box>
              </SimpleGrid>

              <Box mb={4}>
                <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Description</Text>
                <Textarea placeholder="Describe your token..." value={description} onChange={(e) => setDescription(e.target.value)}
                  bg={dk ? "rgba(255,255,255,0.03)" : "#f8fafc"} border="1px solid" borderColor={dk ? "rgba(255,255,255,0.07)" : "#e2e8f0"}
                  color={textMain} fontSize="13px" borderRadius="8px" rows={3} _hover={{ borderColor: brand + "40" }} _focus={{ borderColor: brand }} />
              </Box>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                <Box>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Total Supply *</Text>
                  <Input placeholder="1000000000" value={totalSupply} onChange={(e) => setTotalSupply(e.target.value.replace(/\D/g, ""))} {...inputStyle} />
                </Box>
                <Box>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Blockchain</Text>
                  <Select value={chain} onChange={(e) => setChain(e.target.value)} {...inputStyle}>
                    {CHAINS.map(c => <option key={c} value={c} style={{ background: dk ? "#0a0a1a" : "white" }}>{CHAIN_INFO[c].name} ({c})</option>)}
                  </Select>
                </Box>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={5}>
                <Box>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Website</Text>
                  <Input placeholder="https://..." value={website} onChange={(e) => setWebsite(e.target.value)} {...inputStyle} />
                </Box>
                <Box>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Twitter</Text>
                  <Input placeholder="@handle" value={twitter} onChange={(e) => setTwitter(e.target.value)} {...inputStyle} />
                </Box>
                <Box>
                  <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing=".05em" textTransform="uppercase" mb={1}>Telegram</Text>
                  <Input placeholder="@group" value={telegram} onChange={(e) => setTelegram(e.target.value)} {...inputStyle} />
                </Box>
              </SimpleGrid>

              {/* Summary */}
              <Box p={4} bg={dk ? "rgba(0,87,184,0.08)" : "rgba(0,87,184,0.04)"} borderRadius="12px" border="1px solid" borderColor={brand + "20"} mb={4}>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontSize="12px" color={textSub}>Deployment Chain</Text>
                  <Text fontSize="12px" fontWeight="700" color={CHAIN_INFO[chain]?.color}>{CHAIN_INFO[chain]?.name}</Text>
                </Flex>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontSize="12px" color={textSub}>Platform Fee</Text>
                  <Text fontSize="14px" fontWeight="800" color={textMain}>{fees[chain] || 0} USDT</Text>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="12px" color={textSub}>Total Supply</Text>
                  <Text fontSize="12px" fontWeight="600" color={textMain}>{Number(totalSupply || 0).toLocaleString()} {symbol || "TOKENS"}</Text>
                </Flex>
              </Box>

              {user?.kycStatus !== "APPROVED" && (
                <Box p={3} bg="rgba(239,68,68,0.06)" border="1px solid rgba(239,68,68,0.15)" borderRadius="10px" mb={4}>
                  <HStack spacing={2}>
                    <Icon as={FiAlertTriangle} color="#ef4444" boxSize={4} />
                    <Text fontSize="12px" color="#ef4444" fontWeight="600">KYC verification required to deploy tokens. <Text as="a" href="/dashboard/kyc" color={brand} textDecoration="underline">Verify now</Text></Text>
                  </HStack>
                </Box>
              )}

              <Button onClick={handleDeploy} isLoading={deploying} isDisabled={!name || !symbol || !totalSupply || user?.kycStatus !== "APPROVED"}
                w="100%" h="48px" bg={brand} color="white" fontSize="14px" fontWeight="700" borderRadius="12px"
                leftIcon={<FiZap size={16} />}
                _hover={{ bg: "#003d82", transform: "translateY(-1px)", boxShadow: `0 8px 24px ${brand}44` }}
                transition="all 0.2s" _disabled={{ opacity: 0.5, cursor: "not-allowed" }}>
                Deploy Token — {fees[chain] || 0} USDT
              </Button>
            </Box>
          </>
        )}

        {tab === "my" && (
          <VStack spacing={4} align="stretch">
            {myTokens.length === 0 ? (
              <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={8} textAlign="center">
                <Text fontSize="40px" mb={3}>🪙</Text>
                <Text fontSize="16px" fontWeight="800" mb={2}>No Tokens Yet</Text>
                <Text fontSize="13px" color={textSub} mb={4}>Create your first memecoin on the "Create Token" tab</Text>
                <Button size="sm" bg={brand} color="white" borderRadius="8px" onClick={() => setTab("create")} leftIcon={<FiPlus size={14} />}
                  _hover={{ bg: "#003d82" }}>Create Token</Button>
              </Box>
            ) : (
              myTokens.map((token: any) => {
                const s = STATUS_STYLE[token.status] || STATUS_STYLE.FAILED;
                const info = CHAIN_INFO[token.chain] || CHAIN_INFO.BNB;
                return (
                  <Box key={token.id} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" p={5}>
                    <Flex justify="space-between" align="flex-start" mb={3}>
                      <Box>
                        <HStack spacing={2} mb={1}>
                          <Text fontSize="18px" fontWeight="800">{token.name}</Text>
                          <Badge px={2} py={0.5} borderRadius="4px" fontSize="10px" fontWeight="800" bg={info.color + "20"} color={info.color}>{token.chain}</Badge>
                        </HStack>
                        <Text fontSize="13px" fontWeight="700" color={textSub}>${token.symbol}</Text>
                      </Box>
                      <HStack spacing={1.5} px={3} py={1} borderRadius="6px" bg={s.color + "15"}>
                        <Icon as={s.icon} color={s.color} boxSize={3} />
                        <Text fontSize="11px" fontWeight="700" color={s.color}>{s.label}</Text>
                      </HStack>
                    </Flex>

                    {token.description && <Text fontSize="12px" color={textSub} mb={3}>{token.description}</Text>}

                    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={3}>
                      <Box>
                        <Text fontSize="10px" color={textSub} fontWeight="600">Total Supply</Text>
                        <Text fontSize="13px" fontWeight="700" color={textMain}>{Number(token.totalSupply).toLocaleString()}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="10px" color={textSub} fontWeight="600">Decimals</Text>
                        <Text fontSize="13px" fontWeight="700" color={textMain}>{token.decimals}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="10px" color={textSub} fontWeight="600">Fee Paid</Text>
                        <Text fontSize="13px" fontWeight="700" color={textMain}>{parseFloat(token.platformFee)} USDT</Text>
                      </Box>
                      <Box>
                        <Text fontSize="10px" color={textSub} fontWeight="600">Created</Text>
                        <Text fontSize="13px" fontWeight="700" color={textMain}>{new Date(token.createdAt).toLocaleDateString()}</Text>
                      </Box>
                    </SimpleGrid>

                    {token.contractAddress && (
                      <Flex p={3} bg={dk ? "rgba(255,255,255,0.02)" : "#f8fafc"} borderRadius="8px" align="center" gap={2}>
                        <Text fontSize="10px" color={textSub} fontWeight="700">CONTRACT:</Text>
                        <Text fontSize="11px" fontFamily="'DM Mono'" color={textMain} noOfLines={1} flex={1}>{token.contractAddress}</Text>
                        <Button size="xs" variant="ghost" color={brand} onClick={() => { navigator.clipboard.writeText(token.contractAddress); toast({ title: "Copied!", status: "success", duration: 1500 }); }}>
                          <FiCopy size={12} />
                        </Button>
                        <Button size="xs" variant="ghost" color={brand} as="a" href={`${info.explorer}/address/${token.contractAddress}`} target="_blank">
                          <FiExternalLink size={12} />
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
