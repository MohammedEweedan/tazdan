'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Button, Table, Thead, Tbody, Tr, Th, Td, Badge,
  useColorModeValue, useToast, Spinner, Flex, VStack, HStack,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { adminAPI } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AdminWithdrawalsPage() {
  const { t } = useTranslate();
  const toast = useToast();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  const loadWithdrawals = async () => {
    try {
      const res = await adminAPI.getWithdrawals();
      setWithdrawals(res.data.withdrawals || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadWithdrawals(); }, []);

  const handleAction = async (id: string, action: 'process' | 'reject') => {
    try {
      if (action === 'process') await adminAPI.processWithdrawal(id);
      else await adminAPI.rejectWithdrawal(id);
      toast({ title: t('common_success'), status: 'success' });
      loadWithdrawals();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    }
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('admin_manage_withdrawals')}</Heading>
      <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" overflow="hidden">
        {loading ? (
          <Flex justify="center" py={10}><Spinner color="brand.500" /></Flex>
        ) : withdrawals.length === 0 ? (
          <VStack py={10}><Text color="subtle-text">{t('common_no_data')}</Text></VStack>
        ) : (
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>User</Th>
                <Th>{t('withdraw_amount')}</Th>
                <Th>{t('withdraw_method')}</Th>
                <Th>Destination</Th>
                <Th>{t('orders_status')}</Th>
                <Th>{t('orders_date')}</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {withdrawals.map((w: any) => (
                <Tr key={w.id}>
                  <Td fontSize="sm">{w.user?.firstName} {w.user?.lastName}<br /><Text fontSize="xs" color="subtle-text">{w.user?.email}</Text></Td>
                  <Td fontWeight="semibold">{formatCurrency(parseFloat(w.amount), w.currency)}</Td>
                  <Td fontSize="sm">{w.method?.replace('_', ' ')}</Td>
                  <Td fontSize="xs" maxW="150px" isTruncated>{w.walletAddress || `${w.bankName} - ${w.accountNumber}`}</Td>
                  <Td><Badge colorScheme={w.status === 'COMPLETED' ? 'green' : w.status === 'PENDING' ? 'yellow' : 'red'}>{w.status}</Badge></Td>
                  <Td fontSize="xs" color="subtle-text">{formatDate(w.createdAt)}</Td>
                  <Td>
                    {w.status === 'PENDING' && (
                      <HStack spacing={2}>
                        <Button size="xs" colorScheme="green" onClick={() => handleAction(w.id, 'process')}>{t('admin_process')}</Button>
                        <Button size="xs" colorScheme="red" variant="outline" onClick={() => handleAction(w.id, 'reject')}>{t('admin_reject')}</Button>
                      </HStack>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
