"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box, Flex, Heading, Text, VStack, HStack,
  Button, Input, Icon, SimpleGrid, useColorMode,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiUserPlus, FiArrowRight, FiArrowLeft, FiAlertCircle, FiShield, FiZap,
  FiCheckCircle, FiUpload, FiCamera, FiCreditCard, FiX, FiImage,
} from "react-icons/fi";
import { useAuthStore } from "@/stores/authStore";
import { userAPI } from "@/lib/api";
import Logo from "@/components/ui/Logo";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

type Step = 1 | 2 | 3;

interface KycDoc {
  label: string;
  hint: string;
  icon: typeof FiCreditCard;
  type: "id_front" | "id_back" | "selfie";
  file: File | null;
  preview: string | null;
}

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const { register } = useAuthStore();
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", referralCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [kycDocs, setKycDocs] = useState<KycDoc[]>([
    { label: "ID Front", hint: "Passport, national ID or driver's license", icon: FiCreditCard, type: "id_front", file: null, preview: null },
    { label: "ID Back", hint: "Back side of the same document", icon: FiImage, type: "id_back", file: null, preview: null },
    { label: "Selfie with ID", hint: "Hold your ID next to your face, good lighting", icon: FiCamera, type: "selfie", file: null, preview: null },
  ]);

  const dark = colorMode === "dark";
  const cardBg = dark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.9)";
  const cardBorder = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const textSub = dark ? "#94a3b8" : "#64748b";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const inputBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const inputBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const slotBg = dark ? "rgba(255,255,255,0.03)" : "rgba(0,87,184,0.03)";

  const upd = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const inputProps = {
    bg: inputBg,
    border: "1px solid",
    borderColor: inputBorder,
    borderRadius: "10px",
    h: "44px",
    fontSize: "14px",
    _hover: { borderColor: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" },
    _focus: { borderColor: "#0057b8", boxShadow: "0 0 0 1px #0057b8" },
  };

  /* ── Step 1 → create account (which also logs the user in) ── */
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
    setLoading(true);
    try {
      await register({
        ...form,
        phone: form.phone || undefined,
        referralCode: form.referralCode || undefined,
      });
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.error || t("common_error"));
    } finally {
      setLoading(false);
    }
  };

  /* ── KYC file handlers ── */
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
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const skipKyc = () => {
    // User can finish later from the dashboard
    router.push("/dashboard/kyc");
  };

  const goToDashboard = () => router.push("/dashboard");

  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" position="relative" overflow="hidden" py={8}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Background orbs */}
      <Box position="absolute" inset={0} pointerEvents="none" zIndex={0}>
        <Box position="absolute" top="-15%" right="30%" w="700px" h="700px" borderRadius="full"
          bg={dark ? "radial-gradient(circle,rgba(0,87,184,0.08),transparent 65%)" : "radial-gradient(circle,rgba(0,87,184,0.05),transparent 65%)"}
          style={{ filter: "blur(80px)" }}
        />
        <Box position="absolute" bottom="-25%" left="20%" w="600px" h="600px" borderRadius="full"
          bg={dark ? "radial-gradient(circle,rgba(139,92,246,0.05),transparent 65%)" : "radial-gradient(circle,rgba(139,92,246,0.03),transparent 65%)"}
          style={{ filter: "blur(60px)" }}
        />
      </Box>

      <Box w="100%" maxW="560px" mx="auto" px={4} position="relative" zIndex={1}>
        {/* Header */}
        <VStack spacing={3} mb={6} style={{ animation: "fadeUp 0.5s ease forwards" }}>
          <Logo h={38} />
          <HStack spacing={2}>
            <LanguageSwitcher />
            <ColorModeToggle />
          </HStack>
        </VStack>

        {/* Progress rail */}
        <HStack spacing={0} mb={5} align="center" justify="center">
          {[
            { n: 1, label: "Account" },
            { n: 2, label: "Verify" },
            { n: 3, label: "Done" },
          ].map((s, i, arr) => {
            const active = step === (s.n as Step);
            const done = step > (s.n as Step);
            return (
              <Flex key={s.n} align="center" flex={i === arr.length - 1 ? "initial" : 1}>
                <Flex
                  w="28px"
                  h="28px"
                  borderRadius="full"
                  align="center"
                  justify="center"
                  fontSize="12px"
                  fontWeight="800"
                  bg={done ? "#0057b8" : active ? "#0057b8" : dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
                  color={done || active ? "white" : textSub}
                  border="1px solid"
                  borderColor={done || active ? "#0057b8" : "transparent"}
                  transition="all 0.2s"
                >
                  {done ? <Icon as={FiCheckCircle} boxSize={3.5} /> : s.n}
                </Flex>
                <Text fontSize="11px" ml={2} fontWeight="700" color={active ? textMain : textSub} letterSpacing="0.04em">
                  {s.label}
                </Text>
                {i < arr.length - 1 && (
                  <Box
                    flex={1}
                    h="1px"
                    mx={3}
                    bg={step > (s.n as Step) ? "#0057b8" : dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}
                    transition="all 0.3s"
                  />
                )}
              </Flex>
            );
          })}
        </HStack>

        {/* Card */}
        <Box
          p={{ base: 6, md: 8 }}
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="20px"
          backdropFilter="blur(12px)"
          style={{ animation: "fadeUp 0.6s 0.1s ease both" }}
        >
          {error && (
            <Flex gap={2} p={3} mb={4} bg={dark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)"}
              border="1px solid" borderColor={dark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)"}
              borderRadius="10px" align="center"
            >
              <Icon as={FiAlertCircle} color="#ef4444" boxSize={4} flexShrink={0} />
              <Text fontSize="13px" color="#ef4444">{error}</Text>
            </Flex>
          )}

          {step === 1 && (
            <>
              <Box textAlign="center" mb={6}>
                <Box
                  display="inline-flex" alignItems="center" gap={2} px={3} py={1.5}
                  borderRadius="full" mb={4} border="1px solid"
                  borderColor={dark ? "rgba(0,87,184,0.3)" : "rgba(0,87,184,0.2)"}
                  bg={dark ? "rgba(0,87,184,0.07)" : "rgba(0,87,184,0.04)"}
                >
                  <Icon as={FiUserPlus} color="#0057b8" boxSize={3} />
                  <Text fontSize="11px" fontWeight="700" color="#0057b8" letterSpacing=".04em">
                    Step 1 · Account
                  </Text>
                </Box>
                <Heading fontSize="26px" fontWeight="900" letterSpacing="-.04em" mb={1}>
                  {t("auth_create_account")}
                </Heading>
                <Text fontSize="14px" color={textSub}>{t("auth_create_subtitle")}</Text>
              </Box>

              <form onSubmit={submitAccount}>
                <VStack spacing={4}>
                  <SimpleGrid columns={2} spacing={3} w="100%">
                    <Box>
                      <Text fontSize="12px" fontWeight="600" color={textSub} mb={1.5} letterSpacing=".02em">
                        {t("auth_first_name")}
                      </Text>
                      <Input value={form.firstName} onChange={upd("firstName")} {...inputProps} />
                    </Box>
                    <Box>
                      <Text fontSize="12px" fontWeight="600" color={textSub} mb={1.5} letterSpacing=".02em">
                        {t("auth_last_name")}
                      </Text>
                      <Input value={form.lastName} onChange={upd("lastName")} {...inputProps} />
                    </Box>
                  </SimpleGrid>

                  <Box w="100%">
                    <Text fontSize="12px" fontWeight="600" color={textSub} mb={1.5} letterSpacing=".02em">
                      {t("auth_email")}
                    </Text>
                    <Input type="email" value={form.email} onChange={upd("email")} placeholder="you@example.com" {...inputProps} />
                  </Box>

                  <Box w="100%">
                    <Text fontSize="12px" fontWeight="600" color={textSub} mb={1.5} letterSpacing=".02em">
                      {t("auth_phone")}
                    </Text>
                    <Input type="tel" value={form.phone} onChange={upd("phone")} placeholder="+218..." {...inputProps} />
                  </Box>

                  <Box w="100%">
                    <Text fontSize="12px" fontWeight="600" color={textSub} mb={1.5} letterSpacing=".02em">
                      {t("auth_password")}
                    </Text>
                    <Input type="password" value={form.password} onChange={upd("password")} placeholder="Min. 8 characters" {...inputProps} />
                  </Box>

                  <Box w="100%">
                    <Text fontSize="12px" fontWeight="600" color={textSub} mb={1.5} letterSpacing=".02em">
                      {t("auth_referral_code")}
                    </Text>
                    <Input value={form.referralCode} onChange={upd("referralCode")} placeholder="Optional" {...inputProps} />
                  </Box>

                  <Button
                    type="submit" w="100%" h="48px" fontSize="14px" fontWeight="800"
                    bg="linear-gradient(135deg,#0057b8,#003d82)" color="white"
                    borderRadius="12px" isLoading={loading}
                    rightIcon={<FiArrowRight />}
                    _hover={{ transform: "translateY(-1px)", boxShadow: "0 6px 24px rgba(0,87,184,0.35)" }}
                    transition="all 0.2s"
                  >
                    Continue to verification
                  </Button>
                </VStack>
              </form>

              <HStack justify="center" spacing={4} mt={5} flexWrap="wrap">
                {[
                  { icon: FiShield, text: "AES-256" },
                  { icon: FiZap, text: "Instant Setup" },
                  { icon: FiCheckCircle, text: "No Fees" },
                ].map((p) => (
                  <HStack key={p.text} spacing={1.5}>
                    <Icon as={p.icon} color="#0057b8" boxSize={3} />
                    <Text fontSize="11px" color={textSub} fontWeight="600">{p.text}</Text>
                  </HStack>
                ))}
              </HStack>
            </>
          )}

          {step === 2 && (
            <>
              <Box textAlign="center" mb={6}>
                <Box
                  display="inline-flex" alignItems="center" gap={2} px={3} py={1.5}
                  borderRadius="full" mb={4} border="1px solid"
                  borderColor={dark ? "rgba(0,87,184,0.3)" : "rgba(0,87,184,0.2)"}
                  bg={dark ? "rgba(0,87,184,0.07)" : "rgba(0,87,184,0.04)"}
                >
                  <Icon as={FiShield} color="#0057b8" boxSize={3} />
                  <Text fontSize="11px" fontWeight="700" color="#0057b8" letterSpacing=".04em">
                    Step 2 · Verify your identity
                  </Text>
                </Box>
                <Heading fontSize="24px" fontWeight="900" letterSpacing="-.04em" mb={1}>
                  Upload KYC documents
                </Heading>
                <Text fontSize="13.5px" color={textSub} maxW="420px" mx="auto">
                  Required for trading, card issuance and withdrawals. JPG / PNG / PDF up to 8 MB each.
                </Text>
              </Box>

              <VStack spacing={3} align="stretch">
                {kycDocs.map((d, i) => (
                  <KycSlot
                    key={d.type}
                    doc={d}
                    index={i}
                    onPick={pickFile}
                    slotBg={slotBg}
                    cardBorder={cardBorder}
                    textMain={textMain}
                    textSub={textSub}
                  />
                ))}
              </VStack>

              <HStack mt={6} spacing={3}>
                <Button
                  onClick={() => setStep(1)}
                  h="44px"
                  flex={1}
                  variant="ghost"
                  leftIcon={<FiArrowLeft />}
                  color={textSub}
                  fontWeight="700"
                  fontSize="13px"
                >
                  Back
                </Button>
                <Button
                  onClick={skipKyc}
                  h="44px"
                  variant="ghost"
                  color={textSub}
                  fontWeight="700"
                  fontSize="13px"
                >
                  Skip for now
                </Button>
                <Button
                  onClick={submitKyc}
                  isLoading={loading}
                  flex={2}
                  h="44px"
                  bg="linear-gradient(135deg,#0057b8,#003d82)"
                  color="white"
                  rightIcon={<FiUpload />}
                  borderRadius="12px"
                  fontWeight="800"
                  fontSize="13px"
                  _hover={{ transform: "translateY(-1px)", boxShadow: "0 6px 24px rgba(0,87,184,0.35)" }}
                  transition="all 0.2s"
                >
                  Submit for review
                </Button>
              </HStack>
            </>
          )}

          {step === 3 && (
            <VStack spacing={5} py={4}>
              <Flex
                w="72px"
                h="72px"
                borderRadius="full"
                align="center"
                justify="center"
                bg="linear-gradient(135deg, rgba(0,87,184,0.15), rgba(0,87,184,0.05))"
                border="1px solid rgba(0,87,184,0.25)"
              >
                <Icon as={FiCheckCircle} color="#0057b8" boxSize={8} />
              </Flex>
              <VStack spacing={1} textAlign="center">
                <Heading fontSize="24px" fontWeight="900" letterSpacing="-.04em">
                  You're all set.
                </Heading>
                <Text fontSize="14px" color={textSub} maxW="380px">
                  Your KYC is being reviewed. You'll get a notification as soon as it's approved — usually within a few hours.
                </Text>
              </VStack>
              <Button
                onClick={goToDashboard}
                w="100%"
                h="48px"
                bg="linear-gradient(135deg,#0057b8,#003d82)"
                color="white"
                borderRadius="12px"
                fontWeight="800"
                fontSize="14px"
                rightIcon={<FiArrowRight />}
                _hover={{ transform: "translateY(-1px)", boxShadow: "0 6px 24px rgba(0,87,184,0.35)" }}
                transition="all 0.2s"
              >
                Go to dashboard
              </Button>
            </VStack>
          )}
        </Box>

        {step === 1 && (
          <Text fontSize="13px" color={textSub} textAlign="center" mt={6} style={{ animation: "fadeUp 0.6s 0.3s ease both" }}>
            {t("auth_already_have_account")}{" "}
            <Box as={NextLink} href="/login" color="#0057b8" fontWeight="700"
              _hover={{ textDecoration: "underline" }} transition="all 0.2s"
            >
              {t("auth_sign_in")}
            </Box>
          </Text>
        )}
      </Box>
    </Box>
  );
}

