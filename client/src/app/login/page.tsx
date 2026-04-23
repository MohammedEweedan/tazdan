"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, Heading, Text, VStack, HStack,
  Button, Input, Icon, useColorMode,
  PinInput, PinInputField, Center, InputGroup, InputRightElement, IconButton,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiShield, FiArrowRight, FiAlertCircle, FiEye, FiEyeOff,
  FiMail, FiLock, FiCheck, FiChevronRight,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import Logo from "@/components/ui/Logo";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

// ─── View States ──────────────────────────────────────────────────
type ViewState = "login" | "2fa" | "welcome";

// ─── Social / Exchange logos as inline SVG paths ──────────────────
const SocialIcon = ({ d, vb = "0 0 24 24", fill }: { d: string; vb?: string; fill: string }) => (
  <svg width="18" height="18" viewBox={vb} fill="none"><path d={d} fill={fill} /></svg>
);
const GooglePath = "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09a6.76 6.76 0 010-4.18V7.07H2.18a11 11 0 000 9.86l3.66-2.84z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z";
const ApplePath = "M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.65-2.2.46-3.06-.4C3.79 16.17 4.36 9.43 8.7 9.18c1.23.07 2.08.72 2.8.76.97-.2 1.9-.76 2.94-.69 1.36.1 2.38.66 3.07 1.68-2.79 1.67-2.13 5.35.54 6.38-.64 1.68-1.47 3.34-3 4.97zM12.03 9.12c-.13-2.42 1.83-4.44 4.08-4.62.33 2.77-2.53 4.84-4.08 4.62z";
const GithubPath = "M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [view, setView] = useState<ViewState>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [welcomeName, setWelcomeName] = useState("");
  const [welcomeRole, setWelcomeRole] = useState("");
  const pinRef = useRef<HTMLInputElement>(null);

  const dark = colorMode === "dark";
  const brand = "#0057b8";
  const pageBg = dark ? "#000000" : "#fafbfe";
  const cardBg = dark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.95)";
  const cardBorder = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const textMain = dark ? "white" : "#0f172a";
  const textSub = dark ? "#94a3b8" : "#64748b";
  const inputBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.015)";
  const inputBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const socialBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const socialBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const dividerColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  // Auto-submit 2FA when 6 digits entered
  useEffect(() => {
    if (view === "2fa" && twoFactorCode.length === 6) {
      handle2FASubmit();
    }
  }, [twoFactorCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res?.requires2FA) {
        setView("2fa");
        setLoading(false);
        return;
      }
      showWelcome(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  const handle2FASubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password, twoFactorCode);
      showWelcome(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid 2FA code");
      setTwoFactorCode("");
      setLoading(false);
    }
  };

  const showWelcome = (res: any) => {
    const u = res?.user;
    setWelcomeName(u?.firstName || "there");
    setWelcomeRole(u?.role || "USER");
    setView("welcome");
    setTimeout(() => {
      const dest = u?.role === "ADMIN" ? "/admin" : "/dashboard";
      router.push(dest);
    }, 2200);
  };

  const socialSignIn = (provider: string) => {
    // Placeholder — in production, redirect to OAuth
    setError(`${provider} sign-in coming soon. Use email/password for now.`);
  };

  // ─── Welcome Transition Screen ────────────────────────────────
  if (view === "welcome") {
    return (
      <Box minH="100vh" bg={pageBg} display="flex" alignItems="center" justifyContent="center" position="relative" overflow="hidden">
        <style>{`
          @keyframes welcomePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.05)}}
          @keyframes welcomeFade{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
          @keyframes welcomeCheck{0%{stroke-dashoffset:50}100%{stroke-dashoffset:0}}
          @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        `}</style>
        <Box position="absolute" inset={0} pointerEvents="none">
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%,-50%)" w="600px" h="600px"
            borderRadius="full" bg={`radial-gradient(circle,${brand}15,transparent 65%)`}
            style={{ filter: "blur(100px)", animation: "welcomePulse 3s ease infinite" }} />
        </Box>
        <VStack spacing={6} position="relative" zIndex={1} style={{ animation: "welcomeFade 0.6s ease forwards" }}>
          <Flex w="80px" h="80px" borderRadius="full" bg={`${brand}15`} border={`3px solid ${brand}44`}
            align="center" justify="center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 50, animation: "welcomeCheck 0.6s 0.3s ease forwards", strokeDashoffset: 50 }} />
            </svg>
          </Flex>
          <VStack spacing={1}>
            <Heading fontSize="28px" fontWeight="900" color={textMain} letterSpacing="-.03em">
              Welcome back, {welcomeName}!
            </Heading>
            <Text fontSize="14px" color={textSub}>
              {welcomeRole === "ADMIN" ? "Loading admin dashboard..." : "Loading your dashboard..."}
            </Text>
          </VStack>
          <Box w="200px" h="3px" borderRadius="full" overflow="hidden" bg={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}>
            <Box w="100%" h="100%" bg={`linear-gradient(90deg, transparent, ${brand}, transparent)`}
              backgroundSize="200% 100%" style={{ animation: "shimmer 1.2s infinite linear" }} />
          </Box>
        </VStack>
      </Box>
    );
  }

  // ─── 2FA Code Entry (Full-screen) ────────────────────────────
  if (view === "2fa") {
    return (
      <Box minH="100vh" bg={pageBg} display="flex" alignItems="center" justifyContent="center" position="relative" overflow="hidden">
        <style>{`
          @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
          @keyframes pulse2fa{0%,100%{box-shadow:0 0 0 0 rgba(0,87,184,0.2)}50%{box-shadow:0 0 0 20px rgba(0,87,184,0)}}
        `}</style>
        <Box position="absolute" inset={0} pointerEvents="none">
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%,-50%)" w="500px" h="500px"
            borderRadius="full" bg={`radial-gradient(circle,${brand}10,transparent 65%)`} style={{ filter: "blur(80px)" }} />
        </Box>

        <VStack spacing={0} position="relative" zIndex={1} w="100%" maxW="420px" mx="auto" px={4}>
          <VStack spacing={4} mb={8} style={{ animation: "fadeUp 0.5s ease forwards" }}>
            <Flex w="64px" h="64px" borderRadius="20px" bg={`${brand}12`} border={`2px solid ${brand}33`}
              align="center" justify="center" style={{ animation: "pulse2fa 2s ease infinite" }}>
              <Icon as={FiShield} color={brand} boxSize={7} />
            </Flex>
            <VStack spacing={1}>
              <Heading fontSize="24px" fontWeight="900" color={textMain} letterSpacing="-.03em">
                Two-Factor Authentication
              </Heading>
              <Text fontSize="13px" color={textSub} textAlign="center">
                Enter the 6-digit code from your authenticator app
              </Text>
            </VStack>
          </VStack>

          <Box w="100%" bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="20px"
            p={{ base: 6, md: 8 }} backdropFilter="blur(12px)" style={{ animation: "fadeUp 0.6s 0.1s ease both" }}>
            {error && (
              <Flex gap={2} p={3} mb={5} bg={dark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)"}
                border="1px solid" borderColor={dark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)"}
                borderRadius="10px" align="center">
                <Icon as={FiAlertCircle} color="#ef4444" boxSize={4} flexShrink={0} />
                <Text fontSize="12px" color="#ef4444">{error}</Text>
              </Flex>
            )}

            <Center mb={6}>
              <HStack spacing={3}>
                <PinInput otp size="lg" value={twoFactorCode} onChange={setTwoFactorCode} autoFocus>
                  {[0,1,2,3,4,5].map((i) => (
                    <PinInputField key={i} w="52px" h="60px" fontSize="22px" fontWeight="800"
                      bg={inputBg} border="2px solid" borderColor={twoFactorCode.length > i ? brand : inputBorder}
                      borderRadius="14px" color={textMain} textAlign="center"
                      _focus={{ borderColor: brand, boxShadow: `0 0 0 1px ${brand}` }}
                      transition="all 0.15s" />
                  ))}
                </PinInput>
              </HStack>
            </Center>

            <Button w="100%" h="48px" fontSize="14px" fontWeight="800" isLoading={loading}
              bg={`linear-gradient(135deg,${brand},#003d82)`} color="white" borderRadius="12px"
              onClick={handle2FASubmit} isDisabled={twoFactorCode.length !== 6}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 6px 24px ${brand}55` }}
              transition="all 0.2s">
              Verify & Sign In
            </Button>

            <Button w="100%" variant="ghost" mt={3} fontSize="13px" color={textSub} fontWeight="600"
              onClick={() => { setView("login"); setTwoFactorCode(""); setError(""); }}
              _hover={{ color: textMain }}>
              Back to login
            </Button>
          </Box>
        </VStack>
      </Box>
    );
  }

  // ─── Main Login View ─────────────────────────────────────────
  return (
    <Box minH="100vh" bg={pageBg} display="flex" alignItems="center" justifyContent="center" position="relative" overflow="hidden">
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes gridPulse{0%,100%{opacity:.03}50%{opacity:.06}}
        @keyframes socialHover{0%{transform:scale(1)}100%{transform:scale(1.04)}}
      `}</style>

      {/* Animated background */}
      <Box position="absolute" inset={0} pointerEvents="none" zIndex={0}>
        {/* Grid pattern */}
        <Box position="absolute" inset={0} opacity={dark ? 0.04 : 0.03}
          backgroundImage={`linear-gradient(${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 1px, transparent 1px),linear-gradient(90deg,${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 1px,transparent 1px)`}
          backgroundSize="60px 60px" style={{ animation: "gridPulse 8s ease infinite" }} />

        {/* Gradient orbs */}
        <Box position="absolute" top="-15%" left="50%" transform="translateX(-50%)" w="800px" h="800px" borderRadius="full"
          bg={`radial-gradient(circle,${brand}12,transparent 60%)`} style={{ filter: "blur(100px)" }} />
        <Box position="absolute" bottom="-25%" left="10%" w="400px" h="400px" borderRadius="full"
          bg={`radial-gradient(circle,rgba(139,92,246,0.06),transparent 60%)`}
          style={{ filter: "blur(80px)", animation: "float 8s ease-in-out infinite" }} />
        <Box position="absolute" top="30%" right="-10%" w="300px" h="300px" borderRadius="full"
          bg={`radial-gradient(circle,rgba(34,197,94,0.05),transparent 60%)`}
          style={{ filter: "blur(60px)", animation: "float 6s 1s ease-in-out infinite" }} />

        {/* Floating particles */}
        {[...Array(5)].map((_, i) => (
          <Box key={i} position="absolute" w="4px" h="4px" borderRadius="full" bg={`${brand}25`}
            top={`${20 + i * 15}%`} left={`${10 + i * 20}%`}
            style={{ animation: `float ${4 + i}s ${i * 0.5}s ease-in-out infinite` }} />
        ))}
      </Box>

      <Box w="100%" maxW="440px" mx="auto" px={4} position="relative" zIndex={1}>
        {/* Top bar: logo + controls */}
        <Flex justify="space-between" align="center" mb={10} style={{ animation: "fadeUp 0.4s ease forwards" }}>
          <Logo h={36} />
          <HStack spacing={2}>
            <LanguageSwitcher />
            <ColorModeToggle />
          </HStack>
        </Flex>

        {/* Main Card */}
        <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="24px"
          backdropFilter="blur(16px)" overflow="hidden"
          boxShadow={dark ? "0 8px 40px rgba(0,0,0,0.4)" : "0 8px 40px rgba(0,0,0,0.06)"}
          style={{ animation: "fadeUp 0.5s 0.1s ease both" }}>

          {/* Header inside card */}
          <Box px={{ base: 6, md: 8 }} pt={{ base: 6, md: 8 }} pb={0}>
            <Box textAlign="center" mb={6}>
              <Box display="inline-flex" alignItems="center" gap={2} px={3} py={1.5}
                borderRadius="full" mb={4} border="1px solid" borderColor={`${brand}33`} bg={`${brand}08`}>
                <Icon as={FiShield} color={brand} boxSize={3} />
                <Text fontSize="10px" fontWeight="800" color={brand} letterSpacing=".06em" textTransform="uppercase">
                  Secure Login
                </Text>
              </Box>
              <Heading fontSize="28px" fontWeight="900" color={textMain} letterSpacing="-.04em" mb={1.5}>
                {t("auth_welcome_back")}
              </Heading>
              <Text fontSize="13px" color={textSub}>{t("auth_login_subtitle")}</Text>
            </Box>
          </Box>

          <Box px={{ base: 6, md: 8 }} pb={{ base: 6, md: 8 }}>
            {/* Social Sign-In Buttons */}
            <VStack spacing={2.5} mb={5}>
              <HStack spacing={2.5} w="100%">
                {[
                  { name: "Google", path: GooglePath, fill: "#4285F4" },
                  { name: "Apple", path: ApplePath, fill: dark ? "#fff" : "#000" },
                  { name: "GitHub", path: GithubPath, fill: dark ? "#fff" : "#24292e" },
                ].map((p) => (
                  <Button key={p.name} flex={1} h="44px" variant="ghost" bg={socialBg}
                    border="1px solid" borderColor={socialBorder} borderRadius="12px"
                    onClick={() => socialSignIn(p.name)} fontWeight="700" fontSize="12px"
                    _hover={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                      bg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", transform: "translateY(-1px)" }}
                    transition="all 0.15s" leftIcon={<SocialIcon d={p.path} fill={p.fill} />}>
                    {p.name}
                  </Button>
                ))}
              </HStack>

              {/* Exchange sign-in */}
              <HStack spacing={2.5} w="100%">
                {[
                  { name: "Binance", color: "#F0B90B" },
                  { name: "Coinbase", color: "#0052FF" },
                  { name: "Kraken", color: "#5741D9" },
                ].map((ex) => (
                  <Button key={ex.name} flex={1} h="38px" variant="ghost" bg={socialBg}
                    border="1px solid" borderColor={socialBorder} borderRadius="10px"
                    onClick={() => socialSignIn(ex.name)} fontWeight="700" fontSize="11px" color={textSub}
                    _hover={{ borderColor: ex.color + "55", color: ex.color,
                      bg: ex.color + "08", transform: "translateY(-1px)" }}
                    transition="all 0.15s">
                    {ex.name}
                  </Button>
                ))}
              </HStack>
            </VStack>

            {/* Divider */}
            <Flex align="center" my={5}>
              <Box flex={1} h="1px" bg={dividerColor} />
              <Text fontSize="11px" fontWeight="700" color={textSub} px={4} textTransform="uppercase" letterSpacing=".08em">
                or continue with email
              </Text>
              <Box flex={1} h="1px" bg={dividerColor} />
            </Flex>

            {/* Error */}
            {error && (
              <Flex gap={2} p={3} mb={4} bg={dark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)"}
                border="1px solid" borderColor={dark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)"}
                borderRadius="10px" align="center">
                <Icon as={FiAlertCircle} color="#ef4444" boxSize={4} flexShrink={0} />
                <Text fontSize="12px" color="#ef4444">{error}</Text>
              </Flex>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} noValidate method="post" action="#">
              <VStack spacing={3.5}>
                <Box w="100%">
                  <Text fontSize="11px" fontWeight="700" color={textSub} mb={1.5} letterSpacing=".04em" textTransform="uppercase">
                    {t("auth_email")}
                  </Text>
                  <InputGroup>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" pl="42px"
                      bg={inputBg} border="1px solid" borderColor={inputBorder}
                      borderRadius="12px" h="48px" fontSize="14px" color={textMain}
                      _hover={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }}
                      _focus={{ borderColor: brand, boxShadow: `0 0 0 1px ${brand}` }}
                      _placeholder={{ color: dark ? "#475569" : "#94a3b8" }}
                      transition="all 0.15s" />
                    <Box position="absolute" left="14px" top="50%" transform="translateY(-50%)" zIndex={2} pointerEvents="none">
                      <Icon as={FiMail} color={textSub} boxSize={4} />
                    </Box>
                  </InputGroup>
                </Box>

                <Box w="100%">
                  <Text fontSize="11px" fontWeight="700" color={textSub} mb={1.5} letterSpacing=".04em" textTransform="uppercase">
                    {t("auth_password")}
                  </Text>
                  <InputGroup>
                    <Input type={showPw ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)} pl="42px"
                      bg={inputBg} border="1px solid" borderColor={inputBorder}
                      borderRadius="12px" h="48px" fontSize="14px" color={textMain}
                      _hover={{ borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }}
                      _focus={{ borderColor: brand, boxShadow: `0 0 0 1px ${brand}` }}
                      _placeholder={{ color: dark ? "#475569" : "#94a3b8" }}
                      transition="all 0.15s" />
                    <Box position="absolute" left="14px" top="50%" transform="translateY(-50%)" zIndex={2} pointerEvents="none">
                      <Icon as={FiLock} color={textSub} boxSize={4} />
                    </Box>
                    <InputRightElement h="100%">
                      <IconButton aria-label="Toggle password" icon={<Icon as={showPw ? FiEyeOff : FiEye} />}
                        type="button"
                        variant="ghost" size="sm" color={textSub} onClick={() => setShowPw(!showPw)}
                        _hover={{ color: textMain }} />
                    </InputRightElement>
                  </InputGroup>
                </Box>

                <Button type="submit" w="100%" h="50px" fontSize="15px" fontWeight="800"
                  bg={`linear-gradient(135deg,${brand},#003d82)`} color="white" borderRadius="14px"
                  isLoading={loading} rightIcon={<Icon as={FiArrowRight} />}
                  _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 30px ${brand}44` }}
                  _active={{ transform: "translateY(0)" }} transition="all 0.2s">
                  {t("auth_sign_in")}
                </Button>
              </VStack>
            </form>
          </Box>
        </Box>

        {/* Bottom links */}
        <VStack spacing={3} mt={6} style={{ animation: "fadeUp 0.5s 0.3s ease both" }}>
          <Text fontSize="13px" color={textSub}>
            {t("auth_no_account")}{" "}
            <Box as={NextLink} href="/register" color={brand} fontWeight="800"
              _hover={{ textDecoration: "underline" }} transition="all 0.15s">
              {t("auth_create_one")}
            </Box>
          </Text>
          <Text fontSize="11px" color={dark ? "#334155" : "#cbd5e1"}>
            Protected by 256-bit encryption
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
