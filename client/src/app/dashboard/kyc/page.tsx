"use client";

import { useEffect, useState } from "react";
import {
  Box, Flex, Text, Button, Input, VStack, HStack, Icon, useToast,
} from "@chakra-ui/react";
import {
  FiUpload, FiCheckCircle, FiXCircle, FiClock, FiShield,
  FiCamera, FiFileText, FiAlertTriangle, FiLock, FiUnlock, FiInfo,
} from "react-icons/fi";
import { userAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import {
  PageShell, PageHeader, GlassCard, SectionHeader,
  PageSpinner, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

type DocType = "selfie" | "id_front" | "id_back";

const DOC_CONFIG: Record<DocType, { label: string; icon: any; description: string; accept: string; required: boolean }> = {
  selfie: { label: "Selfie with ID", icon: FiCamera, description: "Clear selfie holding your ID next to your face", accept: "image/*", required: true },
  id_front: { label: "ID · front", icon: FiFileText, description: "Passport, driver's license, or national ID — front", accept: "image/*,.pdf", required: true },
  id_back: { label: "ID · back", icon: FiFileText, description: "Back side of your ID (if applicable)", accept: "image/*,.pdf", required: false },
};

const FEATURES = [
  "Withdrawals above $500/day",
  "P2P marketplace",
  "External wallet transfers",
  "Increased deposit limits",
];

const STATUS_META: Record<string, { color: string; icon: any; label: string }> = {
  APPROVED: { color: "#22c55e", icon: FiCheckCircle, label: "Verified" },
  PENDING: { color: "#f59e0b", icon: FiClock, label: "Under review" },
  REJECTED: { color: "#ef4444", icon: FiXCircle, label: "Rejected" },
  NOT_SUBMITTED: { color: "#64748b", icon: FiShield, label: "Not submitted" },
};

export default function KYCPage() {
  const toast = useToast();
  const { user, fetchUser } = useAuthStore();
  const tok = useDashboardTokens();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [files, setFiles] = useState<Record<DocType, File | null>>({
    selfie: null, id_front: null, id_back: null,
  });
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await userAPI.getKYCStatus();
        setDocs(res.data.documents || []);
      } catch {} finally {
        setFetching(false);
      }
    })();
  }, []);

  const setFile = (type: DocType, file: File | null) =>
    setFiles((prev) => ({ ...prev, [type]: file }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.selfie || !files.id_front) {
      return toast({ title: "Selfie and ID front are required", status: "warning", duration: 3000 });
    }
    setLoading(true);
    try {
      for (const [type, file] of Object.entries(files)) {
        if (!file) continue;
        const formData = new FormData();
        formData.append("document", file);
        formData.append("type", type.toUpperCase());
        formData.append("documentType", type);
        await userAPI.submitKYC(formData);
      }
      toast({
        title: "Documents submitted",
        description: "Review takes up to 24h. You'll get a notification.",
        status: "success",
        duration: 4500,
      });
      setFiles({ selfie: null, id_front: null, id_back: null });
      fetchUser();
      const res = await userAPI.getKYCStatus();
      setDocs(res.data.documents || []);
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Upload failed", status: "error", duration: 3500 });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <PageShell><PageSpinner /></PageShell>;

  const status = STATUS_META[user?.kycStatus || "NOT_SUBMITTED"] || STATUS_META.NOT_SUBMITTED;
  const isVerified = user?.kycStatus === "APPROVED";
  const showForm = user?.kycStatus === "NOT_SUBMITTED" || user?.kycStatus === "REJECTED";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Identity"
        title="KYC verification"
        subtitle="Verify your identity to unlock withdrawals, P2P and higher limits."
        right={
          <HStack
            spacing={1.5}
            px={3}
            py={1.5}
            borderRadius="8px"
            bg={`${status.color}18`}
            border="1px solid"
            borderColor={`${status.color}33`}
          >
            <Icon as={status.icon} color={status.color} boxSize={3.5} />
            <Text fontSize="11px" fontWeight="900" color={status.color} letterSpacing=".06em">
              {status.label.toUpperCase()}
            </Text>
          </HStack>
        }
      />

      {/* AML banner */}
      <Box
        p={4}
        mb={4}
        borderRadius="14px"
        bg={`${tok.brand}0a`}
        border="1px solid"
        borderColor={`${tok.brand}2a`}
      >
        <Flex gap={3} align="flex-start">
          <Flex w="34px" h="34px" borderRadius="10px" bg={`${tok.brand}18`} color={tok.brand} align="center" justify="center" flexShrink={0}>
            <Icon as={FiInfo} boxSize={4} />
          </Flex>
          <Box>
            <Text fontSize="13px" fontWeight="900" color={tok.textMain} mb={1}>
              Anti-money-laundering (AML) compliance
            </Text>
            <Text fontSize="12px" color={tok.textSub} lineHeight="1.6">
              fortuni is committed to preventing money laundering and terrorist financing. Unverified accounts are limited to{" "}
              <Text as="span" fontWeight="800" color={tok.textMain}>$500/day</Text>{" "}
              in transactions. All activity is monitored by automated compliance systems.
            </Text>
          </Box>
        </Flex>
      </Box>

      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1fr 340px" }} gap={4}>
        {/* ── Left: status / upload / submitted docs ── */}
        <VStack align="stretch" spacing={4}>
          {/* Status alert */}
          {user?.kycStatus === "REJECTED" && (
            <Alert color={tok.danger} icon={FiXCircle} title="Verification rejected" tok={tok}>
              Your documents were rejected. Re-submit clear, unobstructed images with visible name and photo.
            </Alert>
          )}
          {user?.kycStatus === "APPROVED" && (
            <Alert color={tok.success} icon={FiCheckCircle} title="Identity verified" tok={tok}>
              You have full access to all features: P2P and higher limits.
            </Alert>
          )}
          {user?.kycStatus === "PENDING" && (
            <Alert color={tok.warning} icon={FiClock} title="Under review" tok={tok}>
              Documents are being reviewed (1-24h). You'll get a notification once complete.
            </Alert>
          )}

          {/* Upload form */}
          {showForm && (
            <GlassCard p={5}>
              <SectionHeader title="Verify your identity" subtitle="Upload the following documents" />
              <form onSubmit={handleSubmit}>
                <VStack align="stretch" spacing={3} mt={3}>
                  {(Object.keys(DOC_CONFIG) as DocType[]).map((type) => {
                    const cfg = DOC_CONFIG[type];
                    const file = files[type];
                    return (
                      <Box
                        key={type}
                        p={4}
                        bg={tok.panelInner}
                        borderRadius="12px"
                        border="1px solid"
                        borderColor={file ? `${tok.brand}66` : tok.panelBorder}
                        transition="border-color 0.15s"
                      >
                        <Flex gap={3} align="flex-start" mb={3}>
                          <Flex
                            w="36px"
                            h="36px"
                            borderRadius="10px"
                            bg={`${tok.brand}18`}
                            color={tok.brand}
                            align="center"
                            justify="center"
                            flexShrink={0}
                          >
                            <Icon as={cfg.icon} boxSize={4} />
                          </Flex>
                          <Box>
                            <HStack spacing={1.5}>
                              <Text fontSize="13px" fontWeight="800" color={tok.textMain}>
                                {cfg.label}
                              </Text>
                              {cfg.required && (
                                <Text fontSize="10.5px" color={tok.danger} fontWeight="900">*</Text>
                              )}
                            </HStack>
                            <Text fontSize="11px" color={tok.textMuted} mt={0.5}>
                              {cfg.description}
                            </Text>
                          </Box>
                        </Flex>
                        <Input
                          type="file"
                          accept={cfg.accept}
                          onChange={(e) => setFile(type, e.target.files?.[0] || null)}
                          p={1}
                          bg={tok.panelBg}
                          border="1px solid"
                          borderColor={tok.panelBorder}
                          color={tok.textMain}
                          fontSize="12px"
                          borderRadius="9px"
                          h="40px"
                          _hover={{ borderColor: `${tok.brand}66` }}
                          sx={{
                            "::file-selector-button": {
                              bg: "transparent",
                              border: "none",
                              color: tok.textSub,
                              mr: 2,
                              fontSize: "12px",
                              fontWeight: 700,
                            },
                          }}
                        />
                        {file && (
                          <HStack spacing={1.5} mt={2}>
                            <Icon as={FiCheckCircle} color={tok.success} boxSize={3} />
                            <Text fontSize="11px" color={tok.success} fontWeight="800" noOfLines={1}>
                              {file.name} · {(file.size / 1024).toFixed(0)} KB
                            </Text>
                          </HStack>
                        )}
                      </Box>
                    );
                  })}

                  <Box
                    p={3}
                    borderRadius="10px"
                    bg="rgba(245,158,11,0.08)"
                    border="1px solid"
                    borderColor="rgba(245,158,11,0.25)"
                  >
                    <HStack spacing={2} align="flex-start">
                      <Icon as={FiAlertTriangle} color={tok.warning} boxSize={3.5} mt={0.5} />
                      <Text fontSize="11px" color={tok.textSub} lineHeight="1.55">
                        Make sure all documents are clearly visible, not blurry, and match the name on your account.
                      </Text>
                    </HStack>
                  </Box>

                  <Button
                    type="submit"
                    isLoading={loading}
                    isDisabled={!files.selfie || !files.id_front}
                    h="48px"
                    bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
                    color="white"
                    fontSize="14px"
                    fontWeight="900"
                    borderRadius="12px"
                    leftIcon={<FiUpload />}
                    _hover={{ transform: "translateY(-1px)", boxShadow: `0 10px 28px ${tok.brand}55` }}
                    _disabled={{ opacity: 0.5, cursor: "not-allowed", _hover: {} }}
                    transition="all 0.2s"
                  >
                    Submit for verification
                  </Button>
                </VStack>
              </form>
            </GlassCard>
          )}

          {/* Submitted documents */}
          {docs.length > 0 && (
            <GlassCard p={0}>
              <Box px={5} pt={4}>
                <SectionHeader title="Submitted documents" subtitle="Status of each file you uploaded" />
              </Box>
              <VStack
                align="stretch"
                spacing={0}
                mt={3}
                borderTop="1px solid"
                borderColor={tok.panelBorder}
                sx={{ "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder } }}
              >
                {docs.map((doc: any, i: number) => {
                  const s = doc.status === "VERIFIED" || doc.status === "APPROVED"
                    ? { color: tok.success, label: "Verified" }
                    : doc.status === "REJECTED"
                      ? { color: tok.danger, label: "Rejected" }
                      : { color: tok.warning, label: "Pending" };
                  return (
                    <Flex key={i} px={5} py={3} justify="space-between" align="center">
                      <HStack spacing={3}>
                        <Box w="8px" h="8px" borderRadius="full" bg={s.color} boxShadow={`0 0 8px ${s.color}cc`} />
                        <Box>
                          <Text fontSize="12.5px" fontWeight="800" color={tok.textMain}>
                            {doc.documentType || doc.type}
                          </Text>
                          <Text fontSize="10.5px" color={tok.textMuted}>
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </Text>
                        </Box>
                      </HStack>
                      <Box px={2} py={0.5} borderRadius="5px" bg={`${s.color}18`}>
                        <Text fontSize="9.5px" fontWeight="900" color={s.color} letterSpacing=".06em">
                          {s.label.toUpperCase()}
                        </Text>
                      </Box>
                    </Flex>
                  );
                })}
              </VStack>
            </GlassCard>
          )}
        </VStack>

        {/* ── Right: feature matrix + limits ── */}
        <VStack align="stretch" spacing={4}>
          <GlassCard p={5}>
            <SectionHeader title="Feature access" subtitle="Unlocked with verification" />
            <VStack align="stretch" spacing={1.5} mt={3}>
              {FEATURES.map((f) => (
                <Flex
                  key={f}
                  align="center"
                  gap={2.5}
                  p={2.5}
                  borderRadius="9px"
                  bg={tok.panelInner}
                >
                  <Icon
                    as={isVerified ? FiUnlock : FiLock}
                    color={isVerified ? tok.success : tok.textMuted}
                    boxSize={3.5}
                  />
                  <Text fontSize="12px" fontWeight="700" color={isVerified ? tok.textMain : tok.textSub}>
                    {f}
                  </Text>
                  {isVerified && <Icon as={FiCheckCircle} color={tok.success} boxSize={3.5} ml="auto" />}
                </Flex>
              ))}
            </VStack>
          </GlassCard>

          <GlassCard p={5}>
            <SectionHeader title="Daily limits" subtitle="Based on verification level" />
            <VStack align="stretch" spacing={3} mt={3}>
              <LimitCard
                label="Unverified"
                value="$500"
                unit="/day"
                active={!isVerified}
                tok={tok}
              />
              <LimitCard
                label="Verified"
                value="$50,000"
                unit="/day"
                active={isVerified}
                tok={tok}
              />
            </VStack>
          </GlassCard>
        </VStack>
      </Box>
    </PageShell>
  );
}

/* helpers */

function Alert({
  color, icon, title, children, tok,
}: { color: string; icon: any; title: string; children: React.ReactNode; tok: any }) {
  return (
    <Box
      p={4}
      borderRadius="12px"
      bg={`${color}12`}
      border="1px solid"
      borderColor={`${color}33`}
    >
      <Flex gap={3} align="flex-start">
        <Icon as={icon} color={color} boxSize={4} mt={0.5} />
        <Box>
          <Text fontSize="13px" fontWeight="900" color={color} mb={0.5}>{title}</Text>
          <Text fontSize="12px" color={tok.textSub} lineHeight="1.55">{children}</Text>
        </Box>
      </Flex>
    </Box>
  );
}

function LimitCard({ label, value, unit, active, tok }: { label: string; value: string; unit: string; active: boolean; tok: any }) {
  return (
    <Box
      p={3.5}
      borderRadius="12px"
      bg={active ? `${tok.brand}0a` : tok.panelInner}
      border="1px solid"
      borderColor={active ? `${tok.brand}33` : tok.panelBorder}
    >
      <Text fontSize="10px" color={tok.textMuted} fontWeight="800" letterSpacing=".12em" textTransform="uppercase" mb={1}>
        {label}
      </Text>
      <Text fontSize="22px" fontWeight="900" color={active ? tok.brand : tok.textSub} letterSpacing="-0.02em" fontFamily="'DM Mono', monospace" lineHeight="1">
        {value}
        <Text as="span" fontSize="11px" fontWeight="700" color={tok.textMuted} ml={1}>
          {unit}
        </Text>
      </Text>
    </Box>
  );
}
