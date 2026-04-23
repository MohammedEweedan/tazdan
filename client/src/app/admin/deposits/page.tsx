'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Button, Table, Thead, Tbody, Tr, Th, Td, Badge,
  useColorModeValue, useToast, Spinner, Flex, VStack, HStack,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { adminAPI } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AdminDepositsPage() {
  const { t } = useTranslate();
  const toast = useToast();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  const loadDeposits = async () => {
    try {
      const res = await adminAPI.getDeposits();
      setDeposits(res.data.deposits || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadDeposits(); }, []);

  const handleAction = async (id: string, action: 'confirm' | 'reject') => {
    try {
      if (action === 'confirm') await adminAPI.confirmDeposit(id);
      else await adminAPI.rejectDeposit(id);
      toast({ title: t('common_success'), status: 'success' });
      loadDeposits();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    }
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('admin_manage_deposits')}</Heading>
      <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" overflow="hidden">
        {loading ? (
          <Flex justify="center" py={10}><Spinner color="brand.500" /></Flex>
        ) : deposits.length === 0 ? (
          <VStack py={10}><Text color="subtle-text">{t('common_no_data')}</Text></VStack>
        ) : (
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>User</Th>
                <Th>{t('deposit_amount')}</Th>
                <Th>{t('deposit_method')}</Th>
                <Th>{t('deposit_sender_name')}</Th>
                <Th>{t('orders_status')}</Th>
                <Th>{t('orders_date')}</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {deposits.map((d: any) => (
                <Tr key={d.id}>
                  <Td fontSize="sm">{d.user?.firstName} {d.user?.lastName}<br /><Text fontSize="xs" color="subtle-text">{d.user?.email}</Text></Td>
                  <Td fontWeight="semibold">{formatCurrency(parseFloat(d.amount), d.currency)}</Td>
                  <Td fontSize="sm">{d.method?.replace('_', ' ')}</Td>
                  <Td fontSize="sm">{d.senderName || '-'}</Td>
                  <Td><Badge colorScheme={d.status === 'CONFIRMED' ? 'green' : d.status === 'PENDING' ? 'yellow' : 'red'}>{d.status}</Badge></Td>
                  <Td fontSize="xs" color="subtle-text">{formatDate(d.createdAt)}</Td>
                  <Td>
                    {d.status === 'PENDING' && (
                      <HStack spacing={2}>
                        <Button size="xs" colorScheme="green" onClick={() => handleAction(d.id, 'confirm')}>{t('admin_confirm')}</Button>
                        <Button size="xs" colorScheme="red" variant="outline" onClick={() => handleAction(d.id, 'reject')}>{t('admin_reject')}</Button>
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
