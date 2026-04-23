"use client";

import { useState, useEffect } from "react";
import {
  Box, Flex, Text, Heading, VStack, HStack, SimpleGrid, Badge, Button,
  Icon, useColorMode, Select, Textarea, Input,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiAlertTriangle, FiShield, FiUser, FiCheck, FiX,
  FiAlertCircle, FiClock, FiLock,
} from "react-icons/fi";
import { adminAPI } from "@/lib/api";

const severityColors: Record<string, string> = {
  LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444", CRITICAL: "#dc2626",
};
const statusColors: Record<string, string> = {
  OPEN: "red", REVIEWING: "yellow", CLEARED: "green", ESCALATED: "purple", FROZEN: "gray",
};

export default function AMLDashboard() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dk = colorMode === "dark";
  const brand = "#0057b8";
  const cardBg = dk ? "rgba(255,255,255,0.02)" : "white";
  const border = dk ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.08)";
  const textMain = dk ? "white" : "#0f172a";
  const textSub = dk ? "#94a3b8" : "#64748b";

  const [flags, setFlags] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolveStatus, setResolveStatus] = useState("CLEARED");

  const load = (p = 1) => {
    setLoading(true);
    adminAPI.getAMLFlags(p, filterStatus || undefined, filterSeverity || undefined)
      .then((r) => {
        setFlags(r.data.flags || []);
        setSummary(r.data.summary || {});
        setPages(r.data.pages || 1);
        setPage(p);
      }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus, filterSeverity]);

  const resolve = async (id: string) => {
    try {
      await adminAPI.resolveAMLFlag(id, { status: resolveStatus, resolution });
      setResolving(null);
      setResolution("");
      load(page);
    } catch {}
  };

  return (
    <Box p={{ base: 4, lg: 8 }} maxW="1200px" mx="auto">
      <Heading size="lg" mb={1} color={textMain} fontWeight="900">AML Compliance</Heading>
      <Text fontSize="14px" color={textSub} mb={8}>Review and resolve flagged transactions</Text>

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
        {[
          { label: "Open Flags", value: summary.open || 0, icon: FiAlertCircle, color: "#ef4444" },
          { label: "Under Review", value: summary.reviewing || 0, icon: FiClock, color: "#f59e0b" },
          { label: "Escalated", value: summary.escalated || 0, icon: FiAlertTriangle, color: "#8b5cf6" },
          { label: "Critical", value: summary.critical || 0, icon: FiShield, color: "#dc2626" },
        ].map((s, i) => (
          <Box key={i} bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={4}>
            <Flex align="center" justify="space-between" mb={2}>
              <Icon as={s.icon} color={s.color} boxSize={5} />
              <Text fontSize="9px" fontWeight="700" color={textSub} textTransform="uppercase">{s.label}</Text>
            </Flex>
            <Text fontSize="22px" fontWeight="900" color={textMain}>{s.value}</Text>
          </Box>
        ))}
      </SimpleGrid>

      {/* Filters */}
      <Flex gap={3} mb={6} flexWrap="wrap">
        <Select size="sm" w="160px" placeholder="All statuses" value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)} borderRadius="8px" border="1px solid" borderColor={border}>
          <option value="OPEN">Open</option>
          <option value="REVIEWING">Reviewing</option>
          <option value="ESCALATED">Escalated</option>
          <option value="CLEARED">Cleared</option>
          <option value="FROZEN">Frozen</option>
        </Select>
        <Select size="sm" w="160px" placeholder="All severities" value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)} borderRadius="8px" border="1px solid" borderColor={border}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </Select>
      </Flex>

      {/* Flags List */}
      <VStack spacing={3} align="stretch">
        {flags.map((f) => (
          <Box key={f.id} bg={cardBg} border="1px solid"
            borderColor={f.severity === "CRITICAL" ? "#dc262644" : border}
            borderRadius="12px" p={5}>
            <Flex justify="space-between" align="start" mb={3} flexWrap="wrap" gap={2}>
              <HStack>
                <Box w="10px" h="10px" borderRadius="full" bg={severityColors[f.severity] || textSub} />
                <Text fontSize="13px" fontWeight="700" color={textMain}>{f.type.replace(/_/g, " ")}</Text>
                <Badge colorScheme={statusColors[f.status] || "gray"} variant="subtle" fontSize="9px" borderRadius="4px">
                  {f.status}
                </Badge>
                <Badge bg={severityColors[f.severity] + "22"} color={severityColors[f.severity]}
                  fontSize="9px" borderRadius="4px">{f.severity}</Badge>
              </HStack>
              <Text fontSize="10px" color={textSub}>{new Date(f.createdAt).toLocaleString()}</Text>
            </Flex>

            <Text fontSize="12px" color={textSub} mb={2}>{f.description}</Text>

            <Flex gap={4} mb={3} flexWrap="wrap">
              {f.user && (
                <HStack>
                  <Icon as={FiUser} color={textSub} boxSize={3} />
                  <Text fontSize="11px" color={textMain}>{f.user.firstName} {f.user.lastName} ({f.user.email})</Text>
                  <Badge colorScheme={f.user.kycStatus === "APPROVED" ? "green" : "gray"} variant="subtle" fontSize="8px">
                    KYC: {f.user.kycStatus}
                  </Badge>
                </HStack>
              )}
              {f.amount && (
                <Text fontSize="11px" color={textMain}>
                  Amount: <strong>{parseFloat(f.amount).toFixed(2)} {f.currency}</strong>
                </Text>
              )}
              {f.transactionRef && (
                <Text fontSize="11px" color={textSub} fontFamily="mono">Ref: {f.transactionRef}</Text>
              )}
            </Flex>

            {f.resolution && (
              <Box bg={dk ? "rgba(255,255,255,0.03)" : "#f8fafc"} p={3} borderRadius="8px" mb={3}>
                <Text fontSize="11px" color={textSub}>Resolution: {f.resolution}</Text>
              </Box>
            )}

            {(f.status === "OPEN" || f.status === "REVIEWING" || f.status === "ESCALATED") && (
              <>
                {resolving === f.id ? (
                  <VStack spacing={2} align="stretch">
                    <Flex gap={2}>
                      <Select size="sm" w="160px" value={resolveStatus} onChange={(e) => setResolveStatus(e.target.value)}
                        borderRadius="8px" border="1px solid" borderColor={border}>
                        <option value="CLEARED">Clear</option>
                        <option value="ESCALATED">Escalate</option>
                        <option value="FROZEN">Freeze Account</option>
                      </Select>
                    </Flex>
                    <Textarea size="sm" placeholder="Resolution notes..." value={resolution}
                      onChange={(e) => setResolution(e.target.value)} borderRadius="8px" border="1px solid"
                      borderColor={border} rows={2} fontSize="12px" />
                    <HStack>
                      <Button size="sm" bg={resolveStatus === "FROZEN" ? "#ef4444" : "#22c55e"} color="white"
                        fontWeight="700" fontSize="12px" borderRadius="8px" onClick={() => resolve(f.id)}
                        isDisabled={!resolution} _hover={{ opacity: 0.9 }}>
                        {resolveStatus === "CLEARED" ? "Clear Flag" : resolveStatus === "ESCALATED" ? "Escalate" : "Freeze Account"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setResolving(null)} fontSize="12px">Cancel</Button>
                    </HStack>
                  </VStack>
                ) : (
                  <Button size="sm" variant="outline" borderRadius="8px" fontSize="12px" fontWeight="700"
                    onClick={() => setResolving(f.id)}>
                    Review & Resolve
                  </Button>
                )}
              </>
            )}
          </Box>
        ))}
        {flags.length === 0 && !loading && (
          <Flex direction="column" align="center" py={12}>
            <Icon as={FiShield} boxSize={10} color={border} mb={3} />
            <Text fontSize="14px" color={textSub}>No AML flags found</Text>
          </Flex>
        )}
      </VStack>

      {pages > 1 && (
        <HStack justify="center" mt={6} spacing={2}>
          <Button size="sm" variant="outline" isDisabled={page <= 1} onClick={() => load(page - 1)}>Prev</Button>
          <Text fontSize="12px" color={textSub}>Page {page} of {pages}</Text>
          <Button size="sm" variant="outline" isDisabled={page >= pages} onClick={() => load(page + 1)}>Next</Button>
        </HStack>
      )}
    </Box>
  );
}
