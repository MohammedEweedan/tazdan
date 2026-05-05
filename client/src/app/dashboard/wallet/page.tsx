"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Box, Text, Button, VStack, HStack, Flex, Icon, Progress, useToast,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiDollarSign, FiArrowUpCircle, FiRefreshCw, FiUpload, FiDownload,
  FiEye, FiEyeOff, FiZap, FiAlertTriangle, FiInbox,
} from "react-icons/fi";
import { walletAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PageShell, PageHeader, GlassCard, SectionHeader, StatTile,
  PageSpinner, EmptyState, useDashboardTokens, PairAvatar, COIN_COLOR,
} from "@/components/dashboard/DashboardUI";
import { WalletAddressCard } from "@/components/wallet/WalletAddressCard";

export default function WalletPage() {
  const { t } = useTranslate();
  const toast = useToast();
  const tok = useDashboardTokens();
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const w = await walletAPI.getAll();
        setWallets(w.data.wallets || []);
        if (selectedWallet) {
          const txn = await walletAPI.getTransactions(selectedWallet, 1);
          setTransactions(txn.data.transactions || []);
        }
      } catch {
        toast({ title: t("common_error"), status: "error", duration: 3000 });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast, selectedWallet, t]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const w = await walletAPI.getAll();
      setWallets(w.data.wallets || []);
      if (selectedWallet) {
        const txn = await walletAPI.getTransactions(selectedWallet, 1);
        setTransactions(txn.data.transactions || []);
      }
    } catch {}
    setRefreshing(false);
  };

  const totalBalance = wallets.reduce((sum: number, w: any) => sum + ((w.available || 0) * (w.usdRate || 1)), 0);
  const totalFrozen = wallets.reduce((sum: number, w: any) => sum + ((w.frozen || 0) * (w.usdRate || 1)), 0);
  const selectedWalletData = wallets.find((w: any) => w.currency === selectedWallet);
  const mask = (s: string) => (showBalances ? s : "••••••");

  if (loading) return <PageShell><PageSpinner /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Balances"
        title="Wallet"
        subtitle="Every balance, across every network — all in one view."
        right={
          <HStack spacing={2}>
            <Button
              size="sm"
              h="36px"
              px={3}
              leftIcon={showBalances ? <FiEyeOff /> : <FiEye />}
              variant="ghost"
              onClick={() => setShowBalances((v) => !v)}
              color={tok.textSub}
              _hover={{ color: tok.textMain, bg: tok.hover }}
            >
              {showBalances ? t("wallet_hide") : t("wallet_show")}
            </Button>
            <Button
              size="sm"
              h="36px"
              px={3}
              leftIcon={<FiRefreshCw />}
              variant="ghost"
              onClick={handleRefresh}
              isLoading={refreshing}
              color={tok.textSub}
              _hover={{ color: tok.textMain, bg: tok.hover }}
            >
              Refresh
            </Button>
            <Button
              as={NextLink}
              href="/dashboard/trade"
              size="sm"
              h="36px"
              px={4}
              bg={`linear-gradient(135deg, ${tok.brand}, #003d82)`}
              color="white"
              fontWeight="800"
              borderRadius="10px"
              leftIcon={<FiZap />}
              _hover={{ transform: "translateY(-1px)", boxShadow: `0 8px 24px ${tok.brand}44` }}
              transition="all 0.2s"
            >
              Trade
            </Button>
          </HStack>
        }
      />

      {/* Stat tiles */}
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,1fr)", md: "repeat(4,1fr)" }} gap={3} mb={5}>
        <StatTile
          label="Total balance"
          value={mask(formatCurrency(totalBalance, "USD"))}
          hint="Across all assets"
          icon={FiDollarSign}
        />
        <StatTile
          label="Available"
          value={mask(formatCurrency(totalBalance - totalFrozen, "USD"))}
          hint="Ready to trade"
          icon={FiArrowUpCircle}
          accent={tok.success}
        />
        <StatTile
          label="Locked"
          value={mask(formatCurrency(totalFrozen, "USD"))}
          hint="In pending orders"
          icon={FiAlertTriangle}
          accent={tok.warning}
        />
        <StatTile
          label="Assets"
          value={String(wallets.length)}
          hint="Active wallets"
          icon={FiDownload}
        />
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }}
        gap={4}
      >
        {/* ── Wallet list ── */}
        <GlassCard p={4}>
          <SectionHeader title="My wallets" subtitle={`${wallets.length} assets`} />
          <VStack spacing={1} align="stretch">
            {wallets.map((w: any) => {
              const isSel = selectedWallet === w.currency;
              const avail = w.available || 0;
              const frozen = w.frozen || 0;
              const ratio = Math.min(100, (avail / Math.max(avail + frozen, 1)) * 100);
              const color = COIN_COLOR[w.currency] ?? tok.brand;
              return (
                <Box
                  key={w.currency}
                  onClick={() => setSelectedWallet(w.currency)}
                  cursor="pointer"
                  p={3}
                  borderRadius="12px"
                  bg={isSel ? (tok.dark ? "rgba(0,87,184,0.12)" : "rgba(0,87,184,0.06)") : "transparent"}
                  border="1px solid"
                  borderColor={isSel ? `${tok.brand}44` : "transparent"}
                  _hover={{ bg: tok.hover }}
                  transition="all 0.15s"
                >
                  <Flex justify="space-between" align="center" mb={2}>
                    <HStack spacing={3}>
                      <PairAvatar symbol={w.currency} color={color} size={36} />
                      <Box>
                        <Text fontSize="13px" fontWeight="800" color={tok.textMain}>{w.currency}</Text>
                        <Text fontSize="10.5px" color={tok.textMuted}>
                          1 {w.currency} ≈ {formatCurrency(w.usdRate || 1, "USD")}
                        </Text>
                      </Box>
                    </HStack>
                    <VStack align="flex-end" spacing={0}>
                      <Text fontSize="13px" fontWeight="800" color={tok.textMain} fontFamily="monospace">
                        {mask(formatCurrency(avail, w.currency))}
                      </Text>
                      <Text fontSize="10.5px" color={tok.textMuted} fontFamily="monospace">
                        ≈ {mask(formatCurrency(avail * (w.usdRate || 1), "USD"))}
                      </Text>
                    </VStack>
                  </Flex>
                  <Progress
                    value={ratio}
                    size="xs"
                    bg={tok.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                    borderRadius="full"
                    sx={{ "& > div": { background: color } }}
                  />
                  <HStack fontSize="10px" color={tok.textMuted} mt={1.5} justify="space-between">
                    <Text>Available {formatCurrency(avail, w.currency)}</Text>
                    <Text>Locked {formatCurrency(frozen, w.currency)}</Text>
                  </HStack>
                </Box>
              );
            })}
            {wallets.length === 0 && (
              <EmptyState title="No wallets yet" hint="Make a deposit to activate your first wallet." icon={FiInbox} />
            )}
          </VStack>
        </GlassCard>

        {/* ── Details panel ── */}
        <VStack align="stretch" spacing={4}>
          {selectedWalletData ? (
            <>
              <GlassCard p={5}>
                <Flex justify="space-between" align="center" mb={4}>
                  <HStack spacing={3}>
                    <PairAvatar symbol={selectedWalletData.currency} color={COIN_COLOR[selectedWalletData.currency] ?? tok.brand} size={40} />
                    <Box>
                      <Text fontSize="16px" fontWeight="900" color={tok.textMain}>{selectedWalletData.currency}</Text>
                      <Text fontSize="11px" color={tok.textMuted}>{t("wallet_details")}</Text>
                    </Box>
                  </HStack>
                  <HStack spacing={2}>
                    <Button
                      as={NextLink}
                      href="/dashboard/deposit"
                      size="sm"
                      h="32px"
                      leftIcon={<FiDownload />}
                      bg={tok.panelInner}
                      color={tok.textMain}
                      border="1px solid"
                      borderColor={tok.panelBorder}
                      _hover={{ bg: tok.hover }}
                      fontSize="12px"
                      fontWeight="700"
                    >
                      Deposit
                    </Button>
                    <Button
                      as={NextLink}
                      href="/dashboard/withdraw"
                      size="sm"
                      h="32px"
                      leftIcon={<FiUpload />}
                      bg={tok.panelInner}
                      color={tok.textMain}
                      border="1px solid"
                      borderColor={tok.panelBorder}
                      _hover={{ bg: tok.hover }}
                      fontSize="12px"
                      fontWeight="700"
                    >
                      Withdraw
                    </Button>
                  </HStack>
                </Flex>

                <Box
                  p={4}
                  bg={`linear-gradient(135deg, ${tok.brand}18, ${tok.brand}04)`}
                  border="1px solid"
                  borderColor={`${tok.brand}33`}
                  borderRadius="12px"
                  mb={3}
                >
                  <Text fontSize="10px" fontWeight="800" color={tok.textMuted} letterSpacing=".12em" textTransform="uppercase" mb={1}>
                    Total value
                  </Text>
                  <Text fontSize="28px" fontWeight="900" color={tok.textMain} letterSpacing="-0.025em" fontFamily="'DM Sans', sans-serif">
                    {mask(formatCurrency((selectedWalletData.available || 0) * (selectedWalletData.usdRate || 1), "USD"))}
                  </Text>
                  <Text fontSize="12px" color={tok.textSub} fontFamily="monospace" mt={0.5}>
                    {mask(formatCurrency(selectedWalletData.available || 0, selectedWalletData.currency))}
                  </Text>
                </Box>

                <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={3}>
                  <Box p={3} bg={tok.panelInner} borderRadius="10px" border="1px solid" borderColor={tok.panelBorder}>
                    <Text fontSize="10px" color={tok.textMuted} letterSpacing=".1em" textTransform="uppercase" fontWeight="700">
                      Available
                    </Text>
                    <Text fontSize="16px" fontWeight="800" color={tok.textMain} mt={1} fontFamily="monospace">
                      {mask(formatCurrency(selectedWalletData.available || 0, selectedWalletData.currency))}
                    </Text>
                  </Box>
                  <Box p={3} bg={tok.panelInner} borderRadius="10px" border="1px solid" borderColor={tok.panelBorder}>
                    <Text fontSize="10px" color={tok.textMuted} letterSpacing=".1em" textTransform="uppercase" fontWeight="700">
                      Locked
                    </Text>
                    <Text fontSize="16px" fontWeight="800" color={tok.warning} mt={1} fontFamily="monospace">
                      {mask(formatCurrency(selectedWalletData.frozen || 0, selectedWalletData.currency))}
                    </Text>
                  </Box>
                </Box>
              </GlassCard>

              {/* Deposit Address Card */}
              {selectedWalletData && ['BTC', 'ETH', 'USDT', 'SOL'].includes(selectedWalletData.currency) && (
                <WalletAddressCard
                  asset={selectedWalletData.currency as 'ETH' | 'BTC' | 'SOL' | 'USDT'}
                  network={selectedWalletData.currency === 'USDT' ? 'ERC20' : selectedWalletData.currency}
                  label={`${selectedWalletData.currency} Deposit`}
                />
              )}

              {/* Transactions */}
              <GlassCard p={0}>
                <Box px={4} py={3.5} borderBottom="1px solid" borderColor={tok.panelBorder}>
                  <SectionHeader
                    title="Recent transactions"
                    subtitle={`Latest ${selectedWalletData.currency} activity`}
                    right={
                      <Button variant="ghost" size="xs" color={tok.brand} fontWeight="700" _hover={{ bg: tok.hover }}>
                        View all
                      </Button>
                    }
                  />
                </Box>
                <VStack align="stretch" spacing={0}>
                  {transactions.filter((tx: any) => tx.currency === selectedWallet).slice(0, 6).map((tx: any) => {
                    const isIn = tx.type === "DEPOSIT" || tx.type === "TRANSFER_IN" || tx.type === "BUY";
                    return (
                      <Flex
                        key={tx.id}
                        px={4}
                        py={3}
                        borderBottom="1px solid"
                        borderColor={tok.panelBorder}
                        _last={{ borderBottom: "none" }}
                        justify="space-between"
                        align="center"
                        _hover={{ bg: tok.hover }}
                        transition="background 0.15s"
                      >
                        <HStack spacing={3}>
                          <Flex
                            w="34px"
                            h="34px"
                            borderRadius="10px"
                            bg={isIn ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}
                            align="center"
                            justify="center"
                          >
                            <Icon
                              as={isIn ? FiDownload : FiUpload}
                              color={isIn ? tok.success : tok.danger}
                              boxSize={4}
                            />
                          </Flex>
                          <Box>
                            <Text fontSize="12.5px" fontWeight="700" color={tok.textMain}>
                              {tx.type}
                            </Text>
                            <Text fontSize="10.5px" color={tok.textMuted}>
                              {formatDate(tx.createdAt)}
                            </Text>
                          </Box>
                        </HStack>
                        <VStack align="flex-end" spacing={0.5}>
                          <Text fontSize="13px" fontWeight="800" color={isIn ? tok.success : tok.danger} fontFamily="monospace">
                            {isIn ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                          </Text>
                          <Box
                            px={2}
                            py={0.5}
                            borderRadius="4px"
                            bg={
                              tx.status === "COMPLETED" || tx.status === "CONFIRMED"
                                ? "rgba(34,197,94,0.12)"
                                : tx.status === "PENDING"
                                ? "rgba(245,158,11,0.12)"
                                : "rgba(239,68,68,0.12)"
                            }
                          >
                            <Text
                              fontSize="9px"
                              fontWeight="800"
                              letterSpacing=".04em"
                              color={
                                tx.status === "COMPLETED" || tx.status === "CONFIRMED"
                                  ? tok.success
                                  : tx.status === "PENDING"
                                  ? tok.warning
                                  : tok.danger
                              }
                            >
                              {tx.status}
                            </Text>
                          </Box>
                        </VStack>
                      </Flex>
                    );
                  })}
                  {transactions.filter((tx: any) => tx.currency === selectedWallet).length === 0 && (
                    <Box p={6}>
                      <EmptyState title="No transactions yet" icon={FiInbox} />
                    </Box>
                  )}
                </VStack>
              </GlassCard>
            </>
          ) : (
            <GlassCard p={10}>
              <EmptyState
                title="Pick a wallet"
                hint="Select any asset on the left to see balances, deposit/withdraw, and recent activity."
                icon={FiDollarSign}
              />
            </GlassCard>
          )}
        </VStack>
      </Box>
    </PageShell>
  );
}
