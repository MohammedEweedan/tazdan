"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, Heading, Text, VStack, SimpleGrid,
  Input, Icon, useColorMode, Tabs, TabList, TabPanels, Tab, TabPanel,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiAlertCircle, FiEye, FiEyeOff, FiChevronLeft, FiMoon, FiSun,
  FiCreditCard, FiCamera, FiImage, FiUpload, FiX, FiCheck, FiCheckCircle,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { userAPI, authAPI } from "@/lib/api";
import Logo from "@/components/ui/Logo";

// ─── Palette (mirrors mobile themeStore tokens) ───────────────────
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
    greenFg: "#22c55e",
  };
}

type P = ReturnType<typeof usePalette>;
type Step = 1 | 2 | 3 | 4;

interface KycDoc {
  label: string;
  hint: string;
  icon: typeof FiCreditCard;
  type: "id_front" | "id_back" | "selfie";
  file: File | null;
  preview: string | null;
}

// ─── Floating-label Field (mirrors mobile Field component) ─────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
  right,
  p,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  right?: React.ReactNode;
  p: P;
  autoComplete?: string;
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

        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
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

// ─── Pill CTA (mirrors mobile PrimaryCTA) ─────────────────────────
function PrimaryCTA({
  label,
  onClick,
  loading,
  disabled,
  p,
  type = "button",
}: {
  label: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  p: P;
  type?: "button" | "submit";
}) {
  return (
    <Box
      as="button"
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        marginTop: "28px",
        width: "100%",
        height: "58px",
        borderRadius: "29px",
        backgroundColor: p.ctaBg,
        border: "none",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : loading ? 0.7 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        transition: "opacity 0.15s, transform 0.15s",
        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        flexShrink: 0,
      }}
    >
      {loading ? (
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
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke={p.ctaFg}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <Text
        as="span"
        color={p.ctaFg}
        fontSize="16px"
        fontWeight="800"
        letterSpacing="-0.2px"
      >
        {label}
      </Text>
    </Box>
  );
}

// ─── T&C Checkbox ─────────────────────────────────────────────────
function TermsCheckbox({
  checked,
  onChange,
  onOpenTerms,
  onOpenPrivacy,
  p,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  p: P;
}) {
  return (
    <Flex
      align="flex-start"
      gap="10px"
      mt="4px"
      style={{ userSelect: "none" }}
    >
      {/* Custom checkbox */}
      <Box
        flexShrink={0}
        mt="2px"
        w="18px"
        h="18px"
        borderRadius="6px"
        border="1.5px solid"
        borderColor={checked ? p.fg : p.border}
        bg={checked ? p.ctaBg : p.bgElev}
        display="flex"
        alignItems="center"
        justifyContent="center"
        transition="all 0.15s"
        cursor="pointer"
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke={p.ctaFg}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </Box>

      <Text fontSize="13px" color={p.fgMuted} lineHeight="20px">
        I agree to the{" "}
        <Box
          as="button"
          type="button"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onOpenTerms(); }}
          style={{
            color: p.fg,
            fontWeight: "700",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: "13px",
          }}
        >
          Terms of Service
        </Box>
        {" "}and{" "}
        <Box
          as="button"
          type="button"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onOpenPrivacy(); }}
          style={{
            color: p.fg,
            fontWeight: "700",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: "13px",
          }}
        >
          Privacy Policy
        </Box>
        . I confirm I am 18+ and not a U.S. person.
      </Text>
    </Flex>
  );
}

