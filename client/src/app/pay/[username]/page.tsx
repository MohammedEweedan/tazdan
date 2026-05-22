"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Avatar, SimpleGrid, Spinner,
  Input, Select, useToast,
} from "@chakra-ui/react";
import {
  FiUser, FiShield, FiCheckCircle, FiSend, FiGlobe, FiArrowLeft,
} from "react-icons/fi";
import NextLink from "next/link";
import { profileAPI, transferAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const brand = "#0057b8";

const CRYPTO_ICONS: Record<string, { emoji: string; color: string }> = {
  USDT: { emoji: "₮", color: "#26a17b" },
  USD: { emoji: "$", color: "#22c55e" },
  BTC: { emoji: "₿", color: "#f7931a" },
  ETH: { emoji: "Ξ", color: "#627eea" },
  BNB: { emoji: "B", color: "#f3ba2f" },
  SOL: { emoji: "S", color: "#9945ff" },
  XRP: { emoji: "X", color: "#23292f" },
  ADA: { emoji: "₳", color: "#0033ad" },
  DOGE: { emoji: "Ð", color: "#c2a633" },
  MATIC: { emoji: "M", color: "#8247e5" },
  DOT: { emoji: "●", color: "#e6007a" },
  AVAX: { emoji: "A", color: "#e84142" },
};

export default function PublicPayPage() {
  const params = useParams();
  const username = params.username as string;
  const toast = useToast();
  const { isAuthenticated, user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await profileAPI.getPublicProfile(username);
        setProfile(res.data.profile);
        if (res.data.profile.acceptedCurrencies?.length > 0) {
          setSelectedCurrency(res.data.profile.acceptedCurrencies[0]);
        }
      } catch (e: any) {
        if (e?.response?.status === 404) setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [username]);

  const handleSend = async () => {
    if (!isAuthenticated) {
      toast({ title: "Please log in to send payments", status: "warning", duration: 3000 });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Enter a valid amount", status: "error", duration: 3000 });
      return;
    }
    if (profile.id === user?.id) {
      toast({ title: "Cannot send to yourself", status: "error", duration: 3000 });
      return;
    }

    setSending(true);
    try {
      await transferAPI.send({
        recipientEmail: undefined,
        recipientPhone: undefined,
        amount: parseFloat(amount),
        note: `Payment via public profile @${username} (${selectedCurrency})`,
      });
      toast({ title: "Payment sent!", description: `${amount} USDT sent to @${username}`, status: "success", duration: 4000 });
      setAmount("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.response?.data?.error || "Try again", status: "error", duration: 4000 });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="#060a18" direction="column" gap={4}>
        <Spinner color={brand} size="lg" />
        <Text fontSize="12px" color="#475569">Loading profile...</Text>
      </Flex>
    );
  }

  if (notFound) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="#060a18" direction="column" gap={4}>
        <Text fontSize="48px">🔍</Text>
        <Text fontSize="18px" fontWeight="800" color="white">Profile Not Found</Text>
        <Text fontSize="13px" color="#64748b">This user doesn't exist or their profile is private</Text>
        <Button as={NextLink} href="/" size="sm" mt={4} bg={brand} color="white" borderRadius="8px" leftIcon={<FiArrowLeft size={14} />}
          _hover={{ bg: "#003d82" }}>
          Go Home
        </Button>
      </Flex>
    );
  }

  const initials = `${profile?.firstName?.[0] || ""}${profile?.lastName?.[0] || ""}`.toUpperCase();
  const joinDate = new Date(profile?.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <Box minH="100vh" bg="#060a18" color="white" fontFamily="'DM Sans', system-ui, sans-serif">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Top bar */}
      <Flex h="52px" px={5} align="center" justify="space-between" borderBottom="1px solid rgba(255,255,255,0.06)" bg="rgba(5,5,18,0.97)" backdropFilter="blur(16px)">
        <HStack spacing={2}>
          <Text fontSize="16px" fontWeight="900" letterSpacing="-.04em" color={brand}>FORTUNI</Text>
          <Box w="1px" h="16px" bg="rgba(255,255,255,0.06)" />
          <Text fontSize="11px" color="#475569" fontWeight="600">PAY</Text>
        </HStack>
        {!isAuthenticated && (
          <Button as={NextLink} href="/login" size="sm" bg={brand} color="white" borderRadius="8px" fontSize="12px" fontWeight="700"
            _hover={{ bg: "#003d82" }}>Sign In</Button>
        )}
      </Flex>

      {/* Profile */}
      <Box maxW="480px" mx="auto" px={4} py={8}>
        {/* Avatar & info */}
        <Flex direction="column" align="center" mb={8}>
          <Avatar size="xl" name={initials} bg={brand} color="white" fontSize="28px" fontWeight="800" mb={4} />
          <Text fontSize="22px" fontWeight="800" mb={0.5}>{profile?.firstName} {profile?.lastName}</Text>
          <HStack spacing={2} mb={2}>
            <Icon as={FiGlobe} color={brand} boxSize={3} />
            <Text fontSize="13px" color={brand} fontWeight="600">@{username}</Text>
          </HStack>
          {profile?.bio && (
            <Text fontSize="13px" color="#94a3b8" textAlign="center" maxW="360px" mb={3}>{profile.bio}</Text>
          )}
          <HStack spacing={4} mt={1}>
            {profile?.kycVerified && (
              <HStack spacing={1}>
                <Icon as={FiShield} color="#22c55e" boxSize={3} />
                <Text fontSize="11px" color="#22c55e" fontWeight="600">Verified</Text>
              </HStack>
            )}
            <Text fontSize="11px" color="#475569">Joined {joinDate}</Text>
            {profile?.completedTrades > 0 && (
              <Text fontSize="11px" color="#475569">{profile.completedTrades} trades ({profile.completionRate}%)</Text>
            )}
          </HStack>
        </Flex>

        {/* QR Code */}
        <Flex justify="center" mb={8}>
          <Box p={4} bg="white" borderRadius="16px" boxShadow="0 8px 32px rgba(0,0,0,0.3)">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&color=00-57-b8`}
              alt="Payment QR Code"
              width={220}
              height={220}
              style={{ display: "block" }}
            />
          </Box>
        </Flex>

        {/* Accepted Currencies */}
        <Box mb={6}>
          <Text fontSize="12px" fontWeight="700" color="#475569" letterSpacing=".08em" textTransform="uppercase" mb={3} textAlign="center">
            Accepted Currencies
          </Text>
          <Flex justify="center" flexWrap="wrap" gap={2}>
            {(profile?.acceptedCurrencies || []).map((c: string) => {
              const info = CRYPTO_ICONS[c] || { emoji: "?", color: "#64748b" };
              const active = selectedCurrency === c;
              return (
                <Box
                  key={c}
                  as="button"
                  onClick={() => setSelectedCurrency(c)}
                  px={3}
                  py={2}
                  borderRadius="10px"
                  bg={active ? `${info.color}20` : "rgba(255,255,255,0.03)"}
                  border="2px solid"
                  borderColor={active ? info.color : "rgba(255,255,255,0.06)"}
                  transition="all 0.15s"
                  _hover={{ borderColor: info.color }}
                  minW="70px"
                >
                  <Text fontSize="18px" textAlign="center" mb={0.5}>{info.emoji}</Text>
                  <Text fontSize="10px" fontWeight="700" color={active ? info.color : "#64748b"} textAlign="center">{c}</Text>
                </Box>
              );
            })}
          </Flex>
        </Box>

        {/* Send Form */}
        <Box bg="rgba(255,255,255,0.025)" border="1px solid rgba(255,255,255,0.06)" borderRadius="16px" p={5}>
          <Text fontSize="14px" fontWeight="800" color="white" mb={4} textAlign="center">
            Send {selectedCurrency || "Crypto"} to @{username}
          </Text>

          <VStack spacing={4}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              placeholder={`Amount in ${selectedCurrency || "USDT"}`}
              textAlign="center"
              fontSize="20px"
              fontWeight="700"
              fontFamily="'DM Mono'"
              h="56px"
              bg="rgba(255,255,255,0.03)"
              border="1px solid rgba(255,255,255,0.07)"
              color="white"
              borderRadius="12px"
              _hover={{ borderColor: "rgba(255,255,255,0.12)" }}
              _focus={{ borderColor: brand }}
            />

            <Button
              onClick={handleSend}
              isLoading={sending}
              isDisabled={!amount || parseFloat(amount) <= 0}
              w="100%"
              h="48px"
              bg={brand}
              color="white"
              fontSize="15px"
              fontWeight="700"
              borderRadius="12px"
              leftIcon={<FiSend size={16} />}
              _hover={{ bg: "#003d82", transform: "translateY(-1px)", boxShadow: "0 8px 24px rgba(0,87,184,0.3)" }}
              transition="all 0.2s"
            >
              {isAuthenticated ? `Send ${selectedCurrency || "USDT"}` : "Sign in to Send"}
            </Button>
          </VStack>

          <Box mt={4} p={3} bg="rgba(0,87,184,0.06)" border="1px solid rgba(0,87,184,0.15)" borderRadius="10px">
            <HStack spacing={2}>
              <Icon as={FiShield} color={brand} boxSize={4} flexShrink={0} />
              <Text fontSize="11px" color="#94a3b8">
                Payments are processed instantly on the fortuni platform. Currently, internal transfers are supported for USDT.
                External blockchain payments coming soon.
              </Text>
            </HStack>
          </Box>
        </Box>

        {/* Footer */}
        <Text fontSize="11px" color="#334155" textAlign="center" mt={8}>
          Powered by <Text as="span" color={brand} fontWeight="700">FORTUNI</Text> Exchange
        </Text>
      </Box>
    </Box>
  );
}
