"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, Heading, Text, VStack,
  Button, Input, useColorMode, Icon,
  InputGroup, IconButton,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiArrowRight, FiAlertCircle, FiEye, FiEyeOff,
  FiChevronLeft, FiMoon, FiSun,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import Logo from "@/components/ui/Logo";

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
    redFg:   "#ef4444",
  };
}

// ─── Floating-label Field ─────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
  right,
  dark,
  p,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  right?: React.ReactNode;
  dark: boolean;
  p: ReturnType<typeof usePalette>;
}) {
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  return (
    <Box w="100%">
      <Box
        position="relative"
        h="60px"
        borderRadius="16px"
        border="1.5px solid"
        borderColor={error ? p.redFg : focused ? p.fg : p.border}
        bg={p.bgElev}
        transition="border-color 0.15s"
        overflow="hidden"
      >
        {/* Floating label */}
        <Text
          as="span"
          position="absolute"
          left="16px"
          top={floated ? "10px" : "50%"}
          transform={floated ? "none" : "translateY(-50%)"}
          fontSize={floated ? "11px" : "15px"}
          fontWeight="500"
          color={p.fgMuted}
          pointerEvents="none"
          transition="all 0.15s ease"
          zIndex={1}
          userSelect="none"
        >
          {label}
        </Text>

        {/* Input */}
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          position="absolute"
          bottom="0"
          left="0"
          right="0"
          h="38px"
          px="16px"
          pr={right ? "44px" : "16px"}
          border="none"
          bg="transparent"
          borderRadius="0"
          fontSize="16px"
          fontWeight="500"
          color={p.fg}
          _focus={{ boxShadow: "none", border: "none" }}
          _placeholder={{ color: "transparent" }}
          autoCapitalize="off"
          autoCorrect="off"
        />

        {/* Right slot */}
        {right && (
          <Box
            position="absolute"
            right="12px"
            top="50%"
            transform="translateY(-50%)"
            zIndex={2}
          >
            {right}
          </Box>
        )}
      </Box>

      {error && (
        <Text fontSize="12px" fontWeight="600" color={p.redFg} mt="6px" ml="4px">
          {error}
        </Text>
      )}
    </Box>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const { colorMode, toggleColorMode } = useColorMode();
  const { login } = useAuthStore();
  const dark = colorMode === "dark";
  const p = usePalette(dark);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill demo credentials
  const fillDemo = () => {
    setEmail("rayan@promrkts.app");
    setPassword("Demo123!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError("");
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      const role = res?.user?.role;
      router.push(role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Pill button style shared across top bar ──
  const pillStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9999px",
    backgroundColor: p.pillBg,
    border: `1px solid ${p.border}`,
    cursor: "pointer",
    transition: "opacity 0.15s",
    flexShrink: 0,
  };

  return (
    <Box
      minH="100vh"
      bg={p.bg}
      display="flex"
      flexDirection="column"
      alignItems="center"
    >
      <Box
        w="100%"
        maxW="440px"
        px="24px"
        pb="32px"
        display="flex"
        flexDirection="column"
        flexGrow={1}
      >

        {/* ── Top bar ── */}
        <Flex
          align="center"
          justify="space-between"
          pt="16px"
          mb="32px"
        >
          {/* Back */}
          <Box
            as="button"
            onClick={() => router.back()}
            style={{
              ...pillStyle,
              width: "40px",
              height: "40px",
            }}
            aria-label="Go back"
          >
            <Icon as={FiChevronLeft} boxSize={5} color={p.fg} />
          </Box>

          {/* Right group */}
          <Flex gap="8px" align="center">
            {/* Theme toggle */}
            <Box
              as="button"
              onClick={toggleColorMode}
              style={{
                ...pillStyle,
                width: "34px",
                height: "34px",
              }}
              aria-label="Toggle theme"
            >
              <Icon
                as={dark ? FiSun : FiMoon}
                boxSize={4}
                color={p.fg}
              />
            </Box>

            {/* Logo / brand mark */}
            <Box
              w="32px"
              h="32px"
              borderRadius="9999px"
              overflow="hidden"
              flexShrink={0}
            >
              <Logo h={32} />
            </Box>
          </Flex>
        </Flex>

        {/* ── Heading ── */}
        <Heading
          fontSize="34px"
          fontWeight="800"
          letterSpacing="-1.1px"
          color={p.fg}
          lineHeight="1.1"
        >
          {t("auth_welcome_back")}
        </Heading>
        <Text
          color={p.fgMuted}
          fontSize="15px"
          lineHeight="22px"
          mt="8px"
        >
          {t("auth_login_subtitle")}
        </Text>

        {/* ── Form ── */}
        <Box as="form" onSubmit={handleSubmit} noValidate mt="28px">
          <VStack spacing="12px">
            <Field
              label="Email or @handle"
              value={email}
              onChange={setEmail}
              type="text"
              dark={dark}
              p={p}
            />
            <Field
              label={t("auth_password")}
              value={password}
              onChange={setPassword}
              type={showPw ? "text" : "password"}
              dark={dark}
              p={p}
              right={
                <Box
                  as="button"
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  <Icon as={showPw ? FiEyeOff : FiEye} boxSize={4} color={p.fgMuted} />
                </Box>
              }
            />
          </VStack>

          {/* Forgot password */}
          <Flex justify="flex-end" mt="8px">
            <Box
              as={NextLink}
              href="/forgot-password"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: p.fg,
                fontSize: "13px",
                fontWeight: "700",
                padding: "4px 0",
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Box>
          </Flex>

          {/* Error */}
          {error && (
            <Flex
              gap="8px"
              p="12px"
              mt="12px"
              bg={dark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)"}
              border="1px solid"
              borderColor={dark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)"}
              borderRadius="12px"
              align="center"
            >
              <Icon as={FiAlertCircle} color={p.redFg} boxSize={4} flexShrink={0} />
              <Text fontSize="13px" color={p.redFg}>{error}</Text>
            </Flex>
          )}

          {/* ── Primary CTA ── */}
          <Box
            as="button"
            type="submit"
            disabled={loading}
            style={{
              marginTop: "28px",
              width: "100%",
              height: "58px",
              borderRadius: "29px",
              backgroundColor: p.ctaBg,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "opacity 0.15s, transform 0.15s",
              boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
            }}
            aria-label={t("login.cta")}
          >
            {loading && (
              <Box
                as="span"
                display="inline-block"
                w="16px"
                h="16px"
                borderRadius="full"
                border="2px solid"
                borderColor={`${p.ctaFg}44`}
                borderTopColor={p.ctaFg}
                style={{ animation: "spin 0.7s linear infinite" }}
              />
            )}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke={p.ctaFg}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <Text
              as="span"
              color={p.ctaFg}
              fontSize="16px"
              fontWeight="800"
              letterSpacing="-0.2px"
            >
              {loading ? t("auth_sign_in") + "…" : t("auth_sign_in")}
            </Text>
          </Box>
        </Box>

        {/* ── Divider ── */}
        <Flex align="center" mt="22px" gap="12px">
          <Box flex={1} h="1px" bg={p.border} />
          <Text
            color={p.fgFaint}
            fontSize="12px"
            fontWeight="600"
            letterSpacing="0.4px"
            textTransform="uppercase"
          >
            or continue with email
          </Text>
          <Box flex={1} h="1px" bg={p.border} />
        </Flex>

        {/* ── Apple SSO ── */}
        <Box
          as="button"
          type="button"
          onClick={() =>
            alert("Apple Sign-In is coming soon. Use email + password for now.")
          }
          style={{
            marginTop: "18px",
            width: "100%",
            height: "56px",
            borderRadius: "28px",
            backgroundColor: "transparent",
            border: `1.5px solid ${p.fg}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.backgroundColor = p.bgElev;
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {/* Apple logo SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill={p.fg}>
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.65-2.2.46-3.06-.4C3.79 16.17 4.36 9.43 8.7 9.18c1.23.07 2.08.72 2.8.76.97-.2 1.9-.76 2.94-.69 1.36.1 2.38.66 3.07 1.68-2.79 1.67-2.13 5.35.54 6.38-.64 1.68-1.47 3.34-3 4.97zM12.03 9.12c-.13-2.42 1.83-4.44 4.08-4.62.33 2.77-2.53 4.84-4.08 4.62z" />
          </svg>
          <Text color={p.fg} fontSize="15px" fontWeight="700">
            Sign in with Apple
          </Text>
        </Box>

        {/* ── Demo account pill ── */}
        <Flex justify="center" mt="18px">
          <Box
            as="button"
            type="button"
            onClick={fillDemo}
            style={{
              ...pillStyle,
              paddingLeft: "14px",
              paddingRight: "14px",
              paddingTop: "8px",
              paddingBottom: "8px",
              borderRadius: "14px",
            }}
          >
            <Text
              color={p.fgMuted}
              fontSize="12px"
              fontWeight="700"
              letterSpacing="0.4px"
              textTransform="uppercase"
            >
              Use demo account
            </Text>
          </Box>
        </Flex>

        {/* ── Footer ── */}
        <Flex
          align="center"
          justify="center"
          mt="24px"
          gap="4px"
          pb="8px"
        >
          <Text color={p.fgMuted} fontSize="14px">
            {t("auth_no_account")}
          </Text>
          <Box
            as={NextLink}
            href="/register"
            style={{
              color: p.fg,
              fontSize: "14px",
              fontWeight: "800",
              textDecoration: "none",
            }}
          >
            {t("auth_create_one")}
          </Box>
        </Flex>
      </Box>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
}