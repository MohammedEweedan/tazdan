'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Button, Card, CardHeader, CardBody, VStack, HStack,
  SimpleGrid, useColorModeValue, useToast, Badge, Progress, Avatar, Icon,
  Divider, Flex, Spinner, Alert, AlertIcon, Tabs, TabList, TabPanels, Tab, TabPanel,
  Stat, StatLabel, StatNumber, StatHelpText, useBreakpointValue,
} from '@chakra-ui/react';
import {
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiArrowUpCircle,
  FiArrowDownCircle,
  FiRefreshCw,
  FiUpload,
  FiPlus,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiExternalLink,
  FiDownload,
} from "react-icons/fi";
import { walletAPI } from '@/lib/api';
import { adminAPI } from '@/lib/api'; // optional depending on endpoint
import { formatCurrency, formatDate } from '@/lib/utils';

export default function WalletPage() {
  const toast = useToast();
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const bgSubtle = useColorModeValue('gray.50', 'gray.700');
  const textMuted = useColorModeValue('gray.500', 'gray.400');
  const isMobile = useBreakpointValue({ base: true, md: false });

  useEffect(() => {
    const load = async () => {
      try {
        const [w, t] = await Promise.all([
          walletAPI.getAll(),
          walletAPI.getTransactions(selectedWallet || "", 1),
        ]);
        setWallets(w.data.wallets || []);
        setTransactions(t.data.transactions || []);
      } catch (error) {
        console.error('Wallet page load error:', error);
        toast({
          title: 'Error loading wallet data',
          description: 'Please refresh the page',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [w, t] = await Promise.all([
        walletAPI.getAll(),
        walletAPI.getTransactions(selectedWallet || "", 1),
      ]);
      setWallets(w.data.wallets || []);
      setTransactions(t.data.transactions || []);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const totalBalance = wallets.reduce((sum, wallet) => 
    sum + ((wallet.available || 0) * (wallet.usdRate || 1)), 0
  );

  const totalFrozen = wallets.reduce((sum, wallet) => 
    sum + ((wallet.frozen || 0) * (wallet.usdRate || 1)), 0
  );

  const selectedWalletData = wallets.find(w => w.currency === selectedWallet);

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <VStack spacing={6}>
          <Spinner size="xl" color="brand.500" thickness="3px" />
          <Text color={textMuted}>Loading wallet data...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg={bgSubtle} py={4}>
      {/* Header */}
      <Box px={4} mb={6}>
        <VStack align="start" spacing={3}>
          <Flex justify="space-between" align="center" w="full">
            <Heading size="lg" fontWeight="700">
              My Wallets
            </Heading>
            <HStack spacing={2}>
              <Button
                leftIcon={<FiEye />}
                onClick={() => setShowBalances(!showBalances)}
                variant="outline"
                size="sm"
              >
                {showBalances ? "Hide" : "Show"}
              </Button>
              <Button
                leftIcon={<FiRefreshCw />}
                onClick={handleRefresh}
                isLoading={refreshing}
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>
            </HStack>
          </Flex>
          <Text fontSize="sm" color={textMuted}>
            Manage your cryptocurrency wallets and track balances
          </Text>
        </VStack>
      </Box>

      {/* Portfolio Overview */}
      <Box px={4} mb={6}>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Card
            bg={cardBg}
            border="1px"
            borderColor={cardBorder}
            borderRadius="lg"
          >
            <CardBody p={4}>
              <VStack align="start" spacing={2}>
                <HStack>
                  <Icon as={FiDollarSign} color="brand.500" boxSize={5} />
                  <Text fontSize="sm" color={textMuted} fontWeight="500">
                    Total Balance
                  </Text>
                </HStack>
                <Text fontSize="2xl" fontWeight="700">
                  {showBalances
                    ? formatCurrency(totalBalance, "USD")
                    : "••••••"}
                </Text>
                <HStack>
                  <Icon as={FiTrendingUp} color="green.500" boxSize={3} />
                  <Text fontSize="xs" color="green.500" fontWeight="600">
                    +12.5%
                  </Text>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          <Card
            bg={cardBg}
            border="1px"
            borderColor={cardBorder}
            borderRadius="lg"
          >
            <CardBody p={4}>
              <VStack align="start" spacing={2}>
                <HStack>
                  <Icon as={FiAlertTriangle} color="orange.500" boxSize={5} />
                  <Text fontSize="sm" color={textMuted} fontWeight="500">
                    Frozen Funds
                  </Text>
                </HStack>
                <Text fontSize="2xl" fontWeight="700" color="orange.500">
                  {showBalances ? formatCurrency(totalFrozen, "USD") : "••••••"}
                </Text>
                <Text fontSize="xs" color={textMuted}>
                  In pending orders
                </Text>
              </VStack>
            </CardBody>
          </Card>

          <Card
            bg={cardBg}
            border="1px"
            borderColor={cardBorder}
            borderRadius="lg"
          >
            <CardBody p={4}>
              <VStack align="start" spacing={2}>
                <HStack>
                  <Icon as={FiArrowUpCircle} color="green.500" boxSize={5} />
                  <Text fontSize="sm" color={textMuted} fontWeight="500">
                    Available
                  </Text>
                </HStack>
                <Text fontSize="2xl" fontWeight="700" color="green.500">
                  {showBalances
                    ? formatCurrency(totalBalance - totalFrozen, "USD")
                    : "••••••"}
                </Text>
                <Text fontSize="xs" color={textMuted}>
                  Ready to trade
                </Text>
              </VStack>
            </CardBody>
          </Card>

          <Card
            bg={cardBg}
            border="1px"
            borderColor={cardBorder}
            borderRadius="lg"
          >
            <CardBody p={4}>
              <VStack align="start" spacing={2}>
                <HStack>
                  <Icon as={FiDownload} color="blue.500" boxSize={5} />
                  <Text fontSize="sm" color={textMuted} fontWeight="500">
                    Wallets
                  </Text>
                </HStack>
                <Text fontSize="2xl" fontWeight="700">
                  {wallets.length}
                </Text>
                <Text fontSize="xs" color={textMuted}>
                  Active wallets
                </Text>
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>
      </Box>

      {/* Wallets and Transactions */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} px={4}>
        {/* Wallet List */}
        <Card
          bg={cardBg}
          border="1px"
          borderColor={cardBorder}
          borderRadius="lg"
        >
          <CardHeader pb={4}>
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="600">
                Your Wallets
              </Heading>
              <Button leftIcon={<FiPlus />} colorScheme="brand" size="sm">
                Add Wallet
              </Button>
            </Flex>
          </CardHeader>
          <CardBody>
            <VStack spacing={3}>
              {wallets.map((wallet) => (
                <Box
                  key={wallet.currency}
                  p={4}
                  bg={bgSubtle}
                  borderRadius="lg"
                  w="full"
                  cursor="pointer"
                  onClick={() => setSelectedWallet(wallet.currency)}
                  border={selectedWallet === wallet.currency ? "2px" : "1px"}
                  borderColor={
                    selectedWallet === wallet.currency
                      ? "brand.500"
                      : "transparent"
                  }
                >
                  <Flex justify="space-between" align="center">
                    <HStack spacing={3}>
                      <Avatar size="md" bg="brand.500">
                        <FiDollarSign size={5}/>
                      </Avatar>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="md" fontWeight="600">
                          {wallet.currency}
                        </Text>
                        <Text fontSize="xs" color={textMuted}>
                          {formatCurrency(wallet.usdRate || 1, "USD")} per{" "}
                          {wallet.currency}
                        </Text>
                      </VStack>
                    </HStack>
                    <VStack align="end" spacing={1}>
                      <Text fontSize="md" fontWeight="600">
                        {showBalances
                          ? formatCurrency(
                              wallet.available || 0,
                              wallet.currency,
                            )
                          : "••••••"}
                      </Text>
                      <Text fontSize="xs" color={textMuted}>
                        ≈{" "}
                        {showBalances
                          ? formatCurrency(
                              (wallet.available || 0) * (wallet.usdRate || 1),
                              "USD",
                            )
                          : "••••••"}
                      </Text>
                    </VStack>
                  </Flex>

                  <Progress
                    value={
                      ((wallet.available || 0) /
                        ((wallet.available || 0) + (wallet.frozen || 0))) *
                      100
                    }
                    colorScheme="green"
                    h={2}
                    w="full"
                    borderRadius="full"
                    mt={3}
                  />
                  <Flex justify="space-between" mt={2}>
                    <Text fontSize="xs" color={textMuted}>
                      Available:{" "}
                      {formatCurrency(wallet.available || 0, wallet.currency)}
                    </Text>
                    <Text fontSize="xs" color={textMuted}>
                      Frozen:{" "}
                      {formatCurrency(wallet.frozen || 0, wallet.currency)}
                    </Text>
                  </Flex>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Selected Wallet Details & Transactions */}
        {selectedWalletData ? (
          <VStack spacing={4}>
            {/* Wallet Details */}
            <Card
              bg={cardBg}
              border="1px"
              borderColor={cardBorder}
              borderRadius="lg"
            >
              <CardHeader pb={4}>
                <Flex justify="space-between" align="center">
                  <Heading size="md" fontWeight="600">
                    {selectedWalletData.currency} Details
                  </Heading>
                  <HStack spacing={2}>
                    <Button leftIcon={<FiUpload />} variant="outline" size="sm">
                      Send
                    </Button>
                    <Button
                      leftIcon={<FiDownload />}
                      variant="outline"
                      size="sm"
                    >
                      Receive
                    </Button>
                  </HStack>
                </Flex>
              </CardHeader>
              <CardBody>
                <VStack spacing={4}>
                  <SimpleGrid columns={2} w="full" spacing={4}>
                    <Box p={3} bg={bgSubtle} borderRadius="lg">
                      <Text fontSize="sm" color={textMuted} mb={1}>
                        Available Balance
                      </Text>
                      <Text fontSize="lg" fontWeight="600">
                        {showBalances
                          ? formatCurrency(
                              selectedWalletData.available || 0,
                              selectedWalletData.currency,
                            )
                          : "••••••"}
                      </Text>
                    </Box>
                    <Box p={3} bg={bgSubtle} borderRadius="lg">
                      <Text fontSize="sm" color={textMuted} mb={1}>
                        Frozen Balance
                      </Text>
                      <Text fontSize="lg" fontWeight="600" color="orange.500">
                        {showBalances
                          ? formatCurrency(
                              selectedWalletData.frozen || 0,
                              selectedWalletData.currency,
                            )
                          : "••••••"}
                      </Text>
                    </Box>
                  </SimpleGrid>

                  <Box p={3} bg={bgSubtle} borderRadius="lg" w="full">
                    <Text fontSize="sm" color={textMuted} mb={2}>
                      USD Value
                    </Text>
                    <Text fontSize="2xl" fontWeight="600">
                      {showBalances
                        ? formatCurrency(
                            (selectedWalletData.available || 0) *
                              (selectedWalletData.usdRate || 1),
                            "USD",
                          )
                        : "••••••"}
                    </Text>
                  </Box>

                  <Alert status="info" borderRadius="lg">
                    <AlertIcon />
                    <VStack align="start" spacing={1}>
                      <Text fontSize="sm" fontWeight="600">
                        Wallet Information
                      </Text>
                      <Text fontSize="xs" color={textMuted}>
                        This wallet supports instant deposits and withdrawals.
                        Processing time is typically 1-3 business days.
                      </Text>
                    </VStack>
                  </Alert>
                </VStack>
              </CardBody>
            </Card>

            {/* Recent Transactions */}
            <Card
              bg={cardBg}
              border="1px"
              borderColor={cardBorder}
              borderRadius="lg"
            >
              <CardHeader pb={4}>
                <Flex justify="space-between" align="center">
                  <Heading size="md" fontWeight="600">
                    Recent Transactions
                  </Heading>
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Flex>
              </CardHeader>
              <CardBody>
                <VStack spacing={3}>
                  {transactions
                    .filter((t) => t.currency === selectedWallet)
                    .slice(0, 5)
                    .map((transaction) => (
                      <Box
                        key={transaction.id}
                        p={3}
                        bg={bgSubtle}
                        borderRadius="lg"
                        w="full"
                      >
                        <Flex justify="space-between" align="center">
                          <HStack spacing={3}>
                            <Icon
                              as={
                                transaction.type === "DEPOSIT"
                                  ? FiDownload
                                  : FiUpload
                              }
                              color={
                                transaction.type === "DEPOSIT"
                                  ? "green.500"
                                  : "red.500"
                              }
                              boxSize={5}
                            />
                            <VStack align="start" spacing={1}>
                              <Text fontSize="sm" fontWeight="600">
                                {transaction.type === "DEPOSIT"
                                  ? "Deposit"
                                  : "Withdrawal"}
                              </Text>
                              <Text fontSize="xs" color={textMuted}>
                                {formatDate(transaction.createdAt)}
                              </Text>
                            </VStack>
                          </HStack>
                          <VStack align="end" spacing={1}>
                            <Text fontSize="sm" fontWeight="600">
                              {transaction.type === "DEPOSIT" ? "+" : "-"}
                              {formatCurrency(
                                transaction.amount,
                                transaction.currency,
                              )}
                            </Text>
                            <Badge
                              colorScheme={
                                transaction.status === "COMPLETED"
                                  ? "green"
                                  : transaction.status === "PENDING"
                                    ? "yellow"
                                    : "red"
                              }
                              fontSize="xs"
                            >
                              {transaction.status}
                            </Badge>
                          </VStack>
                        </Flex>
                      </Box>
                    ))}
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        ) : (
          <Card
            bg={cardBg}
            border="1px"
            borderColor={cardBorder}
            borderRadius="lg"
          >
            <CardBody py={12}>
              <VStack spacing={6}>
                <Icon as={FiDollarSign} boxSize={16} color={textMuted} />
                <VStack spacing={2}>
                  <Text fontSize="lg" fontWeight="600" color={textMuted}>
                    Select a Wallet
                  </Text>
                  <Text fontSize="sm" color={textMuted} textAlign="center">
                    Choose a wallet from the list to view detailed information
                    and transaction history
                  </Text>
                </VStack>
              </VStack>
            </CardBody>
          </Card>
        )}
      </SimpleGrid>
    </Box>
  );
}
