"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Input, Switch, useToast,
  FormControl, FormLabel, Textarea, Avatar, Wrap, WrapItem, useClipboard, Select,
} from "@chakra-ui/react";
import {
  FiUser, FiCopy, FiCheckCircle, FiGlobe, FiShield, FiExternalLink, FiSave,
  FiPlus, FiTrash2, FiLink, FiEye,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { profileAPI, userAPI } from "@/lib/api";
import {
  PageShell, PageHeader, GlassCard, SectionHeader,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

const ALL_CURRENCIES = ["USDT", "USD", "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "MATIC", "DOT", "AVAX"];
const NETWORKS = [
  { v: "TRC20", label: "TRC20 (USDT)" },
  { v: "ERC20", label: "ERC20 (ETH)" },
  { v: "BEP20", label: "BEP20 (BNB)" },
  { v: "Bitcoin", label: "Bitcoin" },
  { v: "Solana", label: "Solana" },
  { v: "Polygon", label: "Polygon" },
  { v: "Avalanche", label: "Avalanche" },
  { v: "XRP", label: "XRP" },
  { v: "ADA", label: "Cardano" },
];

export default function ProfilePage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const tok = useDashboardTokens();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profilePublic, setProfilePublic] = useState(false);
  const [acceptedCurrencies, setAcceptedCurrencies] = useState<string[]>(["USDT", "USD", "BTC", "ETH"]);

  const [linkedWallets, setLinkedWallets] = useState<any[]>([]);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [newWalletNetwork, setNewWalletNetwork] = useState("TRC20");
  const [newWalletLabel, setNewWalletLabel] = useState("");
  const [addingWallet, setAddingWallet] = useState(false);

  const profileUrl = useMemo(() => {
    if (!username) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${username}`;
  }, [username]);
  const { hasCopied, onCopy } = useClipboard(profileUrl);

  useEffect(() => {
    (async () => {
      try {
        const [profRes, walletsRes] = await Promise.all([
          profileAPI.getMyProfile(),
          userAPI.getLinkedWallets().catch(() => ({ data: { wallets: [] } })),
        ]);
        const p = profRes.data.profile;
        setProfile(p);
        setUsername(p.username || "");
        setBio(p.bio || "");
        setProfilePublic(p.profilePublic || false);
        setAcceptedCurrencies(p.acceptedCurrencies?.length > 0 ? p.acceptedCurrencies : ["USDT", "USD", "BTC", "ETH"]);
        setLinkedWallets(walletsRes.data.wallets || []);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!username || username.length < 3) {
      return toast({ title: "Username must be at least 3 characters", status: "error", duration: 3000 });
    }
    setSaving(true);
    try {
      const res = await profileAPI.updateProfile({ username, bio, profilePublic, acceptedCurrencies });
      setProfile(res.data.profile);
      toast({ title: "Profile saved", status: "success", duration: 3000 });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.response?.data?.error || "Try again", status: "error", duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  const handleAddWallet = async () => {
    if (!newWalletAddress.trim()) {
      return toast({ title: "Wallet address is required", status: "warning", duration: 3000 });
    }
    setAddingWallet(true);
    try {
      await userAPI.linkWallet({ address: newWalletAddress.trim(), network: newWalletNetwork, label: newWalletLabel || undefined });
      const res = await userAPI.getLinkedWallets();
      setLinkedWallets(res.data.wallets || []);
      setNewWalletAddress("");
      setNewWalletLabel("");
      toast({ title: "Wallet linked", status: "success", duration: 3000 });
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Failed to link wallet", status: "error", duration: 3000 });
    } finally {
      setAddingWallet(false);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    try {
      await userAPI.deleteLinkedWallet(id);
      setLinkedWallets((prev) => prev.filter((w) => w.id !== id));
      toast({ title: "Wallet removed", status: "info", duration: 2000 });
    } catch {
      toast({ title: "Failed to remove wallet", status: "error", duration: 3000 });
    }
  };

  const toggleCurrency = (c: string) => {
    setAcceptedCurrencies((prev) => {
      if (prev.includes(c)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== c);
      }
      return [...prev, c];
    });
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

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Account"
        title="My profile"
        subtitle="Your public payment page, accepted currencies and linked wallets."
        right={
          <HStack spacing={2}>
            {profilePublic && username && (
              <Button
                as="a"
                href={`/pay/${username}`}
                target="_blank"
                size="sm"
                h="36px"
                px={3}
                variant="ghost"
                color={tok.textSub}
                _hover={{ color: tok.textMain, bg: tok.hover }}
                rightIcon={<FiExternalLink />}
                fontWeight="700"
              >
                View public page
              </Button>
            )}
            <Button
              onClick={handleSave}
              isLoading={saving}
              size="sm"
              h="36px"
              px={4}
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              fontWeight="800"
              borderRadius="10px"
              leftIcon={<FiSave />}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
              transition="all 0.2s"
            >
              Save
            </Button>
          </HStack>
        }
      />

      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
        {/* ── Profile card ── */}
        <GlassCard p={5}>
          <Flex gap={4} align="center" mb={5}>
            {(user as any)?.avatarUrl ? (
              <Flex
                w="56px" h="56px" borderRadius="full"
                bg={tok.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
                border="1px solid" borderColor={tok.panelBorder}
                align="center" justify="center"
                fontSize="28px"
              >
                {(user as any).avatarUrl}
              </Flex>
            ) : (
              <Avatar
                size="lg"
                name={initials}
                bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
                color="white"
                fontSize="20px"
                fontWeight="900"
              />
            )}
            <Box>
              <Text fontSize="16px" fontWeight="900" color={tok.textMain}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text fontSize="12px" color={tok.textMuted}>{user?.email}</Text>
              {username && (
                <HStack spacing={1} mt={1}>
                  <Icon as={FiGlobe} color={tok.brand} boxSize={3} />
                  <Text fontSize="12px" color={tok.brand} fontWeight="800">@{username}</Text>
                </HStack>
              )}
            </Box>
          </Flex>

          <VStack spacing={3.5} align="stretch">
            <FormControl>
              <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                Username · public URL
              </FormLabel>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="e.g. john_doe"
                {...input}
              />
              {username && (
                <Text fontSize="11px" color={tok.textMuted} mt={1.5}>
                  Your public URL is <Text as="span" color={tok.brand} fontWeight="800" fontFamily="monospace">{profileUrl}</Text>
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={1.5}>
                Bio
              </FormLabel>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself…"
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

            <FormControl
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              p={3}
              borderRadius="10px"
              border="1px solid"
              borderColor={tok.panelBorder}
              bg={tok.panelInner}
            >
              <Box>
                <Text fontSize="13px" fontWeight="800" color={tok.textMain}>Public profile</Text>
                <Text fontSize="11px" color={tok.textMuted}>Anyone with your link can send you a payment</Text>
              </Box>
              <Switch isChecked={profilePublic} onChange={(e) => setProfilePublic(e.target.checked)} colorScheme="blue" size="md" />
            </FormControl>
          </VStack>
        </GlassCard>

        {/* ── Share & QR ── */}
        <GlassCard p={5}>
          <SectionHeader title="Share" subtitle="Your public page and QR code" />
          {profilePublic && username ? (
            <VStack spacing={4} align="stretch" mt={3}>
              <Flex
                align="center"
                gap={2}
                p={2.5}
                bg={tok.panelInner}
                borderRadius="10px"
                border="1px solid"
                borderColor={tok.panelBorder}
              >
                <Text flex={1} fontSize="12.5px" fontFamily="monospace" color={tok.textSub} noOfLines={1}>
                  {profileUrl}
                </Text>
                <Button
                  size="sm"
                  h="32px"
                  onClick={onCopy}
                  leftIcon={<Icon as={hasCopied ? FiCheckCircle : FiCopy} />}
                  bg={hasCopied ? "rgba(34,197,94,0.15)" : `${tok.brand}15`}
                  color={hasCopied ? tok.success : tok.brand}
                  fontWeight="800"
                  fontSize="12px"
                  borderRadius="8px"
                  _hover={{ bg: hasCopied ? "rgba(34,197,94,0.2)" : `${tok.brand}22` }}
                >
                  {hasCopied ? "Copied" : "Copy"}
                </Button>
              </Flex>

              <Flex justify="center">
                <Box p={3} bg="white" borderRadius="14px" boxShadow="lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(profileUrl)}&color=00-57-b8`}
                    alt="Profile QR code"
                    width={180}
                    height={180}
                    style={{ display: "block" }}
                  />
                </Box>
              </Flex>
              <Text fontSize="11px" color={tok.textMuted} textAlign="center">
                Scan to open your payment page
              </Text>
            </VStack>
          ) : (
            <EmptyState
              icon={FiEye}
              title="Your page is private"
              hint="Turn on public profile to generate a shareable link and QR code."
            />
          )}
        </GlassCard>
      </Box>

      {/* ── Accepted currencies ── */}
      <GlassCard p={5} mt={4}>
        <SectionHeader
          title="Accepted currencies"
          subtitle="Pick which assets people can send you via your public page"
        />
        <Wrap spacing={2} mt={3}>
          {ALL_CURRENCIES.map((c) => {
            const active = acceptedCurrencies.includes(c);
            return (
              <WrapItem key={c}>
                <Box
                  as="button"
                  onClick={() => toggleCurrency(c)}
                  px={3}
                  py={2}
                  borderRadius="10px"
                  bg={active ? `${tok.brand}18` : tok.panelInner}
                  border="1px solid"
                  borderColor={active ? `${tok.brand}66` : tok.panelBorder}
                  color={active ? tok.brand : tok.textSub}
                  fontSize="12px"
                  fontWeight="800"
                  transition="all 0.15s"
                  _hover={{ borderColor: active ? tok.brand : `${tok.brand}44`, transform: "translateY(-1px)" }}
                >
                  {active && <Icon as={FiCheckCircle} boxSize={3} mr={1.5} verticalAlign="middle" />}
                  {c}
                </Box>
              </WrapItem>
            );
          })}
        </Wrap>
      </GlassCard>

      {/* ── Linked wallets ── */}
      <GlassCard p={5} mt={4}>
        <SectionHeader
          title="Linked wallet addresses"
          subtitle="People can send you crypto directly to these chains"
        />

        {linkedWallets.length === 0 && (
          <Box mt={3}>
            <EmptyState icon={FiLink} title="No wallets linked" hint="Add at least one address so buyers can pay you on-chain." />
          </Box>
        )}

        {linkedWallets.length > 0 && (
          <VStack spacing={2} align="stretch" mt={3}>
            {linkedWallets.map((w: any) => (
              <Flex
                key={w.id}
                p={3}
                bg={tok.panelInner}
                borderRadius="12px"
                border="1px solid"
                borderColor={tok.panelBorder}
                align="center"
                justify="space-between"
              >
                <Box minW={0} flex={1}>
                  <HStack spacing={2}>
                    <Box px={2} py={0.5} borderRadius="5px" bg={`${tok.brand}18`} color={tok.brand} fontSize="10px" fontWeight="900" letterSpacing=".04em">
                      {w.network}
                    </Box>
                    <Text fontSize="12.5px" fontWeight="800" color={tok.textMain}>{w.label || "Wallet"}</Text>
                  </HStack>
                  <Text fontSize="11.5px" fontFamily="monospace" color={tok.textMuted} mt={1} noOfLines={1}>
                    {w.address}
                  </Text>
                </Box>
                <Button
                  size="xs"
                  variant="ghost"
                  color={tok.danger}
                  onClick={() => handleDeleteWallet(w.id)}
                  _hover={{ bg: "rgba(239,68,68,0.12)" }}
                  ml={2}
                >
                  <FiTrash2 />
                </Button>
              </Flex>
            ))}
          </VStack>
        )}

        {/* Add new */}
        <Box
          mt={4}
          p={4}
          borderRadius="12px"
          bg={tok.panelInner}
          border="1px dashed"
          borderColor={tok.panelBorder}
        >
          <Text fontSize="11px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800" mb={2.5}>
            Add wallet
          </Text>
          <VStack spacing={2.5} align="stretch">
            <Flex gap={2} direction={{ base: "column", sm: "row" }}>
              <Select
                value={newWalletNetwork}
                onChange={(e) => setNewWalletNetwork(e.target.value)}
                w={{ base: "100%", sm: "180px" }}
                {...input}
                iconColor={tok.textMuted}
              >
                {NETWORKS.map((n) => (
                  <option key={n.v} value={n.v} style={{ background: tok.dark ? "#0b1020" : "white", color: tok.textMain }}>
                    {n.label}
                  </option>
                ))}
              </Select>
              <Input placeholder="Label (optional)" value={newWalletLabel} onChange={(e) => setNewWalletLabel(e.target.value)} {...input} />
            </Flex>
            <Input
              placeholder="Wallet address"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              {...input}
              fontFamily="monospace"
            />
            <Button
              onClick={handleAddWallet}
              isLoading={addingWallet}
              size="sm"
              h="40px"
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              fontSize="12.5px"
              fontWeight="800"
              borderRadius="10px"
              leftIcon={<FiPlus />}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
              transition="all 0.2s"
            >
              Link wallet
            </Button>
          </VStack>
        </Box>
      </GlassCard>

      {/* ── Info ── */}
      <Box
        mt={4}
        p={4}
        borderRadius="14px"
        bg={`${tok.brand}0a`}
        border="1px solid"
        borderColor={`${tok.brand}2a`}
      >
        <HStack spacing={2.5} mb={2}>
          <Icon as={FiShield} color={tok.brand} boxSize={4} />
          <Text fontSize="13px" fontWeight="800" color={tok.textMain}>
            How payments work
          </Text>
        </HStack>
        <VStack align="start" spacing={1}>
          <Info tok={tok}>Payments sent to your public page are delivered instantly on-chain.</Info>
          <Info tok={tok}>P2P trades go through escrow for buyer and seller protection.</Info>
          <Info tok={tok}>Linked addresses appear on your public page for direct crypto payments.</Info>
          <Info tok={tok}>Your QR code encodes your public profile URL for easy sharing.</Info>
        </VStack>
      </Box>
    </PageShell>
  );
}

function Info({ children, tok }: { children: React.ReactNode; tok: any }) {
  return (
    <HStack spacing={2} align="flex-start">
      <Box w="4px" h="4px" borderRadius="full" bg={tok.brand} mt={2} flexShrink={0} />
      <Text fontSize="12px" color={tok.textSub} lineHeight="1.6">
        {children}
      </Text>
    </HStack>
  );
}
