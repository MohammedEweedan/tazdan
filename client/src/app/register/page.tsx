"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, Heading, Text, VStack, SimpleGrid,
  Input, Icon, useColorMode,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiAlertCircle, FiEye, FiEyeOff, FiChevronLeft, FiMoon, FiSun,
  FiCreditCard, FiCamera, FiImage, FiUpload, FiX, FiCheck, FiCheckCircle,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { userAPI } from "@/lib/api";
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
type Step = 1 | 2 | 3;

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
  p,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  p: P;
}) {
  return (
    <Flex
      as="label"
      align="flex-start"
      gap="10px"
      cursor="pointer"
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

      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: "none" }}
      />

      <Text fontSize="13px" color={p.fgMuted} lineHeight="20px">
        I agree to the{" "}
        <Box
          as={NextLink}
          href="/terms"
          target="_blank"
          style={{
            color: p.fg,
            fontWeight: "700",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          }}
        >
          Terms of Service
        </Box>
        {" "}and{" "}
        <Box
          as={NextLink}
          href="/privacy"
          target="_blank"
          style={{
            color: p.fg,
            fontWeight: "700",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          }}
        >
          Privacy Policy
        </Box>
        . I confirm I am 18+ and not a U.S. person.
      </Text>
    </Flex>
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
    firstName: "", lastName: "", email: "", phone: "", password: "", referralCode: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [handle, setHandle] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [kycDocs, setKycDocs] = useState<KycDoc[]>([
    { label: "ID Front", hint: "Passport, national ID or driver's license", icon: FiCreditCard, type: "id_front", file: null, preview: null },
    { label: "ID Back", hint: "Back side of the same document", icon: FiImage, type: "id_back", file: null, preview: null },
    { label: "Selfie with ID", hint: "Hold your ID next to your face, good lighting", icon: FiCamera, type: "selfie", file: null, preview: null },
  ]);

  const upd = (key: string) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  // Validate & go to step 2
  const submitAccount = (e: React.FormEvent) => {
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
    setStep(2);
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
      // Register the account first, then upload KYC
      await register({
        ...form,
        phone: form.phone || undefined,
        referralCode: form.referralCode || undefined,
      });
      const fd = new FormData();
      kycDocs.forEach((d) => {
        if (d.file) fd.append("documents", d.file, `${d.type}-${d.file.name}`);
      });
      fd.append("documentType", "identity");
      await userAPI.submitKYC(fd);
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Upload failed. Please try again.");
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
    handle.length >= 3 && !/[^a-z0-9._]/i.test(handle);

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
          {[1, 2, 3].map((n) => (
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
            {step}/3
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
              <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} p={p} />
            </Box>

            <PrimaryCTA label={t("auth_continue") || "Continue"} type="submit" p={p} />
          </Box>
        )}

        {/* ══ STEP 2 · KYC documents ══ */}
        {step === 2 && (
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

        {/* ══ STEP 3 · All set ══ */}
        {step === 3 && (
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
    </Box>
  );
}