/* ── Per-document upload slot with preview + remove ───────────────── */
function KycSlot({
  doc,
  index,
  onPick,
  slotBg,
  cardBorder,
  textMain,
  textSub,
}: {
  doc: KycDoc;
  index: number;
  onPick: (i: number, f: File | null) => void;
  slotBg: string;
  cardBorder: string;
  textMain: string;
  textSub: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const has = !!doc.file;

  return (
    <Box
      position="relative"
      p={3}
      bg={slotBg}
      border="1px dashed"
      borderColor={has ? "#0057b8" : cardBorder}
      borderRadius="14px"
      transition="all 0.2s"
      _hover={{ borderColor: "#0057b8" }}
    >
      <HStack spacing={3} align="center">
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
            bg="rgba(0,87,184,0.08)"
            border="1px solid rgba(0,87,184,0.2)"
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Icon as={doc.icon} color="#0057b8" boxSize={5} />
          </Flex>
        )}

        <VStack align="start" spacing={0.5} flex={1}>
          <Text fontSize="13px" fontWeight="800" color={textMain}>
            {doc.label}
          </Text>
          <Text fontSize="11.5px" color={textSub} noOfLines={1}>
            {has ? doc.file!.name : doc.hint}
          </Text>
        </VStack>

        {has ? (
          <Button
            size="sm"
            variant="ghost"
            color={textSub}
            onClick={() => onPick(index, null)}
            _hover={{ color: "#ef4444", bg: "rgba(239,68,68,0.08)" }}
          >
            <Icon as={FiX} />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => ref.current?.click()}
            bg="#0057b8"
            color="white"
            borderRadius="10px"
            fontWeight="700"
            fontSize="12px"
            px={3}
            leftIcon={<FiUpload />}
            _hover={{ bg: "#003d82" }}
          >
            Upload
          </Button>
        )}
      </HStack>

      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(index, f);
          // reset so the same filename can be re-picked after removal
          if (ref.current) ref.current.value = "";
        }}
      />
    </Box>
  );
}