// ─── Legal Modal ──────────────────────────────────────────────────
function LegalModal({
  open,
  onClose,
  title,
  sections,
  eyebrow,
  updated,
  intro,
  p,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  updated: string;
  intro: string;
  sections: { title: string; body: string }[];
  p: P;
}) {
  if (!open) return null;
  return (
    <Box
      position="fixed"
      inset="0"
      zIndex={50}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(0,0,0,0.6)"
      backdropFilter="blur(4px)"
      onClick={onClose}
    >
      <Box
        bg={p.bgElev}
        border={`1px solid ${p.border}`}
        borderRadius="20px"
        maxW="640px"
        w="calc(100% - 32px)"
        maxH="80vh"
        overflowY="auto"
        p="28px"
        onClick={(e) => e.stopPropagation()}
      >
        <Flex justify="space-between" align="center" mb="20px">
          <Box>
            <Text fontSize="12px" fontWeight="700" color="#4a8fe0" letterSpacing="0.08em" textTransform="uppercase">
              {eyebrow}
            </Text>
            <Heading fontSize="20px" fontWeight="800" color={p.fg} mt="4px">
              {title}
            </Heading>
          </Box>
          <Box
            as="button"
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "9999px",
              background: p.pillBg,
              border: `1px solid ${p.border}`,
              color: p.fgMuted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Box>
        </Flex>

        <Text fontSize="12px" color={p.fgFaint} mb="16px">{updated}</Text>
        <Text fontSize="14px" color={p.fgMuted} lineHeight="22px" mb="24px">{intro}</Text>

        <VStack align="stretch" spacing="20px">
          {sections.map((s, i) => (
            <Box key={i}>
              <Text fontSize="14px" fontWeight="700" color={p.fg} mb="6px">
                {s.title}
              </Text>
              <Text fontSize="13px" color={p.fgMuted} lineHeight="20px">
                {s.body}
              </Text>
            </Box>
          ))}
        </VStack>

        <Box mt="28px">
          <Box
            as="button"
            onClick={onClose}
            w="100%"
            h="48px"
            borderRadius="14px"
            bg={p.ctaBg}
            color={p.ctaFg}
            fontWeight="700"
            fontSize="14px"
            textAlign="center"
            style={{ cursor: "pointer", border: "none" }}
          >
            Close
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ─── KYC Upload Slot ──────────────────────────────────────────────
function KycSlot({
  doc,
  index,
  onPick,
  p,
}: {
  doc: KycDoc;
  index: number;
  onPick: (i: number, f: File | null) => void;
  p: P;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const has = !!doc.file;

  return (
    <Box
      position="relative"
      p="12px"
      bg={p.bgElev}
      border="1.5px dashed"
      borderColor={has ? p.fg : p.border}
      borderRadius="16px"
      transition="border-color 0.15s"
      _hover={{ borderColor: p.fg }}
    >
      <Flex align="center" gap="12px">
        {/* Preview / icon */}
        {doc.preview ? (
          <Box
            w="54px"
            h="54px"
            borderRadius="10px"
            overflow="hidden"
            bg="#000"
            flexShrink={0}
            backgroundImage={`url(${doc.preview})`}
            backgroundSize="cover"
            backgroundPosition="center"
          />
        ) : (
          <Flex
            w="54px"
            h="54px"
            borderRadius="10px"
            bg={p.pillBg}
            border="1px solid"
            borderColor={p.border}
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Icon as={doc.icon} color={p.fgMuted} boxSize={5} />
          </Flex>
        )}

        <Box flex={1} minW={0}>
          <Text fontSize="13px" fontWeight="800" color={p.fg} noOfLines={1}>
            {doc.label}
          </Text>
          <Text fontSize="11.5px" color={p.fgMuted} noOfLines={1} mt="2px">
            {has ? doc.file!.name : doc.hint}
          </Text>
        </Box>

        {has ? (
          <Box
            as="button"
            type="button"
            onClick={() => onPick(index, null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
              color: p.fgMuted,
              flexShrink: 0,
              transition: "color 0.15s",
            }}
            aria-label="Remove file"
          >
            <Icon as={FiX} boxSize={4} />
          </Box>
        ) : (
          <Box
            as="button"
            type="button"
            onClick={() => ref.current?.click()}
            style={{
              background: "none",
              border: `1.5px solid ${p.border}`,
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: "10px",
              color: p.fg,
              fontSize: "12px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexShrink: 0,
              backgroundColor: p.pillBg,
              transition: "border-color 0.15s",
            }}
          >
            <Icon as={FiUpload} boxSize={3} />
            Upload
          </Box>
        )}
      </Flex>

      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(index, f);
          if (ref.current) ref.current.value = "";
        }}
      />
    </Box>
  );
}

// ─── Main Register Page ───────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const { colorMode, toggleColorMode } = useColorMode();
  const dark = colorMode === "dark";
  const p = usePalette(dark);
  const { register } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", referralCode: "", username: "", avatarUrl: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [kycDocs, setKycDocs] = useState<KycDoc[]>([
    { label: "ID Front", hint: "Passport, national ID or driver's license", icon: FiCreditCard, type: "id_front", file: null, preview: null },
    { label: "ID Back", hint: "Back side of the same document", icon: FiImage, type: "id_back", file: null, preview: null },
    { label: "Selfie with ID", hint: "Hold your ID next to your face, good lighting", icon: FiCamera, type: "selfie", file: null, preview: null },
  ]);

  const upd = (key: string) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  // Validate, create account, then go to email verification
  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!termsAccepted) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      await register({
        ...form,
        phone: form.phone || undefined,
        referralCode: form.referralCode || undefined,
        username: form.username || undefined,
        avatarUrl: form.avatarUrl || undefined,
      });
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitVerification = async () => {
    setError("");
    if (verificationCode.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      await authAPI.verifyEmailCode(verificationCode);
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setLoading(true);
    try {
      await authAPI.resendVerification();
      setError("A new code has been sent to your email.");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // KYC file handlers
  const pickFile = (idx: number, f: File | null) => {
    setKycDocs((docs) =>
      docs.map((d, i) => {
        if (i !== idx) return d;
        if (d.preview) URL.revokeObjectURL(d.preview);
        return { ...d, file: f, preview: f ? URL.createObjectURL(f) : null };
      }),
    );
  };

  const submitKyc = async () => {
    setError("");
    const missing = kycDocs.find((d) => !d.file);
    if (missing) {
      setError(`Please upload your ${missing.label.toLowerCase()}.`);
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      kycDocs.forEach((d) => {
        if (d.file) fd.append("documents", d.file, `${d.type}-${d.file.name}`);
      });
      fd.append("documentType", "identity");
      await userAPI.submitKYC(fd);
      setStep(4);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const skipKyc = () => router.push("/dashboard/kyc");
  const goToDashboard = () => router.push("/dashboard");

  const back = () => {
    setError("");
    if (step === 1) router.back();
    else setStep((step - 1) as Step);
  };

  const handleAvailable =
    form.username.length >= 3 && !/[^a-z0-9._]/i.test(form.username);

  // ── Pill button style ──
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
    <Box minH="100vh" bg={p.bg} display="flex" flexDirection="column" alignItems="center">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <Box w="100%" maxW="480px" px="24px" pb="32px" display="flex" flexDirection="column" flexGrow={1}>

        {/* ── Top bar ── */}
        <Flex align="center" justify="space-between" pt="16px" mb="22px">
          <Box
            as="button"
            onClick={back}
            style={{ ...pillStyle, width: "40px", height: "40px" }}
            aria-label="Go back"
          >
            <Icon as={FiChevronLeft} boxSize={5} color={p.fg} />
          </Box>

          <Flex gap="8px" align="center">
            <Box
              as="button"
              onClick={toggleColorMode}
              style={{ ...pillStyle, width: "34px", height: "34px" }}
              aria-label="Toggle theme"
            >
              <Icon as={dark ? FiSun : FiMoon} boxSize={4} color={p.fg} />
            </Box>
            <Box w="32px" h="32px" borderRadius="9999px" overflow="hidden" flexShrink={0}>
              <Logo h={32} />
            </Box>
          </Flex>
        </Flex>

        {/* ── Step indicator (segmented bars, mirrors mobile) ── */}
        <Flex align="center" gap="6px" mb="26px">
          {[1, 2, 3, 4].map((n) => (
            <Box
              key={n}
              h="6px"
              borderRadius="3px"
              flex={step === n ? 2 : 1}
              bg={step >= n ? p.fg : p.border}
              transition="all 0.25s ease"
            />
          ))}
          <Text
            color={p.fgMuted}
            fontSize="11px"
            fontWeight="700"
            letterSpacing="0.6px"
            ml="6px"
            flexShrink={0}
          >
            {step}/4
          </Text>
        </Flex>

        {/* ── Error banner ── */}
        {error && (
          <Flex
            gap="8px"
            p="12px"
            mb="16px"
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

        {/* ══ STEP 1 · Account details ══ */}
        {step === 1 && (
          <Box as="form" onSubmit={submitAccount} noValidate>
            <Heading
              fontSize="34px"
              fontWeight="800"
              letterSpacing="-1.1px"
              color={p.fg}
              lineHeight="1.1"
            >
              {t("auth_create_account")}
            </Heading>
            <Text color={p.fgMuted} fontSize="15px" lineHeight="22px" mt="8px">
              {t("auth_create_subtitle")}
            </Text>

            <VStack spacing="12px" mt="28px">
              <SimpleGrid columns={2} spacing="12px" w="100%">
                <Field label={t("auth_first_name")} value={form.firstName} onChange={upd("firstName")} p={p} autoComplete="given-name" />
                <Field label={t("auth_last_name")} value={form.lastName} onChange={upd("lastName")} p={p} autoComplete="family-name" />
              </SimpleGrid>

              <Field label={t("auth_email")} value={form.email} onChange={upd("email")} type="email" p={p} autoComplete="email" />

              <Field label={t("auth_phone")} value={form.phone} onChange={upd("phone")} type="tel" p={p} autoComplete="tel" />

              <Field
                label="@handle (optional)"
                value={form.username}
                onChange={upd("username")}
                p={p}
                autoComplete="username"
              />

              {/* Emoji avatar picker */}
              <Box w="100%">
                <Text fontSize="13px" fontWeight="700" color={p.fg} mb="10px">
                  Choose an avatar
                </Text>

                {(() => {
                  const emojiGroups = {
                    Cool: [
                      "🔥","⚡","💀","☠️","👑","😈","😎","🫡","💯","🚀","🎯","🥷",
                      "🦾","🔒","💸","🏴","⭐","✨","🌙","☄️","🪐","⚔️","🛡️","🏁"
                    ],

                    Animals: [
                      "🦁","🐺","🦅","🦊","🐆","🐅","🦈","🐊","🐍","🦂","🕷","🐉",
                      "🐎","🦌","🦍","🐘","🦏","🦓","🐪","🦜","🐬","🐳","👽","🦇"
                    ],

                    Faces: [
                      "😎","😈","🤠","🫡","🥶","🥷","😏","😤","🤝","🫶","🖤","❤️",
                      "💙","💚","💜","🤍","🩶","💛","🧠","👀","🫥","🫠","🤫","🧿"
                    ],

                    Symbols: [
                      "👑","💎","💸","💯","🔒","⚡","🔥","⭐","✨","☠️","💀","🚀",
                      "🎯","🏴","🏁","⚔️","🛡️","📿","🧿","🪬","🌍","☄️","🪐","🌊"
                    ],

                    Nature: [
                      "☀️","🌙","☁️","❄️","🌊","🌴","🌵","🌍","🌎","🌏","🪐","☄️",
                      "⭐","✨","🌊","🌴","🍂","🍁","🌸","🌹","🌺","🌻","🌼","🌿"
                    ],

                    Faith: [
                      "📿","☪️","🕋","🤲","🙏","🧿","🪬","🕊️","🤍","🌙","⭐","☀️"
                    ],

                    Flags: [
                      "🇱🇾","🇵🇸","🇸🇦","🇦🇪","🇪🇬","🇹🇳","🇩🇿","🇲🇦","🇹🇷","🇮🇹"
                    ],
                  };

                  return (
                    <Tabs variant="soft-rounded" colorScheme="gray" isFitted>
                      <TabList
                        overflowX="auto"
                        whiteSpace="nowrap"
                        gap="6px"
                        pb="6px"
                        sx={{
                          scrollbarWidth: "none",
                          "&::-webkit-scrollbar": { display: "none" },
                        }}
                      >
                        {Object.keys(emojiGroups).map((group) => (
                          <Tab
                            key={group}
                            fontSize="12px"
                            fontWeight="700"
                            borderRadius="999px"
                            minW="fit-content"
                            px="14px"
                            py="8px"
                          >
                            {group}
                          </Tab>
                        ))}
                      </TabList>

                      <TabPanels mt="12px">
                        {Object.entries(emojiGroups).map(([group, emojis]) => (
                          <TabPanel key={group} p={0}>
                            <Flex gap="8px" flexWrap="wrap">
                              {emojis.map((emoji) => (
                                <Box
                                  key={emoji}
                                  as="button"
                                  type="button"
                                  onClick={() =>
                                    setForm((f) => ({
                                      ...f,
                                      avatarUrl: emoji,
                                    }))
                                  }
                                  borderRadius="12px"
                                  p="8px"
                                  bg={form.avatarUrl === emoji ? p.fg : p.bgElev}
                                  border="1.5px solid"
                                  borderColor={
                                    form.avatarUrl === emoji ? p.fg : p.border
                                  }
                                  fontSize="22px"
                                  lineHeight="1"
                                  cursor="pointer"
                                  transition="all 0.15s"
                                  _hover={{ borderColor: p.fg }}
                                >
                                  {emoji}
                                </Box>
                              ))}
                            </Flex>
                          </TabPanel>
                        ))}
                      </TabPanels>
                    </Tabs>
                  );
                })()}
              </Box>

              <Field
                label={t("auth_password")}
                value={form.password}
                onChange={upd("password")}
                type={showPw ? "text" : "password"}
                p={p}
                autoComplete="new-password"
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

              <Field label={t("auth_referral_code")} value={form.referralCode} onChange={upd("referralCode")} p={p} />
            </VStack>

            {/* ── T&C disclaimer ── */}
            <Box mt="20px">
              <TermsCheckbox
                checked={termsAccepted}
                onChange={setTermsAccepted}
                onOpenTerms={() => setShowTerms(true)}
                onOpenPrivacy={() => setShowPrivacy(true)}
                p={p}
              />
            </Box>

            <PrimaryCTA label={loading ? "Creating account…" : t("auth_continue") || "Continue"} type="submit" loading={loading} p={p} />
          </Box>
        )}

        {/* ══ STEP 2 · Email verification ══ */}
        {step === 2 && (
          <Box>
            <Heading fontSize="34px" fontWeight="800" letterSpacing="-1.1px" color={p.fg} lineHeight="1.1">
              Verify your email
            </Heading>
            <Text color={p.fgMuted} fontSize="15px" lineHeight="22px" mt="8px">
              Enter the 6-digit code we sent to <strong style={{ color: p.fg }}>{form.email}</strong>
            </Text>

            <VStack spacing="12px" mt="28px" align="stretch">
              <Box
                position="relative"
                h="60px"
                borderRadius="16px"
                border="1.5px solid"
                borderColor={error ? p.redFg : p.border}
                bg={p.bgElev}
                transition="border-color 0.15s"
                overflow="hidden"
              >
                <Text
                  as="span"
                  position="absolute"
                  left="16px"
                  top="10px"
                  fontSize="11px"
                  fontWeight="500"
                  color={p.fgMuted}
                  pointerEvents="none"
                  userSelect="none"
                >
                  6-digit code
                </Text>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                  position="absolute"
                  bottom="0"
                  left="0"
                  right="0"
                  h="38px"
                  px="16px"
                  border="none"
                  bg="transparent"
                  borderRadius="0"
                  fontSize="16px"
                  fontWeight="500"
                  color={p.fg}
                  letterSpacing="8px"
                  _focus={{ boxShadow: "none", border: "none" }}
                  autoFocus
                />
              </Box>
            </VStack>

            <PrimaryCTA
              label={loading ? "Verifying…" : "Verify"}
              onClick={submitVerification}
              loading={loading}
              p={p}
            />

            <Flex justify="center" mt="14px">
              <Box
                as="button"
                type="button"
                onClick={resendCode}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: p.fgMuted,
                  fontSize: "13px",
                  fontWeight: "700",
                  padding: "6px 0",
                }}
              >
                Didn’t receive it? Resend →
              </Box>
            </Flex>
          </Box>
        )}

        {/* ══ STEP 3 · KYC documents ══ */}
        {step === 3 && (
          <Box>
            <Heading fontSize="34px" fontWeight="800" letterSpacing="-1.1px" color={p.fg} lineHeight="1.1">
              Verify your identity
            </Heading>
            <Text color={p.fgMuted} fontSize="15px" lineHeight="22px" mt="8px">
              Required for trading, card issuance and withdrawals. JPG / PNG / PDF, up to 8 MB each.
            </Text>

            <VStack spacing="10px" mt="28px" align="stretch">
              {kycDocs.map((d, i) => (
                <KycSlot key={d.type} doc={d} index={i} onPick={pickFile} p={p} />
              ))}
            </VStack>

            {/* Actions */}
            <PrimaryCTA
              label={loading ? "Uploading…" : "Submit for review"}
              onClick={submitKyc}
              loading={loading}
              p={p}
            />

            {/* Skip */}
            <Flex justify="center" mt="14px">
              <Box
                as="button"
                type="button"
                onClick={skipKyc}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: p.fgMuted,
                  fontSize: "13px",
                  fontWeight: "700",
                  padding: "6px 0",
                }}
              >
                Skip for now →
              </Box>
            </Flex>
          </Box>
        )}

        {/* ══ STEP 4 · All set ══ */}
        {step === 4 && (
          <Flex direction="column" align="center" pt="24px" gap="20px">
            {/* Success circle */}
            <Flex
              w="72px"
              h="72px"
              borderRadius="full"
              align="center"
              justify="center"
              bg={p.pillBg}
              border="1.5px solid"
              borderColor={p.border}
            >
              <Icon as={FiCheckCircle} color={p.fg} boxSize={8} />
            </Flex>

            <Box textAlign="center">
              <Heading fontSize="30px" fontWeight="800" letterSpacing="-1px" color={p.fg}>
                You're all set.
              </Heading>
              <Text color={p.fgMuted} fontSize="15px" lineHeight="22px" mt="8px" maxW="340px">
                Your KYC is being reviewed. You'll get a notification once it's approved — usually within a few hours.
              </Text>
            </Box>

            <PrimaryCTA label="Go to dashboard" onClick={goToDashboard} p={p} />
          </Flex>
        )}

        {/* ── Footer ── */}
        <Flex align="center" justify="center" mt="28px" pb="8px" gap="4px">
          <Text color={p.fgMuted} fontSize="14px">{t("auth_already_have_account")}</Text>
          <Box
            as={NextLink}
            href="/login"
            style={{ color: p.fg, fontSize: "14px", fontWeight: "800", textDecoration: "none" }}
          >
            {t("auth_sign_in")}
          </Box>
        </Flex>
      </Box>

      {/* ── Terms Modal ── */}
      <LegalModal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        eyebrow={t("page_terms_eyebrow") || "Legal"}
        title={t("page_terms_title") || "Terms of Service"}
        updated={t("page_terms_updated") || "Last updated: April 2026"}
        intro={t("page_terms_intro") || ""}
        sections={[
          { title: t("page_terms_s1_t") || "1. Acceptance of Terms", body: t("page_terms_s1_d") || "" },
          { title: t("page_terms_s2_t") || "2. Eligibility", body: t("page_terms_s2_d") || "" },
          { title: t("page_terms_s3_t") || "3. Account Registration", body: t("page_terms_s3_d") || "" },
          { title: t("page_terms_s4_t") || "4. Services", body: t("page_terms_s4_d") || "" },
          { title: t("page_terms_s5_t") || "5. Fees", body: t("page_terms_s5_d") || "" },
          { title: t("page_terms_s6_t") || "6. Prohibited Activities", body: t("page_terms_s6_d") || "" },
          { title: t("page_terms_s7_t") || "7. Termination", body: t("page_terms_s7_d") || "" },
          { title: t("page_terms_s8_t") || "8. Limitation of Liability", body: t("page_terms_s8_d") || "" },
          { title: t("page_terms_s9_t") || "9. Governing Law", body: t("page_terms_s9_d") || "" },
          { title: t("page_terms_s10_t") || "10. Contact", body: t("page_terms_s10_d") || "" },
        ]}
        p={p}
      />

      {/* ── Privacy Modal ── */}
      <LegalModal
        open={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        eyebrow={t("page_privacy_eyebrow") || "Legal"}
        title={t("page_privacy_title") || "Privacy Policy"}
        updated={t("page_privacy_updated") || "Last updated: April 2026"}
        intro={t("page_privacy_intro") || ""}
        sections={[
          { title: t("page_privacy_s1_t") || "1. Information We Collect", body: t("page_privacy_s1_d") || "" },
          { title: t("page_privacy_s2_t") || "2. How We Use Your Information", body: t("page_privacy_s2_d") || "" },
          { title: t("page_privacy_s3_t") || "3. Information Sharing", body: t("page_privacy_s3_d") || "" },
          { title: t("page_privacy_s4_t") || "4. Data Security", body: t("page_privacy_s4_d") || "" },
          { title: t("page_privacy_s5_t") || "5. Your Rights", body: t("page_privacy_s5_d") || "" },
          { title: t("page_privacy_s6_t") || "6. Cookies", body: t("page_privacy_s6_d") || "" },
          { title: t("page_privacy_s7_t") || "7. Contact Us", body: t("page_privacy_s7_d") || "" },
        ]}
        p={p}
      />
    </Box>
  );
}