"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, Heading, Text, VStack, Button, Input,
  useColorMode, Icon, Spinner,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiArrowRight, FiAlertCircle, FiCheckCircle, FiSmartphone,
  FiGift, FiChevronLeft,
} from "react-icons/fi";
import { COUNTRIES } from "@/lib/countries";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import Logo from "@/components/ui/Logo";
import api from "@/lib/api";

// ─── Palette ─────────────────────────────────────────────────────
function usePalette(dark: boolean) {
  return {
    bg:      dark ? "#0f1117" : "#f5f5f7",
    bgElev:  dark ? "#1a1d27" : "#ffffff",
    fg:      dark ? "#f1f0ee" : "#0f172a",
    fgMuted: dark ? "#8b92a5" : "#64748b",
    fgFaint: dark ? "#3a3f52" : "#cbd5e1",
    border:  dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
    pillBg:  dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    ctaBg:   dark ? "#f1f0ee" : "#0f172a",
    ctaFg:   dark ? "#0f172a" : "#f1f0ee",
    greenFg: "#22c55e",
    redFg:   "#ef4444",
  };
}

type P = ReturnType<typeof usePalette>;

interface ClaimPreview {
  asset: string;
  amount: string;
  note: string | null;
  status: "PENDING" | "CLAIMED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  hasPin: boolean;
  sender: {
    firstName: string;
    handle: string | null;
    avatarUrl: string | null;
  };
}

// ─── Public claim API (no auth) ───────────────────────────────────
async function previewClaim(token: string): Promise<ClaimPreview> {
  const { data } = await api.get(`/claim-links/by-token/${token}`);
  return data.preview;
}

async function claimLink(token: string, pin?: string) {
  const { data } = await api.post(
    `/claim-links/by-token/${token}/claim`,
    pin ? { pin } : {}
  );
  return data.link;
}

