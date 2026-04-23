'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText,
  Table, Thead, Tbody, Tr, Th, Td, Badge, useColorModeValue, Spinner, Flex, VStack, Tabs, TabList, Tab, TabPanels, TabPanel,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { walletAPI } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function WalletPage() {
  const { t } = useTranslate();
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await walletAPI.getAll();
        const w = res.data.wallets || [];
        setWallets(w);
        const txns: Record<string, any[]> = {};
        for (const wallet of w) {
          try {
            const txRes = await walletAPI.getTransactions(wallet.currency);
            txns[wallet.currency] = txRes.data.transactions || [];
          } catch { txns[wallet.currency] = []; }
        }
        setTransactions(txns);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <Flex justify="center" py={20}><Spinner size="xl" color="brand.500" /></Flex>;

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('wallet_title')}</Heading>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={8}>
        {wallets.map((w: any) => (
          <Box key={w.currency} bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={5}>
            <Stat>
              <StatLabel fontSize="lg" fontWeight="bold">{w.currency}</StatLabel>
              <StatNumber fontSize="2xl">{formatCurrency(parseFloat(w.balance), w.currency)}</StatNumber>
              {parseFloat(w.frozen) > 0 && (
                <StatHelpText color="orange.400">{t('wallet_frozen')}: {formatCurrency(parseFloat(w.frozen), w.currency)}</StatHelpText>
              )}
              <StatHelpText color="subtle-text">
                {t('wallet_available')}: {formatCurrency(parseFloat(w.balance) - parseFloat(w.frozen || '0'), w.currency)}
              </StatHelpText>
            </Stat>
          </Box>
        ))}
      </SimpleGrid>

      <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" overflow="hidden">
        <Box px={5} py={4} borderBottomWidth="1px" borderColor={cardBorder}>
          <Text fontWeight="semibold">{t('wallet_transactions')}</Text>
        </Box>
        <Tabs colorScheme="brand">
          <TabList px={4}>
            {wallets.map((w: any) => (
              <Tab key={w.currency} fontSize="sm">{w.currency}</Tab>
            ))}
          </TabList>
          <TabPanels>
            {wallets.map((w: any) => (
              <TabPanel key={w.currency} p={0}>
                {(transactions[w.currency] || []).length === 0 ? (
                  <VStack py={10}><Text color="subtle-text">{t('common_no_data')}</Text></VStack>
                ) : (
                  <Table size="sm">
                    <Thead>
                      <Tr><Th>Type</Th><Th>{t('orders_amount')}</Th><Th>Reference</Th><Th>{t('orders_date')}</Th></Tr>
                    </Thead>
                    <Tbody>
                      {(transactions[w.currency] || []).map((tx: any) => (
                        <Tr key={tx.id}>
                          <Td><Badge colorScheme={tx.type === 'CREDIT' ? 'green' : 'red'}>{tx.type}</Badge></Td>
                          <Td fontWeight="semibold" color={tx.type === 'CREDIT' ? 'green.400' : 'red.400'}>
                            {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(parseFloat(tx.amount), w.currency)}
                          </Td>
                          <Td fontSize="xs" color="subtle-text">{tx.reference}</Td>
                          <Td fontSize="xs" color="subtle-text">{formatDate(tx.createdAt)}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
}
