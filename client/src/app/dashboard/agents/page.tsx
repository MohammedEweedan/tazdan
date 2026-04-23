"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Box, Flex, Text, Button, VStack, HStack, Input, InputGroup, InputLeftElement, Icon,
  useToast, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, FormControl, FormLabel, Textarea,
} from "@chakra-ui/react";
import {
  FiSearch, FiMapPin, FiPhone, FiArrowDownLeft, FiArrowUpRight, FiInbox, FiUsers,
} from "react-icons/fi";
import { agentAPI } from "@/lib/api";
import dynamic from "next/dynamic";
import {
  PageShell, PageHeader, GlassCard,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

const AgentMap = dynamic(() => import("@/components/ui/AgentMap"), {
  ssr: false,
  loading: () => <Box h="280px" borderRadius="16px" bg="rgba(0,87,184,0.08)" />,
});

export default function AgentsPage() {
  const toast = useToast();
  const tok = useDashboardTokens();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [agents, setAgents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<any>(null);
  const [mode, setMode] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    agentAPI
      .getNearby()
      .then((res: any) => setAgents(res.data.agents || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter((a: any) =>
    (`${a.name || ""} ${a.city || ""} ${a.region || ""}`).toLowerCase().includes(search.toLowerCase())
  );

  const openModal = (agent: any, m: "DEPOSIT" | "WITHDRAWAL") => {
    setSelected(agent);
    setMode(m);
    setAmount("");
    setNote("");
    onOpen();
  };

  const submit = async () => {
    if (!selected || !parseFloat(amount)) return;
    setSubmitting(true);
    try {
      if (mode === "DEPOSIT") {
        await agentAPI.requestDeposit({ agentId: selected.id, amount: parseFloat(amount), currency: "USDT", notes: note });
      } else {
        await agentAPI.requestWithdrawal({ agentId: selected.id, amount: parseFloat(amount), currency: "USDT", notes: note });
      }
      toast({ title: "Request sent", description: `${mode === "DEPOSIT" ? "Deposit" : "Withdrawal"} request created`, status: "success", duration: 3000 });
      onClose();
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Request failed", status: "error", duration: 4000 });
    } finally {
      setSubmitting(false);
    }
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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Cash on ramp"
        title="Local agents"
        subtitle="Deposit or withdraw cash with a verified Promrkts agent near you."
        right={
          <Button
            as={NextLink}
            href="/dashboard/agents/history"
            size="sm"
            h="36px"
            px={3}
            variant="ghost"
            color={tok.textSub}
            _hover={{ color: tok.textMain, bg: tok.hover }}
            fontWeight="700"
          >
            My requests
          </Button>
        }
      />

      {/* Map */}
      <GlassCard p={0} mb={4}>
        <Box borderRadius="16px" overflow="hidden">
          <AgentMap />
        </Box>
      </GlassCard>

      {/* Search */}
      <GlassCard p={3} mb={3}>
        <InputGroup>
          <InputLeftElement pointerEvents="none" h="44px">
            <Icon as={FiSearch} color={tok.textMuted} />
          </InputLeftElement>
          <Input placeholder="Search by name, city or region…" value={search} onChange={(e) => setSearch(e.target.value)} {...input} pl={10} />
        </InputGroup>
      </GlassCard>

      <Flex justify="space-between" align="center" mb={3}>
        <HStack spacing={2}>
          <Icon as={FiUsers} color={tok.brand} boxSize={4} />
          <Text fontSize="12px" fontWeight="800" color={tok.textMain} letterSpacing=".04em">
            {filtered.length} {filtered.length === 1 ? "agent" : "agents"} available
          </Text>
        </HStack>
      </Flex>

      {filtered.length === 0 ? (
        <GlassCard p={0}>
          <EmptyState icon={FiInbox} title="No agents found" hint="Try a different search or check back later." />
        </GlassCard>
      ) : (
        <VStack align="stretch" spacing={2}>
          {filtered.map((a: any) => (
            <GlassCard key={a.id} p={4}>
              <Flex justify="space-between" align="flex-start" flexWrap="wrap" gap={3} mb={3}>
                <Box>
                  <HStack spacing={2} mb={1}>
                    <Text fontSize="14px" fontWeight="900" color={tok.textMain}>{a.name}</Text>
                    <Box px={1.5} py={0.5} borderRadius="4px" bg={`${tok.success}18`}>
                      <Text fontSize="9.5px" fontWeight="900" color={tok.success} letterSpacing=".06em">ACTIVE</Text>
                    </Box>
                  </HStack>
                  <HStack spacing={3} flexWrap="wrap">
                    <HStack spacing={1.5}>
                      <Icon as={FiMapPin} color={tok.textMuted} boxSize={3} />
                      <Text fontSize="11.5px" color={tok.textSub}>{[a.city, a.region].filter(Boolean).join(", ") || "—"}</Text>
                    </HStack>
                    {a.phone && (
                      <HStack spacing={1.5}>
                        <Icon as={FiPhone} color={tok.textMuted} boxSize={3} />
                        <Text fontSize="11.5px" color={tok.textSub} fontFamily="monospace">{a.phone}</Text>
                      </HStack>
                    )}
                  </HStack>
                </Box>
              </Flex>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  h="36px"
                  flex={1}
                  bg={`linear-gradient(135deg, ${tok.success}, #15803d)`}
                  color="white"
                  fontWeight="800"
                  borderRadius="10px"
                  leftIcon={<FiArrowDownLeft />}
                  onClick={() => openModal(a, "DEPOSIT")}
                  _hover={{ transform: "translateY(-1px)", boxShadow: `0 6px 16px ${tok.success}44` }}
                  transition="all 0.15s"
                >
                  Deposit
                </Button>
                <Button
                  size="sm"
                  h="36px"
                  flex={1}
                  variant="outline"
                  color={tok.danger}
                  borderColor="rgba(239,68,68,0.3)"
                  fontWeight="800"
                  borderRadius="10px"
                  leftIcon={<FiArrowUpRight />}
                  onClick={() => openModal(a, "WITHDRAWAL")}
                  _hover={{ bg: "rgba(239,68,68,0.08)", borderColor: tok.danger }}
                >
                  Withdraw
                </Button>
              </HStack>
            </GlassCard>
          ))}
        </VStack>
      )}

      {/* Request modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
        <ModalOverlay bg="rgba(0,0,0,0.7)" backdropFilter="blur(8px)" />
        <ModalContent bg={tok.panelBg} border="1px solid" borderColor={tok.panelBorder} borderRadius="16px" color={tok.textMain}>
          <ModalHeader fontSize="15px" fontWeight="900" borderBottom="1px solid" borderColor={tok.panelBorder} pb={3}>
            {mode === "DEPOSIT" ? "Deposit via" : "Withdraw via"} {selected?.name}
          </ModalHeader>
          <ModalCloseButton color={tok.textMuted} />
          <ModalBody py={5}>
            <Box
              p={3}
              mb={4}
              bg={`${tok.brand}0a`}
              border="1px solid"
              borderColor={`${tok.brand}2a`}
              borderRadius="10px"
            >
              <Text fontSize="11.5px" color={tok.textSub} lineHeight="1.55">
                {mode === "DEPOSIT"
                  ? "Hand over the cash to this agent. They will credit your account once received."
                  : "The agent will pay you in cash after confirming the withdrawal on their end."}
              </Text>
            </Box>

            <VStack align="stretch" spacing={3}>
              <FormControl isRequired>
                <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">
                  Amount (USDT)
                </FormLabel>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" {...input} />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="10.5px" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" fontWeight="800">
                  Note (optional)
                </FormLabel>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  bg={tok.panelInner}
                  border="1px solid"
                  borderColor={tok.panelBorder}
                  color={tok.textMain}
                  fontSize="13px"
                  borderRadius="10px"
                  _focus={{ borderColor: tok.brand, boxShadow: `0 0 0 1px ${tok.brand}` }}
                  _placeholder={{ color: tok.textMuted }}
                />
              </FormControl>

              <Button
                w="100%"
                h="48px"
                bg={mode === "DEPOSIT"
                  ? `linear-gradient(135deg, ${tok.success}, #15803d)`
                  : `linear-gradient(135deg, ${tok.danger}, #b91c1c)`}
                color="white"
                fontWeight="900"
                fontSize="14px"
                borderRadius="12px"
                isLoading={submitting}
                isDisabled={!parseFloat(amount)}
                onClick={submit}
                _hover={{ transform: "translateY(-1px)" }}
                _disabled={{ opacity: 0.5, cursor: "not-allowed", _hover: {} }}
                transition="all 0.2s"
              >
                {mode === "DEPOSIT" ? "Request deposit" : "Request withdrawal"}
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </PageShell>
  );
}