// ─── Page ─────────────────────────────────────────────────────────
export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const p = usePalette(dark);
  const t = useTranslate();
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const setAuth = useAuthStore((s) => s.setTokens);

  const [phase, setPhase] = useState<
    "loading" | "preview" | "register" | "claiming" | "claimed" | "error"
  >("loading");
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");

  // Registration fields
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [username, setUsername]   = useState("");
  const [country, setCountry]     = useState("");
  const [phone, setPhone]         = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [dob, setDob]             = useState("");
  const [regErr, setRegErr]     = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Load preview
  useEffect(() => {
    if (!token) return;
    previewClaim(token)
      .then((data) => {
        setPreview(data);
        if (data.status === "PENDING") setPhase("preview");
        else setPhase("error");
        if (data.status !== "PENDING") {
          setError(
            data.status === "CLAIMED"
              ? "Already claimed"
              : data.status === "EXPIRED"
              ? "This claim has expired"
              : "This claim was cancelled"
          );
        }
      })
      .catch((e: any) => {
        const status = e?.response?.status;
        const msg = e?.response?.data?.error ?? '';
        if (status === 404) {
          setError('not_found');
        } else if (msg.toLowerCase().includes('expired')) {
          setError('expired');
        } else {
          setError('network');
        }
        setPhase("error");
      });
  }, [token]);

  // Claim handler (authenticated)
  const doClaim = async () => {
    setPhase("claiming");
    try {
      await claimLink(token, preview?.hasPin ? pin : undefined);
      setPhase("claimed");
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? "Could not claim";
      setError(msg);
      setPhase("preview");
    }
  };

  // Register + auto-claim
  const doRegisterAndClaim = async () => {
    setRegErr("");
    setRegLoading(true);
    try {
      // 1. Register
      await authAPI.register({
        email,
        password,
        firstName,
        lastName,
        username,
        country,
        phoneCountryCode: phoneCode,
        phone,
        dateOfBirth: dob,
      });

      // 2. Login
      const loginRes = await authAPI.login({ email, password });
      const { accessToken, refreshToken } = loginRes.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      setAuth(accessToken, refreshToken);

      // 3. Claim
      await claimLink(token, preview?.hasPin ? pin : undefined);
      setPhase("claimed");
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ??
        e?.response?.data?.message ??
        "Registration failed. Please try again.";
      setRegErr(msg);
      setRegLoading(false);
    }
  };

  const isPending = phase === "loading" || phase === "claiming";

  return (
    <Flex
      minH="100vh"
      bg={p.bg}
      direction="column"
      align="center"
      justify="center"
      px={4}
      py={12}
    >
      <VStack spacing={8} w="100%" maxW="420px" align="stretch">
        {/* Header */}
        <Flex align="center" justify="center" position="relative">
          <NextLink href="/">
            <Logo />
          </NextLink>
        </Flex>

        {/* Loading */}
        {phase === "loading" && (
          <Flex direction="column" align="center" gap={4} py={20}>
            <Spinner size="lg" color={p.fgMuted} />
            <Text color={p.fgMuted} fontSize="sm">
              Opening your claim…
            </Text>
          </Flex>
        )}

        {/* Error */}
        {phase === "error" && (
          <VStack
            bg={p.bgElev}
            border="1px solid"
            borderColor={p.border}
            borderRadius="20px"
            p={8}
            spacing={4}
            align="center"
          >
            <Icon as={FiAlertCircle} boxSize={12} color={p.redFg} />
            <Heading fontSize="xl" color={p.fg} textAlign="center">
              {error === 'expired'
                ? "This claim has expired"
                : error === 'claimed'
                ? "Already claimed"
                : error === 'cancelled'
                ? "Claim cancelled"
                : error === 'not_found'
                ? "Claim link not found"
                : "Could not load claim"}
            </Heading>
            <Text color={p.fgMuted} fontSize="sm" textAlign="center">
              {error === 'expired'
                ? "The funds have been returned to the sender. Ask them to send a fresh link."
                : error === 'claimed'
                ? "These funds have already landed in a Fortuni wallet."
                : error === 'cancelled'
                ? "The sender pulled this claim back before you could open it."
                : error === 'not_found'
                ? "The link may be malformed or does not exist on this server."
                : "We could not reach the server. Please check your connection and try again."}
            </Text>
            <Button
              as={NextLink}
              href="/"
              variant="outline"
              borderRadius="14px"
              w="100%"
              mt={2}
            >
              Go home
            </Button>
          </VStack>
        )}

        {/* Preview card */}
        {(phase === "preview" || phase === "claiming" || phase === "register") && preview && (
          <VStack
            bg={p.bgElev}
            border="1px solid"
            borderColor={p.border}
            borderRadius="24px"
            p={8}
            spacing={6}
            align="stretch"
            position="relative"
            overflow="hidden"
          >
            {/* Gift icon */}
            <Flex justify="center">
              <Flex
                w={20}
                h={20}
                borderRadius="full"
                bg="rgba(34,197,94,0.12)"
                align="center"
                justify="center"
              >
                <Icon as={FiGift} boxSize={10} color={p.greenFg} />
              </Flex>
            </Flex>

            <VStack spacing={1}>
              <Text color={p.fgMuted} fontSize="xs" fontWeight="700" letterSpacing="1.5px" textTransform="uppercase">
                You received
              </Text>
              <Heading fontSize="3xl" color={p.fg} letterSpacing="-1px">
                {preview.amount} {preview.asset}
              </Heading>
              <Text color={p.fgMuted} fontSize="sm">
                from{" "}
                <Text as="span" color={p.fg} fontWeight="600">
                  {preview.sender.handle
                    ? `@${preview.sender.handle}`
                    : preview.sender.firstName || "someone"}
                </Text>
              </Text>
            </VStack>

            {preview.note && (
              <Box
                bg={p.pillBg}
                borderRadius="12px"
                p={4}
                border="1px solid"
                borderColor={p.border}
              >
                <Text color={p.fgMuted} fontSize="xs" fontWeight="700" letterSpacing="1px" textTransform="uppercase" mb={1}>
                  Note
                </Text>
                <Text color={p.fg} fontSize="sm" fontStyle="italic">
                  “{preview.note}”
                </Text>
              </Box>
            )}

            {/* PIN input */}
            {preview.hasPin && (
              <Box>
                <Text color={p.fgMuted} fontSize="xs" fontWeight="600" mb={2}>
                  Enter the PIN the sender gave you
                </Text>
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="• • • •"
                  textAlign="center"
                  letterSpacing="8px"
                  fontSize="xl"
                  fontWeight="700"
                  bg={p.bg}
                  border="1.5px solid"
                  borderColor={p.border}
                  borderRadius="16px"
                  h="56px"
                  _focus={{ borderColor: p.fg, outline: "none" }}
                />
              </Box>
            )}

            {/* Authenticated user → Claim button */}
            {isAuth && (
              <Button
                onClick={doClaim}
                isLoading={phase === "claiming"}
                loadingText="Claiming…"
                h="56px"
                borderRadius="16px"
                bg={p.ctaBg}
                color={p.ctaFg}
                fontSize="16px"
                fontWeight="700"
                _hover={{ opacity: 0.9 }}
                rightIcon={<FiArrowRight />}
              >
                Claim {preview.amount} {preview.asset}
              </Button>
            )}

            {/* Not authenticated → Registration form */}
            {!isAuth && phase !== "register" && (
              <VStack spacing={3}>
                <Button
                  onClick={() => setPhase("register")}
                  h="56px"
                  borderRadius="16px"
                  bg={p.ctaBg}
                  color={p.ctaFg}
                  fontSize="16px"
                  fontWeight="700"
                  _hover={{ opacity: 0.9 }}
                  rightIcon={<FiArrowRight />}
                  w="100%"
                >
                  Sign up to claim
                </Button>
                <Button
                  as={NextLink}
                  href={`/login?next=/claim/${token}`}
                  variant="ghost"
                  w="100%"
                  color={p.fgMuted}
                  fontSize="sm"
                >
                  Already have an account? Log in
                </Button>
              </VStack>
            )}

            {/* Registration form */}
            {!isAuth && phase === "register" && (
              <VStack spacing={4} align="stretch">
                <Input
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  bg={p.bg}
                  border="1.5px solid"
                  borderColor={p.border}
                  borderRadius="16px"
                  h="56px"
                  px={4}
                  _focus={{ borderColor: p.fg, outline: "none" }}
                />
                <Input
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  bg={p.bg}
                  border="1.5px solid"
                  borderColor={p.border}
                  borderRadius="16px"
                  h="56px"
                  px={4}
                  _focus={{ borderColor: p.fg, outline: "none" }}
                />
                <Input
                  placeholder="@username (handle)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9._]/g, ""))}
                  bg={p.bg}
                  border="1.5px solid"
                  borderColor={p.border}
                  borderRadius="16px"
                  h="56px"
                  px={4}
                  _focus={{ borderColor: p.fg, outline: "none" }}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  bg={p.bg}
                  border="1.5px solid"
                  borderColor={p.border}
                  borderRadius="16px"
                  h="56px"
                  px={4}
                  _focus={{ borderColor: p.fg, outline: "none" }}
                />
                <Input
                  placeholder="Password (min 8 chars)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  bg={p.bg}
                  border="1.5px solid"
                  borderColor={p.border}
                  borderRadius="16px"
                  h="56px"
                  px={4}
                  _focus={{ borderColor: p.fg, outline: "none" }}
                />
                <Flex gap={2}>
                  <select
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    style={{
                      background: p.bg,
                      border: `1.5px solid ${p.border}`,
                      borderRadius: "16px",
                      height: "56px",
                      padding: "0 12px",
                      color: phoneCode ? p.fg : p.fgMuted,
                      fontSize: "14px",
                      minWidth: "90px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">+</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.dialCode}>
                        +{c.dialCode} {c.flag}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    bg={p.bg}
                    border="1.5px solid"
                    borderColor={p.border}
                    borderRadius="16px"
                    h="56px"
                    px={4}
                    flex={1}
                    _focus={{ borderColor: p.fg, outline: "none" }}
                  />
                </Flex>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  style={{
                    background: p.bg,
                    border: `1.5px solid ${p.border}`,
                    borderRadius: "16px",
                    height: "56px",
                    padding: "0 16px",
                    color: country ? p.fg : p.fgMuted,
                    fontSize: "15px",
                    width: "100%",
                    cursor: "pointer",
                  }}
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Date of birth (YYYY-MM-DD)"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  bg={p.bg}
                  border="1.5px solid"
                  borderColor={p.border}
                  borderRadius="16px"
                  h="56px"
                  px={4}
                  _focus={{ borderColor: p.fg, outline: "none" }}
                />

                {regErr && (
                  <Flex align="center" gap={2} color={p.redFg} fontSize="sm">
                    <Icon as={FiAlertCircle} />
                    <Text>{regErr}</Text>
                  </Flex>
                )}

                <Button
                  onClick={doRegisterAndClaim}
                  isLoading={regLoading}
                  loadingText="Creating account…"
                  h="56px"
                  borderRadius="16px"
                  bg={p.ctaBg}
                  color={p.ctaFg}
                  fontSize="16px"
                  fontWeight="700"
                  _hover={{ opacity: 0.9 }}
                  rightIcon={<FiArrowRight />}
                  mt={2}
                >
                  Create account & claim
                </Button>

                <Button
                  onClick={() => setPhase("preview")}
                  variant="ghost"
                  color={p.fgMuted}
                  fontSize="sm"
                  leftIcon={<FiChevronLeft />}
                >
                  Back
                </Button>
              </VStack>
            )}

            <Text color={p.fgFaint} fontSize="11px" textAlign="center">
              Funds settle instantly. Claim links cannot be claimed twice.
            </Text>
          </VStack>
        )}

        {/* Claimed success */}
        {phase === "claimed" && preview && (
          <VStack
            bg={p.bgElev}
            border="1px solid"
            borderColor={p.border}
            borderRadius="24px"
            p={8}
            spacing={6}
            align="stretch"
          >
            <Flex justify="center">
              <Flex
                w={20}
                h={20}
                borderRadius="full"
                bg="rgba(34,197,94,0.12)"
                align="center"
                justify="center"
              >
                <Icon as={FiCheckCircle} boxSize={10} color={p.greenFg} />
              </Flex>
            </Flex>

            <VStack spacing={1}>
              <Heading fontSize="2xl" color={p.fg} textAlign="center">
                Claimed!
              </Heading>
              <Text color={p.fgMuted} fontSize="sm" textAlign="center">
                {preview.amount} {preview.asset} is now in your Fortuni wallet.
              </Text>
            </VStack>

            <Box
              bg={p.pillBg}
              borderRadius="16px"
              p={6}
              border="1px solid"
              borderColor={p.border}
            >
              <VStack spacing={4} align="stretch">
                <Flex align="center" gap={3}>
                  <Icon as={FiSmartphone} boxSize={6} color={p.fg} />
                  <VStack align="start" spacing={0}>
                    <Text color={p.fg} fontSize="sm" fontWeight="700">
                      Get the app
                    </Text>
                    <Text color={p.fgMuted} fontSize="xs">
                      Manage your wallet on the go
                    </Text>
                  </VStack>
                </Flex>

                <Flex gap={3} justify="center">
                  <Button
                    as="a"
                    href="https://apps.apple.com/app/fortuni"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    borderRadius="12px"
                    flex={1}
                    h="48px"
                    fontSize="12px"
                    fontWeight="600"
                  >
                    <VStack spacing={0} align="start">
                      <Text fontSize="9px" lineHeight="1">Download on the</Text>
                      <Text fontSize="14px" lineHeight="1" fontWeight="700">App Store</Text>
                    </VStack>
                  </Button>
                  <Button
                    as="a"
                    href="https://play.google.com/store/apps/details?id=com.fortuni.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    borderRadius="12px"
                    flex={1}
                    h="48px"
                    fontSize="12px"
                    fontWeight="600"
                  >
                    <VStack spacing={0} align="start">
                      <Text fontSize="9px" lineHeight="1">Get it on</Text>
                      <Text fontSize="14px" lineHeight="1" fontWeight="700">Google Play</Text>
                    </VStack>
                  </Button>
                </Flex>
              </VStack>
            </Box>

            <Button
              as={NextLink}
              href="/dashboard/wallet"
              h="56px"
              borderRadius="16px"
              bg={p.ctaBg}
              color={p.ctaFg}
              fontSize="16px"
              fontWeight="700"
              _hover={{ opacity: 0.9 }}
              rightIcon={<FiArrowRight />}
            >
              Open my wallet
            </Button>
          </VStack>
        )}
      </VStack>
    </Flex>
  );
}
