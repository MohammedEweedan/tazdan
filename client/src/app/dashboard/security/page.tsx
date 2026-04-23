"use client";

import { useEffect, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, Input, Image, useToast,
} from "@chakra-ui/react";
import {
  FiShield, FiSmartphone, FiMonitor, FiKey, FiCheckCircle, FiXCircle,
  FiAlertTriangle, FiTrash2, FiClock, FiMail,
} from "react-icons/fi";
import { authAPI, securityAPI } from "@/lib/api";
import {
  PageShell, PageHeader, GlassCard,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

export default function SecurityPage() {
  const toast = useToast();
  const tok = useDashboardTokens();

  const [overview, setOverview] = useState<any>({});
  const [sessions, setSessions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [setup2FA, setSetup2FA] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [code2FA, setCode2FA] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [o, s, h] = await Promise.all([
        securityAPI.getOverview(),
        securityAPI.getSessions(),
        securityAPI.getLoginHistory(),
      ]);
      setOverview(o.data || {});
      setSessions(s.data.sessions || []);
      setHistory(h.data.history || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const enable2FA = async () => {
    setBusy(true);
    try {
      const r = await authAPI.enable2FA();
      setQrData(r.data);
      setSetup2FA(true);
    } catch (e: any) {
      toast({ title: "Failed to start 2FA setup", description: e?.response?.data?.error || "Try again", status: "error", duration: 3000 });
    } finally { setBusy(false); }
  };

  const verify2FA = async () => {
    setBusy(true);
    try {
      await authAPI.verify2FA(code2FA);
      toast({ title: "2FA enabled", status: "success", duration: 3000 });
      setSetup2FA(false); setQrData(null); setCode2FA("");
      await load();
    } catch (e: any) {
      toast({ title: "Verification failed", description: e?.response?.data?.error || "Wrong code", status: "error", duration: 3000 });
    } finally { setBusy(false); }
  };

  const disable2FA = async () => {
    setBusy(true);
    try {
      await authAPI.disable2FA(disableCode);
      toast({ title: "2FA disabled", status: "info", duration: 3000 });
      setShowDisable(false); setDisableCode("");
      await load();
    } catch (e: any) {
      toast({ title: "Failed to disable", description: e?.response?.data?.error || "Wrong code", status: "error", duration: 3000 });
    } finally { setBusy(false); }
  };

  const revokeSession = async (id: string) => {
    await securityAPI.revokeSession(id).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Session revoked", status: "info", duration: 2000 });
  };

  const revokeAll = async () => {
    await securityAPI.revokeAllSessions().catch(() => {});
    toast({ title: "All other sessions revoked", status: "info", duration: 2500 });
    await load();
  };

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  const o = overview || {};
  const score = Number(o.securityScore || 0);
  const scoreColor = score >= 80 ? tok.success : score >= 50 ? tok.warning : tok.danger;

  const checks = [
    { label: "2FA", ok: !!o.twoFactorEnabled, icon: FiKey },
    { label: "Email", ok: !!o.emailVerified, icon: FiMail },
    { label: "Phone", ok: !!o.phoneVerified, icon: FiSmartphone },
    { label: "KYC", ok: o.kycStatus === "APPROVED", icon: FiShield },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Account"
        title="Security"
        subtitle="Two-factor authentication, active sessions and login history."
      />

      {/* Score hero */}
      <GlassCard p={5} mb={4}>
        <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} direction={{ base: "column", md: "row" }} gap={4}>
          <Box>
            <Text fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">
              Security score
            </Text>
            <HStack spacing={3} mt={1}>
              <Text fontSize="40px" fontWeight="900" color={scoreColor} letterSpacing="-0.02em" lineHeight="1">
                {score}
              </Text>
              <Box>
                <Text fontSize="12px" color={tok.textSub} fontWeight="800">/ 100</Text>
                <Text fontSize="11px" color={tok.textMuted} mt={1}>
                  {score >= 80 ? "Strong" : score >= 50 ? "Fair · improve below" : "At risk · finish the steps"}
                </Text>
              </Box>
            </HStack>
            <Box mt={3} w={{ base: "260px", md: "320px" }} h="6px" bg={tok.panelInner} borderRadius="full" overflow="hidden">
              <Box h="100%" w={`${Math.max(0, Math.min(100, score))}%`} bg={`linear-gradient(90deg, ${scoreColor}, ${scoreColor}cc)`} transition="width 0.4s" />
            </Box>
          </Box>

          <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={2} w={{ base: "100%", md: "auto" }}>
            {checks.map((c) => (
              <HStack
                key={c.label}
                spacing={2}
                px={3}
                py={2}
                borderRadius="10px"
                bg={c.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"}
                border="1px solid"
                borderColor={c.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}
              >
                <Icon as={c.ok ? FiCheckCircle : FiXCircle} color={c.ok ? tok.success : tok.danger} boxSize={3.5} />
                <Text fontSize="11.5px" fontWeight="800" color={tok.textMain}>{c.label}</Text>
                <Text fontSize="10.5px" color={tok.textMuted} ml="auto">{c.ok ? "OK" : "Off"}</Text>
              </HStack>
            ))}
          </Box>
        </Flex>
      </GlassCard>

      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4} mb={4}>
        {/* ── 2FA ── */}
        <GlassCard p={5}>
          <Flex justify="space-between" align="center" mb={3}>
            <HStack spacing={2.5}>
              <Flex w="38px" h="38px" borderRadius="10px" bg={`${tok.brand}18`} color={tok.brand} align="center" justify="center">
                <Icon as={FiKey} boxSize={4} />
              </Flex>
              <Box>
                <Text fontSize="13px" fontWeight="900" color={tok.textMain}>Two-factor auth</Text>
                <Text fontSize="11px" color={tok.textMuted}>Extra code from your authenticator app</Text>
              </Box>
            </HStack>
            <Box
              px={2}
              py={0.5}
              borderRadius="5px"
              bg={o.twoFactorEnabled ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)"}
            >
              <Text fontSize="10px" fontWeight="900" color={o.twoFactorEnabled ? tok.success : tok.danger} letterSpacing=".06em">
                {o.twoFactorEnabled ? "ENABLED" : "DISABLED"}
              </Text>
            </Box>
          </Flex>

          {!o.twoFactorEnabled && !setup2FA && (
            <Button
              h="40px"
              w="100%"
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              fontWeight="800"
              fontSize="12.5px"
              borderRadius="10px"
              isLoading={busy}
              onClick={enable2FA}
              leftIcon={<FiKey />}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
              transition="all 0.2s"
            >
              Enable 2FA
            </Button>
          )}

          {setup2FA && qrData && (
            <VStack spacing={3} align="stretch">
              <Text fontSize="12px" color={tok.textSub}>
                Scan this QR with Google Authenticator, Authy, or any TOTP app:
              </Text>
              <Flex justify="center" p={3} bg="white" borderRadius="12px" border="1px solid" borderColor={tok.panelBorder}>
                <Image src={qrData.qrCode} alt="2FA QR" w="180px" h="180px" borderRadius="8px" />
              </Flex>
              <Text fontSize="10.5px" color={tok.textMuted} fontFamily="monospace" wordBreak="break-all">
                Secret: {qrData.secret}
              </Text>
              <HStack>
                <Input
                  size="sm"
                  placeholder="6-digit code"
                  value={code2FA}
                  onChange={(e) => setCode2FA(e.target.value)}
                  bg={tok.panelInner}
                  border="1px solid"
                  borderColor={tok.panelBorder}
                  color={tok.textMain}
                  borderRadius="10px"
                  h="40px"
                  _focus={{ borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` }}
                />
                <Button
                  size="sm"
                  h="40px"
                  bg={`linear-gradient(135deg, ${tok.success}, #15803d)`}
                  color="white"
                  fontWeight="800"
                  isDisabled={code2FA.length !== 6}
                  isLoading={busy}
                  onClick={verify2FA}
                  borderRadius="10px"
                >
                  Verify
                </Button>
              </HStack>
            </VStack>
          )}

          {o.twoFactorEnabled && !showDisable && (
            <Button
              variant="outline"
              h="40px"
              w="100%"
              color={tok.danger}
              borderColor="rgba(239,68,68,0.3)"
              fontWeight="800"
              fontSize="12.5px"
              borderRadius="10px"
              onClick={() => setShowDisable(true)}
              _hover={{ bg: "rgba(239,68,68,0.08)", borderColor: tok.danger }}
            >
              Disable 2FA
            </Button>
          )}

          {showDisable && (
            <HStack>
              <Input
                size="sm"
                placeholder="Enter 2FA code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                bg={tok.panelInner}
                border="1px solid"
                borderColor={tok.panelBorder}
                color={tok.textMain}
                borderRadius="10px"
                h="40px"
                _focus={{ borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` }}
              />
              <Button
                size="sm"
                h="40px"
                bg={`linear-gradient(135deg, ${tok.danger}, #b91c1c)`}
                color="white"
                fontWeight="800"
                isDisabled={disableCode.length !== 6}
                isLoading={busy}
                onClick={disable2FA}
                borderRadius="10px"
              >
                Disable
              </Button>
              <Button size="sm" h="40px" variant="ghost" color={tok.textSub} onClick={() => setShowDisable(false)}>
                Cancel
              </Button>
            </HStack>
          )}
        </GlassCard>

        {/* ── Sessions ── */}
        <GlassCard p={5}>
          <Flex justify="space-between" align="center" mb={3}>
            <HStack spacing={2.5}>
              <Flex w="38px" h="38px" borderRadius="10px" bg={`${tok.brand}18`} color={tok.brand} align="center" justify="center">
                <Icon as={FiMonitor} boxSize={4} />
              </Flex>
              <Box>
                <Text fontSize="13px" fontWeight="900" color={tok.textMain}>
                  Active sessions ({sessions.length})
                </Text>
                <Text fontSize="11px" color={tok.textMuted}>Where your account is currently signed in</Text>
              </Box>
            </HStack>
            {sessions.length > 1 && (
              <Button size="xs" variant="ghost" color={tok.danger} fontWeight="800" _hover={{ bg: "rgba(239,68,68,0.1)" }} onClick={revokeAll}>
                Revoke others
              </Button>
            )}
          </Flex>

          {sessions.length === 0 ? (
            <EmptyState icon={FiMonitor} title="No active sessions" />
          ) : (
            <VStack align="stretch" spacing={2}>
              {sessions.map((s: any, i: number) => (
                <Flex
                  key={s.id}
                  p={3}
                  borderRadius="10px"
                  bg={tok.panelInner}
                  border="1px solid"
                  borderColor={tok.panelBorder}
                  justify="space-between"
                  align="center"
                >
                  <Box minW={0}>
                    <HStack spacing={2}>
                      <Text fontSize="12.5px" fontWeight="800" color={tok.textMain} noOfLines={1}>
                        {s.userAgent?.slice(0, 48) || "Unknown device"}
                      </Text>
                      {i === 0 && (
                        <Box px={1.5} py={0.5} borderRadius="4px" bg={`${tok.success}22`}>
                          <Text fontSize="9.5px" color={tok.success} fontWeight="900" letterSpacing=".06em">
                            THIS DEVICE
                          </Text>
                        </Box>
                      )}
                    </HStack>
                    <Text fontSize="10.5px" color={tok.textMuted} mt={0.5} fontFamily="monospace" noOfLines={1}>
                      IP {s.ipAddress || "—"} · {new Date(s.createdAt).toLocaleString()}
                    </Text>
                  </Box>
                  {i > 0 && (
                    <Button size="xs" variant="ghost" color={tok.danger} _hover={{ bg: "rgba(239,68,68,0.1)" }} onClick={() => revokeSession(s.id)}>
                      <Icon as={FiTrash2} boxSize={3.5} />
                    </Button>
                  )}
                </Flex>
              ))}
            </VStack>
          )}
        </GlassCard>
      </Box>

      {/* ── Login history ── */}
      <GlassCard p={0}>
        <Box px={5} pt={4} pb={3}>
          <HStack spacing={2.5}>
            <Flex w="32px" h="32px" borderRadius="10px" bg={`${tok.brand}18`} color={tok.brand} align="center" justify="center">
              <Icon as={FiClock} boxSize={4} />
            </Flex>
            <Box>
              <Text fontSize="13px" fontWeight="900" color={tok.textMain}>Login history</Text>
              <Text fontSize="11px" color={tok.textMuted}>Recent sign-in attempts</Text>
            </Box>
          </HStack>
        </Box>

        {history.length === 0 ? (
          <EmptyState icon={FiClock} title="No login history" />
        ) : (
          <VStack
            align="stretch"
            spacing={0}
            borderTop="1px solid"
            borderColor={tok.panelBorder}
            sx={{ "& > *:not(:last-child)": { borderBottom: "1px solid", borderColor: tok.panelBorder } }}
          >
            {history.slice(0, 20).map((h: any, i: number) => (
              <Flex key={i} px={5} py={3} justify="space-between" align="center" _hover={{ bg: tok.hover }} transition="background 0.15s">
                <HStack spacing={3}>
                  <Icon as={h.success ? FiCheckCircle : FiAlertTriangle} color={h.success ? tok.success : tok.danger} boxSize={4} />
                  <Box>
                    <Text fontSize="12.5px" fontWeight="800" color={tok.textMain}>
                      {h.device || "Unknown device"} · <Text as="span" fontFamily="monospace" color={tok.textSub}>{h.ipAddress || "—"}</Text>
                    </Text>
                    <Text fontSize="10.5px" color={tok.textMuted}>{new Date(h.createdAt).toLocaleString()}</Text>
                  </Box>
                </HStack>
                <Box px={2} py={0.5} borderRadius="5px" bg={h.success ? `${tok.success}18` : `${tok.danger}18`}>
                  <Text fontSize="9.5px" fontWeight="900" color={h.success ? tok.success : tok.danger} letterSpacing=".06em">
                    {h.success ? "SUCCESS" : "FAILED"}
                  </Text>
                </Box>
              </Flex>
            ))}
          </VStack>
        )}
      </GlassCard>
    </PageShell>
  );
}
