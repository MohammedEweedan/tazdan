"use client";

import { useState, useEffect } from "react";
import {
  Box, Flex, Text, VStack, HStack, Button, Icon, Progress, Input, Badge,
  useToast,
} from "@chakra-ui/react";
import {
  FiUsers, FiDollarSign, FiCopy, FiGift, FiCheck, FiAward, FiInbox,
  FiArrowUpRight, FiShare2,
} from "react-icons/fi";
import { referralAPI } from "@/lib/api";
import {
  PageShell, PageHeader, GlassCard, SectionHeader, StatTile,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

export default function ReferralsPage() {
  const tok = useDashboardTokens();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    referralAPI.getDashboard()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyLink = () => {
    if (data?.referralLink) {
      navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      toast({ title: "Link copied", status: "success", duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const share = async () => {
    if (navigator.share && data?.referralLink) {
      try {
        await navigator.share({
          title: "Join me on promrkts",
          text: "Trade crypto with instant fiat on/off-ramps.",
          url: data.referralLink,
        });
      } catch {}
    } else {
      copyLink();
    }
  };

  const claim = async () => {
    setClaiming(true);
    try {
      await referralAPI.claimRewards();
      const r = await referralAPI.getDashboard();
      setData(r.data);
      toast({ title: "Rewards claimed", status: "success", duration: 3000 });
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Failed to claim", status: "error", duration: 4000 });
    }
    setClaiming(false);
  };

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  const d = data || {};
  const tier = d.currentTier || {};
  const tiers: any[] = d.tiers || [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Grow"
        title="Referrals"
        subtitle="Invite friends, earn a slice of every trade they make, forever."
        right={
          <Button
            onClick={share}
            size="sm"
            h="36px"
            px={4}
            leftIcon={<FiShare2 />}
            bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
            color="white"
            fontWeight="800"
            borderRadius="10px"
            _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
            transition="all 0.2s"
          >
            Share link
          </Button>
        }
      />

      {/* Invite hero */}
      <GlassCard p={{ base: 5, md: 6 }} mb={4}>
        <Flex direction={{ base: "column", md: "row" }} gap={5} align="center">
          <Box flex={1}>
            <Text fontSize="10.5px" fontWeight="800" color={tok.textMuted} letterSpacing=".14em" textTransform="uppercase" mb={1.5}>
              Your referral link
            </Text>
            <HStack spacing={2}>
              <Input
                value={d.referralLink || ""}
                readOnly
                bg={tok.panelInner}
                border="1px solid"
                borderColor={tok.panelBorder}
                color={tok.textMain}
                fontSize="12.5px"
                fontFamily="monospace"
                fontWeight="700"
                h="44px"
                _focus={{ borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` }}
              />
              <Button
                onClick={copyLink}
                h="44px"
                px={4}
                leftIcon={<Icon as={copied ? FiCheck : FiCopy} />}
                bg={copied ? "rgba(34,197,94,0.15)" : tok.panelInner}
                color={copied ? tok.success : tok.textMain}
                border="1px solid"
                borderColor={copied ? tok.success : tok.panelBorder}
                _hover={{ borderColor: tok.brand }}
                fontWeight="800"
                fontSize="13px"
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </HStack>
            <HStack spacing={2} mt={2}>
              <Text fontSize="11px" color={tok.textMuted}>Code</Text>
              <Badge bg={tok.panelInner} color={tok.brand} fontSize="11px" fontFamily="monospace" fontWeight="800" px={2.5} py={1} borderRadius="full" border="1px solid" borderColor={`${tok.brand}44`}>
                {d.referralCode || "—"}
              </Badge>
            </HStack>
          </Box>

          <Box
            w={{ base: "100%", md: "220px" }}
            p={4}
            bg={`linear-gradient(135deg, ${tok.brand}22, ${tok.brand}05)`}
            border="1px solid"
            borderColor={`${tok.brand}44`}
            borderRadius="14px"
            textAlign="center"
          >
            <Text fontSize="10px" fontWeight="800" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase">
              Current commission
            </Text>
            <Text fontSize="32px" fontWeight="900" color={tok.brand} letterSpacing="-0.02em" fontFamily="'DM Sans', sans-serif">
              {tier.rate ? `${(tier.rate * 100).toFixed(0)}%` : "—"}
            </Text>
            <Badge bg={`${tok.brand}22`} color={tok.brand} fontSize="10px" fontWeight="800" px={2} py={0.5} borderRadius="full">
              {tier.name || "Bronze"}
            </Badge>
          </Box>
        </Flex>
      </GlassCard>

      {/* KPI tiles */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,1fr)", md: "repeat(4,1fr)" }} gap={3} mb={4}>
        <StatTile label="Total referrals" value={String(d.totalReferrals || 0)} hint="All-time" icon={FiUsers} />
        <StatTile label="Earned" value={`$${(d.totalEarned || 0).toFixed(2)}`} hint="All-time" icon={FiDollarSign} accent={tok.success} />
        <StatTile label="Pending" value={`$${(d.pendingEarnings || 0).toFixed(2)}`} hint="Ready to claim" icon={FiGift} accent={tok.warning} />
        <StatTile label="Current tier" value={tier.name || "Bronze"} hint={tier.rate ? `${(tier.rate * 100).toFixed(0)}% commission` : ""} icon={FiAward} accent="#8b5cf6" />
      </Box>

      {/* Two columns */}
      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1.2fr 1fr" }} gap={4}>
        {/* Tiers */}
        <GlassCard p={5}>
          <SectionHeader title="Commission tiers" subtitle="Unlock higher rates as you refer more people" />
          <VStack spacing={3} align="stretch" mt={2}>
            {tiers.length === 0 && (
              <EmptyState title="Tiers will appear once the program is active." icon={FiAward} />
            )}
            {tiers.map((tr: any, i: number) => {
              const reached = (d.totalReferrals || 0) >= tr.minReferrals;
              const isActive = tr.active;
              const progress = tr.minReferrals > 0 ? Math.min(100, ((d.totalReferrals || 0) / tr.minReferrals) * 100) : 100;
              return (
                <Box
                  key={i}
                  p={3}
                  borderRadius="12px"
                  border="1px solid"
                  borderColor={isActive ? `${tok.brand}44` : tok.panelBorder}
                  bg={isActive ? `${tok.brand}08` : "transparent"}
                >
                  <Flex align="center" gap={3} mb={2}>
                    <Flex w="34px" h="34px" borderRadius="10px" bg={reached ? `${tok.brand}22` : tok.panelInner} color={reached ? tok.brand : tok.textMuted} align="center" justify="center">
                      <Icon as={FiAward} boxSize={4} />
                    </Flex>
                    <Box flex={1}>
                      <HStack spacing={2}>
                        <Text fontSize="13px" fontWeight="800" color={tok.textMain}>{tr.name}</Text>
                        {isActive && <Badge bg={`${tok.brand}1a`} color={tok.brand} fontSize="9px" fontWeight="900">CURRENT</Badge>}
                      </HStack>
                      <Text fontSize="10.5px" color={tok.textMuted}>{tr.minReferrals}+ referrals needed</Text>
                    </Box>
                    <Text fontSize="14px" fontWeight="900" color={reached ? tok.brand : tok.textMuted} fontFamily="monospace">
                      {(tr.rate * 100).toFixed(0)}%
                    </Text>
                  </Flex>
                  <Progress
                    value={progress}
                    size="xs"
                    borderRadius="full"
                    bg={tok.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                    sx={{ "& > div": { background: reached ? tok.brand : tok.textMuted } }}
                  />
                </Box>
              );
            })}
          </VStack>
        </GlassCard>

        {/* Rewards + recent */}
        <VStack align="stretch" spacing={4}>
          <GlassCard p={5}>
            <SectionHeader title="Pending rewards" subtitle="Claim to your USDT wallet" />
            <Text fontSize="34px" fontWeight="900" color={tok.success} letterSpacing="-0.025em" mt={2} fontFamily="'DM Sans', sans-serif">
              ${(d.pendingEarnings || 0).toFixed(2)}
              <Text as="span" fontSize="13px" color={tok.textMuted} fontWeight="700" ml={2}>USDT</Text>
            </Text>
            <Button
              mt={3}
              w="100%"
              h="44px"
              bg={`linear-gradient(135deg, ${tok.success}, #15803d)`}
              color="white"
              fontWeight="800"
              fontSize="13px"
              borderRadius="12px"
              leftIcon={<FiArrowUpRight />}
              isDisabled={!d.pendingEarnings || d.pendingEarnings <= 0}
              isLoading={claiming}
              onClick={claim}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.success}55` }}
              transition="all 0.2s"
            >
              Claim rewards
            </Button>
          </GlassCard>

          <GlassCard p={0}>
            <Box px={4} pt={4}>
              <SectionHeader title="Recent referrals" subtitle={`${d.totalReferrals || 0} joined`} />
            </Box>
            <VStack
              align="stretch"
              spacing={0}
              mt={2}
              borderTop="1px solid"
              borderColor={tok.panelBorder}
              maxH="260px"
              overflow="auto"
              sx={{
                "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder },
                "&::-webkit-scrollbar": { width: "6px" },
                "&::-webkit-scrollbar-thumb": { background: tok.panelBorder, borderRadius: "3px" },
              }}
            >
              {(d.referrals || []).length === 0 && (
                <Box p={4}><EmptyState icon={FiInbox} title="No referrals yet" hint="Share your link to earn a slice of every trade." /></Box>
              )}
              {(d.referrals || []).slice(0, 20).map((r: any, i: number) => (
                <Flex key={i} px={4} py={3} justify="space-between" align="center" _hover={{ bg: tok.hover }} transition="background 0.15s">
                  <HStack spacing={3}>
                    <Flex w="32px" h="32px" borderRadius="full" bg={`${tok.brand}22`} color={tok.brand} align="center" justify="center" fontWeight="900" fontSize="12px">
                      {(r.name || "?").charAt(0).toUpperCase()}
                    </Flex>
                    <Box>
                      <Text fontSize="12.5px" fontWeight="700" color={tok.textMain}>{r.name}</Text>
                      <Text fontSize="10.5px" color={tok.textMuted}>{new Date(r.joinedAt).toLocaleDateString()}</Text>
                    </Box>
                  </HStack>
                  <Badge
                    bg={r.kycVerified ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.12)"}
                    color={r.kycVerified ? tok.success : tok.textMuted}
                    fontSize="9.5px"
                    fontWeight="800"
                    px={2}
                    py={0.5}
                    borderRadius="full"
                    letterSpacing=".04em"
                  >
                    {r.kycVerified ? "VERIFIED" : "UNVERIFIED"}
                  </Badge>
                </Flex>
              ))}
            </VStack>
          </GlassCard>
        </VStack>
      </Box>
    </PageShell>
  );
}
