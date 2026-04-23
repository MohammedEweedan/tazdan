"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, useToast, Spinner,
} from "@chakra-ui/react";
import {
  FiCreditCard, FiPlus, FiLock, FiUnlock, FiZap, FiShoppingBag,
  FiTrendingUp, FiGlobe, FiWifi, FiShield, FiPauseCircle,
} from "react-icons/fi";
import { cardAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import {
  PageShell, PageHeader, GlassCard, SectionHeader, StatTile,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

type Tier = "STARTER" | "MASTER" | "PRO";
const TIER_META: Record<Tier, { label: string; cashback: string; color: string; gradient: string }> = {
  STARTER: {
    label: "Starter",
    cashback: "1% cashback",
    color: "#64748b",
    gradient: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
  },
  MASTER: {
    label: "Master",
    cashback: "1.5% cashback",
    color: "#0057b8",
    gradient: "linear-gradient(135deg, #0057b8 0%, #003d82 50%, #1e40af 100%)",
  },
  PRO: {
    label: "Pro",
    cashback: "2% cashback",
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #0c0a1a 100%)",
  },
};

function fmt4(last4: string) {
  // "1144" → "1144 4411 1142 1144" visual (repeat + mask style like screenshot)
  const s = last4 || "0000";
  return `${s} ${"•".repeat(4)} ${"•".repeat(4)} ${s}`;
}

export default function CardsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const tok = useDashboardTokens();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [txs, setTxs] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => cards.find((c) => c.id === selectedId), [cards, selectedId]);

  const loadCards = async () => {
    try {
      const res = await cardAPI.list();
      const list = res.data.cards || [];
      setCards(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTx = async (id: string) => {
    setTxLoading(true);
    try {
      const res = await cardAPI.transactions(id, 1, 10);
      setTxs(res.data.items || []);
    } catch {} finally {
      setTxLoading(false);
    }
  };

  useEffect(() => { loadCards(); }, []);
  useEffect(() => { if (selectedId) loadTx(selectedId); }, [selectedId]);

  const handleCreate = async (tier: Tier) => {
    setBusy(true);
    try {
      await cardAPI.create({ tier, currency: "USDT" });
      toast({ title: `${TIER_META[tier].label} card issued`, status: "success", duration: 3000 });
      await loadCards();
    } catch (e: any) {
      toast({
        title: "Card issuance failed",
        description: e?.response?.data?.error || "Try again",
        status: "error",
        duration: 4000,
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleFreeze = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (selected.frozen) await cardAPI.unfreeze(selected.id);
      else await cardAPI.freeze(selected.id);
      toast({
        title: selected.frozen ? "Card unfrozen" : "Card frozen",
        status: "success",
        duration: 2500,
      });
      await loadCards();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.response?.data?.error || "Try again", status: "error", duration: 3000 });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  // No cards yet — pick a tier to issue
  if (cards.length === 0) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Spend anywhere"
          title="Promrkts Card"
          subtitle="Spend any coin anywhere Visa is accepted. Instant conversion, zero FX markup."
        />

        <GlassCard p={0}>
          <Box p={{ base: 6, md: 8 }} textAlign="center">
            <Flex w="72px" h="72px" borderRadius="18px" bg={`${tok.brand}14`} color={tok.brand} align="center" justify="center" mx="auto" mb={4}>
              <Icon as={FiCreditCard} boxSize={8} />
            </Flex>
            <Text fontSize="22px" fontWeight="900" color={tok.textMain} letterSpacing="-0.02em">
              Get your first card
            </Text>
            <Text fontSize="13px" color={tok.textSub} mt={1.5} maxW="480px" mx="auto">
              Pick a tier. We'll issue a virtual Visa you can top up with any crypto in your wallet.
            </Text>

            <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4} mt={6}>
              {(Object.keys(TIER_META) as Tier[]).map((t) => {
                const meta = TIER_META[t];
                return (
                  <Box
                    key={t}
                    p={5}
                    borderRadius="16px"
                    border="1px solid"
                    borderColor={tok.panelBorder}
                    bg={tok.panelInner}
                    textAlign="left"
                    transition="all 0.2s"
                    _hover={{ transform: "translateY(-2px)", borderColor: meta.color, boxShadow: `0 12px 28px ${meta.color}22` }}
                  >
                    <Box w="40px" h="26px" borderRadius="6px" bg={meta.gradient} mb={3} boxShadow={`0 4px 12px ${meta.color}55`} />
                    <Text fontSize="16px" fontWeight="900" color={tok.textMain}>{meta.label}</Text>
                    <Text fontSize="11.5px" fontWeight="800" color={meta.color} letterSpacing=".06em" mt={0.5}>
                      {meta.cashback.toUpperCase()}
                    </Text>
                    <Button
                      mt={4}
                      w="100%"
                      h="40px"
                      bg={meta.gradient}
                      color="white"
                      fontSize="12px"
                      fontWeight="800"
                      borderRadius="10px"
                      isLoading={busy}
                      onClick={() => handleCreate(t)}
                      _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 20px ${meta.color}55` }}
                      transition="all 0.2s"
                    >
                      Issue {meta.label}
                    </Button>
                  </Box>
                );
              })}
            </Box>

            <Text fontSize="11px" color={tok.textMuted} mt={5}>
              KYC approval required · No annual fee · Cancel any time
            </Text>
          </Box>
        </GlassCard>
      </PageShell>
    );
  }

  const tier = (selected?.tier || "STARTER") as Tier;
  const tierMeta = TIER_META[tier];
  const spent = Number(selected?.spentMonth || 0);
  const limit = Number(selected?.monthlyLimit || 0);
  const cashback = Number(selected?.cashbackBalance || 0);
  const spentPct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Spend anywhere"
        title="My Card"
        subtitle={`${cards.length} ${cards.length === 1 ? "active card" : "active cards"} · Spend crypto in the real world.`}
        right={
          cards.length < 3 && (
            <Button
              size="sm"
              h="36px"
              px={3}
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              borderRadius="10px"
              fontWeight="800"
              leftIcon={<FiPlus />}
              onClick={() => handleCreate("MASTER")}
              isLoading={busy}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
              transition="all 0.2s"
            >
              Add card
            </Button>
          )
        }
      />

      {/* Tier tabs (horizontal card selector) */}
      <HStack
        spacing={1}
        p={1}
        bg={tok.panelInner}
        border="1px solid"
        borderColor={tok.panelBorder}
        borderRadius="12px"
        mb={4}
        w="fit-content"
      >
        {cards.map((c: any) => {
          const m = TIER_META[c.tier as Tier];
          const active = c.id === selectedId;
          return (
            <Box
              key={c.id}
              as="button"
              onClick={() => setSelectedId(c.id)}
              px={3.5}
              py={1.5}
              borderRadius="9px"
              fontSize="12px"
              fontWeight="800"
              bg={active ? (tok.dark ? "rgba(255,255,255,0.08)" : "white") : "transparent"}
              color={active ? m.color : tok.textSub}
              boxShadow={active ? (tok.dark ? "0 2px 10px rgba(0,87,184,0.15)" : "0 2px 8px rgba(0,87,184,0.08)") : "none"}
              transition="all 0.15s"
              _hover={{ color: tok.textMain }}
              display="flex"
              alignItems="center"
              gap={1.5}
            >
              <Box w="8px" h="8px" borderRadius="full" bg={m.gradient} />
              {m.label}
              <Text as="span" fontSize="10px" color={tok.textMuted} fontFamily="monospace" fontWeight="700">
                ··{c.last4}
              </Text>
            </Box>
          );
        })}
      </HStack>

      {/* Main grid */}
      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "minmax(320px, 440px) 1fr" }} gap={4}>
        {/* Card visual + stats */}
        <VStack align="stretch" spacing={4}>
          {/* Visual card */}
          <Box
            borderRadius="20px"
            p={6}
            color="white"
            bg={tierMeta.gradient}
            boxShadow={`0 20px 48px ${tierMeta.color}44`}
            position="relative"
            overflow="hidden"
            minH="220px"
            display="flex"
            flexDirection="column"
            justifyContent="space-between"
          >
            {/* Decorative */}
            <Box
              position="absolute"
              top="-60px"
              right="-60px"
              w="220px"
              h="220px"
              borderRadius="full"
              bg="rgba(255,255,255,0.08)"
              filter="blur(40px)"
            />
            <Box
              position="absolute"
              bottom="-40px"
              left="-40px"
              w="180px"
              h="180px"
              borderRadius="full"
              bg="rgba(255,255,255,0.04)"
              filter="blur(30px)"
            />

            <Flex justify="space-between" align="flex-start" position="relative">
              <Text fontSize="15px" fontWeight="900" letterSpacing="-0.02em" opacity={0.95}>
                promrkts
              </Text>
              <HStack spacing={2} opacity={0.75}>
                <Icon as={FiWifi} transform="rotate(90deg)" />
                <Text fontSize="10px" fontWeight="800" letterSpacing=".15em">
                  {tierMeta.label.toUpperCase()}
                </Text>
              </HStack>
            </Flex>

            <Box position="relative">
              {/* Chip */}
              <Box
                w="36px"
                h="28px"
                borderRadius="6px"
                bg="linear-gradient(135deg, #d4af37, #b8860b)"
                mb={3}
                boxShadow="0 2px 6px rgba(0,0,0,0.3)"
              />
              <Text
                fontSize="18px"
                fontWeight="700"
                letterSpacing="0.18em"
                fontFamily="'DM Mono', monospace"
              >
                {fmt4(selected?.last4 || "0000")}
              </Text>
            </Box>

            <Flex justify="space-between" align="flex-end" position="relative">
              <Box>
                <Text fontSize="9px" opacity={0.6} letterSpacing=".1em" mb={0.5}>
                  CARDHOLDER
                </Text>
                <Text fontSize="12px" fontWeight="800" letterSpacing=".08em">
                  {selected?.cardHolder || `${user?.firstName || ""} ${user?.lastName || ""}`.toUpperCase()}
                </Text>
              </Box>
              <Box textAlign="center" mx={3}>
                <Text fontSize="9px" opacity={0.6} letterSpacing=".1em" mb={0.5}>
                  EXPIRES
                </Text>
                <Text fontSize="12px" fontWeight="800" letterSpacing=".08em" fontFamily="'DM Mono', monospace">
                  {String(selected?.expiryMonth || 0).padStart(2, "0")}/{String(selected?.expiryYear || 0).slice(-2)}
                </Text>
              </Box>
              <Text fontSize="22px" fontWeight="900" fontStyle="italic" letterSpacing="-0.02em">
                VISA
              </Text>
            </Flex>

            {/* Frozen overlay */}
            {selected?.frozen && (
              <Flex
                position="absolute"
                inset="0"
                bg="rgba(15,23,42,0.6)"
                backdropFilter="blur(4px)"
                align="center"
                justify="center"
                direction="column"
                gap={2}
                zIndex={2}
              >
                <Icon as={FiPauseCircle} boxSize={10} color="white" />
                <Text fontSize="14px" fontWeight="900" letterSpacing=".15em">FROZEN</Text>
              </Flex>
            )}
          </Box>

          {/* Key stats row */}
          <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
            <MiniStat label="SPENT" value={`$${spent.toFixed(2)}`} tok={tok} />
            <MiniStat label="LIMIT" value={`$${limit.toFixed(0)}`} tok={tok} />
            <MiniStat label="CASHBACK" value={`$${cashback.toFixed(2)}`} tok={tok} accent={tierMeta.color} />
          </Box>

          {/* Actions */}
          <Button
            w="100%"
            h="48px"
            borderRadius="12px"
            fontWeight="900"
            fontSize="13px"
            bg={selected?.frozen
              ? `linear-gradient(135deg, ${tok.success}, #15803d)`
              : tok.panelInner}
            border={selected?.frozen ? "none" : "1px solid"}
            borderColor={tok.panelBorder}
            color={selected?.frozen ? "white" : tok.textMain}
            leftIcon={selected?.frozen ? <FiUnlock /> : <FiLock />}
            onClick={toggleFreeze}
            isLoading={busy}
            _hover={{
              transform: "translateY(-1px)",
              boxShadow: selected?.frozen ? `0 8px 24px ${tok.success}55` : undefined,
              borderColor: selected?.frozen ? undefined : tok.brand,
            }}
            transition="all 0.2s"
          >
            {selected?.frozen ? "Unfreeze card" : "Freeze card"}
          </Button>
        </VStack>

        {/* Recent spend + card details */}
        <VStack align="stretch" spacing={4}>
          <GlassCard p={5}>
            <Flex justify="space-between" align="center" mb={3}>
              <Box>
                <Text fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">
                  Monthly spend
                </Text>
                <Text fontSize="22px" fontWeight="900" color={tok.textMain} letterSpacing="-0.02em" fontFamily="'DM Mono', monospace">
                  ${spent.toFixed(2)}
                  <Text as="span" fontSize="12px" color={tok.textMuted} ml={2} fontWeight="700">
                    / ${limit.toFixed(0)}
                  </Text>
                </Text>
              </Box>
              <HStack spacing={1.5}>
                <Icon as={FiTrendingUp} color={tierMeta.color} boxSize={4} />
                <Text fontSize="11px" color={tierMeta.color} fontWeight="800">{spentPct.toFixed(1)}%</Text>
              </HStack>
            </Flex>
            <Box h="6px" w="100%" borderRadius="full" bg={tok.panelInner} overflow="hidden">
              <Box
                h="100%"
                w={`${spentPct}%`}
                bg={tierMeta.gradient}
                transition="width 0.4s"
              />
            </Box>
          </GlassCard>

          <GlassCard p={0}>
            <Box px={5} pt={4} pb={3}>
              <SectionHeader title="Recent spend" subtitle="Card transactions, newest first" />
            </Box>
            {txLoading ? (
              <Flex p={10} justify="center"><Spinner color={tok.brand} /></Flex>
            ) : txs.length === 0 ? (
              <Box pb={2}>
                <EmptyState
                  icon={FiShoppingBag}
                  title="No transactions yet"
                  hint="Spend with your card and purchases will appear here."
                />
              </Box>
            ) : (
              <VStack
                align="stretch"
                spacing={0}
                borderTop="1px solid"
                borderColor={tok.panelBorder}
                sx={{ "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder } }}
              >
                {txs.map((t: any) => {
                  const amount = Number(t.amount || 0);
                  return (
                    <Flex key={t.id} px={5} py={3} justify="space-between" align="center" _hover={{ bg: tok.hover }} transition="background 0.15s">
                      <HStack spacing={3}>
                        <Flex
                          w="38px"
                          h="38px"
                          borderRadius="10px"
                          bg={tok.panelInner}
                          border="1px solid"
                          borderColor={tok.panelBorder}
                          align="center"
                          justify="center"
                          color={tok.textSub}
                        >
                          <Icon as={FiShoppingBag} boxSize={4} />
                        </Flex>
                        <Box>
                          <Text fontSize="13px" fontWeight="800" color={tok.textMain}>
                            {t.merchant || t.category || "Card transaction"}
                          </Text>
                          <Text fontSize="10.5px" color={tok.textMuted}>
                            {[t.country, t.category].filter(Boolean).join(" · ")}{" "}
                            {t.createdAt && ` · ${new Date(t.createdAt).toLocaleDateString()}`}
                          </Text>
                        </Box>
                      </HStack>
                      <Text
                        fontSize="13.5px"
                        fontWeight="900"
                        color={amount < 0 || t.type === "PURCHASE" ? tok.textMain : tok.success}
                        fontFamily="'DM Mono', monospace"
                      >
                        {amount < 0 ? "" : "-"}${Math.abs(amount).toFixed(2)}
                      </Text>
                    </Flex>
                  );
                })}
              </VStack>
            )}
          </GlassCard>

          {/* Perks */}
          <Box
            p={4}
            borderRadius="14px"
            bg={`${tok.brand}0a`}
            border="1px solid"
            borderColor={`${tok.brand}2a`}
          >
            <HStack spacing={2.5} mb={2}>
              <Icon as={FiShield} color={tok.brand} boxSize={4} />
              <Text fontSize="13px" fontWeight="900" color={tok.textMain}>
                Card perks
              </Text>
            </HStack>
            <Box display="grid" gridTemplateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }} gap={3}>
              <Perk icon={FiTrendingUp} label={tierMeta.cashback} sub="auto paid in USDT" color={tierMeta.color} tok={tok} />
              <Perk icon={FiZap} label="Zero FX markup" sub="wholesale Visa rates" color={tok.brand} tok={tok} />
              <Perk icon={FiGlobe} label="200+ countries" sub="spend anywhere Visa works" color={tok.success} tok={tok} />
            </Box>
          </Box>
        </VStack>
      </Box>
    </PageShell>
  );
}

/* helpers */

function MiniStat({ label, value, tok, accent }: { label: string; value: string; tok: any; accent?: string }) {
  return (
    <Box
      p={3}
      borderRadius="12px"
      bg={tok.panelInner}
      border="1px solid"
      borderColor={tok.panelBorder}
    >
      <Text fontSize="9.5px" color={tok.textMuted} fontWeight="800" letterSpacing=".12em">
        {label}
      </Text>
      <Text fontSize="15px" fontWeight="900" color={accent || tok.textMain} mt={0.5} fontFamily="'DM Mono', monospace" letterSpacing="-0.02em">
        {value}
      </Text>
    </Box>
  );
}

function Perk({
  icon, label, sub, color, tok,
}: { icon: any; label: string; sub: string; color: string; tok: any }) {
  return (
    <HStack align="flex-start" spacing={2.5}>
      <Flex w="34px" h="34px" borderRadius="10px" bg={`${color}18`} color={color} align="center" justify="center">
        <Icon as={icon} boxSize={4} />
      </Flex>
      <Box>
        <Text fontSize="12.5px" fontWeight="800" color={tok.textMain} lineHeight="1.2">
          {label}
        </Text>
        <Text fontSize="10.5px" color={tok.textMuted} mt={0.5}>
          {sub}
        </Text>
      </Box>
    </HStack>
  );
}
