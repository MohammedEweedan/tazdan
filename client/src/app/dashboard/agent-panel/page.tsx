"use client";

import { useEffect, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Icon, useToast,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiCheckCircle, FiXCircle, FiClock, FiDollarSign, FiTrendingUp,
  FiArrowDownCircle, FiArrowUpCircle, FiInbox,
} from "react-icons/fi";
import { agentAPI } from "@/lib/api";
import {
  PageShell, PageHeader, GlassCard, Tabs as InfoTabs, StatTile,
  PageSpinner, EmptyState, useDashboardTokens,
} from "@/components/dashboard/DashboardUI";

const STATUSES = ["PENDING", "COMPLETED", "REJECTED"] as const;

export default function AgentPanelPage() {
  const { t } = useTranslate();
  const toast = useToast();
  const tok = useDashboardTokens();

  const [stats, setStats] = useState<any>({});
  const [queue, setQueue] = useState<any[]>([]);
  const [tab, setTab] = useState<typeof STATUSES[number]>("PENDING");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (status: typeof STATUSES[number] = "PENDING") => {
    try {
      const [sRes, qRes]: any[] = await Promise.all([
        agentAPI.getStats().catch(() => ({ data: {} })),
        agentAPI.getQueue(status).catch(() => ({ data: { transactions: [] } })),
      ]);
      setStats(sRes.data || {});
      setQueue(qRes.data.transactions || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); /* eslint-disable-next-line */ }, []);

  const changeTab = (v: string) => {
    const next = v as typeof STATUSES[number];
    setTab(next);
    setLoading(true);
    load(next);
  };

  const confirmTxn = async (txn: any) => {
    setBusyId(txn.id);
    try {
      if (txn.type === "DEPOSIT") await agentAPI.confirmDeposit(txn.id);
      else await agentAPI.confirmWithdrawal(txn.id);
      toast({ title: "Confirmed", status: "success", duration: 2500 });
      await load(tab);
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Action failed", status: "error", duration: 3000 });
    } finally { setBusyId(null); }
  };

  const rejectTxn = async (txn: any) => {
    setBusyId(txn.id);
    try {
      await agentAPI.rejectTransaction(txn.id, "Rejected by agent");
      toast({ title: "Rejected", status: "info", duration: 2500 });
      await load(tab);
    } catch (e: any) {
      toast({ title: e?.response?.data?.error || "Action failed", status: "error", duration: 3000 });
    } finally { setBusyId(null); }
  };

  if (loading && queue.length === 0 && !stats?.pendingCount) {
    return <PageShell><PageSpinner /></PageShell>;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations"
        title="Agent queue"
        subtitle="Confirm or reject deposits and withdrawals submitted by users."
      />

      {/* KPIs */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,1fr)", md: "repeat(4,1fr)" }} gap={3} mb={4}>
        <StatTile label="Pending" value={String(stats?.pendingCount ?? 0)} hint="Awaiting action" icon={FiClock} accent={tok.warning} />
        <StatTile label="Completed today" value={String(stats?.completedToday ?? 0)} hint="Confirmed" icon={FiCheckCircle} accent={tok.success} />
        <StatTile label="Today's volume" value={`$${Number(stats?.todayVolume ?? 0).toLocaleString()}`} hint="USDT equivalent" icon={FiTrendingUp} accent={tok.brand} />
        <StatTile
          label="Total commission"
          value={`$${Number(stats?.totalCommission ?? 0).toLocaleString()}`}
          hint={stats?.commissionRate ? `Rate ${(stats.commissionRate * 100).toFixed(1)}%` : "—"}
          icon={FiDollarSign}
          accent="#8b5cf6"
        />
      </Box>

      <GlassCard p={0}>
        <Box px={4} pt={4}>
          <InfoTabs
            options={[
              { value: "PENDING", label: "Pending" },
              { value: "COMPLETED", label: "Completed" },
              { value: "REJECTED", label: "Rejected" },
            ]}
            value={tab}
            onChange={changeTab}
          />
        </Box>

        <Box p={4}>
          {loading ? (
            <Flex p={10} justify="center"><PageSpinner /></Flex>
          ) : queue.length === 0 ? (
            <EmptyState
              icon={FiInbox}
              title={`No ${tab.toLowerCase()} transactions`}
              hint="Nothing to review right now."
            />
          ) : (
            <VStack align="stretch" spacing={2}>
              {queue.map((txn: any) => {
                const isDeposit = txn.type === "DEPOSIT";
                const sideColor = isDeposit ? tok.success : tok.danger;
                return (
                  <Box
                    key={txn.id}
                    p={3.5}
                    bg={tok.panelInner}
                    border="1px solid"
                    borderColor={tok.panelBorder}
                    borderRadius="12px"
                    transition="all 0.15s"
                    _hover={{ borderColor: `${tok.brand}33` }}
                  >
                    <Flex justify="space-between" align="flex-start" flexWrap="wrap" gap={3}>
                      <HStack spacing={3}>
                        <Flex
                          w="38px"
                          h="38px"
                          borderRadius="10px"
                          bg={`${sideColor}18`}
                          color={sideColor}
                          align="center"
                          justify="center"
                        >
                          <Icon as={isDeposit ? FiArrowDownCircle : FiArrowUpCircle} boxSize={4} />
                        </Flex>
                        <Box>
                          <HStack spacing={2} mb={0.5}>
                            <Text fontSize="13px" fontWeight="900" color={tok.textMain}>
                              {txn.type}
                            </Text>
                            <Box px={2} py={0.5} borderRadius="5px" bg={`${tok.warning}18`}>
                              <Text fontSize="9.5px" color={tok.warning} fontWeight="900" letterSpacing=".06em">
                                {txn.status}
                              </Text>
                            </Box>
                          </HStack>
                          <Text fontSize="11.5px" color={tok.textSub}>
                            {txn.user?.firstName} {txn.user?.lastName}
                            {txn.user?.email && <Text as="span" color={tok.textMuted}> · {txn.user.email}</Text>}
                          </Text>
                          <Text fontSize="10.5px" color={tok.textMuted} fontFamily="monospace" mt={0.5}>
                            {txn.reference} · {new Date(txn.createdAt).toLocaleString()}
                          </Text>
                          {txn.userNotes && (
                            <Text fontSize="11px" color={tok.textSub} fontStyle="italic" mt={1}>
                              “{txn.userNotes}”
                            </Text>
                          )}
                        </Box>
                      </HStack>

                      <Text
                        fontSize="17px"
                        fontWeight="900"
                        color={tok.textMain}
                        fontFamily="'DM Mono', monospace"
                        letterSpacing="-0.02em"
                      >
                        {parseFloat(txn.amount).toFixed(2)}
                        <Text as="span" fontSize="11px" color={tok.textMuted} ml={1.5} fontWeight="700">
                          {txn.currency}
                        </Text>
                      </Text>
                    </Flex>

                    {tab === "PENDING" && (
                      <HStack spacing={2} mt={3} justify="flex-end">
                        <Button
                          size="sm"
                          h="34px"
                          variant="outline"
                          color={tok.danger}
                          borderColor="rgba(239,68,68,0.3)"
                          fontWeight="800"
                          borderRadius="9px"
                          fontSize="12px"
                          leftIcon={<FiXCircle />}
                          isLoading={busyId === txn.id}
                          onClick={() => rejectTxn(txn)}
                          _hover={{ bg: "rgba(239,68,68,0.08)", borderColor: tok.danger }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          h="34px"
                          bg={`linear-gradient(135deg, ${tok.success}, #15803d)`}
                          color="white"
                          fontWeight="800"
                          borderRadius="9px"
                          fontSize="12px"
                          leftIcon={<FiCheckCircle />}
                          isLoading={busyId === txn.id}
                          onClick={() => confirmTxn(txn)}
                          _hover={{ transform: "translateY(-1px)", boxShadow: `0 6px 16px ${tok.success}44` }}
                          transition="all 0.2s"
                        >
                          Confirm
                        </Button>
                      </HStack>
                    )}
                  </Box>
                );
              })}
            </VStack>
          )}
        </Box>
      </GlassCard>
    </PageShell>
  );
}
